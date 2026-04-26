/*
 * UNI-VOTE — Admin App Logic
 */
(function() {
    "use strict";

    var AdminApp = {
        token: localStorage.getItem('admin_token'),
        
        init: function() {
            if (!this.token) { window.location.href = 'admin-login.html'; return; }
            this.setupEvents();
            this.loadDashboard();
            var tabs = document.querySelectorAll('a[data-bs-toggle="pill"]');
            tabs.forEach(function(tab) {
                tab.addEventListener('shown.bs.tab', function (e) {
                    var t = e.target.getAttribute('href');
                    if (t === '#v-events') AdminApp.loadEvents();
                    if (t === '#v-moderation') AdminApp.loadModeration();
                    if (t === '#v-transactions') AdminApp.loadTransactions();
                });
            });
        },

        setupEvents: function() {
            document.getElementById('adminLogoutBtn').addEventListener('click', this.logout);
            document.getElementById('adminLogoutBtnMobile').addEventListener('click', this.logout);
            document.getElementById('eventForm').addEventListener('submit', function(e) { e.preventDefault(); AdminApp.saveEvent(); });
            document.getElementById('candidateForm').addEventListener('submit', function(e) { e.preventDefault(); AdminApp.saveCandidate(); });
            document.getElementById('moderationFilter').addEventListener('change', function() { AdminApp.loadModeration(); });
            document.getElementById('exportTxBtn').addEventListener('click', function() {
                var url = (typeof CONFIG !== 'undefined' && CONFIG.API_BASE ? CONFIG.API_BASE : '/api/v1') + '/admin/transactions/export';
                window.open(url + '?token=' + AdminApp.token, '_blank');
            });

            // Banner preview
            document.getElementById('evBanner').addEventListener('change', function(e) {
                var file = e.target.files[0];
                if (!file) return;
                if (file.size > 5 * 1024 * 1024) { UVToast.error('Image trop volumineuse (max 5MB)'); e.target.value = ''; return; }
                var reader = new FileReader();
                reader.onload = function(ev) {
                    var preview = document.getElementById('bannerPreview');
                    preview.innerHTML = '<img src="' + ev.target.result + '" alt="preview">';
                };
                reader.readAsDataURL(file);
            });

            // Photo preview
            document.getElementById('candPhoto').addEventListener('change', function(e) {
                var file = e.target.files[0];
                if (!file) return;
                var reader = new FileReader();
                reader.onload = function(ev) {
                    document.getElementById('candPhotoPreview').innerHTML = '<img src="' + ev.target.result + '" class="rounded-circle" style="width:60px;height:60px;object-fit:cover">';
                };
                reader.readAsDataURL(file);
            });

            // Gallery preview
            var galleryInput = document.getElementById('candGallery');
            if (galleryInput) {
                galleryInput.addEventListener('change', function(e) {
                    var files = Array.from(e.target.files).slice(0, 6);
                    var grid = document.getElementById('candGalleryPreview');
                    grid.innerHTML = '';
                    files.forEach(function(file) {
                        var reader = new FileReader();
                        reader.onload = function(ev) {
                            var item = document.createElement('div');
                            item.className = 'gallery-upload-item';
                            item.innerHTML = '<img src="' + ev.target.result + '">';
                            grid.appendChild(item);
                        };
                        reader.readAsDataURL(file);
                    });
                });
            }
        },

        logout: function(e) {
            e.preventDefault();
            localStorage.removeItem('admin_token');
            localStorage.removeItem('admin_user');
            window.location.href = 'admin-login.html';
        },

        request: function(endpoint, method, body) {
            var url = (typeof CONFIG !== 'undefined' && CONFIG.API_BASE ? CONFIG.API_BASE : '/api/v1') + endpoint;
            var opts = { method: method || 'GET', headers: { 'Authorization': 'Bearer ' + this.token, 'Accept': 'application/json' } };
            if (body) {
                if (body instanceof FormData) { opts.body = body; }
                else { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
            }
            return fetch(url, opts).then(function(res) {
                if (res.status === 401 || res.status === 403) { AdminApp.logout(new Event('click')); throw new Error('Session expirée'); }
                return res.json().then(function(json) {
                    if (!res.ok || json.success === false) throw new Error(json.error || 'Erreur serveur');
                    return json.data;
                });
            });
        },

        // ── DASHBOARD ──
        loadDashboard: function() {
            var sc = document.getElementById('adminStatsContainer');
            this.request('/admin/dashboard').then(function(d) {
                sc.innerHTML =
                    '<div class="col-6 col-md-3"><div class="kpi-card text-center"><span class="material-icons text-primary md-32 mb-2">payments</span><div class="kpi-value">' + Utils.formatNumber(d.total_revenue||0) + '</div><span class="text-muted small">FCFA Revenus</span></div></div>' +
                    '<div class="col-6 col-md-3"><div class="kpi-card text-center"><span class="material-icons text-success md-32 mb-2">how_to_vote</span><div class="kpi-value">' + Utils.formatNumber(d.total_votes||0) + '</div><span class="text-muted small">Votes totaux</span></div></div>' +
                    '<div class="col-6 col-md-3"><div class="kpi-card text-center"><span class="material-icons text-warning md-32 mb-2">pending_actions</span><div class="kpi-value">' + Utils.formatNumber(d.pending_transactions||0) + '</div><span class="text-muted small">Trans. attente</span></div></div>' +
                    '<div class="col-6 col-md-3"><div class="kpi-card text-center"><span class="material-icons text-info md-32 mb-2">event_available</span><div class="kpi-value">' + Utils.formatNumber(d.active_events||0) + '</div><span class="text-muted small">Scrutins actifs</span></div></div>';
            }).catch(function(err) { sc.innerHTML = '<div class="alert alert-danger w-100">' + err.message + '</div>'; });

            this.request('/admin/events?limit=5').then(function(data) {
                var events = data.data || [], html = '';
                if (!events.length) html = '<div class="text-muted">Aucun scrutin</div>';
                for (var i = 0; i < events.length; i++) {
                    var e = events[i];
                    html += '<div class="d-flex justify-content-between align-items-center mb-2"><div><div class="fw-bold text-dark">' + Utils.sanitizeHTML(e.title) + '</div><small class="text-muted">' + (e.status==='open'?'En cours':'Fermé') + ' | ' + ((e.candidates&&e.candidates.length)||0) + ' candidats</small></div></div>';
                }
                document.getElementById('adminRecentEvents').innerHTML = html;
            });

            this.request('/admin/videos?status=pending_moderation&limit=3').then(function(data) {
                var videos = data.data || [], html = '';
                if (!videos.length) html = '<div class="text-muted">Aucune vidéo en attente</div>';
                for (var i = 0; i < videos.length; i++) {
                    html += '<div class="d-flex align-items-center mb-2"><span class="material-icons text-warning me-2">error_outline</span><div class="text-truncate">' + Utils.sanitizeHTML(videos[i].title || 'Vidéo') + '</div></div>';
                }
                document.getElementById('adminPendingVideos').innerHTML = html;
            });
        },

        // ── EVENTS ──
        loadEvents: function() {
            var grid = document.getElementById('adminEventsGrid');
            if (!grid) return;
            grid.innerHTML = '<div class="col-12 text-center py-5"><div class="spinner-border text-primary"></div></div>';
            this.request('/admin/events').then(function(data) {
                var events = data.data || [], html = '';
                if (!events.length) { grid.innerHTML = '<div class="col-12 text-center py-5 text-muted">Aucun scrutin</div>'; return; }
                for (var i = 0; i < events.length; i++) {
                    var e = events[i];
                    var statusBadge = e.status === 'open' ? '<span class="badge bg-success">Ouvert</span>' : e.status === 'closed' ? '<span class="badge bg-secondary">Fermé</span>' : '<span class="badge bg-warning text-dark">Brouillon</span>';
                    var candCount = (e.candidates && e.candidates.length) || 0;
                    var bannerHtml = e.banner_url ? '<div style="height:140px; background:url(\''+Utils.sanitizeHTML(e.banner_url)+'\') center/cover; border-radius: 1rem 1rem 0 0;"></div>' : '<div class="bg-primary bg-opacity-10 d-flex align-items-center justify-content-center" style="height:140px; border-radius: 1rem 1rem 0 0;"><span class="material-icons text-primary md-36">how_to_vote</span></div>';
                    
                    html += '<div class="col-md-6 col-xl-4">' +
                        '<div class="card h-100 border-0 shadow-sm rounded-4">' + bannerHtml +
                            '<div class="card-body p-4">' +
                                '<div class="d-flex justify-content-between align-items-start mb-2">' +
                                    '<h5 class="fw-bold text-dark mb-0">' + Utils.sanitizeHTML(e.title) + '</h5>' +
                                    statusBadge +
                                '</div>' +
                                '<div class="text-muted small mb-4 d-flex align-items-center gap-3">' +
                                    '<span><span class="material-icons md-16 align-middle me-1">group</span>' + candCount + ' candidats</span>' +
                                    '<span><span class="material-icons md-16 align-middle me-1">event</span>' + (e.closes_at ? Utils.formatDate(e.closes_at) : 'Sans fin') + '</span>' +
                                '</div>' +
                                '<div class="d-flex flex-wrap gap-2 mt-auto">' +
                                    '<a href="event-dashboard.html?id=' + e.id + '" class="btn btn-sm btn-outline-success flex-fill rounded-pill"><span class="material-icons md-18 align-middle">analytics</span></a>' +
                                    '<button class="btn btn-sm btn-outline-primary flex-fill rounded-pill" onclick="AdminApp.editEvent(\'' + e.id + '\')"><span class="material-icons md-18 align-middle">edit</span></button>' +
                                    '<button class="btn btn-sm btn-primary flex-fill rounded-pill" onclick="AdminApp.openCandidatesModal(\'' + e.id + '\', \'' + e.title.replace(/'/g, "\\'") + '\')"><span class="material-icons md-18 align-middle">group</span> Candidats</button>' +
                                    '<button class="btn btn-sm btn-outline-danger rounded-pill px-3" onclick="AdminApp.deleteEvent(\'' + e.id + '\')"><span class="material-icons md-18 align-middle">delete</span></button>' +
                                '</div>' +
                            '</div>' +
                        '</div></div>';
                }
                grid.innerHTML = html;
            }).catch(function(err) { grid.innerHTML = '<div class="col-12 text-danger text-center">' + err.message + '</div>'; });
        },

        saveEvent: function() {
            var id = document.getElementById('evId').value;
            var form = new FormData();
            form.append('title', document.getElementById('evTitle').value);
            form.append('description', document.getElementById('evDesc').value);
            form.append('type', document.getElementById('evType').value);
            form.append('price_per_vote', document.getElementById('evPrice').value);
            form.append('status', document.getElementById('evStatus').value);
            var closeVal = document.getElementById('evClose').value;
            if (closeVal) form.append('closes_at', new Date(closeVal).toISOString());

            var bannerFile = document.getElementById('evBanner').files[0];
            if (bannerFile) form.append('banner', bannerFile);

            var req = id ? this.request('/admin/events/' + id, 'PUT', form) : this.request('/admin/events', 'POST', form);
            req.then(function() {
                var modal = bootstrap.Modal.getInstance(document.getElementById('eventModal'));
                if (modal) modal.hide();
                UVToast.success('Scrutin enregistré avec succès');
                AdminApp.loadEvents();
                AdminApp.resetEventForm();
            }).catch(function(err) { UVToast.error(err.message); });
        },

        resetEventForm: function() {
            document.getElementById('eventForm').reset();
            document.getElementById('evId').value = '';
            document.getElementById('bannerPreview').innerHTML = '<div class="placeholder-content" id="bannerPlaceholder"><span class="material-icons">add_photo_alternate</span><div class="small mt-1">Cliquez pour ajouter</div></div>';
        },

        editEvent: function(id) {
            API.getEvent(id).then(function(e) {
                document.getElementById('evId').value = e.id;
                document.getElementById('evTitle').value = e.title;
                document.getElementById('evDesc').value = e.description || '';
                document.getElementById('evType').value = e.type || 'free';
                document.getElementById('evPrice').value = e.price_per_vote || 0;
                document.getElementById('evStatus').value = e.status || 'draft';
                if (e.closes_at) {
                    var dt = new Date(e.closes_at);
                    dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
                    document.getElementById('evClose').value = dt.toISOString().slice(0, 16);
                }
                if (e.banner_url) {
                    document.getElementById('bannerPreview').innerHTML = '<img src="' + e.banner_url + '" alt="banner">';
                }
                document.getElementById('eventModalTitle').textContent = 'Modifier Événement';
                new bootstrap.Modal(document.getElementById('eventModal')).show();
            }).catch(function(err) { UVToast.error(err.message); });
        },

        deleteEvent: function(id) {
            UVConfirm('Supprimer cet événement ?', 'Cette action est irréversible. Tous les candidats et votes associés seront perdus.', function() {
                AdminApp.request('/admin/events/' + id, 'DELETE').then(function() {
                    UVToast.success('Événement supprimé');
                    AdminApp.loadEvents();
                }).catch(function(err) { UVToast.error(err.message); });
            });
        },

        // ── CANDIDATES ──
        currentEventIdForCandidates: null,

        copyShareLink: function(candId) {
            var url = window.location.origin + '/candidate.html?id=' + candId;
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(url).then(function() {
                    UVToast.success('Lien de vote copié !');
                });
            } else {
                var t = document.createElement("textarea");
                t.value = url; document.body.appendChild(t); t.select(); document.execCommand("copy"); document.body.removeChild(t);
                UVToast.success('Lien de vote copié !');
            }
        },

        openCandidatesModal: function(eventId, eventTitle) {
            this.currentEventIdForCandidates = eventId;
            document.getElementById('candidatesListTitle').textContent = 'Candidats : ' + eventTitle;
            var grid = document.getElementById('adminCandidatesGrid');
            grid.innerHTML = '<div class="col-12 text-center py-4"><div class="spinner-border text-primary"></div></div>';
            new bootstrap.Modal(document.getElementById('candidatesListModal')).show();

            API.getEvent(eventId).then(function(e) {
                var cands = e.candidates || [];
                if (!cands.length) { grid.innerHTML = '<div class="col-12 text-center py-4 text-muted"><span class="material-icons mb-2" style="font-size:48px">person_off</span><p>Aucun candidat</p></div>'; return; }
                var html = '';
                for (var i = 0; i < cands.length; i++) {
                    var c = cands[i];
                    var photo = c.photo_url || 'img/default-avatar.png';
                    var candJson = encodeURIComponent(JSON.stringify(c));
                    
                    html += '<div class="col-md-6 col-lg-4">' +
                        '<div class="bg-white rounded-4 shadow-sm p-0 overflow-hidden text-center candidate-card position-relative">' +
                            '<button class="btn btn-light shadow-sm btn-sm position-absolute top-0 end-0 m-2 rounded-circle" style="z-index:2" onclick="AdminApp.copyShareLink(\'' + c.id + '\')" title="Partager">' +
                                '<span class="material-icons text-primary md-18">share</span>' +
                            '</button>' +
                            '<div style="height: 180px; background: url(\'' + Utils.sanitizeHTML(photo) + '\') center/cover;"></div>' +
                            '<div class="p-3">' +
                                '<h6 class="fw-bold mb-1">#' + Utils.sanitizeHTML(c.dossard || '?') + ' - ' + Utils.sanitizeHTML(c.name) + '</h6>' +
                                '<div class="text-muted small mb-3"><span class="badge bg-primary bg-opacity-10 text-primary">' + (c.vote_count || 0) + ' votes</span></div>' +
                                '<div class="d-flex justify-content-center gap-2">' +
                                    '<button class="btn btn-sm btn-outline-primary rounded-pill flex-fill" onclick="AdminApp.editCandidate(\'' + candJson + '\')"><span class="material-icons md-16 align-middle">edit</span> Modifier</button>' +
                                    '<button class="btn btn-sm btn-outline-danger rounded-pill flex-fill" onclick="AdminApp.deleteCandidate(\'' + c.id + '\')"><span class="material-icons md-16 align-middle">delete</span> Supprimer</button>' +
                                '</div>' +
                            '</div>' +
                        '</div></div>';
                }
                grid.innerHTML = html;
            }).catch(function(err) { grid.innerHTML = '<div class="col-12 text-danger">' + err.message + '</div>'; });
        },

        openAddCandidateModal: function() {
            document.getElementById('candidateForm').reset();
            document.getElementById('candId').value = '';
            document.getElementById('candPhotoPreview').innerHTML = '';
            document.getElementById('candGalleryPreview').innerHTML = '';
            document.getElementById('candidateFormTitle').textContent = 'Nouveau Candidat';
            var m = bootstrap.Modal.getInstance(document.getElementById('candidatesListModal'));
            if (m) m.hide();
            new bootstrap.Modal(document.getElementById('candidateFormModal')).show();
        },

        editCandidate: function(candJsonEncoded) {
            var c = JSON.parse(decodeURIComponent(candJsonEncoded));
            document.getElementById('candidateForm').reset();
            document.getElementById('candId').value = c.id;
            document.getElementById('candName').value = c.name;
            document.getElementById('candDossard').value = c.dossard || '';
            document.getElementById('candBio').value = c.bio || '';
            document.getElementById('candPhotoPreview').innerHTML = c.photo_url ? '<img src="'+c.photo_url+'" class="rounded-circle" style="width:60px;height:60px;object-fit:cover">' : '';
            var galleryHtml = '';
            if (c.gallery && c.gallery.length > 0) {
                galleryHtml = '<div class="d-flex flex-wrap gap-2 mt-2">';
                for(var i=0; i<c.gallery.length; i++) {
                    galleryHtml += '<img src="' + c.gallery[i] + '" class="rounded" style="width:50px;height:50px;object-fit:cover">';
                }
                galleryHtml += '</div>';
            }
            document.getElementById('candGalleryPreview').innerHTML = galleryHtml;
            document.getElementById('candidateFormTitle').textContent = 'Modifier Candidat';
            var m = bootstrap.Modal.getInstance(document.getElementById('candidatesListModal'));
            if (m) m.hide();
            new bootstrap.Modal(document.getElementById('candidateFormModal')).show();
        },

        saveCandidate: function() {
            var id = document.getElementById('candId').value;
            var eventId = this.currentEventIdForCandidates;
            var form = new FormData();
            form.append('name', document.getElementById('candName').value);
            form.append('dossard', document.getElementById('candDossard').value);
            form.append('bio', document.getElementById('candBio').value);
            var fileInput = document.getElementById('candPhoto');
            if (fileInput.files.length > 0) form.append('photo', fileInput.files[0]);
            var galleryInput = document.getElementById('candGallery');
            if (galleryInput && galleryInput.files.length > 0) {
                for (var i = 0; i < galleryInput.files.length; i++) {
                    form.append('gallery', galleryInput.files[i]);
                }
            }

            var btn = document.getElementById('candSaveBtn');
            btn.disabled = true; btn.textContent = 'Enregistrement...';

            var req = id ? this.request('/admin/candidates/' + id, 'PUT', form) : this.request('/admin/events/' + eventId + '/candidates', 'POST', form);
            req.then(function() {
                btn.disabled = false; btn.textContent = 'Enregistrer le candidat';
                var modal = bootstrap.Modal.getInstance(document.getElementById('candidateFormModal'));
                if (modal) modal.hide();
                UVToast.success('Candidat enregistré avec succès');
                AdminApp.openCandidatesModal(eventId, document.getElementById('candidatesListTitle').textContent.replace('Candidats : ', ''));
            }).catch(function(err) {
                btn.disabled = false; btn.textContent = 'Enregistrer le candidat';
                UVToast.error(err.message);
            });
        },

        deleteCandidate: function(id) {
            UVConfirm('Supprimer ce candidat ?', 'Ses votes seront définitivement perdus.', function() {
                AdminApp.request('/admin/candidates/' + id, 'DELETE').then(function() {
                    UVToast.success('Candidat supprimé');
                    var eventId = AdminApp.currentEventIdForCandidates;
                    var title = document.getElementById('candidatesListTitle').textContent.replace('Candidats : ', '');
                    AdminApp.openCandidatesModal(eventId, title);
                }).catch(function(err) { UVToast.error(err.message); });
            });
        },

        // ── MODERATION ──
        loadModeration: function() {
            var grid = document.getElementById('adminModerationGrid');
            var status = document.getElementById('moderationFilter').value;
            grid.innerHTML = '<div class="col-12 text-center py-5"><div class="spinner-border text-primary"></div></div>';
            this.request('/admin/videos?status=' + status).then(function(data) {
                var videos = data.data || [];
                if (!videos.length) { grid.innerHTML = '<div class="col-12 text-center py-5 text-muted"><span class="material-icons mb-2" style="font-size:48px">videocam_off</span><p>Aucune vidéo</p></div>'; return; }
                var html = '';
                for (var i = 0; i < videos.length; i++) {
                    var v = videos[i];
                    var actions = status === 'pending_moderation'
                        ? '<button class="btn btn-success btn-sm flex-fill me-2" onclick="AdminApp.moderateVideo(\''+v.id+'\',\'approve\')">Approuver</button><button class="btn btn-danger btn-sm flex-fill" onclick="AdminApp.moderateVideo(\''+v.id+'\',\'reject\')">Rejeter</button>'
                        : '<button class="btn btn-outline-danger w-100 btn-sm" onclick="AdminApp.moderateVideo(\''+v.id+'\',\'delete\')">Supprimer</button>';
                    html += '<div class="col-md-6 col-lg-4"><div class="bg-white rounded-4 shadow-sm p-3">' +
                        '<div class="d-flex align-items-center mb-2"><span class="material-icons bg-light rounded-circle p-2 me-2">smart_display</span><div><div class="fw-bold">' + Utils.sanitizeHTML(v.title || 'Sans titre') + '</div><div class="small text-muted">Par ' + Utils.sanitizeHTML(v.pseudo || 'Anonyme') + '</div></div></div>' +
                        '<video src="' + v.video_url + '" class="img-fluid rounded mb-3 w-100 bg-dark" style="height:200px;object-fit:contain;" controls></video>' +
                        '<div class="d-flex">' + actions + '</div></div></div>';
                }
                grid.innerHTML = html;
            }).catch(function(err) { grid.innerHTML = '<div class="col-12 text-danger">' + err.message + '</div>'; });
        },

        moderateVideo: function(id, action) {
            if (action === 'delete') {
                UVConfirm('Supprimer cette vidéo ?', 'Elle sera définitivement supprimée.', function() {
                    AdminApp.request('/admin/videos/' + id, 'DELETE').then(function() { UVToast.success('Vidéo supprimée'); AdminApp.loadModeration(); }).catch(function(err) { UVToast.error(err.message); });
                });
                return;
            }
            var endpoint = '/admin/videos/' + id + '/' + action;
            this.request(endpoint, 'PATCH').then(function() { UVToast.success('Action effectuée'); AdminApp.loadModeration(); }).catch(function(err) { UVToast.error(err.message); });
        },

        // ── TRANSACTIONS ──
        loadTransactions: function() {
            var tbody = document.getElementById('adminTransactionsTable');
            tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4"><div class="spinner-border text-primary"></div></td></tr>';
            this.request('/admin/transactions?limit=50').then(function(data) {
                var txs = data.data || [], html = '';
                if (!txs.length) { tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-muted">Aucune transaction</td></tr>'; return; }
                for (var i = 0; i < txs.length; i++) {
                    var t = txs[i];
                    var sb = t.status==='success' ? '<span class="badge bg-success">Succès</span>' : t.status==='failed' ? '<span class="badge bg-danger">Échec</span>' : '<span class="badge bg-warning text-dark">Attente</span>';
                    html += '<tr><td><span class="small text-muted font-monospace">' + t.reference + '</span></td><td>' + (t.candidate ? Utils.sanitizeHTML(t.candidate.name) : '-') + '</td><td class="fw-bold">' + Utils.formatNumber(t.amount) + '</td><td>' + sb + '</td><td>' + Utils.formatDate(t.created_at) + '</td></tr>';
                }
                tbody.innerHTML = html;
            }).catch(function(err) { tbody.innerHTML = '<tr><td colspan="5" class="text-danger">' + err.message + '</td></tr>'; });
        }
    };

    window.AdminApp = AdminApp;
    document.addEventListener("DOMContentLoaded", function() { AdminApp.init(); });
})();
