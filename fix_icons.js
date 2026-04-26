const fs = require('fs');
const path = require('path');

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
        if (content.includes('<!-- Material Icons -->') && !content.includes('family=Material+Icons')) {
            content = content.replace(/<!-- Material Icons -->/g, '<!-- Material Icons -->\n    <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">');
            fs.writeFileSync(filePath, content);
            console.log(`Updated ${filePath}`);
        }
    }
});
console.log("Done");
