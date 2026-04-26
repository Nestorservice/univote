/*
 * UNI-VOTE — UI System (Toasts, Confirm Modals, Lightbox)
 */
(function() {
    "use strict";

    // ═══ TOAST SYSTEM ═══
    var toastContainer = null;
    var MAX_TOASTS = 3;

    function ensureContainer() {
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.className = 'uv-toast-container';
            document.body.appendChild(toastContainer);
        }
        return toastContainer;
    }

    var icons = { success: 'check_circle', error: 'error', warning: 'warning', info: 'info' };
    var titles = { success: 'Succès', error: 'Erreur', warning: 'Attention', info: 'Info' };

    function showToast(type, message, customTitle) {
        var container = ensureContainer();
        // Limit visible toasts
        while (container.children.length >= MAX_TOASTS) {
            container.removeChild(container.firstChild);
        }

        var toast = document.createElement('div');
        toast.className = 'uv-toast ' + type;
        toast.innerHTML =
            '<div class="toast-icon"><span class="material-icons">' + icons[type] + '</span></div>' +
            '<div class="toast-body">' +
                '<div class="toast-title">' + (customTitle || titles[type]) + '</div>' +
                '<div class="toast-msg">' + message + '</div>' +
            '</div>' +
            '<button class="toast-close" aria-label="Fermer">&times;</button>' +
            '<div class="toast-progress"></div>';

        toast.querySelector('.toast-close').addEventListener('click', function() {
            removeToast(toast);
        });

        container.appendChild(toast);

        // Auto remove after 4s
        setTimeout(function() { removeToast(toast); }, 4200);
    }

    function removeToast(toast) {
        if (!toast || !toast.parentNode) return;
        toast.classList.add('removing');
        setTimeout(function() {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 300);
    }

    // ═══ CONFIRM MODAL ═══
    function showConfirm(title, message, onConfirm, opts) {
        opts = opts || {};
        var delay = opts.delay || 3;

        var overlay = document.createElement('div');
        overlay.className = 'uv-confirm-overlay active';
        overlay.innerHTML =
            '<div class="uv-confirm-box">' +
                '<div class="confirm-icon"><span class="material-icons">warning</span></div>' +
                '<h5>' + title + '</h5>' +
                '<p>' + message + '</p>' +
                '<div class="d-flex gap-3 justify-content-center mt-4">' +
                    '<button class="btn btn-light rounded-pill px-4 confirm-cancel">Annuler</button>' +
                    '<button class="btn btn-danger rounded-pill px-4 confirm-ok" disabled>' +
                        '<span class="confirm-countdown">' + delay + '</span>s — Confirmer' +
                    '</button>' +
                '</div>' +
            '</div>';

        document.body.appendChild(overlay);

        var cancelBtn = overlay.querySelector('.confirm-cancel');
        var okBtn = overlay.querySelector('.confirm-ok');
        var countdownEl = overlay.querySelector('.confirm-countdown');
        var remaining = delay;

        var timer = setInterval(function() {
            remaining--;
            countdownEl.textContent = remaining;
            if (remaining <= 0) {
                clearInterval(timer);
                okBtn.disabled = false;
                okBtn.innerHTML = 'Confirmer';
            }
        }, 1000);

        cancelBtn.addEventListener('click', function() {
            clearInterval(timer);
            overlay.remove();
        });

        okBtn.addEventListener('click', function() {
            overlay.remove();
            if (onConfirm) onConfirm();
        });

        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) {
                clearInterval(timer);
                overlay.remove();
            }
        });
    }

    // ═══ LIGHTBOX ═══
    var lightboxEl = null;
    var lbImages = [];
    var lbIndex = 0;

    function openLightbox(images, startIndex) {
        lbImages = images;
        lbIndex = startIndex || 0;

        if (!lightboxEl) {
            lightboxEl = document.createElement('div');
            lightboxEl.className = 'uv-lightbox';
            lightboxEl.innerHTML =
                '<button class="lb-close"><span class="material-icons">close</span></button>' +
                '<button class="lb-prev"><span class="material-icons">chevron_left</span></button>' +
                '<img src="" alt="gallery">' +
                '<button class="lb-next"><span class="material-icons">chevron_right</span></button>';
            document.body.appendChild(lightboxEl);

            lightboxEl.querySelector('.lb-close').addEventListener('click', closeLightbox);
            lightboxEl.querySelector('.lb-prev').addEventListener('click', function() { navigateLB(-1); });
            lightboxEl.querySelector('.lb-next').addEventListener('click', function() { navigateLB(1); });
            lightboxEl.addEventListener('click', function(e) {
                if (e.target === lightboxEl) closeLightbox();
            });

            // Keyboard
            document.addEventListener('keydown', function(e) {
                if (!lightboxEl || !lightboxEl.classList.contains('active')) return;
                if (e.key === 'Escape') closeLightbox();
                if (e.key === 'ArrowLeft') navigateLB(-1);
                if (e.key === 'ArrowRight') navigateLB(1);
            });

            // Swipe
            var touchStartX = 0;
            lightboxEl.addEventListener('touchstart', function(e) {
                touchStartX = e.touches[0].clientX;
            }, {passive: true});
            lightboxEl.addEventListener('touchend', function(e) {
                var dx = e.changedTouches[0].clientX - touchStartX;
                if (Math.abs(dx) > 50) navigateLB(dx > 0 ? -1 : 1);
            });
        }

        updateLB();
        lightboxEl.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeLightbox() {
        if (lightboxEl) lightboxEl.classList.remove('active');
        document.body.style.overflow = '';
    }

    function navigateLB(dir) {
        lbIndex = (lbIndex + dir + lbImages.length) % lbImages.length;
        updateLB();
    }

    function updateLB() {
        if (!lightboxEl) return;
        lightboxEl.querySelector('img').src = lbImages[lbIndex];
    }

    // ═══ EXPOSE ═══
    window.UVToast = {
        success: function(msg, title) { showToast('success', msg, title); },
        error: function(msg, title) { showToast('error', msg, title); },
        warning: function(msg, title) { showToast('warning', msg, title); },
        info: function(msg, title) { showToast('info', msg, title); }
    };
    window.UVConfirm = showConfirm;
    window.UVLightbox = { open: openLightbox, close: closeLightbox };

})();
