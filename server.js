/**
 * SlideEngine Zero-Dependency Local Server
 * Serves frontend static files and implements API endpoints for authentication and project management.
 * Persists data in a local 'db_data' directory.
 * Run with: node server.js
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const url = require('url');
const nodemailer = require('nodemailer');

const PORT = 3000;
const DB_DIR = path.join(__dirname, 'db_data');
const PROJECTS_DIR = path.join(DB_DIR, 'projects');

// Load environment variables from .env file if it exists
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
    try {
        const envContent = fs.readFileSync(envPath, 'utf8');
        envContent.split(/\r?\n/).forEach(line => {
            const parts = line.split('=');
            if (parts.length >= 2) {
                const key = parts[0].trim();
                const value = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
                if (key && !key.startsWith('#')) {
                    process.env[key] = value;
                }
            }
        });
    } catch (e) {
        console.error('Failed to read .env file:', e);
    }
}

// Configure Nodemailer transporter (for real reset password emails)
// To use, set SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS environment variables.
const mailTransporter = (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) ? nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
}) : null;

// Ensure database directories exist
if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR);
}
if (!fs.existsSync(PROJECTS_DIR)) {
    fs.mkdirSync(PROJECTS_DIR);
}

// Synchronous debugging logger to avoid stdout buffering in background tasks
const debugLog = (msg) => {
    try {
        fs.appendFileSync(path.join(__dirname, 'server_debug.log'), `[${new Date().toISOString()}] ${msg}\n`);
    } catch (e) {
        console.error('debugLog write failed:', e);
    }
};

// Automatic garbage collection for uploads folder
function cleanupUnusedUploads() {
    const uploadsDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadsDir)) return;

    const referencedFiles = new Set();

    // 1. Scan all project JSON files for referenced upload filenames
    if (fs.existsSync(PROJECTS_DIR)) {
        try {
            const files = fs.readdirSync(PROJECTS_DIR);
            for (const file of files) {
                if (file.endsWith('.json')) {
                    const filePath = path.join(PROJECTS_DIR, file);
                    const content = fs.readFileSync(filePath, 'utf8');
                    
                    // Match /uploads/filename
                    const matches = content.match(/\/uploads\/[a-zA-Z0-9\.\-_]+/g);
                    if (matches) {
                        for (const match of matches) {
                            const filename = match.replace('/uploads/', '');
                            referencedFiles.add(filename);
                        }
                    }
                }
            }
        } catch (e) {
            console.error('Error scanning projects for cleanup:', e);
        }
    }

    // 2. Scan uploads directory and delete unreferenced files older than 5 minutes (to allow saving window)
    try {
        const files = fs.readdirSync(uploadsDir);
        const now = Date.now();
        for (const file of files) {
            const filePath = path.join(uploadsDir, file);
            const stats = fs.statSync(filePath);
            const isOldEnough = (now - stats.mtimeMs) > 300000; // 5 minutes in ms
            
            if (isOldEnough && !referencedFiles.has(file)) {
                fs.unlinkSync(filePath);
                debugLog(`[Cleanup] Deleted unreferenced upload file: ${file}`);
            }
        }
    } catch (e) {
        console.error('Error cleaning up uploads:', e);
    }
}

// Memory cache for active sessions (token -> username)
const activeSessions = new Map();

// Helper to read JSON DB file with fallback
function readJsonFile(filePath, fallback = []) {
    if (!fs.existsSync(filePath)) return fallback;
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(content);
    } catch (e) {
        console.error(`Error reading ${filePath}:`, e);
        return fallback;
    }
}

// Helper to write JSON DB file
function writeJsonFile(filePath, data) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (e) {
        console.error(`Error writing ${filePath}:`, e);
        return false;
    }
}

// Parse request body helper
function parseBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch (e) {
                reject(new Error('Invalid JSON payload'));
            }
        });
        req.on('error', err => {
            reject(err);
        });
    });
}

// Helper to authenticate session token
function getAuthenticatedUser(req) {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.substring(7);
    return activeSessions.get(token) || null;
}

// Respond with JSON helper
function sendJson(res, statusCode, data) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
}

// MIME Types mapping for static file serving
const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.ogg': 'video/ogg'
};

const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    debugLog(`[Request] ${req.method} ${req.url}`);

    // 1. CORS Headers for API requests
    if (pathname.startsWith('/api/')) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Filename');
        
        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
        }
    }

    // 2. API ENDPOINTS
    try {
        // --- AUTH API ---
        if (pathname === '/api/auth/signup' && req.method === 'POST') {
            const { username, password, email } = await parseBody(req);
            const cleanUser = (username || '').trim().toLowerCase();
            const cleanEmail = (email || '').trim().toLowerCase();
            const cleanPass = password || '';

            if (!cleanUser || cleanPass.length < 6) {
                return sendJson(res, 400, { success: false, message: 'Invalid username or password (min 6 chars).' });
            }
            if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
                return sendJson(res, 400, { success: false, message: 'A valid email address is required.' });
            }

            const usersFile = path.join(DB_DIR, 'users.json');
            const users = readJsonFile(usersFile, []);

            if (users.some(u => u.username === cleanUser)) {
                return sendJson(res, 400, { success: false, message: 'Username already exists.' });
            }
            if (users.some(u => u.email === cleanEmail)) {
                return sendJson(res, 400, { success: false, message: 'Email address is already registered.' });
            }

            const salt = crypto.randomBytes(16).toString('hex');
            const hashedPassword = crypto.pbkdf2Sync(cleanPass, salt, 1000, 64, 'sha256').toString('hex');

            users.push({ username: cleanUser, email: cleanEmail, salt, hashedPassword });
            writeJsonFile(usersFile, users);

            const token = crypto.randomBytes(32).toString('hex');
            activeSessions.set(token, cleanUser);

            return sendJson(res, 201, { success: true, token, username: cleanUser, email: cleanEmail });
        }

        if (pathname === '/api/auth/login' && req.method === 'POST') {
            const { username, password } = await parseBody(req);
            const cleanInput = (username || '').trim().toLowerCase();
            const cleanPass = password || '';

            const usersFile = path.join(DB_DIR, 'users.json');
            const users = readJsonFile(usersFile, []);

            let user;
            if (cleanInput.includes('@')) {
                user = users.find(u => u.email === cleanInput);
            } else {
                user = users.find(u => u.username === cleanInput);
            }

            if (!user) {
                return sendJson(res, 401, { success: false, message: 'Invalid username/email or password.' });
            }

            const hashedPassword = crypto.pbkdf2Sync(cleanPass, user.salt, 1000, 64, 'sha256').toString('hex');
            if (hashedPassword !== user.hashedPassword) {
                return sendJson(res, 401, { success: false, message: 'Invalid username/email or password.' });
            }

            const token = crypto.randomBytes(32).toString('hex');
            activeSessions.set(token, user.username);

            return sendJson(res, 200, { success: true, token, username: user.username, email: user.email });
        }

        if (pathname === '/api/auth/forgot-password' && req.method === 'POST') {
            const { email } = await parseBody(req);
            const cleanEmail = (email || '').trim().toLowerCase();

            if (!cleanEmail) {
                return sendJson(res, 400, { success: false, message: 'Email is required.' });
            }

            const usersFile = path.join(DB_DIR, 'users.json');
            const users = readJsonFile(usersFile, []);

            const userIndex = users.findIndex(u => u.email === cleanEmail);
            if (userIndex === -1) {
                return sendJson(res, 404, { success: false, message: 'No account found with this email.' });
            }

            // Generate a 6-digit random code
            const code = Math.floor(100000 + Math.random() * 900000).toString();
            const expires = Date.now() + 15 * 60 * 1000; // 15 minutes

            users[userIndex].resetCode = code;
            users[userIndex].resetExpires = expires;
            writeJsonFile(usersFile, users);

            // Log code for testing/development
            const logMsg = `[FORGOT PASSWORD] Reset code for ${users[userIndex].username} (${cleanEmail}): ${code}`;
            console.log(`\x1b[33m${logMsg}\x1b[0m`);
            debugLog(logMsg);

            // Send real email if configured (EmailJS takes precedence, then SMTP)
            const emailjsServiceId = process.env.EMAILJS_SERVICE_ID || 'service_6cdxfjj';
            const emailjsTemplateId = process.env.EMAILJS_TEMPLATE_ID || 'template_3we2jee';
            const emailjsPublicKey = process.env.EMAILJS_PUBLIC_KEY || '4drbxU0P1LUaYFJfL';
            const emailjsPrivateKey = process.env.EMAILJS_PRIVATE_KEY || ''; // Optional

            if (emailjsServiceId && emailjsTemplateId && emailjsPublicKey) {
                fetch('https://api.emailjs.com/api/v1.0/email/send', {
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
                            user_name: users[userIndex].username,
                            reset_code: code,
                            subject: 'SlideEngine Password Reset Code',
                            from_name: 'SlideEngine Auth'
                        }
                    })
                }).then(async emailRes => {
                    if (emailRes.ok) {
                        console.log(`\x1b[32m[EMAIL SUCCESS] EmailJS sent email to ${cleanEmail}\x1b[0m`);
                        debugLog(`[EMAIL SUCCESS] EmailJS sent to ${cleanEmail}`);
                    } else {
                        const errText = await emailRes.text();
                        console.error(`\x1b[31m[EMAIL ERROR] EmailJS failed: ${errText}\x1b[0m`);
                        debugLog(`[EMAIL ERROR] EmailJS failed: ${errText}`);
                    }
                }).catch(err => {
                    console.error(`\x1b[31m[EMAIL ERROR] Failed to fetch EmailJS: ${err.message}\x1b[0m`);
                });
            } else if (mailTransporter) {
                const mailOptions = {
                    from: `"SlideEngine Auth" <${process.env.SMTP_USER}>`,
                    to: cleanEmail,
                    subject: 'SlideEngine Password Reset Code',
                    text: `Hello ${users[userIndex].username},\n\nYou requested a password reset for your SlideEngine account.\n\nYour 6-digit verification code is: ${code}\n\nThis code will expire in 15 minutes.\n\nIf you did not request this, please ignore this email.\n\nBest regards,\nSlideEngine Team`,
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e0e0e0; border-radius: 8px; background-color: #ffffff; color: #333333;">
                            <h2 style="color: #111111; margin-bottom: 20px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; font-size: 1.3rem; border-bottom: 2px solid #111111; padding-bottom: 10px; display: inline-block;">SlideEngine</h2>
                            <p style="font-size: 1rem; line-height: 1.5; color: #444444; margin-bottom: 16px;">Hello <strong>${users[userIndex].username}</strong>,</p>
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
                    `
                };
                
                mailTransporter.sendMail(mailOptions, (error, info) => {
                    if (error) {
                        console.error(`\x1b[31m[EMAIL ERROR] Failed to send email to ${cleanEmail}: ${error.message}\x1b[0m`);
                        debugLog(`[EMAIL ERROR] Failed to send email: ${error.message}`);
                    } else {
                        console.log(`\x1b[32m[EMAIL SUCCESS] Email sent to ${cleanEmail}: ${info.response}\x1b[0m`);
                        debugLog(`[EMAIL SUCCESS] Email sent: ${info.response}`);
                    }
                });
            } else {
                console.log(`\x1b[35m[SMTP INFO] Email sending not configured. Reset code printed to terminal only.\x1b[0m`);
            }

            return sendJson(res, 200, { success: true, message: 'Reset code generated successfully.' });
        }

        if (pathname === '/api/auth/reset-password' && req.method === 'POST') {
            const { email, code, newPassword } = await parseBody(req);
            const cleanEmail = (email || '').trim().toLowerCase();
            const cleanCode = (code || '').trim();
            const cleanPass = newPassword || '';

            if (!cleanEmail || !cleanCode || cleanPass.length < 6) {
                return sendJson(res, 400, { success: false, message: 'All fields are required and password must be min 6 chars.' });
            }

            const usersFile = path.join(DB_DIR, 'users.json');
            const users = readJsonFile(usersFile, []);

            const userIndex = users.findIndex(u => u.email === cleanEmail);
            if (userIndex === -1) {
                return sendJson(res, 400, { success: false, message: 'Invalid email or reset code.' });
            }

            const user = users[userIndex];
            if (!user.resetCode || user.resetCode !== cleanCode || !user.resetExpires || user.resetExpires < Date.now()) {
                return sendJson(res, 400, { success: false, message: 'Invalid or expired reset code.' });
            }

            // Update password
            const salt = crypto.randomBytes(16).toString('hex');
            const hashedPassword = crypto.pbkdf2Sync(cleanPass, salt, 1000, 64, 'sha256').toString('hex');

            users[userIndex].salt = salt;
            users[userIndex].hashedPassword = hashedPassword;
            delete users[userIndex].resetCode;
            delete users[userIndex].resetExpires;
            
            writeJsonFile(usersFile, users);
            debugLog(`[PASSWORD RESET] Successfully reset password for ${user.username}`);

            return sendJson(res, 200, { success: true, message: 'Password reset successful.' });
        }

        if (pathname === '/api/auth/google' && req.method === 'POST') {
            const { credential, isMock } = await parseBody(req);
            if (!credential) {
                return sendJson(res, 400, { success: false, message: 'Google credential ID Token is required.' });
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
                    // Call Google token info API to verify JWT safely without external packages
                    const tokenInfoUrl = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`;
                    const response = await new Promise((resolve, reject) => {
                        https.get(tokenInfoUrl, (googleRes) => {
                            let data = '';
                            googleRes.on('data', chunk => data += chunk);
                            googleRes.on('end', () => {
                                try {
                                    resolve(JSON.parse(data));
                                } catch (e) {
                                    reject(e);
                                }
                            });
                            googleRes.on('error', err => reject(err));
                        }).on('error', err => reject(err));
                    });

                    if (response.error || !response.email) {
                        return sendJson(res, 401, { success: false, message: response.error_description || 'Invalid Google Token.' });
                    }

                    email = response.email.toLowerCase();
                    name = response.name || response.given_name || 'Google User';
                    googleId = response.sub;
                } catch (e) {
                    console.error('Google verification failed:', e);
                    return sendJson(res, 500, { success: false, message: 'Google authentication failed.' });
                }
            }

            const usersFile = path.join(DB_DIR, 'users.json');
            const users = readJsonFile(usersFile, []);

            // Check if user exists by googleId
            let user = users.find(u => u.googleId === googleId);
            
            // If not found by googleId, check by email
            if (!user && email) {
                user = users.find(u => u.email === email);
                if (user) {
                    // Link googleId to existing account
                    user.googleId = googleId;
                    writeJsonFile(usersFile, users);
                }
            }

            // If still not found, create new user
            if (!user) {
                // Generate a unique username derived from email or name
                const emailPrefix = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
                let username = emailPrefix || 'googleuser';
                let suffix = 1;
                while (users.some(u => u.username === username)) {
                    username = `${emailPrefix}${suffix++}`;
                }

                user = {
                    username,
                    email,
                    googleId,
                    salt: crypto.randomBytes(16).toString('hex'), // filler salt
                    hashedPassword: crypto.randomBytes(32).toString('hex') // filler password
                };

                users.push(user);
                writeJsonFile(usersFile, users);
            }

            const token = crypto.randomBytes(32).toString('hex');
            activeSessions.set(token, user.username);

            return sendJson(res, 200, { success: true, token, username: user.username, email: user.email });
        }

        if (pathname === '/api/auth/update-email' && req.method === 'POST') {
            const currentUser = getAuthenticatedUser(req);
            if (!currentUser) {
                return sendJson(res, 401, { success: false, message: 'Unauthorized.' });
            }

            const { email } = await parseBody(req);
            const cleanEmail = (email || '').trim().toLowerCase();

            if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
                return sendJson(res, 400, { success: false, message: 'A valid email address is required.' });
            }

            const usersFile = path.join(DB_DIR, 'users.json');
            const users = readJsonFile(usersFile, []);

            // Check if email is already taken by another user
            if (users.some(u => u.email === cleanEmail && u.username !== currentUser)) {
                return sendJson(res, 400, { success: false, message: 'Email address is already in use.' });
            }

            const userIndex = users.findIndex(u => u.username === currentUser);
            if (userIndex === -1) {
                return sendJson(res, 404, { success: false, message: 'User not found.' });
            }

            users[userIndex].email = cleanEmail;
            writeJsonFile(usersFile, users);
            debugLog(`[EMAIL UPDATE] User ${currentUser} linked email ${cleanEmail}`);

            return sendJson(res, 200, { success: true, message: 'Email address updated successfully.' });
        }

        // --- PROJECTS API (Authenticated) ---
        if (pathname === '/api/projects' && req.method === 'GET') {
            const currentUser = getAuthenticatedUser(req);
            if (!currentUser) {
                return sendJson(res, 401, { success: false, message: 'Unauthorized.' });
            }

            const metaFile = path.join(DB_DIR, 'projects_list.json');
            const allMeta = readJsonFile(metaFile, []);
            const userMeta = allMeta.filter(p => p.userId === currentUser);

            return sendJson(res, 200, userMeta);
        }

        if (pathname.startsWith('/api/projects/') && req.method === 'GET') {
            const currentUser = getAuthenticatedUser(req);
            if (!currentUser) {
                return sendJson(res, 401, { success: false, message: 'Unauthorized.' });
            }

            const projectId = pathname.split('/').pop();
            const projectFile = path.join(PROJECTS_DIR, `project_${projectId}.json`);

            if (!fs.existsSync(projectFile)) {
                return sendJson(res, 404, { success: false, message: 'Project not found.' });
            }

            try {
                const projectData = JSON.parse(fs.readFileSync(projectFile, 'utf8'));
                // Verify project ownership
                const metaFile = path.join(DB_DIR, 'projects_list.json');
                const allMeta = readJsonFile(metaFile, []);
                const meta = allMeta.find(p => p.id === projectId);

                if (!meta || meta.userId !== currentUser) {
                    return sendJson(res, 403, { success: false, message: 'Access denied.' });
                }

                return sendJson(res, 200, { project: projectData, meta });
            } catch (e) {
                return sendJson(res, 500, { success: false, message: 'Error parsing project data.' });
            }
        }

        if (pathname.startsWith('/api/projects/') && req.method === 'PUT') {
            const currentUser = getAuthenticatedUser(req);
            if (!currentUser) {
                return sendJson(res, 401, { success: false, message: 'Unauthorized.' });
            }

            const projectId = pathname.split('/').pop();
            const { project, meta } = await parseBody(req);

            if (!project || !meta) {
                return sendJson(res, 400, { success: false, message: 'Missing project content or metadata.' });
            }

            // Enforce correct ownership on meta
            meta.userId = currentUser;

            // Write full project payload to details folder
            const projectFile = path.join(PROJECTS_DIR, `project_${projectId}.json`);
            writeJsonFile(projectFile, project);

            // Update projects list metadata
            const metaFile = path.join(DB_DIR, 'projects_list.json');
            const allMeta = readJsonFile(metaFile, []);
            const cleanMeta = allMeta.filter(p => p.id !== projectId);
            cleanMeta.push(meta);
            writeJsonFile(metaFile, cleanMeta);

            // Run garbage collection on uploads
            cleanupUnusedUploads();

            return sendJson(res, 200, { success: true });
        }

        if (pathname.startsWith('/api/projects/') && req.method === 'DELETE') {
            const currentUser = getAuthenticatedUser(req);
            if (!currentUser) {
                return sendJson(res, 401, { success: false, message: 'Unauthorized.' });
            }

            const projectId = pathname.split('/').pop();
            const metaFile = path.join(DB_DIR, 'projects_list.json');
            const allMeta = readJsonFile(metaFile, []);
            
            const meta = allMeta.find(p => p.id === projectId);
            if (!meta || meta.userId !== currentUser) {
                return sendJson(res, 403, { success: false, message: 'Access denied.' });
            }

            // Remove project file
            const projectFile = path.join(PROJECTS_DIR, `project_${projectId}.json`);
            if (fs.existsSync(projectFile)) {
                fs.unlinkSync(projectFile);
            }

            // Remove metadata
            const cleanMeta = allMeta.filter(p => p.id !== projectId);
            writeJsonFile(metaFile, cleanMeta);

            // Run garbage collection on uploads
            cleanupUnusedUploads();

            return sendJson(res, 200, { success: true });
        }

        if (pathname === '/api/debug-log' && req.method === 'POST') {
            const body = await parseBody(req);
            debugLog(`[BROWSER ERROR] ${JSON.stringify(body, null, 2)}`);
            return sendJson(res, 200, { success: true });
        }

        if (pathname === '/api/upload' && req.method === 'POST') {
            debugLog('[Upload API] POST request received');
            const filenameHeader = parsedUrl.query.filename || req.headers['x-filename'] || 'upload.mp4';
            debugLog('[Upload API] Filename resolved: ' + filenameHeader);
            const cleanFilename = path.basename(filenameHeader).replace(/[^a-zA-Z0-9\.\-_]/g, '_');
            const uniqueFilename = `${Date.now()}_${cleanFilename}`;
            
            const uploadsDir = path.join(__dirname, 'uploads');
            debugLog('[Upload API] Uploads directory target: ' + uploadsDir);
            if (!fs.existsSync(uploadsDir)) {
                fs.mkdirSync(uploadsDir);
                debugLog('[Upload API] Created uploads folder');
            }
            
            const destPath = path.join(uploadsDir, uniqueFilename);
            debugLog('[Upload API] Destination file path: ' + destPath);
            const writeStream = fs.createWriteStream(destPath);
            
            req.pipe(writeStream);
            
            return new Promise((resolve) => {
                writeStream.on('finish', () => {
                    const host = req.headers.host || 'localhost:3000';
                    const protocol = req.socket.encrypted ? 'https' : 'http';
                    const absoluteUrl = `${protocol}://${host}/uploads/${uniqueFilename}`;
                    sendJson(res, 200, { success: true, url: absoluteUrl });
                    resolve();
                });
                writeStream.on('error', (err) => {
                    debugLog('[Upload API] File write error event: ' + err.message);
                    sendJson(res, 500, { success: false, message: 'Failed to write file.' });
                    resolve();
                });
            });
        }

        // Catch unregistered APIs
        if (pathname.startsWith('/api/')) {
            return sendJson(res, 404, { success: false, message: 'Endpoint not found.' });
        }

    } catch (e) {
        console.error('Server processing error:', e);
        return sendJson(res, 500, { success: false, message: e.message || 'Internal server error.' });
    }

    // 3. STATIC FILE SERVER
    let sanitizePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
    if (sanitizePath === '/' || sanitizePath === '\\') {
        sanitizePath = '/index.html';
    }

    const filePath = path.join(__dirname, sanitizePath);

    // Secure path check: prevent directory traversal
    if (!filePath.startsWith(__dirname)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('403 Forbidden');
        return;
    }

    fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found');
            return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        res.writeHead(200, { 'Content-Type': contentType });
        const stream = fs.createReadStream(filePath);
        stream.pipe(res);
    });
});

server.listen(PORT, () => {
    console.log(`\x1b[32m[SlideEngine Backend]\x1b[0m Running locally at http://localhost:${PORT}`);
    console.log(`  - Serve workspace files`);
    console.log(`  - Database directory: ${DB_DIR}`);
    console.log(`  - Press Ctrl+C to terminate`);
    
    // Clean up any unreferenced uploads on startup
    cleanupUnusedUploads();
});
