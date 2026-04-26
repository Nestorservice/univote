/*
 * UNI-VOTE - WebSocket
 * WebSocket pour scores live avec reconnexion auto (backoff exponentiel)
 */

(function () {
    "use strict";

    var WebSocketClient = {
        ws: null,
        eventId: null,
        reconnectAttempts: 0,
        maxReconnectAttempts: 10,
        baseDelay: 1000,
        maxDelay: 30000,
        onMessage: null,
        onConnect: null,
        onDisconnect: null,
        onError: null,
        timer: null,

        connect: function (eventId) {
            this.eventId = eventId;
            this.disconnect();
            this.reconnectAttempts = 0;
            this.doConnect();
        },

        doConnect: function () {
            var self = this;
            var wsBase = (typeof CONFIG !== 'undefined' && CONFIG.WS_BASE)
                ? CONFIG.WS_BASE
                : 'ws://localhost:8080/ws';
            var url = wsBase + '/events/' + this.eventId + '/scores';
            try {
                this.ws = new WebSocket(url);
                this.ws.onopen = function () {
                    self.reconnectAttempts = 0;
                    if (self.onConnect) self.onConnect();
                };
                this.ws.onmessage = function (event) {
                    try {
                        var data = JSON.parse(event.data);
                        if (self.onMessage) self.onMessage(data);
                    } catch (e) {
                        console.error('WS parse error:', e);
                    }
                };
                this.ws.onerror = function (error) {
                    if (self.onError) self.onError(error);
                };
                this.ws.onclose = function () {
                    if (self.onDisconnect) self.onDisconnect();
                    self.scheduleReconnect();
                };
            } catch (e) {
                console.error('WebSocket error:', e);
                this.scheduleReconnect();
            }
        },

        scheduleReconnect: function () {
            if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                return;
            }
            var self = this;
            var delay = Math.min(this.baseDelay * Math.pow(2, this.reconnectAttempts), this.maxDelay);
            this.reconnectAttempts++;
            this.timer = setTimeout(function () {
                self.doConnect();
            }, delay);
        },

        disconnect: function () {
            if (this.timer) {
                clearTimeout(this.timer);
                this.timer = null;
            }
            if (this.ws) {
                this.ws.onclose = null;
                this.ws.close();
                this.ws = null;
            }
        },

        send: function (data) {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify(data));
            }
        },

        isConnected: function () {
            return this.ws && this.ws.readyState === WebSocket.OPEN;
        }
    };

    window.WebSocketClient = WebSocketClient;

})();