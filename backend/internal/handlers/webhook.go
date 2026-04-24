package handlers

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"github.com/univote/backend/internal/models"
	ws "github.com/univote/backend/internal/websocket"
	"gorm.io/gorm"
)

// WebhookHandler gère les webhooks Notch Pay.
type WebhookHandler struct {
	DB            *gorm.DB
	Redis         *redis.Client
	WebhookSecret string
	WSHub         *ws.Hub
}

// NewWebhookHandler crée un nouveau WebhookHandler.
func NewWebhookHandler(db *gorm.DB, redisClient *redis.Client, secret string, hub *ws.Hub) *WebhookHandler {
	return &WebhookHandler{DB: db, Redis: redisClient, WebhookSecret: secret, WSHub: hub}
}

// HandleNotchPay traite les webhooks Notch Pay.
// POST /api/v1/webhooks/notchpay
func (h *WebhookHandler) HandleNotchPay(c *gin.Context) {
	// Lire le body brut
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "impossible de lire le body"})
		return
	}

	// Vérifier la signature HMAC-SHA256
	signature := c.GetHeader("X-Notch-Signature")
	if !h.verifySignature(body, signature) {
		log.Printf("⚠️  Webhook Notch Pay: signature invalide")
		c.JSON(http.StatusUnauthorized, gin.H{"error": "signature invalide"})
		return
	}

	// Parser le payload
	var payload struct {
		Event string `json:"event"`
		Data  struct {
			Reference string `json:"reference"`
			Status    string `json:"status"`
			Amount    int    `json:"amount"`
		} `json:"data"`
	}

	if err := c.ShouldBindJSON(&payload); err != nil {
		// Re-bind since we read body already - parse from body bytes
		c.JSON(http.StatusBadRequest, gin.H{"error": "payload invalide"})
		return
	}

	// Chercher la transaction par référence Notch Pay
	var transaction models.Transaction
	if err := h.DB.Where("notchpay_ref = ?", payload.Data.Reference).First(&transaction).Error; err != nil {
		// Essayer par idempotency key
		if err := h.DB.Where("idempotency_key = ?", payload.Data.Reference).First(&transaction).Error; err != nil {
			log.Printf("⚠️  Transaction introuvable: ref=%s", payload.Data.Reference)
			c.JSON(http.StatusOK, gin.H{"status": "ignored"})
			return
		}
	}

	// Vérifier l'idempotence
	if transaction.WebhookVerified {
		log.Printf("ℹ️  Transaction déjà traitée: %s", transaction.ID)
		c.JSON(http.StatusOK, gin.H{"status": "already_processed"})
		return
	}

	if payload.Data.Status == "complete" || payload.Data.Status == "success" {
		// Mettre à jour la transaction
		h.DB.Model(&transaction).Updates(map[string]interface{}{
			"status":           "success",
			"webhook_verified": true,
		})

		// Incrémenter le compteur Redis (atomique)
		ctx := context.Background()
		redisKey := fmt.Sprintf("votes:candidate:%s", transaction.CandidateID.String())
		newCount, _ := h.Redis.IncrBy(ctx, redisKey, int64(transaction.VoteCount)).Result()

		// Mettre à jour PostgreSQL (non-bloquant)
		go func() {
			h.DB.Model(&models.Candidate{}).
				Where("id = ?", transaction.CandidateID).
				Update("vote_count", gorm.Expr("vote_count + ?", transaction.VoteCount))
		}()

		// Broadcast WebSocket
		if h.WSHub != nil {
			h.WSHub.BroadcastToEvent(transaction.EventID.String(), models.WebSocketMessage{
				CandidateID: transaction.CandidateID.String(),
				VoteCount:   int(newCount),
				EventID:     transaction.EventID.String(),
				Timestamp:   fmt.Sprintf("%d", transaction.CreatedAt.Unix()),
			})
		}

		log.Printf("✅ Vote comptabilisé: candidat=%s votes=%d total=%d",
			transaction.CandidateID, transaction.VoteCount, newCount)
	} else if payload.Data.Status == "failed" || payload.Data.Status == "expired" {
		h.DB.Model(&transaction).Update("status", "failed")
		log.Printf("❌ Paiement échoué: ref=%s", payload.Data.Reference)
	}

	c.JSON(http.StatusOK, gin.H{"status": "received"})
}

// verifySignature vérifie la signature HMAC-SHA256 du webhook.
func (h *WebhookHandler) verifySignature(body []byte, signature string) bool {
	if h.WebhookSecret == "" || signature == "" {
		return false
	}

	mac := hmac.New(sha256.New, []byte(h.WebhookSecret))
	mac.Write(body)
	expectedMAC := hex.EncodeToString(mac.Sum(nil))

	return hmac.Equal([]byte(expectedMAC), []byte(signature))
}
