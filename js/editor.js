const SHAPES_LIST = [
    { id: 'rectangle', name: 'Rectangle', svg: `<rect x="2" y="2" width="12" height="12" rx="1"></rect>` },
    { id: 'circle', name: 'Circle', svg: `<circle cx="8" cy="8" r="6"></circle>` },
    { id: 'triangle', name: 'Triangle', svg: `<polygon points="8,2 14,14 2,14"></polygon>` },
    { id: 'star', name: 'Star', svg: `<polygon points="8,2 10,6 14.5,6.5 11,9.5 12,14 8,11.5 4,14 5,9.5 1.5,6.5 6,6"></polygon>` },
    { id: 'pentagon', name: 'Pentagon', svg: `<polygon points="8,1.5 14.5,6.5 12,14.5 4,14.5 1.5,6.5"></polygon>` },
    { id: 'hexagon', name: 'Hexagon', svg: `<polygon points="8,1.5 14,5 14,11 8,14.5 2,11 2,5"></polygon>` },
    { id: 'octagon', name: 'Octagon', svg: `<polygon points="5.5,1.5 10.5,1.5 14.5,5.5 14.5,10.5 10.5,14.5 5.5,14.5 1.5,10.5 1.5,5.5"></polygon>` },
    { id: 'diamond', name: 'Diamond', svg: `<polygon points="8,1.5 14.5,8 8,14.5 1.5,8"></polygon>` },
    { id: 'right-triangle', name: 'Right Triangle', svg: `<polygon points="2,2 14,14 2,14"></polygon>` },
    { id: 'arrow-right', name: 'Arrow Right', svg: `<path d="M2,8 H11 M11,8 L7,4 M11,8 L7,12"></path>` },
    { id: 'heart', name: 'Heart', svg: `<path d="M8,14.5 C-2,8 3,1.5 8,5.5 C13,1.5 18,8 8,14.5 Z"></path>` },
    { id: 'line', name: 'Line', svg: `<line x1="2" y1="8" x2="14" y2="8"></line>` },
    { id: 'oval', name: 'Oval', svg: `<ellipse cx="8" cy="8" rx="6" ry="4"></ellipse>` },
    { id: 'parallelogram', name: 'Parallelogram', svg: `<polygon points="5,2 14,2 11,14 2,14"></polygon>` },
    { id: 'trapezoid', name: 'Trapezoid', svg: `<polygon points="5,2 11,2 14,14 2,14"></polygon>` },
    { id: 'cross', name: 'Cross', svg: `<path d="M6.5,2 H9.5 V6.5 H14 V9.5 H9.5 V14 H6.5 V9.5 H2 V6.5 H6.5 Z"></path>` },
    { id: 'shield', name: 'Shield', svg: `<path d="M2,2 H14 V6.5 C14,10.5 8,14.5 8,14.5 C8,14.5 2,10.5 2,6.5 Z"></path>` },
    { id: 'speech-bubble', name: 'Speech Bubble', svg: `<path d="M2,2 H14 V10 H8 L4,14 V10 H2 Z"></path>` },
    { id: 'arrow-left', name: 'Arrow Left', svg: `<path d="M14,8 H5 M5,8 L9,4 M5,8 L9,12"></path>` },
    { id: 'arrow-up', name: 'Arrow Up', svg: `<path d="M8,14 V5 M8,5 L4,9 M8,5 L12,9"></path>` },
    { id: 'arrow-down', name: 'Arrow Down', svg: `<path d="M8,2 V11 M8,11 L4,7 M8,11 L12,7"></path>` },
    { id: 'double-arrow', name: 'Double Arrow', svg: `<path d="M2,8 H14 M2,8 L5,5 M2,8 L5,11 M14,8 L11,5 M14,8 L11,11"></path>` }
];

document.addEventListener("DOMContentLoaded", () => {
    // 1. Initialize canvas instance
    window.editorCanvas = new window.SlideCanvas('canvas-container', 'edit');

    // 2. UI Controller Setup
    initEditorUI();

    // 3. Initialize State (deferred to allow other files' DOMContentLoaded listeners to bind first)
    setTimeout(() => {
        window.EngineState.init();
    }, 0);

    // 4. Redraw slide when Google Fonts load to ensure correct size and layout metrics
    if (document.fonts) {
        document.fonts.ready.then(() => {
            const activeSlide = window.EngineState.getActiveSlide();
            if (activeSlide && window.editorCanvas) {
                window.editorCanvas.renderSlide(activeSlide);
            }
        });
    }

    // 5. Unsaved changes warning before leaving/closing tab
    window.addEventListener('beforeunload', (e) => {
        if (window.EngineState && window.EngineState.hasUnsavedChanges) {
            e.preventDefault();
            e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
            return e.returnValue;
        }
    });
});

function initEditorUI() {
    const state = window.EngineState;
    const canvas = window.editorCanvas;

    function uploadFile(file, statusTextEl, successCallback, errorCallback) {
        if (statusTextEl) {
            statusTextEl.textContent = "Uploading...";
            statusTextEl.style.color = "var(--text-muted)";
        }
        
        const token = localStorage.getItem('slide_engine_api_token') || '';
        const headers = {
            'X-Filename': file.name
        };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        let uploadOrigin = (window.SlideEngineAPI && window.SlideEngineAPI.baseUrl) || '';
        if (!uploadOrigin) {
            uploadOrigin = window.location.origin.includes(':3000') 
                ? window.location.origin 
                : 'http://localhost:3000';
        }
        if (uploadOrigin.endsWith('/')) {
            uploadOrigin = uploadOrigin.slice(0, -1);
        }

        fetch(`${uploadOrigin}/api/upload?filename=${encodeURIComponent(file.name)}`, {
            method: 'POST',
            headers: headers,
            body: file
        })
        .then(async res => {
            const text = await res.text();
            if (!res.ok) {
                throw new Error(`Server returned status ${res.status}: ${text.substring(0, 100)}`);
            }
            try {
                return JSON.parse(text);
            } catch (e) {
                throw new Error(`Invalid JSON response: "${text.substring(0, 100)}"`);
            }
        })
        .then(data => {
            if (data.success) {
                if (statusTextEl) {
                    statusTextEl.textContent = "Uploaded successfully";
                    statusTextEl.style.color = "#10b981";
                }
                successCallback(data.url);
            } else {
                throw new Error(data.message || 'Upload failed');
            }
        })
        .catch(err => {
            console.error('[Upload Error] Details:', err);
            if (statusTextEl) {
                statusTextEl.textContent = "Failed to upload: " + err.message;
                statusTextEl.style.color = "#ef4444";
            }
            if (errorCallback) {
                errorCallback(err);
            }
        });
    }

    // Active Tab tracking
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            tabButtons.forEach(b => b.classList.remove('active'));
            tabPanels.forEach(p => p.classList.remove('active'));

            btn.classList.add('active');
            const targetTab = btn.getAttribute('data-tab');
            document.getElementById(targetTab).classList.add('active');
        });
    });

    // ==========================================
    // STATE BINDINGS (Subscribers)
    // ==========================================

    function updateCopyPasteButtons() {
        const copyBtn = document.getElementById('btn-copy-elements');
        const pasteBtn = document.getElementById('btn-paste-elements');
        
        const hasSelection = state.selectedElementId || (state.selectedElementIds && state.selectedElementIds.length > 0);
        if (copyBtn) {
            copyBtn.disabled = !hasSelection;
        }
        
        const hasClipboard = state.clipboard && state.clipboard.length > 0;
        if (pasteBtn) {
            pasteBtn.disabled = !hasClipboard;
        }
    }

    state.on('project-loaded', (project) => {
        document.getElementById('project-name-input').value = project.name;
        updateCopyPasteButtons();
    });

    state.on('clipboard-changed', () => {
        updateCopyPasteButtons();
    });

    state.on('slide-list-changed', (slides) => {
        renderSlideList(slides);
        rebuildNavSlideDropdowns();
    });

    const slideListContainer = document.getElementById('slides-list-container');
    slideListContainer.addEventListener('dragover', (e) => {
        e.preventDefault();
    });
    slideListContainer.addEventListener('drop', (e) => {
        if (e.target === slideListContainer) {
            const fromIdx = parseInt(e.dataTransfer.getData('text/plain'));
            if (!isNaN(fromIdx) && state.project && state.project.slides && fromIdx !== state.project.slides.length - 1) {
                state.moveSlide(fromIdx, state.project.slides.length - 1);
            }
        }
    });

    state.on('slide-changed', (slide) => {
        if (!slide) return;
        canvas.renderSlide(slide);
        updateSlideCardPreview(slide);
        
        // Update Slide active card in list
        const cards = document.querySelectorAll('.slide-card');
        cards.forEach(card => {
            if (card.getAttribute('data-id') === slide.id) {
                card.classList.add('active');
            } else {
                card.classList.remove('active');
            }
        });
        
        // Update Slide form
        document.getElementById('slide-name-input').value = slide.name;
        
        // Update toolbar slide info
        let slideIndexStr = '01';
        if (state.project && state.project.slides) {
            const slideIdx = state.project.slides.findIndex(s => s.id === slide.id);
            if (slideIdx !== -1) {
                slideIndexStr = String(slideIdx + 1).padStart(2, '0');
            }
        }
        const indexEl = document.getElementById('toolbar-slide-index');
        if (indexEl) indexEl.textContent = slideIndexStr;
        const nameEl = document.getElementById('toolbar-slide-name');
        if (nameEl) nameEl.textContent = slide.name || '';

        document.getElementById('slide-bg-type').value = slide.background.type;
        document.getElementById('slide-transition').value = slide.transition || 'none';
        updateTransitionIcon(slide.transition || 'none');
        const bgCol = slide.background.color || '#1e293b';
        document.getElementById('slide-bg-color').value = bgCol === 'transparent' ? '#000000' : bgCol;
        document.getElementById('slide-bg-color-hex').value = bgCol;
        syncColorSwatchTransparentClass(document.getElementById('slide-bg-color'), bgCol);

        const grad1 = slide.background.gradientStart || '#0f172a';
        document.getElementById('slide-bg-grad-1').value = grad1 === 'transparent' ? '#000000' : grad1;
        document.getElementById('slide-bg-grad-1-hex').value = grad1;
        syncColorSwatchTransparentClass(document.getElementById('slide-bg-grad-1'), grad1);

        const grad2 = slide.background.gradientEnd || '#1e293b';
        document.getElementById('slide-bg-grad-2').value = grad2 === 'transparent' ? '#000000' : grad2;
        document.getElementById('slide-bg-grad-2-hex').value = grad2;
        syncColorSwatchTransparentClass(document.getElementById('slide-bg-grad-2'), grad2);

        document.getElementById('slide-bg-grad-angle').value = slide.background.gradientAngle;
        document.getElementById('slide-bg-image-url').value = slide.background.imageUrl;

        // Toggle backgrounds options visual elements
        toggleBackgroundOptionFields(slide.background.type);

        // Rebuild inspector targets list
        rebuildElementInspectorSelectors();
        
        // Rebuild Layers Panel
        rebuildLayersPanel(slide);
        updateCopyPasteButtons();
    });

    state.on('selection-changed', (element) => {
        const inspectorForm = document.getElementById('element-inspector-form');
        const emptyState = document.getElementById('no-element-selected');

        if (!element) {
            inspectorForm.classList.add('hidden');
            emptyState.classList.remove('hidden');
            const hud = document.getElementById('floating-mini-inspector');
            if (hud) hud.classList.add('hidden');
            closeCustomColorPicker();
            
            // Switch back to Slide Settings Tab automatically for editing background
            switchTab('elements-tab');
        } else {
            // Rebuild target dropdown selectors first!
            rebuildElementInspectorSelectors();
            
            emptyState.classList.add('hidden');
            inspectorForm.classList.remove('hidden');
            switchTab('properties-tab');
            
            // Expand right sidebar if collapsed
            const editorView = document.getElementById('editor-view');
            if (editorView && editorView.classList.contains('right-sidebar-collapsed')) {
                editorView.classList.remove('right-sidebar-collapsed');
                const toggleRightBtn = document.getElementById('btn-toggle-right-sidebar');
                if (toggleRightBtn) {
                    toggleRightBtn.title = "Collapse Inspector Panel";
                    toggleRightBtn.innerHTML = '<i data-lucide="chevron-right"></i>';
                    if (window.lucide) lucide.createIcons();
                }
                if (window.editorCanvas) {
                    window.editorCanvas.resize();
                }
            }
            
            // Update target indicator in layout section
            const targetInd = document.getElementById('layout-target-indicator');
            if (targetInd) {
                const count = (state.selectedElementIds || []).length;
                targetInd.textContent = count > 1 ? `Selection (${count})` : 'Canvas';
            }

            // Update contextual floating mini-inspector
            if (typeof window.updateFloatingMiniInspector === 'function') {
                window.updateFloatingMiniInspector();
            }

            // Bind fields
            document.getElementById('inspector-element-title').textContent = `${element.type.toUpperCase()} Element`;
            document.getElementById('elem-id').value = element.id;
            document.getElementById('elem-visible').checked = element.visible !== false;
            
            // Form value assignments
            if (element.text !== undefined) {
                document.getElementById('elem-text').value = element.text;
                document.getElementById('field-elem-text').classList.remove('hidden');
                if (window.syncTypographyStudioUI) {
                    window.syncTypographyStudioUI(element);
                }
            } else {
                document.getElementById('field-elem-text').classList.add('hidden');
            }

            document.getElementById('elem-x').value = element.x;
            document.getElementById('elem-y').value = element.y;
            document.getElementById('elem-w').value = element.width;
            document.getElementById('elem-h').value = element.height;
            if (window.syncGeometryMatrixUI) {
                window.syncGeometryMatrixUI(element);
            }
            const rotVal = element.rotation || 0;
            if (window.syncRotationUI) {
                window.syncRotationUI(rotVal, false);
            } else {
                document.getElementById('elem-rotation').value = `${rotVal}°`;
                document.getElementById('elem-rotation-slider').value = rotVal;
            }
            if (element.shapeType) {
                const shape = SHAPES_LIST.find(s => s.id === element.shapeType) || SHAPES_LIST[0];
                const trigger = document.getElementById('shape-select-trigger');
                if (trigger) {
                    const preview = trigger.querySelector('.selected-shape-preview');
                    const name = trigger.querySelector('.selected-shape-name');
                    if (preview) preview.innerHTML = `<svg viewBox="0 0 16 16">${shape.svg}</svg>`;
                    if (name) name.textContent = shape.name;
                }
            }

            // Conditional rendering logic based on type
            toggleInspectorFieldsForType(element.type);
            
            // Bind font formatting inputs
            const isTextOrBtnOrTimer = element.fontFamily !== undefined || element.type === 'text' || element.type.startsWith('btn-') || element.type === 'timer';
            if (isTextOrBtnOrTimer) {
                const defaultAlign = (element.type.startsWith('btn-') || element.type === 'timer') ? 'center' : 'left';
                document.getElementById('elem-font-family').value = element.fontFamily || 'Outfit';
                document.getElementById('elem-font-size').value = element.fontSize || 24;
                document.getElementById('elem-align').value = element.align || defaultAlign;
                const txtCol = element.textColor || '#ffffff';
                document.getElementById('elem-text-color').value = txtCol === 'transparent' ? '#000000' : txtCol;
                document.getElementById('elem-text-color-hex').value = txtCol;
                syncColorSwatchTransparentClass(document.getElementById('elem-text-color'), txtCol);
                if (window.syncTypographyStudioUI) {
                    window.syncTypographyStudioUI(element);
                }
            }

            // Bind background formatting inputs
            if (element.bgColor !== undefined) {
                const bgCol = element.bgColor || '#334155';
                document.getElementById('elem-bg-color').value = bgCol === 'transparent' ? '#000000' : bgCol;
                document.getElementById('elem-bg-color-hex').value = bgCol;
                syncColorSwatchTransparentClass(document.getElementById('elem-bg-color'), bgCol);
                document.getElementById('elem-bg-alpha').value = element.bgAlpha !== undefined ? element.bgAlpha : 1;
                document.getElementById('elem-border-radius').value = element.borderRadius || 0;
                document.getElementById('elem-border-width').value = element.borderWidth || 0;
                document.getElementById('elem-border-style').value = element.borderStyle || 'none';
                
                const borCol = element.borderColor || '#ffffff';
                document.getElementById('elem-border-color').value = borCol === 'transparent' ? '#000000' : borCol;
                document.getElementById('elem-border-color-hex').value = borCol;
                syncColorSwatchTransparentClass(document.getElementById('elem-border-color'), borCol);

                if (window.syncAppearanceStudioUI) {
                    window.syncAppearanceStudioUI(element);
                }
            }

            // Image URL properties
            if (element.type === 'image') {
                document.getElementById('elem-image-url').value = element.url || '';
            }

            // Video properties
            if (element.type === 'video') {
                document.getElementById('elem-video-url').value = element.url || '';
                document.getElementById('elem-video-autoplay').checked = element.autoplay !== false;
                document.getElementById('elem-video-loop').checked = element.loop !== false;
                document.getElementById('elem-video-muted').checked = element.muted === true;
                document.getElementById('elem-video-volume').value = element.volume !== undefined ? element.volume : 1.0;
                
                const statusText = document.getElementById('video-status-text');
                const fileLabel = document.getElementById('video-file-label');
                const isLocal = element.fileData || (element.url && element.url.startsWith('/uploads/'));
                if (isLocal) {
                    if (statusText) {
                        statusText.textContent = "Local video file loaded";
                        statusText.style.color = "#10b981";
                    }
                    if (fileLabel) fileLabel.textContent = "Replace video file...";
                } else if (element.url) {
                    if (statusText) {
                        statusText.textContent = "Video loaded via URL";
                        statusText.style.color = "#3b82f6";
                    }
                    if (fileLabel) fileLabel.textContent = "Choose file...";
                } else {
                    if (statusText) {
                        statusText.textContent = "No video file loaded";
                        statusText.style.color = "var(--text-muted)";
                    }
                    if (fileLabel) fileLabel.textContent = "Choose file...";
                }
            }

            // Navigation Button properties
            if (element.type === 'btn-nav') {
                document.getElementById('elem-nav-target').value = element.targetSlideId || '';
            }

            // MCQ Option Button properties
            if (element.type === 'btn-option') {
                document.getElementById('elem-option-correct').checked = element.isCorrect || false;
                document.getElementById('elem-option-group').value = element.group || 'Q1';
            }

            // Show Answer properties
            if (element.type === 'btn-show-ans') {
                document.getElementById('elem-show-ans-target').value = element.targetElementId || '';
            }

            // Toggle / Visibility properties
            if (element.type === 'btn-toggle' || element.type === 'btn-option') {
                renderToggleActions(element);
            }

            // Timer parameters
            if (element.type === 'timer') {
                document.getElementById('elem-timer-duration').value = element.duration || 30;
                renderTimerActions(element);
            }

            // Button markup properties binding
            if (element.type && element.type.startsWith('btn-')) {
                document.getElementById('elem-use-markup').checked = element.useMarkupColor || false;
                const markCol = element.markupColor || '#3b82f6';
                document.getElementById('elem-markup-color').value = markCol === 'transparent' ? '#000000' : markCol;
                document.getElementById('elem-markup-color-hex').value = markCol;
                syncColorSwatchTransparentClass(document.getElementById('elem-markup-color'), markCol);
                
                if (element.useMarkupColor) {
                    document.getElementById('field-markup-color').classList.remove('hidden');
                } else {
                    document.getElementById('field-markup-color').classList.add('hidden');
                }
            }
        }
        
        // Update Layers panel active highlight
        highlightActiveLayer();
        updateCopyPasteButtons();
    });

    state.on('element-updated', (element) => {
        // Only trigger redraw on canvas
        const slide = state.getActiveSlide();
        if (slide) {
            canvas.renderSlide(slide);
            updateSlideCardPreview(slide);
        }
        
        // Also update properties fields if this updated element is the currently selected one
        if (state.selectedElementId === element.id) {
            document.getElementById('elem-x').value = element.x;
            document.getElementById('elem-y').value = element.y;
            document.getElementById('elem-w').value = element.width;
            document.getElementById('elem-h').value = element.height;
            if (window.syncGeometryMatrixUI) {
                window.syncGeometryMatrixUI(element);
            }
            const rotVal = element.rotation || 0;
            if (window.syncRotationUI) {
                window.syncRotationUI(rotVal, false);
            } else {
                document.getElementById('elem-rotation').value = `${rotVal}°`;
                document.getElementById('elem-rotation-slider').value = rotVal;
            }
            if (element.shapeType) {
                const shape = SHAPES_LIST.find(s => s.id === element.shapeType) || SHAPES_LIST[0];
                const trigger = document.getElementById('shape-select-trigger');
                if (trigger) {
                    const preview = trigger.querySelector('.selected-shape-preview');
                    const name = trigger.querySelector('.selected-shape-name');
                    if (preview) preview.innerHTML = `<svg viewBox="0 0 16 16">${shape.svg}</svg>`;
                    if (name) name.textContent = shape.name;
                }
            }
        }
    });

    // ==========================================
    // SIDEBAR SLIDE CARDS RENDERING
    // ==========================================

    function updateSlideCardPreview(slide, card = null) {
        if (!slide) return;
        if (!card) {
            card = document.querySelector(`.slide-card[data-id="${slide.id}"]`);
        }
        if (!card) return;
        
        let preview = card.querySelector('.slide-card-preview');
        if (!preview) {
            preview = document.createElement('div');
            preview.className = 'slide-card-preview';
            card.prepend(preview);
        } else {
            preview.innerHTML = '';
        }
        
        const bgIndicator = document.createElement('div');
        bgIndicator.className = 'slide-card-bg-indicator';
        
        if (slide.background.type === 'color') {
            bgIndicator.style.backgroundColor = slide.background.color;
        } else if (slide.background.type === 'gradient') {
            bgIndicator.style.background = `linear-gradient(${slide.background.gradientAngle}deg, ${slide.background.gradientStart}, ${slide.background.gradientEnd})`;
        } else if (slide.background.type === 'image' && slide.background.imageUrl) {
            bgIndicator.style.backgroundImage = `url(${slide.background.imageUrl})`;
        }
        preview.appendChild(bgIndicator);

        // Render mini elements inside the slide thumbnail preview
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
                        mini.style.borderRadius = `${(elem.borderRadius || 0) / 1920 * 100}cqw`;
                        if (elem.borderWidth && elem.borderStyle && elem.borderStyle !== 'none') {
                            const miniBorderWidth = (elem.borderWidth / 1920) * 100;
                            mini.style.border = `${miniBorderWidth}cqw ${elem.borderStyle} ${elem.borderColor || '#ffffff'}`;
                        }
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
                    mini.style.backgroundImage = `url(${elem.fileData || elem.url})`;
                    mini.style.backgroundSize = 'cover';
                    mini.style.backgroundPosition = 'center';
                } else if (elem.type === 'video') {
                    mini.style.backgroundColor = '#0b0b14';
                    mini.style.border = '0.5px solid #dee2e6';
                    
                    const playIcon = document.createElement('div');
                    playIcon.style.width = '0';
                    playIcon.style.height = '0';
                    playIcon.style.borderTop = '3px solid transparent';
                    playIcon.style.borderBottom = '3px solid transparent';
                    playIcon.style.borderLeft = '5px solid #ffffff';
                    playIcon.style.position = 'absolute';
                    playIcon.style.left = '50%';
                    playIcon.style.top = '50%';
                    playIcon.style.transform = 'translate(-50%, -50%)';
                    mini.appendChild(playIcon);
                } else if (elem.type === 'shape') {
                    const shapeDef = SHAPES_LIST.find(s => s.id === elem.shapeType) || SHAPES_LIST[0];
                    const fillCol = elem.bgColor || '#3b82f6';
                    const strokeCol = elem.borderColor || '#ffffff';
                    
                    const fillAlpha = elem.bgColor === 'transparent' ? 0 : (elem.bgAlpha !== undefined ? elem.bgAlpha : 1);
                    const strokeW = (elem.borderWidth && elem.borderStyle && elem.borderStyle !== 'none') ? elem.borderWidth : 0;
                    const calculatedStrokeW = strokeW * 16 / Math.max(1, elem.width);
                    
                    const svgElem = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                    svgElem.setAttribute('viewBox', '0 0 16 16');
                    svgElem.setAttribute('width', '100%');
                    svgElem.setAttribute('height', '100%');
                    svgElem.setAttribute('preserveAspectRatio', 'none');
                    svgElem.style.display = 'block';
                    svgElem.style.overflow = 'visible';
                    
                    svgElem.innerHTML = `
                        <g fill="${fillCol}" fill-opacity="${fillAlpha}" stroke="${strokeCol}" stroke-width="${calculatedStrokeW}">
                            ${shapeDef.svg}
                        </g>
                    `;
                    mini.appendChild(svgElem);
                }
                
                if (elem.rotation) {
                    mini.style.transform = `rotate(${elem.rotation}deg)`;
                }
                
                if (elem.visible === false) {
                    mini.style.opacity = '0.35';
                }
                
                preview.appendChild(mini);
            });
        }
    }

    function renderSlideList(slides) {
        const container = document.getElementById('slides-list-container');
        container.innerHTML = '';

        slides.forEach((slide, idx) => {
            const card = document.createElement('div');
            card.className = `slide-card ${slide.id === state.selectedSlideId ? 'active' : ''}`;
            card.setAttribute('data-id', slide.id);
            
            // Build Thumbnail preview
            const preview = document.createElement('div');
            preview.className = 'slide-card-preview';
            card.appendChild(preview);
            
            updateSlideCardPreview(slide, card);

            // Slide Info
            const info = document.createElement('div');
            info.className = 'slide-card-info';
            
            const indexSpan = document.createElement('span');
            indexSpan.className = 'slide-card-index';
            indexSpan.textContent = String(idx + 1).padStart(2, '0');
            info.appendChild(indexSpan);

            const title = document.createElement('div');
            title.className = 'slide-card-title';
            title.textContent = slide.name;
            info.appendChild(title);

            // Card Actions (Duplicate / Delete)
            const actions = document.createElement('div');
            actions.className = 'slide-card-actions';

            const dupBtn = document.createElement('button');
            dupBtn.className = 'slide-action-btn';
            dupBtn.title = "Duplicate Slide";
            dupBtn.innerHTML = '<i data-lucide="copy"></i>';
            dupBtn.onclick = (e) => {
                e.stopPropagation();
                state.duplicateSlide(slide.id);
            };
            actions.appendChild(dupBtn);

            const delBtn = document.createElement('button');
            delBtn.className = 'slide-action-btn delete-btn';
            delBtn.title = "Delete Slide";
            delBtn.innerHTML = '<i data-lucide="trash-2"></i>';
            delBtn.onclick = (e) => {
                e.stopPropagation();
                if (confirm(`Delete slide "${slide.name}"?`)) {
                    state.deleteSlide(slide.id);
                }
            };
            actions.appendChild(delBtn);

            info.appendChild(actions);
            card.appendChild(info);

            // Selection Handler
            card.onclick = () => {
                state.selectSlide(slide.id);
            };

            // Drag and Drop Handlers
            card.setAttribute('draggable', 'true');

            card.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', idx);
                card.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            });

            card.addEventListener('dragend', (e) => {
                card.classList.remove('dragging');
                document.querySelectorAll('.slide-card').forEach(c => {
                    c.classList.remove('drag-over-top');
                    c.classList.remove('drag-over-bottom');
                });
            });

            card.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                
                const rect = card.getBoundingClientRect();
                const relativeY = e.clientY - rect.top;
                if (relativeY < rect.height / 2) {
                    card.classList.add('drag-over-top');
                    card.classList.remove('drag-over-bottom');
                } else {
                    card.classList.add('drag-over-bottom');
                    card.classList.remove('drag-over-top');
                }
            });

            card.addEventListener('dragleave', (e) => {
                card.classList.remove('drag-over-top');
                card.classList.remove('drag-over-bottom');
            });

            card.addEventListener('drop', (e) => {
                e.preventDefault();
                card.classList.remove('drag-over-top');
                card.classList.remove('drag-over-bottom');
                
                const fromIdx = parseInt(e.dataTransfer.getData('text/plain'));
                if (isNaN(fromIdx)) return;
                
                const rect = card.getBoundingClientRect();
                const relativeY = e.clientY - rect.top;
                let toIdx = idx;
                
                if (relativeY >= rect.height / 2) {
                    toIdx = idx + 1;
                }
                
                if (fromIdx < toIdx) {
                    toIdx--;
                }
                
                if (fromIdx !== toIdx) {
                    state.moveSlide(fromIdx, toIdx);
                }
            });

            container.appendChild(card);
        });

        // Initialize newly created icons
        if (window.lucide) lucide.createIcons();
    }

    // ==========================================
    // FORMS FIELD CHANGE EVENT HANDLERS
    // ==========================================

    // Project Name change
    document.getElementById('project-name-input').addEventListener('input', (e) => {
        state.project.name = e.target.value;
        state.markUnsaved();
    });

    // Save/Load toolbar clicks
    document.getElementById('btn-save').onclick = () => {
        state.saveToLocalStorage();
    };
    document.getElementById('btn-export').onclick = () => {
        state.exportToJSON();
    };
    document.getElementById('btn-clear').onclick = () => {
        state.clearProject();
    };
    document.getElementById('btn-undo').onclick = () => {
        state.undo();
    };
    document.getElementById('btn-redo').onclick = () => {
        state.redo();
    };

    // Import modal toggles
    const importModal = document.getElementById('import-modal');
    document.getElementById('btn-import-trigger').onclick = () => {
        importModal.classList.add('active');
        document.getElementById('import-json-textarea').value = '';
    };
    document.getElementById('btn-import-close').onclick = () => importModal.classList.remove('active');
    document.getElementById('btn-import-cancel').onclick = () => importModal.classList.remove('active');
    document.getElementById('btn-import-submit').onclick = () => {
        const text = document.getElementById('import-json-textarea').value;
        if (state.importFromJSON(text)) {
            importModal.classList.remove('active');
        }
    };

    // PRESENT MODE OVERLAYS
    document.getElementById('btn-output').onclick = () => {
        window.PlayerController.start(state.project, state.selectedSlideId);
    };

    document.getElementById('btn-popup-output').onclick = () => {
        const projectorWindow = window.open('output.html', 'ProjectorOutput', 'width=1280,height=720,menubar=no,toolbar=no,location=no,status=no');
        if (projectorWindow) {
            // Trigger a quick project sync broadcast immediately once popup loads
            setTimeout(() => {
                window.PlayerController.broadcastSync();
            }, 1000);
        } else {
            alert("Popup blocker prevented launching the projector window. Please enable popups for this site.");
        }
    };

    // Slide operations
    document.getElementById('btn-add-slide').onclick = () => {
        state.addSlide();
    };

    // Slide properties inputs
    document.getElementById('slide-name-input').addEventListener('input', (e) => {
        state.updateSlideSettings({ name: e.target.value });
    });

    document.getElementById('slide-transition').addEventListener('change', (e) => {
        state.updateSlideSettings({ transition: e.target.value });
        updateTransitionIcon(e.target.value);
    });

    document.getElementById('slide-bg-type').addEventListener('change', (e) => {
        const type = e.target.value;
        state.updateSlideSettings({
            background: {
                ...state.getActiveSlide().background,
                type: type
            }
        });
        toggleBackgroundOptionFields(type);
    });

    // Background color hex links
    bindColorPickerPair('slide-bg-color', 'slide-bg-color-hex', (val) => {
        state.updateSlideSettings({ background: { ...state.getActiveSlide().background, color: val } });
    });
    bindColorPickerPair('slide-bg-grad-1', 'slide-bg-grad-1-hex', (val) => {
        state.updateSlideSettings({ background: { ...state.getActiveSlide().background, gradientStart: val } });
    });
    bindColorPickerPair('slide-bg-grad-2', 'slide-bg-grad-2-hex', (val) => {
        state.updateSlideSettings({ background: { ...state.getActiveSlide().background, gradientEnd: val } });
    });
    document.getElementById('slide-bg-grad-angle').addEventListener('input', (e) => {
        state.updateSlideSettings({
            background: {
                ...state.getActiveSlide().background,
                gradientAngle: parseInt(e.target.value) || 135
            }
        });
    });

    // BG Image URLs loaders
    document.getElementById('btn-upload-bg-url').onclick = () => {
        const url = document.getElementById('slide-bg-image-url').value.trim();
        if (url) {
            const isImageExtension = /\.(jpg|jpeg|png|webp|gif|svg|bmp)(\?.*)?$/i.test(url) || url.startsWith('data:image/');
            if (!isImageExtension) {
                const proceed = confirm("This URL does not appear to end with a standard image file extension (.jpg, .png, .webp, etc.).\n\nWebpage links cannot be displayed as background images. Make sure this is a direct link to a raw image file.\n\nDo you want to use this URL anyway?");
                if (!proceed) return;
            }
            state.updateSlideSettings({
                background: {
                    ...state.getActiveSlide().background,
                    imageUrl: url
                }
            });
        }
    };

    // Background upload file reader
    document.getElementById('slide-bg-image-file').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const labelSpan = e.target.parentElement.querySelector('span');
            uploadFile(file, labelSpan, (url) => {
                state.updateSlideSettings({
                    background: {
                        ...state.getActiveSlide().background,
                        type: 'image',
                        imageUrl: url
                    }
                });
                document.getElementById('slide-bg-type').value = 'image';
                toggleBackgroundOptionFields('image');
                
                // Update the text input field in the sidebar
                const bgUrlInput = document.getElementById('slide-bg-image-url');
                if (bgUrlInput) {
                    bgUrlInput.value = url;
                }
                
                // Force redraw of canvas slide background
                const activeSlide = state.getActiveSlide();
                if (activeSlide && window.editorCanvas) {
                    window.editorCanvas.renderSlide(activeSlide);
                }
            });
        }
    });



    // ==========================================
    // WORKSPACE TOOLBAR BUTTONS: ADD ELEMENTS
    // ==========================================
    
    document.querySelectorAll('.btn-element-add').forEach(btn => {
        btn.onclick = () => {
            const type = btn.getAttribute('data-type');
            state.addElement(type);
        };
    });

    // ==========================================
    // INSPECTOR ELEMENT INPUT EVENT HANDLERS
    // ==========================================

    const updateActiveElem = (props) => {
        const selectedIds = state.selectedElementIds || [];
        if (selectedIds.length > 0) {
            const slide = state.getActiveSlide();
            if (!slide) return;
            selectedIds.forEach(id => {
                const elem = slide.elements.find(e => e.id === id);
                if (elem) {
                    const filteredProps = {};
                    const textAndBoxKeys = [
                        'text', 'fontFamily', 'fontSize', 'align', 'textColor', 
                        'bgColor', 'bgAlpha', 'borderRadius', 'borderWidth', 
                        'borderStyle', 'borderColor', 'useMarkupColor', 'markupColor',
                        'fontWeight', 'isBold', 'isItalic', 'isUnderline', 'isUppercase', 'isStrikethrough',
                        'lineHeight', 'letterSpacing'
                    ];
                    
                    for (const key in props) {
                        const isStyleableElement = elem.type === 'text' || elem.type.startsWith('btn-') || elem.type === 'timer' || elem.type === 'shape';
                        const isAllowedTextKey = isStyleableElement && textAndBoxKeys.includes(key);
                        
                        if (elem[key] !== undefined || isAllowedTextKey || key === 'rotation' || key === 'shapeType') {
                            filteredProps[key] = props[key];
                        }
                    }
                    if (Object.keys(filteredProps).length > 0) {
                        state.updateElement(id, filteredProps);
                    }
                }
            });
        }
    };

    const updateActiveElemAndSave = (props) => {
        updateActiveElem(props);
    };

    // Text Content Area
    document.getElementById('elem-text').addEventListener('input', (e) => {
        updateActiveElem({ text: e.target.value });
    });

    // ==========================================
    // STUDIO PRO GEOMETRY MATRIX (X, Y, W, H + LOCK + SCRUB + MATH)
    // ==========================================
    function initGeometryMatrix() {
        const inputX = document.getElementById('elem-x');
        const inputY = document.getElementById('elem-y');
        const inputW = document.getElementById('elem-w');
        const inputH = document.getElementById('elem-h');

        const badgeX = document.getElementById('badge-geo-x');
        const badgeY = document.getElementById('badge-geo-y');
        const badgeW = document.getElementById('badge-geo-w');
        const badgeH = document.getElementById('badge-geo-h');

        const btnLock = document.getElementById('btn-aspect-ratio-lock');
        let isAspectLocked = false;

        if (!inputX || !inputY || !inputW || !inputH) return;

        function evaluateMathExpression(str, currentVal) {
            if (!str) return currentVal;
            let clean = String(str).trim();
            // Support relative expressions like +20, -50, *2, /2
            if (/^[+\-*/]/.test(clean)) {
                clean = `${currentVal}${clean}`;
            }
            // Only allow digits, +, -, *, /, (, ), ., and spaces for safety
            if (!/^[0-9+\-*/().\s]+$/.test(clean)) {
                const num = parseFloat(clean);
                return isNaN(num) ? currentVal : Math.round(num);
            }
            try {
                const result = Function(`'use strict'; return (${clean})`)();
                if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
                    return Math.round(result);
                }
            } catch (e) {
                // Fallback
            }
            const num = parseFloat(clean);
            return isNaN(num) ? currentVal : Math.round(num);
        }

        // Toggle Aspect Ratio Lock
        btnLock?.addEventListener('click', () => {
            isAspectLocked = !isAspectLocked;
            btnLock.classList.toggle('locked', isAspectLocked);
            btnLock.innerHTML = `<i data-lucide="${isAspectLocked ? 'lock' : 'unlock'}" class="lock-icon" id="icon-aspect-ratio-lock"></i>`;
            if (window.lucide) lucide.createIcons();

            const activeElem = state.getActiveElement ? state.getActiveElement() : null;
            if (activeElem) {
                updateActiveElem({ aspectRatioLocked: isAspectLocked });
            }
        });

        // Input commit handler for Enter and Blur
        function handleInputCommit(inputEl, key, minVal = null) {
            const raw = inputEl.value.trim();
            const activeElem = state.getActiveElement ? state.getActiveElement() : null;
            const curVal = activeElem ? (activeElem[key] !== undefined ? activeElem[key] : (parseFloat(raw) || 0)) : (parseFloat(raw) || 0);
            let evaluated = evaluateMathExpression(raw, curVal);
            if (minVal !== null) {
                evaluated = Math.max(minVal, evaluated);
            }
            inputEl.value = evaluated;

            state.pushHistory();
            const updates = { [key]: evaluated };

            // Aspect ratio constraint
            if (isAspectLocked && activeElem && (key === 'width' || key === 'height')) {
                const ratio = (activeElem.width || 1) / (activeElem.height || 1);
                if (key === 'width' && ratio > 0) {
                    const newH = Math.max(10, Math.round(evaluated / ratio));
                    updates.height = newH;
                    if (inputH) inputH.value = newH;
                } else if (key === 'height' && ratio > 0) {
                    const newW = Math.max(10, Math.round(evaluated * ratio));
                    updates.width = newW;
                    if (inputW) inputW.value = newW;
                }
            }

            updateActiveElemAndSave(updates);
            const slide = state.getActiveSlide();
            if (slide) canvas.renderSlide(slide);
        }

        // Realtime typing handler
        function handleInputLive(inputEl, key, minVal = null) {
            const raw = inputEl.value.trim();
            // If typing math expression operators, wait for commit
            if (/[+\-*/]/.test(raw)) return;

            const val = parseInt(raw);
            if (isNaN(val)) return;

            const activeElem = state.getActiveElement ? state.getActiveElement() : null;
            let clamped = minVal !== null ? Math.max(minVal, val) : val;
            const updates = { [key]: clamped };

            if (isAspectLocked && activeElem && (key === 'width' || key === 'height')) {
                const ratio = (activeElem.width || 1) / (activeElem.height || 1);
                if (key === 'width' && ratio > 0) {
                    const newH = Math.max(10, Math.round(clamped / ratio));
                    updates.height = newH;
                    if (inputH) inputH.value = newH;
                } else if (key === 'height' && ratio > 0) {
                    const newW = Math.max(10, Math.round(clamped * ratio));
                    updates.width = newW;
                    if (inputW) inputW.value = newW;
                }
            }

            updateActiveElem(updates);
            const slide = state.getActiveSlide();
            if (slide) canvas.renderSlide(slide);
        }

        const setupInputField = (inputEl, key, minVal = null) => {
            if (!inputEl) return;
            inputEl.addEventListener('input', () => handleInputLive(inputEl, key, minVal));
            inputEl.addEventListener('blur', () => handleInputCommit(inputEl, key, minVal));
            inputEl.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    handleInputCommit(inputEl, key, minVal);
                    inputEl.blur();
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    const step = e.shiftKey ? 10 : 1;
                    const cur = parseInt(inputEl.value) || 0;
                    inputEl.value = cur + step;
                    handleInputCommit(inputEl, key, minVal);
                } else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    const step = e.shiftKey ? 10 : 1;
                    const cur = parseInt(inputEl.value) || 0;
                    inputEl.value = cur - step;
                    handleInputCommit(inputEl, key, minVal);
                }
            });
        };

        setupInputField(inputX, 'x');
        setupInputField(inputY, 'y');
        setupInputField(inputW, 'width', 10);
        setupInputField(inputH, 'height', 10);

        // Tactile Badge Scrubbing
        function setupBadgeScrub(badgeEl, inputEl, key, minVal = null) {
            if (!badgeEl || !inputEl) return;
            let startX = 0;
            let startVal = 0;
            let isScrubbing = false;

            badgeEl.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                startX = e.clientX;
                const activeElem = state.getActiveElement ? state.getActiveElement() : null;
                startVal = activeElem ? (activeElem[key] !== undefined ? activeElem[key] : (parseInt(inputEl.value) || 0)) : (parseInt(inputEl.value) || 0);
                isScrubbing = false;
                badgeEl.setPointerCapture(e.pointerId);
                badgeEl.classList.add('scrubbing');

                const onPointerMove = (ev) => {
                    const dx = ev.clientX - startX;
                    if (!isScrubbing && Math.abs(dx) > 2) {
                        isScrubbing = true;
                        state.pushHistory();
                    }
                    if (isScrubbing) {
                        let step = ev.altKey ? 0.5 : (ev.shiftKey ? 10 : 1);
                        let delta = Math.round(dx * step);
                        let newVal = startVal + delta;
                        if (minVal !== null) {
                            newVal = Math.max(minVal, newVal);
                        }
                        inputEl.value = newVal;
                        const updates = { [key]: newVal };

                        if (isAspectLocked && activeElem && (key === 'width' || key === 'height')) {
                            const ratio = (activeElem.width || 1) / (activeElem.height || 1);
                            if (key === 'width' && ratio > 0) {
                                const newH = Math.max(10, Math.round(newVal / ratio));
                                updates.height = newH;
                                if (inputH) inputH.value = newH;
                            } else if (key === 'height' && ratio > 0) {
                                const newW = Math.max(10, Math.round(newVal * ratio));
                                updates.width = newW;
                                if (inputW) inputW.value = newW;
                            }
                        }

                        updateActiveElem(updates);
                        const slide = state.getActiveSlide();
                        if (slide) canvas.renderSlide(slide);
                    }
                };

                const onPointerUp = (ev) => {
                    badgeEl.removeEventListener('pointermove', onPointerMove);
                    badgeEl.removeEventListener('pointerup', onPointerUp);
                    badgeEl.removeEventListener('pointercancel', onPointerUp);
                    badgeEl.classList.remove('scrubbing');
                    if (isScrubbing) {
                        const finalVal = parseInt(inputEl.value) || 0;
                        const finalUpdates = { [key]: finalVal };
                        if (isAspectLocked && activeElem && (key === 'width' || key === 'height')) {
                            const ratio = (activeElem.width || 1) / (activeElem.height || 1);
                            if (key === 'width' && ratio > 0) {
                                finalUpdates.height = Math.max(10, Math.round(finalVal / ratio));
                            } else if (key === 'height' && ratio > 0) {
                                finalUpdates.width = Math.max(10, Math.round(finalVal * ratio));
                            }
                        }
                        updateActiveElemAndSave(finalUpdates);
                    }
                };

                badgeEl.addEventListener('pointermove', onPointerMove);
                badgeEl.addEventListener('pointerup', onPointerUp);
                badgeEl.addEventListener('pointercancel', onPointerUp);
            });
        }

        setupBadgeScrub(badgeX, inputX, 'x');
        setupBadgeScrub(badgeY, inputY, 'y');
        setupBadgeScrub(badgeW, inputW, 'width', 10);
        setupBadgeScrub(badgeH, inputH, 'height', 10);

        // Global Sync Function
        window.syncGeometryMatrixUI = function(element) {
            if (!element) return;
            if (document.activeElement !== inputX) inputX.value = element.x !== undefined ? element.x : 0;
            if (document.activeElement !== inputY) inputY.value = element.y !== undefined ? element.y : 0;
            if (document.activeElement !== inputW) inputW.value = element.width !== undefined ? element.width : 100;
            if (document.activeElement !== inputH) inputH.value = element.height !== undefined ? element.height : 100;

            isAspectLocked = !!element.aspectRatioLocked;
            if (btnLock) {
                btnLock.classList.toggle('locked', isAspectLocked);
                btnLock.innerHTML = `<i data-lucide="${isAspectLocked ? 'lock' : 'unlock'}" class="lock-icon" id="icon-aspect-ratio-lock"></i>`;
                if (window.lucide) lucide.createIcons();
            }
        };
    }

    initGeometryMatrix();
    // ==========================================
    // STUDIO ROTATION WIDGET (DIAL + SCRUB + 90°)
    // ==========================================
    function initRotationWidget() {
        const rotationDial = document.getElementById('rotation-radial-dial');
        const needle = document.getElementById('rotation-dial-needle');
        const dialArc = document.getElementById('rotation-dial-arc');
        const scrubWrapper = document.getElementById('rotation-scrub-wrapper');
        const rotInput = document.getElementById('elem-rotation');
        const rotSlider = document.getElementById('elem-rotation-slider');
        const btnCcw = document.getElementById('btn-rot-step-ccw');
        const btnCw = document.getElementById('btn-rot-step-cw');
        const btnReset = document.getElementById('btn-rot-reset');

        if (!rotationDial || !rotInput) return;

        function updateArcPath(deg) {
            if (!dialArc) return;
            const r = 18;
            const cx = 22;
            const cy = 22;
            
            if (deg <= 0.5 || deg >= 359.5) {
                dialArc.setAttribute('d', '');
                return;
            }

            const rad = (deg - 90) * Math.PI / 180;
            const x = cx + r * Math.cos(rad);
            const y = cy + r * Math.sin(rad);
            const largeArcFlag = deg > 180 ? 1 : 0;

            // Arc starting from top (22, 4) to (x, y)
            dialArc.setAttribute('d', `M 22 4 A ${r} ${r} 0 ${largeArcFlag} 1 ${x.toFixed(2)} ${y.toFixed(2)}`);
        }

        window.syncRotationUI = function(angle, emitState = false) {
            let normalized = Math.round(angle) % 360;
            if (normalized < 0) normalized += 360;

            // Only update text value if user isn't actively typing
            if (document.activeElement !== rotInput) {
                rotInput.value = `${normalized}°`;
            }
            if (rotSlider) rotSlider.value = normalized;
            if (needle) needle.style.transform = `rotate(${normalized}deg)`;
            updateArcPath(normalized);

            if (emitState) {
                updateActiveElem({ rotation: normalized });
            }
        };

        // --- 1. RADIAL DIAL POINTER DRAG ---
        let isDraggingDial = false;

        function calculateAngleFromPointer(e) {
            const rect = rotationDial.getBoundingClientRect();
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;
            const dx = e.clientX - cx;
            const dy = e.clientY - cy;
            let rad = Math.atan2(dy, dx);
            let deg = (rad * 180 / Math.PI) + 90;
            if (deg < 0) deg += 360;

            // Magnetic Snapping: 15° with Shift or near cardinal angles
            if (e.shiftKey) {
                deg = Math.round(deg / 15) * 15 % 360;
            } else {
                const cardinals = [0, 90, 180, 270, 360];
                for (const c of cardinals) {
                    if (Math.abs(deg - c) <= 4 || (c === 360 && deg <= 4)) {
                        deg = c % 360;
                        break;
                    }
                }
            }
            return deg;
        }

        rotationDial.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            isDraggingDial = true;
            rotationDial.setPointerCapture(e.pointerId);
            rotationDial.classList.add('dragging');
            state.pushHistory();

            const deg = calculateAngleFromPointer(e);
            window.syncRotationUI(deg, true);
        });

        rotationDial.addEventListener('pointermove', (e) => {
            if (!isDraggingDial) return;
            e.preventDefault();
            const deg = calculateAngleFromPointer(e);
            window.syncRotationUI(deg, true);
        });

        const stopDialDrag = (e) => {
            if (!isDraggingDial) return;
            isDraggingDial = false;
            rotationDial.classList.remove('dragging');
            try { rotationDial.releasePointerCapture(e.pointerId); } catch(err) {}
        };

        rotationDial.addEventListener('pointerup', stopDialDrag);
        rotationDial.addEventListener('pointercancel', stopDialDrag);

        // --- 2. HORIZONTAL SCRUBBABLE INPUT BADGE ---
        let isScrubbing = false;
        let scrubStartX = 0;
        let scrubStartAngle = 0;
        let hasMoved = false;

        scrubWrapper?.addEventListener('pointerdown', (e) => {
            if (e.target === rotInput && document.activeElement === rotInput) return;

            scrubStartX = e.clientX;
            scrubStartAngle = parseFloat(rotInput.value.replace('°', '')) || 0;
            hasMoved = false;
            isScrubbing = false;

            const onPointerMove = (moveEv) => {
                const dx = moveEv.clientX - scrubStartX;
                if (!isScrubbing && Math.abs(dx) > 3) {
                    isScrubbing = true;
                    hasMoved = true;
                    scrubWrapper.classList.add('scrubbing');
                    state.pushHistory();
                }

                if (isScrubbing) {
                    moveEv.preventDefault();
                    let step = moveEv.altKey ? 0.2 : 0.5; // 1° per 2px
                    let newAngle = (scrubStartAngle + dx * step) % 360;
                    if (newAngle < 0) newAngle += 360;
                    if (moveEv.shiftKey) {
                        newAngle = Math.round(newAngle / 15) * 15 % 360;
                    }
                    window.syncRotationUI(newAngle, true);
                }
            };

            const onPointerUp = (upEv) => {
                window.removeEventListener('pointermove', onPointerMove);
                window.removeEventListener('pointerup', onPointerUp);
                window.removeEventListener('pointercancel', onPointerUp);

                if (isScrubbing) {
                    isScrubbing = false;
                    scrubWrapper.classList.remove('scrubbing');
                    upEv.preventDefault();
                    upEv.stopPropagation();
                } else if (!hasMoved && e.target === rotInput) {
                    rotInput.focus();
                }
            };

            window.addEventListener('pointermove', onPointerMove);
            window.addEventListener('pointerup', onPointerUp);
            window.addEventListener('pointercancel', onPointerUp);
        });

        // --- 3. INPUT FOCUS / TYPING BEHAVIOR ---
        rotInput.addEventListener('focus', () => {
            rotInput.value = rotInput.value.replace('°', '').trim();
            rotInput.select();
        });

        rotInput.addEventListener('input', () => {
            const raw = rotInput.value.replace('°', '').trim();
            const parsed = parseFloat(raw);
            if (!isNaN(parsed)) {
                let norm = Math.round(parsed) % 360;
                if (norm < 0) norm += 360;
                if (rotSlider) rotSlider.value = norm;
                if (needle) needle.style.transform = `rotate(${norm}deg)`;
                updateArcPath(norm);
                updateActiveElem({ rotation: norm });
            }
        });

        rotInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                rotInput.blur();
            } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                e.preventDefault();
                state.pushHistory();
                const cur = parseFloat(rotInput.value.replace('°', '')) || 0;
                const step = e.shiftKey ? 15 : 1;
                let next = e.key === 'ArrowUp' ? (cur + step) : (cur - step);
                next = next % 360;
                if (next < 0) next += 360;
                rotInput.value = next;
                window.syncRotationUI(next, true);
            }
        });

        rotInput.addEventListener('blur', () => {
            const parsed = parseFloat(rotInput.value.replace('°', '')) || 0;
            let norm = Math.round(parsed) % 360;
            if (norm < 0) norm += 360;
            state.pushHistory();
            window.syncRotationUI(norm, true);
        });

        // --- 4. QUICK TURN (-90° / +90°) & RESET (0°) BUTTONS ---
        btnCcw?.addEventListener('click', () => {
            state.pushHistory();
            const cur = parseFloat(rotInput.value.replace('°', '')) || 0;
            let next = (Math.round(cur) - 90) % 360;
            if (next < 0) next += 360;
            window.syncRotationUI(next, true);
        });

        btnCw?.addEventListener('click', () => {
            state.pushHistory();
            const cur = parseFloat(rotInput.value.replace('°', '')) || 0;
            let next = (Math.round(cur) + 90) % 360;
            window.syncRotationUI(next, true);
        });

        btnReset?.addEventListener('click', () => {
            state.pushHistory();
            window.syncRotationUI(0, true);
        });

        // Slider fallback
        rotSlider?.addEventListener('input', (e) => {
            window.syncRotationUI(parseInt(e.target.value) || 0, true);
        });
    }

    initRotationWidget();
    document.getElementById('elem-visible').addEventListener('change', (e) => {
        state.pushHistory();
        updateActiveElemAndSave({ visible: e.target.checked });
        const activeSlide = state.getActiveSlide();
        if (activeSlide) {
            canvas.renderSlide(activeSlide);
        }
    });

    // Populate Custom Shape Select Dropdown options
    const shapeOptionsDropdown = document.getElementById('shape-options-dropdown');
    const shapeSelectTrigger = document.getElementById('shape-select-trigger');
    const shapeSelectWrapper = document.getElementById('shape-select-wrapper');
    if (shapeOptionsDropdown && shapeSelectTrigger) {
        const selectedShapePreview = shapeSelectTrigger.querySelector('.selected-shape-preview');
        const selectedShapeName = shapeSelectTrigger.querySelector('.selected-shape-name');

        // Build items
        shapeOptionsDropdown.innerHTML = '';
        SHAPES_LIST.forEach(shape => {
            const opt = document.createElement('div');
            opt.className = 'custom-option';
            opt.dataset.value = shape.id;
            opt.innerHTML = `
                <svg viewBox="0 0 16 16">${shape.svg}</svg>
                <span>${shape.name}</span>
            `;
            opt.onclick = (e) => {
                e.stopPropagation();
                // Update trigger visual state
                selectedShapePreview.innerHTML = `<svg viewBox="0 0 16 16">${shape.svg}</svg>`;
                selectedShapeName.textContent = shape.name;
                
                // Close dropdown
                shapeSelectWrapper.classList.remove('open');
                
                // Trigger property update
                state.pushHistory();
                updateActiveElemAndSave({ shapeType: shape.id });
                
                const activeSlide = state.getActiveSlide();
                if (activeSlide) {
                    canvas.renderSlide(activeSlide);
                }
            };
            shapeOptionsDropdown.appendChild(opt);
        });

        // Toggle open/close
        shapeSelectTrigger.onclick = (e) => {
            e.stopPropagation();
            shapeSelectWrapper.classList.toggle('open');
        };

        // Close on click outside
        window.addEventListener('click', () => {
            shapeSelectWrapper.classList.remove('open');
        });
    }

    // Font family dropdowns
    document.getElementById('elem-font-family').addEventListener('change', (e) => {
        updateActiveElemAndSave({ fontFamily: e.target.value });
    });
    document.getElementById('elem-font-size').addEventListener('input', (e) => {
        updateActiveElem({ fontSize: parseInt(e.target.value) || 16 });
    });
    document.getElementById('elem-align').addEventListener('change', (e) => {
        updateActiveElemAndSave({ align: e.target.value });
    });
    bindColorPickerPair('elem-text-color', 'elem-text-color-hex', (val) => {
        updateActiveElem({ textColor: val });
    });

    // Element BG Box attributes
    bindColorPickerPair('elem-bg-color', 'elem-bg-color-hex', (val) => {
        updateActiveElem({ bgColor: val });
    });
    document.getElementById('elem-bg-alpha').addEventListener('input', (e) => {
        updateActiveElem({ bgAlpha: parseFloat(e.target.value) });
    });
    document.getElementById('elem-border-radius').addEventListener('input', (e) => {
        updateActiveElem({ borderRadius: parseInt(e.target.value) || 0 });
    });
    document.getElementById('elem-border-width').addEventListener('input', (e) => {
        updateActiveElem({ borderWidth: parseInt(e.target.value) || 0 });
    });
    document.getElementById('elem-border-style').addEventListener('change', (e) => {
        updateActiveElemAndSave({ borderStyle: e.target.value });
    });
    bindColorPickerPair('elem-border-color', 'elem-border-color-hex', (val) => {
        updateActiveElem({ borderColor: val });
    });

    // Image URL elements
    document.getElementById('btn-upload-elem-url').onclick = () => {
        const url = document.getElementById('elem-image-url').value.trim();
        if (url) {
            const isImageExtension = /\.(jpg|jpeg|png|webp|gif|svg|bmp)(\?.*)?$/i.test(url) || url.startsWith('data:image/');
            if (!isImageExtension) {
                const proceed = confirm("This URL does not appear to end with a standard image file extension (.jpg, .png, .webp, etc.).\n\nWebpage links cannot be displayed as images. Make sure this is a direct link to a raw image file.\n\nDo you want to use this URL anyway?");
                if (!proceed) return;
            }
            updateActiveElemAndSave({ url: url, fileData: null });
        }
    };
    document.getElementById('elem-image-file').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const labelSpan = e.target.parentElement.querySelector('span');
            uploadFile(file, labelSpan, (url) => {
                updateActiveElemAndSave({ url: url, fileData: null });
                
                // Update the text input field in the sidebar
                const elemUrlInput = document.getElementById('elem-image-url');
                if (elemUrlInput) {
                    elemUrlInput.value = url;
                }
            });
        }
    });

    // Video elements
    document.getElementById('elem-video-url').addEventListener('input', (e) => {
        const val = e.target.value;
        updateActiveElemAndSave({ url: val, fileData: null });
        
        const statusText = document.getElementById('video-status-text');
        const fileLabel = document.getElementById('video-file-label');
        if (val) {
            if (statusText) {
                statusText.textContent = "Video loaded via URL";
                statusText.style.color = "#3b82f6";
            }
            if (fileLabel) fileLabel.textContent = "Choose file...";
        } else {
            if (statusText) {
                statusText.textContent = "No video file loaded";
                statusText.style.color = "var(--text-muted)";
            }
            if (fileLabel) fileLabel.textContent = "Choose file...";
        }
    });

    document.getElementById('btn-upload-video-url').onclick = () => {
        const url = document.getElementById('elem-video-url').value;
        updateActiveElemAndSave({ url: url, fileData: null });
        
        const statusText = document.getElementById('video-status-text');
        const fileLabel = document.getElementById('video-file-label');
        if (url) {
            if (statusText) {
                statusText.textContent = "Video loaded via URL";
                statusText.style.color = "#3b82f6";
            }
            if (fileLabel) fileLabel.textContent = "Choose file...";
        } else {
            if (statusText) {
                statusText.textContent = "No video file loaded";
                statusText.style.color = "var(--text-muted)";
            }
            if (fileLabel) fileLabel.textContent = "Choose file...";
        }
    };

    document.getElementById('elem-video-file').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const statusText = document.getElementById('video-status-text');
            uploadFile(file, statusText, (url) => {
                updateActiveElemAndSave({ url: url, fileData: null });
                const fileLabel = document.getElementById('video-file-label');
                if (fileLabel) {
                    fileLabel.textContent = "Replace video file...";
                }
                document.getElementById('elem-video-url').value = url;
            });
        }
    });

    document.getElementById('elem-video-autoplay').addEventListener('change', (e) => {
        updateActiveElemAndSave({ autoplay: e.target.checked });
    });
    document.getElementById('elem-video-loop').addEventListener('change', (e) => {
        updateActiveElemAndSave({ loop: e.target.checked });
    });
    document.getElementById('elem-video-muted').addEventListener('change', (e) => {
        updateActiveElemAndSave({ muted: e.target.checked });
    });
    document.getElementById('elem-video-volume').addEventListener('input', (e) => {
        updateActiveElem({ volume: parseFloat(e.target.value) });
    });

    document.getElementById('btn-video-preview-play').addEventListener('click', () => {
        const selectedId = state.selectedElementId;
        if (!selectedId) return;
        
        // Target YouTube iframe
        const iframe = document.querySelector(`.html-video-overlay[data-element-id="${selectedId}"] iframe`);
        if (iframe) {
            iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'playVideo' }), '*');
        }
        
        // Target HTML5 video
        const video = document.querySelector(`.html-video-overlay[data-element-id="${selectedId}"] video`);
        if (video) {
            video.play().catch(e => console.error("Video play failed:", e));
        }
    });

    document.getElementById('btn-video-preview-pause').addEventListener('click', () => {
        const selectedId = state.selectedElementId;
        if (!selectedId) return;
        
        // Target YouTube iframe
        const iframe = document.querySelector(`.html-video-overlay[data-element-id="${selectedId}"] iframe`);
        if (iframe) {
            iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'pauseVideo' }), '*');
        }
        
        // Target HTML5 video
        const video = document.querySelector(`.html-video-overlay[data-element-id="${selectedId}"] video`);
        if (video) {
            video.pause();
        }
    });


    // MCQ option buttons
    document.getElementById('elem-option-correct').addEventListener('change', (e) => {
        updateActiveElemAndSave({ isCorrect: e.target.checked });
    });
    document.getElementById('elem-option-group').addEventListener('input', (e) => {
        updateActiveElem({ group: e.target.value });
    });

    // Timers dropdown and parameters
    document.getElementById('elem-timer-duration').addEventListener('input', (e) => {
        updateActiveElem({ duration: parseInt(e.target.value) || 30, text: e.target.value });
    });

    document.getElementById('btn-add-timer-action').onclick = () => {
        const activeElem = state.getActiveElement();
        if (activeElem && activeElem.type === 'timer') {
            if (!activeElem.actions) activeElem.actions = [];
            activeElem.actions.push({
                id: 'act-' + Math.random().toString(36).substring(2, 11),
                type: 'show-answer',
                targetId: ''
            });
            state.updateElement(activeElem.id, { actions: activeElem.actions });
            renderTimerActions(activeElem);
        }
    };

    // Buttons target parameters dropdown linkers
    document.getElementById('elem-nav-target').addEventListener('change', (e) => {
        updateActiveElemAndSave({ targetSlideId: e.target.value });
    });
    document.getElementById('elem-show-ans-target').addEventListener('change', (e) => {
        updateActiveElemAndSave({ targetElementId: e.target.value });
    });
    document.getElementById('btn-add-toggle-action').onclick = () => {
        const activeElem = state.getActiveElement();
        if (activeElem && (activeElem.type === 'btn-toggle' || activeElem.type === 'btn-option')) {
            if (!activeElem.actions) activeElem.actions = [];
            activeElem.actions.push({
                id: 'act-' + Math.random().toString(36).substring(2, 11),
                type: 'toggle',
                targetId: ''
            });
            state.updateElement(activeElem.id, { actions: activeElem.actions });
            renderToggleActions(activeElem);
        }
    };
    // Button markup settings change handlers
    document.getElementById('elem-use-markup').addEventListener('change', (e) => {
        const checked = e.target.checked;
        state.pushHistory();
        updateActiveElemAndSave({ useMarkupColor: checked });
        
        if (checked) {
            document.getElementById('field-markup-color').classList.remove('hidden');
        } else {
            document.getElementById('field-markup-color').classList.add('hidden');
        }
    });

    bindColorPickerPair('elem-markup-color', 'elem-markup-color-hex', (val) => {
        updateActiveElem({ markupColor: val });
    });

    // Layer orders (Front/Back)
    document.getElementById('btn-elem-copy').onclick = () => {
        state.copyElements();
    };
    document.getElementById('btn-copy-elements').onclick = () => {
        state.copyElements();
    };
    document.getElementById('btn-paste-elements').onclick = () => {
        state.pasteElements();
    };
    document.getElementById('btn-elem-bring-front').onclick = () => {
        if (state.selectedElementId) state.moveElementZIndex(state.selectedElementId, 'bring-front');
    };
    document.getElementById('btn-elem-send-back').onclick = () => {
        if (state.selectedElementId) state.moveElementZIndex(state.selectedElementId, 'send-back');
    };
    document.getElementById('btn-elem-delete').onclick = () => {
        const selectedIds = state.selectedElementIds || [];
        if (selectedIds.length > 0) {
            if (confirm(`Are you sure you want to delete the ${selectedIds.length} selected element(s)?`)) {
                state.deleteElements(selectedIds);
            }
        }
    };

    // ==========================================
    // ZOOM VIEWPORT TOOLBAR CONTROLS
    // ==========================================
    
    let currentZoom = 1.0;
    
    canvas.onZoomChange = (newZoom) => {
        currentZoom = newZoom;
        document.getElementById('zoom-percentage').textContent = `${Math.round(currentZoom * 100)}%`;
        if (typeof window.updateFloatingMiniInspectorPosition === 'function') {
            window.updateFloatingMiniInspectorPosition();
        }
    };

    // Initialize display from canvas initial state
    canvas.onZoomChange(canvas.zoom);
    
    const updateZoomDisplay = () => {
        canvas.setZoom(currentZoom);
    };

    document.getElementById('btn-zoom-in').onclick = () => {
        currentZoom = Math.min(2.0, currentZoom + 0.1);
        updateZoomDisplay();
    };

    document.getElementById('btn-zoom-out').onclick = () => {
        currentZoom = Math.max(0.5, currentZoom - 0.1);
        updateZoomDisplay();
    };

    document.getElementById('btn-zoom-fit').onclick = () => {
        canvas.resize();
    };

    document.getElementById('btn-toggle-grid').onclick = (e) => {
        const active = !canvas.snapToGrid;
        canvas.snapToGrid = active;
        
        const btn = document.getElementById('btn-toggle-grid');
        if (active) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    };

    // ==========================================
    // LAYERS PALETTE DRAG/TOGGLE HANDLERS
    // ==========================================

    document.getElementById('btn-toggle-layers').onclick = () => {
        const panel = document.getElementById('layers-panel');
        panel.classList.toggle('minimized');
        
        const btn = document.getElementById('btn-toggle-layers');
        if (panel.classList.contains('minimized')) {
            btn.innerHTML = '<i data-lucide="chevron-up"></i>';
        } else {
            btn.innerHTML = '<i data-lucide="chevron-down"></i>';
        }
        if (window.lucide) lucide.createIcons();
    };

    function rebuildLayersPanel(slide) {
        const container = document.getElementById('layers-list-container');
        container.innerHTML = '';

        if (!slide || slide.elements.length === 0) {
            container.innerHTML = '<div class="empty-state" style="height:60px;padding:10px;"><p style="font-size:0.7rem;">No elements</p></div>';
            return;
        }

        // Render elements sorted top-to-bottom (z-index descending)
        const sorted = [...slide.elements].sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0));

        sorted.forEach(elem => {
            const item = document.createElement('div');
            const isActive = (state.selectedElementIds || []).includes(elem.id);
            item.className = `layer-item ${isActive ? 'active' : ''}`;
            item.setAttribute('data-id', elem.id);
            
            const nameGroup = document.createElement('div');
            nameGroup.className = 'layer-name-group';
            
            // Icon according to element type
            let iconName = 'type';
            if (elem.type === 'image') iconName = 'image';
            else if (elem.type === 'video') iconName = 'video';
            else if (elem.type === 'timer') iconName = 'timer';
            else if (elem.type.startsWith('btn-')) iconName = 'mouse-pointer';

            nameGroup.innerHTML = `<i data-lucide="${iconName}"></i> <span>${elem.type.toUpperCase()}</span>`;
            item.appendChild(nameGroup);

            // Controls (Hide / Delete)
            const controls = document.createElement('div');
            controls.className = 'layer-controls';

            const delBtn = document.createElement('button');
            delBtn.className = 'layer-btn';
            delBtn.innerHTML = '<i data-lucide="trash-2"></i>';
            delBtn.onclick = (e) => {
                e.stopPropagation();
                if (confirm("Delete element?")) {
                    state.deleteElement(elem.id);
                }
            };
            controls.appendChild(delBtn);
            item.appendChild(controls);

            // Clicking layer selects element
            item.onclick = (e) => {
                const isCtrl = e.ctrlKey || e.metaKey;
                state.selectElement(elem.id, isCtrl);
            };

            container.appendChild(item);
        });

        if (window.lucide) lucide.createIcons();
    }

    function highlightActiveLayer() {
        const items = document.querySelectorAll('.layer-item');
        const selectedIds = state.selectedElementIds || [];
        items.forEach(item => {
            const id = item.getAttribute('data-id');
            if (selectedIds.includes(id)) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }

    // ==========================================
    // UTILITY HELPER HANDLERS
    // ==========================================

    // ==========================================
    // UTILITY HELPER HANDLERS
    // ==========================================

    function rgbToHex(r, g, b) {
        return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
    }

    function hexToRgb(hex) {
        if (hex === 'transparent') return { r: 0, g: 0, b: 0 };
        const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
        const fullHex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 0, g: 0, b: 0 };
    }

    function rgbToHsv(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        let max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h, s, v = max;
        let d = max - min;
        s = max === 0 ? 0 : d / max;
        if (max === min) {
            h = 0;
        } else {
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
        return { h: Math.round(h * 360), s: s, v: v };
    }

    function hsvToRgb(h, s, v) {
        let r, g, b;
        let i = Math.floor(h / 60);
        let f = h / 60 - i;
        let p = v * (1 - s);
        let q = v * (1 - f * s);
        let t = v * (1 - (1 - f) * s);
        switch (i % 6) {
            case 0: r = v, g = t, b = p; break;
            case 1: r = q, g = v, b = p; break;
            case 2: r = p, g = v, b = t; break;
            case 3: r = p, g = q, b = v; break;
            case 4: r = t, g = p, b = v; break;
            case 5: r = v, g = p, b = q; break;
        }
        return {
            r: Math.round(r * 255),
            g: Math.round(g * 255),
            b: Math.round(b * 255)
        };
    }

    // Custom Color Picker Manager DOM hooks
    const customPicker = document.getElementById('custom-color-picker');
    const colorMap = document.getElementById('color-map');
    const colorMapCursor = document.getElementById('color-map-cursor');
    const pickerHue = document.getElementById('picker-hue');
    const pickerRed = document.getElementById('picker-red');
    const pickerGreen = document.getElementById('picker-green');
    const pickerBlue = document.getElementById('picker-blue');
    const pickerRedNum = document.getElementById('picker-red-num');
    const pickerGreenNum = document.getElementById('picker-green-num');
    const pickerBlueNum = document.getElementById('picker-blue-num');
    const pickerHex = document.getElementById('picker-hex');
    const pickerPreview = document.getElementById('picker-preview');
    const pickerClose = document.getElementById('picker-close');
    const pickerEyedropper = document.getElementById('picker-eyedropper');
    const presetsGrid = document.getElementById('picker-presets-grid');

    let customPickerActivePair = null; // { picker: InputEl, hex: InputEl, callback: Fn }
    let customPickerColor = { h: 0, s: 1, v: 1 };
    let isDraggingMap = false;

    // Eye Dropper Feature Integration
    if (!window.EyeDropper) {
        pickerEyedropper.style.display = 'none';
    } else {
        pickerEyedropper.addEventListener('click', async () => {
            try {
                const eyeDropper = new EyeDropper();
                const result = await eyeDropper.open();
                updateFromHex(result.sRGBHex);
            } catch (e) {
                console.error("Eyedropper failed: ", e);
            }
        });
    }

    // Swatches Palette Config
    const presetColors = [
        '#004d40', '#10b981', '#84cc16', '#a7f3d0',
        '#00f0ff', '#ff0055', '#ffe600', '#b026ff',
        '#000000', '#1e293b', '#64748b', '#e2e8f0', '#ffffff',
        'transparent'
    ];

    function initPresets() {
        presetsGrid.innerHTML = '';
        presetColors.forEach(color => {
            const swatch = document.createElement('div');
            swatch.className = `preset-swatch ${color === 'transparent' ? 'preset-transparent' : ''}`;
            if (color !== 'transparent') {
                swatch.style.backgroundColor = color;
            }
            swatch.title = color;
            swatch.addEventListener('click', () => {
                if (color === 'transparent') {
                    updateFromTransparent();
                } else {
                    updateFromHex(color);
                }
            });
            presetsGrid.appendChild(swatch);
        });
    }
    initPresets();

    function drawColorMap() {
        const ctx = colorMap.getContext('2d');
        const width = colorMap.width;
        const height = colorMap.height;

        ctx.clearRect(0, 0, width, height);

        const hueColor = `hsl(${customPickerColor.h}, 100%, 50%)`;
        const horizGrad = ctx.createLinearGradient(0, 0, width, 0);
        horizGrad.addColorStop(0, '#ffffff');
        horizGrad.addColorStop(1, hueColor);
        ctx.fillStyle = horizGrad;
        ctx.fillRect(0, 0, width, height);

        const vertGrad = ctx.createLinearGradient(0, 0, 0, height);
        vertGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
        vertGrad.addColorStop(1, 'rgba(0, 0, 0, 1)');
        ctx.fillStyle = vertGrad;
        ctx.fillRect(0, 0, width, height);
    }

    function updateControlsFromHsv(triggerCallback = true) {
        const rgb = hsvToRgb(customPickerColor.h, customPickerColor.s, customPickerColor.v);
        const hex = rgbToHex(rgb.r, rgb.g, rgb.b);

        const mapWidth = colorMap.offsetWidth || 208;
        const mapHeight = colorMap.offsetHeight || 120;
        colorMapCursor.style.left = `${customPickerColor.s * mapWidth}px`;
        colorMapCursor.style.top = `${(1 - customPickerColor.v) * mapHeight}px`;

        pickerHue.value = customPickerColor.h;

        pickerRed.value = rgb.r;
        pickerRedNum.value = rgb.r;
        pickerGreen.value = rgb.g;
        pickerGreenNum.value = rgb.g;
        pickerBlue.value = rgb.b;
        pickerBlueNum.value = rgb.b;

        pickerHex.value = hex;
        pickerPreview.style.backgroundColor = hex;

        if (customPickerActivePair) {
            customPickerActivePair.picker.value = hex;
            customPickerActivePair.hex.value = hex;
            syncColorSwatchTransparentClass(customPickerActivePair.picker, hex);

            if (triggerCallback && customPickerActivePair.callback) {
                customPickerActivePair.callback(hex);
            }
        }
    }

    function updateFromHex(hexVal, triggerCallback = true) {
        let cleanHex = hexVal.trim();
        if (!cleanHex.startsWith('#')) cleanHex = '#' + cleanHex;
        if (/^#[0-9A-F]{6}$/i.test(cleanHex)) {
            const rgb = hexToRgb(cleanHex);
            const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
            customPickerColor = hsv;
            drawColorMap();
            updateControlsFromHsv(triggerCallback);
        }
    }

    function updateFromTransparent(triggerCallback = true) {
        pickerPreview.style.backgroundColor = 'transparent';
        pickerHex.value = 'transparent';

        if (customPickerActivePair) {
            customPickerActivePair.picker.value = '#000000';
            customPickerActivePair.hex.value = 'transparent';
            syncColorSwatchTransparentClass(customPickerActivePair.picker, 'transparent');

            if (triggerCallback && customPickerActivePair.callback) {
                customPickerActivePair.callback('transparent');
            }
        }
    }

    function updateFromRgb(triggerCallback = true) {
        const r = parseInt(pickerRed.value) || 0;
        const g = parseInt(pickerGreen.value) || 0;
        const b = parseInt(pickerBlue.value) || 0;
        const hsv = rgbToHsv(r, g, b);
        customPickerColor = hsv;
        drawColorMap();
        updateControlsFromHsv(triggerCallback);
    }

    function handleMapPointer(e) {
        const rect = colorMap.getBoundingClientRect();
        let x = e.clientX - rect.left;
        let y = e.clientY - rect.top;

        x = Math.max(0, Math.min(rect.width, x));
        y = Math.max(0, Math.min(rect.height, y));

        customPickerColor.s = x / rect.width;
        customPickerColor.v = 1 - (y / rect.height);

        updateControlsFromHsv();
    }

    colorMap.addEventListener('mousedown', (e) => {
        isDraggingMap = true;
        handleMapPointer(e);
        state.pushHistory();
    });

    window.addEventListener('mousemove', (e) => {
        if (isDraggingMap) {
            handleMapPointer(e);
        }
    });

    window.addEventListener('mouseup', () => {
        isDraggingMap = false;
    });

    colorMap.addEventListener('touchstart', (e) => {
        isDraggingMap = true;
        if (e.touches[0]) {
            handleMapPointer(e.touches[0]);
        }
        state.pushHistory();
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
        if (isDraggingMap && e.touches[0]) {
            handleMapPointer(e.touches[0]);
        }
    }, { passive: true });

    window.addEventListener('touchend', () => {
        isDraggingMap = false;
    });

    pickerHue.addEventListener('input', (e) => {
        customPickerColor.h = parseInt(e.target.value);
        drawColorMap();
        updateControlsFromHsv();
    });
    pickerHue.addEventListener('mousedown', () => state.pushHistory());

    const bindRgbSlider = (sliderEl, numEl) => {
        sliderEl.addEventListener('input', (e) => {
            numEl.value = e.target.value;
            updateFromRgb();
        });
        sliderEl.addEventListener('mousedown', () => state.pushHistory());
        
        numEl.addEventListener('input', (e) => {
            let val = parseInt(e.target.value) || 0;
            val = Math.max(0, Math.min(255, val));
            e.target.value = val;
            sliderEl.value = val;
            updateFromRgb();
        });
        numEl.addEventListener('focus', () => state.pushHistory());
    };
    bindRgbSlider(pickerRed, pickerRedNum);
    bindRgbSlider(pickerGreen, pickerGreenNum);
    bindRgbSlider(pickerBlue, pickerBlueNum);

    pickerHex.addEventListener('input', (e) => {
        const val = e.target.value.trim();
        if (val === 'transparent') {
            updateFromTransparent();
        } else {
            updateFromHex(val);
        }
    });
    pickerHex.addEventListener('focus', () => state.pushHistory());

    pickerClose.addEventListener('click', () => {
        closeCustomColorPicker();
    });

    document.addEventListener('mousedown', (e) => {
        if (!customPicker.classList.contains('hidden')) {
            const isClickInside = customPicker.contains(e.target);
            const isClickOnSwatch = customPickerActivePair && 
                (customPickerActivePair.picker.contains(e.target) || customPickerActivePair.hex.contains(e.target));
            if (!isClickInside && !isClickOnSwatch) {
                closeCustomColorPicker();
            }
        }
    });

    function openCustomColorPicker(pickerEl, hexEl, callback) {
        customPickerActivePair = { picker: pickerEl, hex: hexEl, callback: callback };
        
        // Show the picker first so offset dimensions are readable and canvas context is visible
        customPicker.classList.remove('hidden');

        // Reset scroll position to top
        const body = customPicker.querySelector('.picker-body');
        if (body) {
            body.scrollTop = 0;
        }

        const currentVal = hexEl.value.trim();
        if (currentVal === 'transparent') {
            updateFromTransparent(false);
        } else {
            updateFromHex(currentVal, false);
        }

        repositionCustomPicker(pickerEl);
    }

    function repositionCustomPicker(pickerEl) {
        if (customPicker.classList.contains('hidden') || !pickerEl) return;

        // On mobile viewports, center the color picker as a modal popover
        if (window.innerWidth <= 576) {
            customPicker.classList.add('mobile-picker');
            customPicker.style.top = '';
            customPicker.style.left = '';
            customPicker.style.maxHeight = ''; // reset inline max-height
            return;
        } else {
            customPicker.classList.remove('mobile-picker');
        }

        const rect = pickerEl.getBoundingClientRect();
        
        let top = rect.bottom + window.scrollY + 6;
        let left = rect.left + window.scrollX;

        const popoverWidth = customPicker.offsetWidth || 232;
        const popoverHeight = customPicker.offsetHeight || 380;

        if (left + popoverWidth > window.innerWidth) {
            left = window.innerWidth - popoverWidth - 12;
        }
        if (left < 12) left = 12;

        const viewportBottom = window.scrollY + window.innerHeight;
        if (top + popoverHeight > viewportBottom) {
            const topPlacement = rect.top + window.scrollY - popoverHeight - 6;
            if (topPlacement >= window.scrollY) {
                top = topPlacement;
            } else {
                // Pin to bottom viewport bounds if it doesn't fit above or below
                top = Math.max(window.scrollY + 12, viewportBottom - popoverHeight - 12);
            }
        }

        customPicker.style.top = `${top}px`;
        customPicker.style.left = `${left}px`;

        // Dynamically constrain container max-height so it shrinks and scrolls instead of clipping
        const maxAvailableHeight = Math.min(window.innerHeight - 24, viewportBottom - top - 12);
        customPicker.style.maxHeight = `${maxAvailableHeight}px`;
    }

    function closeCustomColorPicker() {
        customPicker.classList.add('hidden');
        customPickerActivePair = null;
    }

    window.addEventListener('resize', () => {
        if (customPickerActivePair) {
            repositionCustomPicker(customPickerActivePair.picker);
        }
    });

    window.addEventListener('scroll', () => {
        if (customPickerActivePair) {
            repositionCustomPicker(customPickerActivePair.picker);
        }
    }, { passive: true });

    document.querySelector('.canvas-container-outer')?.addEventListener('scroll', () => {
        if (customPickerActivePair) {
            repositionCustomPicker(customPickerActivePair.picker);
        }
    }, { passive: true });

    function syncColorSwatchTransparentClass(pickerEl, val) {
        if (!pickerEl) return;
        if (val === 'transparent') {
            pickerEl.classList.add('color-transparent');
            if (pickerEl.parentElement) pickerEl.parentElement.classList.add('color-transparent');
        } else {
            pickerEl.classList.remove('color-transparent');
            if (pickerEl.parentElement) pickerEl.parentElement.classList.remove('color-transparent');
        }
    }

    function bindColorPickerPair(pickerId, hexInputId, callback) {
        const picker = document.getElementById(pickerId);
        const hex = document.getElementById(hexInputId);

        picker.addEventListener('click', (e) => {
            e.preventDefault();
            state.pushHistory();
            openCustomColorPicker(picker, hex, callback);
        });

        hex.addEventListener('focus', () => {
            state.pushHistory();
        });

        hex.addEventListener('input', (e) => {
            let val = e.target.value.trim();
            if (val === 'transparent') {
                syncColorSwatchTransparentClass(picker, 'transparent');
                picker.value = '#000000';
                callback('transparent');
            } else {
                if (!val.startsWith('#')) val = '#' + val;
                if (/^#[0-9A-F]{6}$/i.test(val)) {
                    syncColorSwatchTransparentClass(picker, val);
                    picker.value = val;
                    callback(val);
                }
            }
        });
    }

    function switchTab(tabId) {
        tabButtons.forEach(b => {
            if (b.getAttribute('data-tab') === tabId) b.classList.add('active');
            else b.classList.remove('active');
        });
        tabPanels.forEach(p => {
            if (p.id === tabId) p.classList.add('active');
            else p.classList.remove('active');
        });
    }

    function toggleBackgroundOptionFields(type) {
        document.querySelectorAll('.bg-option-fields').forEach(f => f.classList.add('hidden'));
        if (type === 'color') {
            document.getElementById('bg-color-fields').classList.remove('hidden');
        } else if (type === 'gradient') {
            document.getElementById('bg-gradient-fields').classList.remove('hidden');
        } else if (type === 'image') {
            document.getElementById('bg-image-fields').classList.remove('hidden');
        }
    }

    function setAccordionItemVisible(id, isVisible) {
        const item = document.getElementById(id);
        if (item) {
            if (isVisible) item.classList.remove('hidden');
            else item.classList.add('hidden');
        }
    }

    function setAccordionItemOpen(id, isOpen) {
        const item = document.getElementById(id);
        if (item) {
            const header = item.querySelector('.accordion-header');
            if (isOpen) {
                item.classList.add('open');
                if (header) header.setAttribute('aria-expanded', 'true');
            } else {
                item.classList.remove('open');
                if (header) header.setAttribute('aria-expanded', 'false');
            }
        }
    }

    function toggleInspectorFieldsForType(type) {
        // Hide all conditional inspector groupings first
        const getEl = id => document.getElementById(id);
        getEl('group-text-styles')?.classList.add('hidden');
        getEl('group-bg-styles')?.classList.add('hidden');
        getEl('group-image-styles')?.classList.add('hidden');
        getEl('group-video-styles')?.classList.add('hidden');
        getEl('group-timer-settings')?.classList.add('hidden');
        getEl('group-nav-settings')?.classList.add('hidden');
        getEl('group-option-settings')?.classList.add('hidden');
        getEl('group-show-ans-settings')?.classList.add('hidden');
        getEl('group-toggle-settings')?.classList.add('hidden');
        getEl('group-button-markup')?.classList.add('hidden');
        getEl('group-shape-settings')?.classList.add('hidden');

        // Transform is always visible and open
        setAccordionItemVisible('acc-item-transform', true);
        setAccordionItemOpen('acc-item-transform', true);

        // AI Design Agent is always available (closed by default)
        setAccordionItemVisible('acc-item-ai', true);

        if (type === 'text') {
            getEl('group-text-styles')?.classList.remove('hidden');
            getEl('group-bg-styles')?.classList.remove('hidden');

            setAccordionItemVisible('acc-item-typography', true);
            setAccordionItemVisible('acc-item-appearance', true);
            setAccordionItemVisible('acc-item-interactivity', false);
            setAccordionItemVisible('acc-item-media', false);

            setAccordionItemOpen('acc-item-typography', true);
            setAccordionItemOpen('acc-item-appearance', false);
            setAccordionItemOpen('acc-item-ai', false);
        } else if (type === 'shape') {
            getEl('group-shape-settings')?.classList.remove('hidden');
            getEl('group-bg-styles')?.classList.remove('hidden');

            setAccordionItemVisible('acc-item-typography', false);
            setAccordionItemVisible('acc-item-appearance', true);
            setAccordionItemVisible('acc-item-interactivity', false);
            setAccordionItemVisible('acc-item-media', false);

            setAccordionItemOpen('acc-item-appearance', true);
            setAccordionItemOpen('acc-item-ai', false);
        } else if (type === 'image') {
            getEl('group-image-styles')?.classList.remove('hidden');

            setAccordionItemVisible('acc-item-typography', false);
            setAccordionItemVisible('acc-item-appearance', false);
            setAccordionItemVisible('acc-item-interactivity', false);
            setAccordionItemVisible('acc-item-media', true);

            setAccordionItemOpen('acc-item-media', true);
            setAccordionItemOpen('acc-item-ai', false);
        } else if (type === 'video') {
            getEl('group-video-styles')?.classList.remove('hidden');

            setAccordionItemVisible('acc-item-typography', false);
            setAccordionItemVisible('acc-item-appearance', false);
            setAccordionItemVisible('acc-item-interactivity', false);
            setAccordionItemVisible('acc-item-media', true);

            setAccordionItemOpen('acc-item-media', true);
            setAccordionItemOpen('acc-item-ai', false);
        } else if (type === 'timer') {
            getEl('group-text-styles')?.classList.remove('hidden');
            getEl('group-bg-styles')?.classList.remove('hidden');
            getEl('group-timer-settings')?.classList.remove('hidden');

            setAccordionItemVisible('acc-item-typography', true);
            setAccordionItemVisible('acc-item-appearance', true);
            setAccordionItemVisible('acc-item-interactivity', true);
            setAccordionItemVisible('acc-item-media', false);

            setAccordionItemOpen('acc-item-typography', false);
            setAccordionItemOpen('acc-item-appearance', false);
            setAccordionItemOpen('acc-item-interactivity', true);
            setAccordionItemOpen('acc-item-ai', false);
        } else if (type && type.startsWith('btn-')) {
            getEl('group-text-styles')?.classList.remove('hidden');
            getEl('group-bg-styles')?.classList.remove('hidden');
            getEl('group-button-markup')?.classList.remove('hidden');

            if (type === 'btn-nav') getEl('group-nav-settings')?.classList.remove('hidden');
            else if (type === 'btn-option') {
                getEl('group-option-settings')?.classList.remove('hidden');
                getEl('group-toggle-settings')?.classList.remove('hidden');
            } else if (type === 'btn-show-ans') getEl('group-show-ans-settings')?.classList.remove('hidden');
            else if (type === 'btn-toggle') getEl('group-toggle-settings')?.classList.remove('hidden');

            setAccordionItemVisible('acc-item-typography', true);
            setAccordionItemVisible('acc-item-appearance', true);
            setAccordionItemVisible('acc-item-interactivity', true);
            setAccordionItemVisible('acc-item-media', false);

            setAccordionItemOpen('acc-item-typography', true);
            setAccordionItemOpen('acc-item-appearance', false);
            setAccordionItemOpen('acc-item-interactivity', true);
            setAccordionItemOpen('acc-item-ai', false);
        }
    }

    // ==========================================
    // PROPERTY INSPECTORS TARGET DROP-DOWNS POPULATE
    // ==========================================

    function rebuildNavSlideDropdowns() {
        const select = document.getElementById('elem-nav-target');
        select.innerHTML = '<option value="">-- Select Slide --</option>';

        state.project.slides.forEach(slide => {
            const opt = document.createElement('option');
            opt.value = slide.id;
            opt.textContent = slide.name;
            select.appendChild(opt);
        });
        
        // Rebind current selection if editing a Nav Button
        const activeElem = state.getActiveElement();
        if (activeElem && activeElem.type === 'btn-nav') {
            select.value = activeElem.targetSlideId || '';
        }
    }

    function renderTimerActions(element) {
        const container = document.getElementById('timer-actions-list');
        if (!container) return;
        container.innerHTML = '';

        const actions = element.actions || [];
        if (actions.length === 0) {
            container.innerHTML = '<div style="font-size: 0.75rem; color: var(--text-muted); text-align: center; padding: 10px; border: 1px dashed rgba(255,255,255,0.05); border-radius: 6px;">No actions configured. Click "Add Action" above.</div>';
            return;
        }

        const activeSlide = state.getActiveSlide();
        if (!activeSlide) return;

        actions.forEach((act, index) => {
            const card = document.createElement('div');
            card.className = 'timer-action-card';
            card.setAttribute('data-index', index);
            card.style.cssText = 'background: rgba(255,255,255,0.03); padding: 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.06); display: flex; flex-direction: column; gap: 8px; position: relative;';

            // Card Header (Title & Delete)
            const header = document.createElement('div');
            header.style.cssText = 'display: flex; justify-content: space-between; align-items: center;';
            header.innerHTML = `<span style="font-size: 0.725rem; font-weight: 600; color: var(--color-primary-hover);">Action #${index + 1}</span>`;

            const delBtn = document.createElement('button');
            delBtn.type = 'button';
            delBtn.className = 'btn-icon text-danger';
            delBtn.style.cssText = 'width: 20px; height: 20px; padding: 0; display: inline-flex; align-items: center; justify-content: center; background: transparent; border: none; cursor: pointer;';
            delBtn.innerHTML = '<i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>';
            delBtn.onclick = () => {
                state.pushHistory();
                element.actions.splice(index, 1);
                state.updateElement(element.id, { actions: element.actions });
                renderTimerActions(element);
            };
            header.appendChild(delBtn);
            card.appendChild(header);

            // Action Type Select
            const typeGroup = document.createElement('div');
            typeGroup.className = 'form-group';
            typeGroup.style.margin = '0';
            
            const typeLabel = document.createElement('label');
            typeLabel.textContent = 'Trigger Action';
            typeLabel.style.cssText = 'font-size: 0.7rem; color: var(--text-muted); margin-bottom: 2px; display: block;';
            typeGroup.appendChild(typeLabel);

            const typeSelect = document.createElement('select');
            typeSelect.style.cssText = 'font-size: 0.75rem; padding: 4px 8px;';
            typeSelect.innerHTML = `
                <option value="show-answer">Auto Show Answer</option>
                <option value="next-slide">Go to Next Slide</option>
                <option value="appear">Make target appear</option>
                <option value="disappear">Make target disappear</option>
                <option value="toggle">Toggle target visibility</option>
            `;
            typeSelect.value = act.type || 'show-answer';
            typeGroup.appendChild(typeSelect);
            card.appendChild(typeGroup);

            // Target Element Select Group
            const targetGroup = document.createElement('div');
            targetGroup.className = 'form-group';
            targetGroup.style.cssText = `margin: 0; ${['appear', 'disappear', 'toggle'].includes(act.type) ? '' : 'display: none;'}`;
            
            const targetLabel = document.createElement('label');
            targetLabel.textContent = 'Target Element';
            targetLabel.style.cssText = 'font-size: 0.7rem; color: var(--text-muted); margin-bottom: 2px; display: block;';
            targetGroup.appendChild(targetLabel);

            const targetSelect = document.createElement('select');
            targetSelect.style.cssText = 'font-size: 0.75rem; padding: 4px 8px;';
            targetSelect.innerHTML = '<option value="">-- Select target --</option>';

            activeSlide.elements.forEach(elem => {
                const isTargetable = elem.type === 'text' || elem.type === 'image' || elem.type === 'video' || elem.type === 'timer' || elem.type.startsWith('btn-');
                if (isTargetable && elem.id !== element.id) {
                    const opt = document.createElement('option');
                    opt.value = elem.id;
                    opt.textContent = `${elem.type.toUpperCase()} (${elem.text ? elem.text.substring(0, 15) + '...' : elem.id.substring(3, 8)})`;
                    targetSelect.appendChild(opt);
                }
            });
            targetSelect.value = act.targetId || '';
            targetGroup.appendChild(targetSelect);
            card.appendChild(targetGroup);

            // Change listener for Type
            typeSelect.onchange = (e) => {
                state.pushHistory();
                act.type = e.target.value;
                if (['appear', 'disappear', 'toggle'].includes(act.type)) {
                    targetGroup.style.display = 'block';
                } else {
                    targetGroup.style.display = 'none';
                    act.targetId = '';
                }
                state.updateElement(element.id, { actions: element.actions });
            };

            // Change listener for Target
            targetSelect.onchange = (e) => {
                state.pushHistory();
                act.targetId = e.target.value;
                state.updateElement(element.id, { actions: element.actions });
            };

            container.appendChild(card);
        });

        if (window.lucide) lucide.createIcons();
    }

    function renderToggleActions(element) {
        const container = document.getElementById('toggle-actions-list');
        if (!container) return;
        container.innerHTML = '';

        const actions = element.actions || [];
        if (actions.length === 0) {
            container.innerHTML = '<div style="font-size: 0.75rem; color: var(--text-muted); text-align: center; padding: 10px; border: 1px dashed rgba(255,255,255,0.05); border-radius: 6px;">No actions configured. Click "Add Action" above.</div>';
            return;
        }

        const activeSlide = state.getActiveSlide();
        if (!activeSlide) return;

        actions.forEach((act, index) => {
            const card = document.createElement('div');
            card.className = 'toggle-action-card';
            card.setAttribute('data-index', index);
            card.style.cssText = 'background: rgba(255,255,255,0.03); padding: 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.06); display: flex; flex-direction: column; gap: 8px; position: relative;';

            // Card Header (Title & Delete)
            const header = document.createElement('div');
            header.style.cssText = 'display: flex; justify-content: space-between; align-items: center;';
            header.innerHTML = `<span style="font-size: 0.725rem; font-weight: 600; color: var(--color-primary-hover);">Action #${index + 1}</span>`;

            const delBtn = document.createElement('button');
            delBtn.type = 'button';
            delBtn.className = 'btn-icon text-danger';
            delBtn.style.cssText = 'width: 20px; height: 20px; padding: 0; display: inline-flex; align-items: center; justify-content: center; background: transparent; border: none; cursor: pointer;';
            delBtn.innerHTML = '<i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>';
            delBtn.onclick = () => {
                state.pushHistory();
                element.actions.splice(index, 1);
                state.updateElement(element.id, { actions: element.actions });
                renderToggleActions(element);
            };
            header.appendChild(delBtn);
            card.appendChild(header);

            // Action Type Select
            const typeGroup = document.createElement('div');
            typeGroup.className = 'form-group';
            typeGroup.style.margin = '0';
            
            const typeLabel = document.createElement('label');
            typeLabel.textContent = 'Action on Click';
            typeLabel.style.cssText = 'font-size: 0.7rem; color: var(--text-muted); margin-bottom: 2px; display: block;';
            typeGroup.appendChild(typeLabel);

            const typeSelect = document.createElement('select');
            typeSelect.style.cssText = 'font-size: 0.75rem; padding: 4px 8px;';
            typeSelect.innerHTML = `
                <option value="toggle">Toggle Visibility</option>
                <option value="appear">Make Appear</option>
                <option value="disappear">Make Disappear</option>
            `;
            typeSelect.value = act.type || 'toggle';
            typeGroup.appendChild(typeSelect);
            card.appendChild(typeGroup);

            // Target Element Select Group
            const targetGroup = document.createElement('div');
            targetGroup.className = 'form-group';
            targetGroup.style.margin = '0';
            
            const targetLabel = document.createElement('label');
            targetLabel.textContent = 'Target Element';
            targetLabel.style.cssText = 'font-size: 0.7rem; color: var(--text-muted); margin-bottom: 2px; display: block;';
            targetGroup.appendChild(targetLabel);

            const targetSelect = document.createElement('select');
            targetSelect.style.cssText = 'font-size: 0.75rem; padding: 4px 8px;';
            targetSelect.innerHTML = '<option value="">-- Select target --</option>';

            activeSlide.elements.forEach(elem => {
                const isTargetable = elem.type === 'text' || elem.type === 'image' || elem.type === 'video' || elem.type === 'timer' || elem.type.startsWith('btn-');
                if (isTargetable && elem.id !== element.id) {
                    const opt = document.createElement('option');
                    opt.value = elem.id;
                    opt.textContent = `${elem.type.toUpperCase()} (${elem.text ? elem.text.substring(0, 15) + '...' : elem.id.substring(3, 8)})`;
                    targetSelect.appendChild(opt);
                }
            });
            targetSelect.value = act.targetId || '';
            targetGroup.appendChild(targetSelect);
            card.appendChild(targetGroup);

            // Change listener for Type
            typeSelect.onchange = (e) => {
                state.pushHistory();
                act.type = e.target.value;
                state.updateElement(element.id, { actions: element.actions });
            };

            // Change listener for Target
            targetSelect.onchange = (e) => {
                state.pushHistory();
                act.targetId = e.target.value;
                state.updateElement(element.id, { actions: element.actions });
            };

            container.appendChild(card);
        });

        if (window.lucide) lucide.createIcons();
    }

    function rebuildElementInspectorSelectors() {
        const activeSlide = state.getActiveSlide();
        if (!activeSlide) return;

        const showSelect = document.getElementById('elem-show-ans-target');
        if (showSelect) {
            showSelect.innerHTML = '<option value="">-- Select target --</option>';
        }

        const activeElem = state.getActiveElement();

        activeSlide.elements.forEach(elem => {
            // Exclude buttons themselves from target pools to keep references simple
            const isTargetable = elem.type === 'text' || elem.type === 'image' || elem.type === 'video' || elem.type === 'timer' || elem.type.startsWith('btn-');
            
            if (isTargetable) {
                if (showSelect) {
                    const optShow = document.createElement('option');
                    optShow.value = elem.id;
                    optShow.textContent = `${elem.type.toUpperCase()} (${elem.text ? String(elem.text).substring(0, 15) + '...' : elem.id.substring(3, 8)})`;
                    showSelect.appendChild(optShow);
                }
            }
        });

        // Restore values
        if (activeElem) {
            if (activeElem.type === 'btn-show-ans' && showSelect) {
                showSelect.value = activeElem.targetElementId || '';
            } else if (activeElem.type === 'btn-toggle' || activeElem.type === 'btn-option') {
                renderToggleActions(activeElem);
            } else if (activeElem.type === 'timer') {
                renderTimerActions(activeElem);
            }
        }
    }

    // ==========================================
    // UNDO / REDO GLOBAL SHORTCUTS & FOCUS LISTENERS
    // ==========================================

    // Keyboard bindings (Ctrl+Z, Ctrl+Y, Ctrl+C, Ctrl+V, Delete/Backspace)
    window.addEventListener('keydown', (e) => {
        const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
        const isTyping = activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select' || (document.activeElement && document.activeElement.isContentEditable);

        if (e.ctrlKey) {
            if (e.key.toLowerCase() === 'z') {
                e.preventDefault();
                state.undo();
            } else if (e.key.toLowerCase() === 'y') {
                e.preventDefault();
                state.redo();
            } else if (e.key.toLowerCase() === 'c' && !isTyping) {
                e.preventDefault();
                state.copyElements();
            } else if (e.key.toLowerCase() === 'v' && !isTyping) {
                e.preventDefault();
                state.pasteElements();
            }
        } else if (e.key === 'Delete' || e.key === 'Backspace') {
            if (!isTyping) {
                const selectedIds = state.selectedElementIds || [];
                if (selectedIds.length > 0) {
                    e.preventDefault();
                    if (confirm(`Are you sure you want to delete the ${selectedIds.length} selected element(s)?`)) {
                        state.deleteElements(selectedIds);
                    }
                }
            }
        }
    });

    // Bubbling focusin listener inside right sidebar Inspector to record states before edits
    document.querySelector('.sidebar-right').addEventListener('focusin', (e) => {
        const tag = e.target.tagName.toLowerCase();
        if (tag === 'input' || tag === 'select' || tag === 'textarea') {
            state.pushHistory();
        }
    });

    // Bubbling focusin listener for Project Name in header
    document.getElementById('project-name-input').addEventListener('focusin', () => {
        state.pushHistory();
    });

    // ==========================================
    // SIDEBAR COLLAPSE/EXPAND TOGGLE LISTENERS
    // ==========================================
    const editorView = document.getElementById('editor-view');
    const toggleLeftBtn = document.getElementById('btn-toggle-left-sidebar');
    const toggleRightBtn = document.getElementById('btn-toggle-right-sidebar');

    if (toggleLeftBtn) {
        toggleLeftBtn.onclick = () => {
            editorView.classList.toggle('left-sidebar-collapsed');
            if (editorView.classList.contains('left-sidebar-collapsed')) {
                toggleLeftBtn.title = "Expand Slides Panel";
                toggleLeftBtn.innerHTML = '<i data-lucide="chevron-right"></i>';
            } else {
                toggleLeftBtn.title = "Collapse Slides Panel";
                toggleLeftBtn.innerHTML = '<i data-lucide="chevron-left"></i>';
            }
            if (window.lucide) lucide.createIcons();
            if (window.editorCanvas) {
                window.editorCanvas.resize();
            }
        };
    }

    if (toggleRightBtn) {
        toggleRightBtn.onclick = () => {
            editorView.classList.toggle('right-sidebar-collapsed');
            if (editorView.classList.contains('right-sidebar-collapsed')) {
                toggleRightBtn.title = "Expand Inspector Panel";
                toggleRightBtn.innerHTML = '<i data-lucide="chevron-left"></i>';
            } else {
                toggleRightBtn.title = "Collapse Inspector Panel";
                toggleRightBtn.innerHTML = '<i data-lucide="chevron-right"></i>';
            }
            if (window.lucide) lucide.createIcons();
            if (window.editorCanvas) {
                window.editorCanvas.resize();
            }
        };
    }

    // ==========================================
    // INTERACTIVE TUTORIAL GUIDE TOUR CONTROLLER
    // ==========================================

    let currentTourStep = 0;
    const tourSteps = [
        {
            target: '.header-logo-group',
            title: 'Welcome to SlideEngine!',
            text: 'SlideEngine is a next-gen GPU-accelerated presentation builder. Let us take a quick 1-minute tour of your new workspace.',
            placement: 'bottom',
            onShow: () => {
                // Ensure sidebars are expanded for the tour
                if (editorView) {
                    editorView.classList.remove('left-sidebar-collapsed');
                    editorView.classList.remove('right-sidebar-collapsed');
                }
                const toggleLeftBtn = document.getElementById('btn-toggle-left-sidebar');
                const toggleRightBtn = document.getElementById('btn-toggle-right-sidebar');
                if (toggleLeftBtn) {
                    toggleLeftBtn.title = "Collapse Slides Panel";
                    toggleLeftBtn.innerHTML = '<i data-lucide="chevron-left"></i>';
                }
                if (toggleRightBtn) {
                    toggleRightBtn.title = "Collapse Inspector Panel";
                    toggleRightBtn.innerHTML = '<i data-lucide="chevron-right"></i>';
                }
                if (window.lucide) lucide.createIcons();
                if (window.editorCanvas) window.editorCanvas.resize();
            }
        },
        {
            target: 'aside.sidebar-left',
            title: 'Slide Manager',
            text: 'This sidebar lists all slides in your deck. Here you can add new slides, copy/paste elements, duplicate slides, or drag-and-drop to reorder them.',
            placement: 'right'
        },
        {
            target: '#canvas-container',
            title: 'WebGL Presentation Stage',
            text: 'The central stage runs on a high-performance vector WebGL canvas. Select items to move or resize them, or double-click text/timer boxes to edit values.',
            placement: 'top'
        },
        {
            target: '.element-grid',
            title: 'Add Interactive Elements',
            text: 'Click any element here to instantly add it to your slide. You can add static text, images, timers, slide navigation links, quiz buttons, and custom triggers.',
            placement: 'left',
            onShow: () => {
                switchTab('elements-tab');
            }
        },
        {
            target: '#slide-properties-section',
            title: 'Slide Layout & Transitions',
            text: 'Configure background colors, gradients, images, and visual slide transitions (like fade, 3D cube, or spin-zoom) here.',
            placement: 'left',
            onShow: () => {
                switchTab('elements-tab');
            }
        },
        {
            target: '#properties-tab',
            title: 'Properties Inspector',
            text: 'When you select an element on the WebGL stage, this tab displays. Customize fonts, colors, dimensions, borders, and interactive trigger click scripts here.',
            placement: 'left',
            onShow: () => {
                switchTab('properties-tab');
            }
        },
        {
            target: '#layers-panel',
            title: 'Z-Order Layers Manager',
            text: 'Control the stacking order of elements on the canvas. Drag entries or click controls to send elements forward or backward.',
            placement: 'left',
            onShow: () => {
                // Ensure layers panel is not minimized
                const lp = document.getElementById('layers-panel');
                const btn = document.getElementById('btn-toggle-layers');
                if (lp && lp.classList.contains('minimized')) {
                    lp.classList.remove('minimized');
                    if (btn) btn.innerHTML = '<i data-lucide="chevron-down"></i>';
                    if (window.lucide) lucide.createIcons();
                }
            }
        },
        {
            target: '#btn-output',
            title: 'Play & Sync Presentation',
            text: 'Click "Present" for full-screen playback. Click "Projector" to open a secondary synchronized viewport, ideal for dual-monitor presenting.',
            placement: 'bottom'
        }
    ];

    const overlay = document.getElementById('tutorial-overlay');
    const popover = document.getElementById('tutorial-popover');
    const stepTitle = document.getElementById('tutorial-step-title');
    const stepText = document.getElementById('tutorial-step-text');
    const dotsContainer = document.getElementById('tutorial-dots');
    const btnSkip = document.getElementById('btn-tutorial-skip');
    const btnPrev = document.getElementById('btn-tutorial-prev');
    const btnNext = document.getElementById('btn-tutorial-next');
    const btnTrigger = document.getElementById('btn-tutorial-trigger');

    function startTutorialTour() {
        currentTourStep = 0;
        if (overlay) overlay.classList.remove('hidden');
        if (popover) popover.classList.remove('hidden');
        document.body.classList.add('tutorial-active');
        showTutorialStep(currentTourStep);
    }

    function endTutorialTour() {
        if (overlay) overlay.classList.add('hidden');
        if (popover) popover.classList.add('hidden');
        document.body.classList.remove('tutorial-active');
        // Clean up highlights
        document.querySelectorAll('.tutorial-highlight').forEach(el => {
            el.classList.remove('tutorial-highlight');
        });
        // Save completion to localStorage
        localStorage.setItem('slide_engine_tutorial_completed', 'true');
    }

    function showTutorialStep(index) {
        if (index < 0 || index >= tourSteps.length) {
            endTutorialTour();
            return;
        }
        currentTourStep = index;

        const step = tourSteps[index];

        // Remove any existing highlights
        document.querySelectorAll('.tutorial-highlight').forEach(el => {
            el.classList.remove('tutorial-highlight');
        });

        // Run onShow action if present
        if (step.onShow) {
            step.onShow();
        }

        // Update text
        if (stepTitle) stepTitle.textContent = step.title;
        if (stepText) stepText.textContent = step.text;

        // Update Nav Buttons
        if (btnPrev) {
            if (index === 0) {
                btnPrev.style.display = 'none';
            } else {
                btnPrev.style.display = 'inline-flex';
            }
        }

        if (btnNext) {
            if (index === tourSteps.length - 1) {
                btnNext.textContent = 'Finish';
            } else {
                btnNext.textContent = 'Next';
            }
        }

        // Rebuild dots
        rebuildTutorialDots();

        // Target element highlight
        const targetEl = document.querySelector(step.target);
        if (targetEl) {
            targetEl.classList.add('tutorial-highlight');
            
            // Wait for DOM to adjust layout (especially tab switches/sidebar toggle actions)
            setTimeout(() => {
                positionTutorialPopover(targetEl, popover, step.placement);
            }, 150);
        } else {
            // If target is missing, center the popover on screen
            positionPopoverCenter();
        }
    }

    function rebuildTutorialDots() {
        if (!dotsContainer) return;
        dotsContainer.innerHTML = '';
        tourSteps.forEach((_, idx) => {
            const dot = document.createElement('div');
            dot.className = `tutorial-dot ${idx === currentTourStep ? 'active' : ''}`;
            dot.addEventListener('click', () => {
                showTutorialStep(idx);
            });
            dotsContainer.appendChild(dot);
        });
    }

    function positionPopoverCenter() {
        if (!popover) return;
        popover.className = 'tutorial-popover'; // Reset positioning classes
        popover.style.position = 'fixed';
        popover.style.top = '50%';
        popover.style.left = '50%';
        popover.style.transform = 'translate(-50%, -50%)';
        
        const arrow = popover.querySelector('.tutorial-arrow');
        if (arrow) arrow.style.display = 'none';
    }

    function positionTutorialPopover(targetEl, popoverEl, placement) {
        if (!popoverEl) return;
        const arrowEl = popoverEl.querySelector('.tutorial-arrow');
        if (arrowEl) arrowEl.style.display = 'block';

        const targetRect = targetEl.getBoundingClientRect();
        const popoverWidth = popoverEl.offsetWidth || 290;
        const popoverHeight = popoverEl.offsetHeight || 150;
        const gap = 12;

        let chosenPlacement = placement;

        // Dynamic collision/overflow fallback check
        if (placement === 'left') {
            if (targetRect.left < popoverWidth + gap) {
                // Try top, then bottom, then right
                if (targetRect.top > popoverHeight + gap) {
                    chosenPlacement = 'top';
                } else if (window.innerHeight - targetRect.bottom > popoverHeight + gap) {
                    chosenPlacement = 'bottom';
                } else if (window.innerWidth - targetRect.right > popoverWidth + gap) {
                    chosenPlacement = 'right';
                }
            }
        } else if (placement === 'right') {
            if (window.innerWidth - targetRect.right < popoverWidth + gap) {
                // Try left, then top, then bottom
                if (targetRect.left > popoverWidth + gap) {
                    chosenPlacement = 'left';
                } else if (targetRect.top > popoverHeight + gap) {
                    chosenPlacement = 'top';
                } else if (window.innerHeight - targetRect.bottom > popoverHeight + gap) {
                    chosenPlacement = 'bottom';
                }
            }
        } else if (placement === 'top') {
            if (targetRect.top < popoverHeight + gap) {
                // Try bottom, then left, then right
                if (window.innerHeight - targetRect.bottom > popoverHeight + gap) {
                    chosenPlacement = 'bottom';
                } else if (targetRect.left > popoverWidth + gap) {
                    chosenPlacement = 'left';
                } else if (window.innerWidth - targetRect.right > popoverWidth + gap) {
                    chosenPlacement = 'right';
                }
            }
        } else if (placement === 'bottom') {
            if (window.innerHeight - targetRect.bottom < popoverHeight + gap) {
                // Try top, then left, then right
                if (targetRect.top > popoverHeight + gap) {
                    chosenPlacement = 'top';
                } else if (targetRect.left > popoverWidth + gap) {
                    chosenPlacement = 'left';
                } else if (window.innerWidth - targetRect.right > popoverWidth + gap) {
                    chosenPlacement = 'right';
                }
            }
        }

        // Reset classes & styles
        popoverEl.className = 'tutorial-popover';
        popoverEl.style.position = 'absolute';
        popoverEl.style.transform = '';
        
        let top = 0;
        let left = 0;
        let arrowPlacement = chosenPlacement;

        // Determine absolute positioning based on chosenPlacement
        if (chosenPlacement === 'bottom') {
            top = targetRect.bottom + window.scrollY + gap;
            left = targetRect.left + window.scrollX + (targetRect.width - popoverWidth) / 2;
            popoverEl.classList.add('arrow-top');
            arrowPlacement = 'arrow-top';
        } else if (chosenPlacement === 'top') {
            top = targetRect.top + window.scrollY - popoverHeight - gap;
            left = targetRect.left + window.scrollX + (targetRect.width - popoverWidth) / 2;
            popoverEl.classList.add('arrow-bottom');
            arrowPlacement = 'arrow-bottom';
        } else if (chosenPlacement === 'right') {
            top = targetRect.top + window.scrollY + (targetRect.height - popoverHeight) / 2;
            left = targetRect.right + window.scrollX + gap;
            popoverEl.classList.add('arrow-left');
            arrowPlacement = 'arrow-left';
        } else if (chosenPlacement === 'left') {
            top = targetRect.top + window.scrollY + (targetRect.height - popoverHeight) / 2;
            left = targetRect.left - popoverWidth - gap;
            popoverEl.classList.add('arrow-right');
            arrowPlacement = 'arrow-right';
        }

        // Constrain inside viewport boundaries
        if (left < 10) {
            left = 10;
        }
        if (left + popoverWidth > window.innerWidth - 10) {
            left = window.innerWidth - popoverWidth - 10;
        }
        if (top < 10) {
            top = 10;
        }
        if (top + popoverHeight > window.innerHeight + window.scrollY - 10) {
            top = window.innerHeight + window.scrollY - popoverHeight - 10;
        }

        popoverEl.style.top = `${top}px`;
        popoverEl.style.left = `${left}px`;

        // Position the arrow dynamically to point at target center
        if (arrowEl) {
            if (arrowPlacement === 'arrow-top' || arrowPlacement === 'arrow-bottom') {
                const targetCenterX = targetRect.left + window.scrollX + targetRect.width / 2;
                let arrowLeft = targetCenterX - left - 8;
                arrowLeft = Math.max(16, Math.min(popoverWidth - 24, arrowLeft));
                arrowEl.style.left = `${arrowLeft}px`;
                arrowEl.style.top = '';
                arrowEl.style.bottom = '';
                arrowEl.style.right = '';
            } else {
                const targetCenterY = targetRect.top + window.scrollY + targetRect.height / 2;
                let arrowTop = targetCenterY - top - 8;
                arrowTop = Math.max(16, Math.min(popoverHeight - 24, arrowTop));
                arrowEl.style.top = `${arrowTop}px`;
                arrowEl.style.left = '';
                arrowEl.style.bottom = '';
                arrowEl.style.right = '';
            }
        }
    }

    // Window Resize alignment listener
    window.addEventListener('resize', () => {
        if (popover && !popover.classList.contains('hidden') && document.body.classList.contains('tutorial-active')) {
            const step = tourSteps[currentTourStep];
            const targetEl = document.querySelector(step.target);
            if (targetEl) {
                positionTutorialPopover(targetEl, popover, step.placement);
            } else {
                positionPopoverCenter();
            }
        }
    });

    // Wire Up Control Buttons
    if (btnTrigger) {
        btnTrigger.addEventListener('click', (e) => {
            e.preventDefault();
            startTutorialTour();
        });
    }

    if (btnSkip) {
        btnSkip.addEventListener('click', () => {
            endTutorialTour();
        });
    }

    if (btnPrev) {
        btnPrev.addEventListener('click', () => {
            showTutorialStep(currentTourStep - 1);
        });
    }

    if (btnNext) {
        btnNext.addEventListener('click', () => {
            if (currentTourStep === tourSteps.length - 1) {
                endTutorialTour();
            } else {
                showTutorialStep(currentTourStep + 1);
            }
        });
    }

    // Auto-launch trigger for new users opening their first project
    state.on('view-changed', (view) => {
        if (view === 'editor') {
            setTimeout(() => {
                const projects = state.getProjectsForCurrentUser ? state.getProjectsForCurrentUser() : [];
                const completed = localStorage.getItem('slide_engine_tutorial_completed') === 'true';
                if (projects.length <= 1 && !completed) {
                    startTutorialTour();
                }
            }, 600);
        } else {
            if (popover && !popover.classList.contains('hidden')) {
                endTutorialTour();
            }
        }
    });

    // ==========================================
    // AI GENERATOR CONTROL BINDINGS
    // ==========================================
    function syncAIKeyUI() {
        const badge = document.getElementById('ai-key-status-badge');
        const inputWrapper = document.getElementById('ai-key-input-wrapper');
        const configWrapper = document.getElementById('ai-key-configured-wrapper');
        
        if (state.hasGeminiKey) {
            if (badge) {
                badge.textContent = "Configured";
                badge.className = "badge badge-success";
                badge.style.backgroundColor = "#10b981";
            }
            if (inputWrapper) inputWrapper.classList.add('hidden');
            if (configWrapper) configWrapper.classList.remove('hidden');
        } else {
            if (badge) {
                badge.textContent = "Not Configured";
                badge.className = "badge badge-error";
                badge.style.backgroundColor = "#ef4444";
            }
            if (inputWrapper) inputWrapper.classList.remove('hidden');
            if (configWrapper) configWrapper.classList.add('hidden');
        }
    }

    state.on('gemini-key-changed', (hasKey) => {
        syncAIKeyUI();
    });

    state.on('auth-changed', () => {
        syncAIKeyUI();
    });

    // Run sync initially
    syncAIKeyUI();

    const saveKeyBtn = document.getElementById('btn-ai-save-key');
    const changeKeyBtn = document.getElementById('btn-ai-change-key');
    const keyInput = document.getElementById('ai-gemini-key-input');

    if (saveKeyBtn) {
        saveKeyBtn.onclick = async () => {
            const keyVal = (keyInput.value || '').trim();
            if (!keyVal) {
                alert("Please enter a valid Gemini API Key.");
                return;
            }
            saveKeyBtn.disabled = true;
            saveKeyBtn.textContent = "Saving...";
            
            try {
                const res = await window.SlideEngineAPI.updateGeminiKey(keyVal);
                if (res.success) {
                    state.hasGeminiKey = true;
                    localStorage.setItem('slide_engine_active_has_gemini_key', 'true');
                    state.emit('gemini-key-changed', true);
                    keyInput.value = '';
                } else {
                    alert("Failed to save key: " + res.message);
                }
            } catch (err) {
                alert("Error saving API Key: " + err.message);
            } finally {
                saveKeyBtn.disabled = false;
                saveKeyBtn.innerHTML = '<i data-lucide="save" style="width: 14px; height: 14px;"></i> Save Key';
                if (window.lucide) lucide.createIcons();
            }
        };
    }

    if (changeKeyBtn) {
        changeKeyBtn.onclick = async () => {
            if (!confirm("Are you sure you want to clear/change the saved Gemini API Key?")) return;
            changeKeyBtn.disabled = true;
            try {
                const res = await window.SlideEngineAPI.updateGeminiKey('');
                if (res.success) {
                    state.hasGeminiKey = false;
                    localStorage.setItem('slide_engine_active_has_gemini_key', 'false');
                    state.emit('gemini-key-changed', false);
                } else {
                    alert("Failed to clear key: " + res.message);
                }
            } catch (err) {
                alert("Error: " + err.message);
            } finally {
                changeKeyBtn.disabled = false;
            }
        };
    }

    const modeSelect = document.getElementById('ai-mode-select');
    const slideCountGroup = document.getElementById('ai-slide-count-group');
    if (modeSelect && slideCountGroup) {
        modeSelect.onchange = () => {
            if (modeSelect.value === 'presentation') {
                slideCountGroup.style.display = 'block';
            } else {
                slideCountGroup.style.display = 'none';
            }
        };
    }

    const generateBtn = document.getElementById('btn-ai-generate');
    const promptInput = document.getElementById('ai-prompt-input');
    const themeSelect = document.getElementById('ai-theme-select');
    const slideCountInput = document.getElementById('ai-slide-count');
    const progressContainer = document.getElementById('ai-progress-container');
    const progressText = document.getElementById('ai-progress-text');
    const errorBanner = document.getElementById('ai-error-banner');
    const errorText = document.getElementById('ai-error-text');

    if (generateBtn) {
        generateBtn.onclick = async () => {
            const promptVal = (promptInput.value || '').trim();
            if (!promptVal) {
                alert("Please enter a topic or prompt for slide generation.");
                return;
            }

            // Show loading state
            generateBtn.disabled = true;
            generateBtn.textContent = "Generating...";
            if (progressContainer) progressContainer.classList.remove('hidden');
            if (errorBanner) errorBanner.classList.add('hidden');
            if (progressText) progressText.textContent = "Connecting to Gemini API...";

            const modeVal = modeSelect.value;
            const themeVal = themeSelect.value;
            const countVal = parseInt(slideCountInput.value) || 3;

            try {
                if (progressText) progressText.textContent = "Generating layout and quiz options...";
                const res = await window.SlideEngineAPI.generateAI(promptVal, modeVal, themeVal, countVal);
                
                if (res.slides && res.slides.length > 0) {
                    if (progressText) progressText.textContent = "Injecting slides into project...";
                    
                    // Generate unique IDs for all items to prevent conflicts
                    res.slides.forEach(slide => {
                        const newSlideId = 'id-' + Math.random().toString(36).substring(2, 11);
                        const oldSlideId = slide.id;
                        slide.id = newSlideId;

                        slide.elements.forEach(el => {
                            const newElId = 'id-' + Math.random().toString(36).substring(2, 11);
                            const oldElId = el.id;
                            el.id = newElId;

                            if (el.targetElementId === oldElId) {
                                el.targetElementId = newElId;
                            }
                        });
                    });

                    if (modeVal === 'presentation') {
                        const idMap = {};
                        const slidesData = res.slides;
                        
                        const mappedSlides = slidesData.map((slide, idx) => {
                            const newSlideId = 'slide-' + Math.random().toString(36).substring(2, 11);
                            const oldSlideId = slide.id || `old-slide-${idx}`;
                            idMap[oldSlideId] = newSlideId;
                            slide.id = newSlideId;
                            return { slide, oldSlideId };
                        });

                        mappedSlides.forEach(({ slide }) => {
                            const elIdMap = {};
                            slide.elements.forEach(el => {
                                const newElId = 'el-' + Math.random().toString(36).substring(2, 11);
                                const oldElId = el.id || `old-el-${Math.random()}`;
                                elIdMap[oldElId] = newElId;
                                el.id = newElId;
                            });

                            slide.elements.forEach(el => {
                                if (el.type === 'btn-nav' && el.targetSlideId) {
                                    if (idMap[el.targetSlideId]) {
                                        el.targetSlideId = idMap[el.targetSlideId];
                                    }
                                }
                                if (el.type === 'btn-show-ans' && el.targetElementId) {
                                    if (elIdMap[el.targetElementId]) {
                                        el.targetElementId = elIdMap[el.targetElementId];
                                    }
                                }
                                if (el.type === 'btn-toggle' && el.actions) {
                                    el.actions.forEach(act => {
                                        if (elIdMap[act.targetId]) {
                                            act.targetId = elIdMap[act.targetId];
                                        }
                                    });
                                }
                            });
                        });

                        if (!state.project) {
                            state.project = {
                                id: 'proj-' + Math.random().toString(36).substring(2, 11),
                                name: promptVal || "AI Presentation",
                                slides: []
                            };
                        }
                        
                        state.project.slides = slidesData;
                        state.project.name = promptVal;
                        state.selectedSlideId = slidesData[0].id;
                        state.selectedElementId = null;
                        state.selectedElementIds = [];
                        
                        state.markUnsaved();
                        state.emit('project-loaded', state.project);
                        state.emit('slide-list-changed', state.project.slides);
                        state.emit('slide-changed', state.getActiveSlide());
                    } else {
                        const quizSlide = res.slides[0];
                        if (quizSlide) {
                            const elIdMap = {};
                            quizSlide.elements.forEach(el => {
                                const newElId = 'el-' + Math.random().toString(36).substring(2, 11);
                                const oldElId = el.id || `old-el-${Math.random()}`;
                                elIdMap[oldElId] = newElId;
                                el.id = newElId;
                            });

                            quizSlide.elements.forEach(el => {
                                if (el.type === 'btn-show-ans' && el.targetElementId) {
                                    if (elIdMap[el.targetElementId]) {
                                        el.targetElementId = elIdMap[el.targetElementId];
                                    }
                                }
                                if (el.type === 'btn-toggle' && el.actions) {
                                    el.actions.forEach(act => {
                                        if (elIdMap[act.targetId]) {
                                            act.targetId = elIdMap[act.targetId];
                                        }
                                    });
                                }
                            });

                            quizSlide.id = 'slide-' + Math.random().toString(36).substring(2, 11);
                            
                            if (!state.project) {
                                state.project = {
                                    id: 'proj-' + Math.random().toString(36).substring(2, 11),
                                    name: "AI Quiz Project",
                                    slides: []
                                };
                            }
                            
                            state.project.slides.push(quizSlide);
                            state.selectedSlideId = quizSlide.id;
                            state.selectedElementId = null;
                            state.selectedElementIds = [];

                            state.markUnsaved();
                            state.emit('slide-list-changed', state.project.slides);
                            state.emit('slide-changed', state.getActiveSlide());
                        }
                    }

                    if (progressText) progressText.textContent = "Slides rendered successfully!";
                    setTimeout(() => {
                        if (progressContainer) progressContainer.classList.add('hidden');
                    }, 1000);

                    promptInput.value = '';
                } else {
                    throw new Error("Invalid response format. Missing slides array.");
                }
            } catch (err) {
                console.error('[AI Generate Error]:', err);
                if (errorText) errorText.textContent = err.message || "Failed to generate slides.";
                if (errorBanner) errorBanner.classList.remove('hidden');
                if (progressContainer) progressContainer.classList.add('hidden');
            } finally {
                generateBtn.disabled = false;
                generateBtn.innerHTML = '<i data-lucide="sparkles" style="width: 16px; height: 16px;"></i> Generate Slides';
                if (window.lucide) lucide.createIcons();
            }
        };
    }

    // ==========================================
    // AI LAYOUT REFINEMENT BINDINGS
    // ==========================================
    const refineBtn = document.getElementById('btn-ai-refine-layout');
    const refinePromptInput = document.getElementById('ai-refine-prompt');
    const refineProgress = document.getElementById('ai-refine-progress');

    if (refineBtn) {
        refineBtn.onclick = async () => {
            const selectedIds = state.selectedElementIds || [];
            if (selectedIds.length === 0) {
                alert("Please select at least one element on the canvas to refine.");
                return;
            }

            const activeSlide = state.getActiveSlide();
            if (!activeSlide) return;

            const selectedElements = activeSlide.elements.filter(el => selectedIds.includes(el.id));
            if (selectedElements.length === 0) return;

            const promptVal = (refinePromptInput.value || '').trim();
            if (!promptVal) {
                alert("Please enter refinement instructions (e.g. 'align in 2 columns', 'stack vertically').");
                return;
            }

            refineBtn.disabled = true;
            refineBtn.textContent = "Refining...";
            if (refineProgress) refineProgress.classList.remove('hidden');

            try {
                const res = await window.SlideEngineAPI.refineLayout(selectedElements, promptVal);
                if (res.elements && Array.isArray(res.elements)) {
                    state.pushHistory();

                    res.elements.forEach(updatedEl => {
                        const originalEl = activeSlide.elements.find(el => el.id === updatedEl.id);
                        if (originalEl) {
                            const propsToUpdate = {};
                            if (updatedEl.x !== undefined) propsToUpdate.x = parseInt(updatedEl.x);
                            if (updatedEl.y !== undefined) propsToUpdate.y = parseInt(updatedEl.y);
                            if (updatedEl.width !== undefined) propsToUpdate.width = parseInt(updatedEl.width);
                            if (updatedEl.height !== undefined) propsToUpdate.height = parseInt(updatedEl.height);
                            if (updatedEl.align !== undefined) propsToUpdate.align = updatedEl.align;

                            state.updateElement(originalEl.id, propsToUpdate);
                        }
                    });

                    if (window.editorCanvas) {
                        window.editorCanvas.renderSlide(state.getActiveSlide());
                    }
                    
                    refinePromptInput.value = '';
                } else {
                    throw new Error(res.message || "Failed to parse refinement response.");
                }
            } catch (err) {
                console.error('[AI Refine Error]:', err);
                alert("Layout Refinement failed: " + err.message);
            } finally {
                refineBtn.disabled = false;
                refineBtn.innerHTML = '<i data-lucide="sparkles" style="width: 14px; height: 14px;"></i> Clean & Align Layout';
                if (refineProgress) refineProgress.classList.add('hidden');
                if (window.lucide) lucide.createIcons();
            }
        };
    }

    // ==========================================
    // AI ASSET GENERATOR BINDINGS
    // ==========================================
    const generateAssetBtn = document.getElementById('btn-ai-generate-asset');
    const assetPromptInput = document.getElementById('ai-asset-prompt');
    const assetProgress = document.getElementById('ai-asset-progress');
    const assetProgressText = document.getElementById('ai-asset-progress-text');
    const assetError = document.getElementById('ai-asset-error');
    const assetErrorText = document.getElementById('ai-asset-error-text');

    if (generateAssetBtn) {
        generateAssetBtn.onclick = async () => {
            const promptVal = (assetPromptInput.value || '').trim();
            if (!promptVal) {
                alert("Please enter a description for the illustration to generate.");
                return;
            }

            const activeSlide = state.getActiveSlide();
            if (!activeSlide) {
                alert("Please select or add a slide first.");
                return;
            }

            generateAssetBtn.disabled = true;
            generateAssetBtn.textContent = "Generating...";
            if (assetProgress) assetProgress.classList.remove('hidden');
            if (assetError) assetError.classList.add('hidden');
            if (assetProgressText) assetProgressText.textContent = "Generating visual asset (usually takes 5-10s)...";

            try {
                const res = await window.SlideEngineAPI.generateAsset(promptVal);
                if (res.success && res.url) {
                    if (assetProgressText) assetProgressText.textContent = "Inserting asset into canvas...";

                    state.pushHistory();

                    const newElId = 'ai-image-' + Math.random().toString(36).substring(2, 9);
                    const newElement = {
                        id: newElId,
                        type: 'image',
                        x: 460,
                        y: 190,
                        width: 1000,
                        height: 700,
                        visible: true,
                        zIndex: activeSlide.elements.length + 1,
                        url: res.url,
                        fileData: null
                    };

                    activeSlide.elements.push(newElement);
                    state.selectedElementId = newElId;
                    state.selectedElementIds = [newElId];
                    state.markUnsaved();

                    state.emit('selection-changed', newElement);
                    state.emit('slide-changed', activeSlide);

                    if (window.editorCanvas) {
                        window.editorCanvas.renderSlide(activeSlide);
                    }

                    assetPromptInput.value = '';
                } else {
                    throw new Error(res.message || "Failed to generate visual asset.");
                }
            } catch (err) {
                console.error('[AI Asset Error]:', err);
                if (assetErrorText) assetErrorText.textContent = err.message || "Failed to generate image.";
                if (assetError) assetError.classList.remove('hidden');
            } finally {
                generateAssetBtn.disabled = false;
                generateAssetBtn.innerHTML = '<i data-lucide="image" style="width: 14px; height: 14px;"></i> Generate & Insert';
                if (assetProgress) assetProgress.classList.add('hidden');
                if (window.lucide) lucide.createIcons();
            }
        };
    }

    // ==========================================
    // AUTO-LAYOUT & SMART DISTRIBUTION ENGINE
    // ==========================================

    window.SlideLayoutEngine = {
        align(direction) {
            const slide = state.getActiveSlide();
            if (!slide) return;

            const selectedIds = state.selectedElementIds || [];
            if (selectedIds.length === 0) return;

            state.pushHistory();

            const elements = slide.elements.filter(e => selectedIds.includes(e.id));
            if (elements.length === 0) return;

            const canvasW = 1920;
            const canvasH = 1080;

            if (elements.length === 1) {
                // Align single element relative to canvas
                const el = elements[0];
                let newX = el.x;
                let newY = el.y;

                switch (direction) {
                    case 'left':
                        newX = 0;
                        break;
                    case 'center-h':
                        newX = Math.round((canvasW - el.width) / 2);
                        break;
                    case 'right':
                        newX = canvasW - el.width;
                        break;
                    case 'top':
                        newY = 0;
                        break;
                    case 'middle-v':
                        newY = Math.round((canvasH - el.height) / 2);
                        break;
                    case 'bottom':
                        newY = canvasH - el.height;
                        break;
                }

                state.updateElement(el.id, { x: newX, y: newY });
            } else {
                // Align multiple elements relative to collective bounding box
                const minX = Math.min(...elements.map(e => e.x));
                const maxX = Math.max(...elements.map(e => e.x + e.width));
                const minY = Math.min(...elements.map(e => e.y));
                const maxY = Math.max(...elements.map(e => e.y + e.height));
                const centerX = (minX + maxX) / 2;
                const centerY = (minY + maxY) / 2;

                elements.forEach(el => {
                    let newX = el.x;
                    let newY = el.y;

                    switch (direction) {
                        case 'left':
                            newX = minX;
                            break;
                        case 'center-h':
                            newX = Math.round(centerX - el.width / 2);
                            break;
                        case 'right':
                            newX = maxX - el.width;
                            break;
                        case 'top':
                            newY = minY;
                            break;
                        case 'middle-v':
                            newY = Math.round(centerY - el.height / 2);
                            break;
                        case 'bottom':
                            newY = maxY - el.height;
                            break;
                    }

                    state.updateElement(el.id, { x: newX, y: newY });
                });
            }

            state.markUnsaved();
            canvas.renderSlide(slide);
            canvas.drawSelectionUI();
            if (typeof window.updateFloatingMiniInspector === 'function') {
                window.updateFloatingMiniInspector();
            }
        },

        distribute(axis) {
            const slide = state.getActiveSlide();
            if (!slide) return;

            const selectedIds = state.selectedElementIds || [];
            if (selectedIds.length < 2) return;

            state.pushHistory();

            const elements = slide.elements.filter(e => selectedIds.includes(e.id));
            if (elements.length < 2) return;

            if (axis === 'horizontal') {
                elements.sort((a, b) => a.x - b.x);
                if (elements.length >= 3) {
                    const first = elements[0];
                    const last = elements[elements.length - 1];
                    const totalSpan = (last.x + last.width) - first.x;
                    const totalElemWidth = elements.reduce((acc, el) => acc + el.width, 0);
                    const gap = Math.max(10, (totalSpan - totalElemWidth) / (elements.length - 1));

                    let curX = first.x;
                    elements.forEach(el => {
                        state.updateElement(el.id, { x: Math.round(curX) });
                        curX += el.width + gap;
                    });
                } else {
                    // 2 elements: space symmetrically around selection center
                    const minX = Math.min(...elements.map(e => e.x));
                    const maxX = Math.max(...elements.map(e => e.x + e.width));
                    const mid = (minX + maxX) / 2;
                    const gap = 30;
                    state.updateElement(elements[0].id, { x: Math.round(mid - gap / 2 - elements[0].width) });
                    state.updateElement(elements[1].id, { x: Math.round(mid + gap / 2) });
                }
            } else if (axis === 'vertical') {
                elements.sort((a, b) => a.y - b.y);
                if (elements.length >= 3) {
                    const first = elements[0];
                    const last = elements[elements.length - 1];
                    const totalSpan = (last.y + last.height) - first.y;
                    const totalElemHeight = elements.reduce((acc, el) => acc + el.height, 0);
                    const gap = Math.max(10, (totalSpan - totalElemHeight) / (elements.length - 1));

                    let curY = first.y;
                    elements.forEach(el => {
                        state.updateElement(el.id, { y: Math.round(curY) });
                        curY += el.height + gap;
                    });
                } else {
                    const minY = Math.min(...elements.map(e => e.y));
                    const maxY = Math.max(...elements.map(e => e.y + e.height));
                    const mid = (minY + maxY) / 2;
                    const gap = 30;
                    state.updateElement(elements[0].id, { y: Math.round(mid - gap / 2 - elements[0].height) });
                    state.updateElement(elements[1].id, { y: Math.round(mid + gap / 2) });
                }
            }

            state.markUnsaved();
            canvas.renderSlide(slide);
            canvas.drawSelectionUI();
            if (typeof window.updateFloatingMiniInspector === 'function') {
                window.updateFloatingMiniInspector();
            }
        },

        autoStack(direction, customGap = null) {
            const slide = state.getActiveSlide();
            if (!slide) return;

            const selectedIds = state.selectedElementIds || [];
            if (selectedIds.length < 2) return;

            state.pushHistory();

            const elements = slide.elements.filter(e => selectedIds.includes(e.id));
            if (elements.length < 2) return;

            const gapInput = document.getElementById('layout-gap-input');
            const gap = customGap !== null ? customGap : (gapInput ? parseInt(gapInput.value) || 24 : 24);

            const startX = Math.min(...elements.map(e => e.x));
            const startY = Math.min(...elements.map(e => e.y));

            if (direction === 'row') {
                elements.sort((a, b) => a.x - b.x);
                let curX = startX;
                elements.forEach(el => {
                    state.updateElement(el.id, { x: Math.round(curX), y: Math.round(startY) });
                    curX += el.width + gap;
                });
            } else if (direction === 'column') {
                elements.sort((a, b) => a.y - b.y);
                let curY = startY;
                elements.forEach(el => {
                    state.updateElement(el.id, { x: Math.round(startX), y: Math.round(curY) });
                    curY += el.height + gap;
                });
            } else if (direction === 'grid') {
                // Arrange in 2-column grid in reading order
                elements.sort((a, b) => {
                    if (Math.abs(a.y - b.y) > 40) return a.y - b.y;
                    return a.x - b.x;
                });
                const cols = 2;
                const maxW = Math.max(...elements.map(e => e.width));
                const maxH = Math.max(...elements.map(e => e.height));

                elements.forEach((el, idx) => {
                    const r = Math.floor(idx / cols);
                    const c = idx % cols;
                    const newX = startX + c * (maxW + gap);
                    const newY = startY + r * (maxH + gap);
                    state.updateElement(el.id, { x: Math.round(newX), y: Math.round(newY) });
                });
            }

            state.markUnsaved();
            canvas.renderSlide(slide);
            canvas.drawSelectionUI();
            if (typeof window.updateFloatingMiniInspector === 'function') {
                window.updateFloatingMiniInspector();
            }
        }
    };

    // Bind Layout & Alignment Sidebar Buttons
    document.getElementById('btn-align-left')?.addEventListener('click', () => window.SlideLayoutEngine.align('left'));
    document.getElementById('btn-align-center-h')?.addEventListener('click', () => window.SlideLayoutEngine.align('center-h'));
    document.getElementById('btn-align-right')?.addEventListener('click', () => window.SlideLayoutEngine.align('right'));
    document.getElementById('btn-align-top')?.addEventListener('click', () => window.SlideLayoutEngine.align('top'));
    document.getElementById('btn-align-middle-v')?.addEventListener('click', () => window.SlideLayoutEngine.align('middle-v'));
    document.getElementById('btn-align-bottom')?.addEventListener('click', () => window.SlideLayoutEngine.align('bottom'));

    document.getElementById('btn-distribute-h')?.addEventListener('click', () => window.SlideLayoutEngine.distribute('horizontal'));
    document.getElementById('btn-distribute-v')?.addEventListener('click', () => window.SlideLayoutEngine.distribute('vertical'));

    document.getElementById('btn-stack-row')?.addEventListener('click', () => window.SlideLayoutEngine.autoStack('row'));
    document.getElementById('btn-stack-col')?.addEventListener('click', () => window.SlideLayoutEngine.autoStack('column'));
    document.getElementById('btn-stack-grid')?.addEventListener('click', () => window.SlideLayoutEngine.autoStack('grid'));

    // ==========================================
    // CONTEXTUAL FLOATING MINI-INSPECTOR (HUD BAR)
    // ==========================================

    function initFloatingMiniInspector() {
        const hud = document.getElementById('floating-mini-inspector');
        if (!hud) return;

        window.updateFloatingMiniInspectorPosition = () => {
            if (!hud || hud.classList.contains('hidden')) return;
            const selectedIds = state.selectedElementIds || [];
            if (selectedIds.length === 0) {
                hud.classList.add('hidden');
                return;
            }

            const slide = state.getActiveSlide();
            if (!slide) return;
            const elements = slide.elements.filter(e => selectedIds.includes(e.id));
            if (elements.length === 0) {
                hud.classList.add('hidden');
                return;
            }

            const minX = Math.min(...elements.map(e => e.x));
            const maxX = Math.max(...elements.map(e => e.x + e.width));
            const minY = Math.min(...elements.map(e => e.y));
            const maxY = Math.max(...elements.map(e => e.y + e.height));

            const canvasBox = document.getElementById('canvas-container');
            const outer = document.querySelector('.canvas-container-outer');
            if (!canvasBox || !outer) return;

            const canvasRect = canvasBox.getBoundingClientRect();
            const outerRect = outer.getBoundingClientRect();
            const zoom = canvas ? canvas.zoom : (canvasRect.width / 1920);

            const screenSelX = (canvasRect.left - outerRect.left) + (minX * zoom);
            const screenSelY = (canvasRect.top - outerRect.top) + (minY * zoom);
            const screenSelW = (maxX - minX) * zoom;
            const screenSelH = (maxY - minY) * zoom;

            const hudW = hud.offsetWidth || 340;
            const hudH = hud.offsetHeight || 42;

            let posX = screenSelX + (screenSelW / 2) - (hudW / 2);
            let posY = screenSelY - hudH - 12;

            // Flip below if too close to top of outer container
            if (posY < 8) {
                posY = screenSelY + screenSelH + 12;
            }

            // Clamp inside outer container
            posX = Math.max(10, Math.min(outerRect.width - hudW - 10, posX));

            hud.style.left = `${posX}px`;
            hud.style.top = `${posY}px`;
        };

        window.updateFloatingMiniInspector = () => {
            const selectedIds = state.selectedElementIds || [];
            if (selectedIds.length === 0) {
                hud.classList.add('hidden');
                return;
            }

            const slide = state.getActiveSlide();
            if (!slide) {
                hud.classList.add('hidden');
                return;
            }

            const elements = slide.elements.filter(e => selectedIds.includes(e.id));
            if (elements.length === 0) {
                hud.classList.add('hidden');
                return;
            }

            const primaryElem = elements.find(e => e.id === state.selectedElementId) || elements[0];
            const isTextLike = primaryElem.type === 'text' || primaryElem.type.startsWith('btn-') || primaryElem.type === 'timer' || primaryElem.text !== undefined;
            const isShapeLike = primaryElem.type === 'shape' || primaryElem.shapeType !== undefined || primaryElem.bgColor !== undefined;

            const textGroup = document.getElementById('hud-text-group');
            const shapeGroup = document.getElementById('hud-shape-group');

            if (textGroup) {
                if (isTextLike) {
                    textGroup.classList.remove('hidden');
                    const fontValEl = document.getElementById('hud-font-size-val');
                    if (fontValEl) fontValEl.textContent = primaryElem.fontSize || 24;
                    const currentTxtCol = primaryElem.textColor && primaryElem.textColor !== 'transparent' ? primaryElem.textColor : '#ffffff';
                    const colSwatch = document.getElementById('hud-text-swatch');
                    const textBtn = document.getElementById('hud-btn-text-color');
                    if (colSwatch) {
                        colSwatch.style.backgroundColor = primaryElem.textColor === 'transparent' ? 'transparent' : currentTxtCol;
                    }
                    if (textBtn) {
                        if (primaryElem.textColor === 'transparent') textBtn.classList.add('color-transparent');
                        else textBtn.classList.remove('color-transparent');
                    }
                } else {
                    textGroup.classList.add('hidden');
                }
            }

            if (shapeGroup) {
                if (isShapeLike && !isTextLike) {
                    shapeGroup.classList.remove('hidden');
                    const currentFill = primaryElem.bgColor && primaryElem.bgColor !== 'transparent' ? primaryElem.bgColor : '#3b82f6';
                    const fillSwatch = document.getElementById('hud-shape-fill-swatch');
                    const fillBtn = document.getElementById('hud-btn-shape-fill');
                    if (fillSwatch) {
                        fillSwatch.style.backgroundColor = primaryElem.bgColor === 'transparent' ? 'transparent' : currentFill;
                    }
                    if (fillBtn) {
                        if (primaryElem.bgColor === 'transparent') fillBtn.classList.add('color-transparent');
                        else fillBtn.classList.remove('color-transparent');
                    }

                    const currentBorder = primaryElem.borderColor && primaryElem.borderColor !== 'transparent' ? primaryElem.borderColor : '#ffffff';
                    const borderSwatch = document.getElementById('hud-shape-border-swatch');
                    const borderBtn = document.getElementById('hud-btn-shape-border');
                    if (borderSwatch) {
                        borderSwatch.style.backgroundColor = primaryElem.borderColor === 'transparent' ? 'transparent' : currentBorder;
                    }
                    if (borderBtn) {
                        if (primaryElem.borderColor === 'transparent') borderBtn.classList.add('color-transparent');
                        else borderBtn.classList.remove('color-transparent');
                    }

                    const borderValEl = document.getElementById('hud-border-width-val');
                    if (borderValEl) borderValEl.textContent = primaryElem.borderWidth || 0;
                    const radiusValEl = document.getElementById('hud-radius-val');
                    if (radiusValEl) radiusValEl.textContent = primaryElem.borderRadius || 0;
                } else {
                    shapeGroup.classList.add('hidden');
                }
            }

            // Update target indicator in layout section
            const targetInd = document.getElementById('layout-target-indicator');
            if (targetInd) {
                targetInd.textContent = elements.length > 1 ? `Selection (${elements.length})` : 'Canvas';
            }

            hud.classList.remove('hidden');
            window.updateFloatingMiniInspectorPosition();
            if (window.lucide) lucide.createIcons();
        };

        // Text HUD Tools
        document.getElementById('hud-font-down')?.addEventListener('click', () => {
            const primaryElem = state.getActiveElement();
            if (!primaryElem) return;
            state.pushHistory();
            const newSize = Math.max(8, (primaryElem.fontSize || 24) - 2);
            updateActiveElem({ fontSize: newSize });
            const fontValEl = document.getElementById('hud-font-size-val');
            if (fontValEl) fontValEl.textContent = newSize;
            const sideInput = document.getElementById('elem-font-size');
            if (sideInput) sideInput.value = newSize;
            canvas.renderSlide(state.getActiveSlide());
            canvas.drawSelectionUI();
        });

        document.getElementById('hud-font-up')?.addEventListener('click', () => {
            const primaryElem = state.getActiveElement();
            if (!primaryElem) return;
            state.pushHistory();
            const newSize = Math.min(160, (primaryElem.fontSize || 24) + 2);
            updateActiveElem({ fontSize: newSize });
            const fontValEl = document.getElementById('hud-font-size-val');
            if (fontValEl) fontValEl.textContent = newSize;
            const sideInput = document.getElementById('elem-font-size');
            if (sideInput) sideInput.value = newSize;
            canvas.renderSlide(state.getActiveSlide());
            canvas.drawSelectionUI();
        });

        // Text Color: Exclusively uses Custom Color Editor
        const hudBtnTextColor = document.getElementById('hud-btn-text-color');
        hudBtnTextColor?.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!customPicker.classList.contains('hidden') && customPickerActivePair && customPickerActivePair.picker === hudBtnTextColor) {
                closeCustomColorPicker();
                return;
            }
            state.pushHistory();
            const hexInp = document.getElementById('elem-text-color-hex');
            openCustomColorPicker(hudBtnTextColor, hexInp, (color) => {
                const swatch = document.getElementById('hud-text-swatch');
                if (swatch) swatch.style.backgroundColor = color === 'transparent' ? 'transparent' : color;
                if (hudBtnTextColor) {
                    if (color === 'transparent') hudBtnTextColor.classList.add('color-transparent');
                    else hudBtnTextColor.classList.remove('color-transparent');
                }
                updateActiveElem({ textColor: color });
                const sideInp = document.getElementById('elem-text-color');
                if (sideInp) sideInp.value = color === 'transparent' ? '#000000' : color;
                canvas.renderSlide(state.getActiveSlide());
                canvas.drawSelectionUI();
            });
        });

        document.getElementById('hud-align-left')?.addEventListener('click', () => {
            state.pushHistory();
            updateActiveElem({ align: 'left' });
            const sideAlign = document.getElementById('elem-align');
            if (sideAlign) sideAlign.value = 'left';
            canvas.renderSlide(state.getActiveSlide());
            canvas.drawSelectionUI();
        });

        document.getElementById('hud-align-center')?.addEventListener('click', () => {
            state.pushHistory();
            updateActiveElem({ align: 'center' });
            const sideAlign = document.getElementById('elem-align');
            if (sideAlign) sideAlign.value = 'center';
            canvas.renderSlide(state.getActiveSlide());
            canvas.drawSelectionUI();
        });

        document.getElementById('hud-align-right')?.addEventListener('click', () => {
            state.pushHistory();
            updateActiveElem({ align: 'right' });
            const sideAlign = document.getElementById('elem-align');
            if (sideAlign) sideAlign.value = 'right';
            canvas.renderSlide(state.getActiveSlide());
            canvas.drawSelectionUI();
        });

        // Shape HUD Tools: Exclusively uses Custom Color Editor
        const hudBtnShapeFill = document.getElementById('hud-btn-shape-fill');
        hudBtnShapeFill?.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!customPicker.classList.contains('hidden') && customPickerActivePair && customPickerActivePair.picker === hudBtnShapeFill) {
                closeCustomColorPicker();
                return;
            }
            state.pushHistory();
            const hexInp = document.getElementById('elem-bg-color-hex');
            openCustomColorPicker(hudBtnShapeFill, hexInp, (color) => {
                const swatch = document.getElementById('hud-shape-fill-swatch');
                if (swatch) swatch.style.backgroundColor = color === 'transparent' ? 'transparent' : color;
                if (hudBtnShapeFill) {
                    if (color === 'transparent') hudBtnShapeFill.classList.add('color-transparent');
                    else hudBtnShapeFill.classList.remove('color-transparent');
                }
                updateActiveElem({ bgColor: color });
                const sideInp = document.getElementById('elem-bg-color');
                if (sideInp) sideInp.value = color === 'transparent' ? '#000000' : color;
                canvas.renderSlide(state.getActiveSlide());
                canvas.drawSelectionUI();
            });
        });

        const hudBtnShapeBorder = document.getElementById('hud-btn-shape-border');
        hudBtnShapeBorder?.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!customPicker.classList.contains('hidden') && customPickerActivePair && customPickerActivePair.picker === hudBtnShapeBorder) {
                closeCustomColorPicker();
                return;
            }
            state.pushHistory();
            const hexInp = document.getElementById('elem-border-color-hex');
            openCustomColorPicker(hudBtnShapeBorder, hexInp, (color) => {
                const swatch = document.getElementById('hud-shape-border-swatch');
                if (swatch) swatch.style.backgroundColor = color === 'transparent' ? 'transparent' : color;
                if (hudBtnShapeBorder) {
                    if (color === 'transparent') hudBtnShapeBorder.classList.add('color-transparent');
                    else hudBtnShapeBorder.classList.remove('color-transparent');
                }
                updateActiveElem({ borderColor: color, borderStyle: 'solid' });
                const sideInp = document.getElementById('elem-border-color');
                if (sideInp) sideInp.value = color === 'transparent' ? '#000000' : color;
                canvas.renderSlide(state.getActiveSlide());
                canvas.drawSelectionUI();
            });
        });

        document.getElementById('hud-border-width-toggle')?.addEventListener('click', () => {
            const primaryElem = state.getActiveElement();
            if (!primaryElem) return;
            state.pushHistory();
            const widths = [0, 3, 6, 12];
            const curW = primaryElem.borderWidth || 0;
            const nextIdx = (widths.indexOf(curW) + 1) % widths.length;
            const newW = widths[nextIdx];
            const newStyle = newW > 0 ? (primaryElem.borderStyle && primaryElem.borderStyle !== 'none' ? primaryElem.borderStyle : 'solid') : 'none';
            updateActiveElem({ borderWidth: newW, borderStyle: newStyle });
            const valBadge = document.getElementById('hud-border-width-val');
            if (valBadge) valBadge.textContent = newW;
            const sideW = document.getElementById('elem-border-width');
            if (sideW) sideW.value = newW;
            canvas.renderSlide(state.getActiveSlide());
            canvas.drawSelectionUI();
        });

        document.getElementById('hud-radius-toggle')?.addEventListener('click', () => {
            const primaryElem = state.getActiveElement();
            if (!primaryElem) return;
            state.pushHistory();
            const radii = [0, 8, 16, 24, 50];
            const curR = primaryElem.borderRadius || 0;
            const nextIdx = (radii.indexOf(curR) + 1) % radii.length;
            const newR = radii[nextIdx];
            updateActiveElem({ borderRadius: newR });
            const valBadge = document.getElementById('hud-radius-val');
            if (valBadge) valBadge.textContent = newR;
            const sideR = document.getElementById('elem-border-radius');
            if (sideR) sideR.value = newR;
            canvas.renderSlide(state.getActiveSlide());
            canvas.drawSelectionUI();
        });

        // Common HUD Tools
        document.getElementById('hud-quick-center-h')?.addEventListener('click', () => {
            window.SlideLayoutEngine.align('center-h');
        });
        document.getElementById('hud-quick-center-v')?.addEventListener('click', () => {
            window.SlideLayoutEngine.align('middle-v');
        });
        document.getElementById('hud-bring-front')?.addEventListener('click', () => {
            if (state.selectedElementId) state.moveElementZIndex(state.selectedElementId, 'bring-front');
        });
        document.getElementById('hud-send-back')?.addEventListener('click', () => {
            if (state.selectedElementId) state.moveElementZIndex(state.selectedElementId, 'send-back');
        });
        document.getElementById('hud-duplicate')?.addEventListener('click', () => {
            state.copyElements();
            state.pasteElements();
        });
        document.getElementById('hud-delete')?.addEventListener('click', () => {
            const selectedIds = state.selectedElementIds || [];
            if (selectedIds.length > 0) {
                state.deleteElements(selectedIds);
                hud.classList.add('hidden');
            }
        });

        // Responsive positioning events
        window.addEventListener('resize', window.updateFloatingMiniInspectorPosition);
        document.querySelector('.canvas-container-outer')?.addEventListener('scroll', window.updateFloatingMiniInspectorPosition);
    }

    function initInspectorAccordions() {
        const accordionHeaders = document.querySelectorAll('.inspector-accordion .accordion-header');
        accordionHeaders.forEach(header => {
            const toggle = () => {
                const item = header.closest('.inspector-accordion-item');
                if (!item) return;
                const isOpen = item.classList.contains('open');
                if (isOpen) {
                    item.classList.remove('open');
                    header.setAttribute('aria-expanded', 'false');
                } else {
                    item.classList.add('open');
                    header.setAttribute('aria-expanded', 'true');
                }
            };

            header.addEventListener('click', (e) => {
                if (e.target.closest('button, input, select, textarea, a, .btn-icon')) return;
                toggle();
            });

            header.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggle();
                }
            });
        });

        if (window.lucide) {
            lucide.createIcons();
        }
    }

    // =========================================================================
    // STUDIO PRO FONT PICKER CATALOG & POPOVER ENGINE
    // =========================================================================
    const GOOGLE_FONTS_CATALOG = [
        // Sans (9)
        { name: 'Outfit', category: 'sans', tag: 'Clean', sample: 'Modern & clean geometry' },
        { name: 'Inter', category: 'sans', tag: 'Sleek', sample: 'Hyper-legible interface font' },
        { name: 'Montserrat', category: 'sans', tag: 'Modern', sample: 'Bold geometric statement' },
        { name: 'Space Grotesk', category: 'sans', tag: 'Tech', sample: 'Futuristic monospace rhythm' },
        { name: 'Comfortaa', category: 'sans', tag: 'Rounded', sample: 'Smooth rounded curves' },
        { name: 'Quicksand', category: 'sans', tag: 'Friendly', sample: 'Friendly approachable warmth' },
        { name: 'Oswald', category: 'sans', tag: 'Condensed', sample: 'Impactful condensed headlines' },
        { name: 'Josefin Sans', category: 'sans', tag: 'Vintage', sample: 'Elegant vintage geometry' },
        { name: 'Arial', category: 'sans', tag: 'System', sample: 'Universal neutral standard' },

        // Serif (7)
        { name: 'Playfair Display', category: 'serif', tag: 'Editorial', sample: 'High-contrast luxury elegance' },
        { name: 'Cinzel', category: 'serif', tag: 'Classic', sample: 'Roman inscription authority' },
        { name: 'Cinzel Decorative', category: 'serif', tag: 'Ornate', sample: 'Majestic classical capitals' },
        { name: 'Cormorant Garamond', category: 'serif', tag: 'Garamond', sample: 'Graceful Renaissance poetry' },
        { name: 'Abril Fatface', category: 'serif', tag: 'Contrast', sample: 'Dramatic editorial display' },
        { name: 'Cardo', category: 'serif', tag: 'Academic', sample: 'Scholarly humanist elegance' },
        { name: 'Georgia', category: 'serif', tag: 'System', sample: 'Refined book typography' },

        // Display (5)
        { name: 'Unbounded', category: 'display', tag: 'Futurist', sample: 'Expansive sci-fi presence' },
        { name: 'Bebas Neue', category: 'display', tag: 'Impact', sample: 'MONUMENTAL ALL-CAPS' },
        { name: 'Righteous', category: 'display', tag: 'Retro', sample: 'Neon grid art deco' },
        { name: 'Russo One', category: 'display', tag: 'Heavy', sample: 'Bold cybernetic power' },
        { name: 'Permanent Marker', category: 'display', tag: 'Brush', sample: 'Expressive raw marker strokes' },

        // Script (7)
        { name: 'Lobster', category: 'script', tag: 'Bold Script', sample: 'Playful vintage script charm' },
        { name: 'Satisfy', category: 'script', tag: 'Cursive', sample: 'Flourished handwriting flair' },
        { name: 'Dancing Script', category: 'script', tag: 'Casual', sample: 'Lively bouncing rhythm' },
        { name: 'Courgette', category: 'script', tag: 'Calligraphy', sample: 'Compact calligraphic touch' },
        { name: 'Pacifico', category: 'script', tag: 'Brush', sample: 'Breezy Californian cursive' },
        { name: 'Kaushan Script', category: 'script', tag: 'Expressive', sample: 'Dynamic energetic paintbrush' },
        { name: 'Shadows Into Light', category: 'script', tag: 'Handwritten', sample: 'Delicate personal signature' },

        // Mono (4)
        { name: 'Fira Code', category: 'mono', tag: 'Code', sample: 'const future = true => dev;' },
        { name: 'Space Mono', category: 'mono', tag: 'Geometric', sample: '0101 TECH PROTOCOL' },
        { name: 'Courier New', category: 'mono', tag: 'System', sample: 'Classic typewriter precision' },
        { name: 'Rajdhani', category: 'mono', tag: 'Squared', sample: 'Squared aerospace HUD specs' },

        // Pixel (3)
        { name: 'Press Start 2P', category: 'pixel', tag: '8-Bit', sample: 'GAME OVER! INSERT COIN' },
        { name: 'VT323', category: 'pixel', tag: 'Arcade', sample: 'TERMINAL READY > RUN APP' },
        { name: 'Silkscreen', category: 'pixel', tag: 'Retro Grid', sample: 'MICRO PIXEL DISPLAY 1984' }
    ];

    function initStudioFontPicker() {
        const triggerBtn = document.getElementById('btn-font-picker-trigger');
        const popover = document.getElementById('studio-font-picker-popover');
        const searchInput = document.getElementById('font-picker-search-input');
        const btnClearSearch = document.getElementById('btn-clear-font-search');
        const categoriesContainer = document.getElementById('font-picker-categories');
        const categoryPills = categoriesContainer ? categoriesContainer.querySelectorAll('.font-pill') : document.querySelectorAll('.font-pill');
        const recentsSection = document.getElementById('font-picker-recents-section');
        const recentList = document.getElementById('font-picker-recent-list');
        const catalogList = document.getElementById('font-picker-catalog-list');
        const catalogTitle = document.getElementById('font-picker-catalog-title');
        const emptyState = document.getElementById('font-picker-empty');
        const btnClearRecents = document.getElementById('btn-clear-recent-fonts');
        const fontSelect = document.getElementById('elem-font-family');
        const selectedFontNameEl = document.getElementById('selected-font-name');
        const selectedFontBadgeEl = document.getElementById('selected-font-badge');
        const fontTriggerGlyph = document.getElementById('font-trigger-glyph');

        if (!triggerBtn || !popover) return;

        let activeCategory = 'all';
        let searchQuery = '';

        const STORAGE_KEY = 'studio_recent_fonts';

        function getRecentFonts() {
            try {
                const stored = localStorage.getItem(STORAGE_KEY);
                if (stored) {
                    const parsed = JSON.parse(stored);
                    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
                }
            } catch (e) {}
            return ['Outfit', 'Inter', 'Playfair Display'];
        }

        function saveRecentFont(fontName) {
            try {
                let recents = getRecentFonts().filter(f => f.toLowerCase() !== fontName.toLowerCase());
                recents.unshift(fontName);
                if (recents.length > 5) recents = recents.slice(0, 5);
                localStorage.setItem(STORAGE_KEY, JSON.stringify(recents));
            } catch (e) {}
        }

        function getCurrentFont() {
            const elem = state.getActiveElement ? state.getActiveElement() : null;
            if (elem && elem.fontFamily) return elem.fontFamily;
            if (fontSelect && fontSelect.value) return fontSelect.value;
            return 'Outfit';
        }

        function updateTriggerUI(fontName) {
            const font = fontName || getCurrentFont();
            if (selectedFontNameEl) selectedFontNameEl.textContent = font;
            const meta = GOOGLE_FONTS_CATALOG.find(f => f.name.toLowerCase() === font.toLowerCase());
            if (selectedFontBadgeEl) {
                selectedFontBadgeEl.textContent = meta ? meta.category.toUpperCase() : 'FONT';
            }
            if (fontTriggerGlyph) {
                fontTriggerGlyph.style.fontFamily = `'${font}', sans-serif`;
            }
        }

        function selectFont(fontName) {
            state.pushHistory();
            saveRecentFont(fontName);

            if (fontSelect) {
                fontSelect.value = fontName;
                fontSelect.dispatchEvent(new Event('change', { bubbles: true }));
            } else {
                updateActiveElemAndSave({ fontFamily: fontName });
            }

            updateTriggerUI(fontName);
            closeFontPickerPopover();

            const slide = state.getActiveSlide ? state.getActiveSlide() : null;
            if (slide && canvas && canvas.renderSlide) {
                canvas.renderSlide(slide);
            }
        }

        function createFontCard(fontObj, isActive) {
            const card = document.createElement('div');
            card.className = `font-specimen-card${isActive ? ' active' : ''}`;
            card.setAttribute('data-font', fontObj.name);
            card.innerHTML = `
                <div class="font-card-main">
                    <div class="font-card-name-row">
                        <span class="font-card-name">${fontObj.name}</span>
                        <span class="font-card-tag">${fontObj.tag}</span>
                    </div>
                    <div class="font-card-sample" style="font-family: '${fontObj.name}', sans-serif;">
                        ${fontObj.sample}
                    </div>
                </div>
                <i data-lucide="check" class="font-card-check"></i>
            `;
            card.addEventListener('click', (e) => {
                e.stopPropagation();
                selectFont(fontObj.name);
            });
            return card;
        }

        function renderFontLists() {
            const currentFont = getCurrentFont().toLowerCase();
            const query = searchQuery.trim().toLowerCase();

            // Filter catalog
            const filteredCatalog = GOOGLE_FONTS_CATALOG.filter(font => {
                const matchesCat = (activeCategory === 'all' || font.category === activeCategory);
                const matchesQuery = !query || font.name.toLowerCase().includes(query) || font.tag.toLowerCase().includes(query) || font.category.toLowerCase().includes(query);
                return matchesCat && matchesQuery;
            });

            // Recents section: show only if no search query
            const recents = getRecentFonts();
            if (!query && activeCategory === 'all' && recents.length > 0) {
                recentsSection.style.display = 'block';
                recentList.innerHTML = '';
                recents.forEach(fontName => {
                    const fontObj = GOOGLE_FONTS_CATALOG.find(f => f.name.toLowerCase() === fontName.toLowerCase()) || {
                        name: fontName,
                        category: 'custom',
                        tag: 'Recent',
                        sample: 'The quick brown fox jumps'
                    };
                    const isCur = fontObj.name.toLowerCase() === currentFont;
                    recentList.appendChild(createFontCard(fontObj, isCur));
                });
            } else {
                recentsSection.style.display = 'none';
            }

            // Catalog list
            catalogList.innerHTML = '';
            if (catalogTitle) {
                if (query) {
                    catalogTitle.textContent = `Search Results (${filteredCatalog.length})`;
                } else if (activeCategory !== 'all') {
                    catalogTitle.textContent = `${activeCategory.toUpperCase()} Fonts (${filteredCatalog.length})`;
                } else {
                    catalogTitle.textContent = `All Fonts (${filteredCatalog.length})`;
                }
            }

            if (filteredCatalog.length === 0) {
                emptyState.classList.remove('hidden');
            } else {
                emptyState.classList.add('hidden');
                filteredCatalog.forEach(fontObj => {
                    const isCur = fontObj.name.toLowerCase() === currentFont;
                    catalogList.appendChild(createFontCard(fontObj, isCur));
                });
            }

            if (window.lucide) {
                lucide.createIcons();
            }
        }

        function repositionFontPicker() {
            if (popover.classList.contains('hidden') || !triggerBtn) return;
            const rect = triggerBtn.getBoundingClientRect();

            let top = rect.bottom + 6;
            let left = rect.left;

            const popoverWidth = popover.offsetWidth || 320;
            const popoverHeight = popover.offsetHeight || 420;

            if (left + popoverWidth > window.innerWidth - 12) {
                left = window.innerWidth - popoverWidth - 12;
            }
            if (left < 12) left = 12;

            const viewportBottom = window.innerHeight;
            if (top + popoverHeight > viewportBottom - 12) {
                const topPlacement = rect.top - popoverHeight - 6;
                if (topPlacement >= 12) {
                    top = topPlacement;
                } else {
                    top = Math.max(12, viewportBottom - popoverHeight - 12);
                }
            }

            popover.style.top = `${top}px`;
            popover.style.left = `${left}px`;
        }

        function openFontPickerPopover() {
            popover.classList.remove('hidden');
            triggerBtn.classList.add('active');
            searchQuery = '';
            if (searchInput) searchInput.value = '';
            if (btnClearSearch) btnClearSearch.classList.add('hidden');
            activeCategory = 'all';
            categoryPills.forEach(p => p.classList.toggle('active', p.getAttribute('data-cat') === 'all'));
            renderFontLists();
            repositionFontPicker();
            setTimeout(() => {
                if (searchInput) searchInput.focus();
            }, 50);
        }

        function closeFontPickerPopover() {
            popover.classList.add('hidden');
            triggerBtn.classList.remove('active');
        }

        triggerBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (popover.classList.contains('hidden')) {
                openFontPickerPopover();
            } else {
                closeFontPickerPopover();
            }
        });

        // Search input events
        searchInput?.addEventListener('input', (e) => {
            searchQuery = e.target.value;
            if (btnClearSearch) {
                btnClearSearch.classList.toggle('hidden', !searchQuery);
            }
            renderFontLists();
        });

        btnClearSearch?.addEventListener('click', () => {
            if (searchInput) {
                searchInput.value = '';
                searchQuery = '';
                btnClearSearch.classList.add('hidden');
                searchInput.focus();
                renderFontLists();
            }
        });

        // Category pills events
        categoryPills.forEach(pill => {
            pill.addEventListener('click', () => {
                categoryPills.forEach(p => p.classList.remove('active'));
                pill.classList.add('active');
                activeCategory = pill.getAttribute('data-cat') || 'all';
                renderFontLists();
            });
        });

        // Clear recents
        btnClearRecents?.addEventListener('click', (e) => {
            e.stopPropagation();
            try {
                localStorage.removeItem(STORAGE_KEY);
            } catch (err) {}
            renderFontLists();
        });

        // Close on outside click
        document.addEventListener('mousedown', (e) => {
            if (!popover.classList.contains('hidden')) {
                if (!popover.contains(e.target) && !triggerBtn.contains(e.target)) {
                    closeFontPickerPopover();
                }
            }
        });

        // Reposition on window resize
        window.addEventListener('resize', () => {
            if (!popover.classList.contains('hidden')) {
                repositionFontPicker();
            }
        });

        // Initialize trigger text
        updateTriggerUI();

        // Also update trigger whenever elem-font-family changes
        fontSelect?.addEventListener('change', (e) => {
            updateTriggerUI(e.target.value);
        });

        // Expose helper to window
        window.updateStudioFontTrigger = updateTriggerUI;
    }

    // =========================================================================
    // STUDIO PRO TYPOGRAPHY & CONTENT ENGINE
    // =========================================================================
    function initTypographyStudio() {
        const textInput = document.getElementById('elem-text');
        const charBadge = document.getElementById('elem-text-char-count');
        const clearBtn = document.getElementById('btn-text-clear');
        const weightSelect = document.getElementById('elem-font-weight');
        const sizeInput = document.getElementById('elem-font-size');
        const decBtn = document.getElementById('btn-font-size-dec');
        const incBtn = document.getElementById('btn-font-size-inc');
        const scrubWrapper = document.getElementById('font-size-scrub-wrapper');
        const alignSelect = document.getElementById('elem-align');
        const alignBtns = document.querySelectorAll('.btn-typo-align');
        const alignLeftBtn = document.getElementById('btn-text-align-left');
        const alignCenterBtn = document.getElementById('btn-text-align-center');
        const alignRightBtn = document.getElementById('btn-text-align-right');
        const boldBtn = document.getElementById('btn-text-format-bold');
        const italicBtn = document.getElementById('btn-text-format-italic');
        const underlineBtn = document.getElementById('btn-text-format-underline');
        const uppercaseBtn = document.getElementById('btn-text-format-uppercase');
        const strikethroughBtn = document.getElementById('btn-text-format-strikethrough');
        const colorTrigger = document.getElementById('btn-text-color-trigger');
        const colorHex = document.getElementById('elem-text-color-hex');
        const colorNative = document.getElementById('elem-text-color');
        const colorPreview = document.getElementById('text-color-swatch-preview');
        const lineHeightInput = document.getElementById('elem-line-height');
        const letterSpacingInput = document.getElementById('elem-letter-spacing');

        // Character counter
        const updateCharCount = () => {
            if (charBadge && textInput) {
                const len = textInput.value ? textInput.value.length : 0;
                charBadge.textContent = `${len} char${len === 1 ? '' : 's'}`;
            }
        };
        textInput?.addEventListener('input', updateCharCount);

        // Quick clear text button
        clearBtn?.addEventListener('click', () => {
            if (!textInput) return;
            state.pushHistory();
            textInput.value = '';
            updateCharCount();
            updateActiveElemAndSave({ text: '' });
        });

        // Font weight selector
        weightSelect?.addEventListener('change', (e) => {
            state.pushHistory();
            const val = e.target.value;
            const isBold = parseInt(val) >= 700;
            updateActiveElemAndSave({ fontWeight: val, isBold });
            if (boldBtn) boldBtn.classList.toggle('active', isBold);
        });

        // Font size stepper buttons
        const changeFontSize = (delta) => {
            if (!sizeInput) return;
            state.pushHistory();
            const cur = parseInt(sizeInput.value) || 24;
            const newVal = Math.max(8, Math.min(144, cur + delta));
            sizeInput.value = newVal;
            updateActiveElemAndSave({ fontSize: newVal });
        };
        decBtn?.addEventListener('click', () => changeFontSize(-2));
        incBtn?.addEventListener('click', () => changeFontSize(2));

        // Horizontal size drag scrubbing
        if (scrubWrapper && sizeInput) {
            let startX = 0;
            let startVal = 24;
            let isScrubbing = false;

            scrubWrapper.addEventListener('pointerdown', (e) => {
                if (e.target === sizeInput) return;
                e.preventDefault();
                startX = e.clientX;
                startVal = parseInt(sizeInput.value) || 24;
                isScrubbing = false;
                scrubWrapper.setPointerCapture(e.pointerId);

                const onMove = (ev) => {
                    const dx = ev.clientX - startX;
                    if (Math.abs(dx) > 2) {
                        if (!isScrubbing) {
                            isScrubbing = true;
                            state.pushHistory();
                        }
                        const multiplier = ev.shiftKey ? 5 : (ev.altKey ? 0.5 : 1);
                        const delta = Math.round(dx / 3) * multiplier;
                        const newVal = Math.max(8, Math.min(144, Math.round(startVal + delta)));
                        sizeInput.value = newVal;
                        updateActiveElem({ fontSize: newVal });
                    }
                };

                const onUp = (ev) => {
                    scrubWrapper.removeEventListener('pointermove', onMove);
                    scrubWrapper.removeEventListener('pointerup', onUp);
                    scrubWrapper.removeEventListener('pointercancel', onUp);
                    if (isScrubbing) {
                        const finalVal = parseInt(sizeInput.value) || 24;
                        updateActiveElemAndSave({ fontSize: finalVal });
                    }
                };

                scrubWrapper.addEventListener('pointermove', onMove);
                scrubWrapper.addEventListener('pointerup', onUp);
                scrubWrapper.addEventListener('pointercancel', onUp);
            });
        }

        // Segmented alignment toolbar
        alignBtns.forEach((btn) => {
            btn.addEventListener('click', () => {
                const alignVal = btn.getAttribute('data-align');
                state.pushHistory();
                alignBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                if (alignSelect) alignSelect.value = alignVal;
                updateActiveElemAndSave({ align: alignVal });
            });
        });

        // Sync when alignSelect changes externally (e.g. from Floating Mini-Inspector)
        alignSelect?.addEventListener('change', () => {
            const val = alignSelect.value;
            alignBtns.forEach(b => {
                b.classList.toggle('active', b.getAttribute('data-align') === val);
            });
        });

        // Formatting Toggles: Bold, Italic, Underline, Uppercase, Strikethrough
        const bindFormatToggle = (btn, propKey, extraUpdates) => {
            if (!btn) return;
            btn.addEventListener('click', () => {
                const elem = state.getActiveElement();
                const curState = elem ? !!elem[propKey] : btn.classList.contains('active');
                const nextState = !curState;
                state.pushHistory();
                btn.classList.toggle('active', nextState);
                const updates = { [propKey]: nextState };
                if (extraUpdates) Object.assign(updates, extraUpdates(nextState, elem));
                updateActiveElemAndSave(updates);
                const slide = state.getActiveSlide();
                if (slide) canvas.renderSlide(slide);
            });
        };

        bindFormatToggle(boldBtn, 'isBold', (active) => {
            const weightVal = active ? '700' : '400';
            if (weightSelect) weightSelect.value = weightVal;
            return { fontWeight: weightVal };
        });
        bindFormatToggle(italicBtn, 'isItalic');
        bindFormatToggle(underlineBtn, 'isUnderline');
        bindFormatToggle(uppercaseBtn, 'isUppercase');
        bindFormatToggle(strikethroughBtn, 'isStrikethrough');

        // Custom Color Editor Anchor for Typography
        colorTrigger?.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            state.pushHistory();
            openCustomColorPicker(colorTrigger, colorHex, (col) => {
                if (colorPreview) colorPreview.style.backgroundColor = col === 'transparent' ? 'transparent' : col;
                if (colorNative) colorNative.value = col === 'transparent' ? '#000000' : col;
                if (colorHex) colorHex.value = col;
                updateActiveElem({ textColor: col });
                canvas.renderSlide(state.getActiveSlide());
                canvas.drawSelectionUI();
            });
        });

        // Advanced Metrics: Line Height & Letter Spacing
        lineHeightInput?.addEventListener('input', (e) => {
            const raw = parseFloat(e.target.value);
            if (!isNaN(raw)) {
                updateActiveElem({ lineHeight: raw });
                const slide = state.getActiveSlide();
                if (slide) canvas.renderSlide(slide);
            }
        });
        lineHeightInput?.addEventListener('change', (e) => {
            state.pushHistory();
            const raw = parseFloat(e.target.value);
            const val = !isNaN(raw) ? raw : 1.2;
            updateActiveElemAndSave({ lineHeight: val });
            const slide = state.getActiveSlide();
            if (slide) canvas.renderSlide(slide);
        });

        letterSpacingInput?.addEventListener('input', (e) => {
            const raw = parseFloat(e.target.value);
            if (!isNaN(raw)) {
                updateActiveElem({ letterSpacing: raw });
                const slide = state.getActiveSlide();
                if (slide) canvas.renderSlide(slide);
            }
        });
        letterSpacingInput?.addEventListener('change', (e) => {
            state.pushHistory();
            const raw = parseFloat(e.target.value);
            const val = !isNaN(raw) ? raw : 0;
            updateActiveElemAndSave({ letterSpacing: val });
            const slide = state.getActiveSlide();
            if (slide) canvas.renderSlide(slide);
        });

        // Scrubbing on metric badges
        const setupMetricScrubber = (badgeSelector, inputElem, step, min, max, isFloat = false) => {
            const badge = document.querySelector(badgeSelector);
            if (!badge || !inputElem) return;
            let startX = 0;
            let startVal = 0;
            let isScrubbing = false;

            badge.addEventListener('pointerdown', (e) => {
                if (e.target === inputElem) return;
                e.preventDefault();
                startX = e.clientX;
                startVal = isFloat ? (parseFloat(inputElem.value) || 1.2) : (parseInt(inputElem.value) || 0);
                isScrubbing = false;
                badge.setPointerCapture(e.pointerId);

                const onMove = (ev) => {
                    const dx = ev.clientX - startX;
                    if (Math.abs(dx) > 2) {
                        if (!isScrubbing) {
                            isScrubbing = true;
                            state.pushHistory();
                        }
                        const delta = (dx / 10) * step;
                        let newVal = startVal + delta;
                        if (min !== undefined) newVal = Math.max(min, newVal);
                        if (max !== undefined) newVal = Math.min(max, newVal);
                        newVal = isFloat ? Math.round(newVal * 10) / 10 : Math.round(newVal);
                        inputElem.value = newVal;
                        inputElem.dispatchEvent(new Event('input'));
                    }
                };

                const onUp = (ev) => {
                    badge.removeEventListener('pointermove', onMove);
                    badge.removeEventListener('pointerup', onUp);
                    badge.removeEventListener('pointercancel', onUp);
                    if (isScrubbing) {
                        inputElem.dispatchEvent(new Event('change'));
                    }
                };

                badge.addEventListener('pointermove', onMove);
                badge.addEventListener('pointerup', onUp);
                badge.addEventListener('pointercancel', onUp);
            });
        };

        setupMetricScrubber('.typo-metric-badge[title*="Line Height"]', lineHeightInput, 0.1, 0.5, 3.0, true);
        setupMetricScrubber('.typo-metric-badge[title*="Letter Spacing"]', letterSpacingInput, 1, -10, 50, false);

        // Global sync function for Studio UI
        window.syncTypographyStudioUI = function(element) {
            if (!element) return;
            updateCharCount();

            // Font weight
            if (weightSelect) {
                const wt = element.fontWeight ? String(element.fontWeight) : (element.isBold ? '700' : '400');
                weightSelect.value = wt;
            }

            // Alignment buttons
            const currentAlign = element.align || (element.type && element.type.startsWith('btn-') ? 'center' : 'left');
            alignBtns.forEach(b => {
                b.classList.toggle('active', b.getAttribute('data-align') === currentAlign);
            });

            // Format toggles
            if (boldBtn) boldBtn.classList.toggle('active', !!(element.isBold || (element.fontWeight && parseInt(element.fontWeight) >= 700)));
            if (italicBtn) italicBtn.classList.toggle('active', !!element.isItalic);
            if (underlineBtn) underlineBtn.classList.toggle('active', !!element.isUnderline);
            if (uppercaseBtn) uppercaseBtn.classList.toggle('active', !!element.isUppercase);
            if (strikethroughBtn) strikethroughBtn.classList.toggle('active', !!element.isStrikethrough);

            // Color preview & inputs
            const col = element.textColor || '#ffffff';
            if (colorPreview) colorPreview.style.backgroundColor = col === 'transparent' ? 'transparent' : col;
            if (colorHex) colorHex.value = col;
            if (colorNative) colorNative.value = col === 'transparent' ? '#000000' : col;

            // Advanced metrics
            if (lineHeightInput) lineHeightInput.value = element.lineHeight !== undefined ? element.lineHeight : 1.2;
            if (letterSpacingInput) letterSpacingInput.value = element.letterSpacing !== undefined ? element.letterSpacing : 0;

            // Typeface trigger sync
            if (window.updateStudioFontTrigger) {
                window.updateStudioFontTrigger(element.fontFamily || 'Outfit');
            }
        };

        if (window.lucide) {
            lucide.createIcons();
        }
    }

    // =========================================================================
    // STUDIO PRO FILL & STROKE (APPEARANCE & STYLE) ENGINE
    // =========================================================================
    function initAppearanceStudio() {
        const bgTrigger = document.getElementById('btn-bg-color-trigger');
        const bgSwatch = document.getElementById('bg-color-swatch-preview');
        const bgHexLabel = document.getElementById('bg-color-hex-label');
        const bgNative = document.getElementById('elem-bg-color');
        const bgHexInput = document.getElementById('elem-bg-color-hex');

        const opacitySlider = document.getElementById('elem-bg-alpha-slider');
        const opacityBadge = document.getElementById('bg-opacity-scrub-wrapper');
        const opacityPctLabel = document.getElementById('bg-opacity-pct-label');
        const opacityNative = document.getElementById('elem-bg-alpha');
        const opacityGradientFill = document.getElementById('bg-opacity-gradient-fill');

        const updateOpacityGradientTrack = (color) => {
            if (!opacityGradientFill) return;
            const effectiveColor = (!color || color === 'transparent') ? '#ffffff' : color;
            opacityGradientFill.style.background = `linear-gradient(to right, transparent, ${effectiveColor})`;
        };

        const borderStyleSegmented = document.getElementById('border-style-segmented');
        const borderStyleButtons = borderStyleSegmented ? borderStyleSegmented.querySelectorAll('.btn-stroke-style') : [];
        const borderStyleSelect = document.getElementById('elem-border-style');

        const borderTrigger = document.getElementById('btn-border-color-trigger');
        const borderSwatch = document.getElementById('border-color-swatch-preview');
        const borderHexLabel = document.getElementById('border-color-hex-label');
        const borderNative = document.getElementById('elem-border-color');
        const borderHexInput = document.getElementById('elem-border-color-hex');

        const borderWidthInput = document.getElementById('elem-border-width');
        const borderWidthDec = document.getElementById('btn-border-width-dec');
        const borderWidthInc = document.getElementById('btn-border-width-inc');
        const borderWidthScrub = document.getElementById('border-width-scrub-wrapper');

        const borderRadiusInput = document.getElementById('elem-border-radius');
        const borderRadiusDec = document.getElementById('btn-border-radius-dec');
        const borderRadiusInc = document.getElementById('btn-border-radius-inc');
        const borderRadiusScrub = document.getElementById('border-radius-scrub-wrapper');
        const radiusPresetBtns = document.querySelectorAll('.btn-radius-preset');

        const updateSwatchPreview = (swatchEl, hexLabelEl, color) => {
            const isTransparent = !color || color === 'transparent';
            if (swatchEl) {
                swatchEl.style.backgroundColor = isTransparent ? 'transparent' : color;
            }
            if (hexLabelEl) {
                hexLabelEl.textContent = isTransparent ? 'None' : color.toUpperCase();
            }
        };

        // --- 1. FILL (SURFACE) COLOR PICKER TRIGGER ---
        bgTrigger?.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            state.pushHistory();
            openCustomColorPicker(bgTrigger, bgHexInput, (col) => {
                updateSwatchPreview(bgSwatch, bgHexLabel, col);
                if (bgNative) bgNative.value = col === 'transparent' ? '#000000' : col;
                if (bgHexInput) bgHexInput.value = col;
                updateOpacityGradientTrack(col);
                updateActiveElem({ bgColor: col });
                const slide = state.getActiveSlide();
                if (slide) canvas.renderSlide(slide);
            });
        });

        // --- 2. OPACITY SLIDER & SCRUBBING ---
        const updateOpacityUI = (val, emitState = false) => {
            const clamped = Math.max(0, Math.min(1, Math.round(val * 100) / 100));
            const pct = Math.round(clamped * 100);
            if (opacityPctLabel) opacityPctLabel.textContent = `${pct}%`;
            if (opacitySlider) opacitySlider.value = clamped;
            if (opacityNative) opacityNative.value = clamped;

            if (emitState) {
                updateActiveElem({ bgAlpha: clamped });
                const slide = state.getActiveSlide();
                if (slide) canvas.renderSlide(slide);
            }
        };

        opacitySlider?.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value) || 0;
            updateOpacityUI(val, true);
        });
        opacitySlider?.addEventListener('change', () => {
            state.pushHistory();
        });

        if (opacityBadge && opacitySlider) {
            let startX = 0;
            let startVal = 1;
            let isScrubbing = false;

            opacityBadge.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                startX = e.clientX;
                startVal = parseFloat(opacitySlider.value) || 1;
                isScrubbing = false;
                opacityBadge.setPointerCapture(e.pointerId);

                const onMove = (ev) => {
                    const dx = ev.clientX - startX;
                    if (Math.abs(dx) > 2) {
                        if (!isScrubbing) {
                            isScrubbing = true;
                            state.pushHistory();
                        }
                        const delta = (dx / 150);
                        let newVal = Math.max(0, Math.min(1, startVal + delta));
                        updateOpacityUI(newVal, true);
                    }
                };

                const onUp = () => {
                    opacityBadge.removeEventListener('pointermove', onMove);
                    opacityBadge.removeEventListener('pointerup', onUp);
                    opacityBadge.removeEventListener('pointercancel', onUp);
                };

                opacityBadge.addEventListener('pointermove', onMove);
                opacityBadge.addEventListener('pointerup', onUp);
                opacityBadge.addEventListener('pointercancel', onUp);
            });
        }

        // --- 3. STROKE (BORDER) STYLE SEGMENTED PILLS ---
        borderStyleButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const styleVal = btn.getAttribute('data-style') || 'none';
                state.pushHistory();
                borderStyleButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                if (borderStyleSelect) {
                    borderStyleSelect.value = styleVal;
                }
                const updates = { borderStyle: styleVal };
                if (styleVal !== 'none') {
                    const curW = parseInt(borderWidthInput ? borderWidthInput.value : 0) || 0;
                    if (curW === 0) {
                        if (borderWidthInput) borderWidthInput.value = 3;
                        updates.borderWidth = 3;
                    }
                }
                updateActiveElemAndSave(updates);
                const slide = state.getActiveSlide();
                if (slide) canvas.renderSlide(slide);
            });
        });

        // --- 4. BORDER COLOR PICKER TRIGGER ---
        borderTrigger?.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            state.pushHistory();
            openCustomColorPicker(borderTrigger, borderHexInput, (col) => {
                updateSwatchPreview(borderSwatch, borderHexLabel, col);
                if (borderNative) borderNative.value = col === 'transparent' ? '#000000' : col;
                if (borderHexInput) borderHexInput.value = col;
                updateActiveElem({ borderColor: col });
                const slide = state.getActiveSlide();
                if (slide) canvas.renderSlide(slide);
            });
        });

        // --- 5. BORDER WIDTH STEPPER & SCRUB ---
        const changeBorderWidth = (delta) => {
            if (!borderWidthInput) return;
            state.pushHistory();
            const cur = parseInt(borderWidthInput.value) || 0;
            let newVal;
            if (cur === 0 && delta > 0) {
                newVal = 3;
            } else {
                newVal = Math.max(0, Math.min(50, cur + delta));
            }
            borderWidthInput.value = newVal;

            const updates = { borderWidth: newVal };
            const elem = state.getActiveElement ? state.getActiveElement() : null;
            if (newVal > 0 && (!elem || !elem.borderStyle || elem.borderStyle === 'none')) {
                updates.borderStyle = 'solid';
                if (borderStyleSelect) borderStyleSelect.value = 'solid';
                borderStyleButtons.forEach(b => b.classList.toggle('active', b.getAttribute('data-style') === 'solid'));
            }
            updateActiveElemAndSave(updates);
            const slide = state.getActiveSlide();
            if (slide) canvas.renderSlide(slide);
        };

        borderWidthDec?.addEventListener('click', () => changeBorderWidth(-1));
        borderWidthInc?.addEventListener('click', () => changeBorderWidth(1));

        if (borderWidthScrub && borderWidthInput) {
            let startX = 0;
            let startVal = 0;
            let isScrubbing = false;

            borderWidthScrub.addEventListener('pointerdown', (e) => {
                if (e.target === borderWidthInput) return;
                e.preventDefault();
                startX = e.clientX;
                startVal = parseInt(borderWidthInput.value) || 0;
                isScrubbing = false;
                borderWidthScrub.setPointerCapture(e.pointerId);

                const onMove = (ev) => {
                    const dx = ev.clientX - startX;
                    if (Math.abs(dx) > 2) {
                        if (!isScrubbing) {
                            isScrubbing = true;
                            state.pushHistory();
                        }
                        const delta = Math.round(dx / 5);
                        let newVal = Math.max(0, Math.min(50, startVal + delta));
                        borderWidthInput.value = newVal;
                        updateActiveElem({ borderWidth: newVal });
                        const slide = state.getActiveSlide();
                        if (slide) canvas.renderSlide(slide);
                    }
                };

                const onUp = () => {
                    borderWidthScrub.removeEventListener('pointermove', onMove);
                    borderWidthScrub.removeEventListener('pointerup', onUp);
                    borderWidthScrub.removeEventListener('pointercancel', onUp);
                    if (isScrubbing) {
                        const finalVal = parseInt(borderWidthInput.value) || 0;
                        updateActiveElemAndSave({ borderWidth: finalVal });
                    }
                };

                borderWidthScrub.addEventListener('pointermove', onMove);
                borderWidthScrub.addEventListener('pointerup', onUp);
                borderWidthScrub.addEventListener('pointercancel', onUp);
            });
        }

        // --- 6. CORNER RADIUS STEPPER, SCRUB & PRESETS ---
        const syncRadiusPresets = (radiusVal) => {
            radiusPresetBtns.forEach(btn => {
                const pVal = parseInt(btn.getAttribute('data-radius')) || 0;
                btn.classList.toggle('active', pVal === radiusVal);
            });
        };

        const changeBorderRadius = (delta) => {
            if (!borderRadiusInput) return;
            state.pushHistory();
            const cur = parseInt(borderRadiusInput.value) || 0;
            const newVal = Math.max(0, Math.min(100, cur + delta));
            borderRadiusInput.value = newVal;
            syncRadiusPresets(newVal);
            updateActiveElemAndSave({ borderRadius: newVal });
            const slide = state.getActiveSlide();
            if (slide) canvas.renderSlide(slide);
        };

        borderRadiusDec?.addEventListener('click', () => changeBorderRadius(-2));
        borderRadiusInc?.addEventListener('click', () => changeBorderRadius(2));

        radiusPresetBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const rVal = parseInt(btn.getAttribute('data-radius')) || 0;
                state.pushHistory();
                syncRadiusPresets(rVal);
                if (borderRadiusInput) borderRadiusInput.value = rVal;
                updateActiveElemAndSave({ borderRadius: rVal });
                const slide = state.getActiveSlide();
                if (slide) canvas.renderSlide(slide);
            });
        });

        if (borderRadiusScrub && borderRadiusInput) {
            let startX = 0;
            let startVal = 0;
            let isScrubbing = false;

            borderRadiusScrub.addEventListener('pointerdown', (e) => {
                if (e.target === borderRadiusInput) return;
                e.preventDefault();
                startX = e.clientX;
                startVal = parseInt(borderRadiusInput.value) || 0;
                isScrubbing = false;
                borderRadiusScrub.setPointerCapture(e.pointerId);

                const onMove = (ev) => {
                    const dx = ev.clientX - startX;
                    if (Math.abs(dx) > 2) {
                        if (!isScrubbing) {
                            isScrubbing = true;
                            state.pushHistory();
                        }
                        const delta = Math.round(dx / 4);
                        let newVal = Math.max(0, Math.min(100, startVal + delta));
                        borderRadiusInput.value = newVal;
                        syncRadiusPresets(newVal);
                        updateActiveElem({ borderRadius: newVal });
                        const slide = state.getActiveSlide();
                        if (slide) canvas.renderSlide(slide);
                    }
                };

                const onUp = () => {
                    borderRadiusScrub.removeEventListener('pointermove', onMove);
                    borderRadiusScrub.removeEventListener('pointerup', onUp);
                    borderRadiusScrub.removeEventListener('pointercancel', onUp);
                    if (isScrubbing) {
                        const finalVal = parseInt(borderRadiusInput.value) || 0;
                        updateActiveElemAndSave({ borderRadius: finalVal });
                    }
                };

                borderRadiusScrub.addEventListener('pointermove', onMove);
                borderRadiusScrub.addEventListener('pointerup', onUp);
                borderRadiusScrub.addEventListener('pointercancel', onUp);
            });
        }

        // --- 7. GLOBAL SYNC FUNCTION FOR APPEARANCE STUDIO ---
        window.syncAppearanceStudioUI = function(element) {
            if (!element) return;

            // Fill color
            const bgCol = element.bgColor || '#334155';
            updateSwatchPreview(bgSwatch, bgHexLabel, bgCol);
            if (bgNative) bgNative.value = bgCol === 'transparent' ? '#000000' : bgCol;
            if (bgHexInput) bgHexInput.value = bgCol;
            updateOpacityGradientTrack(bgCol);

            // Opacity
            const alpha = element.bgAlpha !== undefined ? element.bgAlpha : 1;
            updateOpacityUI(alpha, false);

            // Border style
            const bStyle = element.borderStyle || 'none';
            borderStyleButtons.forEach(b => {
                b.classList.toggle('active', b.getAttribute('data-style') === bStyle);
            });
            if (borderStyleSelect) borderStyleSelect.value = bStyle;

            // Border color
            const borCol = element.borderColor || '#ffffff';
            updateSwatchPreview(borderSwatch, borderHexLabel, borCol);
            if (borderNative) borderNative.value = borCol === 'transparent' ? '#000000' : borCol;
            if (borderHexInput) borderHexInput.value = borCol;

            // Border width
            let bWidth = element.borderWidth !== undefined ? element.borderWidth : 0;
            if (bStyle !== 'none' && bWidth === 0) {
                bWidth = 3;
            }
            if (borderWidthInput) borderWidthInput.value = bWidth;

            // Border radius
            const bRadius = element.borderRadius !== undefined ? element.borderRadius : 0;
            if (borderRadiusInput) borderRadiusInput.value = bRadius;
            syncRadiusPresets(bRadius);
        };

        if (window.lucide) {
            lucide.createIcons();
        }
    }

    initFloatingMiniInspector();
    initInspectorAccordions();
    initTypographyStudio();
    initStudioFontPicker();
    initAppearanceStudio();
}

function updateTransitionIcon(val) {
    const container = document.getElementById('slide-transition-icon-container');
    if (!container) return;

    let iconName = 'ban';
    if (val === 'fade') iconName = 'sparkles';
    else if (val === 'slide-left') iconName = 'arrow-left';
    else if (val === 'slide-right') iconName = 'arrow-right';
    else if (val === 'slide-up') iconName = 'arrow-up';
    else if (val === 'slide-down') iconName = 'arrow-down';
    else if (val === 'slide-bounce-left') iconName = 'chevrons-left';
    else if (val === 'slide-bounce-right') iconName = 'chevrons-right';
    else if (val === 'zoom') iconName = 'zoom-in';
    else if (val === 'spin-zoom') iconName = 'rotate-cw';
    else if (val === 'flip-horizontal') iconName = 'fold-horizontal';
    else if (val === 'flip-vertical') iconName = 'fold-vertical';
    else if (val === 'iris') iconName = 'aperture';
    else if (val === 'slide-skew-left') iconName = 'italic';
    else if (val === 'wash-black') iconName = 'moon';
    else if (val === 'wash-white') iconName = 'sun';
    else if (val === 'cross-scale') iconName = 'shrink';
    else if (val === 'diagonal-slide') iconName = 'arrow-up-right';
    else if (val === 'wipe-left') iconName = 'square-chevron-left';
    else if (val === 'wipe-right') iconName = 'square-chevron-right';
    else if (val === 'wipe-up') iconName = 'square-chevron-up';
    else if (val === 'wipe-down') iconName = 'square-chevron-down';
    else if (val === 'split-horizontal') iconName = 'split';
    else if (val === 'split-vertical') iconName = 'columns-2';
    else if (val === 'cube-left') iconName = 'box';
    else if (val === 'cube-right') iconName = 'toy-brick';
    else if (val === 'spiral') iconName = 'wind';
    else if (val === 'glitch') iconName = 'zap';
    else if (val === 'bounce-zoom') iconName = 'trending-up';

    container.innerHTML = `<i data-lucide="${iconName}"></i>`;
    if (window.lucide) lucide.createIcons();
}
