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
                const { username, password } = await request.json().catch(() => ({}));
                const cleanUser = (username || '').trim().toLowerCase();
                const cleanPass = password || '';

                if (!cleanUser || cleanPass.length < 6) {
                    return sendJson(400, { success: false, message: 'Invalid username or password (min 6 chars).' });
                }

                // Check if user exists in KV
                const existingUser = await KV.get(`user:${cleanUser}`);
                if (existingUser) {
                    return sendJson(400, { success: false, message: 'Username already exists.' });
                }

                const saltBytes = crypto.getRandomValues(new Uint8Array(16));
                const saltHex = bufferToHex(saltBytes);
                const hashedPassword = await hashPassword(cleanPass, saltHex);

                // Save credentials to KV
                await KV.put(`user:${cleanUser}`, JSON.stringify({
                    username: cleanUser,
                    salt: saltHex,
                    hashedPassword
                }));

                const token = crypto.randomUUID();
                // Store session, expire in 24 hours (86400 seconds)
                await KV.put(`session:${token}`, cleanUser, { expirationTtl: 86400 });

                return sendJson(201, { success: true, token, username: cleanUser });
            }

            // Log In
            if (pathname === '/api/auth/login' && request.method === 'POST') {
                const { username, password } = await request.json().catch(() => ({}));
                const cleanUser = (username || '').trim().toLowerCase();
                const cleanPass = password || '';

                const userData = await KV.get(`user:${cleanUser}`, 'json');
                if (!userData) {
                    return sendJson(401, { success: false, message: 'Invalid username or password.' });
                }

                const hashed = await hashPassword(cleanPass, userData.salt);
                if (hashed !== userData.hashedPassword) {
                    return sendJson(401, { success: false, message: 'Invalid username or password.' });
                }

                const token = crypto.randomUUID();
                // Store session, expire in 24 hours
                await KV.put(`session:${token}`, cleanUser, { expirationTtl: 86400 });

                return sendJson(200, { success: true, token, username: cleanUser });
            }

            // --- PROJECTS MANAGEMENT API ---

            const currentUser = await getAuthenticatedUser(request, KV);
            if (!currentUser) {
                return sendJson(401, { success: false, message: 'Unauthorized session.' });
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
