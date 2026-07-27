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

            return sendJson(res, 201, { success: true, token, username: cleanUser, email: cleanEmail, hasGeminiKey: false });
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

            return sendJson(res, 200, { success: true, token, username: user.username, email: user.email, hasGeminiKey: !!user.geminiApiKey });
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

            // HTML Email Template
            const htmlContent = `
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
            `;

            let emailSent = false;

            // 1. Try EmailJS (Primary - 200 free emails/month, Gmail-approved)
            const emailjsServiceId = process.env.EMAILJS_SERVICE_ID || 'service_6cdxfjj';
            const emailjsTemplateId = process.env.EMAILJS_TEMPLATE_ID || 'template_3we2jee';
            const emailjsPublicKey = process.env.EMAILJS_PUBLIC_KEY || '4drbxU0P1LUaYFJfL';
            const emailjsPrivateKey = process.env.EMAILJS_PRIVATE_KEY || ''; // Optional

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
                                user_name: users[userIndex].username,
                                reset_code: code,
                                subject: 'SlideEngine Password Reset Code',
                                from_name: 'SlideEngine Auth'
                            }
                        })
                    });

                    if (emailRes.ok) {
                        console.log(`\x1b[32m[EMAIL SUCCESS] EmailJS sent email to ${cleanEmail}\x1b[0m`);
                        debugLog(`[EMAIL SUCCESS] EmailJS sent to ${cleanEmail}`);
                        emailSent = true;
                    } else {
                        const errText = await emailRes.text();
                        console.error(`\x1b[31m[EMAIL ERROR] EmailJS failed, trying backup... ${errText}\x1b[0m`);
                        debugLog(`[EMAIL ERROR] EmailJS failed: ${errText}`);
                    }
                } catch (err) {
                    console.error(`\x1b[31m[EMAIL ERROR] EmailJS request error, trying backup... ${err.message}\x1b[0m`);
                }
            }

            // 2. Try Brevo (Backup 1 - 300 free emails/day, requires custom domain for Gmail DMARC)
            if (!emailSent) {
                const brevoApiKey = process.env.BREVO_API_KEY;
                const brevoSenderEmail = process.env.BREVO_SENDER_EMAIL || 'slide.engi@gmail.com';
                const brevoSenderName = process.env.BREVO_SENDER_NAME || 'SlideEngine Auth';

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
                                        name: users[userIndex].username
                                    }
                                ],
                                subject: 'SlideEngine Password Reset Code',
                                htmlContent: htmlContent
                            })
                        });

                        if (brevoRes.ok) {
                            console.log(`\x1b[32m[EMAIL SUCCESS] Brevo sent email to ${cleanEmail}\x1b[0m`);
                            debugLog(`[EMAIL SUCCESS] Brevo sent to ${cleanEmail}`);
                            emailSent = true;
                        } else {
                            const errText = await brevoRes.text();
                            console.error(`\x1b[31m[EMAIL ERROR] Brevo failed, trying backup... ${errText}\x1b[0m`);
                            debugLog(`[EMAIL ERROR] Brevo failed: ${errText}`);
                        }
                    } catch (err) {
                        console.error(`\x1b[31m[EMAIL ERROR] Brevo request error, trying backup... ${err.message}\x1b[0m`);
                    }
                }
            }

            // 3. Try SMTP (Backup 2)
            if (!emailSent && mailTransporter) {
                const mailOptions = {
                    from: `"SlideEngine Auth" <${process.env.SMTP_USER}>`,
                    to: cleanEmail,
                    subject: 'SlideEngine Password Reset Code',
                    text: `Hello ${users[userIndex].username},\n\nYou requested a password reset for your SlideEngine account.\n\nYour 6-digit verification code is: ${code}\n\nThis code will expire in 15 minutes.\n\nIf you did not request this, please ignore this email.\n\nBest regards,\nSlideEngine Team`,
                    html: htmlContent
                };

                mailTransporter.sendMail(mailOptions, (error, info) => {
                    if (error) {
                        console.error(`\x1b[31m[EMAIL ERROR] SMTP failed to send to ${cleanEmail}: ${error.message}\x1b[0m`);
                        debugLog(`[EMAIL ERROR] SMTP failed: ${error.message}`);
                    } else {
                        console.log(`\x1b[32m[EMAIL SUCCESS] SMTP sent email to ${cleanEmail}: ${info.response}\x1b[0m`);
                        debugLog(`[EMAIL SUCCESS] SMTP sent: ${info.response}`);
                    }
                });
                emailSent = true;
            }

            // 4. Log to console if no email could be dispatched
            if (!emailSent) {
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

            return sendJson(res, 200, { success: true, token, username: user.username, email: user.email, hasGeminiKey: !!user.geminiApiKey });
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

        if (pathname === '/api/auth/update-gemini-key' && req.method === 'POST') {
            const currentUser = getAuthenticatedUser(req);
            if (!currentUser) {
                return sendJson(res, 401, { success: false, message: 'Unauthorized.' });
            }

            const { geminiApiKey } = await parseBody(req);
            const cleanKey = (geminiApiKey || '').trim();

            const usersFile = path.join(DB_DIR, 'users.json');
            const users = readJsonFile(usersFile, []);

            const userIndex = users.findIndex(u => u.username === currentUser);
            if (userIndex === -1) {
                return sendJson(res, 404, { success: false, message: 'User not found.' });
            }

            if (cleanKey) {
                users[userIndex].geminiApiKey = cleanKey;
            } else {
                delete users[userIndex].geminiApiKey;
            }
            writeJsonFile(usersFile, users);
            debugLog(`[GEMINI KEY UPDATE] User ${currentUser} updated their Gemini API Key`);

            return sendJson(res, 200, { success: true, message: 'Gemini API Key updated successfully.' });
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

        if (pathname === '/api/ai/generate' && req.method === 'POST') {
            const currentUser = getAuthenticatedUser(req);
            if (!currentUser) {
                return sendJson(res, 401, { success: false, message: 'Unauthorized.' });
            }

            const { prompt, mode, theme, slideCount } = await parseBody(req);
            
            // 1. Get user API Key
            const usersFile = path.join(DB_DIR, 'users.json');
            const users = readJsonFile(usersFile, []);
            const user = users.find(u => u.username === currentUser);
            
            let apiKey = (user && user.geminiApiKey) || process.env.GEMINI_API_KEY;
            
            if (!apiKey) {
                return sendJson(res, 400, { 
                    success: false, 
                    message: 'No Google Gemini API Key configured. Please enter your Gemini API Key in the settings panel.' 
                });
            }

            const cleanPrompt = (prompt || '').trim();
            if (!cleanPrompt) {
                return sendJson(res, 400, { success: false, message: 'Prompt is required.' });
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
                return sendJson(res, 200, parsedData);
            } catch (err) {
                console.error('[AI Generation Error]:', err);
                return sendJson(res, 500, { success: false, message: `AI generation failed: ${err.message}` });
            }
        }

        if (pathname === '/api/ai/refine-layout' && req.method === 'POST') {
            try {
                const currentUser = getAuthenticatedUser(req);
                if (!currentUser) {
                    return sendJson(res, 401, { success: false, message: 'Unauthorized. Please log in first.' });
                }

                const body = await parseBody(req);
                const { elements, prompt } = body;

                if (!elements || !Array.isArray(elements) || elements.length === 0) {
                    return sendJson(res, 400, { success: false, message: 'No elements selected for refinement.' });
                }

                const usersFile = path.join(DB_DIR, 'users.json');
                const users = readJsonFile(usersFile, []);
                const user = users.find(u => u.username === currentUser);
                
                let apiKey = (user && user.geminiApiKey) || process.env.GEMINI_API_KEY;
                
                if (!apiKey) {
                    return sendJson(res, 400, { 
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
                return sendJson(res, 200, parsedData);
            } catch (err) {
                console.error('[AI Refinement Error]:', err);
                return sendJson(res, 500, { success: false, message: `AI refinement failed: ${err.message}` });
            }
        }

        if (pathname === '/api/ai/generate-asset' && req.method === 'POST') {
            try {
                const currentUser = getAuthenticatedUser(req);
                if (!currentUser) {
                    return sendJson(res, 401, { success: false, message: 'Unauthorized. Please log in first.' });
                }

                const body = await parseBody(req);
                const { prompt } = body;

                const cleanPrompt = (prompt || '').trim();
                if (!cleanPrompt) {
                    return sendJson(res, 400, { success: false, message: 'Prompt is required.' });
                }

                const cleanEncodedPrompt = encodeURIComponent(cleanPrompt);
                const seed = Math.floor(Math.random() * 1000000);
                const pollinationsUrl = `https://image.pollinations.ai/prompt/${cleanEncodedPrompt}?width=1024&height=1024&nologo=true&private=true&seed=${seed}`;

                const response = await fetch(pollinationsUrl);
                if (!response.ok) {
                    throw new Error(`Image generation source error: ${response.statusText}`);
                }

                const buffer = await response.arrayBuffer();

                const uploadsDir = path.join(__dirname, 'uploads');
                if (!fs.existsSync(uploadsDir)) {
                    fs.mkdirSync(uploadsDir);
                }

                const uniqueFilename = `ai-asset-${Date.now()}.png`;
                const destPath = path.join(uploadsDir, uniqueFilename);
                
                await fs.promises.writeFile(destPath, Buffer.from(buffer));

                const host = req.headers.host || 'localhost:3000';
                const protocol = req.socket.encrypted ? 'https' : 'http';
                const absoluteUrl = `${protocol}://${host}/uploads/${uniqueFilename}`;

                return sendJson(res, 200, { success: true, url: absoluteUrl });
            } catch (err) {
                console.error('[AI Asset Generation Error]:', err);
                return sendJson(res, 500, { success: false, message: `AI asset generation failed: ${err.message}` });
            }
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

        res.writeHead(200, { 
            'Content-Type': contentType,
            'Access-Control-Allow-Origin': '*'
        });
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
