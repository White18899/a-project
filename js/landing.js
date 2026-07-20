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

        // Manage history routing for back/home button interceptions
        if (view === 'editor') {
            if (history.state?.view !== 'editor') {
                history.pushState({ view: 'editor' }, '');
            }
        } else if (view === 'dashboard') {
            if (history.state?.view === 'editor') {
                history.back();
            } else {
                history.replaceState({ view: 'dashboard' }, '');
            }
        } else {
            history.replaceState({ view: 'landing' }, '');
        }

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
    // ==========================================
    // AUTHENTICATION MODAL & FORM LOGIC
    // ==========================================
    const authModal = document.getElementById('auth-modal');
    const authForm = document.getElementById('auth-form');
    const forgotForm = document.getElementById('forgot-form');
    const resetForm = document.getElementById('reset-form');
    const authTitle = document.getElementById('auth-modal-title');
    const authSubmitBtn = document.getElementById('btn-auth-submit');
    const signupConfirmGroup = document.getElementById('signup-confirm-group');
    const signupEmailGroup = document.getElementById('signup-email-group');
    const loginPasswordGroup = document.getElementById('login-password-group');
    const authUsernameGroup = document.getElementById('auth-username-group');
    const authErrorBanner = document.getElementById('auth-error-banner');
    const authErrorMsg = document.getElementById('auth-error-message');

    const loginTab = document.getElementById('tab-auth-login');
    const signupTab = document.getElementById('tab-auth-signup');
    const authTabs = document.getElementById('auth-tabs-container');
    const authSocial = document.getElementById('auth-social-section');

    let currentAuthMode = 'login'; // 'login' | 'signup' | 'forgot-password' | 'reset-password'

    function setAuthMode(mode) {
        currentAuthMode = mode;
        authErrorBanner.classList.add('hidden');
        authForm.reset();
        forgotForm.reset();
        resetForm.reset();

        // Show/hide correct forms
        if (mode === 'login' || mode === 'signup') {
            authForm.classList.remove('hidden');
            forgotForm.classList.add('hidden');
            resetForm.classList.add('hidden');
            authTabs.classList.remove('hidden');
            authSocial.classList.remove('hidden');
            authUsernameGroup.classList.remove('hidden');
            document.getElementById('auth-username').required = true;

             if (mode === 'login') {
                loginTab.classList.add('active');
                signupTab.classList.remove('active');
                authTitle.textContent = 'Sign In';
                authSubmitBtn.textContent = 'Sign In';
                signupConfirmGroup.classList.add('hidden');
                signupEmailGroup.classList.add('hidden');
                loginPasswordGroup.classList.remove('hidden');
                document.getElementById('btn-auth-forgot').style.display = 'block';
                document.getElementById('auth-password-confirm').required = false;
                document.getElementById('auth-email').required = false;
                
                // Change input label/placeholder for dual email/username login
                document.getElementById('label-auth-username').textContent = 'Username or Email';
                document.getElementById('auth-username').placeholder = 'Enter username or email...';
                document.getElementById('icon-auth-username').setAttribute('data-lucide', 'user');
            } else {
                loginTab.classList.remove('active');
                signupTab.classList.add('active');
                authTitle.textContent = 'Create Account';
                authSubmitBtn.textContent = 'Get Started';
                signupConfirmGroup.classList.remove('hidden');
                signupEmailGroup.classList.remove('hidden');
                loginPasswordGroup.classList.remove('hidden');
                document.getElementById('btn-auth-forgot').style.display = 'none';
                document.getElementById('auth-password-confirm').required = true;
                document.getElementById('auth-email').required = true;
                
                document.getElementById('label-auth-username').textContent = 'Username';
                document.getElementById('auth-username').placeholder = 'Enter username...';
            }
        } else if (mode === 'forgot-password') {
            authForm.classList.add('hidden');
            forgotForm.classList.remove('hidden');
            resetForm.classList.add('hidden');
            authTabs.classList.add('hidden');
            authSocial.classList.add('hidden');
            authTitle.textContent = 'Reset Password';
        } else if (mode === 'reset-password') {
            authForm.classList.add('hidden');
            forgotForm.classList.add('hidden');
            resetForm.classList.remove('hidden');
            authTabs.classList.add('hidden');
            authSocial.classList.add('hidden');
            authTitle.textContent = 'Set New Password';
        }
        
        // Refresh icons if needed
        if (window.lucide) {
            window.lucide.createIcons();
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
    const closeAuth = () => {
        authModal.classList.remove('active');
        // Reset to default
        setAuthMode('login');
    };
    document.getElementById('btn-auth-close').onclick = closeAuth;

    // Auth Tabs toggle
    loginTab.onclick = () => setAuthMode('login');
    signupTab.onclick = () => setAuthMode('signup');

    // Forgot password trigger in login form
    document.getElementById('btn-auth-forgot').onclick = (e) => {
        e.preventDefault();
        setAuthMode('forgot-password');
    };

    // Back to Login actions
    document.getElementById('btn-forgot-back').onclick = () => setAuthMode('login');
    document.getElementById('btn-reset-back').onclick = () => setAuthMode('login');



    // Native Auth Form Submit
    authForm.onsubmit = async (e) => {
        e.preventDefault();
        authErrorBanner.classList.add('hidden');

        const username = document.getElementById('auth-username').value;
        const password = document.getElementById('auth-password').value;

        if (currentAuthMode === 'login') {
            const res = await state.login(username, password);
            if (res.success) {
                closeAuth();
            } else {
                showAuthError(res.message);
            }
        } else {
            const email = document.getElementById('auth-email').value;
            const confirmPass = document.getElementById('auth-password-confirm').value;
            if (password !== confirmPass) {
                showAuthError("Passwords do not match.");
                return;
            }

            const res = await state.signup(username, password, email);
            if (res.success) {
                closeAuth();
            } else {
                showAuthError(res.message);
            }
        }
    };

    // Forgot Password Form Submit
    forgotForm.onsubmit = async (e) => {
        e.preventDefault();
        authErrorBanner.classList.add('hidden');
        const email = document.getElementById('auth-forgot-email').value;

        const res = await state.forgotPassword(email);
        if (res.success) {
            setAuthMode('reset-password');
            document.getElementById('auth-reset-email').value = email;
        } else {
            showAuthError(res.message);
        }
    };

    // Reset Password Form Submit
    resetForm.onsubmit = async (e) => {
        e.preventDefault();
        authErrorBanner.classList.add('hidden');
        const email = document.getElementById('auth-reset-email').value;
        const code = document.getElementById('auth-reset-code').value;
        const newPass = document.getElementById('auth-reset-password').value;
        const confirmPass = document.getElementById('auth-reset-password-confirm').value;

        if (newPass !== confirmPass) {
            showAuthError("Passwords do not match.");
            return;
        }

        const res = await state.resetPassword(email, code, newPass);
        if (res.success) {
            alert("Password reset successfully! Please log in with your new password.");
            setAuthMode('login');
        } else {
            showAuthError(res.message);
        }
    };

    function showAuthError(msg) {
        authErrorMsg.textContent = msg;
        authErrorBanner.classList.remove('hidden');
    }

    // Google Sign-In Setup
    function initGoogleSignIn() {
        if (window.google && window.google.accounts) {
            google.accounts.id.initialize({
                client_id: window.GOOGLE_CLIENT_ID || '1012972539469-3kdp7hnubs4omgeocv0gqsmhrbksss2j.apps.googleusercontent.com',
                callback: handleGoogleCredentialResponse
            });
            google.accounts.id.renderButton(
                document.getElementById("google-signin-btn"),
                { theme: "dark", size: "large", width: "100%", type: "standard", shape: "rectangular" }
            );
        } else {
            setTimeout(initGoogleSignIn, 1000);
        }
    }

    async function handleGoogleCredentialResponse(response) {
        authErrorBanner.classList.add('hidden');
        const res = await state.googleLogin(response.credential, false);
        if (res.success) {
            closeAuth();
        } else {
            showAuthError(res.message || "Google authentication failed.");
        }
    }

    // Initialize Google API
    initGoogleSignIn();

    // Legacy User Migration Modal logic
    const linkEmailModal = document.getElementById('link-email-modal');
    const linkEmailForm = document.getElementById('link-email-form');
    const linkEmailErrorBanner = document.getElementById('link-email-error-banner');
    const linkEmailErrorMsg = document.getElementById('link-email-error-message');

    document.getElementById('btn-add-legacy-email').onclick = () => {
        linkEmailErrorBanner.classList.add('hidden');
        linkEmailForm.reset();
        linkEmailModal.classList.add('active');
    };

    document.getElementById('btn-link-email-close').onclick = () => {
        linkEmailModal.classList.remove('active');
    };

    linkEmailForm.onsubmit = async (e) => {
        e.preventDefault();
        linkEmailErrorBanner.classList.add('hidden');
        const email = document.getElementById('link-email-input').value;
        const res = await state.updateEmail(email);
        if (res.success) {
            linkEmailModal.classList.remove('active');
            alert("Email linked successfully! You can now log in using either your username or email address.");
        } else {
            linkEmailErrorMsg.textContent = res.message;
            linkEmailErrorBanner.classList.remove('hidden');
        }
    };

    // Auth State Listeners
    state.on('auth-changed', (username) => {
        const userBadge = document.getElementById('dashboard-user-badge');
        const displayName = document.getElementById('user-display-name');
        const legacyBanner = document.getElementById('legacy-user-email-banner');

        if (username) {
            displayName.textContent = username;
            userBadge.style.display = 'flex';

            // Show email linkage banner if legacy account has no email
            if (!state.currentUserEmail && username.toLowerCase() !== 'guest') {
                legacyBanner.classList.remove('hidden');
            } else {
                legacyBanner.classList.add('hidden');
            }
        } else {
            displayName.textContent = 'Guest';
            userBadge.style.display = 'none';
            legacyBanner.classList.add('hidden');
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
            banner.style.overflow = 'hidden';
            
            let hasPreview = false;
            try {
                const projectDataStr = localStorage.getItem(`slide_engine_project_${proj.id}`);
                if (projectDataStr) {
                    const projectData = JSON.parse(projectDataStr);
                    if (projectData && projectData.slides && projectData.slides.length > 0) {
                        const slide = projectData.slides[0];
                        
                        const bgIndicator = document.createElement('div');
                        bgIndicator.className = 'project-card-bg-indicator';
                        bgIndicator.style.position = 'absolute';
                        bgIndicator.style.top = '0';
                        bgIndicator.style.left = '0';
                        bgIndicator.style.width = '100%';
                        bgIndicator.style.height = '100%';
                        bgIndicator.style.backgroundPosition = 'center';
                        bgIndicator.style.backgroundSize = 'cover';
                        
                        if (slide.background) {
                            if (slide.background.type === 'color') {
                                bgIndicator.style.backgroundColor = slide.background.color || '#0f172a';
                            } else if (slide.background.type === 'gradient') {
                                bgIndicator.style.background = `linear-gradient(${slide.background.gradientAngle || 135}deg, ${slide.background.gradientStart || '#0f172a'}, ${slide.background.gradientEnd || '#1e293b'})`;
                            } else if (slide.background.type === 'image' && slide.background.imageUrl) {
                                bgIndicator.style.backgroundImage = `url(${slide.background.imageUrl})`;
                            } else {
                                bgIndicator.style.backgroundColor = '#0f172a';
                            }
                        } else {
                            bgIndicator.style.backgroundColor = '#0f172a';
                        }
                        banner.appendChild(bgIndicator);

                        // Render mini elements inside the banner
                        if (slide.elements && slide.elements.length > 0) {
                            const sortedElems = [...slide.elements].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
                            sortedElems.forEach(elem => {
                                const mini = document.createElement('div');
                                mini.style.position = 'absolute';
                                mini.style.left = `${(elem.x / 1920) * 100}%`;
                                mini.style.top = `${(elem.y / 1080) * 100}%`;
                                mini.style.width = `${(elem.width / 1920) * 100}%`;
                                mini.style.height = `${(elem.height / 1080) * 100}%`;
                                mini.style.zIndex = elem.zIndex || 0;
                                mini.style.pointerEvents = 'none';
                                
                                if (elem.type === 'text' || elem.type.startsWith('btn-') || elem.type === 'timer') {
                                    const isRpg = elem.rpgStyle || slide.rpgTheme;
                                    if (isRpg) {
                                        mini.style.backgroundColor = 'rgba(0, 0, 128, 0.9)';
                                        mini.style.border = '0.5px double #ffffff';
                                    } else {
                                        const hex = (elem.bgColor || '#16161a').replace('#', '');
                                        let r = 0, g = 0, b = 0;
                                        if (hex.length === 3) {
                                            r = parseInt(hex.charAt(0) + hex.charAt(0), 16);
                                            g = parseInt(hex.charAt(1) + hex.charAt(1), 16);
                                            b = parseInt(hex.charAt(2) + hex.charAt(2), 16);
                                        } else if (hex.length === 6) {
                                            r = parseInt(hex.substring(0, 2), 16);
                                            g = parseInt(hex.substring(2, 4), 16);
                                            b = parseInt(hex.substring(4, 6), 16);
                                        }
                                        const alpha = elem.bgAlpha !== undefined ? elem.bgAlpha : 1;
                                        mini.style.backgroundColor = `rgba(${r}, ${g}, ${b}, ${alpha})`;
                                        
                                        if (elem.borderWidth && elem.borderStyle && elem.borderStyle !== 'none') {
                                            const miniBorderWidth = (elem.borderWidth / 1920) * 100;
                                            mini.style.border = `${miniBorderWidth}cqw ${elem.borderStyle} ${elem.borderColor || '#ffffff'}`;
                                        }
                                        mini.style.borderRadius = `${(elem.borderRadius || 0) / 1920 * 100}cqw`;
                                    }
                                    
                                    // Enable flex centering to match standard canvas vertical alignment
                                    mini.style.display = 'flex';
                                    mini.style.alignItems = 'center';
                                    
                                    if (elem.text) {
                                        const textSpan = document.createElement('span');
                                        textSpan.textContent = elem.text;
                                        textSpan.style.color = elem.textColor || '#ffffff';
                                        textSpan.style.fontSize = `${(elem.fontSize || 24) / 1920 * 100}cqw`;
                                        textSpan.style.fontFamily = isRpg ? 'Press Start 2P' : (elem.fontFamily || 'Outfit');
                                        textSpan.style.display = 'block';
                                        textSpan.style.overflow = 'hidden';
                                        textSpan.style.width = '100%';
                                        textSpan.style.textAlign = elem.align || 'left';
                                        textSpan.style.whiteSpace = 'nowrap';
                                        textSpan.style.textOverflow = 'ellipsis';
                                        textSpan.style.lineHeight = '1.2';
                                        mini.appendChild(textSpan);
                                    }
                                } else if (elem.type === 'image') {
                                    mini.style.backgroundImage = `url(${elem.fileData || elem.url || ''})`;
                                    mini.style.backgroundPosition = 'center';
                                    mini.style.backgroundSize = 'cover';
                                    mini.style.backgroundColor = '#1e293b';
                                } else if (elem.type === 'video') {
                                    mini.style.backgroundColor = '#000000';
                                    const playIndicator = document.createElement('div');
                                    playIndicator.style.width = '0';
                                    playIndicator.style.height = '0';
                                    playIndicator.style.borderTop = '3px solid transparent';
                                    playIndicator.style.borderBottom = '3px solid transparent';
                                    playIndicator.style.borderLeft = '5px solid rgba(255, 255, 255, 0.6)';
                                    playIndicator.style.position = 'absolute';
                                    playIndicator.style.left = '50%';
                                    playIndicator.style.top = '50%';
                                    playIndicator.style.transform = 'translate(-50%, -50%)';
                                    mini.appendChild(playIndicator);
                                }
                                banner.appendChild(mini);
                            });
                        }
                        hasPreview = true;
                    }
                }
            } catch (e) {
                console.error("Failed to render card preview", e);
            }

            if (!hasPreview) {
                banner.innerHTML = '<i data-lucide="presentation" class="proj-banner-icon"></i>';
            }
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
            renameBtn.onclick = async (e) => {
                e.stopPropagation();
                const newName = prompt("Enter new presentation name:", proj.name);
                if (newName && newName.trim() !== '') {
                    // Temporarily load it, rename, save, and return to dashboard view state
                    const savedState = state.project ? state.project.id : null;
                    const loaded = await state.loadProject(proj.id);
                    if (loaded) {
                        state.updateSlideSettings({ name: state.project.slides[0].name }); // Dummy trigger to trigger save list
                        state.project.name = newName.trim();
                        state.saveToLocalStorage();

                        // Restore previous view / loaded project pointer
                        if (savedState && savedState !== proj.id) {
                            await state.loadProject(savedState);
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
            dupBtn.onclick = async (e) => {
                e.stopPropagation();
                await state.duplicateProject(proj.id);
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
            delBtn.onclick = async (e) => {
                e.stopPropagation();
                if (confirm(`Are you sure you want to delete "${proj.name}"? This cannot be undone.`)) {
                    await state.deleteProject(proj.id);
                }
            };
            actions.appendChild(delBtn);

            card.appendChild(actions);

            // Opening project action
            card.onclick = async () => {
                await state.loadProject(proj.id);
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
        history.back();
    };

    // Back button in device rotation warning overlay
    document.getElementById('btn-rotate-back').onclick = () => {
        history.back();
    };

    // Slide Showcase Section Intersection Observer
    function initShowcaseObserver() {
        const items = document.querySelectorAll('.showcase-item');
        const layers = document.querySelectorAll('.mockup-layer');
        const tabs = document.querySelectorAll('.showcase-tab');
        let timerInterval = null;

        let autoplayInterval = null;
        let activeIndex = 0;

        function scrollTabIntoView(tab) {
            const wrapper = tab.closest('.showcase-tabs-wrapper');
            if (wrapper) {
                const wrapperRect = wrapper.getBoundingClientRect();
                const tabRect = tab.getBoundingClientRect();
                const tabOffsetLeft = tabRect.left - wrapperRect.left + wrapper.scrollLeft;
                const targetLeft = tabOffsetLeft - (wrapperRect.width / 2) + (tabRect.width / 2);
                
                wrapper.scrollTo({
                    left: targetLeft,
                    behavior: 'smooth'
                });
            }
        }

        function selectElement(tab) {
            const targetElement = tab.getAttribute('data-element');
            activeIndex = Array.from(tabs).indexOf(tab);

            // Toggle active tab class
            tabs.forEach(t => t.classList.toggle('active', t === tab));
            
            // Auto scroll tab into view center (horizontally only)
            scrollTabIntoView(tab);
            
            // Toggle active text description class
            items.forEach(item => {
                item.classList.toggle('active', item.getAttribute('data-element') === targetElement);
            });

            // Toggle active mockup layer class
            layers.forEach(layer => {
                const layerElement = layer.getAttribute('data-element');
                if (layerElement === targetElement) {
                    layer.classList.add('active');
                    if (layerElement === 'timer') {
                        startShowcaseTimerSimulation();
                    } else {
                        stopShowcaseTimerSimulation();
                    }
                } else {
                    layer.classList.remove('active');
                }
            });
        }

        // Mobile tabs click navigation
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                stopAutoplay(); // stop autoplay on manual interaction
                selectElement(tab);
            });
        });

        function startAutoplay() {
            stopAutoplay();
            if (window.innerWidth > 768) return;

            autoplayInterval = setInterval(() => {
                activeIndex = (activeIndex + 1) % tabs.length;
                const nextTab = tabs[activeIndex];
                if (nextTab) {
                    selectElement(nextTab);
                }
            }, 3500);
        }

        function stopAutoplay() {
            if (autoplayInterval) {
                clearInterval(autoplayInterval);
                autoplayInterval = null;
            }
        }

        const observerOptions = {
            root: null,
            rootMargin: '-20% 0px -20% 0px',
            threshold: 0.5
        };

        const observer = new IntersectionObserver((entries) => {
            // Do not run on mobile view to avoid conflicts with manual tab clicks
            if (window.innerWidth <= 768) return;

            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const targetElement = entry.target.getAttribute('data-element');

                    // 1. Toggle active class on text descriptions
                    items.forEach(item => {
                        if (item === entry.target) {
                            item.classList.add('active');
                        } else {
                            item.classList.remove('active');
                        }
                    });

                    // 2. Toggle active layer on mockup sticky side
                    layers.forEach(layer => {
                        const layerElement = layer.getAttribute('data-element');
                        if (layerElement === targetElement) {
                            layer.classList.add('active');
                            if (layerElement === 'timer') {
                                startShowcaseTimerSimulation();
                            } else {
                                stopShowcaseTimerSimulation();
                            }
                        } else {
                            layer.classList.remove('active');
                        }
                    });
                }
            });
        }, observerOptions);

        function setupObserver() {
            if (window.innerWidth > 768) {
                stopAutoplay();
                items.forEach(item => observer.observe(item));
            } else {
                items.forEach(item => observer.unobserve(item));
                
                // Sync tab state to whatever item is currently active when entering mobile mode
                const activeItem = document.querySelector('.showcase-item.active');
                if (activeItem) {
                    const target = activeItem.getAttribute('data-element');
                    tabs.forEach(t => {
                        const isMatch = t.getAttribute('data-element') === target;
                        t.classList.toggle('active', isMatch);
                        if (isMatch) {
                            scrollTabIntoView(t);
                            activeIndex = Array.from(tabs).indexOf(t);
                        }
                    });
                }
                startAutoplay();
            }
        }

        setupObserver();
        window.addEventListener('resize', setupObserver);

        // Pause/play autoplay based on whether elements-showcase-container is visible in the viewport
        const containerObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    if (window.innerWidth <= 768) {
                        startAutoplay();
                    }
                } else {
                    stopAutoplay();
                }
            });
        }, { threshold: 0.1 });

        const containerEl = document.querySelector('.elements-showcase-container');
        if (containerEl) {
            containerObserver.observe(containerEl);
        }

        // MCQ Timer Mockup simulation
        function startShowcaseTimerSimulation() {
            stopShowcaseTimerSimulation();
            const timerNumEl = document.getElementById('showcase-timer-num');
            const progressCircle = document.querySelector('.timer-progress');
            if (!timerNumEl || !progressCircle) return;

            let countdown = 10;
            timerNumEl.textContent = countdown;

            // progress circle styling
            progressCircle.style.transition = 'none';
            progressCircle.style.strokeDashoffset = '0';

            // Force reflow
            progressCircle.getBoundingClientRect();
            progressCircle.style.transition = 'stroke-dashoffset 10s linear';
            progressCircle.style.strokeDashoffset = '283';

            timerInterval = setInterval(() => {
                countdown--;
                if (countdown < 0) {
                    countdown = 10;
                    progressCircle.style.transition = 'none';
                    progressCircle.style.strokeDashoffset = '0';
                    progressCircle.getBoundingClientRect();
                    progressCircle.style.transition = 'stroke-dashoffset 10s linear';
                    progressCircle.style.strokeDashoffset = '283';
                }
                timerNumEl.textContent = countdown;
            }, 1000);
        }

        function stopShowcaseTimerSimulation() {
            if (timerInterval) {
                clearInterval(timerInterval);
                timerInterval = null;
            }
        }
    }

    // Noteworthy Studio Clock & Interactive Scroll Actions
    function initClock() {
        const clockEl = document.getElementById('live-clock');
        const locationEl = document.querySelector('.location-name');
        if (!clockEl) return;

        const tzCountryMap = {
            'Calcutta': 'India',
            'Kolkata': 'India',
            'Bombay': 'India',
            'Mumbai': 'India',
            'Zurich': 'Switzerland',
            'Geneva': 'Switzerland',
            'London': 'United Kingdom',
            'New_York': 'United States',
            'Los_Angeles': 'United States',
            'Chicago': 'United States',
            'Denver': 'United States',
            'Phoenix': 'United States',
            'Anchorage': 'United States',
            'Honolulu': 'United States',
            'Tokyo': 'Japan',
            'Singapore': 'Singapore',
            'Paris': 'France',
            'Berlin': 'Germany',
            'Rome': 'Italy',
            'Madrid': 'Spain',
            'Moscow': 'Russia',
            'Sydney': 'Australia',
            'Melbourne': 'Australia',
            'Toronto': 'Canada',
            'Vancouver': 'Canada',
            'Seoul': 'South Korea',
            'Shanghai': 'China',
            'Hong_Kong': 'China',
            'Dubai': 'United Arab Emirates'
        };

        let resolvedCountry = '';

        // 1. Resolve offline using timezone dictionary
        try {
            const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
            if (tz && tz.includes('/')) {
                const parts = tz.split('/');
                const city = parts[parts.length - 1];
                if (tzCountryMap[city]) {
                    resolvedCountry = tzCountryMap[city];
                } else {
                    resolvedCountry = city.replace(/_/g, ' ');
                }
            } else if (tz) {
                resolvedCountry = tz;
            }
        } catch (err) {
            console.error("Offline country resolution failed:", err);
        }

        if (resolvedCountry && locationEl) {
            locationEl.textContent = resolvedCountry;
        }

        // 2. Fetch from geolocation API to get the exact country name online
        fetch('https://ipapi.co/json/')
            .then(res => {
                if (!res.ok) throw new Error('Network response was not ok');
                return res.json();
            })
            .then(data => {
                if (data && data.country_name && locationEl) {
                    locationEl.textContent = data.country_name;
                }
            })
            .catch(err => {
                console.warn("Geo-IP API lookup failed (falling back to offline timezone resolution):", err);
            });

        function updateClock() {
            try {
                const localTime = new Date().toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false
                });
                clockEl.textContent = localTime;
            } catch (err) {
                console.error("Error updating live clock:", err);
            }
        }

        updateClock();
        setInterval(updateClock, 1000 * 20);
    }


    function initExploreScroll() {
        const btnExplore = document.getElementById('btn-explore-showcase');
        if (btnExplore) {
            btnExplore.onclick = (e) => {
                e.preventDefault();
                const showcaseEl = document.querySelector('.elements-showcase-container');
                if (showcaseEl) {
                    showcaseEl.scrollIntoView({ behavior: 'smooth' });
                }
            };
        }
    }

    function initPasswordToggle() {
        const wrappers = document.querySelectorAll('.input-icon-wrapper');
        wrappers.forEach(wrapper => {
            const input = wrapper.querySelector('input[type="password"], input[type="text"]');
            const btn = wrapper.querySelector('.btn-toggle-password');
            if (!input || !btn) return;
            
            btn.addEventListener('click', () => {
                const isPassword = input.getAttribute('type') === 'password';
                input.setAttribute('type', isPassword ? 'text' : 'password');
                
                // Swap icon between eye and eye-off
                btn.innerHTML = `<i data-lucide="${isPassword ? 'eye-off' : 'eye'}"></i>`;
                if (window.lucide) {
                    lucide.createIcons();
                }
            });
        });
    }

    initClock();
    initExploreScroll();
    initPasswordToggle();
    initShowcaseObserver();

    // Intercept browser back button and physical mobile back gesture/button
    window.addEventListener('popstate', (e) => {
        if (state.currentView === 'editor') {
            if (state.hasUnsavedChanges) {
                if (!confirm("You have unsaved changes. Are you sure you want to go back to the dashboard? (Unsaved changes will be lost)")) {
                    // Re-push history state to stay on editor view
                    history.pushState({ view: 'editor' }, '');
                    return;
                }
            }
            state.project = null;
            state.setView('dashboard');
        }
    });
});
