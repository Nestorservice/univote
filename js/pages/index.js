/**
 * Logique de la page d'accueil (index.html)
 * - Récupère et affiche la liste des scrutins en cours.
 * - Gère le countdown.
 */

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Initialiser l'état (Pseudo, etc.)
    const pseudo = getPseudo();
    if (!pseudo) {
        // Optionnel: on peut forcer la connexion ou laisser visiter
        console.log("Mode visiteur");
    }

    // 2. Récupérer les événements
    await loadEvents();
});

async function loadEvents() {
    const container = document.getElementById('eventsFeedContainer');
    
    // Skeleton (déjà présent ou injecté en JS)
    container.innerHTML = `
        <div class="skeleton-card skeleton rounded-4 mb-3" style="height: 200px;"></div>
        <div class="skeleton-card skeleton rounded-4 mb-3" style="height: 200px;"></div>
    `;

    try {
        const data = await apiFetch(`/events?status=open`);
        
        if (data.success && data.data && data.data.data) {
            renderEvents(container, data.data.data);
        } else {
            container.innerHTML = `<div class="alert alert-warning text-center rounded-4 shadow-sm border-0">Aucun scrutin en cours.</div>`;
        }
    } catch (error) {
        console.error("Erreur chargement événements:", error);
        container.innerHTML = `
            <div class="alert alert-danger text-center rounded-4 shadow-sm border-0">
                Impossible de charger les scrutins. <br>
                <button class="btn btn-sm btn-outline-danger mt-2 rounded-pill" onclick="loadEvents()">Réessayer</button>
            </div>`;
    }
}

function renderEvents(container, events) {
    if (events.length === 0) {
        container.innerHTML = `<div class="alert alert-info text-center rounded-4 shadow-sm border-0">Aucun scrutin en cours pour le moment.</div>`;
        return;
    }

    let html = '';
    
    events.forEach(event => {
        // Gestion de la bannière (fallback si non définie)
        const bannerUrl = event.banner_url || 'img/default-banner.jpg';
        
        // Structure de la carte (similaire au feed de Vogel)
        html += `
            <div class="bg-white p-3 feed-item rounded-4 mb-4 shadow-sm position-relative overflow-hidden">
                <!-- Header -->
                <div class="d-flex mb-3 align-items-center justify-content-between">
                    <div class="d-flex align-items-center">
                        <div class="feature bg-primary bg-gradient text-white rounded-circle me-3 d-flex align-items-center justify-content-center" style="width: 45px; height: 45px;">
                            <i class="icofont-ui-calendar fs-5"></i>
                        </div>
                        <div>
                            <h6 class="fw-bold mb-0 text-body">${sanitizeHTML(event.title)}</h6>
                            <small class="text-muted d-flex align-items-center">
                                <span class="material-icons md-16 me-1 text-success">campaign</span> 
                                Scrutin Ouvert
                            </small>
                        </div>
                    </div>
                </div>
                
                <!-- Description -->
                <p class="text-muted mb-3">${sanitizeHTML(event.description || '')}</p>
                
                <!-- Bannière de l'événement -->
                <div class="position-relative mb-3">
                    <img src="${sanitizeHTML(bannerUrl)}" class="img-fluid rounded-4 w-100 object-fit-cover" alt="Banner" style="max-height: 250px; background-color: #f8f9fa;">
                    
                    <!-- Countdown Overlay -->
                    <div class="position-absolute bottom-0 start-0 w-100 p-3 bg-dark bg-opacity-75 rounded-bottom-4 d-flex justify-content-between align-items-center text-white">
                        <div>
                            <span class="small fw-light d-block text-white-50">Fin des votes dans :</span>
                            <span class="fw-bold fs-5 countdown-element" data-end="${event.closes_at}">--:--:--</span>
                        </div>
                    </div>
                </div>
                
                <!-- Footer / Action -->
                <div class="d-flex align-items-center justify-content-between mt-3 pt-3 border-top">
                    <div class="text-muted small">
                        <i class="icofont-users me-1"></i> Participants attendus
                    </div>
                    <a href="vote.html?id=${event.id}" class="btn btn-primary rounded-pill px-4 py-2 fw-bold pulse-animation">
                        Voter Maintenant <i class="icofont-arrow-right ms-1"></i>
                    </a>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;

    // Démarrer les countdowns
    startCountdowns();
}

/**
 * Gestion du compte à rebours dynamique
 */
let countdownInterval;

function startCountdowns() {
    if (countdownInterval) clearInterval(countdownInterval);

    const elements = document.querySelectorAll('.countdown-element');
    
    const updateCountdowns = () => {
        const now = new Date().getTime();
        
        elements.forEach(el => {
            const endDateStr = el.getAttribute('data-end');
            if (!endDateStr) return;
            
            const endDate = new Date(endDateStr).getTime();
            const distance = endDate - now;
            
            if (distance < 0) {
                el.innerHTML = "Terminé";
                el.classList.add('text-danger');
                return;
            }
            
            const days = Math.floor(distance / (1000 * 60 * 60 * 24));
            const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((distance % (1000 * 60)) / 1000);
            
            let timeStr = "";
            if (days > 0) timeStr += `${days}j `;
            timeStr += `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            
            el.innerHTML = timeStr;
        });
    };

    updateCountdowns(); // Premier appel immédiat
    countdownInterval = setInterval(updateCountdowns, 1000);
}
