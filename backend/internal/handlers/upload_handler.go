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

	// Génération de la signature d'upload
	sigResult, err := h.CldService.GenerateSignedUploadURL(req.EventID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "failed to generate signature"})
		return
	}

	// Création de la vidéo en statut pending_moderation
	pendingVideo, err := h.VideoService.CreatePendingVideo(services.CreateVideoDTO{
		EventID:     req.EventID,
		CandidateID: req.CandidateID,
		Pseudo:      req.Pseudo,
		Title:       req.Title,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": "failed to create pending video record"})
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
