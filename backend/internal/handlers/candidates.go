package handlers

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/univote/backend/internal/models"
	"gorm.io/gorm"
)

// CandidateHandler gère les opérations sur les candidats.
type CandidateHandler struct {
	DB        *gorm.DB
	UploadDir string
}

// NewCandidateHandler crée un nouveau CandidateHandler.
func NewCandidateHandler(db *gorm.DB, uploadDir string) *CandidateHandler {
	return &CandidateHandler{DB: db, UploadDir: uploadDir}
}

// GetCandidate retourne la fiche d'un candidat.
// GET /api/v1/candidates/:id
func (h *CandidateHandler) GetCandidate(c *gin.Context) {
	id := c.Param("id")
	var candidate models.Candidate
	if err := h.DB.Preload("Event").Where("id = ?", id).First(&candidate).Error; err != nil {
		c.JSON(http.StatusNotFound, models.APIResponse{Success: false, Error: "Candidat introuvable"})
		return
	}
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: candidate})
}

// CreateCandidate ajoute un candidat à un événement (multipart/form-data).
// POST /api/v1/admin/events/:id/candidates
func (h *CandidateHandler) CreateCandidate(c *gin.Context) {
	eventID := c.Param("id")
	if _, err := uuid.Parse(eventID); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: "ID événement invalide"})
		return
	}

	// Vérifier que l'événement existe
	var event models.Event
	if err := h.DB.Where("id = ?", eventID).First(&event).Error; err != nil {
		c.JSON(http.StatusNotFound, models.APIResponse{Success: false, Error: "Événement introuvable"})
		return
	}

	name := c.PostForm("name")
	if name == "" {
		c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: "Le nom est requis"})
		return
	}

	parsedEventID, _ := uuid.Parse(eventID)
	candidate := models.Candidate{
		EventID: parsedEventID,
		Name:    name,
		Bio:     c.PostForm("bio"),
		Dossard: c.PostForm("dossard"),
	}

	// Upload photo
	file, header, err := c.Request.FormFile("photo")
	if err == nil {
		defer file.Close()
		photoURL, uploadErr := h.saveFile(file, header.Filename)
		if uploadErr == nil {
			candidate.PhotoURL = photoURL
		}
	}

	// Upload gallery files
	form, err := c.MultipartForm()
	if err == nil {
		galleryFiles := form.File["gallery"]
		for _, f := range galleryFiles {
			file, err := f.Open()
			if err == nil {
				if photoURL, uploadErr := h.saveFile(file, f.Filename); uploadErr == nil {
					candidate.Gallery = append(candidate.Gallery, photoURL)
				}
				file.Close()
			}
		}
	}

	if err := h.DB.Create(&candidate).Error; err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{Success: false, Error: "Erreur création"})
		return
	}

	logAudit(h.DB, c, "CREATE_CANDIDATE", "candidate:"+candidate.ID.String(),
		models.JSON{"name": candidate.Name, "event_id": eventID})
	c.JSON(http.StatusCreated, models.APIResponse{Success: true, Message: "Candidat ajouté", Data: candidate})
}

// UpdateCandidate met à jour un candidat.
// PUT /api/v1/admin/candidates/:id
func (h *CandidateHandler) UpdateCandidate(c *gin.Context) {
	id := c.Param("id")
	var candidate models.Candidate
	if err := h.DB.Where("id = ?", id).First(&candidate).Error; err != nil {
		c.JSON(http.StatusNotFound, models.APIResponse{Success: false, Error: "Candidat introuvable"})
		return
	}

	// Supporter à la fois JSON et multipart
	contentType := c.GetHeader("Content-Type")
	if strings.Contains(contentType, "multipart") {
		if name := c.PostForm("name"); name != "" {
			candidate.Name = name
		}
		if bio := c.PostForm("bio"); bio != "" {
			candidate.Bio = bio
		}
		if dossard := c.PostForm("dossard"); dossard != "" {
			candidate.Dossard = dossard
		}
		// Upload nouvelle photo
		file, header, err := c.Request.FormFile("photo")
		if err == nil {
			defer file.Close()
			if photoURL, uploadErr := h.saveFile(file, header.Filename); uploadErr == nil {
				candidate.PhotoURL = photoURL
			}
		}
		
		// Add new gallery images if provided
		form, err := c.MultipartForm()
		if err == nil {
			galleryFiles := form.File["gallery"]
			for _, f := range galleryFiles {
				file, err := f.Open()
				if err == nil {
					if photoURL, uploadErr := h.saveFile(file, f.Filename); uploadErr == nil {
						candidate.Gallery = append(candidate.Gallery, photoURL)
					}
					file.Close()
				}
			}
		}
	} else {
		var req models.UpdateCandidateRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, models.APIResponse{Success: false, Error: "Données invalides"})
			return
		}
		if req.Name != nil { candidate.Name = *req.Name }
		if req.Bio != nil { candidate.Bio = *req.Bio }
		if req.Dossard != nil { candidate.Dossard = *req.Dossard }
		if req.Gallery != nil { candidate.Gallery = req.Gallery }
	}

	h.DB.Save(&candidate)
	logAudit(h.DB, c, "UPDATE_CANDIDATE", "candidate:"+id, nil)
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Message: "Candidat mis à jour", Data: candidate})
}

// DeleteCandidate supprime un candidat.
// DELETE /api/v1/admin/candidates/:id
func (h *CandidateHandler) DeleteCandidate(c *gin.Context) {
	id := c.Param("id")
	var candidate models.Candidate
	if err := h.DB.Where("id = ?", id).First(&candidate).Error; err != nil {
		c.JSON(http.StatusNotFound, models.APIResponse{Success: false, Error: "Candidat introuvable"})
		return
	}

	h.DB.Delete(&candidate)
	logAudit(h.DB, c, "DELETE_CANDIDATE", "candidate:"+id, models.JSON{"name": candidate.Name})
	c.JSON(http.StatusOK, models.APIResponse{Success: true, Message: "Candidat supprimé"})
}

// saveFile enregistre un fichier uploadé et retourne son URL relative.
func (h *CandidateHandler) saveFile(file io.Reader, originalName string) (string, error) {
	ext := filepath.Ext(originalName)
	allowedExts := map[string]bool{".jpg": true, ".jpeg": true, ".png": true, ".gif": true, ".webp": true}
	if !allowedExts[strings.ToLower(ext)] {
		return "", fmt.Errorf("extension non autorisée: %s", ext)
	}

	filename := fmt.Sprintf("%s_%d%s", uuid.New().String(), time.Now().Unix(), ext)
	filepath := filepath.Join(h.UploadDir, filename)

	os.MkdirAll(h.UploadDir, 0755)

	dst, err := os.Create(filepath)
	if err != nil {
		return "", err
	}
	defer dst.Close()

	if _, err := io.Copy(dst, file); err != nil {
		return "", err
	}

	return "/uploads/" + filename, nil
}
