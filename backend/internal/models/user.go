package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// User représente un administrateur du système.
type User struct {
	ID        uuid.UUID      `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	Email     string         `gorm:"type:varchar(255);uniqueIndex;not null" json:"email" validate:"required,email"`
	Password  string         `gorm:"type:varchar(255);not null" json:"-"`
	Role      string         `gorm:"type:varchar(50);default:'admin'" json:"role"`
	CreatedAt time.Time      `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt time.Time      `gorm:"autoUpdateTime" json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// TableName retourne le nom de la table.
func (User) TableName() string {
	return "users"
}
