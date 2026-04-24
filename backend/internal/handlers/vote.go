package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/univote/backend/internal/models"
	"github.com/univote/backend/internal/services"
)

// VoteHandler gère les endpoints de vote.
type VoteHandler struct {
	VoteService *services.VoteService
}

// NewVoteHandler crée un nouveau VoteHandler.
func NewVoteHandler(vs *services.VoteService) *VoteHandler {
	return &VoteHandler{VoteService: vs}
}

// InitiateVote initie un vote payant.
// POST /api/v1/vote/initiate
func (h *VoteHandler) InitiateVote(c *gin.Context) {
	var req models.VoteInitiateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Error:   "Données invalides: " + err.Error(),
		})
		return
	}

	resp, err := h.VoteService.InitiateVote(c.Request.Context(), req)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.APIResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    resp,
	})
}

// GetTransactionStatus retourne le statut d'une transaction.
// GET /api/v1/transactions/:ref/status
func (h *VoteHandler) GetTransactionStatus(c *gin.Context) {
	ref := c.Param("ref")

	tx, err := h.VoteService.GetTransactionStatus(c.Request.Context(), ref)
	if err != nil {
		c.JSON(http.StatusNotFound, models.APIResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data:    tx,
	})
}
