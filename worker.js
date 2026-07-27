/**
 * SlideEngine Cloudflare Workers Backend
 * Integrates directly with Cloudflare KV namespace for serverless databases.
 * Uses Web Crypto for secure PBKDF2 password hashing.
 */

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Filename',
};

// Response helper
function sendJson(status, data) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
        }
    });
}

// Convert ArrayBuffer to Hex string
function bufferToHex(buffer) {
    return Array.from(new Uint8Array(buffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

// PBKDF2 password hashing using built-in Web Crypto API
async function hashPassword(password, saltHex) {
    const encoder = new TextEncoder();
    const passwordBuffer = encoder.encode(password);
    
    // Parse salt hex string to Uint8Array
    const saltBuffer = new Uint8Array(
        saltHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16))
    );
    
    const key = await crypto.subtle.importKey(
        "raw",
        passwordBuffer,
        { name: "PBKDF2" },
        false,
        ["deriveBits", "deriveKey"]
    );
    
    const derivedBits = await crypto.subtle.deriveBits(
        {
            name: "PBKDF2",
            salt: saltBuffer,
            iterations: 1000,
            hash: "SHA-256"
        },
        key,
        256 // Derived key size in bits (32 bytes)
    );
    
    return bufferToHex(derivedBits);
}

// Authenticate session token
async function getAuthenticatedUser(request, KV) {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.substring(7);
    return await KV.get(`session:${token}`);
}

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const pathname = url.pathname;

        // Handle CORS preflight options
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                status: 204,
                headers: corsHeaders
            });
        }

        const KV = env.SLIDE_ENGINE_KV;
        if (!KV) {
            return sendJson(500, { success: false, message: "Server KV Binding configuration missing." });
        }

        try {
            // Serve uploaded files from R2
            if (pathname.startsWith('/uploads/') && request.method === 'GET') {
                const R2 = env.SLIDE_ENGINE_R2;
                if (!R2) {
                    return sendJson(500, { success: false, message: "Server R2 Binding configuration missing." });
                }

                const filename = pathname.split('/').pop();
                const object = await R2.get(`uploads/${filename}`);
                if (!object) {
                    return new Response("Object Not Found", { 
                        status: 404, 
                        headers: corsHeaders 
                    });
                }

                const headers = new Headers();
                object.writeHttpMetadata(headers);
                headers.set('etag', object.httpEtag);
                
                // Merge corsHeaders into response headers
                for (const [key, value] of Object.entries(corsHeaders)) {
                    headers.set(key, value);
                }

                return new Response(object.body, {
                    headers
                });
            }

            // --- AUTHENTICATION API ---
            
            // Sign Up
            if (pathname === '/api/auth/signup' && request.method === 'POST') {
                const { username, password, email } = await request.json().catch(() => ({}));
                const cleanUser = (username || '').trim().toLowerCase();
                const cleanEmail = (email || '').trim().toLowerCase();
                const cleanPass = password || '';

                if (!cleanUser || cleanPass.length < 6) {
                    return sendJson(400, { success: false, message: 'Invalid username or password (min 6 chars).' });
                }
                if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
                    return sendJson(400, { success: false, message: 'A valid email address is required.' });
                }

                // Check if user exists in KV
                const existingUser = await KV.get(`user:${cleanUser}`);
                if (existingUser) {
                    return sendJson(400, { success: false, message: 'Username already exists.' });
                }

                // Check if email already registered in KV
                const emailOwner = await KV.get(`email:${cleanEmail}`);
                if (emailOwner) {
                    return sendJson(400, { success: false, message: 'Email address is already registered.' });
                }

                const saltBytes = crypto.getRandomValues(new Uint8Array(16));
                const saltHex = bufferToHex(saltBytes);
                const hashedPassword = await hashPassword(cleanPass, saltHex);

                // Save credentials to KV
                await KV.put(`user:${cleanUser}`, JSON.stringify({
                    username: cleanUser,
                    email: cleanEmail,
                    salt: saltHex,
                    hashedPassword
                }));

                // Save email lookup index to KV
                await KV.put(`email:${cleanEmail}`, cleanUser);

                 const token = crypto.randomUUID();
                // Store session, expire in 24 hours (86400 seconds)
                await KV.put(`session:${token}`, cleanUser, { expirationTtl: 86400 });

                return sendJson(201, { success: true, token, username: cleanUser, email: cleanEmail, hasGeminiKey: false });
            }

            // Log In
            if (pathname === '/api/auth/login' && request.method === 'POST') {
                const { username, password } = await request.json().catch(() => ({}));
                const cleanInput = (username || '').trim().toLowerCase();
                const cleanPass = password || '';

                let targetUser = cleanInput;
                if (cleanInput.includes('@')) {
                    const mappedUser = await KV.get(`email:${cleanInput}`);
                    if (!mappedUser) {
                        return sendJson(401, { success: false, message: 'Invalid username/email or password.' });
                    }
                    targetUser = mappedUser;
                }

                const userData = await KV.get(`user:${targetUser}`, 'json');
                if (!userData) {
                    return sendJson(401, { success: false, message: 'Invalid username/email or password.' });
                }

                const hashed = await hashPassword(cleanPass, userData.salt);
                if (hashed !== userData.hashedPassword) {
                    return sendJson(401, { success: false, message: 'Invalid username/email or password.' });
                }

                const token = crypto.randomUUID();
                // Store session, expire in 24 hours
                await KV.put(`session:${token}`, targetUser, { expirationTtl: 86400 });

                return sendJson(200, { success: true, token, username: targetUser, email: userData.email, hasGeminiKey: !!userData.geminiApiKey });
            }

            // Forgot Password
            if (pathname === '/api/auth/forgot-password' && request.method === 'POST') {
                const { email } = await request.json().catch(() => ({}));
                const cleanEmail = (email || '').trim().toLowerCase();

                if (!cleanEmail) {
                    return sendJson(400, { success: false, message: 'Email is required.' });
                }

                const username = await KV.get(`email:${cleanEmail}`);
                if (!username) {
                    return sendJson(404, { success: false, message: 'No account found with this email.' });
                }

                const userData = await KV.get(`user:${username}`, 'json');
                if (!userData) {
                    return sendJson(404, { success: false, message: 'No account found with this email.' });
                }

                // Generate a 6-digit random code
                const code = Math.floor(100000 + Math.random() * 900000).toString();
                const expires = Date.now() + 15 * 60 * 1000; // 15 minutes

                userData.resetCode = code;
                userData.resetExpires = expires;
                await KV.put(`user:${username}`, JSON.stringify(userData));

                // Log code for testing/development
                console.log(`[FORGOT PASSWORD] Reset code for ${username} (${cleanEmail}): ${code}`);

                // HTML Email Template
                const htmlContent = `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e0e0e0; border-radius: 8px; background-color: #ffffff; color: #333333;">
                        <h2 style="color: #111111; margin-bottom: 20px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; font-size: 1.3rem; border-bottom: 2px solid #111111; padding-bottom: 10px; display: inline-block;">SlideEngine</h2>
                        <p style="font-size: 1rem; line-height: 1.5; color: #444444; margin-bottom: 16px;">Hello <strong>${username}</strong>,</p>
                        <p style="font-size: 1rem; line-height: 1.5; color: #444444; margin-bottom: 24px;">You requested a password reset for your SlideEngine account. Please use the verification code below to set a new password:</p>
                        <div style="text-align: center; margin: 25px 0;">
                            <div style="display: inline-block; padding: 14px 28px; font-size: 1.85rem; font-weight: 700; font-family: 'Courier New', Courier, monospace; color: #ffffff; background-color: #000000; border-radius: 6px; letter-spacing: 5px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">${code}</div>
                        </div>
                        <p style="font-size: 0.85rem; line-height: 1.5; color: #777777; margin-top: 30px; border-top: 1px solid #eeeeee; padding-top: 15px;">
                            This code is valid for <strong>15 minutes</strong>. If you did not request this password reset, please ignore this email.
                        </p>
                        <p style="font-size: 0.85rem; line-height: 1.5; color: #777777; margin-top: 10px;">
                            Best regards,<br>
                            <strong>SlideEngine Team</strong>
                        </p>
                    </div>
                `;

                let emailSent = false;

                // 1. Try EmailJS (Primary - 200 free emails/month, Gmail-approved)
                const emailjsServiceId = env.EMAILJS_SERVICE_ID || 'service_6cdxfjj';
                const emailjsTemplateId = env.EMAILJS_TEMPLATE_ID || 'template_3we2jee';
                const emailjsPublicKey = env.EMAILJS_PUBLIC_KEY || '4drbxU0P1LUaYFJfL';
                const emailjsPrivateKey = env.EMAILJS_PRIVATE_KEY || ''; // Optional

                if (emailjsServiceId && emailjsTemplateId && emailjsPublicKey) {
                    try {
                        const emailRes = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                service_id: emailjsServiceId,
                                template_id: emailjsTemplateId,
                                user_id: emailjsPublicKey,
                                ...(emailjsPrivateKey ? { accessToken: emailjsPrivateKey } : {}),
                                template_params: {
                                    to_email: cleanEmail,
                                    email: cleanEmail,
                                    user_email: cleanEmail,
                                    user_name: username,
                                    reset_code: code,
                                    subject: 'SlideEngine Password Reset Code',
                                    from_name: 'SlideEngine Auth'
                                }
                            })
                        });
                        if (!emailRes.ok) {
                            const errText = await emailRes.text();
                            console.error('EmailJS sending failed, trying backup...', errText);
                        } else {
                            console.log('EmailJS email sent successfully.');
                            emailSent = true;
                        }
                    } catch (err) {
                        console.error('Failed to send email via EmailJS, trying backup...', err);
                    }
                }

                // 2. Try Brevo (Backup 1 - 300 free emails/day, requires custom domain for Gmail DMARC)
                if (!emailSent) {
                    const brevoApiKey = env.BREVO_API_KEY;
                    const brevoSenderEmail = env.BREVO_SENDER_EMAIL || 'slide.engi@gmail.com';
                    const brevoSenderName = env.BREVO_SENDER_NAME || 'SlideEngine Auth';

                    if (brevoApiKey) {
                        try {
                            const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
                                method: 'POST',
                                headers: {
                                    'api-key': brevoApiKey,
                                    'content-type': 'application/json',
                                    'accept': 'application/json'
                                },
                                body: JSON.stringify({
                                    sender: {
                                        name: brevoSenderName,
                                        email: brevoSenderEmail
                                    },
                                    to: [
                                        {
                                            email: cleanEmail,
                                            name: username
                                        }
                                    ],
                                    subject: 'SlideEngine Password Reset Code',
                                    htmlContent: htmlContent
                                })
                            });

                            if (brevoRes.ok) {
                                console.log('Brevo email sent successfully.');
                                emailSent = true;
                            } else {
                                const errText = await brevoRes.text();
                                console.error('Brevo sending failed:', errText);
                            }
                        } catch (err) {
                            console.error('Failed to send email via Brevo:', err);
                        }
                    }
                }

                return sendJson(200, { success: true, message: 'Reset code generated successfully.' });
            }

            // Reset Password
            if (pathname === '/api/auth/reset-password' && request.method === 'POST') {
                const { email, code, newPassword } = await request.json().catch(() => ({}));
                const cleanEmail = (email || '').trim().toLowerCase();
                const cleanCode = (code || '').trim();
                const cleanPass = newPassword || '';

                if (!cleanEmail || !cleanCode || cleanPass.length < 6) {
                    return sendJson(400, { success: false, message: 'All fields are required and password must be min 6 chars.' });
                }

                const username = await KV.get(`email:${cleanEmail}`);
                if (!username) {
                    return sendJson(400, { success: false, message: 'Invalid email or reset code.' });
                }

                const userData = await KV.get(`user:${username}`, 'json');
                if (!userData || !userData.resetCode || userData.resetCode !== cleanCode || !userData.resetExpires || userData.resetExpires < Date.now()) {
                    return sendJson(400, { success: false, message: 'Invalid or expired reset code.' });
                }

                // Update password
                const saltBytes = crypto.getRandomValues(new Uint8Array(16));
                const saltHex = bufferToHex(saltBytes);
                const hashedPassword = await hashPassword(cleanPass, saltHex);

                userData.salt = saltHex;
                userData.hashedPassword = hashedPassword;
                delete userData.resetCode;
                delete userData.resetExpires;

                await KV.put(`user:${username}`, JSON.stringify(userData));

                return sendJson(200, { success: true, message: 'Password reset successful.' });
            }

            // Google Authentication
            if (pathname === '/api/auth/google' && request.method === 'POST') {
                const { credential, isMock } = await request.json().catch(() => ({}));
                if (!credential) {
                    return sendJson(400, { success: false, message: 'Google credential ID Token is required.' });
                }

                let email = '';
                let name = '';
                let googleId = '';

                if (isMock) {
                    // Parse mock credential for local development. format: mock_token_for_<email>_<name>_<id>
                    const parts = credential.split('_');
                    email = parts[3] || 'mock@example.com';
                    name = parts[4] || 'Mock User';
                    googleId = parts[5] || 'mock-id-12345';
                } else {
                    try {
                        const tokenInfoUrl = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`;
                        const googleRes = await fetch(tokenInfoUrl);
                        const response = await googleRes.json();

                        if (response.error || !response.email) {
                            return sendJson(401, { success: false, message: response.error_description || 'Invalid Google Token.' });
                        }

                        email = response.email.toLowerCase();
                        name = response.name || response.given_name || 'Google User';
                        googleId = response.sub;
                    } catch (e) {
                        console.error('Google verification failed:', e);
                        return sendJson(500, { success: false, message: 'Google authentication failed.' });
                    }
                }

                // Look up user by googleId index
                let username = await KV.get(`google:${googleId}`);
                let userData = null;

                if (username) {
                    userData = await KV.get(`user:${username}`, 'json');
                }

                // If not found by googleId, check by email
                if (!userData && email) {
                    username = await KV.get(`email:${email}`);
                    if (username) {
                        userData = await KV.get(`user:${username}`, 'json');
                        if (userData) {
                            // Link google ID index
                            userData.googleId = googleId;
                            await KV.put(`user:${username}`, JSON.stringify(userData));
                            await KV.put(`google:${googleId}`, username);
                        }
                    }
                }

                // Create new user if not exists
                if (!userData) {
                    const emailPrefix = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
                    username = emailPrefix || 'googleuser';
                    
                    // Enforce uniqueness of username
                    let existing = await KV.get(`user:${username}`);
                    let suffix = 1;
                    while (existing) {
                        username = `${emailPrefix}${suffix++}`;
                        existing = await KV.get(`user:${username}`);
                    }

                    const saltBytes = crypto.getRandomValues(new Uint8Array(16));
                    const saltHex = bufferToHex(saltBytes);
                    // Filler password
                    const hashedPassword = await hashPassword(crypto.randomUUID(), saltHex);

                    userData = {
                        username,
                        email,
                        googleId,
                        salt: saltHex,
                        hashedPassword
                    };

                    await KV.put(`user:${username}`, JSON.stringify(userData));
                    await KV.put(`email:${email}`, username);
                    await KV.put(`google:${googleId}`, username);
                }

                const token = crypto.randomUUID();
                await KV.put(`session:${token}`, username, { expirationTtl: 86400 });

                return sendJson(200, { success: true, token, username: username, email: userData.email, hasGeminiKey: !!userData.geminiApiKey });
            }

            // --- PROJECTS MANAGEMENT API ---

            const currentUser = await getAuthenticatedUser(request, KV);
            if (!currentUser) {
                return sendJson(401, { success: false, message: 'Unauthorized session.' });
            }

            // Update Email (Migration for legacy users)
            if (pathname === '/api/auth/update-email' && request.method === 'POST') {
                const { email } = await request.json().catch(() => ({}));
                const cleanEmail = (email || '').trim().toLowerCase();

                if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
                    return sendJson(400, { success: false, message: 'A valid email address is required.' });
                }

                // Check if email already registered to someone else
                const emailOwner = await KV.get(`email:${cleanEmail}`);
                if (emailOwner && emailOwner !== currentUser) {
                    return sendJson(400, { success: false, message: 'Email address is already in use.' });
                }

                const userData = await KV.get(`user:${currentUser}`, 'json');
                if (!userData) {
                    return sendJson(404, { success: false, message: 'User profile not found.' });
                }

                // Update email and save
                userData.email = cleanEmail;
                await KV.put(`user:${currentUser}`, JSON.stringify(userData));
                await KV.put(`email:${cleanEmail}`, currentUser);

                return sendJson(200, { success: true, message: 'Email address updated successfully.' });
            }

            // Update Gemini Key
            if (pathname === '/api/auth/update-gemini-key' && request.method === 'POST') {
                const { geminiApiKey } = await request.json().catch(() => ({}));
                const cleanKey = (geminiApiKey || '').trim();

                const userData = await KV.get(`user:${currentUser}`, 'json');
                if (!userData) {
                    return sendJson(404, { success: false, message: 'User profile not found.' });
                }

                if (cleanKey) {
                    userData.geminiApiKey = cleanKey;
                } else {
                    delete userData.geminiApiKey;
                }
                await KV.put(`user:${currentUser}`, JSON.stringify(userData));

                return sendJson(200, { success: true, message: 'Gemini API Key updated successfully.' });
            }

            // Upload file to R2
            if (pathname === '/api/upload' && request.method === 'POST') {
                const R2 = env.SLIDE_ENGINE_R2;
                if (!R2) {
                    return sendJson(500, { success: false, message: "Server R2 Binding configuration missing." });
                }

                const filenameHeader = url.searchParams.get('filename') || request.headers.get('x-filename') || 'upload.mp4';
                const cleanFilename = filenameHeader.split('/').pop().replace(/[^a-zA-Z0-9\.\-_]/g, '_');
                const uniqueFilename = `${Date.now()}_${cleanFilename}`;

                const contentType = request.headers.get('content-type') || 'application/octet-stream';
                
                // Write file to R2 bucket
                await R2.put(`uploads/${uniqueFilename}`, request.body, {
                    httpMetadata: { contentType: contentType }
                });

                // Return absolute URL of the uploaded resource so client can load it from any origin
                const absoluteUrl = `${url.origin}/uploads/${uniqueFilename}`;

                return sendJson(200, { success: true, url: absoluteUrl });
            }

            // Fetch User Projects List
            if (pathname === '/api/projects' && request.method === 'GET') {
                const projectsList = await KV.get(`projects_list:${currentUser}`, 'json') || [];
                return sendJson(200, projectsList);
            }

            // Fetch Specific Project
            if (pathname.startsWith('/api/projects/') && request.method === 'GET') {
                const projectId = pathname.split('/').pop();
                
                // Get full project contents
                const projectContent = await KV.get(`project:${projectId}`, 'json');
                if (!projectContent) {
                    return sendJson(404, { success: false, message: 'Project data not found.' });
                }

                // Verify project list ownership check
                const projectsList = await KV.get(`projects_list:${currentUser}`, 'json') || [];
                const meta = projectsList.find(p => p.id === projectId);
                if (!meta) {
                    return sendJson(403, { success: false, message: 'Access denied.' });
                }

                return sendJson(200, { project: projectContent, meta });
            }

            // Update/Save Project
            if (pathname.startsWith('/api/projects/') && request.method === 'PUT') {
                const projectId = pathname.split('/').pop();
                const { project, meta } = await request.json().catch(() => ({}));

                if (!project || !meta) {
                    return sendJson(400, { success: false, message: 'Missing project content or metadata.' });
                }

                // Enforce current authenticated user ownership
                meta.userId = currentUser;

                // Write full project file to KV
                await KV.put(`project:${projectId}`, JSON.stringify(project));

                // Update projects metadata array
                const projectsList = await KV.get(`projects_list:${currentUser}`, 'json') || [];
                const filteredList = projectsList.filter(p => p.id !== projectId);
                filteredList.push(meta);
                await KV.put(`projects_list:${currentUser}`, JSON.stringify(filteredList));

                return sendJson(200, { success: true });
            }

            // Delete Project
            if (pathname.startsWith('/api/projects/') && request.method === 'DELETE') {
                const projectId = pathname.split('/').pop();

                const projectsList = await KV.get(`projects_list:${currentUser}`, 'json') || [];
                const meta = projectsList.find(p => p.id === projectId);
                
                if (!meta) {
                    return sendJson(403, { success: false, message: 'Access denied.' });
                }

                // Delete details from KV
                await KV.delete(`project:${projectId}`);

                // Update list
                const filteredList = projectsList.filter(p => p.id !== projectId);
                await KV.put(`projects_list:${currentUser}`, JSON.stringify(filteredList));

                return sendJson(200, { success: true });
            }

            // AI Generation Endpoint
            if (pathname === '/api/ai/generate' && request.method === 'POST') {
                const { prompt, mode, theme, slideCount } = await request.json().catch(() => ({}));
                
                // 1. Get user API Key from KV profile
                const userData = await KV.get(`user:${currentUser}`, 'json');
                let apiKey = (userData && userData.geminiApiKey) || env.GEMINI_API_KEY;

                if (!apiKey) {
                    return sendJson(400, { 
                        success: false, 
                        message: 'No Google Gemini API Key configured. Please enter your Gemini API Key in the settings panel.' 
                    });
                }

                const cleanPrompt = (prompt || '').trim();
                if (!cleanPrompt) {
                    return sendJson(400, { success: false, message: 'Prompt is required.' });
                }

                const count = parseInt(slideCount) || 3;
                const maxCount = Math.min(10, Math.max(1, count));

                 const systemInstruction = `You are a professional WebGL slide layout designer. Your goal is to generate visually rich, premium-looking vector presentations and interactive quizzes.
The standard canvas dimensions are 1920x1080 (16:9 aspect ratio). All coordinates and sizes must fit inside this resolution without clipping.

Design Requirements:
1. BACKGROUNDS: Use premium gradient color palettes matching the theme. Set "type" to "gradient", and provide distinct, harmonious colors for "gradientStart" and "gradientEnd". Set "gradientAngle" to 135.
2. SLIDE VARIETY (AI Presentation Mode):
   - Slide 1: Title/Hero layout. Large centered title (fontSize 64-80) and a smaller subtitle below it.
   - Slide 2: Two-column card comparison or split-screen content.
   - Slide 3: Three-column timeline, steps, or feature list.
   - Subsequent slides: Alternating layout (e.g., image placeholders, quotes, or cards).
3. CARD LAYOUTS: To create structured cards, generate text elements with:
   - "bgAlpha": 0.85 or 1 (solid or semi-transparent background).
   - "bgColor": A contrasting dark or light shade matching the theme.
   - "borderRadius": 12.
   - "padding": 20.
   - "textColor": High contrast text color.
4. FONT PAIRING & THEMES:
   - "Obsidian Dark": Dark slate/indigo gradient (e.g., #0b0f19 to #1e293b). Text color #ffffff. Heading font "Outfit", body font "Inter". Accent buttons #3b82f6 (blue).
   - "Neon Cyberpunk": Deep violet/indigo gradient (e.g., #09090e to #250a3a). Neon highlights (cyan #00ffff, pink #ff007f). Heading font "Space Grotesk" or "VT323", body font "Fira Code". Accent buttons #ff007f.
   - "Classic Serif": Warm cream gradient (e.g., #faf6ee to #e8e2d5). Text color #1c1917. Heading font "Playfair Display" or "Cinzel", body font "Cardo". Accent buttons #8b5cf6 (violet).
   - "Minimalist Light": Soft gray/slate gradient (e.g., #f8fafc to #cbd5e1). Text color #0f172a. Heading font "Unbounded" or "Outfit", body font "Inter". Accent buttons #10b981 (emerald).
   - "Retro Game": Dark green/black gradient (e.g., #070f0a to #121e16). Pixelated fonts ("Press Start 2P" or "Silkscreen" or "VT323"). Text color #f1c40f (yellow) or #2ecc71. Accent buttons #f1c40f.
5. QUIZ SLIDES:
   - Centered question header at y: 150, width: 1500.
   - Arranged 4 answer option buttons ("btn-option") in a neat 2x2 grid (e.g. Option A at x: 200, y: 350; Option B at x: 1000, y: 350; Option C at x: 200, y: 500; Option D at x: 1000, y: 500; all width: 720, height: 100) or stacked vertically.
   - One correct answer (isCorrect: true). All sharing the same "group" string (e.g., "group-1").
   - A timer element at x: 910, y: 40, width: 100, height: 80, duration: 30.
   - A btn-show-ans element at x: 860, y: 750, width: 200, height: 60, targeting the correct option element ID.

JSON Output Format:
Return your output STRICTLY as a JSON object matching this schema. Do NOT include markdown code blocks (e.g., \`\`\`json).
{
  "slides": [
    {
      "id": "slide_unique_id",
      "name": "Slide Name",
      "rpgTheme": false,
      "transition": "none",
      "background": {
        "type": "gradient",
        "color": "#050507",
        "gradientStart": "#0b0f19",
        "gradientEnd": "#1e293b",
        "gradientAngle": 135,
        "imageUrl": ""
      },
      "elements": [
        // Each element must have: id (unique e.g. text-1, opt-1), type, x, y, width, height, visible: true, zIndex: integer.
        // Elements can be:
        // 1. type "text": text, fontFamily, fontSize (e.g. 24-48), align ("left", "center", "right"), textColor (hex), bgColor (hex), bgAlpha (0 to 1), borderRadius, borderWidth, borderColor.
        // 2. type "btn-nav": text, targetSlideId (must match another slide's id to link slides), textColor, bgColor, bgAlpha, borderRadius.
        // 3. type "btn-option": text, isCorrect (boolean), group (string), textColor, bgColor, bgAlpha, borderRadius.
        // 4. type "btn-show-ans": text, targetElementId (id of correct btn-option element), textColor, bgColor, bgAlpha, borderRadius.
        // 5. type "timer": text (initial e.g. "30"), duration (integer), textColor, bgColor, bgAlpha, borderRadius.
      ]
    }
  ]
}`;

                const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

                try {
                    const response = await fetch(geminiUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{
                                parts: [{
                                    text: `Generate a presentation deck or quiz in "${mode}" mode on the topic: "${cleanPrompt}". Apply theme: "${theme}". Number of slides: ${maxCount}.`
                                }]
                            }],
                            systemInstruction: {
                                parts: [{
                                    text: systemInstruction
                                }]
                            },
                            generationConfig: {
                                responseMimeType: "application/json"
                            }
                        })
                    });

                    if (!response.ok) {
                        const errorText = await response.text();
                        throw new Error(`Gemini API error: ${errorText}`);
                    }

                    const result = await response.json();
                    const textResponse = result.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (!textResponse) {
                        throw new Error('Empty response from Gemini.');
                    }

                    const parsedData = JSON.parse(textResponse);
                    return sendJson(200, parsedData);
                } catch (err) {
                    console.error('[AI Generation Error]:', err);
                    return sendJson(500, { success: false, message: `AI generation failed: ${err.message}` });
                }
            }

            if (pathname === '/api/ai/refine-layout' && request.method === 'POST') {
                const currentUser = getAuthenticatedUser(request);
                if (!currentUser) {
                    return sendJson(401, { success: false, message: 'Unauthorized. Please log in first.' });
                }

                const body = await parseBody(request);
                const { elements, prompt } = body;

                if (!elements || !Array.isArray(elements) || elements.length === 0) {
                    return sendJson(400, { success: false, message: 'No elements selected for refinement.' });
                }

                const userStr = await env.SLIDE_ENGINE_KV.get(`user:${currentUser}`);
                const userData = userStr ? JSON.parse(userStr) : null;
                let apiKey = (userData && userData.geminiApiKey) || env.GEMINI_API_KEY;

                if (!apiKey) {
                    return sendJson(400, { 
                        success: false, 
                        message: 'No Google Gemini API Key configured. Please enter your Gemini API Key in the settings panel.' 
                    });
                }

                const refinementPrompt = (prompt || '').trim();

                const systemInstruction = `You are a professional slide design alignment agent. Your task is to auto-align, space, and layout a set of slide elements to look modern, clean, and balanced.
The slide canvas dimensions are 1920x1080.
You will receive a list of selected elements with their current x, y, width, height, type, text, align, etc.
Based on the alignment prompt or instructions, you must rearrange their positions (x, y), sizes (width, height), and text alignments (align) to form a neat grid, multi-column stack, vertical stack, or another requested structure.
Keep the exact same IDs, types, and text content for the elements. Only adjust layout properties: x, y, width, height, and align.
Ensure elements do not overlap unless requested, are spaced evenly, and fit nicely within 1920x1080 resolution.

Return the modified elements STRICTLY as a JSON object containing an "elements" array. Do NOT include markdown formatting or backticks.
{
  "elements": [
    {
      "id": "element_id",
      "type": "text",
      "text": "original_text",
      "x": 100,
      "y": 200,
      "width": 500,
      "height": 150,
      "align": "center"
    }
  ]
}`;

                const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

                try {
                    const response = await fetch(geminiUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{
                                parts: [{
                                    text: `Align/refine these elements based on this instruction: "${refinementPrompt}".
Elements list:
${JSON.stringify(elements, null, 2)}`
                                }]
                            }],
                            systemInstruction: {
                                parts: [{
                                    text: systemInstruction
                                }]
                            },
                            generationConfig: {
                                responseMimeType: "application/json"
                            }
                        })
                    });

                    if (!response.ok) {
                        const errorText = await response.text();
                        throw new Error(`Gemini API error: ${errorText}`);
                    }

                    const result = await response.json();
                    const textResponse = result.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (!textResponse) {
                        throw new Error('Empty response from Gemini.');
                    }

                    const parsedData = JSON.parse(textResponse);
                    return sendJson(200, parsedData);
                } catch (err) {
                    console.error('[AI Refinement Error]:', err);
                    return sendJson(500, { success: false, message: `AI refinement failed: ${err.message}` });
                }
            }

            if (pathname === '/api/ai/generate-asset' && request.method === 'POST') {
                const currentUser = getAuthenticatedUser(request);
                if (!currentUser) {
                    return sendJson(401, { success: false, message: 'Unauthorized. Please log in first.' });
                }

                const body = await parseBody(request);
                const { prompt } = body;

                const cleanPrompt = (prompt || '').trim();
                if (!cleanPrompt) {
                    return sendJson(400, { success: false, message: 'Prompt is required.' });
                }

                const cleanEncodedPrompt = encodeURIComponent(cleanPrompt);
                const seed = Math.floor(Math.random() * 1000000);
                const pollinationsUrl = `https://image.pollinations.ai/prompt/${cleanEncodedPrompt}?width=1024&height=1024&nologo=true&private=true&seed=${seed}`;

                try {
                    const response = await fetch(pollinationsUrl);
                    if (!response.ok) {
                        throw new Error(`Image generation source error: ${response.statusText}`);
                    }

                    const buffer = await response.arrayBuffer();
                    const uniqueFilename = `ai-asset-${Date.now()}.png`;

                    const R2 = env.SLIDE_ENGINE_R2;
                    if (!R2) {
                        return sendJson(500, { success: false, message: "Server R2 Binding configuration missing." });
                    }

                    await R2.put(`uploads/${uniqueFilename}`, buffer, {
                        httpMetadata: { contentType: 'image/png' },
                        customMetadata: {
                            'uploaded-by': currentUser || 'guest'
                        }
                    });

                    const absoluteUrl = `${url.origin}/uploads/${uniqueFilename}`;
                    return sendJson(200, { success: true, url: absoluteUrl });
                } catch (err) {
                    console.error('[AI Asset Generation Error]:', err);
                    return sendJson(500, { success: false, message: `AI asset generation failed: ${err.message}` });
                }
            }

            return sendJson(404, { success: false, message: 'API Route not found.' });

        } catch (e) {
            return sendJson(500, { success: false, message: e.message || 'Worker server execution error.' });
        }
    }
}
