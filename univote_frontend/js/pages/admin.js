/*
 * UNI-VOTE — Admin App Logic
 */

(function() {
    "use strict";

    var AdminApp = {
        token: localStorage.getItem('admin_token'),
        
        init: function() {
            if (!this.token) {
                window.location.href = 'admin-login.html';
                return;
            }

            this.setupEvents();
            this.loadDashboard();

            // Handle tab changes to load data dynamically
            var tabs = document.querySelectorAll('a[data-bs-toggle="pill"]');
            tabs.forEach(function(tab) {
                tab.addEventListener('shown.bs.tab', function (e) {
                    var targetId = e.target.getAttribute('href');
                    if (targetId === '#v-events') AdminApp.loadEvents();
                    if (targetId === '#v-moderation') AdminApp.loadModeration();
                    if (targetId === '#v-transactions') AdminApp.loadTransactions();
                });
            });
        },

        setupEvents: function() {
            document.getElementById('adminLogoutBtn').addEventListener('click', this.logout);
            document.getElementById('adminLogoutBtnMobile').addEventListener('click', this.logout);
            
            document.getElementById('eventForm').addEventListener('submit', function(e) {
                e.preventDefault();
                AdminApp.saveEvent();
            });

            document.getElementById('candidateForm').addEventListener('submit', function(e) {
                e.preventDefault();
                AdminApp.saveCandidate();
            });

            document.getElementById('moderationFilter').addEventListener('change', function() {
                AdminApp.loadModeration();
            });

            document.getElementById('exportTxBtn').addEventListener('click', function() {
                var url = (typeof CONFIG !== 'undefined' && CONFIG.API_BASE ? CONFIG.API_BASE : 'http://localhost:8080/api/v1') + '/admin/transactions/export';
                window.open(url + '?token=' + AdminApp.token, '_blank'); // Some backends allow token in query for export
            });
        },

        logout: function(e) {
            e.preventDefault();
            localStorage.removeItem('admin_token');
            localStorage.removeItem('admin_user');
            window.location.href = 'admin-login.html';
        },

        // Wrapper for authenticated requests
        request: function(endpoint, method, body) {
            var url = (typeof CONFIG !== 'undefined' && CONFIG.API_BASE ? CONFIG.API_BASE : 'http://localhost:8080/api/v1') + endpoint;
            var opts = {
                method: method || 'GET',
                headers: {
                    'Authorization': 'Bearer ' + this.token,
                    'Accept': 'application/json'
                }
            };
            if (body) {
                if (body instanceof FormData) {
                    opts.body = body;
                    // Laisse le navigateur définir le Content-Type avec le boundary correct
                } else {
                    opts.headers['Content-Type'] = 'application/json';
                    opts.body = JSON.stringify(body);
                }
            }

            return fetch(url, opts).then(function(res) {
                if (res.status === 401 || res.status === 403) {
                    AdminApp.logout(new Event('click'));
                    throw new Error('Session expirée');
                }
                return res.json().then(function(json) {
                    if (!res.ok || json.success === false) throw new Error(json.error || 'Erreur serveur');
                    return json.data;
                });
            });
        },

        // ── DASHBOARD ──
        loadDashboard: function() {
            var statsContainer = document.getElementById('adminStatsContainer');
            
            this.request('/admin/dashboard').then(function(data) {
                statsContainer.innerHTML = 
                    '<div class="col-6 col-md-3">' +
                        '<div class="bg-white rounded-4 shadow-sm p-3 text-center">' +
                            '<span class="material-icons text-primary md-32 mb-2">payments</span>' +
                            '<h4 class="fw-bold m-0">' + Utils.formatNumber(data.total_revenue || 0) + ' <small class="text-muted fs-6">FCFA</small></h4>' +
                            '<span class="text-muted small">Revenus totaux</span>' +
                        '</div>' +
                    '</div>' +
                    '<div class="col-6 col-md-3">' +
                        '<div class="bg-white rounded-4 shadow-sm p-3 text-center">' +
                            '<span class="material-icons text-success md-32 mb-2">how_to_vote</span>' +
                            '<h4 class="fw-bold m-0">' + Utils.formatNumber(data.total_votes || 0) + '</h4>' +
                            '<span class="text-muted small">Votes totaux</span>' +
                        '</div>' +
                    '</div>' +
                    '<div class="col-6 col-md-3">' +
                        '<div class="bg-white rounded-4 shadow-sm p-3 text-center">' +
                            '<span class="material-icons text-warning md-32 mb-2">pending_actions</span>' +
                            '<h4 class="fw-bold m-0">' + Utils.formatNumber(data.pending_transactions || 0) + '</h4>' +
                            '<span class="text-muted small">Trans. attente</span>' +
                        '</div>' +
                    '</div>' +
                    '<div class="col-6 col-md-3">' +
                        '<div class="bg-white rounded-4 shadow-sm p-3 text-center">' +
                            '<span class="material-icons text-info md-32 mb-2">event_available</span>' +
                            '<h4 class="fw-bold m-0">' + Utils.formatNumber(data.active_events || 0) + '</h4>' +
                            '<span class="text-muted small">Scrutins actifs</span>' +
                        '</div>' +
                    '</div>';

            }).catch(function(err) {
                statsContainer.innerHTML = '<div class="alert alert-danger w-100">' + err.message + '</div>';
            });

            // Quick lists for dashboard (we load from events and moderation endpoints)
            this.request('/admin/events?limit=5').then(function(data) {
                var events = data.data || [];
                var html = '';
                if(events.length === 0) html = '<div class="text-muted">Aucun scrutin</div>';
                for(var i=0; i<events.length; i++) {
                    var e = events[i];
                    html += '<div class="d-flex justify-content-between align-items-center mb-2">' +
                        '<div><div class="fw-bold text-dark">' + Utils.sanitizeHTML(e.title) + '</div><small class="text-muted">' + (e.status==='open'?'En cours':'Fermé') + '</small></div>' +
                        '</div>';
                }
                document.getElementById('adminRecentEvents').innerHTML = html;
            });

            this.request('/admin/videos?status=pending_moderation&limit=3').then(function(data) {
                var videos = data.data || [];
                var html = '';
                if(videos.length === 0) html = '<div class="text-muted">Aucune vidéo en attente</div>';
                for(var i=0; i<videos.length; i++) {
                    var v = videos[i];
                    html += '<div class="d-flex align-items-center mb-2">' +
                        '<span class="material-icons text-warning me-2">error_outline</span>' +
                        '<div class="text-truncate">' + Utils.sanitizeHTML(v.title || 'Vidéo') + '</div>' +
                        '</div>';
                }
                document.getElementById('adminPendingVideos').innerHTML = html;
            });
        },

        // ── EVENTS ──
        loadEvents: function() {
            var tbody = document.getElementById('adminEventsTable');
            tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4"><div class="spinner-border text-primary"></div></td></tr>';

            this.request('/admin/events').then(function(data) {
                var events = data.data || [];
                var html = '';
                if(events.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-muted">Aucun scrutin trouvé</td></tr>';
                    return;
                }
                
                for(var i=0; i<events.length; i++) {
                    var e = events[i];
                    var statusBadge = '';
                    if(e.status === 'open') statusBadge = '<span class="badge bg-success">Ouvert</span>';
                    else if(e.status === 'closed') statusBadge = '<span class="badge bg-secondary">Fermé</span>';
                    else statusBadge = '<span class="badge bg-warning text-dark">Brouillon</span>';

                    html += '<tr>' +
                        '<td><span class="fw-bold">' + Utils.sanitizeHTML(e.title) + '</span></td>' +
                        '<td>' + statusBadge + '</td>' +
                        '<td>0 candidats</td>' + // Normally from e.candidates.length if preloaded
                        '<td>' + (e.closes_at ? Utils.formatDate(e.closes_at) : '-') + '</td>' +
                        '<td>' +
                            '<button class="btn btn-sm btn-light text-primary me-1" onclick="AdminApp.editEvent(\'' + e.id + '\')" title="Modifier"><span class="material-icons md-18">edit</span></button>' +
                            '<button class="btn btn-sm btn-primary me-1" onclick="AdminApp.openCandidatesModal(\'' + e.id + '\', \'' + e.title.replace(/'/g, "\\'") + '\')" title="Gérer les candidats"><span class="material-icons md-18">group</span></button>' +
                            '<button class="btn btn-sm btn-light text-danger" onclick="AdminApp.deleteEvent(\'' + e.id + '\')" title="Supprimer"><span class="material-icons md-18">delete</span></button>' +
                        '</td>' +
                    '</tr>';
                }
                tbody.innerHTML = html;
            }).catch(function(err) {
                tbody.innerHTML = '<tr><td colspan="5" class="text-danger">' + err.message + '</td></tr>';
            });
        },

        saveEvent: function() {
            var id = document.getElementById('evId').value;
            var body = {
                title: document.getElementById('evTitle').value,
                description: document.getElementById('evDesc').value,
                type: document.getElementById('evType').value,
                price_per_vote: parseInt(document.getElementById('evPrice').value) || 0,
                status: document.getElementById('evStatus').value,
                closes_at: document.getElementById('evClose').value ? (new Date(document.getElementById('evClose').value)).toISOString() : null
            };

            var req = id ? this.request('/admin/events/' + id, 'PUT', body) : this.request('/admin/events', 'POST', body);

            req.then(function() {
                var modal = bootstrap.Modal.getInstance(document.getElementById('eventModal'));
                if (modal) modal.hide();
                Utils.showSuccess('Scrutin enregistré avec succès');
                AdminApp.loadEvents();
                document.getElementById('eventForm').reset();
                document.getElementById('evId').value = '';
            }).catch(function(err) {
                Utils.showError(err.message);
            });
        },

        editEvent: function(id) {
            // Need a GET /admin/events/:id but we'll use public endpoint for simplicity to fill form
            API.getEvent(id).then(function(e) {
                document.getElementById('evId').value = e.id;
                document.getElementById('evTitle').value = e.title;
                document.getElementById('evDesc').value = e.description || '';
                document.getElementById('evType').value = e.type || 'free';
                document.getElementById('evPrice').value = e.price_per_vote || 0;
                document.getElementById('evStatus').value = e.status || 'draft';
                if(e.closes_at) {
                    var dt = new Date(e.closes_at);
                    dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
                    document.getElementById('evClose').value = dt.toISOString().slice(0, 16);
                }
                
                document.getElementById('eventModalTitle').textContent = 'Modifier Événement';
                new bootstrap.Modal(document.getElementById('eventModal')).show();
            }).catch(function(err){ Utils.showError(err.message); });
        },

        deleteEvent: function(id) {
            if(!confirm("Êtes-vous sûr de vouloir supprimer cet événement ?")) return;
            this.request('/admin/events/' + id, 'DELETE').then(function() {
                Utils.showSuccess('Événement supprimé');
                AdminApp.loadEvents();
            }).catch(function(err){ Utils.showError(err.message); });
        },

        // ── CANDIDATES ──
        currentEventIdForCandidates: null,

        openCandidatesModal: function(eventId, eventTitle) {
            this.currentEventIdForCandidates = eventId;
            document.getElementById('candidatesListTitle').textContent = 'Candidats : ' + eventTitle;
            var grid = document.getElementById('adminCandidatesGrid');
            grid.innerHTML = '<div class="col-12 text-center py-4"><div class="spinner-border text-primary"></div></div>';
            new bootstrap.Modal(document.getElementById('candidatesListModal')).show();

            // L\'endpoint public getEvent retourne les candidats associés
            API.getEvent(eventId).then(function(e) {
                var cands = e.candidates || [];
                if(cands.length === 0) {
                    grid.innerHTML = '<div class="col-12 text-center py-4 text-muted">Aucun candidat pour ce scrutin</div>';
                    return;
                }
                var html = '';
                for(var i=0; i<cands.length; i++) {
                    var c = cands[i];
                    var photo = c.photo_url || 'img/default-avatar.png';
                    // We need to pass the object to editCandidate. Since it\'s in a string, we escape single quotes or store in a global map.
                    // A simpler way is to fetch the candidate by ID in editCandidate, but we can just serialize it.
                    var candJson = encodeURIComponent(JSON.stringify(c));
                    
                    html += '<div class="col-md-6 col-lg-4">' +
                        '<div class="bg-white rounded-4 shadow-sm p-3 text-center position-relative">' +
                            '<img src="' + photo + '" class="rounded-circle mb-3 object-fit-cover" style="width: 80px; height: 80px; border: 3px solid #f8f9fa;">' +
                            '<h6 class="fw-bold mb-1">' + Utils.sanitizeHTML(c.name) + '</h6>' +
                            '<div class="text-muted small mb-3">Dossard: ' + Utils.sanitizeHTML(c.dossard || 'N/A') + ' | Votes: ' + (c.vote_count || 0) + '</div>' +
                            '<div class="d-flex justify-content-center gap-2">' +
                                '<button class="btn btn-sm btn-outline-primary rounded-pill flex-fill" onclick="AdminApp.editCandidate(\'' + candJson + '\')">Modifier</button>' +
                                '<button class="btn btn-sm btn-outline-danger rounded-pill flex-fill" onclick="AdminApp.deleteCandidate(\'' + c.id + '\')">Supprimer</button>' +
                            '</div>' +
                        '</div>' +
                    '</div>';
                }
                grid.innerHTML = html;
            }).catch(function(err){ grid.innerHTML = '<div class="col-12 text-danger">' + err.message + '</div>'; });
        },

        openAddCandidateModal: function() {
            document.getElementById('candidateForm').reset();
            document.getElementById('candId').value = '';
            document.getElementById('candidateFormTitle').textContent = 'Nouveau Candidat';
            var m = document.getElementById('candidatesListModal');
            var bsM = bootstrap.Modal.getInstance(m);
            if(bsM) bsM.hide();
            new bootstrap.Modal(document.getElementById('candidateFormModal')).show();
        },

        editCandidate: function(candJsonEncoded) {
            var c = JSON.parse(decodeURIComponent(candJsonEncoded));
            document.getElementById('candidateForm').reset();
            document.getElementById('candId').value = c.id;
            document.getElementById('candName').value = c.name;
            document.getElementById('candDossard').value = c.dossard || '';
            document.getElementById('candBio').value = c.bio || '';
            document.getElementById('candidateFormTitle').textContent = 'Modifier Candidat';
            
            var m = document.getElementById('candidatesListModal');
            var bsM = bootstrap.Modal.getInstance(m);
            if(bsM) bsM.hide();
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
            if(fileInput.files.length > 0) {
                form.append('photo', fileInput.files[0]);
            }

            var btn = document.getElementById('candSaveBtn');
            Utils.disableButton(btn);

            var req = id 
                ? this.request('/admin/candidates/' + id, 'PUT', form) 
                : this.request('/admin/events/' + eventId + '/candidates', 'POST', form);

            req.then(function() {
                Utils.enableButton(btn);
                var modal = bootstrap.Modal.getInstance(document.getElementById('candidateFormModal'));
                if (modal) modal.hide();
                Utils.showSuccess('Candidat enregistré avec succès');
                // Reopen the list modal
                AdminApp.openCandidatesModal(eventId, document.getElementById('candidatesListTitle').textContent.replace('Candidats : ', ''));
            }).catch(function(err) {
                Utils.enableButton(btn);
                Utils.showError(err.message);
            });
        },

        deleteCandidate: function(id) {
            if(!confirm("Supprimer ce candidat ? Cette action est irréversible et supprimera ses votes !")) return;
            this.request('/admin/candidates/' + id, 'DELETE').then(function() {
                Utils.showSuccess('Candidat supprimé');
                var eventId = AdminApp.currentEventIdForCandidates;
                var title = document.getElementById('candidatesListTitle').textContent.replace('Candidats : ', '');
                AdminApp.openCandidatesModal(eventId, title);
            }).catch(function(err){ Utils.showError(err.message); });
        },

        // ── MODERATION ──
        loadModeration: function() {
            var grid = document.getElementById('adminModerationGrid');
            var status = document.getElementById('moderationFilter').value;
            grid.innerHTML = '<div class="col-12 text-center py-5"><div class="spinner-border text-primary"></div></div>';

            this.request('/admin/videos?status=' + status).then(function(data) {
                var videos = data.data || [];
                if(videos.length === 0) {
                    grid.innerHTML = '<div class="col-12 text-center py-5 text-muted">Aucune vidéo</div>';
                    return;
                }

                var html = '';
                for(var i=0; i<videos.length; i++) {
                    var v = videos[i];
                    
                    var actions = '';
                    if (status === 'pending_moderation') {
                        actions = '<button class="btn btn-success btn-sm flex-fill me-2" onclick="AdminApp.moderateVideo(\''+v.id+'\', \'approve\')">Approuver</button>' +
                                  '<button class="btn btn-danger btn-sm flex-fill" onclick="AdminApp.moderateVideo(\''+v.id+'\', \'reject\')">Rejeter</button>';
                    } else {
                        actions = '<button class="btn btn-outline-danger w-100 btn-sm" onclick="AdminApp.moderateVideo(\''+v.id+'\', \'delete\')">Supprimer définitivement</button>';
                    }

                    html += '<div class="col-md-6 col-lg-4">' +
                        '<div class="bg-white rounded-4 shadow-sm p-3">' +
                            '<div class="d-flex align-items-center mb-2">' +
                                '<span class="material-icons bg-light rounded-circle p-2 me-2">smart_display</span>' +
                                '<div><div class="fw-bold">' + Utils.sanitizeHTML(v.title || 'Sans titre') + '</div><div class="small text-muted">Par ' + Utils.sanitizeHTML(v.pseudo || 'Anonyme') + '</div></div>' +
                            '</div>' +
                            '<video src="' + v.video_url + '" class="img-fluid rounded mb-3 w-100 bg-dark" style="height:200px;object-fit:contain;" controls></video>' +
                            '<div class="d-flex">' + actions + '</div>' +
                        '</div>' +
                    '</div>';
                }
                grid.innerHTML = html;
            }).catch(function(err) {
                grid.innerHTML = '<div class="col-12 text-danger">' + err.message + '</div>';
            });
        },

        moderateVideo: function(id, action) {
            var method = action === 'delete' ? 'DELETE' : 'PATCH';
            var endpoint = '/admin/videos/' + id + (action === 'delete' ? '' : '/' + action);

            if(action === 'delete' && !confirm("Supprimer définitivement ?")) return;

            this.request(endpoint, method).then(function() {
                Utils.showSuccess('Action effectuée avec succès');
                AdminApp.loadModeration();
            }).catch(function(err){ Utils.showError(err.message); });
        },

        // ── TRANSACTIONS ──
        loadTransactions: function() {
            var tbody = document.getElementById('adminTransactionsTable');
            tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4"><div class="spinner-border text-primary"></div></td></tr>';

            this.request('/admin/transactions?limit=50').then(function(data) {
                var txs = data.data || [];
                var html = '';
                if(txs.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-muted">Aucune transaction trouvée</td></tr>';
                    return;
                }
                
                for(var i=0; i<txs.length; i++) {
                    var t = txs[i];
                    var statusBadge = '';
                    if(t.status === 'success') statusBadge = '<span class="badge bg-success">Succès</span>';
                    else if(t.status === 'failed') statusBadge = '<span class="badge bg-danger">Échec</span>';
                    else statusBadge = '<span class="badge bg-warning text-dark">Attente</span>';

                    html += '<tr>' +
                        '<td><span class="small text-muted font-monospace">' + t.reference + '</span></td>' +
                        '<td>' + (t.candidate ? Utils.sanitizeHTML(t.candidate.name) : '-') + '</td>' +
                        '<td class="fw-bold">' + Utils.formatNumber(t.amount) + '</td>' +
                        '<td>' + statusBadge + '</td>' +
                        '<td>' + Utils.formatDate(t.created_at) + '</td>' +
                    '</tr>';
                }
                tbody.innerHTML = html;
            }).catch(function(err) {
                tbody.innerHTML = '<tr><td colspan="5" class="text-danger">' + err.message + '</td></tr>';
            });
        }
    };

    window.AdminApp = AdminApp;
    document.addEventListener("DOMContentLoaded", function() { AdminApp.init(); });

})();
