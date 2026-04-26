/*
 * UNI-VOTE — Components de rendu
 * Génère le HTML dynamique pour: événements, candidats, vidéos, commentaires, résultats.
 * Dépend de: Utils (utils.js)
 */

(function () {
    "use strict";

    var Components = {

        // ── Événements ──────────────────────────────────────────

        renderEventCard: function (event) {
            var status = event.status || 'draft';
            var statusClass = 'bg-secondary';
            var statusText = 'Brouillon';
            if (status === 'open') { statusClass = 'bg-success'; statusText = 'Ouvert'; }
            else if (status === 'closed') { statusClass = 'bg-secondary'; statusText = 'Terminé'; }
            else if (status === 'draft') { statusClass = 'bg-warning text-dark'; statusText = 'Brouillon'; }

            var priceText = event.type === 'free' ? 'Gratuit' : Utils.formatNumber(event.price_per_vote) + ' FCFA/vote';
            var candidateCount = (event.candidates && event.candidates.length) || 0;
            var bannerUrl = event.banner_url || '';

            // Banner HTML
            var bannerHtml = '';
            if (bannerUrl) {
                bannerHtml =
                    '<div class="event-banner mb-2">' +
                    '<img src="' + Utils.sanitizeHTML(bannerUrl) + '" alt="banner" loading="lazy">' +
                    '<div class="banner-overlay">' +
                        '<h6 class="fw-bold mb-0">' + Utils.sanitizeHTML(event.title) + '</h6>' +
                    '</div>' +
                    '</div>';
            } else {
                bannerHtml =
                    '<div class="event-banner mb-2">' +
                    '<div class="banner-placeholder">' +
                        '<span class="material-icons">how_to_vote</span>' +
                        '<span class="fw-bold">' + Utils.sanitizeHTML(event.title) + '</span>' +
                    '</div>' +
                    '</div>';
            }

            var countdownHtml = '';
            if (status === 'open' && event.closes_at) {
                countdownHtml =
                    '<div class="text-center my-2">' +
                    '<div class="countdown-box shadow-sm">' +
                    '<span class="material-icons" style="font-size:18px">timer</span>' +
                    '<span class="countdown-el" data-end="' + event.closes_at + '">--:--:--</span>' +
                    '</div></div>';
            }

            return '<div class="bg-white p-3 feed-item rounded-4 shadow-sm mb-3 fade-in-up">' +
                '<div class="d-flex align-items-center mb-2">' +
                    '<div class="feature bg-primary bg-gradient text-white rounded-circle me-3 d-flex align-items-center justify-content-center" style="width:45px;height:45px;min-width:45px;">' +
                        '<span class="material-icons">how_to_vote</span>' +
                    '</div>' +
                    '<div class="flex-grow-1">' +
                        '<h6 class="fw-bold mb-0 text-body">' + Utils.sanitizeHTML(event.title) + '</h6>' +
                        '<small class="text-muted">' + Utils.sanitizeHTML(event.description || '').substring(0, 80) + '</small>' +
                    '</div>' +
                    '<span class="badge ' + statusClass + ' ms-2">' + statusText + '</span>' +
                '</div>' +
                bannerHtml +
                countdownHtml +
                '<div class="d-flex align-items-center justify-content-between mt-2">' +
                    '<div class="d-flex align-items-center gap-3 small text-muted">' +
                        '<span><span class="material-icons md-16 me-1 align-middle">payments</span>' + priceText + '</span>' +
                        '<span><span class="material-icons md-16 me-1 align-middle">people</span>' + candidateCount + ' candidats</span>' +
                    '</div>' +
                    (status === 'open'
                        ? '<a href="event-detail.html?id=' + event.id + '" class="btn btn-primary btn-sm rounded-pill px-3 pulse-animation">Voter <span class="material-icons md-16 ms-1">arrow_forward</span></a>'
                        : '<a href="event-detail.html?id=' + event.id + '" class="btn btn-outline-primary btn-sm rounded-pill px-3">Voir</a>'
                    ) +
                '</div>' +
                '</div>';
        },

        // ── Candidats ───────────────────────────────────────────

        renderCandidatesList: function (candidates, totalVotes) {
            if (!candidates || candidates.length === 0) {
                return '<div class="text-center py-4 text-muted"><span class="material-icons mb-2" style="font-size:48px">person_off</span><p>Aucun candidat</p></div>';
            }
            totalVotes = totalVotes || 0;
            if (totalVotes === 0) {
                for (var k = 0; k < candidates.length; k++) totalVotes += (candidates[k].vote_count || 0);
            }
            var maxVotes = 0;
            for (var m = 0; m < candidates.length; m++) {
                if ((candidates[m].vote_count || 0) > maxVotes) maxVotes = candidates[m].vote_count;
            }
            var html = '';
            for (var i = 0; i < candidates.length; i++) {
                html += this.renderCandidateCard(candidates[i], totalVotes, maxVotes, i);
            }
            return html;
        },

        renderCandidateCard: function (candidate, totalVotes, maxVotes, index) {
            var photoUrl = candidate.photo_url || 'img/default-avatar.png';
            var votes = candidate.vote_count || 0;
            var percent = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
            var isLeader = maxVotes > 0 && votes === maxVotes;
            var delay = (index || 0) * 0.1;

            return '<a href="candidate.html?id=' + candidate.id + '" class="text-decoration-none">' +
                '<div class="bg-white p-3 candidate-card rounded-4 shadow-sm mb-3 d-flex align-items-center fade-in-up" style="animation-delay:' + delay + 's">' +
                    (isLeader ? '<div class="badge-leader"><span class="material-icons" style="font-size:12px;vertical-align:middle">star</span> Favori</div>' : '') +
                    '<img src="' + Utils.sanitizeHTML(photoUrl) + '" class="candidate-photo-circle me-3" alt="candidat" loading="lazy">' +
                    '<div class="flex-grow-1">' +
                        '<h6 class="mb-0 fw-bold text-dark">' +
                            '#' + Utils.sanitizeHTML(candidate.dossard || '?') + ' — ' + Utils.sanitizeHTML(candidate.name) +
                        '</h6>' +
                        '<small class="text-muted">' + Utils.sanitizeHTML(candidate.bio || '') + '</small>' +
                        '<div class="mt-1 d-flex align-items-center gap-2">' +
                            '<span class="badge bg-primary bg-opacity-10 text-primary small">' + Utils.formatNumber(votes) + ' voix</span>' +
                            '<span class="small text-muted">(' + percent + '%)</span>' +
                        '</div>' +
                        '<div class="vote-progress"><div class="vote-progress-bar" style="width:' + percent + '%"></div></div>' +
                    '</div>' +
                    '<span class="material-icons text-muted">chevron_right</span>' +
                '</div>' +
                '</a>';
        },

        renderCandidateDetail: function (candidate) {
            var photoUrl = candidate.photo_url || 'img/default-avatar.png';

            var gallery = '';
            if (candidate.gallery && candidate.gallery.length > 0) {
                gallery = '<h6 class="fw-bold mt-4 mb-3">Galerie</h6><div class="gallery-grid mb-3">';
                for (var i = 0; i < candidate.gallery.length; i++) {
                    gallery += '<div class="gallery-item" onclick="UVLightbox.open(' + JSON.stringify(candidate.gallery) + ',' + i + ')">' +
                        '<img src="' + candidate.gallery[i] + '" alt="galerie" loading="lazy">' +
                        '</div>';
                }
                gallery += '</div>';
            }

            var eventInfo = '';
            if (candidate.event) {
                eventInfo = '<a href="event-detail.html?id=' + candidate.event.id + '" class="btn btn-outline-secondary btn-sm rounded-pill mb-3">' +
                    '<span class="material-icons md-16 me-1">event</span>' + Utils.sanitizeHTML(candidate.event.title) +
                    '</a>';
            }

            return '<div class="bg-white rounded-4 shadow-sm p-4 mb-4">' +
                '<div class="text-center mb-4">' +
                    '<img src="' + photoUrl + '" class="img-fluid rounded-circle mb-3 border border-3 border-primary shadow" style="width:120px;height:120px;object-fit:cover;" alt="candidat">' +
                    '<h4 class="mb-1">#' + Utils.sanitizeHTML(candidate.dossard || '?') + ' — ' + Utils.sanitizeHTML(candidate.name) + '</h4>' +
                    '<p class="text-muted mb-2">' + Utils.sanitizeHTML(candidate.bio || '') + '</p>' +
                    '<span class="badge bg-primary rounded-pill px-3 py-2 mb-3">' + Utils.formatNumber(candidate.vote_count || 0) + ' voix</span><br>' +
                    eventInfo +
                '</div>' +
                gallery +
                '<div class="d-grid">' +
                    '<a href="vote.html?id=' + (candidate.event_id || (candidate.event ? candidate.event.id : '')) + '" class="btn btn-primary rounded-5 py-3 fw-bold pulse-animation">' +
                        '<span class="material-icons me-2 align-middle">how_to_vote</span>Voter pour ' + Utils.sanitizeHTML(candidate.name) +
                    '</a>' +
                '</div>' +
                '</div>';
        },

        // ── Vidéos ──────────────────────────────────────────────

        renderVideoCard: function (video, eventId) {
            var thumbnail = video.thumbnail_url || 'img/default-banner.jpg';
            return '<div class="bg-white p-3 feed-item rounded-4 shadow-sm mb-3">' +
                '<div class="d-flex align-items-center mb-2">' +
                    '<span class="material-icons md-36 text-primary me-2">smart_display</span>' +
                    '<div class="flex-grow-1">' +
                        '<h6 class="mb-0">' + Utils.sanitizeHTML(video.title || 'Vidéo') + '</h6>' +
                        '<small class="text-muted">Par ' + Utils.sanitizeHTML(video.uploader_pseudo || video.pseudo || 'Anonyme') + '</small>' +
                    '</div>' +
                '</div>' +
                '<a href="video-player.html?id=' + video.id + '&event=' + eventId + '">' +
                    '<img src="' + thumbnail + '" class="img-fluid rounded mb-2 w-100" style="max-height:300px;object-fit:cover;" alt="video" loading="lazy">' +
                '</a>' +
                '<div class="d-flex align-items-center justify-content-between">' +
                    '<div class="d-flex align-items-center">' +
                        '<button class="btn btn-link text-decoration-none like-btn" data-video="' + video.id + '">' +
                            '<span class="material-icons md-20 me-1">thumb_up_off_alt</span>' + Utils.formatNumber(video.like_count || 0) +
                        '</button>' +
                        '<button class="btn btn-link text-decoration-none comment-btn" data-video="' + video.id + '">' +
                            '<span class="material-icons md-20 me-1">chat_bubble_outline</span>' + Utils.formatNumber(video.comment_count || 0) +
                        '</button>' +
                    '</div>' +
                    '<small class="text-muted">' + Utils.formatDate(video.created_at) + '</small>' +
                '</div></div>';
        },

        renderVideosList: function (videos, eventId) {
            if (!videos || videos.length === 0) {
                return '<div class="text-center py-4 text-muted"><span class="material-icons mb-2" style="font-size:48px">videocam_off</span><p>Aucune vidéo</p></div>';
            }
            var html = '';
            for (var i = 0; i < videos.length; i++) html += this.renderVideoCard(videos[i], eventId);
            return html;
        },

        renderSocialFeedItem: function (video, eventId) {
            var thumbnail = video.thumbnail_url || 'img/default-banner.jpg';
            var videoId = video.id;
            var pseudo = Utils.sanitizeHTML(video.uploader_pseudo || video.pseudo || 'Anonyme');
            var title = Utils.sanitizeHTML(video.title || 'Vidéo');
            var timeAgo = Utils.formatDate(video.created_at);
            var likes = Utils.formatNumber(video.like_count || 0);
            var commentsCount = Utils.formatNumber(video.comment_count || 0);

            return '<div class="bg-white p-3 feed-item rounded-4 mb-3 shadow-sm" id="post-' + videoId + '">' +
                '<div class="d-flex">' +
                    '<div class="bg-primary bg-opacity-10 rounded-circle d-flex align-items-center justify-content-center me-3" style="width:45px;height:45px;min-width:45px;">' +
                        '<span class="material-icons text-primary">person</span>' +
                    '</div>' +
                    '<div class="d-flex flex-column align-items-start w-100">' +
                        '<div class="w-100">' +
                            '<div class="d-flex align-items-center justify-content-between">' +
                                '<div class="d-flex align-items-center">' +
                                    '<h6 class="fw-bold mb-0 text-body">' + pseudo + '</h6>' +
                                    '<span class="ms-2 material-icons bg-primary p-0 md-16 fw-bold text-white rounded-circle ov-icon">done</span>' +
                                '</div>' +
                                '<p class="text-muted mb-0 small">' + timeAgo + '</p>' +
                            '</div>' +
                            '<div class="my-2">' +
                                '<p class="mb-3 text-dark fs-6">' + title + '</p>' +
                                '<a href="video-player.html?id=' + videoId + '&event=' + eventId + '" class="text-decoration-none d-block position-relative">' +
                                    '<img src="' + thumbnail + '" class="img-fluid rounded-4 mb-3 w-100 border shadow-sm" style="max-height:400px;object-fit:cover;" alt="post-media" loading="lazy">' +
                                    '<div class="position-absolute top-50 start-50 translate-middle">' +
                                        '<span class="material-icons text-white bg-dark bg-opacity-50 rounded-circle p-2 shadow" style="font-size: 48px;">play_arrow</span>' +
                                    '</div>' +
                                '</a>' +
                                '<div class="d-flex align-items-center justify-content-between mb-2 px-2">' +
                                    '<button class="btn btn-link p-0 text-muted text-decoration-none d-flex align-items-center social-like-btn" data-video="' + videoId + '">' +
                                        '<span class="material-icons md-20 me-2">thumb_up_off_alt</span><span class="like-count">' + likes + '</span>' +
                                    '</button>' +
                                    '<button class="btn btn-link p-0 text-muted text-decoration-none d-flex align-items-center social-comment-btn" data-video="' + videoId + '">' +
                                        '<span class="material-icons md-20 me-2">chat_bubble_outline</span><span class="comment-count">' + commentsCount + '</span>' +
                                    '</button>' +
                                    '<button class="btn btn-link p-0 text-muted text-decoration-none d-flex align-items-center">' +
                                        '<span class="material-icons md-20 me-2">bookmark_border</span>' +
                                    '</button>' +
                                    '<button class="btn btn-link p-0 text-muted text-decoration-none d-flex align-items-center">' +
                                        '<span class="material-icons md-18 me-2">share</span>' +
                                    '</button>' +
                                '</div>' +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
            '</div>';
        },

        // ── Commentaires ────────────────────────────────────────

        renderComment: function (comment) {
            return '<div class="d-flex mb-3">' +
                '<div class="bg-primary bg-opacity-10 rounded-circle d-flex align-items-center justify-content-center me-2" style="width:32px;height:32px;min-width:32px;">' +
                    '<span class="material-icons md-16 text-primary">person</span>' +
                '</div>' +
                '<div class="small flex-grow-1">' +
                    '<div class="bg-light px-3 py-2 rounded-4 mb-1">' +
                        '<p class="fw-500 mb-0">' + Utils.sanitizeHTML(comment.pseudo) + '</p>' +
                        '<span class="text-muted">' + Utils.sanitizeHTML(comment.content) + '</span>' +
                    '</div>' +
                    '<span class="small text-muted ms-2">' + Utils.formatDate(comment.created_at) + '</span>' +
                '</div></div>';
        },

        renderCommentsList: function (comments) {
            if (!comments || comments.length === 0) return '<div class="text-center py-3 text-muted">Aucun commentaire</div>';
            var html = '';
            for (var i = 0; i < comments.length; i++) html += this.renderComment(comments[i]);
            return html;
        },

        // ── Résultats ───────────────────────────────────────────

        renderResultsBar: function (candidate, totalVotes) {
            var percent = totalVotes > 0 ? Math.round((candidate.vote_count / totalVotes) * 100) : 0;
            var photoUrl = candidate.photo_url || 'img/default-avatar.png';
            return '<div class="mb-3">' +
                '<div class="d-flex align-items-center mb-1">' +
                    '<img src="' + Utils.sanitizeHTML(photoUrl) + '" class="img-fluid rounded-circle me-2" style="width:40px;height:40px;object-fit:cover;">' +
                    '<span class="fw-bold">#' + Utils.sanitizeHTML(candidate.dossard || '?') + '</span>' +
                    '<span class="flex-grow-1 ms-2">' + Utils.sanitizeHTML(candidate.name) + '</span>' +
                    '<span class="fw-bold text-primary">' + percent + '%</span>' +
                '</div>' +
                '<div class="progress" style="height:8px;">' +
                    '<div class="progress-bar bg-primary" style="width:' + percent + '%;transition:width 0.5s ease;"></div>' +
                '</div>' +
                '<small class="text-muted">' + Utils.formatNumber(candidate.vote_count) + ' voix</small>' +
                '</div>';
        },

        // ── Countdown ───────────────────────────────────────────

        renderCountdown: function (closeDate) {
            var text = Utils.formatCountdown(closeDate);
            return '<div class="text-center mb-4">' +
                '<div class="countdown-box shadow" style="font-size:1.2rem;padding:12px 25px;">' +
                '<span class="material-icons" style="font-size:20px">hourglass_top</span>' +
                '<span class="countdown-el" data-end="' + closeDate + '">' + text + '</span>' +
                '</div></div>';
        },

        // ── Loading States ──────────────────────────────────────

        showLoading: function () {
            return '<div class="text-center py-5">' +
                '<div class="spinner-border text-primary mb-3" role="status"><span class="visually-hidden">Chargement...</span></div>' +
                '<p class="mb-0 text-muted">Chargement...</p></div>';
        },

        showError: function (message) {
            return '<div class="text-center py-4 text-danger">' +
                '<span class="material-icons mb-2" style="font-size:48px;">error_outline</span>' +
                '<p class="mb-0">' + Utils.sanitizeHTML(message) + '</p></div>';
        },

        showEmpty: function (message) {
            return '<div class="text-center py-4 text-muted">' +
                '<span class="material-icons mb-2" style="font-size:48px;">inbox</span>' +
                '<p class="mb-0">' + Utils.sanitizeHTML(message || 'Aucun contenu') + '</p></div>';
        }
    };

    window.Components = Components;

})();