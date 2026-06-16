/**
 * SlideEngine Landing Page WebGL Background Visuals
 * Overhauled to a Cyberpunk 2077 Netrunner HUD grid with Hex/Binary data stream rain,
 * glitching cyber-crosses/squares, and an interactive mouse targeting reticle.
 */

(function () {
    class LandingWebGLBackground {
        constructor() {
            this.canvas = document.getElementById('landing-bg-canvas');
            if (!this.canvas) return;

            this.app = null;
            this.graphics = null;
            this.textContainer = null;
            this.particles = [];
            this.numParticles = 65;
            this.connectionDistance = 125;
            this.cursor = { x: 0, y: 0, active: false, rx: 0, ry: 0 };
            this.dataStreams = [];
            this.wasLightTheme = null;
            
            this.init();
        }

        init() {
            try {
                // Initialize PixiJS Application
                this.app = new PIXI.Application({
                    view: this.canvas,
                    resizeTo: window,
                    backgroundAlpha: 0, // Transparent overlaying background CSS gradient
                    antialias: true,
                    resolution: window.devicePixelRatio || 1,
                    autoDensity: true
                });

                // Create a single Graphics object for bulk vector drawings
                this.graphics = new PIXI.Graphics();
                this.app.stage.addChild(this.graphics);

                // Create container for data matrix texts
                this.textContainer = new PIXI.Container();
                this.app.stage.addChild(this.textContainer);

                // Initialize Cyber Particles
                this.generateParticles();

                // Initialize Hex/Binary streams
                this.generateDataStreams();

                // Start Ticker Loop
                this.app.ticker.add(this.update.bind(this));

                // Bind Events
                this.bindEvents();
            } catch (e) {
                console.error("Failed to initialize Cyberpunk WebGL background: ", e);
            }
        }

        generateParticles() {
            this.particles = [];
            const w = window.innerWidth;
            const h = window.innerHeight;
            const isLightTheme = document.body.classList.contains('light-theme');

            for (let i = 0; i < this.numParticles; i++) {
                const color = isLightTheme
                    ? (Math.random() > 0.65 ? 0x198754 : (Math.random() > 0.5 ? 0x20c997 : 0x0f5132))
                    : (Math.random() > 0.65 ? 0xfcee0a : (Math.random() > 0.5 ? 0x00f0ff : 0xff0055));
                this.particles.push({
                    x: Math.random() * w,
                    y: Math.random() * h,
                    vx: (Math.random() - 0.5) * 0.4,
                    vy: (Math.random() - 0.5) * 0.4,
                    radius: Math.random() * 4.5 + 3.5,
                    alpha: Math.random() * 0.45 + 0.45,
                    color: color,
                    shape: Math.random() > 0.5 ? 'cross' : 'square',
                    glitched: false
                });
            }
        }

        generateDataStreams() {
            this.textContainer.removeChildren();
            this.dataStreams = [];

            const w = window.innerWidth;
            const h = window.innerHeight;
            const numStreams = Math.floor(w / 140); // Spawn one column every 140px
            const isLightTheme = document.body.classList.contains('light-theme');

            for (let i = 0; i < numStreams; i++) {
                const size = Math.random() * 5 + 13; // Cyber font size
                const fill = isLightTheme
                    ? (Math.random() > 0.65 ? 0x198754 : (Math.random() > 0.5 ? 0x20c997 : 0x0f5132))
                    : (Math.random() > 0.65 ? 0xfcee0a : (Math.random() > 0.5 ? 0x00f0ff : 0xff0055));
                const fontFamily = isLightTheme ? 'Inter' : 'Rajdhani';
                const textObj = new PIXI.Text('', new PIXI.TextStyle({
                    fontFamily: fontFamily,
                    fontSize: size,
                    fontWeight: '600',
                    fill: fill,
                    align: 'center',
                    letterSpacing: 1
                }));
                this.textContainer.addChild(textObj);

                this.dataStreams.push({
                    textObj: textObj,
                    x: Math.random() * w,
                    y: Math.random() * -h - 100,
                    speed: Math.random() * 1.8 + 0.8,
                    chars: [],
                    updateTimer: 0
                });
            }
        }

        bindEvents() {
            window.addEventListener('mousemove', (e) => {
                this.cursor.x = e.clientX;
                this.cursor.y = e.clientY;
                if (!this.cursor.active) {
                    this.cursor.active = true;
                    this.cursor.rx = e.clientX;
                    this.cursor.ry = e.clientY;
                }
            });

            window.addEventListener('mouseleave', () => {
                this.cursor.active = false;
            });

            window.addEventListener('resize', () => {
                this.graphics.clear();
                const w = window.innerWidth;
                const h = window.innerHeight;
                this.dataStreams.forEach(s => {
                    s.x = Math.random() * w;
                });
            });
        }

        update(delta) {
            const w = this.app.screen.width;
            const h = this.app.screen.height;
            const isLightTheme = document.body.classList.contains('light-theme');

            // Handle transition changes in real-time
            if (this.wasLightTheme !== isLightTheme) {
                this.wasLightTheme = isLightTheme;
                this.particles.forEach(p => {
                    if (isLightTheme) {
                        p.color = Math.random() > 0.65 ? 0x198754 : (Math.random() > 0.5 ? 0x20c997 : 0x0f5132);
                    } else {
                        p.color = Math.random() > 0.65 ? 0xfcee0a : (Math.random() > 0.5 ? 0x00f0ff : 0xff0055);
                    }
                });
                this.dataStreams.forEach(s => {
                    if (isLightTheme) {
                        s.textObj.style.fill = Math.random() > 0.65 ? 0x198754 : (Math.random() > 0.5 ? 0x20c997 : 0x0f5132);
                        s.textObj.style.fontFamily = 'Inter';
                    } else {
                        s.textObj.style.fill = Math.random() > 0.65 ? 0xfcee0a : (Math.random() > 0.5 ? 0x00f0ff : 0xff0055);
                        s.textObj.style.fontFamily = 'Rajdhani';
                    }
                    s.textObj.style.fontSize = Math.random() * 5 + 13;
                });
            }

            // Clear vector drawings
            this.graphics.clear();

            // 1. Draw High-Tech Grid Lines
            const gridSize = 90;
            const gridColor = isLightTheme ? 0x198754 : 0x00f0ff;
            const gridAlpha = isLightTheme ? 0.04 : 0.08;
            this.graphics.lineStyle(1, gridColor, gridAlpha);

            for (let x = 0; x < w; x += gridSize) {
                this.graphics.moveTo(x, 0);
                this.graphics.lineTo(x, h);
            }
            for (let y = 0; y < h; y += gridSize) {
                this.graphics.moveTo(0, y);
                this.graphics.lineTo(w, y);
            }

            // 2. Position updates & Mouse attraction pull
            this.particles.forEach(p => {
                p.x += p.vx * delta;
                p.y += p.vy * delta;

                // Screen boundaries wrapping
                if (p.x < -10) p.x = w + 10;
                if (p.x > w + 10) p.x = -10;
                if (p.y < -10) p.y = h + 10;
                if (p.y > h + 10) p.y = -10;

                // Mouse proximity soft gravity
                if (this.cursor.active) {
                    const dx = this.cursor.x - p.x;
                    const dy = this.cursor.y - p.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < 220) {
                        const force = (220 - dist) / 220 * 0.035;
                        p.vx += (dx / dist) * force;
                        p.vy += (dy / dist) * force;

                        // Clamp velocity
                        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
                        if (speed > 1.4) {
                            p.vx = (p.vx / speed) * 1.4;
                            p.vy = (p.vy / speed) * 1.4;
                        }
                    }
                }

                // Cyber flicker trigger (disabled in light theme for clean feeling)
                if (!isLightTheme && Math.random() < 0.008) {
                    p.glitched = !p.glitched;
                }
            });

            // 3. Draw connections between nodes
            for (let i = 0; i < this.particles.length; i++) {
                for (let j = i + 1; j < this.particles.length; j++) {
                    const pi = this.particles[i];
                    const pj = this.particles[j];

                    const dx = pi.x - pj.x;
                    const dy = pi.y - pj.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < this.connectionDistance) {
                        const alpha = (1 - (dist / this.connectionDistance)) * 0.38;
                        const connColor = isLightTheme ? 0x198754 : 0x00f0ff;
                        const connAlpha = isLightTheme ? alpha * 0.45 : alpha;
                        this.graphics.lineStyle(1.0, connColor, connAlpha);
                        this.graphics.moveTo(pi.x, pi.y);
                        this.graphics.lineTo(pj.x, pj.y);
                    }
                }
            }

            // 4. Draw Particles as Cyber HUD crosses and boxes
            this.particles.forEach(p => {
                const size = p.radius * ((!isLightTheme && p.glitched) ? (Math.random() * 1.6 + 1.2) : 1.0);
                const alpha = p.alpha * ((!isLightTheme && p.glitched) ? 0.45 : 1.0);
                
                this.graphics.lineStyle(1.2, p.color, alpha);
                if (p.shape === 'cross') {
                    // Draw Cross (+)
                    this.graphics.moveTo(p.x - size, p.y);
                    this.graphics.lineTo(p.x + size, p.y);
                    this.graphics.moveTo(p.x, p.y - size);
                    this.graphics.lineTo(p.x, p.y + size);
                } else {
                    // Draw Square Box
                    this.graphics.drawRect(p.x - size / 2, p.y - size / 2, size, size);
                }
            });

            // 5. Update and render Hex/Binary code rain streams
            this.dataStreams.forEach(s => {
                s.y += s.speed * delta;
                s.updateTimer += delta;

                // Dynamically update contents to simulate cyber glitching data
                if (s.updateTimer > 20 || s.chars.length === 0) {
                    s.updateTimer = 0;
                    const len = Math.floor(Math.random() * 7) + 4;
                    s.chars = [];
                    for (let c = 0; c < len; c++) {
                        const hex = Math.random() > 0.4
                            ? Math.floor(Math.random() * 256).toString(16).toUpperCase().padStart(2, '0')
                            : (Math.random() > 0.5 ? '1' : '0');
                        s.chars.push(hex);
                    }
                    s.textObj.text = s.chars.join('\n');
                }

                s.textObj.x = s.x;
                s.textObj.y = s.y;
                // Fade streams out as they travel further down the layout
                s.textObj.alpha = isLightTheme ? 0.55 * (1.0 - (s.y / h)) : 0.95 * (1.0 - (s.y / h));

                if (s.y > h) {
                    s.y = -s.textObj.height - 30;
                    s.x = Math.random() * w;
                    s.speed = Math.random() * 1.8 + 0.8;
                }
            });

            // 6. Draw interactive Mouse HUD Targeting Scanner
            if (this.cursor.active) {
                // Smooth follow reticle
                this.cursor.rx += (this.cursor.x - this.cursor.rx) * 0.18 * delta;
                this.cursor.ry += (this.cursor.y - this.cursor.ry) * 0.18 * delta;

                const rx = this.cursor.rx;
                const ry = this.cursor.ry;

                // Draw radar ring
                const radarColor = isLightTheme ? 0x198754 : 0xfcee0a;
                this.graphics.lineStyle(1.0, radarColor, 0.85);
                this.graphics.drawCircle(rx, ry, 26);
                
                // Draw targeting brackets
                this.graphics.moveTo(rx - 36, ry);
                this.graphics.lineTo(rx - 18, ry);
                this.graphics.moveTo(rx + 18, ry);
                this.graphics.lineTo(rx + 36, ry);
                this.graphics.moveTo(rx, ry - 36);
                this.graphics.lineTo(rx, ry - 18);
                this.graphics.moveTo(rx, ry + 18);
                this.graphics.lineTo(rx, ry + 36);

                // Laser connect to nearest particles
                this.particles.forEach(p => {
                    const dx = rx - p.x;
                    const dy = ry - p.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < 150) {
                        const laserAlpha = (1.0 - (dist / 150)) * 0.65;
                        const laserColor = isLightTheme ? 0x20c997 : 0xff0055;
                        const finalLaserAlpha = isLightTheme ? laserAlpha * 0.4 : laserAlpha;
                        this.graphics.lineStyle(0.8, laserColor, finalLaserAlpha);
                        this.graphics.moveTo(rx, ry);
                        this.graphics.lineTo(p.x, p.y);
                    }
                });
            }
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

    // Register globally on load
    window.addEventListener('load', () => {
        window.landingWebGL = new LandingWebGLBackground();
    });
})();
