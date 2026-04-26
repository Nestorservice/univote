# Étape 1 : Builder le backend Go
FROM golang:1.23-alpine AS builder

RUN apk add --no-cache git

WORKDIR /app/backend

# Copier tout le code backend d'un coup
COPY backend/ ./

# Forcer le toolchain local et rebuild les modules
ENV GOTOOLCHAIN=local
ENV GONOSUMCHECK=*
ENV GOFLAGS=-mod=mod

RUN go mod tidy && go get github.com/gin-contrib/gzip
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
