/**
 * SlideEngine State Management
 * Handles project structures, slides, elements, file import/export, and persistence.
 */

// Helper to generate unique IDs
function generateUUID() {
    return 'id-' + Math.random().toString(36).substring(2, 11);
}

// Migration helper to ensure backward compatibility for elements
function migrateProject(project) {
    if (!project || !project.slides) return;
    project.slides.forEach(slide => {
        if (!slide.elements) return;
        slide.elements.forEach(elem => {
            if (elem.type === 'video') {
                if (elem.url && elem.url.includes('https://pixijs.com/assethttp')) {
                    const match = elem.url.match(/https:\/\/pixijs\.com\/asset(https?:\/\/[^\s]+)s\/video\.mp4/);
                    if (match && match[1]) {
                        elem.url = match[1];
                    } else {
                        const lastHttpIdx = elem.url.lastIndexOf('http');
                        if (lastHttpIdx > 0) {
                            let cleanUrl = elem.url.substring(lastHttpIdx);
                            cleanUrl = cleanUrl.replace(/s\/video\.mp4$/, '');
                            elem.url = cleanUrl;
                        }
                    }
                }
            }
            if (elem.type && elem.type.startsWith('btn-')) {
                if (elem.useMarkupColor === undefined) {
                    elem.useMarkupColor = false;
                }
                if (elem.markupColor === undefined) {
                    elem.markupColor = '#3b82f6';
                }
            }
            if (elem.type === 'timer') {
                if (!elem.actions) {
                    elem.actions = [];
                    if (elem.action && elem.action !== 'none') {
                        elem.actions.push({
                            id: 'act-' + Math.random().toString(36).substring(2, 11),
                            type: elem.action,
                            targetId: elem.targetElementId || ''
                        });
                    }
                }
            }
            if (elem.type === 'btn-toggle') {
                if (!elem.actions) {
                    elem.actions = [];
                    if (elem.action) {
                        elem.actions.push({
                            id: 'act-' + Math.random().toString(36).substring(2, 11),
                            type: elem.action,
                            targetId: elem.targetElementId || ''
                        });
                    }
                }
            }
            // Border attributes migration
            if (elem.type === 'text' || elem.type === 'timer' || (elem.type && elem.type.startsWith('btn-'))) {
                if (elem.borderWidth === undefined) elem.borderWidth = 0;
                if (elem.borderStyle === undefined) elem.borderStyle = 'none';
                if (elem.borderColor === undefined) elem.borderColor = '#ffffff';
            }
        });
    });
}

// Default Element Templates
const ElementTemplates = {
    text: (slideId) => ({
        id: generateUUID(),
        type: 'text',
        text: 'Double click to edit text',
        x: 100,
        y: 100,
        width: 400,
        height: 100,
        fontFamily: 'Outfit',
        fontSize: 28,
        align: 'left',
        textColor: '#ffffff',
        bgColor: '#16161a',
        bgAlpha: 0,
        borderRadius: 0,
        borderWidth: 0,
        borderStyle: 'none',
        borderColor: '#ffffff',
        rpgStyle: false,
        visible: true,
        zIndex: 0
    }),
    image: (slideId) => ({
        id: generateUUID(),
        type: 'image',
        url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop',
        fileData: null, // Base64 data if uploaded locally
        x: 200,
        y: 150,
        width: 300,
        height: 200,
        visible: true,
        zIndex: 0
    }),
    timer: (slideId) => ({
        id: generateUUID(),
        type: 'timer',
        text: '30', // Display value
        x: 430,
        y: 50,
        width: 100,
        height: 80,
        duration: 30,
        actions: [], // Dynamic timeout actions: { id, type, targetId }
        fontFamily: 'Outfit',
        fontSize: 36,
        align: 'center',
        textColor: '#f1c40f',
        bgColor: '#16161a',
        bgAlpha: 0.8,
        borderRadius: 50,
        borderWidth: 0,
        borderStyle: 'none',
        borderColor: '#ffffff',
        rpgStyle: false,
        visible: true,
        zIndex: 0
    }),
    'btn-nav': (slideId) => ({
        id: generateUUID(),
        type: 'btn-nav',
        text: 'Go to Next Slide',
        targetSlideId: '', // Set in inspector
        x: 380,
        y: 400,
        width: 200,
        height: 50,
        fontFamily: 'Outfit',
        fontSize: 18,
        align: 'center',
        textColor: '#0a0a0c',
        bgColor: '#f1c40f',
        bgAlpha: 1,
        borderRadius: 8,
        borderWidth: 0,
        borderStyle: 'none',
        borderColor: '#ffffff',
        rpgStyle: false,
        visible: true,
        useMarkupColor: false,
        markupColor: '#3b82f6',
        zIndex: 0
    }),
    'btn-option': (slideId) => ({
        id: generateUUID(),
        type: 'btn-option',
        text: 'Option Answer',
        isCorrect: false,
        group: 'Q1',
        x: 100,
        y: 300,
        width: 350,
        height: 60,
        fontFamily: 'Outfit',
        fontSize: 18,
        align: 'center',
        textColor: '#ffffff',
        bgColor: '#16161a',
        bgAlpha: 1,
        borderRadius: 8,
        borderWidth: 0,
        borderStyle: 'none',
        borderColor: '#ffffff',
        rpgStyle: false,
        visible: true,
        useMarkupColor: false,
        markupColor: '#3b82f6',
        zIndex: 0
    }),
    'btn-show-ans': (slideId) => ({
        id: generateUUID(),
        type: 'btn-show-ans',
        text: 'Reveal Answer',
        targetElementId: '', // Select from other elements
        x: 380,
        y: 470,
        width: 200,
        height: 50,
        fontFamily: 'Outfit',
        fontSize: 18,
        align: 'center',
        textColor: '#ffffff',
        bgColor: '#b8923a',
        bgAlpha: 1,
        borderRadius: 8,
        borderWidth: 0,
        borderStyle: 'none',
        borderColor: '#ffffff',
        rpgStyle: false,
        visible: true,
        useMarkupColor: false,
        markupColor: '#3b82f6',
        zIndex: 0
    }),
    'btn-toggle': (slideId) => ({
        id: generateUUID(),
        type: 'btn-toggle',
        text: 'Action Button',
        actions: [], // Dynamic click actions: { id, type, targetId }
        x: 100,
        y: 400,
        width: 220,
        height: 50,
        fontFamily: 'Outfit',
        fontSize: 16,
        align: 'center',
        textColor: '#ffffff',
        bgColor: '#16161a',
        bgAlpha: 1,
        borderRadius: 8,
        borderWidth: 0,
        borderStyle: 'none',
        borderColor: '#ffffff',
        rpgStyle: false,
        visible: true,
        useMarkupColor: false,
        markupColor: '#3b82f6',
        zIndex: 0
    }),
    video: (slideId) => ({
        id: generateUUID(),
        type: 'video',
        url: 'https://pixijs.com/assets/video.mp4',
        autoplay: true,
        loop: true,
        muted: true,
        volume: 1.0,
        x: 200,
        y: 150,
        width: 400,
        height: 225,
        visible: true,
        zIndex: 0
    })
};

/// Application State
window.EngineState = {
    // Current Project Object (null if on landing/dashboard)
    project: null,
    
    // Active Navigation
    selectedSlideId: null,
    selectedElementId: null,
    selectedElementIds: [],
    
    clipboard: [],
    clipboardSourceSlideId: null,
    
    hasUnsavedChanges: false,
    
    undoStack: [],
    redoStack: [],
    
    // Auth & Navigation State
    currentUser: null,
    currentView: 'landing',
    projectsList: [],
    users: [],
    
    // Event listeners
    listeners: {
        'slide-changed': [],
        'slide-list-changed': [],
        'selection-changed': [],
        'project-loaded': [],
        'element-updated': [],
        'clipboard-changed': [],
        'view-changed': [],
        'projects-list-changed': [],
        'auth-changed': []
    },

    // Subscribe to state changes
    on(event, callback) {
        if (this.listeners[event]) {
            this.listeners[event].push(callback);
        }
    },

    // Emit state events
    emit(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(cb => cb(data));
        }
    },

    pushHistory() {
        if (!this.project) return;
        this.undoStack.push(JSON.stringify(this.project));
        this.redoStack = []; // Clear redo stack on new action
        if (this.undoStack.length > 50) {
            this.undoStack.shift();
        }
        this.updateUndoRedoUI();
    },

    undo() {
        if (!this.project || this.undoStack.length === 0) return;
        
        // Push current state to redo
        this.redoStack.push(JSON.stringify(this.project));
        
        // Restore last state
        const restoredState = JSON.parse(this.undoStack.pop());
        this.project = restoredState;
        
        // Adjust selection IDs if they no longer exist in the restored state
        if (this.project.slides.length > 0) {
            const slideExists = this.project.slides.some(s => s.id === this.selectedSlideId);
            if (!slideExists) {
                this.selectedSlideId = this.project.slides[0].id;
                this.selectedElementId = null;
            } else {
                const activeSlide = this.getActiveSlide();
                const elemExists = activeSlide.elements.some(e => e.id === this.selectedElementId);
                if (!elemExists) this.selectedElementId = null;
            }
        } else {
            this.selectedSlideId = null;
            this.selectedElementId = null;
        }

        this.markUnsaved();
        this.emit('project-loaded', this.project);
        this.emit('slide-list-changed', this.project.slides);
        this.emit('slide-changed', this.getActiveSlide());
        this.emit('selection-changed', this.getActiveElement());
        this.updateUndoRedoUI();
    },

    redo() {
        if (!this.project || this.redoStack.length === 0) return;

        // Push current state to undo
        this.undoStack.push(JSON.stringify(this.project));

        // Restore state
        const restoredState = JSON.parse(this.redoStack.pop());
        this.project = restoredState;

        if (this.project.slides.length > 0) {
            const slideExists = this.project.slides.some(s => s.id === this.selectedSlideId);
            if (!slideExists) {
                this.selectedSlideId = this.project.slides[0].id;
                this.selectedElementId = null;
            } else {
                const activeSlide = this.getActiveSlide();
                const elemExists = activeSlide.elements.some(e => e.id === this.selectedElementId);
                if (!elemExists) this.selectedElementId = null;
            }
        } else {
            this.selectedSlideId = null;
            this.selectedElementId = null;
        }

        this.markUnsaved();
        this.emit('project-loaded', this.project);
        this.emit('slide-list-changed', this.project.slides);
        this.emit('slide-changed', this.getActiveSlide());
        this.emit('selection-changed', this.getActiveElement());
        this.updateUndoRedoUI();
    },

    updateUndoRedoUI() {
        const undoBtn = document.getElementById('btn-undo');
        const redoBtn = document.getElementById('btn-redo');
        if (undoBtn) {
            undoBtn.disabled = this.undoStack.length === 0;
        }
        if (redoBtn) {
            redoBtn.disabled = this.redoStack.length === 0;
        }
    },

    // Session & User management
    loadUsers() {
        const saved = localStorage.getItem('slide_engine_users');
        this.users = saved ? JSON.parse(saved) : [];
    },

    saveUsers() {
        localStorage.setItem('slide_engine_users', JSON.stringify(this.users));
    },

    loadActiveSession() {
        this.currentUser = localStorage.getItem('slide_engine_active_user') || null;
    },

    loadProjectsList() {
        const saved = localStorage.getItem('slide_engine_projects_list');
        this.projectsList = saved ? JSON.parse(saved) : [];
    },

    saveProjectsList() {
        localStorage.setItem('slide_engine_projects_list', JSON.stringify(this.projectsList));
        this.emit('projects-list-changed', this.getProjectsForCurrentUser());
    },

    getProjectsForCurrentUser() {
        const user = this.currentUser || 'guest';
        return this.projectsList.filter(p => p.userId === user);
    },

    setView(view) {
        this.currentView = view;
        this.emit('view-changed', view);
    },

    async signup(username, password) {
        username = username.trim();
        password = password.trim();
        if (!username || !password) {
            return { success: false, message: "Username and password are required." };
        }
        if (username.length < 3) {
            return { success: false, message: "Username must be at least 3 characters." };
        }
        if (password.length < 6) {
            return { success: false, message: "Password must be at least 6 characters." };
        }

        if (window.SlideEngineAPI) {
            try {
                const res = await window.SlideEngineAPI.signup(username, password);
                if (res.success) {
                    this.currentUser = username;
                    localStorage.setItem('slide_engine_active_user', username);
                    this.emit('auth-changed', username);
                    
                    this.project = null;
                    this.selectedSlideId = null;
                    this.selectedElementId = null;
                    this.selectedElementIds = [];
                    this.undoStack = [];
                    this.redoStack = [];
                    this.updateUndoRedoUI();

                    try {
                        const cloudProjects = await window.SlideEngineAPI.getProjects();
                        this.projectsList = this.projectsList.filter(p => p.userId !== username);
                        this.projectsList.push(...cloudProjects);
                        this.saveProjectsList();
                    } catch (e) {
                        console.warn("Could not load projects list on signup sync", e);
                    }

                    this.setView('dashboard');
                    this.emit('projects-list-changed', this.getProjectsForCurrentUser());
                    return { success: true };
                }
            } catch (e) {
                console.warn("API signup failed, falling back to LocalStorage:", e);
            }
        }

        this.loadUsers();
        if (this.users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
            return { success: false, message: "Username already exists." };
        }
        this.users.push({ username, password });
        this.saveUsers();
        
        return await this.login(username, password);
    },

    async login(username, password) {
        username = username.trim();
        password = password.trim();

        if (window.SlideEngineAPI && !(username.toLowerCase() === 'guest' && password === 'guest')) {
            try {
                const res = await window.SlideEngineAPI.login(username, password);
                if (res.success) {
                    this.currentUser = username;
                    localStorage.setItem('slide_engine_active_user', username);
                    this.emit('auth-changed', username);
                    
                    this.project = null;
                    this.selectedSlideId = null;
                    this.selectedElementId = null;
                    this.selectedElementIds = [];
                    this.undoStack = [];
                    this.redoStack = [];
                    this.updateUndoRedoUI();

                    try {
                        const cloudProjects = await window.SlideEngineAPI.getProjects();
                        this.projectsList = this.projectsList.filter(p => p.userId !== username);
                        this.projectsList.push(...cloudProjects);
                        this.saveProjectsList();
                    } catch (e) {
                        console.warn("Could not sync projects list from cloud on login", e);
                    }

                    this.setView('dashboard');
                    this.emit('projects-list-changed', this.getProjectsForCurrentUser());
                    return { success: true };
                }
            } catch (e) {
                console.warn("API login failed, checking LocalStorage fallback:", e);
            }
        }

        this.loadUsers();
        const user = this.users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.password === password);
        
        if (!user && !(username.toLowerCase() === 'guest' && password === 'guest')) {
            return { success: false, message: "Invalid username or password." };
        }

        this.currentUser = username;
        localStorage.setItem('slide_engine_active_user', username);
        this.emit('auth-changed', username);
        
        this.project = null;
        this.selectedSlideId = null;
        this.selectedElementId = null;
        this.selectedElementIds = [];
        this.undoStack = [];
        this.redoStack = [];
        this.updateUndoRedoUI();

        if (window.SlideEngineAPI) {
            window.SlideEngineAPI.logout();
        }

        this.setView('dashboard');
        this.emit('projects-list-changed', this.getProjectsForCurrentUser());
        return { success: true };
    },

    logout() {
        this.currentUser = null;
        localStorage.removeItem('slide_engine_active_user');
        
        if (window.SlideEngineAPI) {
            window.SlideEngineAPI.logout();
        }

        this.emit('auth-changed', null);
        
        this.project = null;
        this.selectedSlideId = null;
        this.selectedElementId = null;
        this.selectedElementIds = [];
        this.undoStack = [];
        this.redoStack = [];
        this.updateUndoRedoUI();

        this.setView('landing');
    },

    // Initialize state
    async init() {
        this.loadUsers();
        this.loadActiveSession();
        this.loadProjectsList();
        
        // Legacy single-project migration check:
        const legacyProject = localStorage.getItem('slide_engine_project');
        if (legacyProject) {
            try {
                const parsed = JSON.parse(legacyProject);
                migrateProject(parsed);
                const owner = this.currentUser || 'guest';
                const meta = {
                    id: parsed.id || generateUUID(),
                    name: parsed.name || 'Migrated Presentation',
                    slideCount: parsed.slides ? parsed.slides.length : 0,
                    userId: owner,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                parsed.id = meta.id;
                
                // Save migrated format
                localStorage.setItem(`slide_engine_project_${meta.id}`, JSON.stringify(parsed));
                
                this.projectsList.push(meta);
                this.saveProjectsList();
                
                // Clean up single legacy item
                localStorage.removeItem('slide_engine_project');
            } catch (e) {
                console.error("Failed to migrate legacy project", e);
            }
        }

        // Sync metadata list with API on init if logged in
        if (window.SlideEngineAPI && window.SlideEngineAPI.token && this.currentUser && this.currentUser !== 'guest') {
            try {
                const cloudProjects = await window.SlideEngineAPI.getProjects();
                this.projectsList = this.projectsList.filter(p => p.userId !== this.currentUser);
                this.projectsList.push(...cloudProjects);
                this.saveProjectsList();
            } catch (e) {
                console.warn("Could not sync projects on init", e);
            }
        }

        // Initialize display view
        if (this.currentUser) {
            this.setView('dashboard');
            this.emit('projects-list-changed', this.getProjectsForCurrentUser());
            this.emit('auth-changed', this.currentUser);
        } else {
            this.setView('landing');
        }
    },

    // Project Operations
    createProject(name = 'New Presentation') {
        this.project = {
            id: generateUUID(),
            name: name,
            slides: []
        };
        
        // Add a default welcome slide
        const firstSlide = this.addSlide('Welcome Slide');
        
        // Add welcome text
        const titleText = this.addElement('text');
        titleText.text = "Welcome to SlideEngine";
        titleText.x = 960 / 2 - 350;
        titleText.y = 100;
        titleText.width = 700;
        titleText.height = 80;
        titleText.fontSize = 42;
        titleText.align = 'center';
        
        const subtitleText = this.addElement('text');
        subtitleText.text = "A flexible WebGL slide workspace. Create presentation slides, interactive branching quizzes, and RPG dialog cards.";
        subtitleText.x = 960 / 2 - 300;
        subtitleText.y = 220;
        subtitleText.width = 600;
        subtitleText.height = 120;
        subtitleText.fontSize = 20;
        subtitleText.align = 'center';
        subtitleText.textColor = '#9ca3af';

        const startBtn = this.addElement('btn-nav');
        startBtn.text = "Start Presentation";
        startBtn.x = 960 / 2 - 100;
        startBtn.y = 400;
        
        this.selectedSlideId = firstSlide.id;
        this.selectedElementId = null;
        this.selectedElementIds = [];
        this.undoStack = [];
        this.redoStack = [];
        this.updateUndoRedoUI();

        // Save immediately
        this.saveToLocalStorage();
        
        this.emit('project-loaded', this.project);
        this.emit('slide-list-changed', this.project.slides);
        this.emit('slide-changed', this.getActiveSlide());
        
        this.setView('editor');
        return this.project;
    },

    async loadProject(id) {
        let saved = null;

        // Attempt cloud load first
        if (window.SlideEngineAPI && this.currentUser && this.currentUser !== 'guest' && window.SlideEngineAPI.token) {
            const statusEl = document.getElementById('save-status');
            if (statusEl) {
                statusEl.innerHTML = '<i data-lucide="refresh-cw" class="animate-spin" style="animation: spin 1s linear infinite;"></i> Loading...';
                if (window.lucide) lucide.createIcons();
            }
            try {
                const cloudProj = await window.SlideEngineAPI.getProject(id);
                if (cloudProj && cloudProj.project) {
                    saved = JSON.stringify(cloudProj.project);
                    // Cache locally
                    localStorage.setItem(`slide_engine_project_${id}`, saved);
                }
            } catch (e) {
                console.warn("Could not load project from cloud, trying local cache", e);
            }
        }

        if (!saved) {
            saved = localStorage.getItem(`slide_engine_project_${id}`);
        }

        if (!saved) {
            alert("Error: Project not found.");
            return false;
        }
        try {
            this.project = JSON.parse(saved);
            migrateProject(this.project);
            
            if (this.project.slides && this.project.slides.length > 0) {
                this.selectedSlideId = this.project.slides[0].id;
            } else {
                this.addSlide('Welcome Slide');
            }
            
            this.selectedElementId = null;
            this.selectedElementIds = [];
            this.undoStack = [];
            this.redoStack = [];
            this.updateUndoRedoUI();
            this.hasUnsavedChanges = false;
            
            this.emit('project-loaded', this.project);
            this.emit('slide-list-changed', this.project.slides);
            this.emit('slide-changed', this.getActiveSlide());
            
            this.setView('editor');

            const statusEl = document.getElementById('save-status');
            if (statusEl) {
                if (window.SlideEngineAPI && this.currentUser && this.currentUser !== 'guest' && window.SlideEngineAPI.token) {
                    statusEl.innerHTML = '<i data-lucide="cloud-check"></i> Cloud Synced';
                } else {
                    statusEl.innerHTML = '<i data-lucide="cloud-check"></i> Saved';
                }
                statusEl.classList.remove('unsaved');
                if (window.lucide) lucide.createIcons();
            }

            return true;
        } catch (e) {
            console.error("Failed to load project", e);
            alert("Error loading project: " + e.message);
            return false;
        }
    },

    async deleteProject(id) {
        if (window.SlideEngineAPI && this.currentUser && this.currentUser !== 'guest' && window.SlideEngineAPI.token) {
            try {
                await window.SlideEngineAPI.deleteProject(id);
            } catch (e) {
                console.warn("Failed to delete project on cloud, deleting locally", e);
            }
        }

        localStorage.removeItem(`slide_engine_project_${id}`);
        
        this.loadProjectsList();
        this.projectsList = this.projectsList.filter(p => p.id !== id);
        this.saveProjectsList();
        
        if (this.project && this.project.id === id) {
            this.project = null;
            this.setView('dashboard');
        }
    },

    async duplicateProject(id) {
        let saved = null;

        if (window.SlideEngineAPI && this.currentUser && this.currentUser !== 'guest' && window.SlideEngineAPI.token) {
            try {
                const cloudProj = await window.SlideEngineAPI.getProject(id);
                if (cloudProj && cloudProj.project) {
                    saved = JSON.stringify(cloudProj.project);
                }
            } catch (e) {
                console.warn("Failed to load project from cloud for duplication, using local storage", e);
            }
        }

        if (!saved) {
            saved = localStorage.getItem(`slide_engine_project_${id}`);
        }

        if (!saved) return;
        try {
            const parsed = JSON.parse(saved);
            
            const newProj = JSON.parse(JSON.stringify(parsed));
            newProj.id = generateUUID();
            newProj.name = `${parsed.name} (Copy)`;
            
            // Reassign IDs to prevent duplication conflicts
            newProj.slides.forEach(slide => {
                const oldSlideId = slide.id;
                slide.id = generateUUID();
                
                const elemMapping = {};
                slide.elements.forEach(elem => {
                    const oldElemId = elem.id;
                    elem.id = generateUUID();
                    elemMapping[oldElemId] = elem.id;
                });
                
                slide.elements.forEach(elem => {
                    if (elem.targetElementId && elemMapping[elem.targetElementId]) {
                        elem.targetElementId = elemMapping[elem.targetElementId];
                    }
                });
            });
            
            localStorage.setItem(`slide_engine_project_${newProj.id}`, JSON.stringify(newProj));
            
            const user = this.currentUser || 'guest';
            const meta = {
                id: newProj.id,
                name: newProj.name,
                slideCount: newProj.slides.length,
                userId: user,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            this.loadProjectsList();
            this.projectsList.push(meta);
            this.saveProjectsList();

            // Sync background to cloud
            this.syncProjectToCloud(newProj, meta);
        } catch (e) {
            console.error("Failed to duplicate project", e);
        }
    },

    // Persistence
    saveToLocalStorage() {
        if (!this.project) return;
        
        localStorage.setItem(`slide_engine_project_${this.project.id}`, JSON.stringify(this.project));
        
        const user = this.currentUser || 'guest';
        this.loadProjectsList();
        
        let meta = this.projectsList.find(p => p.id === this.project.id);
        if (!meta) {
            meta = {
                id: this.project.id,
                name: this.project.name,
                slideCount: this.project.slides.length,
                userId: user,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            this.projectsList.push(meta);
        } else {
            meta.name = this.project.name;
            meta.slideCount = this.project.slides.length;
            meta.updatedAt = new Date().toISOString();
        }
        
        this.saveProjectsList();
        this.hasUnsavedChanges = false;
        
        // Trigger background sync
        this.syncProjectToCloud(this.project, meta);
    },

    async syncProjectToCloud(project, meta) {
        const statusEl = document.getElementById('save-status');

        if (!this.currentUser || this.currentUser === 'guest' || !window.SlideEngineAPI || !window.SlideEngineAPI.token) {
            if (statusEl) {
                statusEl.innerHTML = '<i data-lucide="cloud-check"></i> Saved';
                statusEl.classList.remove('unsaved');
                if (window.lucide) lucide.createIcons();
            }
            return;
        }

        if (statusEl) {
            statusEl.innerHTML = '<i data-lucide="refresh-cw" class="animate-spin" style="animation: spin 1s linear infinite;"></i> Syncing...';
            statusEl.classList.remove('unsaved');
            if (window.lucide) lucide.createIcons();
        }

        try {
            await window.SlideEngineAPI.saveProject(project.id, project, meta);
            if (statusEl) {
                statusEl.innerHTML = '<i data-lucide="cloud-check"></i> Cloud Synced';
                statusEl.classList.remove('unsaved');
                if (window.lucide) lucide.createIcons();
            }
        } catch (e) {
            console.warn("Could not sync project changes to cloud, saved locally", e);
            if (statusEl) {
                statusEl.innerHTML = '<i data-lucide="wifi-off"></i> Saved locally';
                statusEl.classList.remove('unsaved');
                if (window.lucide) lucide.createIcons();
            }
        }
    },

    markUnsaved() {
        if (!this.project) return;
        this.hasUnsavedChanges = true;
        const statusEl = document.getElementById('save-status');
        if (statusEl) {
            statusEl.innerHTML = '<i data-lucide="alert-circle"></i> Unsaved changes';
            statusEl.classList.add('unsaved');
            if (window.lucide) lucide.createIcons();
        }
    },

    exportToJSON() {
        if (!this.project) return;
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.project, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", `${this.project.name.toLowerCase().replace(/\s+/g, '_')}_project.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
    },

    importFromJSON(jsonText) {
        try {
            const parsed = JSON.parse(jsonText);
            if (!parsed.slides || !Array.isArray(parsed.slides)) {
                throw new Error("Invalid project JSON: 'slides' array is missing.");
            }
            
            parsed.id = generateUUID();
            parsed.name = parsed.name || "Imported Project";
            migrateProject(parsed);
            
            this.project = parsed;
            this.selectedSlideId = parsed.slides.length > 0 ? parsed.slides[0].id : null;
            this.selectedElementId = null;
            this.selectedElementIds = [];
            this.undoStack = [];
            this.redoStack = [];
            this.updateUndoRedoUI();
            this.hasUnsavedChanges = false;
            
            this.saveToLocalStorage();
            
            this.emit('project-loaded', this.project);
            this.emit('slide-list-changed', this.project.slides);
            this.emit('slide-changed', this.getActiveSlide());
            this.setView('editor');
            return true;
        } catch (e) {
            alert("Error importing project: " + e.message);
            return false;
        }
    },

    clearProject() {
        if (!this.project) return;
        if (confirm("Are you sure you want to clear the entire project? This cannot be undone.")) {
            this.pushHistory();
            this.project.slides = [];
            const welcomeSlide = this.addSlide('Welcome Slide');
            
            const welcomeText = this.addElement('text');
            welcomeText.text = "Welcome to SlideEngine";
            welcomeText.x = 960 / 2 - 350;
            welcomeText.y = 100;
            welcomeText.width = 700;
            welcomeText.height = 80;
            welcomeText.fontSize = 42;
            welcomeText.align = 'center';
            
            this.selectedSlideId = welcomeSlide.id;
            this.markUnsaved();
            this.emit('project-loaded', this.project);
            this.emit('slide-list-changed', this.project.slides);
            this.emit('slide-changed', this.getActiveSlide());
        }
    },

    // Slide operations
    getActiveSlide() {
        if (!this.project || !this.project.slides) return null;
        return this.project.slides.find(s => s.id === this.selectedSlideId) || null;
    },

    selectSlide(slideId) {
        if (this.selectedSlideId === slideId) return;
        this.selectedSlideId = slideId;
        this.selectedElementId = null; // Clear selection
        this.selectedElementIds = []; // Clear group selection
        this.emit('slide-changed', this.getActiveSlide());
        this.emit('selection-changed', null);
    },

    addSlide(name = null) {
        this.pushHistory();
        const slideIndex = this.project.slides.length + 1;
        const newSlide = {
            id: generateUUID(),
            name: name || `Slide ${slideIndex}`,
            rpgTheme: false,
            transition: 'none',
            background: {
                type: 'color', // 'color', 'gradient', 'image'
                color: '#050507',
                gradientStart: '#050507',
                gradientEnd: '#16161a',
                gradientAngle: 135,
                imageUrl: ''
            },
            elements: []
        };
        this.project.slides.push(newSlide);
        this.selectedSlideId = newSlide.id;
        this.selectedElementId = null;
        this.selectedElementIds = [];

        this.markUnsaved();
        this.emit('slide-list-changed', this.project.slides);
        this.emit('slide-changed', newSlide);
        return newSlide;
    },

    duplicateSlide(slideId) {
        this.pushHistory();
        const slideIndex = this.project.slides.findIndex(s => s.id === slideId);
        if (slideIndex === -1) return;

        const slideToDuplicate = this.project.slides[slideIndex];
        
        // Deep copy slide, giving new IDs to slide and elements
        const newSlide = JSON.parse(JSON.stringify(slideToDuplicate));
        newSlide.id = generateUUID();
        newSlide.name = `${slideToDuplicate.name} (Copy)`;
        
        // Re-generate element IDs to avoid duplicate key conflicts
        const idMapping = {};
        newSlide.elements.forEach(elem => {
            const oldId = elem.id;
            const newId = generateUUID();
            elem.id = newId;
            idMapping[oldId] = newId;
        });

        // Resolve relative targets to their newly cloned versions if necessary
        newSlide.elements.forEach(elem => {
            if (elem.targetElementId && idMapping[elem.targetElementId]) {
                elem.targetElementId = idMapping[elem.targetElementId];
            }
        });

        this.project.slides.splice(slideIndex + 1, 0, newSlide);
        this.selectedSlideId = newSlide.id;
        this.selectedElementId = null;
        this.selectedElementIds = [];

        this.markUnsaved();
        this.emit('slide-list-changed', this.project.slides);
        this.emit('slide-changed', newSlide);
    },

    deleteSlide(slideId) {
        if (this.project.slides.length <= 1) {
            alert("Your project must contain at least one slide.");
            return;
        }
        
        this.pushHistory();
        const slideIndex = this.project.slides.findIndex(s => s.id === slideId);
        if (slideIndex === -1) return;

        this.project.slides.splice(slideIndex, 0); // Trigger delete
        this.project.slides = this.project.slides.filter(s => s.id !== slideId);

        // Update navigation pointer if deleted slide was current
        if (this.selectedSlideId === slideId) {
            const newActiveIndex = Math.min(slideIndex, this.project.slides.length - 1);
            this.selectedSlideId = this.project.slides[newActiveIndex].id;
        }
        this.selectedElementId = null;
        this.selectedElementIds = [];

        this.markUnsaved();
        this.emit('slide-list-changed', this.project.slides);
        this.emit('slide-changed', this.getActiveSlide());
    },

    moveSlide(fromIndex, toIndex) {
        if (fromIndex === toIndex || fromIndex < 0 || fromIndex >= this.project.slides.length) return;
        
        this.pushHistory();
        
        const [movedSlide] = this.project.slides.splice(fromIndex, 1);
        this.project.slides.splice(toIndex, 0, movedSlide);
        
        this.markUnsaved();
        this.emit('slide-list-changed', this.project.slides);
        this.emit('slide-changed', this.getActiveSlide());
    },

    // Element operations
    getActiveElement() {
        const slide = this.getActiveSlide();
        if (!slide) return null;
        return slide.elements.find(e => e.id === this.selectedElementId) || null;
    },

    selectElement(elementId, accumulate = false) {
        if (!this.selectedElementIds) {
            this.selectedElementIds = [];
        }

        if (elementId === null) {
            this.selectedElementIds = [];
            this.selectedElementId = null;
        } else if (accumulate) {
            const idx = this.selectedElementIds.indexOf(elementId);
            if (idx > -1) {
                this.selectedElementIds.splice(idx, 1);
            } else {
                this.selectedElementIds.push(elementId);
            }
            this.selectedElementId = this.selectedElementIds.length > 0 ? this.selectedElementIds[this.selectedElementIds.length - 1] : null;
        } else {
            this.selectedElementIds = [elementId];
            this.selectedElementId = elementId;
        }

        this.emit('selection-changed', this.getActiveElement());
    },

    selectElements(elementIds, accumulate = false) {
        if (!this.selectedElementIds) {
            this.selectedElementIds = [];
        }

        if (!elementIds || elementIds.length === 0) {
            if (!accumulate) {
                this.selectedElementIds = [];
                this.selectedElementId = null;
            }
        } else if (accumulate) {
            elementIds.forEach(id => {
                if (!this.selectedElementIds.includes(id)) {
                    this.selectedElementIds.push(id);
                }
            });
            this.selectedElementId = this.selectedElementIds.length > 0 ? this.selectedElementIds[this.selectedElementIds.length - 1] : null;
        } else {
            this.selectedElementIds = [...elementIds];
            this.selectedElementId = elementIds[elementIds.length - 1];
        }

        this.emit('selection-changed', this.getActiveElement());
    },

    addElement(type) {
        this.pushHistory();
        const slide = this.getActiveSlide();
        if (!slide) return null;

        if (!ElementTemplates[type]) {
            console.error("Unknown element type: " + type);
            return null;
        }

        const newElement = ElementTemplates[type](slide.id);
        
        // Find maximum z-index to place at the top
        const maxZ = slide.elements.reduce((max, elem) => Math.max(max, elem.zIndex || 0), -1);
        newElement.zIndex = maxZ + 1;

        slide.elements.push(newElement);
        this.selectedElementId = newElement.id;
        this.selectedElementIds = [newElement.id];
        
        this.markUnsaved();
        this.emit('slide-changed', slide);
        this.emit('selection-changed', newElement);
        return newElement;
    },

    deleteElement(elementId) {
        this.deleteElements([elementId]);
    },

    deleteElements(elementIds) {
        this.pushHistory();
        const slide = this.getActiveSlide();
        if (!slide) return;

        slide.elements = slide.elements.filter(e => !elementIds.includes(e.id));
        
        if (!this.selectedElementIds) this.selectedElementIds = [];
        this.selectedElementIds = this.selectedElementIds.filter(id => !elementIds.includes(id));
        if (elementIds.includes(this.selectedElementId)) {
            this.selectedElementId = this.selectedElementIds.length > 0 ? this.selectedElementIds[this.selectedElementIds.length - 1] : null;
        }

        this.markUnsaved();
        this.emit('slide-changed', slide);
        this.emit('selection-changed', this.getActiveElement());
    },

    updateElement(elementId, properties) {
        const slide = this.getActiveSlide();
        if (!slide) return;

        const element = slide.elements.find(e => e.id === elementId);
        if (!element) return;

        // Merge properties
        Object.assign(element, properties);

        this.markUnsaved();
        // Emit visual updates
        this.emit('element-updated', element);
    },

    updateSlideSettings(properties) {
        const slide = this.getActiveSlide();
        if (!slide) return;

        Object.assign(slide, properties);
        
        this.markUnsaved();
        this.emit('slide-changed', slide);
        // Also redraw list to capture renamed slides
        if (properties.name !== undefined) {
            this.emit('slide-list-changed', this.project.slides);
        }
    },

    // Bring elements forward / send back (z-index modifications)
    moveElementZIndex(elementId, action) {
        this.pushHistory();
        const slide = this.getActiveSlide();
        if (!slide) return;

        const element = slide.elements.find(e => e.id === elementId);
        if (!element) return;

        // Sort elements by zIndex
        const sorted = [...slide.elements].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
        const index = sorted.findIndex(e => e.id === elementId);

        if (action === 'bring-front') {
            if (index === sorted.length - 1) return; // Already at top
            // Swap with the next item
            const nextElement = sorted[index + 1];
            const tempZ = element.zIndex;
            element.zIndex = nextElement.zIndex;
            nextElement.zIndex = tempZ;
        } else if (action === 'send-back') {
            if (index === 0) return; // Already at bottom
            // Swap with the previous item
            const prevElement = sorted[index - 1];
            const tempZ = element.zIndex;
            element.zIndex = prevElement.zIndex;
            prevElement.zIndex = tempZ;
        }

        // Clean up z-indices to be continuous 0, 1, 2...
        const reSorted = [...slide.elements].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
        reSorted.forEach((elem, idx) => {
            elem.zIndex = idx;
        });

        this.markUnsaved();
        this.emit('slide-changed', slide);
    },

    copyElements() {
        const slide = this.getActiveSlide();
        if (!slide) return;

        let targetIds = this.selectedElementIds || [];
        if (targetIds.length === 0 && this.selectedElementId) {
            targetIds = [this.selectedElementId];
        }

        if (targetIds.length === 0) return;

        // Get matching elements
        const elementsToCopy = slide.elements.filter(e => targetIds.includes(e.id));
        if (elementsToCopy.length === 0) return;

        // Deep clone into clipboard
        this.clipboard = JSON.parse(JSON.stringify(elementsToCopy));
        this.clipboardSourceSlideId = this.selectedSlideId;
        this.emit('clipboard-changed', this.clipboard);
    },

    pasteElements() {
        if (!this.clipboard || this.clipboard.length === 0) return;

        const slide = this.getActiveSlide();
        if (!slide) return;

        this.pushHistory();

        // 1. Generate new IDs and create a mapping
        const idMapping = {};
        const clonedElements = this.clipboard.map(elem => {
            const newId = generateUUID();
            idMapping[elem.id] = newId;
            
            // Deep clone
            const newElem = JSON.parse(JSON.stringify(elem));
            newElem.id = newId;

            // 2. Shift position if pasting on the same slide
            if (this.selectedSlideId === this.clipboardSourceSlideId) {
                newElem.x = (newElem.x || 0) + 20;
                newElem.y = (newElem.y || 0) + 20;
                // Bound check
                newElem.x = Math.max(0, Math.min(1920 - (newElem.width || 100), newElem.x));
                newElem.y = Math.max(0, Math.min(1080 - (newElem.height || 50), newElem.y));
            }

            return newElem;
        });

        // 3. Re-resolve target IDs within the pasted group (e.g. MCQ groups / Show answer target elements)
        clonedElements.forEach(elem => {
            if (elem.targetElementId && idMapping[elem.targetElementId]) {
                elem.targetElementId = idMapping[elem.targetElementId];
            }
        });

        // 4. Assign continuous z-index at the top
        const maxZ = slide.elements.reduce((max, elem) => Math.max(max, elem.zIndex || 0), -1);
        clonedElements.forEach((elem, idx) => {
            elem.zIndex = maxZ + 1 + idx;
            slide.elements.push(elem);
        });

        // 5. Select the newly pasted elements
        const pastedIds = clonedElements.map(e => e.id);
        this.selectElements(pastedIds);

        this.markUnsaved();

        // Trigger reactive redraws
        this.emit('slide-changed', slide);
        this.emit('selection-changed', this.getActiveElement());
    }
};
