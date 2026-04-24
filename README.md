# 🗳️ UNI-VOTE — Plateforme de Vote Institutionnelle

> Système de vote en ligne pour universités camerounaises, avec paiement Mobile Money (Orange Money & MTN MoMo).

---

## 📋 Table des matières

- [Aperçu](#-aperçu)
- [Stack technique](#-stack-technique)
- [Prérequis](#-prérequis)
- [Installation rapide](#-installation-rapide)
- [Structure du projet](#-structure-du-projet)
- [Variables d'environnement](#-variables-denvironnement)
- [Déploiement production](#-déploiement-production)

---

## 🎯 Aperçu

UNI-VOTE est une plateforme web complète permettant d'organiser des scrutins institutionnels :
- **Miss/Master Campus** — Élections de beauté
- **Délégués de classe** — Représentants étudiants
- **Awards** — Récompenses diverses

### Fonctionnalités clés
- ✅ Gestion complète des événements et candidats
- ✅ Vote payant via Mobile Money (Orange Money & MTN MoMo)
- ✅ Résultats en temps réel via WebSocket
- ✅ Dashboard administrateur avec statistiques
- ✅ Sécurité renforcée (JWT, HMAC, rate limiting)
- ✅ Architecture containerisée (Docker)

---

## 🛠️ Stack technique

| Composant | Technologie |
|-----------|-------------|
| **Backend** | Go 1.22+ / Gin / GORM |
| **Frontend** | Next.js 15 / Tailwind CSS v4 / Recharts |
| **Base de données** | PostgreSQL 16 |
| **Cache** | Redis 7 |
| **Paiement** | Notch Pay (Mobile Money) |
| **Reverse Proxy** | Nginx |
| **Containerisation** | Docker + Docker Compose |
| **SSL** | Certbot / Let's Encrypt |

---

## 📦 Prérequis

- [Docker](https://docs.docker.com/get-docker/) (v24+)
- [Docker Compose](https://docs.docker.com/compose/install/) (v2+)
- Un compte [Notch Pay](https://notchpay.co) pour les paiements

---

## 🚀 Installation rapide

### 1. Cloner le projet
```bash
git clone https://github.com/votre-repo/univote.git
cd univote
```

### 2. Configurer les variables d'environnement
```bash
cp .env.example .env
# Éditer .env avec vos valeurs (JWT_SECRET, Notch Pay keys, etc.)
```

### 3. Lancer en mode développement
```bash
docker compose up --build
```

### 4. Accéder à l'application
| Service | URL |
|---------|-----|
| **Application** | http://localhost |
| **API** | http://localhost/api/v1 |
| **Health Check** | http://localhost:8080/health |

---

## 📁 Structure du projet

```
univote/
├── backend/                    # API Go (Gin)
│   ├── cmd/server/main.go      # Point d'entrée
│   ├── internal/
│   │   ├── config/             # Chargement .env
│   │   ├── database/           # Connexion PostgreSQL + GORM
│   │   ├── cache/              # Connexion Redis
│   │   ├── models/             # Structs GORM
│   │   ├── handlers/           # Gin handlers
│   │   ├── middleware/         # JWT, CORS, rate limiter
│   │   ├── services/           # Logique métier
│   │   └── websocket/          # Hub WebSocket
│   ├── migrations/             # Migrations SQL
│   ├── Dockerfile
│   └── go.mod
│
├── frontend/                   # Next.js 15
│   ├── app/                    # App Router pages
│   ├── components/             # Composants réutilisables
│   ├── lib/                    # API client, utils, types
│   ├── hooks/                  # Custom hooks
│   ├── Dockerfile
│   └── package.json
│
├── nginx/
│   └── nginx.conf              # Reverse proxy
│
├── docker-compose.yml          # Orchestration dev
├── docker-compose.prod.yml     # Override production
├── .env.example                # Template variables
└── README.md
```

---

## 🔐 Variables d'environnement

| Variable | Description | Exemple |
|----------|-------------|---------|
| `DATABASE_URL` | URL PostgreSQL | `postgres://univote:pass@postgres:5432/univote_db` |
| `REDIS_URL` | URL Redis | `redis://redis:6379` |
| `JWT_SECRET` | Clé secrète JWT (min 32 chars) | `votre_secret_très_long` |
| `NOTCHPAY_PUBLIC_KEY` | Clé publique Notch Pay | `pk_test_xxx` |
| `NOTCHPAY_SECRET_KEY` | Clé secrète Notch Pay | `sk_test_xxx` |
| `NOTCHPAY_WEBHOOK_SECRET` | Secret webhook Notch Pay | `whsec_xxx` |
| `FRONTEND_URL` | URL du frontend | `http://localhost:3000` |

---

## 🌐 Déploiement Production

### Sur Ubuntu 22.04 LTS

```bash
# 1. Configurer le .env de production
cp .env.example .env
nano .env  # Mettre les vraies valeurs

# 2. Lancer avec le profil production
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# 3. Obtenir un certificat SSL (remplacer par votre domaine)
docker compose -f docker-compose.yml -f docker-compose.prod.yml run --rm certbot \
  certonly --webroot -w /var/www/certbot \
  -d vote.universite.cm \
  --email admin@universite.cm \
  --agree-tos --no-eff-email

# 4. Activer la configuration HTTPS dans nginx/nginx.conf
# Décommenter le bloc server HTTPS et relancer nginx
docker compose -f docker-compose.yml -f docker-compose.prod.yml restart nginx
```

### Commandes utiles
```bash
# Voir les logs
docker compose logs -f backend
docker compose logs -f frontend

# Redémarrer un service
docker compose restart backend

# Accéder à PostgreSQL
docker compose exec postgres psql -U univote -d univote_db

# Accéder à Redis
docker compose exec redis redis-cli
```

---

## 📄 Licence

Projet propriétaire — Tous droits réservés.

---

<p align="center">
  Développé avec ❤️ pour les universités camerounaises
</p>
