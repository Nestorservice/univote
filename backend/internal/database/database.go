package database

import (
	"log"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// DB est l'instance globale de la base de données.
var DB *gorm.DB

// Connect initialise la connexion PostgreSQL via GORM.
func Connect(databaseURL string) *gorm.DB {
	var err error

	// Configuration du logger GORM
	gormConfig := &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
		NowFunc: func() time.Time {
			return time.Now().UTC()
		},
	}

	// Tentative de connexion avec retry
	maxRetries := 5
	for i := 0; i < maxRetries; i++ {
		DB, err = gorm.Open(postgres.Open(databaseURL), gormConfig)
		if err == nil {
			break
		}
		log.Printf("⏳ Tentative de connexion PostgreSQL %d/%d...", i+1, maxRetries)
		time.Sleep(3 * time.Second)
	}

	if err != nil {
		log.Fatalf("❌ Impossible de se connecter à PostgreSQL: %v", err)
	}

	// Configuration du pool de connexions
	sqlDB, err := DB.DB()
	if err != nil {
		log.Fatalf("❌ Erreur pool de connexions: %v", err)
	}

	sqlDB.SetMaxIdleConns(10)
	sqlDB.SetMaxOpenConns(100)
	sqlDB.SetConnMaxLifetime(time.Hour)
	sqlDB.SetConnMaxIdleTime(10 * time.Minute)

	log.Println("✅ PostgreSQL connecté avec succès")

	return DB
}

// Close ferme la connexion à la base de données.
func Close() {
	if DB != nil {
		sqlDB, err := DB.DB()
		if err != nil {
			log.Printf("⚠️  Erreur lors de la fermeture DB: %v", err)
			return
		}
		sqlDB.Close()
		log.Println("🔒 Connexion PostgreSQL fermée")
	}
}
