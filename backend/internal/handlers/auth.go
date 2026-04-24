package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/univote/backend/internal/middleware"
	"github.com/univote/backend/internal/models"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
	"time"
)

// AuthHandler gère l'authentification admin.
type AuthHandler struct {
	DB           *gorm.DB
	JWTExpiry    time.Duration
	RefreshExpiry time.Duration
}

// NewAuthHandler crée un nouveau AuthHandler.
func NewAuthHandler(db *gorm.DB, jwtExpiry, refreshExpiry time.Duration) *AuthHandler {
	return &AuthHandler{
		DB:           db,
		JWTExpiry:    jwtExpiry,
		RefreshExpiry: refreshExpiry,
	}
}

// Login authentifie un administrateur et retourne un JWT.
// POST /api/v1/auth/login
func (h *AuthHandler) Login(c *gin.Context) {
	var req models.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Error:   "Email et mot de passe requis",
		})
		return
	}

	// Chercher l'utilisateur par email
	var user models.User
	if err := h.DB.Where("email = ?", req.Email).First(&user).Error; err != nil {
		c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Error:   "Email ou mot de passe incorrect",
		})
		return
	}

	// Vérifier le mot de passe
	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Error:   "Email ou mot de passe incorrect",
		})
		return
	}

	// Générer le token JWT
	token, expiresAt, err := middleware.GenerateToken(user.ID, user.Email, user.Role, h.JWTExpiry)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Error:   "Erreur lors de la génération du token",
		})
		return
	}

	// Générer le refresh token
	refreshToken, err := middleware.GenerateRefreshToken(user.ID, user.Email, user.Role, h.RefreshExpiry)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Error:   "Erreur lors de la génération du refresh token",
		})
		return
	}

	// Log d'audit
	auditLog := models.AuditLog{
		UserID:    &user.ID,
		Action:    "LOGIN",
		Target:    "user:" + user.ID.String(),
		IPAddress: c.ClientIP(),
	}
	h.DB.Create(&auditLog)

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data: models.LoginResponse{
			Token:        token,
			RefreshToken: refreshToken,
			ExpiresAt:    expiresAt,
			User:         &user,
		},
	})
}

// Refresh génère un nouveau token à partir d'un refresh token.
// POST /api/v1/auth/refresh
func (h *AuthHandler) Refresh(c *gin.Context) {
	var body struct {
		RefreshToken string `json:"refresh_token" binding:"required"`
	}

	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Error:   "Refresh token requis",
		})
		return
	}

	// Valider le refresh token
	claims, err := middleware.ValidateToken(body.RefreshToken)
	if err != nil {
		c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Error:   "Refresh token invalide ou expiré",
		})
		return
	}

	// Vérifier que l'utilisateur existe encore
	var user models.User
	if err := h.DB.Where("id = ?", claims.UserID).First(&user).Error; err != nil {
		c.JSON(http.StatusUnauthorized, models.APIResponse{
			Success: false,
			Error:   "Utilisateur introuvable",
		})
		return
	}

	// Générer un nouveau token
	token, expiresAt, err := middleware.GenerateToken(user.ID, user.Email, user.Role, h.JWTExpiry)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.APIResponse{
			Success: false,
			Error:   "Erreur lors de la génération du token",
		})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data: models.LoginResponse{
			Token:     token,
			ExpiresAt: expiresAt,
			User:      &user,
		},
	})
}

// Logout déconnecte l'utilisateur (côté client seulement avec JWT stateless).
// POST /api/v1/auth/logout
func (h *AuthHandler) Logout(c *gin.Context) {
	// Avec JWT stateless, le logout se fait côté client en supprimant le token.
	// On log l'action pour l'audit.
	userID, _ := c.Get("user_id")
	if userID != nil {
		auditLog := models.AuditLog{
			Action:    "LOGOUT",
			Target:    "user:" + userID.(string),
			IPAddress: c.ClientIP(),
		}
		h.DB.Create(&auditLog)
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Message: "Déconnexion réussie",
	})
}

// Me retourne les informations de l'utilisateur connecté.
// GET /api/v1/auth/me
func (h *AuthHandler) Me(c *gin.Context) {
	userID, _ := c.Get("user_id")

	var user models.User
	if err := h.DB.Where("id = ?", userID).First(&user).Error; err != nil {
		c.JSON(http.StatusNotFound, models.APIResponse{
			Success: false,
			Error:   "Utilisateur introuvable",
		})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    user,
	})
}
