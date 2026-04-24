package config

import (
	"log"
	"os"
	"strconv"
	"time"

	"github.com/joho/godotenv"
)

// RefreshExpiry alias pour clarté.
type RefreshExpiry = time.Duration

// Config contient toutes les variables de configuration de l'application.
type Config struct {
	// Server
	Port    string
	GinMode string

	// Database
	DatabaseURL string

	// Redis
	RedisURL string

	// JWT
	JWTSecret        string
	JWTExpiry        time.Duration
	JWTRefreshExpiry time.Duration

	// Notch Pay
	NotchPayPublicKey    string
	NotchPaySecretKey    string
	NotchPayWebhookSecret string
	NotchPayBaseURL      string

	// App
	FrontendURL string
	BackendURL  string

	// Uploads
	UploadMaxSize int64
	UploadDir     string

	// Cloudinary
	CloudinaryCloudName    string
	CloudinaryAPIKey       string
	CloudinaryAPISecret    string
	CloudinaryUploadPreset string
	MediaProvider          string

	// Admin Seed
	AdminEmail    string
	AdminPassword string
}

// Load charge la configuration depuis les variables d'environnement.
func Load() *Config {
	// Charger .env — essaie le dossier courant puis le dossier parent (racine du projet)
	if err := godotenv.Load(); err != nil {
		if err2 := godotenv.Load("../.env"); err2 != nil {
			log.Println("⚠️  Fichier .env non trouvé, utilisation des variables d'environnement système")
		} else {
			log.Println("✅ .env chargé depuis ../.env")
		}
	} else {
		log.Println("✅ .env chargé depuis le dossier courant")
	}

	// Debug: afficher la DATABASE_URL utilisée (masquer le mot de passe en prod)
	dbURL := os.Getenv("DATABASE_URL")
	log.Printf("🔍 DATABASE_URL = %s", dbURL)

	cfg := &Config{
		// Server
		Port:    getEnv("PORT", "8080"),
		GinMode: getEnv("GIN_MODE", "debug"),

		// Database
		DatabaseURL: getEnv("DATABASE_URL", "postgres://univote:password@localhost:5432/univote_db?sslmode=disable"),

		// Redis
		RedisURL: getEnv("REDIS_URL", "redis://localhost:6379"),

		// JWT
		JWTSecret:        getEnv("JWT_SECRET", "default_jwt_secret_change_me_in_production"),
		JWTExpiry:        parseDuration(getEnv("JWT_EXPIRY", "8h")),
		JWTRefreshExpiry: parseDuration(getEnv("JWT_REFRESH_EXPIRY", "168h")),

		// Notch Pay
		NotchPayPublicKey:    getEnv("NOTCHPAY_PUBLIC_KEY", ""),
		NotchPaySecretKey:    getEnv("NOTCHPAY_SECRET_KEY", ""),
		NotchPayWebhookSecret: getEnv("NOTCHPAY_WEBHOOK_SECRET", ""),
		NotchPayBaseURL:      getEnv("NOTCHPAY_BASE_URL", "https://api.notchpay.co"),

		// App
		FrontendURL: getEnv("FRONTEND_URL", "http://localhost:3000"),
		BackendURL:  getEnv("BACKEND_URL", "http://localhost:8080"),

		// Uploads
		UploadMaxSize: parseInt64(getEnv("UPLOAD_MAX_SIZE", "20971520")), // 20 MB
		UploadDir:     getEnv("UPLOAD_DIR", "./uploads"),

		// Cloudinary
		CloudinaryCloudName:    getEnv("CLOUDINARY_CLOUD_NAME", ""),
		CloudinaryAPIKey:       getEnv("CLOUDINARY_API_KEY", ""),
		CloudinaryAPISecret:    getEnv("CLOUDINARY_API_SECRET", ""),
		CloudinaryUploadPreset: getEnv("CLOUDINARY_UPLOAD_PRESET", "univote_videos"),
		MediaProvider:          getEnv("MEDIA_PROVIDER", "cloudinary"),

		// Admin Seed
		AdminEmail:    getEnv("ADMIN_EMAIL", "admin@univote.cm"),
		AdminPassword: getEnv("ADMIN_PASSWORD", ""),
	}

	// Validation critique
	if cfg.JWTSecret == "default_jwt_secret_change_me_in_production" {
		log.Println("⚠️  ATTENTION: Utilisez un JWT_SECRET sécurisé en production !")
	}

	return cfg
}

// getEnv retourne la variable d'environnement ou la valeur par défaut.
func getEnv(key, defaultValue string) string {
	if value, exists := os.LookupEnv(key); exists && value != "" {
		return value
	}
	return defaultValue
}

// parseDuration parse une durée depuis une chaîne (ex: "8h", "168h").
func parseDuration(s string) time.Duration {
	d, err := time.ParseDuration(s)
	if err != nil {
		log.Printf("⚠️  Durée invalide '%s', utilisation de 8h par défaut", s)
		return 8 * time.Hour
	}
	return d
}

// parseInt64 parse un int64 depuis une chaîne.
func parseInt64(s string) int64 {
	v, err := strconv.ParseInt(s, 10, 64)
	if err != nil {
		return 20971520 // 20 MB default
	}
	return v
}
