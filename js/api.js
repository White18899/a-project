/**
 * SlideEngine API Client
 * Manages communication with the local Node.js server or Cloudflare Workers backend.
 * Gracefully defaults to localhost when opened from a local file.
 */

window.SlideEngineAPI = {
    // If opened via file://, point to local server. Otherwise, use relative origin.
    baseUrl: window.location.protocol === 'file:' ? 'http://localhost:3000' : '',
    token: localStorage.getItem('slide_engine_api_token') || null,
    username: localStorage.getItem('slide_engine_api_username') || null,

    setSession(token, username) {
        this.token = token;
        this.username = username;
        if (token) {
            localStorage.setItem('slide_engine_api_token', token);
            localStorage.setItem('slide_engine_api_username', username);
        } else {
            localStorage.removeItem('slide_engine_api_token');
            localStorage.removeItem('slide_engine_api_username');
        }
    },

    async request(path, options = {}) {
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        const url = `${this.baseUrl}${path}`;
        
        try {
            const res = await fetch(url, {
                ...options,
                headers
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.message || `Request failed with status ${res.status}`);
            }

            return await res.json();
        } catch (e) {
            console.error(`API Error on ${path}:`, e);
            throw e;
        }
    },

    // Auth API
    async signup(username, password) {
        const data = await this.request('/api/auth/signup', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
        if (data.token) {
            this.setSession(data.token, username);
        }
        return data;
    },

    async login(username, password) {
        const data = await this.request('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
        if (data.token) {
            this.setSession(data.token, username);
        }
        return data;
    },

    logout() {
        this.setSession(null, null);
    },

    // Projects CRUD API
    async getProjects() {
        return await this.request('/api/projects');
    },

    async getProject(id) {
        return await this.request(`/api/projects/${id}`);
    },

    async saveProject(id, project, meta) {
        return await this.request(`/api/projects/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ project, meta })
        });
    },

    async deleteProject(id) {
        return await this.request(`/api/projects/${id}`, {
            method: 'DELETE'
        });
    }
};
