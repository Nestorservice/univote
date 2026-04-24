/**
 * Gestion du Pseudo Anonyme (Stockage Local)
 */

const PSEUDO_KEY = 'univote_pseudo';

// Récupérer le pseudo actuel
function getPseudo() {
    return localStorage.getItem(PSEUDO_KEY);
}

// Enregistrer un nouveau pseudo
function setPseudo(pseudo) {
    if (pseudo && pseudo.trim().length > 0) {
        localStorage.setItem(PSEUDO_KEY, pseudo.trim());
        return true;
    }
    return false;
}

// Supprimer le pseudo (logout anonyme)
function clearPseudo() {
    localStorage.removeItem(PSEUDO_KEY);
}

// Exige un pseudo pour exécuter une action. 
// S'il n'y en a pas, ouvre la modal de connexion.
// Si la modal n'existe pas dans le DOM, redirige vers login.html.
function requirePseudo(callback) {
    const currentPseudo = getPseudo();
    if (currentPseudo) {
        if (typeof callback === 'function') callback(currentPseudo);
        return;
    }

    // Pas de pseudo -> On doit le demander
    const modalEl = document.getElementById('pseudoModal');
    if (modalEl) {
        // Modal existe dans la page courante
        const modal = new bootstrap.Modal(modalEl);
        
        // Stocker le callback temporairement
        window._pendingPseudoAction = callback;
        
        modal.show();
    } else {
        // Redirection vers login avec URL de retour
        const returnUrl = encodeURIComponent(window.location.href);
        window.location.href = `login.html?return=${returnUrl}`;
    }
}
