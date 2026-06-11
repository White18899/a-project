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

    // 3. Initialize State
    window.EngineState.init();

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
            if (!isNaN(fromIdx) && state.project.slides && fromIdx !== state.project.slides.length - 1) {
                state.moveSlide(fromIdx, state.project.slides.length - 1);
            }
        }
    });

    state.on('slide-changed', (slide) => {
        if (!slide) return;
        canvas.renderSlide(slide);
        
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
        document.getElementById('slide-bg-color').value = slide.background.color;
        document.getElementById('slide-bg-color-hex').value = slide.background.color;
        document.getElementById('slide-bg-grad-1').value = slide.background.gradientStart;
        document.getElementById('slide-bg-grad-1-hex').value = slide.background.gradientStart;
        document.getElementById('slide-bg-grad-2').value = slide.background.gradientEnd;
        document.getElementById('slide-bg-grad-2-hex').value = slide.background.gradientEnd;
        document.getElementById('slide-bg-grad-angle').value = slide.background.gradientAngle;
        document.getElementById('slide-bg-image-url').value = slide.background.imageUrl;
        document.getElementById('slide-rpg-theme').checked = slide.rpgTheme;

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
                document.getElementById('elem-text-color').value = element.textColor;
                document.getElementById('elem-text-color-hex').value = element.textColor;
            }

            // Bind background formatting inputs
            if (element.bgColor !== undefined) {
                document.getElementById('elem-bg-color').value = element.bgColor;
                document.getElementById('elem-bg-color-hex').value = element.bgColor;
                document.getElementById('elem-bg-alpha').value = element.bgAlpha !== undefined ? element.bgAlpha : 1;
                document.getElementById('elem-border-radius').value = element.borderRadius || 0;
                document.getElementById('elem-padding').value = element.padding || 0;
                document.getElementById('elem-rpg-box').checked = element.rpgStyle || false;
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
                document.getElementById('elem-markup-color').value = element.markupColor || '#3b82f6';
                document.getElementById('elem-markup-color-hex').value = element.markupColor || '#3b82f6';
                
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

            card.appendChild(preview);

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
    document.getElementById('project-name-input').addEventListener('change', () => {
        state.saveToLocalStorage();
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
                state.saveToLocalStorage();
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
    document.getElementById('slide-name-input').addEventListener('change', () => state.saveToLocalStorage());

    document.getElementById('slide-transition').addEventListener('change', (e) => {
        state.updateSlideSettings({ transition: e.target.value });
        updateTransitionIcon(e.target.value);
        state.saveToLocalStorage();
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
        state.saveToLocalStorage();
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
    document.getElementById('slide-bg-grad-angle').addEventListener('change', () => state.saveToLocalStorage());

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
            state.saveToLocalStorage();
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
                state.saveToLocalStorage();
            };
            reader.readAsDataURL(file);
        }
    });

    // RPG Slide styling checkbox
    document.getElementById('slide-rpg-theme').addEventListener('change', (e) => {
        state.updateSlideSettings({ rpgTheme: e.target.checked });
        state.saveToLocalStorage();
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
        state.saveToLocalStorage();
    };

    // Text Content Area
    document.getElementById('elem-text').addEventListener('input', (e) => {
        updateActiveElem({ text: e.target.value });
    });
    document.getElementById('elem-text').addEventListener('change', () => state.saveToLocalStorage());

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
    ['elem-x', 'elem-y', 'elem-w', 'elem-h'].forEach(id => {
        document.getElementById(id).addEventListener('change', () => state.saveToLocalStorage());
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
    document.getElementById('elem-font-size').addEventListener('change', () => state.saveToLocalStorage());
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
    document.getElementById('elem-bg-alpha').addEventListener('change', () => state.saveToLocalStorage());
    document.getElementById('elem-border-radius').addEventListener('input', (e) => {
        updateActiveElem({ borderRadius: parseInt(e.target.value) || 0 });
    });
    document.getElementById('elem-padding').addEventListener('input', (e) => {
        updateActiveElem({ padding: parseInt(e.target.value) || 0 });
    });
    ['elem-border-radius', 'elem-padding'].forEach(id => {
        document.getElementById(id).addEventListener('change', () => state.saveToLocalStorage());
    });
    document.getElementById('elem-rpg-box').addEventListener('change', (e) => {
        updateActiveElemAndSave({ rpgStyle: e.target.checked });
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
    document.getElementById('elem-option-group').addEventListener('change', () => state.saveToLocalStorage());

    // Timers dropdown and parameters
    document.getElementById('elem-timer-duration').addEventListener('input', (e) => {
        updateActiveElem({ duration: parseInt(e.target.value) || 30, text: e.target.value });
    });
    document.getElementById('elem-timer-duration').addEventListener('change', () => state.saveToLocalStorage());

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
            state.saveToLocalStorage();
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
            state.saveToLocalStorage();
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
        
        const icon = document.querySelector('#btn-toggle-layers i');
        if (panel.classList.contains('minimized')) {
            icon.setAttribute('data-lucide', 'chevron-up');
        } else {
            icon.setAttribute('data-lucide', 'chevron-down');
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

    function bindColorPickerPair(pickerId, hexInputId, callback) {
        const picker = document.getElementById(pickerId);
        const hex = document.getElementById(hexInputId);

        picker.addEventListener('click', () => {
            state.pushHistory();
        });
        hex.addEventListener('focus', () => {
            state.pushHistory();
        });

        picker.addEventListener('input', (e) => {
            const val = e.target.value;
            hex.value = val;
            callback(val);
        });
        picker.addEventListener('change', () => state.saveToLocalStorage());

        hex.addEventListener('input', (e) => {
            let val = e.target.value;
            if (!val.startsWith('#')) val = '#' + val;
            if (/^#[0-9A-F]{6}$/i.test(val)) {
                picker.value = val;
                callback(val);
            }
        });
        hex.addEventListener('change', () => state.saveToLocalStorage());
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
                state.saveToLocalStorage();
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
                state.saveToLocalStorage();
            };

            // Change listener for Target
            targetSelect.onchange = (e) => {
                state.pushHistory();
                act.targetId = e.target.value;
                state.updateElement(element.id, { actions: element.actions });
                state.saveToLocalStorage();
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
                state.saveToLocalStorage();
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
                state.saveToLocalStorage();
            };

            // Change listener for Target
            targetSelect.onchange = (e) => {
                state.pushHistory();
                act.targetId = e.target.value;
                state.updateElement(element.id, { actions: element.actions });
                state.saveToLocalStorage();
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
