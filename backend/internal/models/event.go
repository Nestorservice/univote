package models

import (
	"database/sql/driver"
	"encoding/json"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Event représente un scrutin (Miss/Master Campus, Délégués, Awards).
type Event struct {
	ID           uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	Title        string         `gorm:"type:varchar(255);not null" json:"title" validate:"required,min=3,max=255"`
	Description  string         `gorm:"type:text" json:"description"`
	Type         string         `gorm:"type:varchar(20);not null;default:'free'" json:"type" validate:"required,oneof=free paid"`
	PricePerVote int            `gorm:"type:integer;default:0" json:"price_per_vote" validate:"min=0"`
	Status       string         `gorm:"type:varchar(20);default:'draft'" json:"status" validate:"oneof=draft open closed"`
	ShowResults  bool           `gorm:"type:boolean;default:false" json:"show_results"`
	OpensAt      *time.Time     `gorm:"type:timestamptz" json:"opens_at"`
	ClosesAt     *time.Time     `gorm:"type:timestamptz" json:"closes_at"`
	BannerURL    string         `gorm:"type:varchar(500)" json:"banner_url"`
	CreatedAt    time.Time      `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt    time.Time      `gorm:"autoUpdateTime" json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`

	// Relations
	Candidates []Candidate `gorm:"foreignKey:EventID;constraint:OnDelete:CASCADE" json:"candidates,omitempty"`
}

// TableName retourne le nom de la table.
func (Event) TableName() string {
	return "events"
}

// Candidate représente un candidat dans un scrutin.
type Candidate struct {
	ID        uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	EventID   uuid.UUID      `gorm:"type:uuid;not null;index" json:"event_id" validate:"required"`
	Name      string         `gorm:"type:varchar(255);not null" json:"name" validate:"required,min=2,max=255"`
	Bio       string         `gorm:"type:text" json:"bio"`
	Dossard   string         `gorm:"type:varchar(20)" json:"dossard"`
	PhotoURL  string         `gorm:"type:varchar(500)" json:"photo_url"`
	Gallery   Gallery        `gorm:"type:jsonb;default:'[]'" json:"gallery"`
	VoteCount int            `gorm:"type:integer;default:0" json:"vote_count"`
	CreatedAt time.Time      `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt time.Time      `gorm:"autoUpdateTime" json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// Relations
	Event *Event `gorm:"foreignKey:EventID" json:"event,omitempty"`
}

// TableName retourne le nom de la table.
func (Candidate) TableName() string {
	return "candidates"
}

// Gallery est un type JSONB pour stocker un tableau d'URLs.
type Gallery []string

// Scan implémente l'interface sql.Scanner pour GORM.
func (g *Gallery) Scan(value interface{}) error {
	if value == nil {
		*g = Gallery{}
		return nil
	}
	bytes, ok := value.([]byte)
	if !ok {
		return nil
	}
	return json.Unmarshal(bytes, g)
}

// Value implémente l'interface driver.Valuer pour GORM.
func (g Gallery) Value() (driver.Value, error) {
	if g == nil {
		return "[]", nil
	}
	bytes, err := json.Marshal(g)
	if err != nil {
		return nil, err
	}
	return string(bytes), nil
}
