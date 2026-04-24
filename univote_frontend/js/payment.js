/*
 * UNI-VOTE - Payment
 * Flux de paiement Mobile Money: initiate -> polling (3s/60s timeout)
 */

(function () {
    "use strict";

    var Payment = {
        currentRef: null,
        pollingTimer: null,
        onStatusChange: null,
        onSuccess: null,
        onError: null,
        MAX_POLLING_TIME: 60000,
        POLLING_INTERVAL: 3000,

        initiate: function (candidateId, phone, voteCount, onStatusChange, onSuccess, onError) {
            this.onStatusChange = onStatusChange;
            this.onSuccess = onSuccess;
            this.onError = onError;
            this.stopPolling();

            if (this.onStatusChange) this.onStatusChange('initiation');

            var self = this;
            API.initiateVote(candidateId, phone, voteCount).then(function (data) {
                self.currentRef = data.reference;
                if (self.onStatusChange) self.onStatusChange('pending', data);
                self.startPolling();
            }).catch(function (error) {
                if (self.onError) self.onError(error.message);
            });
        },

        startPolling: function () {
            var self = this;
            var startTime = Date.now();
            this.pollingTimer = setInterval(function () {
                if (Date.now() - startTime > self.MAX_POLLING_TIME) {
                    self.stopPolling();
                    if (self.onError) self.onError('Delai de paiement depasse. Veuillez reessayer.');
                    return;
                }
                self.checkStatus();
            }, this.POLLING_INTERVAL);
        },

        checkStatus: function () {
            var self = this;
            if (!this.currentRef) return;
            API.getTransactionStatus(this.currentRef).then(function (data) {
                var status = data.status;
                if (status === 'success') {
                    self.stopPolling();
                    if (self.onSuccess) self.onSuccess(data);
                } else if (status === 'failed') {
                    self.stopPolling();
                    if (self.onError) self.onError('Paiement echoue. Veuillez reessayer.');
                } else if (status === 'pending') {
                    if (self.onStatusChange) self.onStatusChange('pending', data);
                }
            }).catch(function (error) {
                console.error('Status check error:', error);
            });
        },

        stopPolling: function () {
            if (this.pollingTimer) {
                clearInterval(this.pollingTimer);
                this.pollingTimer = null;
            }
        },

        getOperatorDisplay: function (operator) {
            if (operator === 'orange') {
                return '<span class="badge bg-warning text-dark"><span class="material-icons md-16 me-1">phone_android</span>Orange</span>';
            } else if (operator === 'mtn') {
                return '<span class="badge bg-warning"><span class="material-icons md-16 me-1">phone_android</span>MTN</span>';
            }
            return '<span class="badge bg-secondary">Inconnu</span>';
        },

        getInstructionText: function (operator) {
            if (operator === 'orange') {
                return 'Un code USSD va s\'afficher sur votre telephone Orange. Validez pour confirmer le paiement de ' + this.amount + ' FCA.';
            } else if (operator === 'mtn') {
                return 'Un code USSD va s\'afficher sur votre telephone MTN. Validez pour confirmer le paiement de ' + this.amount + ' FCA.';
            }
            return 'Veuillez confirmer le paiement sur votre telephone.';
        }
    };

    window.Payment = Payment;

})();