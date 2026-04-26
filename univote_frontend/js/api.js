/**
 * UNI-VOTE — Client API complet
 * Chaque méthode correspond à une route backend (Go/Gin).
 * Toutes les pages consomment cet objet global `API`.
 */

(function () {
    "use strict";

    // Base URL du backend (fallback si CONFIG n'est pas chargé)
    var BASE = (typeof CONFIG !== 'undefined' && CONFIG.API_BASE)
        ? CONFIG.API_BASE
        : 'http://localhost:8080/api/v1';

    var TIMEOUT = (typeof CONFIG !== 'undefined' && CONFIG.TIMEOUT_MS)
        ? CONFIG.TIMEOUT_MS
        : 10000;

    /**
     * Wrapper fetch générique avec timeout + gestion d'erreurs.
     */
    function request(method, endpoint, body, extraHeaders) {
        var controller = new AbortController();
        var timeoutId = setTimeout(function () { controller.abort(); }, TIMEOUT);

        var opts = {
            method: method,
            signal: controller.signal,
            headers: Object.assign({
                'Accept': 'application/json'
            }, extraHeaders || {})
        };

        // Ne pas mettre Content-Type pour FormData (le navigateur le gère)
        if (body && !(body instanceof FormData)) {
            opts.headers['Content-Type'] = 'application/json';
            opts.body = JSON.stringify(body);
        } else if (body instanceof FormData) {
            opts.body = body;
        }

        var token = localStorage.getItem('admin_token');
        if (token) {
            opts.headers['Authorization'] = 'Bearer ' + token;
        }

        return fetch(BASE + endpoint, opts)
            .then(function (res) {
                clearTimeout(timeoutId);
                return res.json().then(function (json) {
                    if (!res.ok || json.success === false) {
                        throw new Error(json.error || json.message || 'Erreur HTTP ' + res.status);
                    }
                    return json;
                });
            })
            .catch(function (err) {
                clearTimeout(timeoutId);
                if (err.name === 'AbortError') {
                    throw new Error('Délai de réponse dépassé (10s). Vérifiez votre connexion.');
                }
                if (err.message === 'Failed to fetch') {
                    throw new Error('Impossible de contacter le serveur.');
                }
                throw err;
            });
    }

    // ─── API Publique ────────────────────────────────────────────

    var API = {

        // ── Événements ──────────────────────────────────────────

        /**
         * GET /events?status=open|closed&page=X&limit=X
         * Retourne { success, data: { data:[], total, page, limit, total_pages } }
         */
        getEvents: function (status, page, limit) {
            var qs = '?';
            if (status) qs += 'status=' + encodeURIComponent(status) + '&';
            qs += 'page=' + (page || 1) + '&limit=' + (limit || 20);
            return request('GET', '/events' + qs).then(function (json) {
                // Normaliser: les pages attendent { events: [...] }
                var inner = json.data || {};
                return {
                    events: inner.data || [],
                    total: inner.total || 0,
                    page: inner.page || 1,
                    total_pages: inner.total_pages || 1
                };
            });
        },

        /**
         * GET /events/:id  → retourne l'événement avec ses candidats
         */
        getEvent: function (eventId) {
            return request('GET', '/events/' + eventId).then(function (json) {
                return json.data;
            });
        },

        /**
         * GET /events/:id/results  → retourne { event, candidates, total_votes }
         */
        getResults: function (eventId) {
            return request('GET', '/events/' + eventId + '/results').then(function (json) {
                return json.data;
            });
        },

        // ── Candidats ───────────────────────────────────────────

        /**
         * GET /candidates/:id  → retourne le candidat avec son event
         */
        getCandidate: function (candidateId) {
            return request('GET', '/candidates/' + candidateId).then(function (json) {
                return json.data;
            });
        },

        // ── Vote & Paiement ─────────────────────────────────────

        /**
         * POST /vote/initiate
         * Body: { candidate_id, phone, vote_count }
         */
        initiateVote: function (candidateId, phone, voteCount) {
            return request('POST', '/vote/initiate', {
                candidate_id: candidateId,
                phone: phone,
                vote_count: voteCount || 1
            }).then(function (json) {
                return json.data;
            });
        },

        /**
         * GET /transactions/:ref/status
         */
        getTransactionStatus: function (ref) {
            return request('GET', '/transactions/' + ref + '/status').then(function (json) {
                return json.data;
            });
        },

        // ── Vidéos ──────────────────────────────────────────────

        /**
         * GET /events/:id/feed?sort=recent|popular&cursor=X&limit=X
         * Retourne { videos:[], next_cursor, has_more }
         */
        getVideos: function (eventId, sort, cursor, limit) {
            var qs = '?sort=' + (sort || 'recent');
            if (cursor) qs += '&cursor=' + cursor;
            qs += '&limit=' + (limit || 10);
            return request('GET', '/events/' + eventId + '/feed' + qs).then(function (json) {
                var d = json.data || {};
                return {
                    videos: d.videos || [],
                    next_cursor: d.next_cursor,
                    has_more: d.has_more
                };
            });
        },

        /**
         * GET /videos/:id/comments?page=X&limit=X
         */
        getVideoComments: function (videoId, page, limit) {
            var qs = '?page=' + (page || 1) + '&limit=' + (limit || 20);
            return request('GET', '/videos/' + videoId + '/comments' + qs).then(function (json) {
                return { comments: json.data || [] };
            });
        },

        /**
         * POST /videos/:id/like
         * Body: { pseudo }
         */
        likeVideo: function (videoId, pseudo) {
            return request('POST', '/videos/' + videoId + '/like', {
                pseudo: pseudo
            }).then(function (json) {
                return json.data;
            });
        },

        /**
         * POST /videos/:id/comment
         * Body: { pseudo, content }
         */
        commentVideo: function (videoId, pseudo, content) {
            return request('POST', '/videos/' + videoId + '/comment', {
                pseudo: pseudo,
                content: content
            }).then(function (json) {
                return json.data;
            });
        },

        /**
         * POST /upload/request
         * Body: { event_id, candidate_id?, pseudo, title }
         */
        requestUpload: function (eventId, candidateId, pseudo, title, type) {
            var body = {
                event_id: eventId,
                pseudo: pseudo,
                title: title || '',
                type: type || 'video'
            };
            if (candidateId) body.candidate_id = candidateId;
            return request('POST', '/upload/request', body).then(function (json) {
                return json.data;
            });
        },

        /**
         * POST /report
         * Body: { video_id, pseudo, reason }
         */
        reportVideo: function (videoId, pseudo, reason) {
            return request('POST', '/report', {
                video_id: videoId,
                pseudo: pseudo,
                reason: reason
            }).then(function (json) {
                return json.data;
            });
        }
    };

    window.API = API;

})();