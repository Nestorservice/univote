package models

import (
	"time"

	"github.com/google/uuid"
)

// Transaction représente un paiement Mobile Money pour des votes.
type Transaction struct {
	ID              uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	CandidateID     uuid.UUID `gorm:"type:uuid;index" json:"candidate_id" validate:"required"`
	EventID         uuid.UUID `gorm:"type:uuid;index" json:"event_id" validate:"required"`
	PhoneNumber     string    `gorm:"type:varchar(20);not null" json:"phone_number" validate:"required"`
	Operator        string    `gorm:"type:varchar(20)" json:"operator"`
	Amount          int       `gorm:"type:integer;not null" json:"amount" validate:"required,min=1"`
	VoteCount       int       `gorm:"type:integer;not null" json:"vote_count" validate:"required,min=1"`
	NotchPayRef     string    `gorm:"type:varchar(255);uniqueIndex" json:"notchpay_ref"`
	IdempotencyKey  string    `gorm:"type:varchar(255);uniqueIndex" json:"idempotency_key"`
	Status          string    `gorm:"type:varchar(20);default:'pending';index" json:"status"`
	WebhookVerified bool      `gorm:"type:boolean;default:false" json:"webhook_verified"`
	CreatedAt       time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt       time.Time `gorm:"autoUpdateTime" json:"updated_at"`

	// Relations
	Candidate *Candidate `gorm:"foreignKey:CandidateID" json:"candidate,omitempty"`
	Event     *Event     `gorm:"foreignKey:EventID" json:"event,omitempty"`
}

// TableName retourne le nom de la table.
func (Transaction) TableName() string {
	return "transactions"
}

// AuditLog représente une entrée dans le journal d'audit.
type AuditLog struct {
	ID        uuid.UUID  `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	UserID    *uuid.UUID `gorm:"type:uuid;index" json:"user_id"`
	Action    string     `gorm:"type:varchar(255);not null;index" json:"action" validate:"required"`
	Target    string     `gorm:"type:varchar(255)" json:"target"`
	Details   JSON       `gorm:"type:jsonb" json:"details"`
	IPAddress string     `gorm:"type:varchar(50)" json:"ip_address"`
	CreatedAt time.Time  `gorm:"autoCreateTime;index" json:"created_at"`

	// Relations
	User *User `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

// TableName retourne le nom de la table.
func (AuditLog) TableName() string {
	return "audit_logs"
}
