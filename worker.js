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

                return sendJson(201, { success: true, token, username: cleanUser, email: cleanEmail });
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

                return sendJson(200, { success: true, token, username: targetUser, email: userData.email });
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

                // Send real email via EmailJS API
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
                            console.error('EmailJS sending failed:', errText);
                        } else {
                            console.log('EmailJS email sent successfully.');
                        }
                    } catch (err) {
                        console.error('Failed to send email via EmailJS:', err);
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

                return sendJson(200, { success: true, token, username: username, email: userData.email });
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

            return sendJson(404, { success: false, message: 'API Route not found.' });

        } catch (e) {
            return sendJson(500, { success: false, message: e.message || 'Worker server execution error.' });
        }
    }
}
