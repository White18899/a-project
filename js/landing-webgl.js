/**
 * SlideEngine Landing Page WebGL Background Visuals
 * Powered by PixiJS. Renders a hardware-accelerated constellation particle field
 * that responds interactively to mouse positions and handles play/pause ticks.
 */

(function () {
    class LandingWebGLBackground {
        constructor() {
            this.canvas = document.getElementById('landing-bg-canvas');
            if (!this.canvas) return;

            this.app = null;
            this.graphics = null;
            this.particles = [];
            this.numParticles = 75;
            this.connectionDistance = 115;
            this.cursor = { x: 0, y: 0, active: false, rx: 0, ry: 0 };
            
            this.init();
        }

        init() {
            try {
                // Initialize PixiJS Application
                this.app = new PIXI.Application({
                    view: this.canvas,
                    resizeTo: window,
                    backgroundAlpha: 0, // Transparent, overlaying CSS gradient
                    antialias: true,
                    resolution: window.devicePixelRatio || 1,
                    autoDensity: true
                });

                // Create a single Graphics object for bulk drawing (high performance)
                this.graphics = new PIXI.Graphics();
                this.app.stage.addChild(this.graphics);

                // Initialize Particles
                this.generateParticles();

                // Start Ticker Loop
                this.app.ticker.add(this.update.bind(this));

                // Bind User Input Events
                this.bindEvents();
            } catch (e) {
                console.error("Failed to initialize WebGL background: ", e);
            }
        }

        generateParticles() {
            this.particles = [];
            const w = window.innerWidth;
            const h = window.innerHeight;

            for (let i = 0; i < this.numParticles; i++) {
                this.particles.push({
                    x: Math.random() * w,
                    y: Math.random() * h,
                    vx: (Math.random() - 0.5) * 0.45,
                    vy: (Math.random() - 0.5) * 0.45,
                    radius: Math.random() * 2 + 1.25,
                    alpha: Math.random() * 0.45 + 0.15,
                    // Subtle color variance (accent gold, soft white, clean grey)
                    color: Math.random() > 0.6 ? 0xd4af37 : (Math.random() > 0.5 ? 0xffffff : 0x7c2d12)
                });
            }
        }

        bindEvents() {
            window.addEventListener('mousemove', (e) => {
                this.cursor.x = e.clientX;
                this.cursor.y = e.clientY;
                this.cursor.active = true;
            });

            window.addEventListener('mouseleave', () => {
                this.cursor.active = false;
            });

            // Re-generate particles spread if window sizes change significantly
            window.addEventListener('resize', () => {
                this.graphics.clear();
            });
        }

        update(delta) {
            const w = this.app.screen.width;
            const h = this.app.screen.height;

            // Clear buffer
            this.graphics.clear();

            // 1. Position update and boundary checking
            this.particles.forEach(p => {
                p.x += p.vx * delta;
                p.y += p.vy * delta;

                // Screen boundaries bounce
                if (p.x < 0) { p.x = 0; p.vx *= -1; }
                if (p.x > w) { p.x = w; p.vx *= -1; }
                if (p.y < 0) { p.y = 0; p.vy *= -1; }
                if (p.y > h) { p.y = h; p.vy *= -1; }

                // Mouse interaction attraction
                if (this.cursor.active) {
                    const dx = this.cursor.x - p.x;
                    const dy = this.cursor.y - p.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < 180) {
                        // Soft attraction pull
                        const force = (180 - dist) / 180 * 0.04;
                        p.vx += (dx / dist) * force;
                        p.vy += (dy / dist) * force;

                        // Clamp velocity to prevent particles running away
                        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
                        if (speed > 1.2) {
                            p.vx = (p.vx / speed) * 1.2;
                            p.vy = (p.vy / speed) * 1.2;
                        }
                    }
                }
            });

            // 2. Draw connections (lines) between close particles
            for (let i = 0; i < this.particles.length; i++) {
                for (let j = i + 1; j < this.particles.length; j++) {
                    const pi = this.particles[i];
                    const pj = this.particles[j];

                    const dx = pi.x - pj.x;
                    const dy = pi.y - pj.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < this.connectionDistance) {
                        // Opacity fades out with distance
                        const alpha = (1 - (dist / this.connectionDistance)) * 0.18;
                        this.graphics.lineStyle(1.2, 0xd4af37, alpha);
                        this.graphics.moveTo(pi.x, pi.y);
                        this.graphics.lineTo(pj.x, pj.y);
                    }
                }
            }

            // 3. Draw particles
            this.particles.forEach(p => {
                this.graphics.beginFill(p.color, p.alpha);
                this.graphics.drawCircle(p.x, p.y, p.radius);
                this.graphics.endFill();
            });
        }

        play() {
            if (this.app && this.app.ticker) {
                this.app.ticker.start();
            }
        }

        pause() {
            if (this.app && this.app.ticker) {
                this.app.ticker.stop();
            }
        }
    }

    // Initialize globally on load
    window.addEventListener('load', () => {
        window.landingWebGL = new LandingWebGLBackground();
    });
})();
