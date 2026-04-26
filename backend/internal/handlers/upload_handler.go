package handlers

import (
	"net/http"
	"regexp"

	"github.com/gin-gonic/gin"
	"github.com/univote/backend/internal/services"
)

type UploadHandler struct {
	VideoService *services.VideoService
	CldService   *services.CloudinaryService
}

func NewUploadHandler(vs *services.VideoService, cld *services.CloudinaryService) *UploadHandler {
	return &UploadHandler{VideoService: vs, CldService: cld}
}

type UploadRequest struct {
	EventID     string `json:"event_id" binding:"required,uuid"`
	CandidateID string `json:"candidate_id,omitempty" binding:"omitempty,uuid"`
	Pseudo      string `json:"pseudo" binding:"required,min=2,max=50"`
	Title       string `json:"title" binding:"max=100"`
	Type        string `json:"type" binding:"omitempty,oneof=video image"`
}

var pseudoRegex = regexp.MustCompile(`^[a-zA-Z0-9_\-\.\ àâäéèêëîïôùûüç]{2,50}$`)

// RequestSignedURL génère une URL Cloudinary signée pour uploader une vidéo.
func (h *UploadHandler) RequestSignedURL(c *gin.Context) {
	var req UploadRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
		return
	}

	if !pseudoRegex.MatchString(req.Pseudo) {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "format de pseudo invalide"})
		return
	}

	if req.Type == "" {
		req.Type = "video"
	}

	// 1. Création de la vidéo en statut pending_moderation d'abord pour avoir l'ID
	pendingVideo, err := h.VideoService.CreatePendingVideo(services.CreateVideoDTO{
		EventID:     req.EventID,
		CandidateID: req.CandidateID,
		Pseudo:      req.Pseudo,
		Title:       req.Title,
		Type:        req.Type,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "failed to create pending video record"})
		return
	}

	// 2. Génération de la signature d'upload avec l'ID de la vidéo dans le contexte
	sigResult, err := h.CldService.GenerateSignedUploadURL(req.EventID, req.Type, pendingVideo.ID.String())
	if err != nil {
		// Nettoyage si la signature échoue
		h.VideoService.DB.Delete(pendingVideo)
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "failed to generate signature"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"upload_url":       sigResult.UploadURL,
			"signature":        sigResult.Signature,
			"timestamp":        sigResult.Timestamp,
			"api_key":          sigResult.APIKey,
			"cloud_name":       sigResult.CloudName,
			"folder":           sigResult.Folder,
			"pending_video_id": pendingVideo.ID.String(),
		},
	})
}
