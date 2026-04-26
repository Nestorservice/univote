const fs = require('fs');
const path = require('path');

const replacementHTML = `<div class="d-flex ms-auto align-items-center">
            <!-- Dark mode toggle mobile -->
            <div class="theme-switch-wrapper me-3 mb-0">
                <label class="theme-switch" for="checkbox">
                    <input type="checkbox" id="checkbox">
                    <span class="slider round"></span>
                </label>
            </div>
            <button class="btn btn-primary ln-0 d-flex align-items-center justify-content-center" type="button" data-bs-toggle="offcanvas" data-bs-target="#offcanvasExample" style="width: 40px; height: 40px; padding: 0;">
                <span class="material-icons">menu</span>
            </button>
        </div>`;

const targetHTML = `<div class="dropdown ms-auto">
            <button class="btn btn-light bg-white bg-opacity-75 rounded-circle p-2 border-0 shadow-sm d-flex align-items-center justify-content-center" type="button" data-bs-toggle="dropdown" aria-expanded="false" style="width: 40px; height: 40px;">
                <span class="mdi mdi-dots-vertical text-dark"></span>
            </button>
            <ul class="dropdown-menu dropdown-menu-end border-0 shadow rounded-4 mt-2">
                <li><a class="dropdown-item py-2 d-flex align-items-center" href="#"><span class="mdi mdi-information md-18 me-2 text-muted"></span>À propos</a></li>
                <li><a class="dropdown-item py-2 d-flex align-items-center" href="faq.html"><span class="mdi mdi-help-circle-outline md-18 me-2 text-muted"></span>FAQ</a></li>
            </ul>
        </div>`;

function walkDir(dir, callback) {
    if (!fs.existsSync(dir)) return;
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        if (fs.statSync(dirPath).isDirectory()) {
            if (f !== 'backend' && f !== '.git' && f !== 'node_modules') {
                walkDir(dirPath, callback);
            }
        } else {
            callback(dirPath);
        }
    });
}

walkDir('./', (filePath) => {
    if (filePath.endsWith('.html')) {
        let content = fs.readFileSync(filePath, 'utf8');
        if (content.includes(targetHTML)) {
            content = content.replace(targetHTML, replacementHTML);
            fs.writeFileSync(filePath, content);
            console.log(`Updated ${filePath}`);
        }
        
        // Fix dark mode desktop wrapper
        const darkDesktopTarget = `<!-- Dark mode toggle -->
    <div class="theme-switch-wrapper ms-3">
        <label class="theme-switch" for="checkbox">
            <input type="checkbox" id="checkbox">`;
        const darkDesktopReplacement = `<!-- Dark mode toggle (Desktop) -->
    <div class="theme-switch-wrapper ms-3 d-none d-lg-flex">
        <label class="theme-switch" for="checkbox-desktop">
            <input type="checkbox" id="checkbox-desktop">`;
        
        if (content.includes(darkDesktopTarget)) {
            content = content.replace(darkDesktopTarget, darkDesktopReplacement);
            fs.writeFileSync(filePath, content);
        }
    }
});
console.log("Done");
