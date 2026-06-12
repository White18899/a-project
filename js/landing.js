/**
 * SlideEngine Landing & Dashboard UI Controller
 * Manages view routing, signup/login authentication logic, and the project listing dashboard.
 */

document.addEventListener("DOMContentLoaded", () => {
    const state = window.EngineState;
    const appEl = document.getElementById('app');

    // ==========================================
    // VIEW ROUTING
    // ==========================================
    state.on('view-changed', (view) => {
        // Toggle view class on body wrapper
        appEl.className = `view-${view}`;

        // Trigger WebGL canvas play/pause state
        if (window.landingWebGL) {
            if (view === 'landing' || view === 'dashboard') {
                window.landingWebGL.play();
            } else {
                window.landingWebGL.pause();
            }
        }

        // Auto focus searches when entering dashboard
        if (view === 'dashboard') {
            document.getElementById('project-search-input').value = '';
            renderProjectsGrid(state.getProjectsForCurrentUser());
            
            // Re-trigger Lucide icons to draw dashboard specific icons
            if (window.lucide) lucide.createIcons();
        }

        // Ensure editor canvas is resized and drawn correctly when switching to editor view
        if (view === 'editor') {
            if (window.editorCanvas) {
                // Measure the newly visible container and resize canvas
                window.editorCanvas.resize();
                
                // Draw slide contents onto the resized canvas
                const activeSlide = state.getActiveSlide();
                if (activeSlide) {
                    window.editorCanvas.renderSlide(activeSlide);
                }
            }
        }
    });

    // ==========================================
    // AUTHENTICATION MODAL & FORM LOGIC
    // ==========================================
    const authModal = document.getElementById('auth-modal');
    const authForm = document.getElementById('auth-form');
    const authTitle = document.getElementById('auth-modal-title');
    const authSubmitBtn = document.getElementById('btn-auth-submit');
    const signupConfirmGroup = document.getElementById('signup-confirm-group');
    const authErrorBanner = document.getElementById('auth-error-banner');
    const authErrorMsg = document.getElementById('auth-error-message');

    const loginTab = document.getElementById('tab-auth-login');
    const signupTab = document.getElementById('tab-auth-signup');

    let currentAuthMode = 'login'; // 'login' | 'signup'

    function setAuthMode(mode) {
        currentAuthMode = mode;
        authErrorBanner.classList.add('hidden');
        authForm.reset();

        if (mode === 'login') {
            loginTab.classList.add('active');
            signupTab.classList.remove('active');
            authTitle.textContent = 'Sign In';
            authSubmitBtn.textContent = 'Sign In';
            signupConfirmGroup.classList.add('hidden');
            document.getElementById('auth-password-confirm').required = false;
        } else {
            loginTab.classList.remove('active');
            signupTab.classList.add('active');
            authTitle.textContent = 'Create Account';
            authSubmitBtn.textContent = 'Get Started';
            signupConfirmGroup.classList.remove('hidden');
            document.getElementById('auth-password-confirm').required = true;
        }
    }

    // Auth trigger buttons
    document.getElementById('btn-landing-login').onclick = () => {
        setAuthMode('login');
        authModal.classList.add('active');
    };

    document.getElementById('btn-landing-signup').onclick = () => {
        setAuthMode('signup');
        authModal.classList.add('active');
    };

    document.getElementById('btn-landing-cta').onclick = () => {
        if (state.currentUser) {
            state.setView('dashboard');
        } else {
            setAuthMode('signup');
            authModal.classList.add('active');
        }
    };

    // Close Auth modal
    const closeAuth = () => authModal.classList.remove('active');
    document.getElementById('btn-auth-close').onclick = closeAuth;
    
    // Auth Tabs toggle
    loginTab.onclick = () => setAuthMode('login');
    signupTab.onclick = () => setAuthMode('signup');

    // Submit form handler
    authForm.onsubmit = (e) => {
        e.preventDefault();
        authErrorBanner.classList.add('hidden');

        const username = document.getElementById('auth-username').value;
        const password = document.getElementById('auth-password').value;

        if (currentAuthMode === 'login') {
            const res = state.login(username, password);
            if (res.success) {
                closeAuth();
            } else {
                showAuthError(res.message);
            }
        } else {
            const confirmPass = document.getElementById('auth-password-confirm').value;
            if (password !== confirmPass) {
                showAuthError("Passwords do not match.");
                return;
            }

            const res = state.signup(username, password);
            if (res.success) {
                closeAuth();
            } else {
                showAuthError(res.message);
            }
        }
    };

    function showAuthError(msg) {
        authErrorMsg.textContent = msg;
        authErrorBanner.classList.remove('hidden');
    }

    // Auth State Listeners
    state.on('auth-changed', (username) => {
        const userBadge = document.getElementById('dashboard-user-badge');
        const displayName = document.getElementById('user-display-name');

        if (username) {
            displayName.textContent = username;
            userBadge.style.display = 'flex';
        } else {
            displayName.textContent = 'Guest';
            userBadge.style.display = 'none';
        }
    });

    // Logout actions
    document.getElementById('btn-dashboard-logout').onclick = () => {
        if (confirm("Are you sure you want to log out?")) {
            state.logout();
        }
    };

    // ==========================================
    // DASHBOARD & PROJECT CARDS RENDERING
    // ==========================================
    const projectsGrid = document.getElementById('projects-grid-container');
    const emptyState = document.getElementById('projects-empty-state');
    const searchInput = document.getElementById('project-search-input');

    // Subscribe to projects listing changes
    state.on('projects-list-changed', (list) => {
        renderProjectsGrid(list);
    });

    function formatRelativeTime(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffSec = Math.floor(diffMs / 1000);
        const diffMin = Math.floor(diffSec / 60);
        const diffHr = Math.floor(diffMin / 60);
        const diffDays = Math.floor(diffHr / 24);

        if (diffSec < 60) return 'Just now';
        if (diffMin < 60) return `${diffMin} min${diffMin > 1 ? 's' : ''} ago`;
        if (diffHr < 24) return `${diffHr} hour${diffHr > 1 ? 's' : ''} ago`;
        if (diffDays === 1) return 'Yesterday';
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    }

    function renderProjectsGrid(projects) {
        projectsGrid.innerHTML = '';

        if (!projects || projects.length === 0) {
            projectsGrid.style.display = 'none';
            emptyState.classList.remove('hidden');
            return;
        }

        projectsGrid.style.display = 'grid';
        emptyState.classList.add('hidden');

        // Sort projects by last updated date descending
        const sorted = [...projects].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

        sorted.forEach(proj => {
            const card = document.createElement('div');
            card.className = 'project-card';

            // Card banner
            const banner = document.createElement('div');
            banner.className = 'project-card-banner';
            banner.innerHTML = '<i data-lucide="presentation" class="proj-banner-icon"></i>';
            card.appendChild(banner);

            // Card Info
            const info = document.createElement('div');
            info.className = 'project-card-info';

            const title = document.createElement('h3');
            title.textContent = proj.name;
            title.title = proj.name;
            info.appendChild(title);

            const meta = document.createElement('div');
            meta.className = 'project-card-meta';
            
            const slideCount = document.createElement('span');
            slideCount.className = 'slide-count';
            slideCount.innerHTML = `<i data-lucide="layers" style="width: 12px; height: 12px; display: inline; vertical-align: text-top; margin-right: 4px;"></i> ${proj.slideCount} slide${proj.slideCount !== 1 ? 's' : ''}`;
            meta.appendChild(slideCount);

            const time = document.createElement('span');
            time.className = 'last-updated';
            time.textContent = formatRelativeTime(proj.updatedAt);
            meta.appendChild(time);

            info.appendChild(meta);
            card.appendChild(info);

            // Hover action overlay buttons
            const actions = document.createElement('div');
            actions.className = 'project-card-actions';

            // Rename Button
            const renameBtn = document.createElement('button');
            renameBtn.className = 'project-card-btn';
            renameBtn.title = 'Rename';
            renameBtn.innerHTML = '<i data-lucide="edit-3"></i>';
            renameBtn.onclick = (e) => {
                e.stopPropagation();
                const newName = prompt("Enter new presentation name:", proj.name);
                if (newName && newName.trim() !== '') {
                    // Temporarily load it, rename, save, and return to dashboard view state
                    const savedState = state.project ? state.project.id : null;
                    const loaded = state.loadProject(proj.id);
                    if (loaded) {
                        state.updateSlideSettings({ name: state.project.slides[0].name }); // Dummy trigger to trigger save list
                        state.project.name = newName.trim();
                        state.saveToLocalStorage();
                        
                        // Restore previous view / loaded project pointer
                        if (savedState && savedState !== proj.id) {
                            state.loadProject(savedState);
                        } else {
                            state.project = null;
                            state.setView('dashboard');
                            renderProjectsGrid(state.getProjectsForCurrentUser());
                        }
                    }
                }
            };
            actions.appendChild(renameBtn);

            // Duplicate Button
            const dupBtn = document.createElement('button');
            dupBtn.className = 'project-card-btn';
            dupBtn.title = 'Duplicate';
            dupBtn.innerHTML = '<i data-lucide="copy"></i>';
            dupBtn.onclick = (e) => {
                e.stopPropagation();
                state.duplicateProject(proj.id);
            };
            actions.appendChild(dupBtn);

            // Export Button
            const exportBtn = document.createElement('button');
            exportBtn.className = 'project-card-btn';
            exportBtn.title = 'Export JSON';
            exportBtn.innerHTML = '<i data-lucide="download"></i>';
            exportBtn.onclick = (e) => {
                e.stopPropagation();
                const saved = localStorage.getItem(`slide_engine_project_${proj.id}`);
                if (saved) {
                    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(saved);
                    const downloadAnchor = document.createElement('a');
                    downloadAnchor.setAttribute("href", dataStr);
                    downloadAnchor.setAttribute("download", `${proj.name.toLowerCase().replace(/\s+/g, '_')}_project.json`);
                    document.body.appendChild(downloadAnchor);
                    downloadAnchor.click();
                    downloadAnchor.remove();
                }
            };
            actions.appendChild(exportBtn);

            // Delete Button
            const delBtn = document.createElement('button');
            delBtn.className = 'project-card-btn delete-proj-btn';
            delBtn.title = 'Delete Presentation';
            delBtn.innerHTML = '<i data-lucide="trash-2"></i>';
            delBtn.onclick = (e) => {
                e.stopPropagation();
                if (confirm(`Are you sure you want to delete "${proj.name}"? This cannot be undone.`)) {
                    state.deleteProject(proj.id);
                }
            };
            actions.appendChild(delBtn);

            card.appendChild(actions);

            // Opening project action
            card.onclick = () => {
                state.loadProject(proj.id);
            };

            projectsGrid.appendChild(card);
        });

        if (window.lucide) lucide.createIcons();
    }

    // Search input typing
    searchInput.oninput = (e) => {
        const query = e.target.value.toLowerCase().trim();
        const filtered = state.getProjectsForCurrentUser().filter(p => p.name.toLowerCase().includes(query));
        renderProjectsGrid(filtered);
    };

    // Creating new projects
    document.getElementById('btn-create-project').onclick = () => {
        state.createProject();
    };

    document.getElementById('btn-empty-create').onclick = () => {
        state.createProject();
    };

    // Importing new projects from dashboard
    document.getElementById('btn-dashboard-import').onclick = () => {
        const importModal = document.getElementById('import-modal');
        importModal.classList.add('active');
        document.getElementById('import-json-textarea').value = '';
    };

    // Back button in workspace header
    document.getElementById('btn-editor-back').onclick = () => {
        if (state.hasUnsavedChanges) {
            if (!confirm("You have unsaved changes. Are you sure you want to go back to the dashboard?")) {
                return;
            }
        }
        // Save current and exit to dashboard
        if (state.project) {
            state.saveToLocalStorage();
        }
        state.project = null;
        state.setView('dashboard');
    };
});
