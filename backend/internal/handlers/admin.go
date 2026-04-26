package handlers

import (
	"encoding/csv"
	"fmt"
	"math"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/univote/backend/internal/models"
	"gorm.io/gorm"
)

// AdminHandler gère le dashboard et les transactions admin.
type AdminHandler struct {
	DB *gorm.DB
}

// NewAdminHandler crée un nouveau AdminHandler.
func NewAdminHandler(db *gorm.DB) *AdminHandler {
	return &AdminHandler{DB: db}
}

// Dashboard retourne les statistiques générales.
// GET /api/v1/admin/dashboard
func (h *AdminHandler) Dashboard(c *gin.Context) {
	var stats models.DashboardStats
	today := time.Now().Truncate(24 * time.Hour)

	// Revenus et votes totaux
	h.DB.Model(&models.Transaction{}).Where("status = ?", "success").
		Select("COALESCE(SUM(amount), 0)").Scan(&stats.TotalRevenue)
	h.DB.Model(&models.Transaction{}).Where("status = ?", "success").
		Select("COALESCE(SUM(vote_count), 0)").Scan(&stats.TotalVotes)

	// Revenus et votes du jour
	h.DB.Model(&models.Transaction{}).Where("status = ? AND created_at >= ?", "success", today).
		Select("COALESCE(SUM(amount), 0)").Scan(&stats.TodayRevenue)
	h.DB.Model(&models.Transaction{}).Where("status = ? AND created_at >= ?", "success", today).
		Select("COALESCE(SUM(vote_count), 0)").Scan(&stats.TodayVotes)

	// Transactions en attente
	h.DB.Model(&models.Transaction{}).Where("status = ?", "pending").Count(&stats.PendingTransactions)

	// Events actifs
	h.DB.Model(&models.Event{}).Where("status = ?", "open").Count(&stats.ActiveEvents)

	// Top 5 candidats
	var topCandidates []struct {
		ID        string
		Name      string
		PhotoURL  string
		VoteCount int
		EventTitle string
	}
	h.DB.Table("candidates").
		Select("candidates.id, candidates.name, candidates.photo_url, candidates.vote_count, events.title as event_title").
		Joins("LEFT JOIN events ON events.id = candidates.event_id").
		Where("events.status = ?", "open").
		Order("candidates.vote_count DESC").Limit(5).Find(&topCandidates)

	stats.TopCandidates = make([]models.TopCandidate, len(topCandidates))
	for i, tc := range topCandidates {
		stats.TopCandidates[i] = models.TopCandidate{
			ID: tc.ID, Name: tc.Name, PhotoURL: tc.PhotoURL,
			VoteCount: tc.VoteCount, EventName: tc.EventTitle,
		}
	}

	// Revenus par heure (dernières 24h)
	var revenueByHour []struct {
		Hour    time.Time
		Revenue int64
		Votes   int64
	}
	h.DB.Table("transactions").
		Select("date_trunc('hour', created_at) as hour, COALESCE(SUM(amount),0) as revenue, COALESCE(SUM(vote_count),0) as votes").
		Where("status = ? AND created_at >= ?", "success", today).
		Group("hour").Order("hour ASC").Find(&revenueByHour)

	stats.RevenueByHour = make([]models.RevenueByHour, len(revenueByHour))
	for i, r := range revenueByHour {
		stats.RevenueByHour[i] = models.RevenueByHour{
			Hour: r.Hour.Format("15:04"), Revenue: r.Revenue, Votes: r.Votes,
		}
	}

	c.JSON(http.StatusOK, models.APIResponse{Success: true, Data: stats})
}

// EventDashboard retourne les stats détaillées d'un scrutin.
// GET /api/v1/admin/events/:id/dashboard
func (h *AdminHandler) EventDashboard(c *gin.Context) {
	eventID := c.Param("id")

	var event models.Event
	if err := h.DB.Preload("Candidates", func(db *gorm.DB) *gorm.DB {
		return db.Order("vote_count DESC")
	}).Where("id = ?", eventID).First(&event).Error; err != nil {
		c.JSON(http.StatusNotFound, models.APIResponse{Success: false, Error: "Événement introuvable"})
		return
	}

	// Total votes
	var totalVotes int64
	for _, cand := range event.Candidates {
		totalVotes += int64(cand.VoteCount)
	}

	// Revenue for this event
	var totalRevenue int64
	h.DB.Model(&models.Transaction{}).Where("event_id = ? AND status = ?", eventID, "success").
		Select("COALESCE(SUM(amount), 0)").Scan(&totalRevenue)

	// Votes by hour
	var votesByHour []struct {
		Hour  time.Time
		Votes int64
	}
	h.DB.Table("transactions").
		Select("date_trunc('hour', created_at) as hour, COALESCE(SUM(vote_count),0) as votes").
		Where("event_id = ? AND status = ?", eventID, "success").
		Group("hour").Order("hour ASC").Find(&votesByHour)

	hourlyData := make([]map[string]interface{}, len(votesByHour))
	for i, v := range votesByHour {
		hourlyData[i] = map[string]interface{}{"hour": v.Hour.Format("01/02 15:04"), "votes": v.Votes}
	}

	// Recent activity
	var recentTx []models.Transaction
	h.DB.Preload("Candidate").Where("event_id = ? AND status = ?", eventID, "success").
		Order("created_at DESC").Limit(10).Find(&recentTx)

	activity := make([]map[string]interface{}, len(recentTx))
	for i, tx := range recentTx {
		candName := "?"
		if tx.Candidate != nil {
			candName = tx.Candidate.Name
		}
		activity[i] = map[string]interface{}{
			"candidate": candName,
			"votes":     tx.VoteCount,
			"amount":    tx.Amount,
			"time":      tx.CreatedAt.Format("15:04:05"),
		}
	}

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data: gin.H{
			"event":         event,
			"total_votes":   totalVotes,
			"total_revenue": totalRevenue,
			"candidates":    event.Candidates,
			"votes_by_hour": hourlyData,
			"recent_activity": activity,
		},
	})
}

// ListTransactions retourne la liste des transactions avec filtres.
// GET /api/v1/admin/transactions
func (h *AdminHandler) ListTransactions(c *gin.Context) {
	var pagination models.PaginationQuery
	if err := c.ShouldBindQuery(&pagination); err != nil {
		pagination.Page = 1
		pagination.Limit = 20
	}

	var transactions []models.Transaction
	var total int64

	query := h.DB.Model(&models.Transaction{})

	// Filtres
	if eventID := c.Query("event_id"); eventID != "" {
		query = query.Where("event_id = ?", eventID)
	}
	if status := c.Query("status"); status != "" {
		query = query.Where("status = ?", status)
	}
	if from := c.Query("from"); from != "" {
		if t, err := time.Parse("2006-01-02", from); err == nil {
			query = query.Where("created_at >= ?", t)
		}
	}
	if to := c.Query("to"); to != "" {
		if t, err := time.Parse("2006-01-02", to); err == nil {
			query = query.Where("created_at <= ?", t.Add(24*time.Hour))
		}
	}

	query.Count(&total)
	offset := (pagination.Page - 1) * pagination.Limit
	query.Preload("Candidate").Preload("Event").
		Order("created_at DESC").Offset(offset).Limit(pagination.Limit).Find(&transactions)

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data: models.PaginatedResponse{
			Data: transactions, Total: total, Page: pagination.Page,
			Limit: pagination.Limit, TotalPages: int(math.Ceil(float64(total) / float64(pagination.Limit))),
		},
	})
}

// ExportTransactionsCSV exporte les transactions en CSV.
// GET /api/v1/admin/transactions/export
func (h *AdminHandler) ExportTransactionsCSV(c *gin.Context) {
	var transactions []models.Transaction
	query := h.DB.Preload("Candidate").Preload("Event")

	if eventID := c.Query("event_id"); eventID != "" {
		query = query.Where("event_id = ?", eventID)
	}
	if status := c.Query("status"); status != "" {
		query = query.Where("status = ?", status)
	}

	query.Order("created_at DESC").Find(&transactions)

	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=transactions_%s.csv", time.Now().Format("2006-01-02")))

	writer := csv.NewWriter(c.Writer)
	defer writer.Flush()

	// En-têtes
	writer.Write([]string{"ID", "Candidat", "Événement", "Téléphone", "Opérateur", "Montant (FCFA)", "Votes", "Statut", "Référence", "Date"})

	for _, t := range transactions {
		candidateName := ""
		eventName := ""
		if t.Candidate != nil { candidateName = t.Candidate.Name }
		if t.Event != nil { eventName = t.Event.Title }

		writer.Write([]string{
			t.ID.String(), candidateName, eventName,
			t.PhoneNumber, t.Operator, fmt.Sprintf("%d", t.Amount),
			fmt.Sprintf("%d", t.VoteCount), t.Status, t.NotchPayRef,
			t.CreatedAt.Format("2006-01-02 15:04:05"),
		})
	}
}

// ListAuditLogs retourne le journal d'audit.
// GET /api/v1/admin/logs
func (h *AdminHandler) ListAuditLogs(c *gin.Context) {
	var pagination models.PaginationQuery
	if err := c.ShouldBindQuery(&pagination); err != nil {
		pagination.Page = 1
		pagination.Limit = 50
	}

	var logs []models.AuditLog
	var total int64

	h.DB.Model(&models.AuditLog{}).Count(&total)
	offset := (pagination.Page - 1) * pagination.Limit
	h.DB.Preload("User").Order("created_at DESC").Offset(offset).Limit(pagination.Limit).Find(&logs)

	c.JSON(http.StatusOK, models.APIResponse{
		Success: true,
		Data: models.PaginatedResponse{
			Data: logs, Total: total, Page: pagination.Page,
			Limit: pagination.Limit, TotalPages: int(math.Ceil(float64(total) / float64(pagination.Limit))),
		},
	})
}
