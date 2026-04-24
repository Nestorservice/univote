package models

import (
	"database/sql/driver"
	"encoding/json"
)

// JSON est un type personnalisé pour les colonnes JSONB PostgreSQL.
type JSON map[string]interface{}

// Scan implémente l'interface sql.Scanner.
func (j *JSON) Scan(value interface{}) error {
	if value == nil {
		*j = JSON{}
		return nil
	}
	bytes, ok := value.([]byte)
	if !ok {
		return nil
	}
	return json.Unmarshal(bytes, j)
}

// Value implémente l'interface driver.Valuer.
func (j JSON) Value() (driver.Value, error) {
	if j == nil {
		return "{}", nil
	}
	bytes, err := json.Marshal(j)
	if err != nil {
		return nil, err
	}
	return string(bytes), nil
}

// ─── Request / Response DTOs ────────────────────────────────────

// LoginRequest est le body de la requête POST /api/v1/auth/login.
type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=6"`
}

// LoginResponse est la réponse de POST /api/v1/auth/login.
type LoginResponse struct {
	Token        string `json:"token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresAt    int64  `json:"expires_at"`
	User         *User  `json:"user"`
}

// VoteInitiateRequest est le body de POST /api/v1/vote/initiate.
type VoteInitiateRequest struct {
	CandidateID string `json:"candidate_id" binding:"required,uuid"`
	Phone       string `json:"phone" binding:"required,min=9,max=15"`
	VoteCount   int    `json:"vote_count" binding:"required,min=1,max=100"`
}

// VoteInitiateResponse est la réponse de POST /api/v1/vote/initiate.
type VoteInitiateResponse struct {
	Reference      string `json:"reference"`
	PaymentURL     string `json:"payment_url,omitempty"`
	IdempotencyKey string `json:"idempotency_key"`
	Amount         int    `json:"amount"`
	Status         string `json:"status"`
}

// CreateEventRequest est le body de POST /api/v1/admin/events.
type CreateEventRequest struct {
	Title        string `json:"title" binding:"required,min=3,max=255"`
	Description  string `json:"description"`
	Type         string `json:"type" binding:"required,oneof=free paid"`
	PricePerVote int    `json:"price_per_vote" binding:"min=0"`
	Status       string `json:"status" binding:"omitempty,oneof=draft open closed"`
	ShowResults  bool   `json:"show_results"`
	OpensAt      string `json:"opens_at"`
	ClosesAt     string `json:"closes_at"`
	BannerURL    string `json:"banner_url"`
}

// UpdateEventRequest est le body de PUT /api/v1/admin/events/:id.
type UpdateEventRequest struct {
	Title        *string `json:"title" binding:"omitempty,min=3,max=255"`
	Description  *string `json:"description"`
	Type         *string `json:"type" binding:"omitempty,oneof=free paid"`
	PricePerVote *int    `json:"price_per_vote" binding:"omitempty,min=0"`
	Status       *string `json:"status" binding:"omitempty,oneof=draft open closed"`
	ShowResults  *bool   `json:"show_results"`
	OpensAt      *string `json:"opens_at"`
	ClosesAt     *string `json:"closes_at"`
	BannerURL    *string `json:"banner_url"`
}

// UpdateCandidateRequest est le body de PUT /api/v1/admin/candidates/:id.
type UpdateCandidateRequest struct {
	Name    *string  `json:"name" binding:"omitempty,min=2,max=255"`
	Bio     *string  `json:"bio"`
	Dossard *string  `json:"dossard"`
	Gallery []string `json:"gallery"`
}

// PaginationQuery contient les paramètres de pagination.
type PaginationQuery struct {
	Page  int `form:"page,default=1" binding:"min=1"`
	Limit int `form:"limit,default=20" binding:"min=1,max=100"`
}

// PaginatedResponse est une réponse paginée générique.
type PaginatedResponse struct {
	Data       interface{} `json:"data"`
	Total      int64       `json:"total"`
	Page       int         `json:"page"`
	Limit      int         `json:"limit"`
	TotalPages int         `json:"total_pages"`
}

// DashboardStats sont les statistiques du dashboard admin.
type DashboardStats struct {
	TotalRevenue        int64            `json:"total_revenue"`
	TotalVotes          int64            `json:"total_votes"`
	TodayRevenue        int64            `json:"today_revenue"`
	TodayVotes          int64            `json:"today_votes"`
	PendingTransactions int64            `json:"pending_transactions"`
	ActiveEvents        int64            `json:"active_events"`
	TopCandidates       []TopCandidate   `json:"top_candidates"`
	RevenueByHour       []RevenueByHour  `json:"revenue_by_hour"`
}

// TopCandidate représente un candidat dans le classement.
type TopCandidate struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	PhotoURL  string `json:"photo_url"`
	EventName string `json:"event_name"`
	VoteCount int    `json:"vote_count"`
}

// RevenueByHour représente les revenus par heure.
type RevenueByHour struct {
	Hour    string `json:"hour"`
	Revenue int64  `json:"revenue"`
	Votes   int64  `json:"votes"`
}

// APIResponse est une réponse API standard.
type APIResponse struct {
	Success bool        `json:"success"`
	Message string      `json:"message,omitempty"`
	Data    interface{} `json:"data,omitempty"`
	Error   string      `json:"error,omitempty"`
}

// WebSocketMessage est le message envoyé via WebSocket.
type WebSocketMessage struct {
	CandidateID string `json:"candidate_id"`
	VoteCount   int    `json:"vote_count"`
	EventID     string `json:"event_id"`
	Timestamp   string `json:"timestamp"`
}
