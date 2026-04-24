const fs = require('fs');
let c = fs.readFileSync('index.html', 'utf8');

c = c.replace(/<div class="bg-white rounded-4 overflow-hidden shadow-sm mb-4">[\s\S]*?<h6 class="fw-bold text-body p-3 mb-0 border-bottom">Infos UNI-VOTE<\/h6>[\s\S]*?<\/div>[\s\S]*?<\/div>\s*<\/div>/, '<div class="bg-white rounded-4 overflow-hidden shadow-sm mb-4"><h6 class="fw-bold text-body p-3 mb-0 border-bottom">Infos UNI-VOTE</h6><div class="p-3 text-muted small">Plateforme de vote sécurisée. Les statistiques en direct arrivent bientôt.</div></div>');

// Enlever tout le reste de la side-trend
c = c.replace(/<div class="bg-white rounded-4 overflow-hidden shadow-sm account-follow mb-4">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/aside>/, '</aside>');

fs.writeFileSync('index.html', c);
