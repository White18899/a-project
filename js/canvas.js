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
        this.isFitMode = true;
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
            backgroundAlpha: 0,
            resolution: window.devicePixelRatio || 1,
            autoDensity: true
        });
        
        this.app.view.style.position = 'absolute';
        this.app.view.style.left = '0';
        this.app.view.style.top = '0';
        this.app.view.style.zIndex = '2';
        
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
        if (typeof ResizeObserver !== 'undefined' && this.container && this.container.parentElement) {
            this.resizeObserver = new ResizeObserver(() => {
                if (this.isFitMode) {
                    this.resize();
                }
            });
            this.resizeObserver.observe(this.container.parentElement);
        }
        
        // In play mode, enable pointer event pass-through on empty canvas areas to allow clicking background videos
        if (this.mode === 'play') {
            this.container.addEventListener('pointermove', (e) => {
                if (!this.app || !this.app.renderer) return;
                
                const rect = this.container.getBoundingClientRect();
                const x = ((e.clientX - rect.left) / rect.width) * this.baseWidth;
                const y = ((e.clientY - rect.top) / rect.height) * this.baseHeight;
                
                let hit = null;
                // PIXI v7 EventSystem hitTest
                if (this.app.renderer.events) {
                    hit = this.app.renderer.events.hitTest(new PIXI.Point(x, y));
                }
                
                // Determine if we hit an interactive element
                const isInteractive = hit && hit !== this.app.stage && (
                    hit.interactive === true || 
                    hit.buttonMode === true || 
                    hit.cursor === 'pointer'
                );
                
                if (isInteractive) {
                    this.app.view.style.pointerEvents = 'auto';
                } else {
                    this.app.view.style.pointerEvents = 'none';
                }
            });
        }
    }

    resize() {
        if (!this.container || !this.app) return;
        
        this.isFitMode = true;
        
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
        if (typeof this.onZoomChange === 'function') {
            this.onZoomChange(this.zoom);
        }
    }

    setZoom(level) {
        this.isFitMode = false;
        this.zoom = level;
        this.container.style.width = `${this.baseWidth * level}px`;
        this.container.style.height = `${this.baseHeight * level}px`;
        
        this.app.view.style.width = '100%';
        this.app.view.style.height = '100%';
        if (typeof this.onZoomChange === 'function') {
            this.onZoomChange(this.zoom);
        }
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
        const bg = slide.background || { type: 'color', color: '#1e293b' };
        
        // Check if we need to render the background in DOM instead of PIXI
        const nonVideoElements = slide.elements.filter(e => e.type !== 'video');
        const minNonVideoZ = nonVideoElements.length > 0 
            ? Math.min(...nonVideoElements.map(e => e.zIndex || 0)) 
            : 0;
        const hasVideoBehind = slide.elements.some(elem => {
            if (elem.type !== 'video') return false;
            if (this.mode === 'play' && elem.visible === false) return false;
            return (elem.zIndex || 0) < minNonVideoZ;
        });

        if (hasVideoBehind && targetContainer === this.slideContainer) {
            // Apply background to DOM container
            if (bg.type === 'color') {
                this.container.style.backgroundColor = bg.color || '#1e293b';
                this.container.style.backgroundImage = 'none';
            } else if (bg.type === 'gradient') {
                this.container.style.backgroundColor = 'transparent';
                this.container.style.backgroundImage = `linear-gradient(${bg.gradientAngle !== undefined ? bg.gradientAngle : 135}deg, ${bg.gradientStart || '#0f172a'}, ${bg.gradientEnd || '#1e293b'})`;
            } else if (bg.type === 'image' && bg.imageUrl) {
                this.container.style.backgroundColor = 'transparent';
                this.container.style.backgroundImage = `url(${bg.imageUrl})`;
                this.container.style.backgroundSize = 'cover';
                this.container.style.backgroundPosition = 'center';
            } else {
                this.container.style.backgroundColor = '#1e293b';
                this.container.style.backgroundImage = 'none';
            }
            return; // Skip rendering background in PIXI
        }

        // Otherwise, render in PIXI and clear DOM background
        if (targetContainer === this.slideContainer) {
            this.container.style.backgroundColor = '';
            this.container.style.backgroundImage = '';
        }

        const bgGraphics = new PIXI.Graphics();
        
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
                let loadUrl = bg.imageUrl;
                if (bg.imageUrl && (bg.imageUrl.startsWith('http://') || bg.imageUrl.startsWith('https://'))) {
                    const separator = bg.imageUrl.includes('?') ? '&' : '?';
                    loadUrl = `${bg.imageUrl}${separator}pixi-cors=true`;
                }
                const texture = PIXI.Texture.from(loadUrl);
                const sprite = new PIXI.Sprite(texture);
                sprite.width = this.baseWidth;
                sprite.height = this.baseHeight;
                targetContainer.addChild(sprite);
                
                if (!texture.baseTexture.valid) {
                    sprite.visible = false;
                    
                    const loadingContainer = new PIXI.Container();
                    targetContainer.addChild(loadingContainer);
                    
                    const loadingBg = new PIXI.Graphics();
                    loadingBg.beginFill(0x0f172a);
                    loadingBg.drawRect(0, 0, this.baseWidth, this.baseHeight);
                    loadingBg.endFill();
                    loadingContainer.addChild(loadingBg);
                    
                    const spinner = new PIXI.Graphics();
                    spinner.x = this.baseWidth / 2;
                    spinner.y = this.baseHeight / 2;
                    loadingContainer.addChild(spinner);
                    
                    const textStyle = new PIXI.TextStyle({
                        fontFamily: 'Outfit',
                        fontSize: 32,
                        fill: '#cbd5e1',
                        align: 'center'
                    });
                    const loadingText = new PIXI.Text("Loading Background...", textStyle);
                    loadingText.anchor.set(0.5);
                    loadingText.x = this.baseWidth / 2;
                    loadingText.y = this.baseHeight / 2 + 80;
                    loadingContainer.addChild(loadingText);
                    
                    let angle = 0;
                    const drawSpinner = () => {
                        spinner.clear();
                        spinner.lineStyle(6, 0xf1c40f, 1);
                        spinner.arc(0, 0, 40, angle, angle + Math.PI * 1.5);
                    };
                    
                    const animate = (delta) => {
                        angle += 0.1 * delta;
                        drawSpinner();
                    };
                    this.app.ticker.add(animate);
                    
                    texture.baseTexture.once('loaded', () => {
                        this.app.ticker.remove(animate);
                        sprite.visible = true;
                        sprite.width = this.baseWidth;
                        sprite.height = this.baseHeight;
                        loadingContainer.destroy({ children: true });
                    });
                    
                    texture.baseTexture.once('error', () => {
                        this.app.ticker.remove(animate);
                        loadingContainer.destroy({ children: true });
                    });
                } else {
                    texture.baseTexture.on('loaded', () => {
                        sprite.width = this.baseWidth;
                        sprite.height = this.baseHeight;
                    });
                }
            } catch (e) {
                console.error("BG Image load failed: ", e);
                // Fallback
                const fallbackGraphics = new PIXI.Graphics();
                fallbackGraphics.beginFill(0x0f172a);
                fallbackGraphics.drawRect(0, 0, this.baseWidth, this.baseHeight);
                fallbackGraphics.endFill();
                targetContainer.addChild(fallbackGraphics);
            }
        }
    }

    renderElement(elem, slideRpgTheme = false, targetContainer = this.slideContainer) {
        const existing = this.pixiElements.get(elem.id);
        if (existing) {
            if (existing.parent) {
                existing.parent.removeChild(existing);
            }
            existing.destroy({ children: true });
        }

        const container = new PIXI.Container();
        if (elem.rotation) {
            container.pivot.set(elem.width / 2, elem.height / 2);
            container.x = elem.x + elem.width / 2;
            container.y = elem.y + elem.height / 2;
            container.rotation = elem.rotation * Math.PI / 180;
        } else {
            container.pivot.set(0, 0);
            container.x = elem.x;
            container.y = elem.y;
            container.rotation = 0;
        }
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
            const defaultAlign = (elem.type.startsWith('btn-') || elem.type === 'timer') ? 'center' : 'left';
            const resolvedAlign = elem.align || defaultAlign;

            const textStyle = new PIXI.TextStyle({
                fontFamily: isRpg ? 'Press Start 2P' : (elem.fontFamily || 'Outfit'),
                fontSize: isRpg ? Math.max(elem.fontSize - 8, 12) : (elem.fontSize || 24),
                fill: elem.textColor || '#ffffff',
                align: resolvedAlign,
                wordWrap: true,
                wordWrapWidth: contentWidth - (padding * 2)
            });
            
            const pixiText = new PIXI.Text(elem.text, textStyle);
            
            // Alignments
            pixiText.x = padding;
            if (resolvedAlign === 'center') {
                pixiText.x = contentWidth / 2;
                pixiText.anchor.x = 0.5;
            } else if (resolvedAlign === 'right') {
                pixiText.x = contentWidth - padding;
                pixiText.anchor.x = 1;
            }
            
            // Center text vertically
            pixiText.y = (contentHeight - pixiText.height) / 2;
            if (pixiText.y < padding) pixiText.y = padding;
            
            container.addChild(pixiText);
            container.textNode = pixiText; // Ref for runtime update
            
        } else if (elem.type === 'shape') {
            const shapeType = elem.shapeType || 'rectangle';
            const w = contentWidth;
            const h = contentHeight;
            const r = elem.borderRadius || 0;
            
            const parseColor = (colStr) => {
                if (!colStr || colStr === 'transparent') return 0x000000;
                return parseInt(colStr.replace('#', '0x'));
            };
            
            const fillColor = parseColor(elem.bgColor);
            const fillAlpha = elem.bgColor === 'transparent' ? 0 : (elem.bgAlpha !== undefined ? elem.bgAlpha : 1);
            
            const borderW = elem.borderWidth || 0;
            const borderCol = parseColor(elem.borderColor);
            
            if (borderW > 0 && elem.borderStyle !== 'none') {
                graphics.lineStyle(borderW, borderCol, 1);
            } else {
                graphics.lineStyle(0);
            }
            
            if (fillAlpha > 0) {
                graphics.beginFill(fillColor, fillAlpha);
            }
            
            if (shapeType === 'rectangle') {
                if (r > 0) {
                    graphics.drawRoundedRect(0, 0, w, h, r);
                } else {
                    graphics.drawRect(0, 0, w, h);
                }
            } else if (shapeType === 'circle') {
                graphics.drawCircle(w / 2, h / 2, Math.min(w, h) / 2);
            } else if (shapeType === 'triangle') {
                graphics.drawPolygon([w / 2, 0, w, h, 0, h]);
            } else if (shapeType === 'star') {
                const cx = w / 2;
                const cy = h / 2;
                const outerRadius = Math.min(w, h) / 2;
                const innerRadius = outerRadius * 0.4;
                const spikes = 5;
                let rot = (Math.PI / 2) * 3;
                let x = cx;
                let y = cy;
                const step = Math.PI / spikes;

                graphics.moveTo(cx, cy - outerRadius);
                for (let i = 0; i < spikes; i++) {
                    x = cx + Math.cos(rot) * outerRadius;
                    y = cy + Math.sin(rot) * outerRadius;
                    graphics.lineTo(x, y);
                    rot += step;

                    x = cx + Math.cos(rot) * innerRadius;
                    y = cy + Math.sin(rot) * innerRadius;
                    graphics.lineTo(x, y);
                    rot += step;
                }
                graphics.closePath();
            } else if (shapeType === 'pentagon') {
                const cx = w / 2;
                const cy = h / 2;
                const rx = w / 2;
                const ry = h / 2;
                graphics.moveTo(cx + rx * Math.cos(-Math.PI / 2), cy + ry * Math.sin(-Math.PI / 2));
                for (let i = 1; i <= 5; i++) {
                    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
                    graphics.lineTo(cx + rx * Math.cos(angle), cy + ry * Math.sin(angle));
                }
                graphics.closePath();
            } else if (shapeType === 'hexagon') {
                const cx = w / 2;
                const cy = h / 2;
                const rx = w / 2;
                const ry = h / 2;
                graphics.moveTo(cx + rx * Math.cos(0), cy + ry * Math.sin(0));
                for (let i = 1; i <= 6; i++) {
                    const angle = (i * 2 * Math.PI) / 6;
                    graphics.lineTo(cx + rx * Math.cos(angle), cy + ry * Math.sin(angle));
                }
                graphics.closePath();
            } else if (shapeType === 'octagon') {
                const cx = w / 2;
                const cy = h / 2;
                const rx = w / 2;
                const ry = h / 2;
                graphics.moveTo(cx + rx * Math.cos(Math.PI / 8), cy + ry * Math.sin(Math.PI / 8));
                for (let i = 1; i <= 8; i++) {
                    const angle = Math.PI / 8 + (i * 2 * Math.PI) / 8;
                    graphics.lineTo(cx + rx * Math.cos(angle), cy + ry * Math.sin(angle));
                }
                graphics.closePath();
            } else if (shapeType === 'diamond') {
                graphics.moveTo(w / 2, 0);
                graphics.lineTo(w, h / 2);
                graphics.lineTo(w / 2, h);
                graphics.lineTo(0, h / 2);
                graphics.closePath();
            } else if (shapeType === 'right-triangle') {
                graphics.moveTo(0, 0);
                graphics.lineTo(w, h);
                graphics.lineTo(0, h);
                graphics.closePath();
            } else if (shapeType === 'arrow-right') {
                graphics.moveTo(0, h * 0.3);
                graphics.lineTo(w * 0.6, h * 0.3);
                graphics.lineTo(w * 0.6, 0);
                graphics.lineTo(w, h * 0.5);
                graphics.lineTo(w * 0.6, h);
                graphics.lineTo(w * 0.6, h * 0.7);
                graphics.lineTo(0, h * 0.7);
                graphics.closePath();
            } else if (shapeType === 'heart') {
                const cx = w / 2;
                graphics.moveTo(cx, h * 0.3);
                graphics.bezierCurveTo(w * 0.25, 0, 0, h * 0.25, 0, h * 0.5);
                graphics.bezierCurveTo(0, h * 0.75, w * 0.3, h * 0.9, cx, h);
                graphics.bezierCurveTo(w * 0.7, h * 0.9, w, h * 0.75, w, h * 0.5);
                graphics.bezierCurveTo(w, h * 0.25, w * 0.75, 0, cx, h * 0.3);
                graphics.closePath();
            } else if (shapeType === 'line') {
                graphics.moveTo(0, h / 2);
                graphics.lineTo(w, h / 2);
            } else if (shapeType === 'oval') {
                graphics.drawEllipse(w / 2, h / 2, w / 2, h / 2);
            } else if (shapeType === 'parallelogram') {
                graphics.moveTo(w * 0.2, 0);
                graphics.lineTo(w, 0);
                graphics.lineTo(w * 0.8, h);
                graphics.lineTo(0, h);
                graphics.closePath();
            } else if (shapeType === 'trapezoid') {
                graphics.moveTo(w * 0.2, 0);
                graphics.lineTo(w * 0.8, 0);
                graphics.lineTo(w, h);
                graphics.lineTo(0, h);
                graphics.closePath();
            } else if (shapeType === 'cross') {
                graphics.moveTo(w * 0.35, 0);
                graphics.lineTo(w * 0.65, 0);
                graphics.lineTo(w * 0.65, h * 0.35);
                graphics.lineTo(w, h * 0.35);
                graphics.lineTo(w, h * 0.65);
                graphics.lineTo(w * 0.65, h * 0.65);
                graphics.lineTo(w * 0.65, h);
                graphics.lineTo(w * 0.35, h);
                graphics.lineTo(w * 0.35, h * 0.65);
                graphics.lineTo(0, h * 0.65);
                graphics.lineTo(0, h * 0.35);
                graphics.lineTo(w * 0.35, h * 0.35);
                graphics.closePath();
            } else if (shapeType === 'shield') {
                graphics.moveTo(0, 0);
                graphics.lineTo(w, 0);
                graphics.lineTo(w, h * 0.4);
                graphics.quadraticCurveTo(w, h * 0.75, w / 2, h);
                graphics.quadraticCurveTo(0, h * 0.75, 0, h * 0.4);
                graphics.closePath();
            } else if (shapeType === 'speech-bubble') {
                const rectH = h * 0.8;
                const bubbleRadius = Math.min(w, rectH) * 0.1;
                graphics.drawRoundedRect(0, 0, w, rectH, bubbleRadius);
                graphics.moveTo(w * 0.2, rectH);
                graphics.lineTo(w * 0.1, h);
                graphics.lineTo(w * 0.35, rectH);
                graphics.closePath();
            } else if (shapeType === 'arrow-left') {
                graphics.moveTo(w, h * 0.3);
                graphics.lineTo(w * 0.4, h * 0.3);
                graphics.lineTo(w * 0.4, 0);
                graphics.lineTo(0, h * 0.5);
                graphics.lineTo(w * 0.4, h);
                graphics.lineTo(w * 0.4, h * 0.7);
                graphics.lineTo(w, h * 0.7);
                graphics.closePath();
            } else if (shapeType === 'arrow-up') {
                graphics.moveTo(w * 0.3, h);
                graphics.lineTo(w * 0.3, h * 0.4);
                graphics.lineTo(0, h * 0.4);
                graphics.lineTo(w * 0.5, 0);
                graphics.lineTo(w, h * 0.4);
                graphics.lineTo(w * 0.7, h * 0.4);
                graphics.lineTo(w * 0.7, h);
                graphics.closePath();
            } else if (shapeType === 'arrow-down') {
                graphics.moveTo(w * 0.3, 0);
                graphics.lineTo(w * 0.3, h * 0.6);
                graphics.lineTo(0, h * 0.6);
                graphics.lineTo(w * 0.5, h);
                graphics.lineTo(w, h * 0.6);
                graphics.lineTo(w * 0.7, h * 0.6);
                graphics.lineTo(w * 0.7, 0);
                graphics.closePath();
            } else if (shapeType === 'double-arrow') {
                graphics.moveTo(w * 0.2, h * 0.3);
                graphics.lineTo(w * 0.8, h * 0.3);
                graphics.lineTo(w * 0.8, 0);
                graphics.lineTo(w, h * 0.5);
                graphics.lineTo(w * 0.8, h);
                graphics.lineTo(w * 0.8, h * 0.7);
                graphics.lineTo(w * 0.2, h * 0.7);
                graphics.lineTo(w * 0.2, h);
                graphics.lineTo(0, h * 0.5);
                graphics.lineTo(w * 0.2, 0);
                graphics.closePath();
            }
            
            if (fillAlpha > 0) {
                graphics.endFill();
            }
            
        } else if (elem.type === 'image') {
            try {
                let texture;
                if (elem.fileData) {
                    texture = PIXI.Texture.from(elem.fileData);
                } else {
                    let loadUrl = elem.url;
                    if (elem.url && (elem.url.startsWith('http://') || elem.url.startsWith('https://'))) {
                        const separator = elem.url.includes('?') ? '&' : '?';
                        loadUrl = `${elem.url}${separator}pixi-cors=true`;
                    }
                    texture = PIXI.Texture.from(loadUrl);
                }
                
                const sprite = new PIXI.Sprite(texture);
                container.addChild(sprite);
                
                if (texture.baseTexture.valid) {
                    sprite.width = contentWidth;
                    sprite.height = contentHeight;
                } else {
                    sprite.width = contentWidth;
                    sprite.height = contentHeight;
                    sprite.visible = false;
                    
                    const loadingContainer = new PIXI.Container();
                    container.addChild(loadingContainer);
                    
                    const loadingBg = new PIXI.Graphics();
                    loadingBg.beginFill(0x1e293b, 0.8);
                    loadingBg.drawRect(0, 0, contentWidth, contentHeight);
                    loadingBg.endFill();
                    loadingContainer.addChild(loadingBg);
                    
                    const spinner = new PIXI.Graphics();
                    spinner.x = contentWidth / 2;
                    spinner.y = contentHeight / 2;
                    loadingContainer.addChild(spinner);
                    
                    const textStyle = new PIXI.TextStyle({
                        fontFamily: 'Outfit',
                        fontSize: Math.max(10, Math.min(18, contentHeight * 0.1)),
                        fill: '#cbd5e1',
                        align: 'center'
                    });
                    const loadingText = new PIXI.Text("Loading Image...", textStyle);
                    loadingText.anchor.set(0.5);
                    loadingText.x = contentWidth / 2;
                    loadingText.y = contentHeight / 2 + Math.max(20, contentHeight * 0.15);
                    loadingContainer.addChild(loadingText);
                    
                    let angle = 0;
                    const drawSpinner = () => {
                        spinner.clear();
                        spinner.lineStyle(3, 0xf1c40f, 1);
                        spinner.arc(0, 0, Math.min(20, Math.min(contentWidth, contentHeight) * 0.15), angle, angle + Math.PI * 1.5);
                    };
                    
                    const animate = (delta) => {
                        angle += 0.1 * delta;
                        drawSpinner();
                    };
                    this.app.ticker.add(animate);
                    
                    texture.baseTexture.once('loaded', () => {
                        this.app.ticker.remove(animate);
                        sprite.visible = true;
                        sprite.width = contentWidth;
                        sprite.height = contentHeight;
                        loadingContainer.destroy({ children: true });
                    });
                    
                    texture.baseTexture.once('error', () => {
                        this.app.ticker.remove(animate);
                        loadingContainer.destroy({ children: true });
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
            if (this.mode === 'edit') {
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
            } else {
                // In play mode, draw a transparent box so the video underneath is visible
                graphics.beginFill(0x000000, 0);
                graphics.drawRect(0, 0, contentWidth, contentHeight);
                graphics.endFill();
            }
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

            // Draw custom borders
            if (elem.borderWidth && elem.borderWidth > 0 && elem.borderStyle && elem.borderStyle !== 'none') {
                const borCol = elem.borderColor || '#ffffff';
                const borColorHex = parseInt(borCol.replace('#', '0x'));
                
                if (elem.borderStyle === 'solid' || radius > 0) {
                    // Use PIXI native border drawing
                    // alignment 0 draws inner border
                    graphics.lineStyle(elem.borderWidth, borColorHex, 1, 0);
                    if (radius > 0) {
                        graphics.drawRoundedRect(0, 0, w, h, radius);
                    } else {
                        graphics.drawRect(0, 0, w, h);
                    }
                } else {
                    // For dashed/dotted without border radius, draw custom lines inset by width/2
                    const inset = elem.borderWidth / 2;
                    const x1 = inset, y1 = inset;
                    const x2 = w - inset, y2 = h - inset;
                    
                    let dashLen = 8;
                    let gapLen = 6;
                    if (elem.borderStyle === 'dotted') {
                        dashLen = Math.max(2, elem.borderWidth);
                        gapLen = Math.max(3, elem.borderWidth * 1.5);
                    } else { // dashed
                        dashLen = Math.max(10, elem.borderWidth * 3);
                        gapLen = Math.max(6, elem.borderWidth * 2);
                    }
                    
                    const drawDashedLineLocal = (gx, xStart, yStart, xEnd, yEnd) => {
                        const dx = xEnd - xStart;
                        const dy = yEnd - yStart;
                        const len = Math.sqrt(dx * dx + dy * dy);
                        if (len === 0) return;
                        const nx = dx / len;
                        const ny = dy / len;
                        
                        gx.lineStyle(elem.borderWidth, borColorHex, 1);
                        
                        let dist = 0;
                        let draw = true;
                        while (dist < len) {
                            const step = draw ? dashLen : gapLen;
                            const nextDist = Math.min(len, dist + step);
                            
                            const px1 = xStart + nx * dist;
                            const py1 = yStart + ny * dist;
                            const px2 = xStart + nx * nextDist;
                            const py2 = yStart + ny * nextDist;
                            
                            if (draw) {
                                gx.moveTo(px1, py1);
                                gx.lineTo(px2, py2);
                            }
                            
                            dist = nextDist;
                            draw = !draw;
                        }
                    };

                    // Draw 4 segments
                    drawDashedLineLocal(graphics, x1, y1, x2, y1);
                    drawDashedLineLocal(graphics, x2, y1, x2, y2);
                    drawDashedLineLocal(graphics, x2, y2, x1, y2);
                    drawDashedLineLocal(graphics, x1, y2, x1, y1);
                }
            }
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
                if (elem.rotation) {
                    container.x = newX + elem.width / 2;
                    container.y = newY + elem.height / 2;
                } else {
                    container.x = newX;
                    container.y = newY;
                }

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
            this.renderElement(this.draggedElement, window.EngineState.getActiveSlide().rpgTheme);
            this.draggedContainer = this.pixiElements.get(this.draggedElement.id);
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
        
        const goldColor = 0xf1c40f;
        const dashLen = 6;
        const gapLen = 4;
        
        const drawDashedBox = (graphics, w, h) => {
            const padding = 2;
            const x1 = -padding;
            const y1 = -padding;
            const x2 = w + padding;
            const y2 = h + padding;
            
            const drawDashedLineLocal = (xStart, yStart, xEnd, yEnd) => {
                const dx = xEnd - xStart;
                const dy = yEnd - yStart;
                const len = Math.sqrt(dx * dx + dy * dy);
                const normalX = dx / len;
                const normalY = dy / len;
                
                let curLen = 0;
                let draw = true;
                while(curLen < len) {
                    const step = draw ? dashLen : gapLen;
                    const nextLen = Math.min(len, curLen + step);
                    if (draw) {
                        graphics.moveTo(xStart + normalX * curLen, yStart + normalY * curLen);
                        graphics.lineTo(xStart + normalX * nextLen, yStart + normalY * nextLen);
                    }
                    curLen = nextLen;
                    draw = !draw;
                }
            };
            
            drawDashedLineLocal(x1, y1, x2, y1);
            drawDashedLineLocal(x2, y1, x2, y2);
            drawDashedLineLocal(x2, y2, x1, y2);
            drawDashedLineLocal(x1, y2, x1, y1);
        };
        
        selectedIds.forEach(id => {
            const el = activeSlide.elements.find(e => e.id === id);
            if (!el) return;
            
            // Create a selection container that mirrors the element's container properties
            const selectionBoxContainer = new PIXI.Container();
            if (el.rotation) {
                selectionBoxContainer.pivot.set(el.width / 2, el.height / 2);
                selectionBoxContainer.position.set(el.x + el.width / 2, el.y + el.height / 2);
                selectionBoxContainer.rotation = el.rotation * Math.PI / 180;
            } else {
                selectionBoxContainer.pivot.set(0, 0);
                selectionBoxContainer.position.set(el.x, el.y);
                selectionBoxContainer.rotation = 0;
            }
            this.uiContainer.addChild(selectionBoxContainer);
            
            const outlineGraphics = new PIXI.Graphics();
            outlineGraphics.lineStyle(1.5, goldColor, 1);
            drawDashedBox(outlineGraphics, el.width, el.height);
            selectionBoxContainer.addChild(outlineGraphics);
            
            // 2. Add resize handles at corners ONLY for the primary active selection
            const primaryId = window.EngineState.selectedElementId;
            if (id === primaryId) {
                const padding = 2;
                const handles = [
                    { x: -padding, y: -padding, cursor: 'nwse-resize' }, // TL
                    { x: el.width + padding, y: -padding, cursor: 'nesw-resize' }, // TR
                    { x: el.width + padding, y: el.height + padding, cursor: 'nwse-resize' }, // BR
                    { x: -padding, y: el.height + padding, cursor: 'nesw-resize' } // BL
                ];
                
                handles.forEach((handle, index) => {
                    const handleGraphics = new PIXI.Graphics();
                    handleGraphics.lineStyle(1.5, goldColor, 1);
                    handleGraphics.beginFill(0xffffff);
                    handleGraphics.drawRect(-7, -7, 14, 14);
                    handleGraphics.endFill();
                    
                    handleGraphics.x = handle.x;
                    handleGraphics.y = handle.y;
                    handleGraphics.interactive = true;
                    handleGraphics.cursor = handle.cursor;
                    
                    handleGraphics.on('pointerdown', (e) => {
                        e.stopPropagation();
                        
                        window.EngineState.pushHistory();
                        
                        this.draggedElement = el;
                        const container = this.pixiElements.get(el.id);
                        this.draggedContainer = container;
                        this.activeAction = 'resize';
                        this.resizeHandleIndex = index;
                        
                        const localPos = e.data.getLocalPosition(this.app.stage);
                        this.dragData = {
                            startX: localPos.x,
                            startY: localPos.y,
                            elemStartX: el.x,
                            elemStartY: el.y,
                            elemStartW: el.width,
                            elemStartH: el.height
                        };
                        
                        this.app.stage.interactive = true;
                        this.app.stage.on('pointermove', this.onStagePointerMove, this);
                        this.app.stage.on('pointerup', this.onStagePointerUp, this);
                        this.app.stage.on('pointerupoutside', this.onStagePointerUp, this);
                    });
                    
                    selectionBoxContainer.addChild(handleGraphics);
                });
            }
        });
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
        
        // Find all active video elements on the slide
        const activeVideoIds = new Set(
            slide.elements
                .filter(elem => elem.type === 'video' && !(this.mode === 'play' && elem.visible === false))
                .map(elem => elem.id)
        );
        
        // Remove overlays that are no longer active
        const existingOverlays = this.container.querySelectorAll('.html-video-overlay');
        existingOverlays.forEach(el => {
            const id = el.getAttribute('data-element-id');
            if (!activeVideoIds.has(id)) {
                const iframe = el.querySelector('iframe');
                if (iframe) iframe.src = 'about:blank';
                const video = el.querySelector('video');
                if (video) {
                    try {
                        video.pause();
                        video.src = '';
                        video.load();
                    } catch(e) {}
                }
                el.remove();
            }
        });
        
        // Add or update active video overlays
        slide.elements.forEach(elem => {
            if (elem.type !== 'video') return;
            if (this.mode === 'play' && elem.visible === false) return;
            
            let overlay = this.container.querySelector(`.html-video-overlay[data-element-id="${elem.id}"]`);
            let isNew = false;
            
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.className = 'html-video-overlay';
                overlay.setAttribute('data-element-id', elem.id);
                isNew = true;
            }
            
            // Update positioning and z-index styles
            overlay.style.left = `${(elem.x / this.baseWidth) * 100}%`;
            overlay.style.top = `${(elem.y / this.baseHeight) * 100}%`;
            overlay.style.width = `${(elem.width / this.baseWidth) * 100}%`;
            overlay.style.height = `${(elem.height / this.baseHeight) * 100}%`;
            
            // Layer ordering: compare with min zIndex of non-video elements
            const nonVideoElements = slide.elements.filter(e => e.type !== 'video');
            const minNonVideoZ = nonVideoElements.length > 0 
                ? Math.min(...nonVideoElements.map(e => e.zIndex || 0)) 
                : 0;
            
            if ((elem.zIndex || 0) < minNonVideoZ) {
                overlay.style.zIndex = '1';
            } else {
                overlay.style.zIndex = '3';
            }
            
            if (this.mode === 'edit') {
                overlay.style.border = '1px solid rgba(255, 255, 255, 0.2)';
            } else {
                overlay.style.border = 'none';
            }
            
            const ytId = this.getYouTubeId(elem.fileData ? '' : elem.url);
            if (ytId) {
                const autoplay = (this.mode === 'play' && elem.autoplay !== false) ? 1 : 0;
                const loop = (elem.loop !== false) ? 1 : 0;
                const mute = (this.mode === 'play' && elem.muted === true) ? 1 : 0;
                const targetSrc = `https://www.youtube.com/embed/${ytId}?autoplay=${autoplay}&loop=${loop}&playlist=${ytId}&mute=${mute}&controls=1&enablejsapi=1`;
                
                const existingIframe = overlay.querySelector('iframe');
                if (!existingIframe) {
                    const oldVideo = overlay.querySelector('video');
                    if (oldVideo) {
                        try {
                            oldVideo.pause();
                            oldVideo.src = '';
                            oldVideo.load();
                        } catch(e) {}
                        oldVideo.remove();
                    }
                    
                    const iframe = document.createElement('iframe');
                    iframe.src = targetSrc;
                    iframe.allow = "autoplay; encrypted-media";
                    iframe.allowFullscreen = true;
                    overlay.appendChild(iframe);
                } else {
                    const currentSrc = existingIframe.src;
                    const resolvedTargetSrc = targetSrc ? new URL(targetSrc, window.location.href).href : '';
                    if (currentSrc !== resolvedTargetSrc) {
                        existingIframe.src = targetSrc;
                    }
                }
            } else {
                const targetSrc = elem.fileData || elem.url || '';
                const existingVideo = overlay.querySelector('video');
                
                if (!existingVideo) {
                    const oldIframe = overlay.querySelector('iframe');
                    if (oldIframe) {
                        oldIframe.src = 'about:blank';
                        oldIframe.remove();
                    }
                    
                    const video = document.createElement('video');
                    video.src = targetSrc;
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
                } else {
                    const currentSrc = existingVideo.src;
                    const resolvedTargetSrc = targetSrc ? new URL(targetSrc, window.location.href).href : '';
                    if (currentSrc !== resolvedTargetSrc) {
                        existingVideo.src = targetSrc;
                        existingVideo.load();
                    }
                    existingVideo.loop = elem.loop !== false;
                    existingVideo.muted = (this.mode === 'play' && elem.muted === true) || (this.mode === 'edit');
                    if (this.mode === 'play') {
                        existingVideo.volume = elem.volume !== undefined ? elem.volume : 1.0;
                        const isAutoplay = elem.autoplay !== false;
                        if (isAutoplay && existingVideo.paused) {
                            existingVideo.play().catch(() => {});
                        }
                    } else {
                        if (!existingVideo.paused) {
                            existingVideo.pause();
                        }
                    }
                }
            }
            
            if (isNew) {
                this.container.appendChild(overlay);
            }
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
