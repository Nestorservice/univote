const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
    if (!fs.existsSync(dir)) return;
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        if (fs.statSync(dirPath).isDirectory()) {
            if (f !== 'backend' && f !== '.git' && f !== 'node_modules' && f !== 'vendor') {
                walkDir(dirPath, callback);
            }
        } else {
            callback(dirPath);
        }
    });
}

const fontLink = '<link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">';

walkDir('./', (filePath) => {
    if (filePath.endsWith('.html')) {
        let content = fs.readFileSync(filePath, 'utf8');
        let modified = false;

        // Add font link if missing
        if (!content.includes('family=Material+Icons')) {
            content = content.replace('</head>', `    ${fontLink}\n</head>`);
            modified = true;
        }

        // Remove the static mobile dark mode toggle because we will make it a FAB
        const oldMobileDarkToggle = `<div class="theme-switch-wrapper me-3 mb-0">
                <label class="theme-switch" for="checkbox">
                    <input type="checkbox" id="checkbox">
                    <span class="slider round"></span>
                </label>
            </div>`;
        if (content.includes(oldMobileDarkToggle)) {
            content = content.replace(oldMobileDarkToggle, '');
            modified = true;
        }

        if (modified) {
            fs.writeFileSync(filePath, content);
            console.log(`Updated HTML: ${filePath}`);
        }
    }
});

// Now update CSS for FAB and better countdowns
const cssPath = path.join(__dirname, 'css', 'univote.css');
if (fs.existsSync(cssPath)) {
    let css = fs.readFileSync(cssPath, 'utf8');
    
    const newCss = `
/* Floating Action Button (FAB) for Dark Mode */
#darkModeFab {
    position: fixed;
    bottom: 80px;
    right: 20px;
    width: 50px;
    height: 50px;
    background: #0d6efd;
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 15px rgba(0,0,0,0.2);
    z-index: 1060;
    cursor: pointer;
    transition: background 0.3s, transform 0.1s;
    user-select: none;
    touch-action: none;
}
#darkModeFab:active {
    transform: scale(0.9);
}
.dark #darkModeFab {
    background: #343a40;
}

/* Beautiful Countdowns */
.countdown-box {
    display: inline-flex;
    gap: 8px;
    background: rgba(13, 110, 253, 0.1);
    padding: 8px 15px;
    border-radius: 12px;
    border: 1px solid rgba(13, 110, 253, 0.2);
    font-weight: bold;
    color: #0d6efd;
    align-items: center;
}
.dark .countdown-box {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.2);
    color: #fff;
}
.countdown-icon {
    font-size: 18px;
}

/* Mobile Bottom Nav Padding */
@media (max-width: 1199px) {
    body {
        padding-bottom: 70px !important;
    }
}
.bottom-nav-glass {
    background: rgba(255, 255, 255, 0.95) !important;
    backdrop-filter: blur(10px);
    border-top: 1px solid rgba(0,0,0,0.05);
    box-shadow: 0 -2px 10px rgba(0,0,0,0.05);
}
.dark .bottom-nav-glass {
    background: rgba(30, 30, 30, 0.95) !important;
    border-top: 1px solid rgba(255,255,255,0.05);
}
.nav-bottom-item {
    color: #6c757d;
    transition: all 0.3s;
}
.dark .nav-bottom-item {
    color: #adb5bd;
}
.nav-bottom-item.active {
    color: #0d6efd;
    transform: translateY(-2px);
}
.dark .nav-bottom-item.active {
    color: #3d8bfd;
}
`;
    if (!css.includes('darkModeFab')) {
        fs.writeFileSync(cssPath, css + '\n' + newCss);
        console.log("Updated CSS");
    }
}

// Update JS for Draggable FAB logic
const jsPath = path.join(__dirname, 'js', 'custom.js');
if (fs.existsSync(jsPath)) {
    let js = fs.readFileSync(jsPath, 'utf8');
    const fabJs = `
    // Draggable Dark Mode FAB
    jQuery(document).ready(function () {
        if ($('#darkModeFab').length === 0) {
            $('body').append('<div id="darkModeFab"><span class="material-icons" id="fabIcon">brightness_4</span></div>');
        }
        
        var fab = document.getElementById('darkModeFab');
        var icon = document.getElementById('fabIcon');
        
        // Update icon based on theme
        function updateFabIcon() {
            if(icon) {
                icon.textContent = document.documentElement.classList.contains('dark') ? 'brightness_7' : 'brightness_4';
            }
        }
        updateFabIcon();
        
        // Toggle theme on click
        $(fab).on('click', function(e) {
            if ($(this).hasClass('dragging')) return;
            var isDark = document.documentElement.classList.contains('dark');
            if (isDark) {
                document.documentElement.setAttribute('class', 'light');
                localStorage.setItem('theme', 'light');
            } else {
                document.documentElement.setAttribute('class', 'dark');
                localStorage.setItem('theme', 'dark');
            }
            updateFabIcon();
            
            // Sync with desktop toggle if exists
            var deskToggle = document.getElementById('checkbox-desktop');
            if (deskToggle) deskToggle.checked = !isDark;
        });

        // Make it draggable for touch devices
        var isDragging = false;
        var startX, startY, initialX, initialY;
        
        if(fab) {
            fab.addEventListener('touchstart', function(e) {
                var touch = e.touches[0];
                startX = touch.clientX;
                startY = touch.clientY;
                var rect = fab.getBoundingClientRect();
                initialX = rect.left;
                initialY = rect.top;
                isDragging = false;
            }, {passive: true});
            
            fab.addEventListener('touchmove', function(e) {
                var touch = e.touches[0];
                var dx = touch.clientX - startX;
                var dy = touch.clientY - startY;
                if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
                    isDragging = true;
                    $(fab).addClass('dragging');
                    var newX = initialX + dx;
                    var newY = initialY + dy;
                    
                    // Bounds
                    newX = Math.max(0, Math.min(newX, window.innerWidth - fab.offsetWidth));
                    newY = Math.max(0, Math.min(newY, window.innerHeight - fab.offsetHeight));
                    
                    fab.style.left = newX + 'px';
                    fab.style.top = newY + 'px';
                    fab.style.bottom = 'auto';
                    fab.style.right = 'auto';
                    e.preventDefault();
                }
            }, {passive: false});
            
            fab.addEventListener('touchend', function(e) {
                setTimeout(function() { $(fab).removeClass('dragging'); }, 100);
            });
        }
    });
`;
    if (!js.includes('darkModeFab')) {
        fs.writeFileSync(jsPath, js + '\n' + fabJs);
        console.log("Updated JS for FAB");
    }
}
