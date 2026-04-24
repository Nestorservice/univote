package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/univote/backend/internal/cache"
	"github.com/univote/backend/internal/models"
	"github.com/univote/backend/internal/services"
)

type VideoHandler struct {
	VideoService *services.VideoService
}

func NewVideoHandler(vs *services.VideoService) *VideoHandler {
	return &VideoHandler{VideoService: vs}
}

// ─── Routes Publiques ────────────────────────────────────────────────────────

// GetFeed retourne le flux de vidéos paginé.
func (h *VideoHandler) GetFeed(c *gin.Context) {
	eventID := c.Param("id")
	sort := c.DefaultQuery("sort", "recent")
	cursorStr := c.DefaultQuery("cursor", "0")
	limitStr := c.DefaultQuery("limit", "10")

	cursor, _ := strconv.ParseInt(cursorStr, 10, 64)
	limit, _ := strconv.Atoi(limitStr)
	if limit > 20 {
		limit = 20
	}

	var videos []interface{} // ou models.VideoMeta, mais on garde interface{} pour flexibilité
	var nextCursor int64
	var err error

	if sort == "popular" {
		var vids []models.VideoMeta
		vids, nextCursor, err = cache.GetPopularFeed(c.Request.Context(), eventID, cursor, limit)
		for _, v := range vids {
			videos = append(videos, v)
		}
	} else {
		var vids []models.VideoMeta
		vids, nextCursor, err = cache.GetRecentFeed(c.Request.Context(), eventID, cursor, limit)
		for _, v := range vids {
			videos = append(videos, v)
		}
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	// Si le cache est vide (cold start), une implémentation complète ferait un fallback PostgreSQL.
	// Pour l'instant, on assume que les goroutines de sync ou l'upload remplissent le cache.

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"videos":      videos,
			"next_cursor": nextCursor,
			"has_more":    nextCursor != -1,
		},
	})
}

// GetComments retourne les commentaires d'une vidéo.
func (h *VideoHandler) GetComments(c *gin.Context) {
	videoID := c.Param("id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset := (page - 1) * limit

	var comments []models.VideoComment
	h.VideoService.DB.Where("video_id = ?", videoID).Order("created_at DESC").Offset(offset).Limit(limit).Find(&comments)

	c.JSON(http.StatusOK, gin.H{"success": true, "data": comments})
}

// LikeVideo ajoute un like à une vidéo.
func (h *VideoHandler) LikeVideo(c *gin.Context) {
	videoID := c.Param("id")
	var req struct {
		Pseudo string `json:"pseudo" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
		return
	}

	newCount, alreadyLiked, err := h.VideoService.IncrementLike(c.Request.Context(), videoID, req.Pseudo)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"like_count":    newCount,
			"already_liked": alreadyLiked,
		},
	})
}

// AddComment ajoute un commentaire à une vidéo.
func (h *VideoHandler) AddComment(c *gin.Context) {
	videoID := c.Param("id")
	var req struct {
		Pseudo  string `json:"pseudo" binding:"required"`
		Content string `json:"content" binding:"required,max=300"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
		return
	}

	// On doit trouver l'event_id de la video
	var video models.Video
	if err := h.VideoService.DB.Select("event_id").First(&video, "id = ?", videoID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "video not found"})
		return
	}

	comment, err := h.VideoService.AddComment(c.Request.Context(), videoID, video.EventID.String(), req.Pseudo, req.Content)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": comment})
}

// ─── Routes Admin ────────────────────────────────────────────────────────────

func (h *VideoHandler) AdminListVideos(c *gin.Context) {
	var filters services.AdminVideoFilters
	if err := c.ShouldBindQuery(&filters); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
		return
	}

	videos, total, err := h.VideoService.AdminListVideos(filters)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    videos,
		"total":   total,
		"page":    filters.Page,
		"limit":   filters.Limit,
	})
}

func (h *VideoHandler) AdminGetVideoDetail(c *gin.Context) {
	videoID := c.Param("id")
	var video models.Video
	if err := h.VideoService.DB.Preload("Candidate").First(&video, "id = ?", videoID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "video not found"})
		return
	}

	reports, _ := h.VideoService.GetVideoReports(videoID)
	
	// Limiter à 5 comments pour l'aperçu admin
	var comments []models.VideoComment
	h.VideoService.DB.Where("video_id = ?", videoID).Order("created_at DESC").Limit(5).Find(&comments)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"video":    video,
			"reports":  reports,
			"comments": comments,
		},
	})
}

func (h *VideoHandler) AdminGetVideoStats(c *gin.Context) {
	eventID := c.Query("event_id")
	stats, err := h.VideoService.GetVideoStats(eventID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": stats})
}

func (h *VideoHandler) AdminApproveVideo(c *gin.Context) {
	videoID := c.Param("id")
	adminID := c.GetString("user_id") // set par middleware auth

	if err := h.VideoService.AdminApproveVideo(c.Request.Context(), videoID, adminID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

func (h *VideoHandler) AdminRejectVideo(c *gin.Context) {
	videoID := c.Param("id")
	adminID := c.GetString("user_id")
	var req struct {
		Reason string `json:"reason" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
		return
	}

	if err := h.VideoService.AdminRejectVideo(c.Request.Context(), videoID, adminID, req.Reason); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

func (h *VideoHandler) AdminDeleteVideo(c *gin.Context) {
	videoID := c.Param("id")
	adminID := c.GetString("user_id")

	if err := h.VideoService.AdminDeleteVideo(c.Request.Context(), videoID, adminID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

