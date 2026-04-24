/**
 * UNI-VOTE — Utilitaires Globaux
 * Toutes les fonctions helper utilisées par les pages et components.
 * Exposé comme objet global `Utils` ET comme fonctions globales legacy.
 */

(function () {
    "use strict";

    var PSEUDO_KEY = 'univote_pseudo';

    var Utils = {

        // ── Pseudo / Identité Anonyme ───────────────────────────

        getPseudo: function () {
            return localStorage.getItem(PSEUDO_KEY);
        },

        setPseudo: function (pseudo) {
            if (pseudo && pseudo.trim().length >= 2) {
                localStorage.setItem(PSEUDO_KEY, pseudo.trim());
                return true;
            }
            return false;
        },

        clearPseudo: function () {
            localStorage.removeItem(PSEUDO_KEY);
        },

        /**
         * Ouvre une modale pour demander le pseudo, ou redirige vers pseudo.html.
         * @param {Function} callback — appelé avec le pseudo une fois défini
         */
        showPseudoModal: function (callback) {
            var existing = Utils.getPseudo();
            if (existing) {
                if (typeof callback === 'function') callback(existing);
                return;
            }

            // Essayer de trouver une modale dans le DOM
            var modalEl = document.getElementById('pseudoModal');
            if (modalEl && typeof bootstrap !== 'undefined') {
                var modal = new bootstrap.Modal(modalEl);
                window._pendingPseudoAction = callback;
                modal.show();
                return;
            }

            // Fallback: prompt simple
            var pseudo = prompt('Entrez votre pseudo pour continuer :');
            if (pseudo && Utils.setPseudo(pseudo)) {
                if (typeof callback === 'function') callback(pseudo);
            }
        },

        /**
         * Exige un pseudo. Redirige vers pseudo.html si absent.
         */
        requirePseudo: function (callback) {
            var p = Utils.getPseudo();
            if (p) {
                if (typeof callback === 'function') callback(p);
                return true;
            }
            var returnUrl = encodeURIComponent(window.location.href);
            window.location.href = 'pseudo.html?return=' + returnUrl;
            return false;
        },

        // ── Formatage ───────────────────────────────────────────

        formatNumber: function (num) {
            if (num === null || num === undefined || isNaN(num)) return '0';
            return new Intl.NumberFormat('fr-FR').format(num);
        },

        formatFCFA: function (amount) {
            if (isNaN(amount)) return amount;
            var currency = (typeof CONFIG !== 'undefined' && CONFIG.CURRENCY) ? CONFIG.CURRENCY : 'FCFA';
            return new Intl.NumberFormat('fr-FR').format(amount) + ' ' + currency;
        },

        formatDate: function (dateString) {
            if (!dateString) return '';
            try {
                var date = new Date(dateString);
                if (isNaN(date.getTime())) return '';
                return new Intl.DateTimeFormat('fr-FR', {
                    day: '2-digit', month: 'short', year: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                }).format(date);
            } catch (e) {
                return '';
            }
        },

        formatDateShort: function (dateString) {
            if (!dateString) return '';
            try {
                var date = new Date(dateString);
                return new Intl.DateTimeFormat('fr-FR', {
                    day: '2-digit', month: 'short'
                }).format(date);
            } catch (e) {
                return '';
            }
        },

        /**
         * Retourne un texte de countdown lisible à partir d'une date de fin.
         * Ex: "2j 05:32:10" ou "Terminé"
         */
        formatCountdown: function (endDateStr) {
            if (!endDateStr) return 'N/A';
            var now = Date.now();
            var end = new Date(endDateStr).getTime();
            var distance = end - now;

            if (distance <= 0) return 'Terminé';

            var days = Math.floor(distance / (1000 * 60 * 60 * 24));
            var hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            var minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            var seconds = Math.floor((distance % (1000 * 60)) / 1000);

            var str = '';
            if (days > 0) str += days + 'j ';
            str += hours.toString().padStart(2, '0') + ':';
            str += minutes.toString().padStart(2, '0') + ':';
            str += seconds.toString().padStart(2, '0');
            return str;
        },

        // ── Sanitisation XSS ────────────────────────────────────

        sanitizeHTML: function (str) {
            if (typeof str !== 'string') return str;
            var temp = document.createElement('div');
            temp.textContent = str;
            return temp.innerHTML;
        },

        // ── Détection Opérateur Mobile Money (Cameroun) ─────────

        detectOperator: function (phoneNumber) {
            var cleanPhone = String(phoneNumber).replace(/\D/g, '');
            var localPhone = cleanPhone;
            if (localPhone.startsWith('237') && localPhone.length === 12) {
                localPhone = localPhone.substring(3);
            }

            if (/^(67[0-9]|65[0-4]|68[0-9])/.test(localPhone)) {
                return { id: 'mtn', name: 'MTN Mobile Money', color: '#ffcc00', textColor: '#000000' };
            }
            if (/^(69[0-9]|65[5-9])/.test(localPhone)) {
                return { id: 'orange', name: 'Orange Money', color: '#ff6600', textColor: '#ffffff' };
            }
            return { id: 'unknown', name: 'Inconnu', color: '#6c757d', textColor: '#ffffff' };
        },

        // ── Notifications Toast (Bootstrap) ─────────────────────

        showToast: function (message, type) {
            type = type || 'info';
            var container = document.getElementById('toast-container');
            if (!container) {
                container = document.createElement('div');
                container.id = 'toast-container';
                container.className = 'toast-container position-fixed bottom-0 start-50 translate-middle-x p-3';
                container.style.zIndex = '1090';
                document.body.appendChild(container);
            }

            var bgColor = 'bg-primary';
            var icon = 'info';
            if (type === 'success') { bgColor = 'bg-success'; icon = 'check_circle'; }
            else if (type === 'error' || type === 'danger') { bgColor = 'bg-danger'; icon = 'error'; }
            else if (type === 'warning') { bgColor = 'bg-warning text-dark'; icon = 'warning'; }

            var toastId = 'toast-' + Date.now();
            var html = '<div id="' + toastId + '" class="toast align-items-center text-white border-0 ' + bgColor + '" role="alert" aria-live="assertive" aria-atomic="true">' +
                '<div class="d-flex">' +
                '<div class="toast-body d-flex align-items-center fw-bold">' +
                '<span class="material-icons me-2">' + icon + '</span>' +
                Utils.sanitizeHTML(message) +
                '</div>' +
                '<button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>' +
                '</div></div>';

            container.insertAdjacentHTML('beforeend', html);
            var toastElement = document.getElementById(toastId);

            if (typeof bootstrap !== 'undefined' && bootstrap.Toast) {
                var bsToast = new bootstrap.Toast(toastElement, { delay: 4000 });
                bsToast.show();
                toastElement.addEventListener('hidden.bs.toast', function () {
                    toastElement.remove();
                });
            } else {
                // Fallback sans Bootstrap
                toastElement.style.display = 'block';
                setTimeout(function () { toastElement.remove(); }, 4000);
            }
        },

        showSuccess: function (msg) { Utils.showToast(msg, 'success'); },
        showError: function (msg) { Utils.showToast(msg, 'error'); },
        showInfo: function (msg) { Utils.showToast(msg, 'info'); },
        showWarning: function (msg) { Utils.showToast(msg, 'warning'); },

        // ── Boutons UI ──────────────────────────────────────────

        disableButton: function (btn) {
            if (!btn) return;
            btn.disabled = true;
            btn.dataset.originalHtml = btn.innerHTML;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>...';
        },

        enableButton: function (btn) {
            if (!btn) return;
            btn.disabled = false;
            if (btn.dataset.originalHtml) {
                btn.innerHTML = btn.dataset.originalHtml;
            }
        },

        // ── URL Params ──────────────────────────────────────────

        getParam: function (name) {
            return new URLSearchParams(window.location.search).get(name);
        }
    };

    // ── Exposer globalement ──────────────────────────────────────

    window.Utils = Utils;

    // Fonctions legacy (utilisées directement sans préfixe dans certaines pages)
    window.sanitizeHTML = Utils.sanitizeHTML;
    window.formatFCFA = Utils.formatFCFA;
    window.formatDate = Utils.formatDate;
    window.detectOperator = Utils.detectOperator;
    window.showToast = Utils.showToast;
    window.getPseudo = Utils.getPseudo;
    window.setPseudo = Utils.setPseudo;
    window.clearPseudo = Utils.clearPseudo;
    window.requirePseudo = Utils.requirePseudo;

    // Alias pour la détection réseau (utilisé dans payment.js)
    window.detectMobileNetwork = function (phone) {
        var op = Utils.detectOperator(phone);
        return { provider: op.id === 'mtn' ? 'MTN' : op.id === 'orange' ? 'Orange' : 'Unknown' };
    };

})();