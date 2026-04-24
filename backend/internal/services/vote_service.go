package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"github.com/univote/backend/internal/models"
	"gorm.io/gorm"
)

// VoteServiceInterface définit les méthodes du service de vote.
type VoteServiceInterface interface {
	InitiateVote(ctx context.Context, req models.VoteInitiateRequest) (*models.VoteInitiateResponse, error)
	GetTransactionStatus(ctx context.Context, ref string) (*models.Transaction, error)
}

// VoteService implémente la logique de vote et paiement.
type VoteService struct {
	DB                *gorm.DB
	Redis             *redis.Client
	NotchPaySecretKey string
	NotchPayBaseURL   string
	FrontendURL       string
}

// NewVoteService crée un nouveau VoteService.
func NewVoteService(db *gorm.DB, redisClient *redis.Client, secretKey, baseURL, frontendURL string) *VoteService {
	return &VoteService{
		DB: db, Redis: redisClient,
		NotchPaySecretKey: secretKey, NotchPayBaseURL: baseURL,
		FrontendURL: frontendURL,
	}
}

// InitiateVote initie un vote payant via Notch Pay.
func (s *VoteService) InitiateVote(ctx context.Context, req models.VoteInitiateRequest) (*models.VoteInitiateResponse, error) {
	candidateID, _ := uuid.Parse(req.CandidateID)

	// Vérifier le candidat et l'événement
	var candidate models.Candidate
	if err := s.DB.Preload("Event").Where("id = ?", candidateID).First(&candidate).Error; err != nil {
		return nil, fmt.Errorf("candidat introuvable")
	}

	if candidate.Event == nil || candidate.Event.Status != "open" {
		return nil, fmt.Errorf("le scrutin n'est pas ouvert")
	}

	// Calculer le montant
	amount := req.VoteCount * candidate.Event.PricePerVote
	if candidate.Event.Type == "free" {
		amount = 0
	}

	// Générer l'idempotency key
	idempotencyKey := uuid.New().String()

	// Détecter l'opérateur
	operator := DetectOperator(req.Phone)

	// Créer la transaction en base
	transaction := models.Transaction{
		CandidateID:    candidateID,
		EventID:        candidate.EventID,
		PhoneNumber:    req.Phone,
		Operator:       operator,
		Amount:         amount,
		VoteCount:      req.VoteCount,
		IdempotencyKey: idempotencyKey,
		Status:         "pending",
	}

	// Si vote gratuit, traiter immédiatement
	if candidate.Event.Type == "free" {
		transaction.Status = "success"
		transaction.WebhookVerified = true
		s.DB.Create(&transaction)

		// Incrémenter Redis
		redisKey := fmt.Sprintf("votes:candidate:%s", candidateID.String())
		s.Redis.IncrBy(ctx, redisKey, int64(req.VoteCount))

		// Mettre à jour PostgreSQL
		s.DB.Model(&models.Candidate{}).Where("id = ?", candidateID).
			Update("vote_count", gorm.Expr("vote_count + ?", req.VoteCount))

		return &models.VoteInitiateResponse{
			Reference:      transaction.ID.String(),
			IdempotencyKey: idempotencyKey,
			Amount:         0,
			Status:         "success",
		}, nil
	}

	// Appel API Notch Pay pour paiement Mobile Money
	notchPayReq := map[string]interface{}{
		"amount":      amount,
		"currency":    "XAF",
		"phone":       req.Phone,
		"description": fmt.Sprintf("Vote %s - %s (%d votes)", candidate.Event.Title, candidate.Name, req.VoteCount),
		"reference":   idempotencyKey,
		"callback":    s.FrontendURL + "/vote/callback",
	}

	reqBody, _ := json.Marshal(notchPayReq)
	httpReq, _ := http.NewRequestWithContext(ctx, "POST", s.NotchPayBaseURL+"/payments", bytes.NewBuffer(reqBody))
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", s.NotchPaySecretKey)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		transaction.Status = "failed"
		s.DB.Create(&transaction)
		return nil, fmt.Errorf("erreur paiement: %v", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	var notchResp struct {
		Transaction struct {
			Reference string `json:"reference"`
		} `json:"transaction"`
		AuthorizationURL string `json:"authorization_url"`
	}
	json.Unmarshal(body, &notchResp)

	transaction.NotchPayRef = notchResp.Transaction.Reference
	s.DB.Create(&transaction)

	return &models.VoteInitiateResponse{
		Reference:      notchResp.Transaction.Reference,
		PaymentURL:     notchResp.AuthorizationURL,
		IdempotencyKey: idempotencyKey,
		Amount:         amount,
		Status:         "pending",
	}, nil
}

// GetTransactionStatus retourne le statut d'une transaction.
func (s *VoteService) GetTransactionStatus(ctx context.Context, ref string) (*models.Transaction, error) {
	var tx models.Transaction
	if err := s.DB.Where("notchpay_ref = ? OR idempotency_key = ?", ref, ref).First(&tx).Error; err != nil {
		return nil, fmt.Errorf("transaction introuvable")
	}
	return &tx, nil
}
