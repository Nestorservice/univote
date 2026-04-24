package services

import (
	"context"
	"fmt"
	"log"
	"strconv"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/univote/backend/internal/models"
	"gorm.io/gorm"
)

// SyncServiceInterface définit le service de synchronisation Redis → PostgreSQL.
type SyncServiceInterface interface {
	StartSync(ctx context.Context)
	SyncScores(ctx context.Context) error
}

// SyncService synchronise les scores de Redis vers PostgreSQL.
type SyncService struct {
	DB    *gorm.DB
	Redis *redis.Client
}

// NewSyncService crée un nouveau SyncService.
func NewSyncService(db *gorm.DB, redisClient *redis.Client) *SyncService {
	return &SyncService{DB: db, Redis: redisClient}
}

// StartSync lance la synchronisation périodique (toutes les 30 secondes).
func (s *SyncService) StartSync(ctx context.Context) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	log.Println("🔄 Synchronisation Redis → PostgreSQL démarrée (toutes les 30s)")

	for {
		select {
		case <-ctx.Done():
			log.Println("🛑 Synchronisation arrêtée")
			return
		case <-ticker.C:
			if err := s.SyncScores(ctx); err != nil {
				log.Printf("⚠️  Erreur sync scores: %v", err)
			}
		}
	}
}

// SyncScores synchronise les scores depuis Redis vers PostgreSQL.
func (s *SyncService) SyncScores(ctx context.Context) error {
	// Récupérer toutes les clés de votes
	keys, err := s.Redis.Keys(ctx, "votes:candidate:*").Result()
	if err != nil {
		return fmt.Errorf("erreur récupération clés Redis: %v", err)
	}

	for _, key := range keys {
		// Extraire l'ID du candidat
		candidateID := key[len("votes:candidate:"):]

		// Lire le score depuis Redis
		scoreStr, err := s.Redis.Get(ctx, key).Result()
		if err != nil {
			continue
		}

		score, err := strconv.Atoi(scoreStr)
		if err != nil {
			continue
		}

		// Mettre à jour PostgreSQL
		s.DB.Model(&models.Candidate{}).
			Where("id = ?", candidateID).
			Update("vote_count", score)
	}

	return nil
}
