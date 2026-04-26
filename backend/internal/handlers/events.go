package handlers

import (
	"context"
	"fmt"
	"io"
	"math"
	"net/http"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/univote/backend/internal/models"
	"github.com/univote/backend/internal/services"
	"gorm.io/gorm"
)

// EventHandler gère les opérations sur les événements.
type EventHandler struct {
	DB         *gorm.DB
	CldService *services.CloudinaryService
}

// NewEventHandler crée un nouveau EventHandler.
func NewEventHandler(db *gorm.DB, cldService *services.CloudinaryService) *EventHandler {
	return &EventHandler{DB: db, CldService: cldService}
}

// ListPublicEvents retourne les événements publics.
// GET /api/v1/events
func (h *EventHandler) ListPublicEvents(c *gin.Context) {
	var pagination models.PaginationQuery
	if err := c.ShouldBindQuery(&pagination); err != nil {
		pagination.Page = 1
		pagination.Limit = 20
	}

	status := c.Query("status")
	var events []models.Event
	var total int64

	query := h.DB.Model(&models.Event{})
	switch status {
	case "open":
		query = query.Where("status = ?", "open")
	case "closed":
		query = query.Where("status = ?", "closed")
	default:
		query = query.Where("status IN ?", []string{"open", "closed"})
	}

	query.Count(&total)
	offset := (pagination.Page - 1) * pagination.Limit
	query.Preload("Candidates").Order("created_at DESC").Offset(offset).Limit(pagination.Limit).Find(&events)

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data: models.PaginatedResponse{
			Data: events, Total: total, Page: pagination.Page,
			Limit: pagination.Limit, TotalPages: int(math.Ceil(float64(total) / float64(pagination.Limit))),
		},
	})
}

// GetPublicEvent retourne un événement avec ses candidats.
// GET /api/v1/events/:id
func (h *EventHandler) GetPublicEvent(c *gin.Context) {
	id := c.Param("id")
	if _, err := uuid.Parse(id); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: "ID invalide"})
		return
	}

	var event models.Event
	if err := h.DB.Preload("Candidates", func(db *gorm.DB) *gorm.DB {
		return db.Order("vote_count DESC")
	}).Where("id = ? AND status IN ?", id, []string{"open", "closed"}).First(&event).Error; err != nil {
		c.JSON(http.StatusNotFound, models.APIResponse{Success: false, Error: "Événement introuvable"})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: event})
}

// GetEventResults retourne les résultats si show_results=true.
// GET /api/v1/events/:id/results
func (h *EventHandler) GetEventResults(c *gin.Context) {
	id := c.Param("id")
	var event models.Event
	if err := h.DB.Where("id = ?", id).First(&event).Error; err != nil {
		c.JSON(http.StatusNotFound, models.APIResponse{Success: false, Error: "Événement introuvable"})
		return
	}
	if !event.ShowResults {
		c.JSON(http.StatusForbidden, models.APIResponse{Success: false, Error: "Résultats non disponibles"})
		return
	}

	var candidates []models.Candidate
	h.DB.Where("event_id = ?", id).Order("vote_count DESC").Find(&candidates)

	var totalVotes int64
	for _, cand := range candidates {
		totalVotes += int64(cand.VoteCount)
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    gin.H{"event": event, "candidates": candidates, "total_votes": totalVotes},
	})
}

// AdminListEvents retourne tous les événements (admin).
func (h *EventHandler) AdminListEvents(c *gin.Context) {
	var pagination models.PaginationQuery
	if err := c.ShouldBindQuery(&pagination); err != nil {
		pagination.Page = 1
		pagination.Limit = 20
	}

	var events []models.Event
	var total int64
	h.DB.Model(&models.Event{}).Count(&total)

	offset := (pagination.Page - 1) * pagination.Limit
	h.DB.Preload("Candidates").Order("created_at DESC").Offset(offset).Limit(pagination.Limit).Find(&events)

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data: models.PaginatedResponse{
			Data: events, Total: total, Page: pagination.Page,
			Limit: pagination.Limit, TotalPages: int(math.Ceil(float64(total) / float64(pagination.Limit))),
		},
	})
}

// CreateEvent crée un événement.
func (h *EventHandler) CreateEvent(c *gin.Context) {
	var event models.Event
	event.Status = "draft"
	event.Type = "free"

	contentType := c.GetHeader("Content-Type")
	if strings.Contains(contentType, "multipart") {
		event.Title = c.PostForm("title")
		event.Description = c.PostForm("description")
		if t := c.PostForm("type"); t != "" { event.Type = t }
		if p := c.PostForm("price_per_vote"); p != "" {
			fmt.Sscanf(p, "%d", &event.PricePerVote)
		}
		if s := c.PostForm("status"); s != "" { event.Status = s }
		if sr := c.PostForm("show_results"); sr == "true" { event.ShowResults = true }
		if oa := c.PostForm("opens_at"); oa != "" {
			if t, err := time.Parse(time.RFC3339, oa); err == nil { event.OpensAt = &t }
		}
		if ca := c.PostForm("closes_at"); ca != "" {
			if t, err := time.Parse(time.RFC3339, ca); err == nil { event.ClosesAt = &t }
		}
		
		file, header, err := c.Request.FormFile("banner")
		if err == nil {
			defer file.Close()
			if photoURL, uploadErr := h.saveFile(file, header.Filename); uploadErr == nil {
				event.BannerURL = photoURL
			}
		}
	} else {
		var req models.CreateEventRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: "Données invalides: " + err.Error()})
			return
		}

		event.Title = req.Title
		event.Description = req.Description
		event.Type = req.Type
		event.PricePerVote = req.PricePerVote
		event.ShowResults = req.ShowResults
		event.BannerURL = req.BannerURL
		if req.Status != "" { event.Status = req.Status }
		if req.OpensAt != "" {
			if t, err := time.Parse(time.RFC3339, req.OpensAt); err == nil { event.OpensAt = &t }
		}
		if req.ClosesAt != "" {
			if t, err := time.Parse(time.RFC3339, req.ClosesAt); err == nil { event.ClosesAt = &t }
		}
	}

	if err := h.DB.Create(&event).Error; err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: "Erreur création"})
		return
	}

	logAudit(h.DB, c, "CREATE_EVENT", "event:"+event.ID.String(), models.JSON{"title": event.Title})
	c.JSON(http.StatusCreated, models.APIResponse{Success: true, Message: "Événement créé", Data: event})
}

// UpdateEvent met à jour un événement.
func (h *EventHandler) UpdateEvent(c *gin.Context) {
	id := c.Param("id")
	var event models.Event
	if err := h.DB.Where("id = ?", id).First(&event).Error; err != nil {
		c.JSON(http.StatusNotFound, models.APIResponse{Success: false, Error: "Événement introuvable"})
		return
	}

	updates := make(map[string]interface{})
	contentType := c.GetHeader("Content-Type")
	if strings.Contains(contentType, "multipart") {
		if title := c.PostForm("title"); title != "" { updates["title"] = title }
		if desc := c.PostForm("description"); desc != "" { updates["description"] = desc }
		if t := c.PostForm("type"); t != "" { updates["type"] = t }
		if p := c.PostForm("price_per_vote"); p != "" {
			var price int
			if _, err := fmt.Sscanf(p, "%d", &price); err == nil {
				updates["price_per_vote"] = price
			}
		}
		if s := c.PostForm("status"); s != "" { updates["status"] = s }
		if sr := c.PostForm("show_results"); sr != "" {
			updates["show_results"] = sr == "true"
		}
		if oa := c.PostForm("opens_at"); oa != "" {
			if t, err := time.Parse(time.RFC3339, oa); err == nil { updates["opens_at"] = &t }
		}
		if ca := c.PostForm("closes_at"); ca != "" {
			if t, err := time.Parse(time.RFC3339, ca); err == nil { updates["closes_at"] = &t }
		}

		file, header, err := c.Request.FormFile("banner")
		if err == nil {
			defer file.Close()
			if photoURL, uploadErr := h.saveFile(file, header.Filename); uploadErr == nil {
				updates["banner_url"] = photoURL
			}
		}
	} else {
		var req models.UpdateEventRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: "Données invalides"})
			return
		}
		if req.Title != nil { updates["title"] = *req.Title }
		if req.Description != nil { updates["description"] = *req.Description }
		if req.Type != nil { updates["type"] = *req.Type }
		if req.PricePerVote != nil { updates["price_per_vote"] = *req.PricePerVote }
		if req.Status != nil { updates["status"] = *req.Status }
		if req.ShowResults != nil { updates["show_results"] = *req.ShowResults }
		if req.BannerURL != nil { updates["banner_url"] = *req.BannerURL }
	}

	h.DB.Model(&event).Updates(updates)
	logAudit(h.DB, c, "UPDATE_EVENT", "event:"+id, nil)
	h.DB.Where("id = ?", id).First(&event)

	c.JSON(http.StatusOK, models.APIResponse{Success: true, Message: "Événement mis à jour", Data: event})
}

// DeleteEvent supprime un événement.
func (h *EventHandler) DeleteEvent(c *gin.Context) {
	id := c.Param("id")
	var event models.Event
	if err := h.DB.Where("id = ?", id).First(&event).Error; err != nil {
		c.JSON(http.StatusNotFound, models.APIResponse{Success: false, Error: "Événement introuvable"})
		return
	}

	h.DB.Delete(&event)
	logAudit(h.DB, c, "DELETE_EVENT", "event:"+id, models.JSON{"title": event.Title})
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Message: "Événement supprimé"})
}

// logAudit crée une entrée d'audit.
func logAudit(db *gorm.DB, c *gin.Context, action, target string, details models.JSON) {
	log := models.AuditLog{Action: action, Target: target, IPAddress: c.ClientIP(), Details: details}
	if uid, exists := c.Get("user_id"); exists {
		if parsedUID, err := uuid.Parse(uid.(string)); err == nil {
			log.UserID = &parsedUID
		}
	}
	db.Create(&log)
}

// saveFile enregistre un fichier uploadé et retourne son URL (Cloudinary).
func (h *EventHandler) saveFile(file io.Reader, originalName string) (string, error) {
	ext := filepath.Ext(originalName)
	allowedExts := map[string]bool{".jpg": true, ".jpeg": true, ".png": true, ".webp": true}
	if !allowedExts[strings.ToLower(ext)] {
		return "", fmt.Errorf("extension non autorisée: %s", ext)
	}

	ctx := context.Background()
	folder := "univote/events"

	if h.CldService != nil && h.CldService.Cld != nil {
		return h.CldService.UploadImage(ctx, file, folder)
	}

	return "", fmt.Errorf("cloudinary service not available")
}
