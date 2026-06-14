/**
 * SlideEngine Zero-Dependency Local Server
 * Serves frontend static files and implements API endpoints for authentication and project management.
 * Persists data in a local 'db_data' directory.
 * Run with: node server.js
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const url = require('url');

const PORT = 3000;
const DB_DIR = path.join(__dirname, 'db_data');
const PROJECTS_DIR = path.join(DB_DIR, 'projects');

// Ensure database directories exist
if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR);
}
if (!fs.existsSync(PROJECTS_DIR)) {
    fs.mkdirSync(PROJECTS_DIR);
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
    '.ico': 'image/x-icon'
};

const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    // 1. CORS Headers for API requests
    if (pathname.startsWith('/api/')) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        
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
            const { username, password } = await parseBody(req);
            const cleanUser = (username || '').trim().toLowerCase();
            const cleanPass = password || '';

            if (!cleanUser || cleanPass.length < 6) {
                return sendJson(res, 400, { success: false, message: 'Invalid username or password (min 6 chars).' });
            }

            const usersFile = path.join(DB_DIR, 'users.json');
            const users = readJsonFile(usersFile, []);

            if (users.some(u => u.username === cleanUser)) {
                return sendJson(res, 400, { success: false, message: 'Username already exists.' });
            }

            const salt = crypto.randomBytes(16).toString('hex');
            const hashedPassword = crypto.pbkdf2Sync(cleanPass, salt, 1000, 64, 'sha256').toString('hex');

            users.push({ username: cleanUser, salt, hashedPassword });
            writeJsonFile(usersFile, users);

            const token = crypto.randomBytes(32).toString('hex');
            activeSessions.set(token, cleanUser);

            return sendJson(res, 201, { success: true, token, username: cleanUser });
        }

        if (pathname === '/api/auth/login' && req.method === 'POST') {
            const { username, password } = await parseBody(req);
            const cleanUser = (username || '').trim().toLowerCase();
            const cleanPass = password || '';

            const usersFile = path.join(DB_DIR, 'users.json');
            const users = readJsonFile(usersFile, []);

            const user = users.find(u => u.username === cleanUser);
            if (!user) {
                return sendJson(res, 401, { success: false, message: 'Invalid username or password.' });
            }

            const hashedPassword = crypto.pbkdf2Sync(cleanPass, user.salt, 1000, 64, 'sha256').toString('hex');
            if (hashedPassword !== user.hashedPassword) {
                return sendJson(res, 401, { success: false, message: 'Invalid username or password.' });
            }

            const token = crypto.randomBytes(32).toString('hex');
            activeSessions.set(token, cleanUser);

            return sendJson(res, 200, { success: true, token, username: cleanUser });
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

            return sendJson(res, 200, { success: true });
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
});
