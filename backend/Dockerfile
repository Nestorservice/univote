# ╔══════════════════════════════════════════════════════════════╗
# ║              UNI-VOTE Backend — Multi-stage Build           ║
# ╚══════════════════════════════════════════════════════════════╝

# ─── Stage 1: Build ─────────────────────────────────────────────
FROM golang:1.22-alpine AS builder

RUN apk add --no-cache gcc musl-dev

WORKDIR /build

# Copier les fichiers de dépendances en premier (cache Docker)
COPY go.mod go.sum ./
RUN go mod download

# Copier le code source
COPY . .

# Compiler le binaire statique
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -ldflags="-w -s" \
    -o /build/univote-api \
    ./cmd/server/main.go

# ─── Stage 2: Run ───────────────────────────────────────────────
FROM alpine:3.19

RUN apk add --no-cache ca-certificates tzdata

# Timezone Afrique Centrale
ENV TZ=Africa/Douala

WORKDIR /app

# Créer le dossier uploads pour les photos
RUN mkdir -p /app/uploads && \
    addgroup -S appgroup && \
    adduser -S appuser -G appgroup && \
    chown -R appuser:appgroup /app

# Copier le binaire depuis le stage builder
COPY --from=builder /build/univote-api /app/univote-api

# Copier les migrations
COPY --from=builder /build/migrations /app/migrations

USER appuser

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

CMD ["/app/univote-api"]
