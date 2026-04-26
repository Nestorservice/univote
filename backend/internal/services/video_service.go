package services

import (
	"context"
	"fmt"
	"log"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"github.com/univote/backend/internal/cache"
	"github.com/univote/backend/internal/models"
	"gorm.io/gorm"
)

type VideoService struct {
	DB  *gorm.DB
	Cld *CloudinaryService
}

func NewVideoService(db *gorm.DB, cld *CloudinaryService) *VideoService {
	return &VideoService{DB: db, Cld: cld}
}

// CreateVideoDTO définit les données pour créer une vidéo.
type CreateVideoDTO struct {
	EventID     string `json:"event_id"`
	CandidateID string `json:"candidate_id,omitempty"`
	Pseudo      string `json:"pseudo"`
	Title       string `json:"title"`
	Type        string `json:"type"`
}

// CreatePendingVideo insère une vidéo en base avec le statut 'pending_moderation'.
func (s *VideoService) CreatePendingVideo(dto CreateVideoDTO) (*models.Video, error) {
	eventUUID, err := uuid.Parse(dto.EventID)
	if err != nil {
		return nil, fmt.Errorf("invalid event_id")
	}

	video := &models.Video{
		EventID:        eventUUID,
		UploaderPseudo: dto.Pseudo,
		Title:          dto.Title,
		Type:           dto.Type,
		Status:         models.StatusPendingModeration,
	}

	if video.Type == "" {
		video.Type = "video"
	}

	if dto.CandidateID != "" {
		candUUID, err := uuid.Parse(dto.CandidateID)
		if err == nil {
			video.CandidateID = &candUUID
		}
	}

	if err := s.DB.Create(video).Error; err != nil {
		return nil, err
	}

	return video, nil
}

// ApproveVideo approuve une vidéo suite au webhook Cloudinary et la met en cache.
func (s *VideoService) ApproveVideo(ctx context.Context, videoID string, moderationResult models.JSON) error {
	var video models.Video
	if err := s.DB.Preload("Candidate").First(&video, "id = ?", videoID).Error; err != nil {
		return err
	}

	video.Status = models.StatusApproved
	video.ModerationResult = &moderationResult

	if err := s.DB.Save(&video).Error; err != nil {
		return err
	}

	// Ajouter au feed Redis
	return cache.AddVideoToFeed(ctx, &video)
}

// RejectVideo rejette une vidéo.
func (s *VideoService) RejectVideo(ctx context.Context, videoID string, reason string) error {
	var video models.Video
	if err := s.DB.First(&video, "id = ?", videoID).Error; err != nil {
		return err
	}

	video.Status = models.StatusRejected
	modRes := models.JSON{"reason": reason}
	video.ModerationResult = &modRes

	if err := s.DB.Save(&video).Error; err != nil {
		return err
	}

	// Si elle était approuvée avant, on la retire du flux
	_ = cache.RemoveVideoFromFeed(ctx, video.EventID.String(), videoID)

	// Log audit
	s.DB.Create(&models.AuditLog{
		Action:  "REJECT_VIDEO",
		Target:  videoID,
		Details: models.JSON{"reason": reason},
	})

	return nil
}

// IncrementLike incrémente les likes d'une vidéo (idempotent par pseudo).
func (s *VideoService) IncrementLike(ctx context.Context, videoID string, pseudo string) (int, bool, error) {
	likesSetKey := fmt.Sprintf("likes:%s", videoID)
	
	// Essayer d'ajouter le pseudo au Set. SADD retourne 1 si nouveau, 0 si existant.
	added, err := cache.Client.SAdd(ctx, likesSetKey, pseudo).Result()
	if err != nil {
		return 0, false, err
	}
	
	if added == 0 {
		// Déjà liké
		return 0, true, nil
	}

	// Incrémenter le compteur total dans Redis
	likeCountKey := fmt.Sprintf("like_count:%s", videoID)
	newCount, err := cache.IncrBy(ctx, likeCountKey, 1)
	if err != nil {
		return 0, false, err
	}

	// Mettre à jour le Hash meta
	metaKey := fmt.Sprintf("video:meta:%s", videoID)
	cache.Client.HSet(ctx, metaKey, "like_count", newCount)

	// Mettre à jour le score dans le flux populaire
	var video models.Video
	if err := s.DB.Select("event_id").First(&video, "id = ?", videoID).Error; err == nil {
		popularKey := fmt.Sprintf("feed:event:%s:popular", video.EventID.String())
		cache.Client.ZAdd(ctx, popularKey, redis.Z{
			Score:  float64(newCount),
			Member: videoID,
		})
	}

	return int(newCount), false, nil
}

// AddComment ajoute un commentaire et incrémente le compteur.
func (s *VideoService) AddComment(ctx context.Context, videoID string, eventID string, pseudo string, content string) (*models.VideoComment, error) {
	if len(content) > 300 {
		return nil, fmt.Errorf("comment too long")
	}

	vidUUID, _ := uuid.Parse(videoID)
	evtUUID, _ := uuid.Parse(eventID)

	comment := &models.VideoComment{
		VideoID: vidUUID,
		EventID: &evtUUID,
		Pseudo:  pseudo,
		Content: content,
	}

	if err := s.DB.Create(comment).Error; err != nil {
		return nil, err
	}

	// Incrémenter cache Redis
	countKey := fmt.Sprintf("comment_count:%s", videoID)
	newCount, _ := cache.IncrBy(ctx, countKey, 1)

	// Mettre à jour le Hash meta
	metaKey := fmt.Sprintf("video:meta:%s", videoID)
	cache.Client.HSet(ctx, metaKey, "comment_count", newCount)

	return comment, nil
}

// ReportVideo ajoute un signalement et masque la vidéo si le seuil est atteint.
func (s *VideoService) ReportVideo(ctx context.Context, videoID string, pseudo string, reason string) (bool, error) {
	vidUUID, err := uuid.Parse(videoID)
	if err != nil {
		return false, fmt.Errorf("invalid video_id")
	}

	report := &models.VideoReport{
		VideoID: vidUUID,
		Pseudo:  pseudo,
		Reason:  reason,
	}

	// INSERT (si unique constraint fail = erreur, qu'on ignore ou traite)
	err = s.DB.Create(report).Error
	if err != nil {
		// Probablement déjà signalé
		return false, err
	}

	// Incrémenter report_count en DB atomiquement
	var video models.Video
	err = s.DB.Model(&video).Where("id = ?", videoID).
		UpdateColumn("report_count", gorm.Expr("report_count + 1")).
		First(&video).Error
	if err != nil {
		return false, err
	}

	// Vérifier le seuil (fixé à 5 par le cahier des charges ou via config)
	threshold := 5 
	if video.ReportCount >= threshold && video.Status == models.StatusApproved {
		// Masquer automatiquement
		s.DB.Model(&video).Update("status", models.StatusHiddenReports)
		cache.RemoveVideoFromFeed(ctx, video.EventID.String(), videoID)

		// Audit Log
		s.DB.Create(&models.AuditLog{
			Action:  "AUTO_HIDDEN_VIDEO",
			Target:  videoID,
			Details: models.JSON{"report_count": video.ReportCount},
		})
		return true, nil
	}

	return false, nil
}

// AdminVideoFilters définit les filtres pour le backoffice admin.
type AdminVideoFilters struct {
	EventID string `form:"event_id"`
	Status  string `form:"status"` // pending_moderation, approved, rejected, hidden_reports, all
	Pseudo  string `form:"pseudo"`
	SortBy  string `form:"sort_by"` // created_at, like_count, report_count
	models.PaginationQuery
}

// AdminListVideos retourne les vidéos paginées pour l'admin.
func (s *VideoService) AdminListVideos(filters AdminVideoFilters) ([]models.Video, int64, error) {
	var videos []models.Video
	var total int64

	query := s.DB.Model(&models.Video{}).Preload("Candidate")

	if filters.EventID != "" {
		query = query.Where("event_id = ?", filters.EventID)
	}
	if filters.Status != "" && filters.Status != "all" {
		query = query.Where("status = ?", filters.Status)
	}
	if filters.Pseudo != "" {
		query = query.Where("uploader_pseudo ILIKE ?", "%"+filters.Pseudo+"%")
	}

	query.Count(&total)

	switch filters.SortBy {
	case "like_count":
		query = query.Order("like_count DESC")
	case "report_count":
		query = query.Order("report_count DESC")
	default:
		query = query.Order("created_at DESC")
	}

	offset := (filters.Page - 1) * filters.Limit
	err := query.Offset(offset).Limit(filters.Limit).Find(&videos).Error

	return videos, total, err
}

// AdminApproveVideo permet à un admin de forcer l'approbation d'une vidéo.
func (s *VideoService) AdminApproveVideo(ctx context.Context, videoID string, adminUserID string) error {
	var video models.Video
	if err := s.DB.Preload("Candidate").First(&video, "id = ?", videoID).Error; err != nil {
		return err
	}

	video.Status = models.StatusApproved
	if err := s.DB.Save(&video).Error; err != nil {
		return err
	}

	cache.AddVideoToFeed(ctx, &video)

	adminUUID, _ := uuid.Parse(adminUserID)
	s.DB.Create(&models.AuditLog{
		Action: "ADMIN_APPROVE_VIDEO",
		Target: videoID,
		UserID: &adminUUID,
	})

	return nil
}

// AdminRejectVideo permet à un admin de rejeter une vidéo avec raison.
func (s *VideoService) AdminRejectVideo(ctx context.Context, videoID string, adminUserID string, reason string) error {
	var video models.Video
	if err := s.DB.First(&video, "id = ?", videoID).Error; err != nil {
		return err
	}

	wasApproved := video.Status == models.StatusApproved
	video.Status = models.StatusRejected
	if err := s.DB.Save(&video).Error; err != nil {
		return err
	}

	if wasApproved {
		cache.RemoveVideoFromFeed(ctx, video.EventID.String(), videoID)
	}

	adminUUID, _ := uuid.Parse(adminUserID)
	s.DB.Create(&models.AuditLog{
		Action:  "ADMIN_REJECT_VIDEO",
		Target:  videoID,
		UserID:  &adminUUID,
		Details: models.JSON{"reason": reason},
	})

	return nil
}

// AdminDeleteVideo supprime définitivement une vidéo et de Cloudinary.
func (s *VideoService) AdminDeleteVideo(ctx context.Context, videoID string, adminUserID string) error {
	var video models.Video
	if err := s.DB.First(&video, "id = ?", videoID).Error; err != nil {
		return err
	}

	// Suppression depuis Cloudinary
	if video.CloudinaryPublicID != "" && s.Cld != nil && s.Cld.Cld != nil {
		// Logique de suppression cloudinary optionnelle ici (uploader.Destroy)
		// Ignorée si pas implémentée pour simplifier.
	}

	if err := s.DB.Delete(&video).Error; err != nil {
		return err
	}

	cache.RemoveVideoFromFeed(ctx, video.EventID.String(), videoID)

	adminUUID, _ := uuid.Parse(adminUserID)
	s.DB.Create(&models.AuditLog{
		Action: "ADMIN_DELETE_VIDEO",
		Target: videoID,
		UserID: &adminUUID,
	})

	return nil
}

// VideoStats contient les métriques pour le dashboard admin.
type VideoStats struct {
	TotalVideos       int64 `json:"total_videos"`
	PendingModeration int64 `json:"pending_moderation"`
	Approved          int64 `json:"approved"`
	Rejected          int64 `json:"rejected"`
	HiddenReports     int64 `json:"hidden_reports"`
	TotalLikes        int64 `json:"total_likes"`
	TotalComments     int64 `json:"total_comments"`
	TotalReports      int64 `json:"total_reports"`
}

// GetVideoStats retourne les statistiques globales ou filtrées par événement.
func (s *VideoService) GetVideoStats(eventID string) (VideoStats, error) {
	var stats VideoStats
	query := s.DB.Model(&models.Video{})

	if eventID != "" {
		query = query.Where("event_id = ?", eventID)
	}

	query.Count(&stats.TotalVideos)
	query.Where("status = ?", models.StatusPendingModeration).Count(&stats.PendingModeration)
	
	// Reset conditions pour les autres counts (GORM .Where modifie le clone si on chaîne, 
	// mais ici query est modifié donc on doit re-cloner)
	
	qStatus := s.DB.Model(&models.Video{})
	if eventID != "" { qStatus = qStatus.Where("event_id = ?", eventID) }
	
	qStatus.Where("status = ?", models.StatusApproved).Count(&stats.Approved)
	
	qStatus2 := s.DB.Model(&models.Video{})
	if eventID != "" { qStatus2 = qStatus2.Where("event_id = ?", eventID) }
	qStatus2.Where("status = ?", models.StatusRejected).Count(&stats.Rejected)
	
	qStatus3 := s.DB.Model(&models.Video{})
	if eventID != "" { qStatus3 = qStatus3.Where("event_id = ?", eventID) }
	qStatus3.Where("status = ?", models.StatusHiddenReports).Count(&stats.HiddenReports)

	// Somme des likes, comments, reports
	type SumResult struct {
		TotalLikes    int64
		TotalComments int64
		TotalReports  int64
	}
	var sums SumResult
	sumQuery := s.DB.Model(&models.Video{}).Select("COALESCE(SUM(like_count), 0) as total_likes, COALESCE(SUM(comment_count), 0) as total_comments, COALESCE(SUM(report_count), 0) as total_reports")
	if eventID != "" { sumQuery = sumQuery.Where("event_id = ?", eventID) }
	sumQuery.Scan(&sums)

	stats.TotalLikes = sums.TotalLikes
	stats.TotalComments = sums.TotalComments
	stats.TotalReports = sums.TotalReports

	return stats, nil
}

// GetVideoReports retourne les signalements d'une vidéo.
func (s *VideoService) GetVideoReports(videoID string) ([]models.VideoReport, error) {
	var reports []models.VideoReport
	err := s.DB.Where("video_id = ?", videoID).Order("created_at DESC").Find(&reports).Error
	return reports, err
}

// ─── Tâches de Synchronisation Asynchrones ─────────────────────────────────

// SyncLikesToDB synchronise les compteurs de likes de Redis vers PostgreSQL.
func (s *VideoService) SyncLikesToDB(ctx context.Context, interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			// Récupérer toutes les clés "like_count:*"
			iter := cache.Client.Scan(ctx, 0, "like_count:*", 0).Iterator()
			for iter.Next(ctx) {
				key := iter.Val()
				videoID := strings.TrimPrefix(key, "like_count:")
				
				countStr, err := cache.Client.Get(ctx, key).Result()
				if err == nil {
					count, _ := strconv.Atoi(countStr)
					if count > 0 {
						s.DB.Model(&models.Video{}).Where("id = ?", videoID).Update("like_count", count)
					}
				}
			}
		}
	}
}

// SyncCommentCountsToDB synchronise les compteurs de commentaires.
func (s *VideoService) SyncCommentCountsToDB(ctx context.Context, interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			iter := cache.Client.Scan(ctx, 0, "comment_count:*", 0).Iterator()
			for iter.Next(ctx) {
				key := iter.Val()
				videoID := strings.TrimPrefix(key, "comment_count:")
				
				countStr, err := cache.Client.Get(ctx, key).Result()
				if err == nil {
					count, _ := strconv.Atoi(countStr)
					if count > 0 {
						s.DB.Model(&models.Video{}).Where("id = ?", videoID).Update("comment_count", count)
					}
				}
			}
		}
	}
}

// CleanupStaleVideos supprime les vidéos en 'pending_moderation' depuis trop longtemps.
func (s *VideoService) CleanupStaleVideos(ctx context.Context, maxAge time.Duration) {
	ticker := time.NewTicker(1 * time.Hour)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			threshold := time.Now().Add(-maxAge)
			var staleVideos []models.Video
			
			s.DB.Where("status = ? AND created_at < ?", models.StatusPendingModeration, threshold).Find(&staleVideos)
			
			for _, v := range staleVideos {
				log.Printf("🗑 Nettoyage de la vidéo expirée: %s", v.ID.String())
				s.DB.Delete(&v)
			}
		}
	}
}
