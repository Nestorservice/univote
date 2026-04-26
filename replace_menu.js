const fs = require('fs');
const path = require('path');

const targetDir = __dirname;
const files = fs.readdirSync(targetDir).filter(f => f.endsWith('.html'));

const targetHTML = `<button class="ms-auto btn btn-primary ln-0" type="button" data-bs-toggle="offcanvas" data-bs-target="#offcanvasExample">
            <span class="material-icons">menu</span>
        </button>`;

const replacementHTML = `<div class="dropdown ms-auto">
            <button class="btn btn-light bg-white bg-opacity-75 rounded-circle p-2 border-0 shadow-sm d-flex align-items-center justify-content-center" type="button" data-bs-toggle="dropdown" aria-expanded="false" style="width: 40px; height: 40px;">
                <span class="material-icons text-dark">more_vert</span>
            </button>
            <ul class="dropdown-menu dropdown-menu-end border-0 shadow rounded-4 mt-2">
                <li><a class="dropdown-item py-2 d-flex align-items-center" href="#"><span class="material-icons md-18 me-2 text-muted">info</span>À propos</a></li>
                <li><a class="dropdown-item py-2 d-flex align-items-center" href="faq.html"><span class="material-icons md-18 me-2 text-muted">help_outline</span>FAQ</a></li>
            </ul>
        </div>`;

files.forEach(file => {
    const filePath = path.join(targetDir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    if (content.includes(targetHTML)) {
        content = content.replace(targetHTML, replacementHTML);
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('Updated', file);
    }
});
