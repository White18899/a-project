(function() {
    // Only initialize if we're not on mobile or a touch device
    const isMobile = window.innerWidth <= 768 || 
                     /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                     (window.matchMedia('(pointer: coarse)').matches && window.innerWidth <= 1024);

    if (isMobile) {
        return; // Skip on mobile/touch devices
    }

    // Create cursor elements
    const container = document.createElement('div');
    container.id = 'glass-cursor-container';
    container.className = 'hidden'; // Start hidden until mouse moves
    
    const outer = document.createElement('div');
    outer.className = 'glass-cursor-outer';
    
    const blob = document.createElement('div');
    blob.className = 'glass-cursor-blob';
    
    const inner = document.createElement('div');
    inner.className = 'glass-cursor-inner';
    
    outer.appendChild(blob);
    container.appendChild(outer);
    container.appendChild(inner);
    document.body.appendChild(container);

    let mouseX = 0;
    let mouseY = 0;
    let cursorX = 0;
    let cursorY = 0;
    let isHidden = true;

    // Smooth trailing interpolation factor (lerp)
    const delay = 0.15;

    // Track mouse movement
    window.addEventListener('mousemove', (e) => {
        // If in fullscreen mode, let native cursor show and hide custom cursor
        if (document.fullscreenElement) {
            container.classList.add('hidden');
            document.body.classList.remove('custom-cursor-active');
            isHidden = true;
            return;
        }

        mouseX = e.clientX;
        mouseY = e.clientY;
        
        // Show cursor on first movement
        if (isHidden) {
            isHidden = false;
            container.classList.remove('hidden');
            document.body.classList.add('custom-cursor-active');
        }

        // Determine if target should show default native cursor
        const target = e.target;
        if (target) {
            const computedStyle = window.getComputedStyle(target);
            const cursorType = computedStyle.cursor;
            
            // Check if we need to let native cursor show
            const isResizeOrSpecial = cursorType.includes('resize') || 
                                     cursorType === 'grab' || 
                                     cursorType === 'grabbing' || 
                                     cursorType === 'move' ||
                                     cursorType === 'not-allowed';
            
            if (isResizeOrSpecial) {
                container.classList.add('hidden');
                document.body.classList.remove('custom-cursor-active');
            } else {
                container.classList.remove('hidden');
                document.body.classList.add('custom-cursor-active');
                
                // Toggle text mode for text cursor
                if (cursorType === 'text') {
                    outer.classList.add('text-mode');
                    inner.classList.add('hidden');
                } else {
                    outer.classList.remove('text-mode');
                    inner.classList.remove('hidden');
                }

                // Check for interactive hover (links, buttons, clickable divs, cards, etc.)
                const isInteractive = target.closest('a, button, select, input, textarea, [role="button"], .btn, .slide-card, .btn-icon, .btn-element-add, .tab-btn, .pill-nav-link, .btn-pill-action, .slide-action-btn') || 
                                      cursorType === 'pointer';
                                      
                if (isInteractive) {
                    outer.classList.add('hovered');
                } else {
                    outer.classList.remove('hovered');
                }
            }
        }
    });

    // Handle mouse clicked state
    window.addEventListener('mousedown', () => {
        outer.classList.add('clicking');
    });

    window.addEventListener('mouseup', () => {
        outer.classList.remove('clicking');
    });

    // Handle mouse leaving and entering viewport
    document.addEventListener('mouseleave', () => {
        container.classList.add('hidden');
        isHidden = true;
    });

    document.addEventListener('mouseenter', () => {
        container.classList.remove('hidden');
        isHidden = false;
    });

    // Handle entering/exiting fullscreen to immediately toggle cursor states
    document.addEventListener('fullscreenchange', () => {
        if (document.fullscreenElement) {
            container.classList.add('hidden');
            document.body.classList.remove('custom-cursor-active');
            isHidden = true;
        } else {
            isHidden = true;
        }
    });

    // Animation loop (lerp)
    function animate() {
        // Lerp for outer cursor
        cursorX += (mouseX - cursorX) * delay;
        cursorY += (mouseY - cursorY) * delay;

        // Position outer cursor
        outer.style.transform = `translate3d(${cursorX}px, ${cursorY}px, 0)`;

        // Position inner dot instantly
        inner.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0)`;

        requestAnimationFrame(animate);
    }
    animate();
})();
