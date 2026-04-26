# Étape 1 : Builder le backend Go
FROM golang:1.23-alpine AS builder

WORKDIR /app
# Copier les fichiers du backend
COPY backend/go.mod backend/go.sum ./backend/
WORKDIR /app/backend
RUN go mod download

# Copier le reste du code backend
COPY backend/ ./
# Compiler l'application Go
RUN go get github.com/gin-contrib/gzip
RUN CGO_ENABLED=0 GOOS=linux go build -o /univote-api ./cmd/server

# Étape 2 : Image finale légère
FROM alpine:latest

# Installer les certificats SSL nécessaires pour les requêtes HTTP (NotchPay, etc.)
RUN apk --no-cache add ca-certificates

WORKDIR /app

# Copier le binaire compilé depuis l'étape 1
COPY --from=builder /univote-api ./univote-api

# Copier le dossier frontend statique pour que le backend puisse le servir
COPY univote_frontend/ ./univote_frontend/

# Créer le dossier uploads pour les vidéos/images
RUN mkdir -p ./uploads

# Le port est injecté par Railway via la variable d'environnement PORT
EXPOSE 8080

# Lancer l'API
CMD ["./univote-api"]
