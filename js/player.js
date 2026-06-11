/**
 * SlideEngine Presentation Player
 * Handles play-mode interactions, MCQ correctness checking, timers,
 * fade animations for visibilities, and dual-window sync via BroadcastChannel.
 */

class PlayerController {
    constructor() {
        this.canvas = null;
        this.project = null;
        this.currentSlideId = null;
        this.sessionMarkups = new Map();
        
        // Active Timers
        this.timerInterval = null;
        this.timerSeconds = 0;
        
        // Broadcast Channel for Dual Display Synchronization
        this.syncChannel = new BroadcastChannel('slide_engine_sync');
        this.isProjectorWindow = false;
        
        this.initSync();
    }

    initSync() {
        // Listen to cross-window commands
        this.syncChannel.onmessage = (event) => {
            const msg = event.data;
            if (!msg) return;
            
            if (msg.type === 'sync-project') {
                this.project = msg.project;
                if (msg.activeSlideId) {
                    this.navigate(msg.activeSlideId, false);
                }
            } else if (msg.type === 'navigate') {
                this.navigate(msg.slideId, false);
            } else if (msg.type === 'trigger-element') {
                this.syncTriggerElement(msg.elementId, msg.actionData);
            } else if (msg.type === 'reset-slide') {
                this.resetCurrentSlide(false);
            }
        };
    }

    // Start local presentations
    start(project, startSlideId) {
        this.project = project;
        this.currentSlideId = startSlideId;
        this.isProjectorWindow = false;
        this.sessionMarkups = new Map();

        const overlay = document.getElementById('presentation-overlay');
        overlay.classList.add('active');

        // Init Player WebGL Canvas
        this.canvas = new window.SlideCanvas('player-canvas-container', 'play');

        // Update HUD Details
        document.getElementById('player-project-title').textContent = project.name;
        this.updateHUD();

        // Bind Controls
        this.bindEvents();

        // Render current slide
        this.navigate(startSlideId, true);
        
        // Request sync to popup if open
        this.broadcastSync();
    }

    // Start projector window mode
    startProjectorMode() {
        this.isProjectorWindow = true;
        // Init WebGL SlideCanvas on body or container
        this.canvas = new window.SlideCanvas('player-canvas-container', 'play');
        
        // Request initial state from main editor
        this.syncChannel.postMessage({ type: 'request-sync' });
        
        // Listen to keyboard for fullscreen
        window.addEventListener('keydown', (e) => {
            if (e.key.toLowerCase() === 'f') {
                this.toggleFullscreen();
            }
        });
    }

    updateHUD() {
        if (this.isProjectorWindow || !this.project) return;
        
        const slides = this.project.slides;
        const currentIdx = slides.findIndex(s => s.id === this.currentSlideId);
        
        document.getElementById('player-current-slide-num').textContent = currentIdx + 1;
        document.getElementById('player-total-slides').textContent = slides.length;
    }

    bindEvents() {
        if (this.isProjectorWindow) return;

        // Button events
        const prevBtn = document.getElementById('btn-hud-prev');
        const nextBtn = document.getElementById('btn-hud-next');
        const resetBtn = document.getElementById('btn-hud-reset');
        const fsBtn = document.getElementById('btn-hud-fullscreen');
        const exitBtn = document.getElementById('btn-hud-exit');

        prevBtn.onclick = () => this.prevSlide();
        nextBtn.onclick = () => this.nextSlide();
        resetBtn.onclick = () => this.resetCurrentSlide(true);
        fsBtn.onclick = () => this.toggleFullscreen();
        exitBtn.onclick = () => this.exit();

        // Keyboard bindings
        this.keyHandler = (e) => {
            if (e.key === 'ArrowRight' || e.key === ' ') {
                this.nextSlide();
            } else if (e.key === 'ArrowLeft') {
                this.prevSlide();
            } else if (e.key.toLowerCase() === 'r') {
                this.resetCurrentSlide(true);
            } else if (e.key === 'Escape') {
                this.exit();
            } else if (e.key.toLowerCase() === 'f') {
                this.toggleFullscreen();
            }
        };
        window.addEventListener('keydown', this.keyHandler);
    }

    unbindEvents() {
        if (this.keyHandler) {
            window.removeEventListener('keydown', this.keyHandler);
        }
    }

    navigate(slideId, broadcast = true, instant = false) {
        if (!this.project) return;
        
        const slide = this.project.slides.find(s => s.id === slideId);
        if (!slide) return;

        this.currentSlideId = slideId;
        
        // Clear active timer intervals
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }

        // Deep copy slide to keep track of temporary runtime states (e.g. visibility modifications)
        this.activeRuntimeSlide = JSON.parse(JSON.stringify(slide));

        // Restore session markup state
        if (this.sessionMarkups) {
            this.activeRuntimeSlide.elements.forEach(elem => {
                if (this.sessionMarkups.has(elem.id)) {
                    elem.markupActive = this.sessionMarkups.get(elem.id);
                }
            });
        }

        // Render Slide with transition
        const transition = instant ? 'none' : (slide.transition || 'none');
        this.canvas.animateSlideTransition(this.activeRuntimeSlide, transition);
        this.updateHUD();

        // Start Timers
        this.startTimers();

        // Broadcast to projector screen
        if (broadcast) {
            this.syncChannel.postMessage({ type: 'navigate', slideId: slideId });
        }
    }

    nextSlide() {
        const slides = this.project.slides;
        const currentIdx = slides.findIndex(s => s.id === this.currentSlideId);
        if (currentIdx < slides.length - 1) {
            this.navigate(slides[currentIdx + 1].id, true);
        }
    }

    prevSlide() {
        const slides = this.project.slides;
        const currentIdx = slides.findIndex(s => s.id === this.currentSlideId);
        if (currentIdx > 0) {
            this.navigate(slides[currentIdx - 1].id, true);
        }
    }

    resetCurrentSlide(broadcast = true) {
        if (this.activeRuntimeSlide && this.sessionMarkups) {
            this.activeRuntimeSlide.elements.forEach(elem => {
                this.sessionMarkups.delete(elem.id);
            });
        }
        this.navigate(this.currentSlideId, broadcast, true);
        if (broadcast) {
            this.syncChannel.postMessage({ type: 'reset-slide' });
        }
    }

    exit() {
        this.unbindEvents();
        
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }
        
        if (this.sessionMarkups) {
            this.sessionMarkups.clear();
        }
        
        const overlay = document.getElementById('presentation-overlay');
        overlay.classList.remove('active');
        
        // Clear application viewer references
        if (this.canvas) {
            this.canvas.app.destroy(true, { children: true, texture: true, baseTexture: true });
            this.canvas = null;
        }
    }

    toggleFullscreen() {
        const target = this.isProjectorWindow 
            ? document.documentElement 
            : document.getElementById('presentation-overlay');
            
        if (!document.fullscreenElement) {
            target.requestFullscreen().catch(err => {
                console.error(`Error enabling fullscreen: ${err.message}`);
            });
        } else {
            document.exitFullscreen();
        }
    }

    broadcastSync() {
        if (!this.project) return;
        this.syncChannel.postMessage({
            type: 'sync-project',
            project: this.project,
            activeSlideId: this.currentSlideId
        });
    }

    // ==========================================
    // INTERACTION RUNTIME EVENT HANDLING
    // ==========================================
    
    handleElementInteraction(elem, container) {
        if (elem.type && elem.type.startsWith('btn-') && elem.useMarkupColor) {
            elem.markupActive = !elem.markupActive;
            if (this.sessionMarkups) {
                this.sessionMarkups.set(elem.id, elem.markupActive);
            }
            const graphics = container.children[0];
            const isRpg = elem.rpgStyle || this.activeRuntimeSlide.rpgTheme;
            this.canvas.drawStyledBox(graphics, elem, isRpg);
            
            // Broadcast the markup-toggle sync event
            this.syncChannel.postMessage({
                type: 'trigger-element',
                elementId: elem.id,
                actionData: { type: 'markup-toggle', markupActive: elem.markupActive }
            });
        }

        if (elem.type === 'btn-nav') {
            this.navigate(elem.targetSlideId, true);
            
        } else if (elem.type === 'btn-option') {
            // Check correctness
            const graphics = container.children[0];
            const isRpg = elem.rpgStyle || this.activeRuntimeSlide.rpgTheme;
            
            graphics.clear();
            if (elem.useMarkupColor && elem.markupActive) {
                this.canvas.drawStyledBox(graphics, elem, isRpg);
            } else {
                if (elem.isCorrect) {
                    // Glow green
                    graphics.beginFill(0x10b981);
                    if (isRpg) {
                        graphics.lineStyle(4, 0xffffff, 1);
                        graphics.drawRect(2, 2, elem.width - 4, elem.height - 4);
                    } else {
                        graphics.drawRoundedRect(0, 0, elem.width, elem.height, elem.borderRadius || 8);
                    }
                    graphics.endFill();
                } else {
                    // Glow red
                    graphics.beginFill(0xef4444);
                    if (isRpg) {
                        graphics.lineStyle(4, 0xffffff, 1);
                        graphics.drawRect(2, 2, elem.width - 4, elem.height - 4);
                    } else {
                        graphics.drawRoundedRect(0, 0, elem.width, elem.height, elem.borderRadius || 8);
                    }
                    graphics.endFill();
                }
            }
            
            // Broadcast interaction so the other screen highlights it
            this.syncChannel.postMessage({
                type: 'trigger-element',
                elementId: elem.id,
                actionData: { 
                    type: 'option-click', 
                    isCorrect: elem.isCorrect,
                    useMarkupColor: elem.useMarkupColor,
                    markupActive: elem.markupActive
                }
            });
            
        } else if (elem.type === 'btn-show-ans') {
            // Reveal secret element
            const targetId = elem.targetElementId;
            this.animateElementVisibility(targetId, true);
            
            this.syncChannel.postMessage({
                type: 'trigger-element',
                elementId: elem.id,
                actionData: { type: 'show-ans', targetId: targetId }
            });
            
        } else if (elem.type === 'btn-toggle') {
            // Toggle visibility of target element
            const targetId = elem.targetElementId;
            const targetContainer = this.canvas.pixiElements.get(targetId);
            
            if (targetContainer) {
                let show = true;
                if (elem.action === 'toggle') {
                    show = !targetContainer.visible;
                } else if (elem.action === 'appear') {
                    show = true;
                } else if (elem.action === 'disappear') {
                    show = false;
                }
                
                this.animateElementVisibility(targetId, show);
                
                this.syncChannel.postMessage({
                    type: 'trigger-element',
                    elementId: elem.id,
                    actionData: { type: 'toggle', targetId: targetId, show: show }
                });
            }
        }
    }

    // Sync commands triggered from editor/primary monitor onto projector screen
    syncTriggerElement(elementId, actionData) {
        const container = this.canvas.pixiElements.get(elementId);
        
        if (actionData.type === 'option-click') {
            if (!container) return;
            const graphics = container.children[0];
            const elem = this.activeRuntimeSlide.elements.find(e => e.id === elementId);
            const isRpg = elem.rpgStyle || this.activeRuntimeSlide.rpgTheme;
            
            graphics.clear();
            if (actionData.useMarkupColor && actionData.markupActive) {
                if (elem) {
                    elem.markupActive = actionData.markupActive;
                }
                if (this.sessionMarkups) {
                    this.sessionMarkups.set(elementId, actionData.markupActive);
                }
                this.canvas.drawStyledBox(graphics, elem, isRpg);
            } else {
                if (elem) {
                    elem.markupActive = false;
                }
                if (this.sessionMarkups) {
                    this.sessionMarkups.delete(elementId);
                }
                graphics.beginFill(actionData.isCorrect ? 0x10b981 : 0xef4444);
                if (isRpg) {
                    graphics.lineStyle(4, 0xffffff, 1);
                    graphics.drawRect(2, 2, elem.width - 4, elem.height - 4);
                } else {
                    graphics.drawRoundedRect(0, 0, elem.width, elem.height, elem.borderRadius || 8);
                }
                graphics.endFill();
            }
            
        } else if (actionData.type === 'markup-toggle') {
            const elem = this.activeRuntimeSlide.elements.find(e => e.id === elementId);
            if (elem) {
                elem.markupActive = actionData.markupActive;
                if (this.sessionMarkups) {
                    this.sessionMarkups.set(elementId, actionData.markupActive);
                }
                if (container) {
                    const graphics = container.children[0];
                    const isRpg = elem.rpgStyle || this.activeRuntimeSlide.rpgTheme;
                    this.canvas.drawStyledBox(graphics, elem, isRpg);
                }
            }
            
        } else if (actionData.type === 'show-ans') {
            this.animateElementVisibility(actionData.targetId, true);
            
        } else if (actionData.type === 'toggle') {
            this.animateElementVisibility(actionData.targetId, actionData.show);
        }
    }

    // Smooth visibility adjustments
    animateElementVisibility(elementId, show) {
        const targetContainer = this.canvas.pixiElements.get(elementId);
        if (!targetContainer) return;
        
        // Find corresponding runtime element state to prevent rendering issues on slide redraw
        const elemState = this.activeRuntimeSlide.elements.find(e => e.id === elementId);
        if (elemState) {
            elemState.visible = show;
        }

        if (show) {
            targetContainer.visible = true;
            targetContainer.alpha = 0;
            
            // WebGL fade loop
            const fadeTick = () => {
                targetContainer.alpha += 0.1;
                if (targetContainer.alpha < 1) {
                    requestAnimationFrame(fadeTick);
                } else {
                    targetContainer.alpha = 1;
                }
            };
            fadeTick();
        } else {
            // Fade out
            const fadeTick = () => {
                targetContainer.alpha -= 0.1;
                if (targetContainer.alpha > 0) {
                    requestAnimationFrame(fadeTick);
                } else {
                    targetContainer.alpha = 0;
                    targetContainer.visible = false;
                }
            };
            fadeTick();
        }
    }

    // ==========================================
    // SLIDE TIMERS SCHEDULER
    // ==========================================
    
    startTimers() {
        const timerElem = this.activeRuntimeSlide.elements.find(e => e.type === 'timer');
        if (!timerElem) return;

        this.timerSeconds = timerElem.duration || 30;
        
        const container = this.canvas.pixiElements.get(timerElem.id);
        if (!container || !container.textNode) return;

        container.textNode.text = String(this.timerSeconds);

        this.timerInterval = setInterval(() => {
            this.timerSeconds--;
            
            if (container.textNode) {
                container.textNode.text = String(this.timerSeconds);
            }

            // Flashing warning when seconds <= 5
            if (this.timerSeconds <= 5 && this.timerSeconds > 0) {
                const textNode = container.textNode;
                textNode.style.fill = '#ef4444'; // turn red
                
                // Add a small scale shake
                container.scale.set(1.1);
                setTimeout(() => container.scale.set(1.0), 100);
            }

            if (this.timerSeconds <= 0) {
                clearInterval(this.timerInterval);
                this.timerInterval = null;
                this.handleTimerTimeout(timerElem);
            }
        }, 1000);
    }

    handleTimerTimeout(timerElem) {
        if (timerElem.action === 'show-answer') {
            // Find Show Answer button or reveal all correct answers
            const optButtons = this.activeRuntimeSlide.elements.filter(e => e.type === 'btn-option');
            optButtons.forEach(opt => {
                const optContainer = this.canvas.pixiElements.get(opt.id);
                if (optContainer) {
                    this.handleElementInteraction(opt, optContainer);
                }
            });
            
            // Also search for any general Show Answer target elements
            const showAnsBtn = this.activeRuntimeSlide.elements.find(e => e.type === 'btn-show-ans');
            if (showAnsBtn) {
                this.animateElementVisibility(showAnsBtn.targetElementId, true);
            }
            
        } else if (timerElem.action === 'next-slide') {
            this.nextSlide();
        }
    }
}

// Instantiate and bind
window.PlayerController = new PlayerController();

// Listen to request sync (projector secondary screen requesting state)
const syncChannel = new BroadcastChannel('slide_engine_sync');
syncChannel.onmessage = (event) => {
    if (event.data && event.data.type === 'request-sync') {
        if (window.EngineState && !window.PlayerController.isProjectorWindow) {
            window.PlayerController.broadcastSync();
        }
    }
};
