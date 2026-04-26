package cache

import (
	"context"
	"fmt"
	"strconv"


	"github.com/redis/go-redis/v9"
	"github.com/univote/backend/internal/models"
)

// AddVideoToFeed ajoute une vidéo aux flux Récents et Populaires, et stocke ses métadonnées.
func AddVideoToFeed(ctx context.Context, v *models.Video) error {
	eventIDStr := v.EventID.String()
	videoIDStr := v.ID.String()

	recentKey := fmt.Sprintf("feed:event:%s:recent", eventIDStr)
	popularKey := fmt.Sprintf("feed:event:%s:popular", eventIDStr)
	metaKey := fmt.Sprintf("video:meta:%s", videoIDStr)

	// Création du pipeline pour atomicité
	pipe := Client.Pipeline()

	// 1. Ajouter aux sorted sets (Récents = score timestamp, Populaires = score likes)
	pipe.ZAdd(ctx, recentKey, redis.Z{
		Score:  float64(v.CreatedAt.Unix()),
		Member: videoIDStr,
	})

	pipe.ZAdd(ctx, popularKey, redis.Z{
		Score:  float64(v.LikeCount),
		Member: videoIDStr,
	})

	// 2. Stocker les métadonnées dans un Hash
	candidateIDStr := ""
	if v.CandidateID != nil {
		candidateIDStr = v.CandidateID.String()
	}

	candidateName := ""
	if v.Candidate != nil {
		candidateName = v.Candidate.Name // Suppose que Candidate.Name existe, ou on laisse vide s'il n'est pas chargé
	}

	pipe.HSet(ctx, metaKey, map[string]interface{}{
		"id":             videoIDStr,
		"title":          v.Title,
		"pseudo":         v.UploaderPseudo,
		"thumbnail_url":  v.ThumbnailURL,
		"cloudinary_url": v.CloudinaryURL,
		"like_count":     v.LikeCount,
		"comment_count":  v.CommentCount,
		"status":         v.Status,
		"type":           v.Type,
		"candidate_id":   candidateIDStr,
		"candidate_name": candidateName,
		"created_at":     v.CreatedAt.Unix(),
	})

	_, err := pipe.Exec(ctx)
	return err
}

// RemoveVideoFromFeed retire une vidéo des flux et supprime ses métadonnées.
func RemoveVideoFromFeed(ctx context.Context, eventID string, videoID string) error {
	recentKey := fmt.Sprintf("feed:event:%s:recent", eventID)
	popularKey := fmt.Sprintf("feed:event:%s:popular", eventID)
	metaKey := fmt.Sprintf("video:meta:%s", videoID)

	pipe := Client.Pipeline()

	pipe.ZRem(ctx, recentKey, videoID)
	pipe.ZRem(ctx, popularKey, videoID)
	pipe.Del(ctx, metaKey)

	_, err := pipe.Exec(ctx)
	return err
}

// getFeedHelper est une fonction interne pour récupérer un flux paginé.
func getFeedHelper(ctx context.Context, key string, cursor int64, limit int, desc bool) ([]models.VideoMeta, int64, error) {
	var videoIDs []string
	var err error

	// Par défaut, cursor = 0 signifie depuis le début (le plus grand score en ZREVRANGE)
	// Dans Redis, on utilise généralement ZRevRange (ou ZRange avec desc) via offset/limit.
	// Pour un vrai cursor basé sur le score avec ZRevRangeByScore, c'est plus complexe.
	// Ici, on utilise l'index (ZRevRange) pour simplifier le scroll infini "basique".
	
	start := cursor
	stop := cursor + int64(limit) - 1

	if desc {
		videoIDs, err = Client.ZRevRange(ctx, key, start, stop).Result()
	} else {
		videoIDs, err = Client.ZRange(ctx, key, start, stop).Result()
	}

	if err != nil {
		return nil, 0, err
	}

	if len(videoIDs) == 0 {
		return []models.VideoMeta{}, cursor, nil
	}

	// Récupérer les métadonnées pour chaque ID
	var videos []models.VideoMeta
	for _, vid := range videoIDs {
		metaKey := fmt.Sprintf("video:meta:%s", vid)
		metaData, err := Client.HGetAll(ctx, metaKey).Result()
		if err == nil && len(metaData) > 0 {
			likes, _ := strconv.Atoi(metaData["like_count"])
			comments, _ := strconv.Atoi(metaData["comment_count"])
			createdAt, _ := strconv.ParseInt(metaData["created_at"], 10, 64)

			videos = append(videos, models.VideoMeta{
				ID:            metaData["id"],
				Title:         metaData["title"],
				Pseudo:        metaData["pseudo"],
				ThumbnailURL:  metaData["thumbnail_url"],
				CloudinaryURL: metaData["cloudinary_url"],
				LikeCount:     likes,
				CommentCount:  comments,
				Status:        metaData["status"],
				Type:          metaData["type"],
				CandidateID:   metaData["candidate_id"],
				CandidateName: metaData["candidate_name"],
				CreatedAt:     createdAt,
			})
		}
	}

	nextCursor := cursor + int64(len(videoIDs))
	if len(videoIDs) < limit {
		nextCursor = -1 // Indique la fin
	}

	return videos, nextCursor, nil
}

// GetRecentFeed récupère le flux récent (trié par timestamp DESC).
func GetRecentFeed(ctx context.Context, eventID string, cursor int64, limit int) ([]models.VideoMeta, int64, error) {
	key := fmt.Sprintf("feed:event:%s:recent", eventID)
	return getFeedHelper(ctx, key, cursor, limit, true)
}

// GetPopularFeed récupère le flux populaire (trié par likes DESC).
func GetPopularFeed(ctx context.Context, eventID string, cursor int64, limit int) ([]models.VideoMeta, int64, error) {
	key := fmt.Sprintf("feed:event:%s:popular", eventID)
	return getFeedHelper(ctx, key, cursor, limit, true)
}
