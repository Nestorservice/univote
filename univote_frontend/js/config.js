/**
 * Configuration globale de l'application UNI-VOTE Frontend
 */
const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_URL = isLocalhost ? 'http://localhost:8080/api/v1' : 'https://univote-api.onrender.com/api/v1';
const WS_URL = isLocalhost ? 'ws://localhost:8080/ws' : 'wss://univote-api.onrender.com/ws';

const CONFIG = {
    // Endpoints du backend
    API_BASE: API_URL,
    WS_BASE: WS_URL,
    
    // Timeout global pour les requêtes (10s)
    TIMEOUT_MS: 10000,
    
    // Devise par défaut
    CURRENCY: 'FCFA',
    
    // Configuration des opérateurs Mobile Money au Cameroun
    OPERATORS: {
        mtn: { 
            id: 'mtn',
            name: 'MTN Mobile Money', 
            color: '#ffcc00', // Jaune MTN
            textColor: '#000000',
            // Regex simplifiée pour MTN Cameroun
            pattern: /^(67[0-9]|65[0-4]|68[0-9])/ 
        },
        orange: { 
            id: 'orange',
            name: 'Orange Money', 
            color: '#ff6600', // Orange 
            textColor: '#ffffff',
            // Regex simplifiée pour Orange Cameroun
            pattern: /^(69[0-9]|65[5-9])/ 
        }
    }
};
