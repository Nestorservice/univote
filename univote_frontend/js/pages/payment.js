/**
 * UNI-VOTE — Page de paiement (payment.html)
 * - Vérifie le pseudo
 * - Récupère event_id & candidate_id depuis l'URL
 * - Charge les détails du candidat et de l'événement
 * - Détection réseau mobile (MTN / Orange)
 * - Initie le paiement via API.initiateVote
 * - Polling du statut de transaction
 *
 * Dépend de: config.js, utils.js, api.js, auth.js
 */

document.addEventListener('DOMContentLoaded', function () {
    // 1. Vérifier le pseudo
    var pseudo = Utils.getPseudo();
    if (!pseudo) {
        window.location.href = 'pseudo.html?return=' + encodeURIComponent(window.location.href);
        return;
    }

    // 2. Récupérer les infos depuis l'URL
    var eventId = Utils.getParam('event_id');
    var candidateId = Utils.getParam('candidate_id');

    if (!eventId || !candidateId) {
        Utils.showError('Paramètres manquants pour le vote.');
        setTimeout(function () { window.location.href = 'events.html'; }, 2000);
        return;
    }

    // 3. Charger les détails
    loadPaymentDetails(eventId, candidateId);

    // 4. Configurer les écouteurs
    setupFormListeners(eventId, candidateId, pseudo);
});

function loadPaymentDetails(eventId, candidateId) {
    // Charger l'événement pour avoir le prix
    API.getEvent(eventId).then(function (event) {
        var priceEl = document.getElementById('votePrice');
        if (priceEl) priceEl.textContent = event.type === 'free' ? 'Gratuit' : event.price_per_vote;

        // Chercher le candidat dans les candidats de l'event
        var candidate = null;
        if (event.candidates) {
            for (var i = 0; i < event.candidates.length; i++) {
                if (event.candidates[i].id === candidateId) {
                    candidate = event.candidates[i];
                    break;
                }
            }
        }

        // Si on a trouvé le candidat, afficher ses infos
        if (candidate) {
            var nameEl = document.getElementById('candidateName');
            var photoEl = document.getElementById('candidatePhoto');
            if (nameEl) nameEl.textContent = candidate.name;
            if (photoEl) photoEl.src = candidate.photo_url || 'img/default-avatar.png';
        }

        // Masquer le skeleton et afficher les détails
        var skeleton = document.getElementById('paymentSkeleton');
        var details = document.getElementById('candidateDetails');
        if (skeleton) skeleton.classList.add('d-none');
        if (details) details.classList.remove('d-none');

    }).catch(function (error) {
        Utils.showError('Erreur chargement: ' + error.message);
    });
}

function setupFormListeners(eventId, candidateId, pseudo) {
    var phoneInput = document.getElementById('phoneNumber');
    var networkLabel = document.getElementById('networkLabel');
    var networkContainer = document.getElementById('networkContainer');
    var btnSubmit = document.getElementById('btnSubmitPayment');
    var form = document.getElementById('paymentForm');

    // Détection en temps réel du réseau
    phoneInput.addEventListener('input', function (e) {
        e.target.value = e.target.value.replace(/[^0-9]/g, '');

        var phone = e.target.value;
        if (phone.length >= 2) {
            var op = Utils.detectOperator(phone);

            if (op.id === 'mtn') {
                networkLabel.innerHTML = '<span class="text-dark fw-bold"><i class="icofont-ui-cell-phone"></i> MTN Mobile Money</span>';
                networkContainer.className = 'mb-4 text-center p-3 rounded-4 border-0 shadow-sm';
                networkContainer.style.backgroundColor = '#ffcc00';
                btnSubmit.disabled = phone.length !== 9;
            } else if (op.id === 'orange') {
                networkLabel.innerHTML = '<span class="text-white fw-bold"><i class="icofont-ui-cell-phone"></i> Orange Money</span>';
                networkContainer.className = 'mb-4 text-center p-3 rounded-4 border-0 shadow-sm';
                networkContainer.style.backgroundColor = '#ff6600';
                btnSubmit.disabled = phone.length !== 9;
            } else {
                networkLabel.innerHTML = '<span class="text-danger fw-bold">Réseau non supporté</span>';
                networkContainer.className = 'mb-4 text-center p-3 rounded-4 bg-light border border-danger';
                networkContainer.style.backgroundColor = '';
                btnSubmit.disabled = true;
            }
        } else {
            networkLabel.innerHTML = 'En attente de saisie...';
            networkContainer.className = 'mb-4 text-center p-3 rounded-4 bg-light border';
            networkContainer.style.backgroundColor = '';
            btnSubmit.disabled = true;
        }
    });

    // Soumission du formulaire
    form.addEventListener('submit', function (e) {
        e.preventDefault();

        var phone = phoneInput.value;
        if (phone.length !== 9) return;

        // Désactiver le formulaire
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span> Initialisation...';

        API.initiateVote(candidateId, phone, 1).then(function (data) {
            if (data.status === 'success') {
                // Vote gratuit — succès immédiat
                Utils.showSuccess('Vote enregistré avec succès !');
                setTimeout(function () {
                    window.location.href = 'event-detail.html?id=' + eventId;
                }, 2000);
                return;
            }

            // Vote payant — afficher la zone d'attente
            var formParent = form.parentElement;
            if (formParent) formParent.classList.add('d-none');

            var waitZone = document.getElementById('waitingZone');
            if (waitZone) waitZone.classList.remove('d-none');

            // Commencer le polling
            pollPaymentStatus(data.reference || data.idempotency_key, eventId);

        }).catch(function (error) {
            Utils.showError(error.message);
            resetFormState(btnSubmit);
        });
    });
}

function resetFormState(btnSubmit) {
    btnSubmit.disabled = false;
    btnSubmit.innerHTML = 'Confirmer & Payer <i class="icofont-check-circled ms-1"></i>';
}

/**
 * Polling du statut du paiement (vérifie toutes les 3s, max 60s)
 */
function pollPaymentStatus(reference, eventId) {
    if (!reference) {
        // Pas de référence — mode démo
        setTimeout(function () {
            Utils.showSuccess('Vote enregistré !');
            window.location.href = 'event-detail.html?id=' + eventId;
        }, 5000);
        return;
    }

    var maxAttempts = 20;
    var attempts = 0;

    var interval = setInterval(function () {
        attempts++;
        if (attempts > maxAttempts) {
            clearInterval(interval);
            Utils.showWarning('Le paiement a expiré. Veuillez réessayer.');
            setTimeout(function () { window.location.reload(); }, 2000);
            return;
        }

        API.getTransactionStatus(reference).then(function (tx) {
            var status = tx.status;

            if (status === 'success') {
                clearInterval(interval);
                Utils.showSuccess('Paiement réussi ! Votre vote a été pris en compte.');
                setTimeout(function () {
                    window.location.href = 'event-detail.html?id=' + eventId;
                }, 2000);
            } else if (status === 'failed') {
                clearInterval(interval);
                Utils.showError('Paiement échoué.');
                setTimeout(function () { window.location.reload(); }, 2000);
            }
        }).catch(function () {
            // On continue d'essayer
        });
    }, 3000);
}
