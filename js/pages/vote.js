/**
 * UNI-VOTE — Page des candidats (vote.html)
 * - Exige un pseudo (via Utils)
 * - Récupère l'ID du scrutin depuis l'URL
 * - Affiche les détails de l'événement et la liste des candidats
 * - Redirige vers payment.html pour voter
 * 
 * Dépend de: config.js, utils.js, api.js, auth.js
 */

document.addEventListener('DOMContentLoaded', function () {
    // 1. Vérification du pseudo
    var pseudo = Utils.getPseudo();
    if (!pseudo) {
        var currentUrl = encodeURIComponent(window.location.href);
        window.location.href = 'pseudo.html?return=' + currentUrl;
        return;
    }

    // Affichage du pseudo dans la sidebar
    var sidebarPseudo = document.getElementById('sidebarPseudo');
    if (sidebarPseudo) sidebarPseudo.textContent = pseudo;

    // 2. Extraction de l'ID du scrutin
    var eventId = Utils.getParam('id');
    if (!eventId) {
        Utils.showError('Aucun scrutin sélectionné.');
        setTimeout(function () { window.location.href = 'events.html'; }, 2000);
        return;
    }

    // 3. Charger les données
    loadEventDetails(eventId);
});

var currentEvent = null;

function loadEventDetails(eventId) {
    API.getEvent(eventId).then(function (event) {
        currentEvent = event;
        var titleEl = document.getElementById('eventTitle');
        if (titleEl) titleEl.textContent = Utils.sanitizeHTML(event.title);
        startEventCountdown(event.closes_at);
        loadCandidates(eventId, event);
    }).catch(function (error) {
        var titleEl = document.getElementById('eventTitle');
        if (titleEl) titleEl.textContent = 'Erreur de chargement';
        Utils.showError(error.message);
    });
}

function loadCandidates(eventId, event) {
    var container = document.getElementById('candidatesFeedContainer');
    var candidates = event.candidates || [];

    if (candidates.length === 0) {
        container.innerHTML = '<div class="p-4 text-center text-muted">Aucun candidat pour ce scrutin.</div>';
        return;
    }

    renderCandidates(container, candidates, eventId);
}

function renderCandidates(container, candidates, eventId) {
    var html = '';

    candidates.forEach(function (candidate, index) {
        var photoUrl = candidate.photo_url || 'img/default-avatar.png';
        var candidateNumber = candidate.dossard || (index + 1);
        var priceText = currentEvent ? (currentEvent.type === 'free' ? 'Gratuit' : currentEvent.price_per_vote + ' FCFA') : '...';

        html +=
            '<div class="p-3 border-bottom d-flex flex-column flex-sm-row align-items-center text-dark text-decoration-none snap-child position-relative">' +

                '<div class="position-absolute top-0 start-0 bg-primary text-white rounded-bottom-end-4 px-2 py-1 small fw-bold z-1 shadow-sm">' +
                    'N° ' + Utils.sanitizeHTML(String(candidateNumber)) +
                '</div>' +

                '<img src="' + Utils.sanitizeHTML(photoUrl) + '" class="img-fluid rounded-circle me-0 me-sm-4 mb-3 mb-sm-0 shadow-sm border border-2 border-white" alt="Candidat" style="width:100px;height:100px;object-fit:cover;">' +

                '<div class="text-center text-sm-start flex-grow-1 w-100 mb-3 mb-sm-0">' +
                    '<p class="fw-bold fs-5 mb-1 text-primary d-flex align-items-center justify-content-center justify-content-sm-start">' +
                        Utils.sanitizeHTML(candidate.name) +
                        ' <span class="ms-2 material-icons bg-success p-0 md-16 fw-bold text-white rounded-circle ov-icon">verified</span>' +
                    '</p>' +
                    '<div class="text-muted fw-light mb-2">' +
                        '<span class="d-flex align-items-center justify-content-center justify-content-sm-start">' +
                            '<span class="material-icons me-1 small text-secondary">work_outline</span>' +
                            Utils.sanitizeHTML(candidate.bio || 'Candidat') +
                        '</span>' +
                    '</div>' +
                    '<div class="d-flex align-items-center justify-content-center justify-content-sm-start gap-3 small text-muted">' +
                        '<span class="badge bg-primary bg-opacity-10 text-primary">' + Utils.formatNumber(candidate.vote_count || 0) + ' voix</span>' +
                    '</div>' +
                '</div>' +

                '<div class="ms-auto w-100 w-sm-auto text-center mt-2 mt-sm-0">' +
                    '<button onclick="prepareVote(\'' + eventId + '\', \'' + candidate.id + '\', \'' + Utils.sanitizeHTML(candidate.name).replace(/'/g, "\\'") + '\')" class="btn btn-primary rounded-pill px-4 py-2 fw-bold pulse-animation w-100 shadow-sm">' +
                        '<span class="d-flex align-items-center justify-content-center">' +
                            'Voter <span class="material-icons ms-2 md-18">how_to_vote</span>' +
                        '</span>' +
                    '</button>' +
                    '<small class="d-block text-muted mt-1 fw-light">Prix : ' + priceText + '</small>' +
                '</div>' +
            '</div>';
    });

    container.innerHTML = html;
}

var countdownInterval;
function startEventCountdown(endDateStr) {
    if (!endDateStr) return;

    var el = document.getElementById('eventCountdown');
    if (!el) return;
    if (countdownInterval) clearInterval(countdownInterval);

    var updateCountdown = function () {
        var text = Utils.formatCountdown(endDateStr);
        if (text === 'Terminé') {
            el.innerHTML = '<span class="text-danger fw-bold">Scrutin Terminé</span>';
            clearInterval(countdownInterval);
        } else {
            el.innerHTML = '<span class="text-primary fw-bold">Fin dans : ' + text + '</span>';
        }
    };

    updateCountdown();
    countdownInterval = setInterval(updateCountdown, 1000);
}

/**
 * Prépare le vote et redirige vers le flux de paiement
 */
function prepareVote(eventId, candidateId, candidateName) {
    window.location.href = 'payment.html?event_id=' + eventId + '&candidate_id=' + candidateId;
}
