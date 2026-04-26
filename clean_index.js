const fs = require('fs');
let c = fs.readFileSync('index.html', 'utf8');

// Supprimer le Follow People
c = c.replace(/<!-- Follow People -->[\s\S]*?<!-- Feeds -->/, '<!-- Feeds -->');

// Supprimer le What's happening
c = c.replace(/<div class="bg-white rounded-4 overflow-hidden shadow-sm mb-4">\s*<h6 class="fw-bold text-body p-3 mb-0 border-bottom">What's happening<\/h6>[\s\S]*?<\/div>\s*<\/div>/, '<div class="bg-white rounded-4 overflow-hidden shadow-sm mb-4"><h6 class="fw-bold text-body p-3 mb-0 border-bottom">Infos UNI-VOTE</h6><div class="p-3 text-muted small">Plateforme de vote sécurisée. Les statistiques en direct arrivent bientôt.</div></div></div>');

// Mettre à jour la sidebar gauche statique
c = c.replace(/<ul class="navbar-nav justify-content-end flex-grow-1">[\s\S]*?<\/ul>/g, `<ul class="navbar-nav justify-content-end flex-grow-1" id="dynamicSidebarNav">
   <li class="nav-item"><a href="index.html" class="nav-link active"><span class="material-icons me-3">house</span> <span>Accueil</span></a></li>
   <li class="nav-item"><a href="explorer.html" class="nav-link"><span class="material-icons me-3">explore</span> <span>Explorer</span></a></li>
   <li class="nav-item"><a href="resultats.html" class="nav-link"><span class="material-icons me-3">bar_chart</span> <span>Résultats (Live)</span></a></li>
</ul>`);

// Gérer le bouton Sign In
c = c.replace(/<a href="#" class="btn btn-primary w-100 text-decoration-none rounded-4 py-3 fw-bold text-uppercase m-0" data-bs-toggle="modal" data-bs-target="#signModal">Sign In \+<\/a>/g, `<a href="login.html" class="btn btn-primary w-100 text-decoration-none rounded-4 py-3 fw-bold text-uppercase m-0 auth-button">Connexion / Inscription</a>`);

fs.writeFileSync('index.html', c);
console.log("Done");
