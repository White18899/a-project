/**
 * SlideEngine Editor controller
 * Manages editor UI interactions, sidebar panels, input syncing,
 * file readers, z-index layers panel, and initializes editor WebGL canvas.
 */

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
            
            // Bind fields
            document.getElementById('inspector-element-title').textContent = `${element.type.toUpperCase()} Element`;
            document.getElementById('elem-id').value = element.id;
            document.getElementById('elem-visible').checked = element.visible !== false;
            
            // Form value assignments
            if (element.text !== undefined) {
                document.getElementById('elem-text').value = element.text;
                document.getElementById('field-elem-text').classList.remove('hidden');
            } else {
                document.getElementById('field-elem-text').classList.add('hidden');
            }

            document.getElementById('elem-x').value = element.x;
            document.getElementById('elem-y').value = element.y;
            document.getElementById('elem-w').value = element.width;
            document.getElementById('elem-h').value = element.height;

            // Conditional rendering logic based on type
            toggleInspectorFieldsForType(element.type);
            
            // Bind font formatting inputs
            if (element.fontFamily !== undefined) {
                document.getElementById('elem-font-family').value = element.fontFamily;
                document.getElementById('elem-font-size').value = element.fontSize;
                document.getElementById('elem-align').value = element.align;
                const txtCol = element.textColor || '#ffffff';
                document.getElementById('elem-text-color').value = txtCol === 'transparent' ? '#000000' : txtCol;
                document.getElementById('elem-text-color-hex').value = txtCol;
                syncColorSwatchTransparentClass(document.getElementById('elem-text-color'), txtCol);
            }

            // Bind background formatting inputs
            if (element.bgColor !== undefined) {
                const bgCol = element.bgColor || '#334155';
                document.getElementById('elem-bg-color').value = bgCol === 'transparent' ? '#000000' : bgCol;
                document.getElementById('elem-bg-color-hex').value = bgCol;
                syncColorSwatchTransparentClass(document.getElementById('elem-bg-color'), bgCol);
                document.getElementById('elem-bg-alpha').value = element.bgAlpha !== undefined ? element.bgAlpha : 1;
                document.getElementById('elem-border-radius').value = element.borderRadius || 0;
                document.getElementById('elem-padding').value = element.padding || 0;
            }

            // Image URL properties
            if (element.type === 'image') {
                document.getElementById('elem-image-url').value = element.url || '';
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
            if (element.type === 'btn-toggle') {
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
                        const thumbScale = 222 / 1920;
                        mini.style.borderRadius = `${(elem.borderRadius || 0) * thumbScale}px`;
                    }
                    
                    if (elem.text) {
                        const textSpan = document.createElement('span');
                        textSpan.textContent = elem.text;
                        textSpan.style.color = elem.textColor || '#ffffff';
                        textSpan.style.fontSize = '4px';
                        textSpan.style.fontFamily = isRpg ? 'Press Start 2P' : (elem.fontFamily || 'Outfit');
                        textSpan.style.display = 'block';
                        textSpan.style.overflow = 'hidden';
                        textSpan.style.width = '100%';
                        textSpan.style.height = '100%';
                        textSpan.style.textAlign = elem.align || 'left';
                        textSpan.style.whiteSpace = 'nowrap';
                        textSpan.style.textOverflow = 'ellipsis';
                        textSpan.style.lineHeight = '1.2';
                        
                        const pad = elem.padding || 0;
                        textSpan.style.padding = `${(pad / 1080) * 100}%`;
                        mini.appendChild(textSpan);
                    }
                } else if (elem.type === 'image') {
                    mini.style.backgroundImage = `url(${elem.fileData || elem.url})`;
                    mini.style.backgroundSize = 'cover';
                    mini.style.backgroundPosition = 'center';
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
        const url = document.getElementById('slide-bg-image-url').value;
        if (url) {
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
            const reader = new FileReader();
            reader.onload = (evt) => {
                const dataUrl = evt.target.result;
                state.updateSlideSettings({
                    background: {
                        ...state.getActiveSlide().background,
                        type: 'image',
                        imageUrl: dataUrl
                    }
                });
                document.getElementById('slide-bg-type').value = 'image';
                toggleBackgroundOptionFields('image');
            };
            reader.readAsDataURL(file);
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
                    for (const key in props) {
                        if (elem[key] !== undefined || (elem.type && elem.type.startsWith('btn-') && (key === 'useMarkupColor' || key === 'markupColor'))) {
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

    // Coordinates pos
    document.getElementById('elem-x').addEventListener('input', (e) => {
        updateActiveElem({ x: parseInt(e.target.value) || 0 });
    });
    document.getElementById('elem-y').addEventListener('input', (e) => {
        updateActiveElem({ y: parseInt(e.target.value) || 0 });
    });
    document.getElementById('elem-w').addEventListener('input', (e) => {
        updateActiveElem({ width: parseInt(e.target.value) || 40 });
    });
    document.getElementById('elem-h').addEventListener('input', (e) => {
        updateActiveElem({ height: parseInt(e.target.value) || 30 });
    });
    document.getElementById('elem-visible').addEventListener('change', (e) => {
        state.pushHistory();
        updateActiveElemAndSave({ visible: e.target.checked });
        const activeSlide = state.getActiveSlide();
        if (activeSlide) {
            canvas.renderSlide(activeSlide);
        }
    });

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
    document.getElementById('elem-padding').addEventListener('input', (e) => {
        updateActiveElem({ padding: parseInt(e.target.value) || 0 });
    });

    // Image URL elements
    document.getElementById('btn-upload-elem-url').onclick = () => {
        const url = document.getElementById('elem-image-url').value;
        if (url) {
            updateActiveElemAndSave({ url: url, fileData: null });
        }
    };
    document.getElementById('elem-image-file').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (evt) => {
                const dataUrl = evt.target.result;
                updateActiveElemAndSave({ url: '', fileData: dataUrl });
            };
            reader.readAsDataURL(file);
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
        if (activeElem && activeElem.type === 'btn-toggle') {
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
    
    const updateZoomDisplay = () => {
        document.getElementById('zoom-percentage').textContent = `${Math.round(currentZoom * 100)}%`;
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
        currentZoom = 1.0;
        canvas.resize();
        // Recalculate zoom relative to canvas parent box
        const w = canvas.app.view.clientWidth;
        currentZoom = w / canvas.baseWidth;
        updateZoomDisplay();
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

    function syncColorSwatchTransparentClass(pickerEl, val) {
        if (!pickerEl || !pickerEl.parentElement) return;
        if (val === 'transparent') {
            pickerEl.parentElement.classList.add('color-transparent');
        } else {
            pickerEl.parentElement.classList.remove('color-transparent');
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

    function toggleInspectorFieldsForType(type) {
        // Hide all conditional inspector groupings first
        document.getElementById('group-text-styles').classList.add('hidden');
        document.getElementById('group-bg-styles').classList.add('hidden');
        document.getElementById('group-image-styles').classList.add('hidden');
        document.getElementById('group-timer-settings').classList.add('hidden');
        document.getElementById('group-nav-settings').classList.add('hidden');
        document.getElementById('group-option-settings').classList.add('hidden');
        document.getElementById('group-show-ans-settings').classList.add('hidden');
        document.getElementById('group-toggle-settings').classList.add('hidden');
        document.getElementById('group-button-markup').classList.add('hidden');

        if (type === 'text') {
            document.getElementById('group-text-styles').classList.remove('hidden');
            document.getElementById('group-bg-styles').classList.remove('hidden');
        } else if (type === 'image') {
            document.getElementById('group-image-styles').classList.remove('hidden');
        } else if (type === 'timer') {
            document.getElementById('group-text-styles').classList.remove('hidden');
            document.getElementById('group-bg-styles').classList.remove('hidden');
            document.getElementById('group-timer-settings').classList.remove('hidden');
        } else if (type === 'btn-nav') {
            document.getElementById('group-text-styles').classList.remove('hidden');
            document.getElementById('group-bg-styles').classList.remove('hidden');
            document.getElementById('group-nav-settings').classList.remove('hidden');
            document.getElementById('group-button-markup').classList.remove('hidden');
        } else if (type === 'btn-option') {
            document.getElementById('group-text-styles').classList.remove('hidden');
            document.getElementById('group-bg-styles').classList.remove('hidden');
            document.getElementById('group-option-settings').classList.remove('hidden');
            document.getElementById('group-button-markup').classList.remove('hidden');
        } else if (type === 'btn-show-ans') {
            document.getElementById('group-text-styles').classList.remove('hidden');
            document.getElementById('group-bg-styles').classList.remove('hidden');
            document.getElementById('group-show-ans-settings').classList.remove('hidden');
            document.getElementById('group-button-markup').classList.remove('hidden');
        } else if (type === 'btn-toggle') {
            document.getElementById('group-text-styles').classList.remove('hidden');
            document.getElementById('group-bg-styles').classList.remove('hidden');
            document.getElementById('group-toggle-settings').classList.remove('hidden');
            document.getElementById('group-button-markup').classList.remove('hidden');
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
                const isTargetable = elem.type === 'text' || elem.type === 'image' || elem.type === 'timer' || elem.type.startsWith('btn-');
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
                const isTargetable = elem.type === 'text' || elem.type === 'image' || elem.type === 'timer' || elem.type.startsWith('btn-');
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
            const isTargetable = elem.type === 'text' || elem.type === 'image' || elem.type === 'timer' || elem.type.startsWith('btn-');
            
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
            } else if (activeElem.type === 'btn-toggle') {
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
