/*
 * UNI-VOTE — Social Page Logic
 */

(function () {
    "use strict";

    var currentEventId = null;
    var uploadData = null;

    document.addEventListener("DOMContentLoaded", function () {
        initEvents();
        setupUploadLogic();
        setupInteractions();
    });

    function initEvents() {
        var urlParams = new URLSearchParams(window.location.search);
        var urlEventId = urlParams.get('event');

        var feedSelect = document.getElementById('feedEventSelect');
        var postSelect = document.getElementById('postEventSelect');

        API.getEvents('open').then(function (data) {
            if (!data.events || data.events.length === 0) {
                feedSelect.innerHTML = '<option value="">Aucun événement ouvert</option>';
                document.getElementById('social-feed-container').innerHTML = '<div class="text-center p-4 text-muted">Aucun événement en cours pour afficher le flux.</div>';
                return;
            }

            var html = '';
            for (var i = 0; i < data.events.length; i++) {
                html += '<option value="' + data.events[i].id + '">' + Utils.sanitizeHTML(data.events[i].title) + '</option>';
            }
            feedSelect.innerHTML = html;
            postSelect.innerHTML = html;

            if (urlEventId) {
                feedSelect.value = urlEventId;
                postSelect.value = urlEventId;
            }
            
            currentEventId = feedSelect.value;
            loadFeed();

            feedSelect.addEventListener('change', function() {
                currentEventId = this.value;
                postSelect.value = this.value;
                loadFeed();
            });

        }).catch(function (error) {
            feedSelect.innerHTML = '<option value="">Erreur de chargement</option>';
            document.getElementById('social-feed-container').innerHTML = '<div class="text-center p-4 text-danger">Erreur: ' + error.message + '</div>';
        });
    }

    function loadFeed() {
        var container = document.getElementById('social-feed-container');
        container.innerHTML = '<div class="text-center p-4"><div class="spinner-border text-primary"></div><p class="mt-2 text-muted">Chargement du flux social...</p></div>';

        if (!currentEventId) return;

        API.getVideos(currentEventId, 'recent', 0, 20).then(function (data) {
            if (!data.videos || data.videos.length === 0) {
                container.innerHTML = '<div class="text-center py-5 text-muted">' +
                    '<span class="material-icons md-48 d-block mb-3">explore_off</span>' +
                    'Aucun post pour le moment. Soyez le premier !</div>';
                return;
            }

            var html = '';
            for (var i = 0; i < data.videos.length; i++) {
                html += Components.renderSocialFeedItem(data.videos[i], currentEventId);
            }
            container.innerHTML = html;
        }).catch(function (error) {
            container.innerHTML = '<div class="text-center p-4 text-danger">Erreur: ' + error.message + '</div>';
        });
    }

    function setupUploadLogic() {
        var btn = document.getElementById('submitPostBtn');
        var fileInput = document.getElementById('postFileInput');
        var errorEl = document.getElementById('postError');
        var progressEl = document.getElementById('postProgress');
        var bar = progressEl.querySelector('.progress-bar');

        btn.addEventListener('click', function () {
            var pseudo = Utils.getPseudo();
            if (!pseudo) {
                var modalEl = document.getElementById('postModal');
                var modal = bootstrap.Modal.getInstance(modalEl);
                if (modal) modal.hide();
                Utils.showPseudoModal(function() {
                    var newModal = new bootstrap.Modal(document.getElementById('postModal'));
                    newModal.show();
                });
                return;
            }

            var eventId = document.getElementById('postEventSelect').value;
            var title = document.getElementById('postContentInput').value.trim();
            var file = fileInput.files[0];

            errorEl.classList.add('d-none');

            if (!eventId) {
                errorEl.textContent = "Veuillez sélectionner un événement.";
                errorEl.classList.remove('d-none');
                return;
            }
            if (!title && !file) {
                errorEl.textContent = "Veuillez écrire un message ou ajouter une vidéo.";
                errorEl.classList.remove('d-none');
                return;
            }
            if (!file) {
                errorEl.textContent = "Une vidéo est obligatoire pour le moment.";
                errorEl.classList.remove('d-none');
                return;
            }

            Utils.disableButton(btn);
            btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Préparation...';

            API.requestUpload(eventId, null, pseudo, title).then(function (data) {
                uploadData = data;
                progressEl.style.display = 'flex';
                btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Upload...';

                var formData = new FormData();
                formData.append('file', file);
                formData.append('signature', uploadData.signature);
                formData.append('timestamp', uploadData.timestamp);
                formData.append('api_key', uploadData.api_key);
                formData.append('folder', uploadData.folder);

                var xhr = new XMLHttpRequest();
                xhr.open('POST', uploadData.upload_url, true);

                xhr.upload.onprogress = function(e) {
                    if (e.lengthComputable) {
                        var percent = Math.round((e.loaded / e.total) * 100);
                        bar.style.width = percent + '%';
                        bar.textContent = percent + '%';
                    }
                };

                xhr.onload = function() {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        Utils.showSuccess('Post publié ! Il sera visible après modération.');
                        
                        // Reset form
                        document.getElementById('postContentInput').value = '';
                        fileInput.value = '';
                        progressEl.style.display = 'none';
                        bar.style.width = '0%';
                        
                        var modalEl = document.getElementById('postModal');
                        var modal = bootstrap.Modal.getInstance(modalEl);
                        if (modal) modal.hide();
                        
                        Utils.enableButton(btn);
                        btn.innerHTML = '<span class="material-icons me-2 md-18 align-middle">send</span> Publier';
                        
                        // Load feed to show changes (if immediate, but usually needs moderation)
                        setTimeout(loadFeed, 2000);
                    } else {
                        errorEl.textContent = "Erreur lors de l'upload de la vidéo.";
                        errorEl.classList.remove('d-none');
                        Utils.enableButton(btn);
                        btn.innerHTML = '<span class="material-icons me-2 md-18 align-middle">send</span> Réessayer';
                    }
                };

                xhr.onerror = function() {
                    errorEl.textContent = "Erreur réseau lors de l'upload.";
                    errorEl.classList.remove('d-none');
                    Utils.enableButton(btn);
                    btn.innerHTML = '<span class="material-icons me-2 md-18 align-middle">send</span> Réessayer';
                };

                xhr.send(formData);

            }).catch(function (error) {
                errorEl.textContent = error.message;
                errorEl.classList.remove('d-none');
                Utils.enableButton(btn);
                btn.innerHTML = '<span class="material-icons me-2 md-18 align-middle">send</span> Réessayer';
            });
        });
    }

    function setupInteractions() {
        document.getElementById('social-feed-container').addEventListener('click', function(e) {
            
            // Like Logic
            var likeBtn = e.target.closest('.social-like-btn');
            if (likeBtn) {
                e.preventDefault();
                var pseudo = Utils.getPseudo();
                if (!pseudo) {
                    Utils.showPseudoModal();
                    return;
                }
                var videoId = likeBtn.getAttribute('data-video');
                var countSpan = likeBtn.querySelector('.like-count');
                var icon = likeBtn.querySelector('.material-icons');
                
                likeBtn.disabled = true;
                icon.classList.add('pulse-animation');
                
                API.likeVideo(videoId, pseudo).then(function(data) {
                    countSpan.textContent = Utils.formatNumber(data.like_count);
                    if (!data.already_liked) {
                        icon.textContent = 'thumb_up';
                        likeBtn.classList.replace('text-muted', 'text-primary');
                    }
                    likeBtn.disabled = false;
                    icon.classList.remove('pulse-animation');
                }).catch(function(err) {
                    Utils.showError(err.message);
                    likeBtn.disabled = false;
                    icon.classList.remove('pulse-animation');
                });
                return;
            }

            // Comment Logic
            var commentBtn = e.target.closest('.social-comment-btn');
            if (commentBtn) {
                e.preventDefault();
                var videoId = commentBtn.getAttribute('data-video');
                currentVideoIdForComments = videoId;
                
                var commentsList = document.getElementById('commentsList');
                commentsList.innerHTML = '<div class="text-center p-3 text-muted">Chargement...</div>';
                
                var modal = new bootstrap.Modal(document.getElementById('commentsModal'));
                modal.show();
                
                API.getVideoComments(videoId, 1, 20).then(function(data) {
                    if (!data.comments || data.comments.length === 0) {
                        commentsList.innerHTML = '<div class="text-center p-3 text-muted">Aucun commentaire. Soyez le premier !</div>';
                        return;
                    }
                    var html = '';
                    for (var i = 0; i < data.comments.length; i++) {
                        html += Components.renderComment(data.comments[i]);
                    }
                    commentsList.innerHTML = html;
                }).catch(function(err) {
                    commentsList.innerHTML = '<div class="text-center p-3 text-danger">Erreur: ' + err.message + '</div>';
                });
            }
        });

        // Send new comment logic
        document.getElementById('sendCommentBtn').addEventListener('click', function() {
            var input = document.getElementById('newCommentInput');
            var content = input.value.trim();
            if (!content || !currentVideoIdForComments) return;
            
            var pseudo = Utils.getPseudo();
            if (!pseudo) {
                var modalEl = document.getElementById('commentsModal');
                var modal = bootstrap.Modal.getInstance(modalEl);
                if (modal) modal.hide();
                Utils.showPseudoModal();
                return;
            }
            
            var btn = this;
            Utils.disableButton(btn);
            
            API.commentVideo(currentVideoIdForComments, pseudo, content).then(function(data) {
                input.value = '';
                Utils.enableButton(btn);
                
                // Add new comment at the top
                var list = document.getElementById('commentsList');
                if (list.querySelector('.text-muted')) {
                    list.innerHTML = '';
                }
                var newHtml = Components.renderComment(data);
                list.insertAdjacentHTML('afterbegin', newHtml);
                
                // Update counter on the feed item if visible
                var feedItem = document.getElementById('post-' + currentVideoIdForComments);
                if (feedItem) {
                    var countSpan = feedItem.querySelector('.comment-count');
                    if (countSpan) {
                        var current = parseInt(countSpan.textContent.replace(/[^0-9]/g, '')) || 0;
                        countSpan.textContent = Utils.formatNumber(current + 1);
                    }
                }
            }).catch(function(err) {
                Utils.enableButton(btn);
                Utils.showError(err.message);
            });
        });

        // Save/Bookmark Logic
        document.getElementById('social-feed-container').addEventListener('click', function(e) {
            var saveBtn = e.target.closest('.social-save-btn');
            if (saveBtn) {
                e.preventDefault();
                var icon = saveBtn.querySelector('.material-icons');
                if (icon.textContent === 'bookmark_border') {
                    icon.textContent = 'bookmark';
                    saveBtn.classList.replace('text-muted', 'text-primary');
                    Utils.showInfo('Post sauvegardé !');
                } else {
                    icon.textContent = 'bookmark_border';
                    saveBtn.classList.replace('text-primary', 'text-muted');
                    Utils.showInfo('Post retiré des sauvegardes.');
                }
            }
        });

        // "Enter" key for comment
        document.getElementById('newCommentInput').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                document.getElementById('sendCommentBtn').click();
            }
        });
    }

})();
