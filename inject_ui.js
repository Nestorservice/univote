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

walkDir('./', (filePath) => {
    if (!filePath.endsWith('.html')) return;
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    // Add ui.js before custom.js or before </body> if not already present
    if (!content.includes('js/ui.js') && content.includes('js/custom.js')) {
        content = content.replace(
            '<script src="js/custom.js"></script>',
            '<script src="js/ui.js"></script>\n    <script src="js/custom.js"></script>'
        );
        modified = true;
    }

    // Add Material Icons font if missing
    if (!content.includes('family=Material+Icons')) {
        content = content.replace('</head>', '    <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">\n</head>');
        modified = true;
    }

    if (modified) {
        fs.writeFileSync(filePath, content);
        console.log('Updated: ' + filePath);
    }
});
console.log('Done');
