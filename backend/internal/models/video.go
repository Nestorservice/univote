package models

import (
	"time"

	"github.com/google/uuid"
)

const (
	StatusPendingModeration = "pending_moderation"
	StatusApproved          = "approved"
	StatusRejected          = "rejected"
	StatusHiddenReports     = "hidden_reports"
)

// Video représente une vidéo uploadée dans le flux d'un événement.
type Video struct {
	ID                 uuid.UUID  `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	CandidateID        *uuid.UUID `gorm:"type:uuid" json:"candidate_id,omitempty"`
	EventID            uuid.UUID  `gorm:"type:uuid;not null" json:"event_id"`
	UploaderPseudo     string     `gorm:"type:varchar(100);not null" json:"uploader_pseudo"`
	CloudinaryPublicID string     `gorm:"type:varchar(500)" json:"cloudinary_public_id,omitempty"`
	CloudinaryURL      string     `gorm:"type:varchar(1000)" json:"cloudinary_url,omitempty"`
	ThumbnailURL       string     `gorm:"type:varchar(1000)" json:"thumbnail_url,omitempty"`
	DurationSeconds    int        `json:"duration_seconds,omitempty"`
	Title              string     `gorm:"type:varchar(255)" json:"title,omitempty"`
	Status             string     `gorm:"type:varchar(30);default:'pending_moderation'" json:"status"`
	ModerationResult   *JSON      `gorm:"type:jsonb" json:"moderation_result,omitempty"`
	LikeCount          int        `gorm:"default:0" json:"like_count"`
	CommentCount       int        `gorm:"default:0" json:"comment_count"`
	ReportCount        int        `gorm:"default:0" json:"report_count"`
	CreatedAt          time.Time  `json:"created_at"`
	UpdatedAt          time.Time  `json:"updated_at"`

	Candidate *Candidate `gorm:"foreignKey:CandidateID" json:"candidate,omitempty"`
}

// IsPublic vérifie si la vidéo est approuvée et visible par le public.
func (v *Video) IsPublic() bool {
	return v.Status == StatusApproved
}

// VideoComment représente un commentaire laissé sur une vidéo.
type VideoComment struct {
	ID        uuid.UUID  `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	VideoID   uuid.UUID  `gorm:"type:uuid;not null" json:"video_id"`
	Pseudo    string     `gorm:"type:varchar(100);not null" json:"pseudo"`
	EventID   *uuid.UUID `gorm:"type:uuid" json:"event_id,omitempty"`
	Content   string     `gorm:"type:text;not null" json:"content"`
	CreatedAt time.Time  `json:"created_at"`
}

// VideoReport représente un signalement effectué par un utilisateur.
type VideoReport struct {
	ID        uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	VideoID   uuid.UUID `gorm:"type:uuid;not null;uniqueIndex:idx_video_pseudo" json:"video_id"`
	Pseudo    string    `gorm:"type:varchar(100);not null;uniqueIndex:idx_video_pseudo" json:"pseudo"`
	Reason    string    `gorm:"type:varchar(100)" json:"reason,omitempty"`
	CreatedAt time.Time `json:"created_at"`
}

// VideoMeta est une version allégée pour le stockage en cache Redis.
type VideoMeta struct {
	ID            string `json:"id"`
	Title         string `json:"title"`
	Pseudo        string `json:"pseudo"`
	ThumbnailURL  string `json:"thumbnail_url"`
	CloudinaryURL string `json:"cloudinary_url"`
	LikeCount     int    `json:"like_count"`
	CommentCount  int    `json:"comment_count"`
	Status        string `json:"status"`
	CandidateID   string `json:"candidate_id,omitempty"`
	CandidateName string `json:"candidate_name,omitempty"`
	CreatedAt     int64  `json:"created_at"` // Unix timestamp
}
