package handlers

import (
	"encoding/json"
	"io"
	"log"
	"net/http"
	"os"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/univote/backend/internal/models"
	"github.com/univote/backend/internal/services"
)

type WebhookVideoHandler struct {
	VideoService *services.VideoService
	CldService   *services.CloudinaryService
}

func NewWebhookVideoHandler(vs *services.VideoService, cld *services.CloudinaryService) *WebhookVideoHandler {
	return &WebhookVideoHandler{VideoService: vs, CldService: cld}
}

// HandleVideoReady gère le webhook envoyé par Cloudinary après upload ou modération.
func (h *WebhookVideoHandler) HandleVideoReady(c *gin.Context) {
	// 1. Lire le body raw pour valider la signature HMAC
	payloadBytes, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "failed to read body"})
		return
	}

	signature := c.GetHeader("X-Cld-Signature")
	timestamp := c.GetHeader("X-Cld-Timestamp")

	if signature == "" || timestamp == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing signature headers"})
		return
	}

	// 2. Validation de la signature Cloudinary
	if !h.CldService.ValidateWebhookSignature(payloadBytes, signature, timestamp) {
		log.Println("❌ Webhook Cloudinary signature invalide")
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid signature"})
		return
	}

	// 3. Parsing du payload JSON
	var payload services.WebhookPayload
	if err := json.Unmarshal(payloadBytes, &payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid json payload"})
		return
	}

	// Récupérer la vidéo correspondante en BDD
	var video models.Video
	videoFound := false

	// 1. Essayer par pending_video_id (depuis le context Cloudinary)
	if payload.Context.Custom.PendingVideoID != "" {
		if err := h.VideoService.DB.First(&video, "id = ?", payload.Context.Custom.PendingVideoID).Error; err == nil {
			videoFound = true
		}
	}

	// 2. Fallback par public_id si non trouvé
	if !videoFound {
		if err := h.VideoService.DB.First(&video, "cloudinary_public_id = ?", payload.PublicID).Error; err == nil {
			videoFound = true
		}
	}

	if !videoFound {
		log.Printf("⚠️ Webhook: vidéo non trouvée (PublicID: %s, PendingID: %s)", payload.PublicID, payload.Context.Custom.PendingVideoID)
		// On ne peut pas continuer sans vidéo
		c.JSON(http.StatusOK, gin.H{"status": "ignored_no_video"})
		return
	}

	// Mettre à jour le PublicID s'il n'est pas encore défini
	if video.CloudinaryPublicID == "" {
		h.VideoService.DB.Model(&video).Update("cloudinary_public_id", payload.PublicID)
	}

	// Vérification de la durée (uniquement pour les vidéos)
	if video.Type == "video" && payload.Duration > 0 {
		maxDurationStr := os.Getenv("VIDEO_MAX_DURATION_SECONDS")
		maxDuration, _ := strconv.ParseFloat(maxDurationStr, 64)
		if maxDuration == 0 {
			maxDuration = 120
		}
		if payload.Duration > maxDuration {
			h.VideoService.RejectVideo(c.Request.Context(), video.ID.String(), "video_too_long")
			c.JSON(http.StatusOK, gin.H{"status": "rejected_too_long"})
			return
		}
	}

	// 4. Traitement selon le type de notification
	if payload.NotificationType == "moderation" {
		approved, reason := h.CldService.ParseModerationResult(&payload)
		// Si c'est une image, on met à jour l'URL immédiatement car il n'y a pas d'étape 'eager'
		if video.Type == "image" {
			h.VideoService.DB.Model(&video).Update("cloudinary_url", payload.SecureURL)
		}

		if approved {
			h.VideoService.ApproveVideo(c.Request.Context(), video.ID.String(), models.JSON{"reason": "ai_approved"})
		} else {
			h.VideoService.RejectVideo(c.Request.Context(), video.ID.String(), reason)
		}
	} else if payload.NotificationType == "eager" {
		if len(payload.Eager) > 0 {
			h.VideoService.DB.Model(&video).Update("cloudinary_url", payload.Eager[0].SecureURL)
		}
	} else if payload.NotificationType == "upload" {
		// Pour les images, l'URL est dispo dès l'upload
		if video.Type == "image" {
			h.VideoService.DB.Model(&video).Update("cloudinary_url", payload.SecureURL)
		}
	}

	// Toujours répondre 200 OK pour Cloudinary
	c.JSON(http.StatusOK, gin.H{"status": "processed"})
}
