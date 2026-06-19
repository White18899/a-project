/**
 * SlideEngine PixiJS WebGL Canvas Renderer
 * Handles rendering of slide elements, interaction (dragging, resizing, selecting),
 * and supports custom theme visuals like retro RPG dialog structures.
 */

class SlideCanvas {
    constructor(containerId, mode = 'edit') {
        this.container = document.getElementById(containerId);
        this.mode = mode; // 'edit' or 'play'
        this.app = null;
        
        // Dragging & Selection State
        this.draggedElement = null;
        this.dragData = null;
        this.activeAction = null; // 'drag' or 'resize'
        this.resizeHandleIndex = null; // 0: TL, 1: TR, 2: BR, 3: BL
        
        // Viewport sizing
        this.baseWidth = 1920;
        this.baseHeight = 1080;
        this.zoom = 1.0;
        this.snapToGrid = true;
        this.gridSize = 20;

        // Container of elements to manage z-indices
        this.slideContainer = null;
        this.uiContainer = null; // For editor selection borders
        
        // Element map: id -> PIXI.Container
        this.pixiElements = new Map();
        
        this.init();
    }

    init() {
        // Clear previous content
        this.container.innerHTML = '';
        
        // Initialize PIXI Application
        this.app = new PIXI.Application({
            width: this.baseWidth,
            height: this.baseHeight,
            antialias: true,
            transparent: false,
            resolution: window.devicePixelRatio || 1,
            autoDensity: true,
            backgroundColor: 0x1e293b
        });
        
        this.container.appendChild(this.app.view);
        
        // Root container for slides
        this.slideContainer = new PIXI.Container();
        this.app.stage.addChild(this.slideContainer);
        
        // Container for editor utilities (drawn on top)
        if (this.mode === 'edit') {
            this.uiContainer = new PIXI.Container();
            this.app.stage.addChild(this.uiContainer);
        }
        
        // Handle resizing
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        if (!this.container || !this.app) return;
        
        const parentW = this.container.parentElement.clientWidth;
        const parentH = this.container.parentElement.clientHeight;
        
        // Maintain 16:9 ratio
        let w = parentW;
        let h = parentW * (9/16);
        
        if (h > parentH) {
            h = parentH;
            w = parentH * (16/9);
        }
        
        // Size the container box
        this.container.style.width = `${w}px`;
        this.container.style.height = `${h}px`;
        
        // Stretch canvas to fill container
        this.app.view.style.width = '100%';
        this.app.view.style.height = '100%';
        
        this.zoom = w / this.baseWidth;
    }

    setZoom(level) {
        this.zoom = level;
        this.container.style.width = `${this.baseWidth * level}px`;
        this.container.style.height = `${this.baseHeight * level}px`;
        
        this.app.view.style.width = '100%';
        this.app.view.style.height = '100%';
    }

    pauseVideosInContainer(container) {
        if (!container) return;
        const traverseAndPause = (node) => {
            if (node.videoElement) {
                try {
                    node.videoElement.pause();
                    node.videoElement.src = "";
                    node.videoElement.load();
                } catch(e) {}
            }
            if (node.videoTexture) {
                try {
                    node.videoTexture.destroy(true);
                } catch(e) {}
            }
            if (node.children) {
                node.children.forEach(traverseAndPause);
            }
        };
        traverseAndPause(container);
    }

    renderSlide(slide, targetContainer = this.slideContainer) {
        if (!slide) return;
        
        // Clear children
        if (targetContainer === this.slideContainer) {
            this.pauseVideosInContainer(this.slideContainer);
            this.clearVideoOverlays();
            this.slideContainer.removeChildren();
            if (this.uiContainer) {
                this.uiContainer.removeChildren();
            }
        } else {
            this.pauseVideosInContainer(targetContainer);
            targetContainer.removeChildren();
        }
        
        this.pixiElements.clear();
        
        // Render Slide Background
        this.renderBackground(slide, targetContainer);

        // Add background hit area in edit mode on top of the background graphic but behind elements
        if (this.mode === 'edit' && targetContainer === this.slideContainer) {
            const bgHit = new PIXI.Graphics();
            bgHit.beginFill(0x000000, 0.001);
            bgHit.drawRect(0, 0, this.baseWidth, this.baseHeight);
            bgHit.endFill();
            bgHit.interactive = true;
            bgHit.on('pointerdown', (e) => {
                const isCtrl = e && (
                    e.ctrlKey || e.metaKey || 
                    (e.nativeEvent && (e.nativeEvent.ctrlKey || e.nativeEvent.metaKey)) ||
                    (e.data && e.data.originalEvent && (e.data.originalEvent.ctrlKey || e.data.originalEvent.metaKey))
                );
                if (!isCtrl) {
                    window.EngineState.selectElement(null);
                }
                this.startMarqueeSelection(e);
            });
            targetContainer.addChild(bgHit);
        }

        // Sort elements by zIndex
        const sortedElements = [...slide.elements].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
        
        // Render Elements
        sortedElements.forEach(elem => {
            this.renderElement(elem, slide.rpgTheme, targetContainer);
            const container = this.pixiElements.get(elem.id);
            if (container) {
                if (this.mode === 'play' && elem.visible === false) {
                    container.visible = false;
                } else if (this.mode === 'edit' && elem.visible === false) {
                    container.alpha = 0.45;
                    container.visible = true;
                } else {
                    container.alpha = 1.0;
                    container.visible = true;
                }
            }
        });
        
        // If elements are selected, draw selection indicators
        if (this.mode === 'edit' && targetContainer === this.slideContainer && window.EngineState.selectedElementIds && window.EngineState.selectedElementIds.length > 0) {
            this.drawSelectionUI();
        }

        // Render HTML Video Overlays
        if (targetContainer === this.slideContainer) {
            this.renderVideoOverlays(slide);
        }
    }

    renderBackground(slide, targetContainer = this.slideContainer) {
        const bgGraphics = new PIXI.Graphics();
        const bg = slide.background || { type: 'color', color: '#1e293b' };
        
        if (bg.type === 'color') {
            const colorStr = bg.color || '#1e293b';
            if (colorStr !== 'transparent') {
                bgGraphics.beginFill(parseInt(colorStr.replace('#', '0x')));
                bgGraphics.drawRect(0, 0, this.baseWidth, this.baseHeight);
                bgGraphics.endFill();
                targetContainer.addChild(bgGraphics);
            }
        } else if (bg.type === 'gradient') {
            // WebGL doesn't do smooth gradients natively on shape fills easily, so we generate a 1D texture
            const canvas = document.createElement('canvas');
            canvas.width = 256;
            canvas.height = 256;
            const ctx = canvas.getContext('2d');
            
            // Calculate angle points
            const angleRad = (bg.gradientAngle !== undefined ? bg.gradientAngle : 135) * Math.PI / 180;
            const x1 = Math.cos(angleRad + Math.PI) * 128 + 128;
            const y1 = Math.sin(angleRad + Math.PI) * 128 + 128;
            const x2 = Math.cos(angleRad) * 128 + 128;
            const y2 = Math.sin(angleRad) * 128 + 128;
            
            const grad = ctx.createLinearGradient(x1, y1, x2, y2);
            grad.addColorStop(0, bg.gradientStart || '#0f172a');
            grad.addColorStop(1, bg.gradientEnd || '#1e293b');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, 256, 256);
            
            const texture = PIXI.Texture.from(canvas);
            const sprite = new PIXI.Sprite(texture);
            sprite.width = this.baseWidth;
            sprite.height = this.baseHeight;
            targetContainer.addChild(sprite);
        } else if (bg.type === 'image' && bg.imageUrl) {
            try {
                const texture = PIXI.Texture.from(bg.imageUrl);
                const sprite = new PIXI.Sprite(texture);
                sprite.width = this.baseWidth;
                sprite.height = this.baseHeight;
                targetContainer.addChild(sprite);
                
                // Redraw on load
                texture.baseTexture.on('loaded', () => {
                    sprite.width = this.baseWidth;
                    sprite.height = this.baseHeight;
                });
            } catch (e) {
                console.error("BG Image load failed: ", e);
                // Fallback
                bgGraphics.beginFill(0x0f172a);
                bgGraphics.drawRect(0, 0, this.baseWidth, this.baseHeight);
                bgGraphics.endFill();
                targetContainer.addChild(bgGraphics);
            }
        }
    }

    renderElement(elem, slideRpgTheme = false, targetContainer = this.slideContainer) {
        const container = new PIXI.Container();
        container.x = elem.x;
        container.y = elem.y;
        container.zIndex = elem.zIndex || 0;
        container.elementId = elem.id;
        
        // Apply interactive behaviors
        if (this.mode === 'edit') {
            container.interactive = true;
            container.cursor = 'pointer';
            
            container.on('pointerdown', (e) => this.onElementPointerDown(e, elem, container));
        } else if (this.mode === 'play') {
            // In play mode, only buttons and interactive things are active
            const isButton = elem.type.startsWith('btn-') || elem.type === 'timer';
            if (isButton) {
                container.interactive = true;
                container.cursor = 'pointer';
                container.on('pointerdown', (e) => {
                    e.stopPropagation();
                    if (window.PlayerController) {
                        window.PlayerController.handleElementInteraction(elem, container);
                    }
                });
            }
        }
        
        // Graphic backing
        const graphics = new PIXI.Graphics();
        container.addChild(graphics);
        
        // Element Content rendering
        let contentWidth = elem.width;
        let contentHeight = elem.height;
        
        const isRpg = elem.rpgStyle || slideRpgTheme;
        
        if (elem.type === 'text' || elem.type.startsWith('btn-') || elem.type === 'timer') {
            // Draw Box background
            this.drawStyledBox(graphics, elem, isRpg);
            
            // Render text
            const padding = isRpg ? 16 : (elem.padding || 0);
            const textStyle = new PIXI.TextStyle({
                fontFamily: isRpg ? 'Press Start 2P' : (elem.fontFamily || 'Outfit'),
                fontSize: isRpg ? Math.max(elem.fontSize - 8, 12) : (elem.fontSize || 24),
                fill: elem.textColor || '#ffffff',
                align: elem.align || 'left',
                wordWrap: true,
                wordWrapWidth: contentWidth - (padding * 2)
            });
            
            const pixiText = new PIXI.Text(elem.text, textStyle);
            
            // Alignments
            pixiText.x = padding;
            if (elem.align === 'center') {
                pixiText.x = contentWidth / 2;
                pixiText.anchor.x = 0.5;
            } else if (elem.align === 'right') {
                pixiText.x = contentWidth - padding;
                pixiText.anchor.x = 1;
            }
            
            // Center text vertically
            pixiText.y = (contentHeight - pixiText.height) / 2;
            if (pixiText.y < padding) pixiText.y = padding;
            
            container.addChild(pixiText);
            container.textNode = pixiText; // Ref for runtime update
            
        } else if (elem.type === 'image') {
            try {
                let texture;
                if (elem.fileData) {
                    texture = PIXI.Texture.from(elem.fileData);
                } else {
                    texture = PIXI.Texture.from(elem.url);
                }
                
                const sprite = new PIXI.Sprite(texture);
                container.addChild(sprite);
                
                if (texture.baseTexture.valid) {
                    sprite.width = contentWidth;
                    sprite.height = contentHeight;
                } else {
                    sprite.width = contentWidth;
                    sprite.height = contentHeight;
                    texture.baseTexture.on('loaded', () => {
                        sprite.width = contentWidth;
                        sprite.height = contentHeight;
                    });
                }
                texture.baseTexture.on('error', () => {
                    // draw error box
                    graphics.beginFill(0x7f1d1d);
                    graphics.drawRect(0, 0, contentWidth, contentHeight);
                    graphics.endFill();
                    
                    const errText = new PIXI.Text("Image Error", new PIXI.TextStyle({fill: 0xffffff, fontSize: 14}));
                    errText.x = 10;
                    errText.y = 10;
                    container.addChild(errText);
                });
            } catch(e) {
                // error fallback
                graphics.beginFill(0x7f1d1d);
                graphics.drawRect(0, 0, contentWidth, contentHeight);
                graphics.endFill();
            }
        } else if (elem.type === 'video') {
            // Draw visual editor placeholder for mapping selection/dragging
            graphics.beginFill(0x0f172a, 0.95);
            graphics.lineStyle(1.5, 0x334155, 1);
            graphics.drawRect(0, 0, contentWidth, contentHeight);
            graphics.endFill();

            // Centered white play button icon
            const playIcon = new PIXI.Graphics();
            playIcon.beginFill(0xffffff, 0.45);
            playIcon.moveTo(-10, -15);
            playIcon.lineTo(15, 0);
            playIcon.lineTo(-10, 15);
            playIcon.closePath();
            playIcon.endFill();
            playIcon.x = contentWidth / 2;
            playIcon.y = contentHeight / 2;
            container.addChild(playIcon);

            // Add indicator text
            const typeText = new PIXI.Text(elem.fileData ? "Local Video" : (elem.url && elem.url.includes("youtu") ? "YouTube Video" : "Video URL"), new PIXI.TextStyle({
                fontFamily: 'Outfit',
                fontSize: 14,
                fill: 0x9ca3af,
                align: 'center'
            }));
            typeText.anchor.set(0.5, 0);
            typeText.x = contentWidth / 2;
            typeText.y = contentHeight / 2 + 25;
            container.addChild(typeText);
        }

        
        targetContainer.addChild(container);
        this.pixiElements.set(elem.id, container);
    }

    drawStyledBox(graphics, elem, isRpg) {
        graphics.clear();
        
        const w = elem.width;
        const h = elem.height;
        
        if (isRpg) {
            // Classic NES/SNES RPG text box double border
            
            // Outer black shadow border shadow
            graphics.lineStyle(4, 0x000000, 1);
            let colorHex = '#000080'; // Retro deep blue default
            if (elem.useMarkupColor && elem.markupActive && elem.markupColor) {
                colorHex = elem.markupColor;
            }
            let fillAlpha = 1;
            if (colorHex === 'transparent') {
                colorHex = '#000000';
                fillAlpha = 0;
            }
            graphics.beginFill(parseInt(colorHex.replace('#', '0x')), fillAlpha);
            graphics.drawRect(2, 2, w - 4, h - 4);
            graphics.endFill();
            
            // Inner white border (double line look)
            graphics.lineStyle(2, 0xffffff, 1);
            graphics.drawRect(6, 6, w - 12, h - 12);
            
            // Black offset box
            graphics.lineStyle(2, 0x000000, 1);
            graphics.drawRect(8, 8, w - 16, h - 16);
            
        } else {
            // Modern styled box
            let alpha = elem.bgAlpha !== undefined ? elem.bgAlpha : 1;
            let colorStr = elem.bgColor || '#1e293b';
            if (colorStr === 'transparent') {
                alpha = 0;
            }
            if (elem.useMarkupColor && elem.markupActive && elem.markupColor) {
                colorStr = elem.markupColor;
                if (colorStr === 'transparent') {
                    alpha = 0;
                }
            }
            const color = colorStr === 'transparent' ? 0x000000 : parseInt(colorStr.replace('#', '0x'));
            const radius = elem.borderRadius || 0;
            
            graphics.beginFill(color, alpha);
            if (radius > 0) {
                graphics.drawRoundedRect(0, 0, w, h, radius);
            } else {
                graphics.drawRect(0, 0, w, h);
            }
            graphics.endFill();
        }
    }

    // ==========================================
    // EDITOR ACTIONS: DRAG & RESIZE
    // ==========================================
    
    onElementPointerDown(event, elem, container) {
        event.stopPropagation();
        
        window.EngineState.pushHistory();
        
        const isCtrl = event && (
            event.ctrlKey || event.metaKey || 
            (event.nativeEvent && (event.nativeEvent.ctrlKey || event.nativeEvent.metaKey)) ||
            (event.data && event.data.originalEvent && (event.data.originalEvent.ctrlKey || event.data.originalEvent.metaKey))
        );
        const clickedWasAlreadySelected = (window.EngineState.selectedElementIds || []).includes(elem.id);

        if (isCtrl) {
            window.EngineState.selectElement(elem.id, true);
        } else {
            if (!clickedWasAlreadySelected) {
                window.EngineState.selectElement(elem.id, false);
            }
        }
        
        this.draggedElement = elem;
        this.draggedContainer = container;
        this.activeAction = 'drag';
        this.hasMoved = false;
        
        const localPos = event.data.getLocalPosition(this.app.stage);
        
        const slide = window.EngineState.getActiveSlide();
        const groupElements = [];
        if (slide) {
            (window.EngineState.selectedElementIds || []).forEach(id => {
                const e = slide.elements.find(el => el.id === id);
                const c = this.pixiElements.get(id);
                if (e && c) {
                    groupElements.push({
                        element: e,
                        container: c,
                        elemStartX: e.x,
                        elemStartY: e.y
                    });
                }
            });
        }

        this.dragData = {
            startX: localPos.x,
            startY: localPos.y,
            elements: groupElements
        };
        
        // Attach moving listeners to stage
        this.app.stage.interactive = true;
        this.app.stage.on('pointermove', this.onStagePointerMove, this);
        this.app.stage.on('pointerup', this.onStagePointerUp, this);
        this.app.stage.on('pointerupoutside', this.onStagePointerUp, this);
    }

    onStagePointerMove(event) {
        if (this.activeAction === 'marquee') {
            if (this.marqueeStart) {
                const localPos = event.data.getLocalPosition(this.app.stage);
                this.marqueeEnd = { x: localPos.x, y: localPos.y };
                this.drawMarqueeUI();
            }
            return;
        }

        if (!this.draggedElement || !this.dragData) return;
        
        const localPos = event.data.getLocalPosition(this.app.stage);
        
        if (this.activeAction === 'drag') {
            const dx = localPos.x - this.dragData.startX;
            const dy = localPos.y - this.dragData.startY;
            
            if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
                this.hasMoved = true;
            }
            
            this.dragData.elements.forEach(item => {
                const elem = item.element;
                const container = item.container;
                
                let newX = item.elemStartX + dx;
                let newY = item.elemStartY + dy;
                
                // Snap to grid
                if (this.snapToGrid) {
                    newX = Math.round(newX / this.gridSize) * this.gridSize;
                    newY = Math.round(newY / this.gridSize) * this.gridSize;
                }
                
                // Containment
                newX = Math.max(0, Math.min(this.baseWidth - elem.width, newX));
                newY = Math.max(0, Math.min(this.baseHeight - elem.height, newY));
                
                // Update state & UI container immediately
                window.EngineState.updateElement(elem.id, { x: newX, y: newY });
                
                // Local visual update to keep it responsive (no lag)
                container.x = newX;
                container.y = newY;

                // Sync HTML overlay position
                const overlay = this.container.querySelector(`.html-video-overlay[data-element-id="${elem.id}"]`);
                if (overlay) {
                    overlay.style.left = `${(newX / this.baseWidth) * 100}%`;
                    overlay.style.top = `${(newY / this.baseHeight) * 100}%`;
                }
            });
            
            this.drawSelectionUI();
            
        } else if (this.activeAction === 'resize') {
            const dx = localPos.x - this.dragData.startX;
            const dy = localPos.y - this.dragData.startY;
            
            let newW = this.dragData.elemStartW;
            let newH = this.dragData.elemStartH;
            let newX = this.dragData.elemStartX;
            let newY = this.dragData.elemStartY;
            
            const handleIndex = this.resizeHandleIndex;
            
            // Calculate size adjustments based on handle dragged
            if (handleIndex === 1 || handleIndex === 2) { // Right handles
                newW = this.dragData.elemStartW + dx;
            } else if (handleIndex === 0 || handleIndex === 3) { // Left handles
                newW = this.dragData.elemStartW - dx;
                newX = this.dragData.elemStartX + dx;
            }
            
            if (handleIndex === 2 || handleIndex === 3) { // Bottom handles
                newH = this.dragData.elemStartH + dy;
            } else if (handleIndex === 0 || handleIndex === 1) { // Top handles
                newH = this.dragData.elemStartH - dy;
                newY = this.dragData.elemStartY + dy;
            }
            
            // Snap grid on size
            if (this.snapToGrid) {
                newW = Math.round(newW / this.gridSize) * this.gridSize;
                newH = Math.round(newH / this.gridSize) * this.gridSize;
                newX = Math.round(newX / this.gridSize) * this.gridSize;
                newY = Math.round(newY / this.gridSize) * this.gridSize;
            }
            
            // Minimum size
            if (newW < 40) {
                newW = 40;
                newX = this.draggedElement.x; // Block movement
            }
            if (newH < 30) {
                newH = 30;
                newY = this.draggedElement.y;
            }
            
            window.EngineState.updateElement(this.draggedElement.id, {
                x: newX,
                y: newY,
                width: newW,
                height: newH
            });
            
            // Visual redraws
            this.draggedContainer.x = newX;
            this.draggedContainer.y = newY;
            this.renderElement(this.draggedElement, window.EngineState.getActiveSlide().rpgTheme);
            this.drawSelectionUI();

            // Sync HTML overlay position & size
            const overlay = this.container.querySelector(`.html-video-overlay[data-element-id="${this.draggedElement.id}"]`);
            if (overlay) {
                overlay.style.left = `${(newX / this.baseWidth) * 100}%`;
                overlay.style.top = `${(newY / this.baseHeight) * 100}%`;
                overlay.style.width = `${(newW / this.baseWidth) * 100}%`;
                overlay.style.height = `${(newH / this.baseHeight) * 100}%`;
            }
        }
    }

    onStagePointerUp(event) {
        if (this.activeAction === 'marquee') {
            if (this.marqueeStart && this.marqueeEnd) {
                this.applyMarqueeSelection(event);
            }
            this.renderSlide(window.EngineState.getActiveSlide());
        } else if (this.draggedElement) {
            // Save state updates
            window.EngineState.markUnsaved();
            
            // If we did not move the mouse, select only this element (unless Ctrl is held)
            if (!this.hasMoved && this.dragData) {
                const isCtrl = event && (
                    event.ctrlKey || event.metaKey || 
                    (event.nativeEvent && (event.nativeEvent.ctrlKey || event.nativeEvent.metaKey)) ||
                    (event.data && event.data.originalEvent && (event.data.originalEvent.ctrlKey || event.data.originalEvent.metaKey))
                );
                if (!isCtrl) {
                    window.EngineState.selectElement(this.draggedElement.id, false);
                }
            }
            
            // Redraw complete slide once dragging ends to make sure text positioning, z-ordering, etc. align
            this.renderSlide(window.EngineState.getActiveSlide());
        }
        
        this.draggedElement = null;
        this.draggedContainer = null;
        this.dragData = null;
        this.activeAction = null;
        this.marqueeStart = null;
        this.marqueeEnd = null;
        
        this.app.stage.off('pointermove', this.onStagePointerMove, this);
        this.app.stage.off('pointerup', this.onStagePointerUp, this);
        this.app.stage.off('pointerupoutside', this.onStagePointerUp, this);
    }

    // ==========================================
    // SELECTION HIGHLIGHTS & HANDLES UI
    // ==========================================
    
    drawSelectionUI() {
        if (!this.uiContainer) return;
        this.uiContainer.removeChildren();
        
        const selectedIds = window.EngineState.selectedElementIds || [];
        if (selectedIds.length === 0) return;
        
        const activeSlide = window.EngineState.getActiveSlide();
        if (!activeSlide) return;
        
        const uiGraphics = new PIXI.Graphics();
        this.uiContainer.addChild(uiGraphics);
        
        // 1. Draw dashed selection box (gold color for all selected elements)
        const goldColor = 0xf1c40f;
        uiGraphics.lineStyle(1.5, goldColor, 1);
        
        const dashLen = 6;
        const gapLen = 4;
        
        const drawDashedLine = (x1, y1, x2, y2) => {
            const dx = x2 - x1;
            const dy = y2 - y1;
            const len = Math.sqrt(dx * dx + dy * dy);
            const normalX = dx / len;
            const normalY = dy / len;
            
            let curLen = 0;
            let draw = true;
            while(curLen < len) {
                const step = draw ? dashLen : gapLen;
                const nextLen = Math.min(len, curLen + step);
                if (draw) {
                    uiGraphics.moveTo(x1 + normalX * curLen, y1 + normalY * curLen);
                    uiGraphics.lineTo(x1 + normalX * nextLen, y1 + normalY * nextLen);
                }
                curLen = nextLen;
                draw = !draw;
            }
        };
        
        selectedIds.forEach(id => {
            const el = activeSlide.elements.find(e => e.id === id);
            if (!el) return;
            
            const padding = 2;
            const x = el.x - padding;
            const y = el.y - padding;
            const w = el.width + (padding * 2);
            const h = el.height + (padding * 2);
            
            drawDashedLine(x, y, x + w, y);
            drawDashedLine(x + w, y, x + w, y + h);
            drawDashedLine(x + w, y + h, x, y + h);
            drawDashedLine(x, y + h, x, y);
        });
        
        // 2. Add resize handles at corners ONLY for the primary active selection
        const primaryId = window.EngineState.selectedElementId;
        const primaryElem = activeSlide.elements.find(e => e.id === primaryId);
        if (primaryElem) {
            const padding = 2;
            const x = primaryElem.x - padding;
            const y = primaryElem.y - padding;
            const w = primaryElem.width + (padding * 2);
            const h = primaryElem.height + (padding * 2);
            
            const handles = [
                { x: x, y: y, cursor: 'nwse-resize' }, // TL
                { x: x + w, y: y, cursor: 'nesw-resize' }, // TR
                { x: x + w, y: y + h, cursor: 'nwse-resize' }, // BR
                { x: x, y: y + h, cursor: 'nesw-resize' } // BL
            ];
            
            handles.forEach((handle, index) => {
                const handleGraphics = new PIXI.Graphics();
                handleGraphics.lineStyle(1.5, goldColor, 1);
                handleGraphics.beginFill(0xffffff);
                handleGraphics.drawRect(-4, -4, 8, 8);
                handleGraphics.endFill();
                
                handleGraphics.x = handle.x;
                handleGraphics.y = handle.y;
                handleGraphics.interactive = true;
                handleGraphics.cursor = handle.cursor;
                
                handleGraphics.on('pointerdown', (e) => {
                    e.stopPropagation();
                    
                    window.EngineState.pushHistory();
                    
                    this.draggedElement = primaryElem;
                    const container = this.pixiElements.get(primaryElem.id);
                    this.draggedContainer = container;
                    this.activeAction = 'resize';
                    this.resizeHandleIndex = index;
                    
                    const localPos = e.data.getLocalPosition(this.app.stage);
                    this.dragData = {
                        startX: localPos.x,
                        startY: localPos.y,
                        elemStartX: primaryElem.x,
                        elemStartY: primaryElem.y,
                        elemStartW: primaryElem.width,
                        elemStartH: primaryElem.height
                    };
                    
                    this.app.stage.interactive = true;
                    this.app.stage.on('pointermove', this.onStagePointerMove, this);
                    this.app.stage.on('pointerup', this.onStagePointerUp, this);
                    this.app.stage.on('pointerupoutside', this.onStagePointerUp, this);
                });
                
                this.uiContainer.addChild(handleGraphics);
            });
        }
    }

    startMarqueeSelection(event) {
        this.activeAction = 'marquee';
        const localPos = event.data.getLocalPosition(this.app.stage);
        this.marqueeStart = { x: localPos.x, y: localPos.y };
        this.marqueeEnd = { x: localPos.x, y: localPos.y };
        
        // Attach moving listeners to stage
        this.app.stage.interactive = true;
        this.app.stage.on('pointermove', this.onStagePointerMove, this);
        this.app.stage.on('pointerup', this.onStagePointerUp, this);
        this.app.stage.on('pointerupoutside', this.onStagePointerUp, this);
    }

    drawMarqueeUI() {
        if (!this.uiContainer || !this.marqueeStart || !this.marqueeEnd) return;
        
        // Draw standard selection outlines first
        this.drawSelectionUI();
        
        // Draw marquee box on top of it
        const graphics = new PIXI.Graphics();
        this.uiContainer.addChild(graphics);
        
        const x1 = Math.min(this.marqueeStart.x, this.marqueeEnd.x);
        const y1 = Math.min(this.marqueeStart.y, this.marqueeEnd.y);
        const x2 = Math.max(this.marqueeStart.x, this.marqueeEnd.x);
        const y2 = Math.max(this.marqueeStart.y, this.marqueeEnd.y);
        
        const w = x2 - x1;
        const h = y2 - y1;
        
        // Premium gold transparent fill and border
        graphics.lineStyle(1.5, 0xf1c40f, 1);
        graphics.beginFill(0xf1c40f, 0.15);
        graphics.drawRect(x1, y1, w, h);
        graphics.endFill();
    }

    applyMarqueeSelection(event) {
        if (!this.marqueeStart || !this.marqueeEnd) return;
        
        const x1 = Math.min(this.marqueeStart.x, this.marqueeEnd.x);
        const y1 = Math.min(this.marqueeStart.y, this.marqueeEnd.y);
        const x2 = Math.max(this.marqueeStart.x, this.marqueeEnd.x);
        const y2 = Math.max(this.marqueeStart.y, this.marqueeEnd.y);
        
        const slide = window.EngineState.getActiveSlide();
        if (!slide) return;
        
        // Find all elements that overlap with this rectangle
        const selectedIds = [];
        slide.elements.forEach(elem => {
            const elLeft = elem.x;
            const elTop = elem.y;
            const elRight = elem.x + elem.width;
            const elBottom = elem.y + elem.height;
            
            const intersects = !(elLeft > x2 || elRight < x1 || elTop > y2 || elBottom < y1);
            if (intersects) {
                selectedIds.push(elem.id);
            }
        });
        
        const isCtrl = event && (
            event.ctrlKey || event.metaKey || 
            (event.nativeEvent && (event.nativeEvent.ctrlKey || event.nativeEvent.metaKey)) ||
            (event.data && event.data.originalEvent && (event.data.originalEvent.ctrlKey || event.data.originalEvent.metaKey))
        );
        
        window.EngineState.selectElements(selectedIds, isCtrl);
    }

    animateSlideTransition(slide, transitionType = 'none', onComplete = null) {
        if (this.activeTransition) {
            this.activeTransition.cancel();
        }

        if (!slide) return;

        // If transition is 'none' or slideContainer has no children, render instantly
        if (transitionType === 'none' || this.slideContainer.children.length === 0) {
            this.renderSlide(slide);
            if (onComplete) onComplete();
            return;
        }

        const oldContainer = new PIXI.Container();
        const newContainer = new PIXI.Container();

        // Move current children to oldContainer
        const childrenToMove = [...this.slideContainer.children];
        childrenToMove.forEach(child => {
            oldContainer.addChild(child);
        });

        this.slideContainer.addChild(oldContainer);
        this.slideContainer.addChild(newContainer);

        // Render new slide content into newContainer
        this.pixiElements.clear();
        this.renderSlide(slide, newContainer);

        let duration = 30; // frames, ~0.5s at 60fps
        let currentFrame = 0;
        let isCancelled = false;

        let washOverlay = null;
        let glitchGraphics = null;

        // Set initial positions/states
        if (transitionType === 'fade') {
            newContainer.alpha = 0;
            oldContainer.alpha = 1;
        } else if (transitionType === 'slide-left') {
            newContainer.x = this.baseWidth;
            oldContainer.x = 0;
        } else if (transitionType === 'slide-right') {
            newContainer.x = -this.baseWidth;
            oldContainer.x = 0;
        } else if (transitionType === 'slide-up') {
            newContainer.y = this.baseHeight;
            oldContainer.y = 0;
        } else if (transitionType === 'slide-down') {
            newContainer.y = -this.baseHeight;
            oldContainer.y = 0;
        } else if (transitionType === 'slide-bounce-left') {
            newContainer.x = this.baseWidth;
            oldContainer.x = 0;
        } else if (transitionType === 'slide-bounce-right') {
            newContainer.x = -this.baseWidth;
            oldContainer.x = 0;
        } else if (transitionType === 'zoom') {
            newContainer.alpha = 0;
            newContainer.scale.set(0.5);
            newContainer.pivot.set(this.baseWidth / 2, this.baseHeight / 2);
            newContainer.position.set(this.baseWidth / 2, this.baseHeight / 2);

            oldContainer.alpha = 1;
            oldContainer.scale.set(1.0);
            oldContainer.pivot.set(this.baseWidth / 2, this.baseHeight / 2);
            oldContainer.position.set(this.baseWidth / 2, this.baseHeight / 2);
        } else if (transitionType === 'spin-zoom') {
            newContainer.alpha = 0;
            newContainer.scale.set(0.1);
            newContainer.pivot.set(this.baseWidth / 2, this.baseHeight / 2);
            newContainer.position.set(this.baseWidth / 2, this.baseHeight / 2);

            oldContainer.alpha = 1;
            oldContainer.scale.set(1.0);
            oldContainer.pivot.set(this.baseWidth / 2, this.baseHeight / 2);
            oldContainer.position.set(this.baseWidth / 2, this.baseHeight / 2);
        } else if (transitionType === 'flip-horizontal' || transitionType === 'flip-vertical') {
            newContainer.pivot.set(this.baseWidth / 2, this.baseHeight / 2);
            newContainer.position.set(this.baseWidth / 2, this.baseHeight / 2);
            newContainer.scale.set(0, 0);

            oldContainer.pivot.set(this.baseWidth / 2, this.baseHeight / 2);
            oldContainer.position.set(this.baseWidth / 2, this.baseHeight / 2);
            oldContainer.scale.set(1, 1);
        } else if (transitionType === 'iris') {
            const maskGraphics = new PIXI.Graphics();
            newContainer.addChild(maskGraphics);
            newContainer.mask = maskGraphics;
            this.irisMask = maskGraphics;
        } else if (transitionType === 'slide-skew-left') {
            newContainer.x = this.baseWidth;
            newContainer.skew.y = 0.2;
            oldContainer.x = 0;
            oldContainer.skew.y = 0;
        } else if (transitionType === 'wash-black' || transitionType === 'wash-white') {
            washOverlay = new PIXI.Graphics();
            const color = transitionType === 'wash-black' ? 0x000000 : 0xffffff;
            washOverlay.beginFill(color, 1);
            washOverlay.drawRect(0, 0, this.baseWidth, this.baseHeight);
            washOverlay.endFill();
            washOverlay.alpha = 0;
            this.slideContainer.addChild(washOverlay);
            newContainer.visible = false;
        } else if (transitionType === 'cross-scale') {
            newContainer.alpha = 0;
            newContainer.scale.set(1.5);
            newContainer.pivot.set(this.baseWidth / 2, this.baseHeight / 2);
            newContainer.position.set(this.baseWidth / 2, this.baseHeight / 2);

            oldContainer.alpha = 1;
            oldContainer.scale.set(1.0);
            oldContainer.pivot.set(this.baseWidth / 2, this.baseHeight / 2);
            oldContainer.position.set(this.baseWidth / 2, this.baseHeight / 2);
        } else if (transitionType === 'diagonal-slide') {
            newContainer.x = this.baseWidth;
            newContainer.y = -this.baseHeight;
            oldContainer.x = 0;
            oldContainer.y = 0;
        } else if (transitionType === 'wipe-left' || transitionType === 'wipe-right' || transitionType === 'wipe-up' || transitionType === 'wipe-down') {
            const maskGraphics = new PIXI.Graphics();
            newContainer.addChild(maskGraphics);
            newContainer.mask = maskGraphics;
        } else if (transitionType === 'split-horizontal' || transitionType === 'split-vertical') {
            const maskGraphics = new PIXI.Graphics();
            newContainer.addChild(maskGraphics);
            newContainer.mask = maskGraphics;
        } else if (transitionType === 'cube-left') {
            oldContainer.pivot.set(this.baseWidth, this.baseHeight / 2);
            oldContainer.position.set(this.baseWidth, this.baseHeight / 2);
            newContainer.pivot.set(0, this.baseHeight / 2);
            newContainer.position.set(0, this.baseHeight / 2);
            newContainer.scale.x = 0;
        } else if (transitionType === 'cube-right') {
            oldContainer.pivot.set(0, this.baseHeight / 2);
            oldContainer.position.set(0, this.baseHeight / 2);
            newContainer.pivot.set(this.baseWidth, this.baseHeight / 2);
            newContainer.position.set(this.baseWidth, this.baseHeight / 2);
            newContainer.scale.x = 0;
        } else if (transitionType === 'spiral') {
            oldContainer.pivot.set(this.baseWidth / 2, this.baseHeight / 2);
            oldContainer.position.set(this.baseWidth / 2, this.baseHeight / 2);
            newContainer.pivot.set(this.baseWidth / 2, this.baseHeight / 2);
            newContainer.position.set(this.baseWidth / 2, this.baseHeight / 2);
            newContainer.scale.set(0);
        } else if (transitionType === 'glitch') {
            glitchGraphics = new PIXI.Graphics();
            this.slideContainer.addChild(glitchGraphics);
            newContainer.alpha = 0;
        } else if (transitionType === 'bounce-zoom') {
            newContainer.pivot.set(this.baseWidth / 2, this.baseHeight / 2);
            newContainer.position.set(this.baseWidth / 2, this.baseHeight / 2);
            newContainer.scale.set(0);
            newContainer.alpha = 0;
            oldContainer.alpha = 1;
        }

        const easeOutElastic = (x) => {
            const c4 = (2 * Math.PI) / 3;
            return x === 0 ? 0 : x === 1 ? 1 : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * c4) + 1;
        };

        const cleanup = () => {
            this.activeTransition = null;
            
            // Pause any videos in oldContainer before discarding it
            this.pauseVideosInContainer(oldContainer);
            
            // Remove mask if we did iris or wipe/split transition
            if (newContainer.mask) {
                const mask = newContainer.mask;
                newContainer.mask = null;
                if (mask.parent) mask.parent.removeChild(mask);
                mask.destroy();
            }
            this.irisMask = null;

            if (washOverlay) {
                if (washOverlay.parent) washOverlay.parent.removeChild(washOverlay);
                washOverlay.destroy();
            }
            if (glitchGraphics) {
                if (glitchGraphics.parent) glitchGraphics.parent.removeChild(glitchGraphics);
                glitchGraphics.destroy();
            }

            // Reset pivots, scales, rotations, skews and positions of children
            newContainer.pivot.set(0, 0);
            newContainer.scale.set(1);
            newContainer.position.set(0, 0);
            newContainer.rotation = 0;
            newContainer.skew.set(0, 0);
            newContainer.visible = true;
            newContainer.alpha = 1;

            oldContainer.pivot.set(0, 0);
            oldContainer.scale.set(1);
            oldContainer.position.set(0, 0);
            oldContainer.rotation = 0;
            oldContainer.skew.set(0, 0);
            oldContainer.visible = true;
            oldContainer.alpha = 1;

            const finalChildren = [...newContainer.children];
            this.slideContainer.removeChildren(); // clears oldContainer/newContainer
            finalChildren.forEach(child => {
                this.slideContainer.addChild(child);
            });
            this.renderVideoOverlays(slide);
        };

        const ticker = () => {
            if (isCancelled) return;

            currentFrame++;
            const t = currentFrame / duration;
            const ease = 1 - Math.pow(1 - t, 3); // cubic ease-out

            if (transitionType === 'fade') {
                newContainer.alpha = t;
                oldContainer.alpha = 1 - t;
            } else if (transitionType === 'slide-left') {
                newContainer.x = this.baseWidth * (1 - ease);
                oldContainer.x = -this.baseWidth * ease;
            } else if (transitionType === 'slide-right') {
                newContainer.x = -this.baseWidth * (1 - ease);
                oldContainer.x = this.baseWidth * ease;
            } else if (transitionType === 'slide-up') {
                newContainer.y = this.baseHeight * (1 - ease);
                oldContainer.y = -this.baseHeight * ease;
            } else if (transitionType === 'slide-down') {
                newContainer.y = -this.baseHeight * (1 - ease);
                oldContainer.y = this.baseHeight * ease;
            } else if (transitionType === 'slide-bounce-left') {
                const bounceEase = easeOutElastic(t);
                newContainer.x = this.baseWidth * (1 - bounceEase);
                oldContainer.x = -this.baseWidth * bounceEase;
            } else if (transitionType === 'slide-bounce-right') {
                const bounceEase = easeOutElastic(t);
                newContainer.x = -this.baseWidth * (1 - bounceEase);
                oldContainer.x = this.baseWidth * bounceEase;
            } else if (transitionType === 'zoom') {
                newContainer.alpha = t;
                newContainer.scale.set(0.5 + 0.5 * ease);
                oldContainer.alpha = 1 - t;
                oldContainer.scale.set(1.0 + 0.5 * ease);
            } else if (transitionType === 'spin-zoom') {
                newContainer.alpha = t;
                newContainer.scale.set(0.1 + 0.9 * ease);
                newContainer.rotation = (1 - ease) * Math.PI;
                oldContainer.alpha = 1 - t;
                oldContainer.scale.set(1.0 + 1.5 * ease);
                oldContainer.rotation = -ease * Math.PI;
            } else if (transitionType === 'flip-horizontal') {
                if (t < 0.5) {
                    const localT = t * 2; // 0 to 1
                    oldContainer.scale.x = 1 - localT;
                    newContainer.scale.x = 0;
                } else {
                    const localT = (t - 0.5) * 2; // 0 to 1
                    oldContainer.scale.x = 0;
                    newContainer.scale.x = localT;
                }
            } else if (transitionType === 'flip-vertical') {
                if (t < 0.5) {
                    const localT = t * 2; // 0 to 1
                    oldContainer.scale.y = 1 - localT;
                    newContainer.scale.y = 0;
                } else {
                    const localT = (t - 0.5) * 2; // 0 to 1
                    oldContainer.scale.y = 0;
                    newContainer.scale.y = localT;
                }
            } else if (transitionType === 'iris') {
                const maxRadius = Math.sqrt(this.baseWidth * this.baseWidth + this.baseHeight * this.baseHeight) / 2;
                const r = maxRadius * ease;
                if (this.irisMask) {
                    this.irisMask.clear();
                    this.irisMask.beginFill(0xffffff, 1);
                    this.irisMask.drawCircle(this.baseWidth / 2, this.baseHeight / 2, r);
                    this.irisMask.endFill();
                }
            } else if (transitionType === 'slide-skew-left') {
                newContainer.x = this.baseWidth * (1 - ease);
                newContainer.skew.y = 0.2 * (1 - ease);
                oldContainer.x = -this.baseWidth * ease;
                oldContainer.skew.y = -0.2 * ease;
            } else if (transitionType === 'wash-black' || transitionType === 'wash-white') {
                if (t < 0.5) {
                    const localT = t * 2;
                    if (washOverlay) washOverlay.alpha = localT;
                    oldContainer.visible = true;
                    newContainer.visible = false;
                } else {
                    const localT = (t - 0.5) * 2;
                    if (washOverlay) washOverlay.alpha = 1 - localT;
                    oldContainer.visible = false;
                    newContainer.visible = true;
                }
            } else if (transitionType === 'cross-scale') {
                oldContainer.alpha = 1 - t;
                oldContainer.scale.set(1.0 - 0.3 * ease);
                newContainer.alpha = t;
                newContainer.scale.set(1.5 - 0.5 * ease);
            } else if (transitionType === 'diagonal-slide') {
                newContainer.x = this.baseWidth * (1 - ease);
                newContainer.y = -this.baseHeight * (1 - ease);
                oldContainer.x = -this.baseWidth * ease;
                oldContainer.y = this.baseHeight * ease;
            } else if (transitionType === 'wipe-left') {
                const mask = newContainer.mask;
                if (mask) {
                    mask.clear();
                    mask.beginFill(0xffffff);
                    mask.drawRect(this.baseWidth * (1 - ease), 0, this.baseWidth * ease, this.baseHeight);
                    mask.endFill();
                }
            } else if (transitionType === 'wipe-right') {
                const mask = newContainer.mask;
                if (mask) {
                    mask.clear();
                    mask.beginFill(0xffffff);
                    mask.drawRect(0, 0, this.baseWidth * ease, this.baseHeight);
                    mask.endFill();
                }
            } else if (transitionType === 'wipe-up') {
                const mask = newContainer.mask;
                if (mask) {
                    mask.clear();
                    mask.beginFill(0xffffff);
                    mask.drawRect(0, this.baseHeight * (1 - ease), this.baseWidth, this.baseHeight * ease);
                    mask.endFill();
                }
            } else if (transitionType === 'wipe-down') {
                const mask = newContainer.mask;
                if (mask) {
                    mask.clear();
                    mask.beginFill(0xffffff);
                    mask.drawRect(0, 0, this.baseWidth, this.baseHeight * ease);
                    mask.endFill();
                }
            } else if (transitionType === 'split-horizontal') {
                const mask = newContainer.mask;
                if (mask) {
                    mask.clear();
                    mask.beginFill(0xffffff);
                    const h = this.baseHeight * ease;
                    const y = (this.baseHeight - h) / 2;
                    mask.drawRect(0, y, this.baseWidth, h);
                    mask.endFill();
                }
            } else if (transitionType === 'split-vertical') {
                const mask = newContainer.mask;
                if (mask) {
                    mask.clear();
                    mask.beginFill(0xffffff);
                    const w = this.baseWidth * ease;
                    const x = (this.baseWidth - w) / 2;
                    mask.drawRect(x, 0, w, this.baseHeight);
                    mask.endFill();
                }
            } else if (transitionType === 'cube-left') {
                oldContainer.scale.x = 1 - ease;
                oldContainer.skew.y = -0.12 * ease;
                oldContainer.alpha = 1 - ease;
                newContainer.scale.x = ease;
                newContainer.skew.y = 0.12 * (1 - ease);
                newContainer.alpha = ease;
            } else if (transitionType === 'cube-right') {
                oldContainer.scale.x = 1 - ease;
                oldContainer.skew.y = 0.12 * ease;
                oldContainer.alpha = 1 - ease;
                newContainer.scale.x = ease;
                newContainer.skew.y = -0.12 * (1 - ease);
                newContainer.alpha = ease;
            } else if (transitionType === 'spiral') {
                oldContainer.scale.set(1 - ease);
                oldContainer.rotation = -ease * Math.PI * 1.5;
                oldContainer.alpha = 1 - t;
                newContainer.scale.set(ease);
                newContainer.rotation = (1 - ease) * Math.PI * 1.5;
                newContainer.alpha = t;
            } else if (transitionType === 'glitch') {
                if (t < 0.5) {
                    oldContainer.alpha = 1;
                    newContainer.alpha = 0;
                    const jitterX = (Math.random() - 0.5) * 45;
                    const jitterY = (Math.random() - 0.5) * 20;
                    const skewX = (Math.random() - 0.5) * 0.12;
                    oldContainer.position.set(jitterX, jitterY);
                    oldContainer.skew.set(skewX, 0);
                } else {
                    oldContainer.alpha = 0;
                    newContainer.alpha = 1;
                    const jitterX = (Math.random() - 0.5) * 30 * (1 - ease);
                    const jitterY = (Math.random() - 0.5) * 15 * (1 - ease);
                    const skewX = (Math.random() - 0.5) * 0.08 * (1 - ease);
                    newContainer.position.set(jitterX, jitterY);
                    newContainer.skew.set(skewX, 0);
                }

                if (glitchGraphics && Math.random() < 0.75) {
                    glitchGraphics.clear();
                    const numBands = Math.floor(Math.random() * 3) + 2;
                    for (let i = 0; i < numBands; i++) {
                        const bandY = Math.random() * this.baseHeight;
                        const bandH = Math.random() * 45 + 10;
                        const bandW = Math.random() * this.baseWidth * 0.7 + this.baseWidth * 0.3;
                        const bandX = Math.random() * (this.baseWidth - bandW);
                        const colors = [0x00ffff, 0xff00ff, 0x00ff00];
                        const color = colors[Math.floor(Math.random() * colors.length)];
                        glitchGraphics.beginFill(color, 0.4);
                        glitchGraphics.drawRect(bandX, bandY, bandW, bandH);
                        glitchGraphics.endFill();
                    }
                } else if (glitchGraphics) {
                    glitchGraphics.clear();
                }
            } else if (transitionType === 'bounce-zoom') {
                const bounceEase = easeOutElastic(t);
                newContainer.scale.set(bounceEase);
                newContainer.alpha = t;
                oldContainer.alpha = 1 - t;
            }

            if (currentFrame < duration) {
                requestAnimationFrame(ticker);
            } else {
                cleanup();
                if (onComplete) onComplete();
            }
        };

        this.activeTransition = {
            cancel: () => {
                isCancelled = true;
                cleanup();
            }
        };

        requestAnimationFrame(ticker);
    }

    clearVideoOverlays() {
        if (!this.container) return;
        const overlays = this.container.querySelectorAll('.html-video-overlay');
        overlays.forEach(el => {
            const iframe = el.querySelector('iframe');
            if (iframe) {
                iframe.src = 'about:blank';
            }
            const video = el.querySelector('video');
            if (video) {
                video.pause();
                video.src = '';
                video.load();
            }
            el.remove();
        });
    }

    renderVideoOverlays(slide) {
        if (!slide || !this.container) return;
        this.clearVideoOverlays();
        
        slide.elements.forEach(elem => {
            if (elem.type !== 'video') return;
            if (this.mode === 'play' && elem.visible === false) return;
            
            const overlay = document.createElement('div');
            overlay.className = 'html-video-overlay';
            overlay.setAttribute('data-element-id', elem.id);
            
            overlay.style.left = `${(elem.x / this.baseWidth) * 100}%`;
            overlay.style.top = `${(elem.y / this.baseHeight) * 100}%`;
            overlay.style.width = `${(elem.width / this.baseWidth) * 100}%`;
            overlay.style.height = `${(elem.height / this.baseHeight) * 100}%`;
            overlay.style.zIndex = elem.zIndex || 0;
            
            if (this.mode === 'edit') {
                overlay.style.border = '1px solid rgba(255, 255, 255, 0.2)';
            }
            
            const ytId = this.getYouTubeId(elem.fileData ? '' : elem.url);
            if (ytId) {
                const iframe = document.createElement('iframe');
                const autoplay = (this.mode === 'play' && elem.autoplay !== false) ? 1 : 0;
                const loop = (elem.loop !== false) ? 1 : 0;
                const mute = (this.mode === 'play' && elem.muted === true) ? 1 : 0;
                
                iframe.src = `https://www.youtube.com/embed/${ytId}?autoplay=${autoplay}&loop=${loop}&playlist=${ytId}&mute=${mute}&controls=1&enablejsapi=1`;
                iframe.allow = "autoplay; encrypted-media";
                iframe.allowFullscreen = true;
                overlay.appendChild(iframe);
            } else {
                const video = document.createElement('video');
                video.src = elem.fileData || elem.url || '';
                video.controls = true;
                video.loop = elem.loop !== false;
                video.muted = (this.mode === 'play' && elem.muted === true) || (this.mode === 'edit');
                
                if (this.mode === 'play') {
                    video.autoplay = elem.autoplay !== false;
                    video.volume = elem.volume !== undefined ? elem.volume : 1.0;
                    if (video.autoplay) {
                        video.play().catch(err => {
                            console.warn("Autoplay blocked, running muted fallback:", err);
                            video.muted = true;
                            video.play().catch(e => console.error("Muted playback failed:", e));
                        });
                    }
                } else {
                    video.autoplay = false;
                    video.currentTime = 0.1;
                }
                overlay.appendChild(video);
            }
            
            this.container.appendChild(overlay);
        });
    }

    getYouTubeId(url) {
        if (!url) return null;
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|shorts\/)([^#\&\?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    }
}

// Bind to window
window.SlideCanvas = SlideCanvas;
