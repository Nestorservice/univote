package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/univote/backend/internal/services"
)

type ReportHandler struct {
	VideoService *services.VideoService
}

func NewReportHandler(vs *services.VideoService) *ReportHandler {
	return &ReportHandler{VideoService: vs}
}

type ReportRequest struct {
	VideoID string `json:"video_id" binding:"required,uuid"`
	Pseudo  string `json:"pseudo" binding:"required,min=2,max=50"`
	Reason  string `json:"reason" binding:"required,oneof=inappropriate spam violence other"`
}

// ReportVideo enregistre le signalement d'une vidéo.
func (h *ReportHandler) ReportVideo(c *gin.Context) {
	var req ReportRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
		return
	}

	hidden, err := h.VideoService.ReportVideo(c.Request.Context(), req.VideoID, req.Pseudo, req.Reason)
	if err != nil {
		// On ne veut pas fuité d'erreurs (ex: duplicate key) à l'utilisateur
		c.JSON(http.StatusOK, gin.H{"success": true, "video_hidden": false})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":      true,
		"video_hidden": hidden,
	})
}
