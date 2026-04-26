package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-contrib/gzip"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/univote/backend/internal/cache"
	"github.com/univote/backend/internal/config"
	"github.com/univote/backend/internal/database"
	"github.com/univote/backend/internal/handlers"
	"github.com/univote/backend/internal/middleware"
	"github.com/univote/backend/internal/models"
	"github.com/univote/backend/internal/services"
	ws "github.com/univote/backend/internal/websocket"
	"golang.org/x/crypto/bcrypt"
)

func main() {
	// ─── Configuration ──────────────────────────────────────────
	cfg := config.Load()
	gin.SetMode(cfg.GinMode)
	middleware.SetJWTSecret(cfg.JWTSecret)

	// ─── Database ───────────────────────────────────────────────
	db := database.Connect(cfg.DatabaseURL)
	defer database.Close()

	// Auto-migrate les modèles
	db.AutoMigrate(&models.User{}, &models.Event{}, &models.Candidate{},
		&models.Transaction{}, &models.AuditLog{}, &models.Video{},
		&models.Like{}, &models.Comment{}, &models.Report{})

	// ─── Redis ──────────────────────────────────────────────────
	redisClient := cache.Connect(cfg.RedisURL)
	defer cache.Close()

	// ─── Seed Admin ─────────────────────────────────────────────
	seedAdmin(cfg)

	// ─── WebSocket Hub ──────────────────────────────────────────
	wsHub := ws.NewHub()
	go wsHub.Run()

	// ─── Services ───────────────────────────────────────────────
	voteService := services.NewVoteService(db, redisClient,
		cfg.NotchPaySecretKey, cfg.NotchPayBaseURL, cfg.FrontendURL)
	syncService := services.NewSyncService(db, redisClient)

	cldService, err := services.NewCloudinaryService(
		cfg.CloudinaryCloudName, cfg.CloudinaryAPIKey, cfg.CloudinaryAPISecret,
		cfg.CloudinaryUploadPreset, cfg.BackendURL,
	)
	if err != nil {
		log.Printf("⚠️  Erreur Cloudinary (Media upload peut échouer): %v", err)
	}
	videoService := services.NewVideoService(db, cldService)

	// Lancer les tâches en arrière-plan
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go syncService.StartSync(ctx)
	go videoService.SyncLikesToDB(ctx, 60*time.Second)
	go videoService.SyncCommentCountsToDB(ctx, 60*time.Second)
	go videoService.CleanupStaleVideos(ctx, 1*time.Hour)

	// ─── Handlers ───────────────────────────────────────────────
	authHandler := handlers.NewAuthHandler(db, cfg.JWTExpiry, cfg.JWTRefreshExpiry)
	eventHandler := handlers.NewEventHandler(db, cfg.UploadDir)
	candidateHandler := handlers.NewCandidateHandler(db, cfg.UploadDir)
	voteHandler := handlers.NewVoteHandler(voteService)
	webhookHandler := handlers.NewWebhookHandler(db, redisClient, cfg.NotchPayWebhookSecret, wsHub)
	adminHandler := handlers.NewAdminHandler(db)

	videoHandler := handlers.NewVideoHandler(videoService)
	uploadHandler := handlers.NewUploadHandler(videoService, cldService)
	reportHandler := handlers.NewReportHandler(videoService)
	webhookVideoHandler := handlers.NewWebhookVideoHandler(videoService, cldService)

	// ─── Router ─────────────────────────────────────────────────
	router := gin.New()
	router.Use(gin.Recovery())
	router.Use(middleware.RequestLogger())
	router.Use(middleware.CORSMiddleware(cfg.FrontendURL))
	router.Use(middleware.SecurityHeaders())
	router.Use(gzip.Gzip(gzip.DefaultCompression))
	router.Use(middleware.StaticCacheMiddleware())

	// Servir les fichiers uploadés
	router.Static("/uploads", cfg.UploadDir)

	// Servir les fichiers statiques du frontend
	router.Static("/css", "../univote_frontend/css")
	router.Static("/js", "../univote_frontend/js")
	router.Static("/img", "../univote_frontend/img")
	router.Static("/vendor", "../univote_frontend/vendor")

	// Fallback pour les pages HTML à la racine (SPA & pages multiples)
	router.NoRoute(func(c *gin.Context) {
		path := c.Request.URL.Path
		if path == "/" {
			path = "/index.html"
		}
		// On suppose que le binaire est exécuté depuis le dossier racine ou backend/
		// ../univote_frontend fonctionnera si exécuté depuis backend/
		// On fait un check d'existence pour plus de robustesse
		filepath := "../univote_frontend" + path
		if _, err := os.Stat(filepath); err == nil {
			c.File(filepath)
		} else {
			// Essai sans "../" si on est déjà à la racine du projet
			filepath = "./univote_frontend" + path
			if _, err := os.Stat(filepath); err == nil {
				c.File(filepath)
			} else {
				c.JSON(http.StatusNotFound, gin.H{"error": "Resource not found"})
			}
		}
	})

	// Health check
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status": "healthy", "service": "univote-api",
			"time": time.Now().Format(time.RFC3339), "version": "1.0.0",
		})
	})

	// ─── API v1 ─────────────────────────────────────────────────
	v1 := router.Group("/api/v1")

	// Auth
	auth := v1.Group("/auth")
	auth.POST("/login", middleware.AuthRateLimiter(), authHandler.Login)
	auth.POST("/refresh", authHandler.Refresh)
	auth.POST("/logout", middleware.AuthMiddleware(), authHandler.Logout)
	auth.GET("/me", middleware.AuthMiddleware(), authHandler.Me)

	// Events (public)
	v1.GET("/events", eventHandler.ListPublicEvents)
	v1.GET("/events/:id", eventHandler.GetPublicEvent)
	v1.GET("/events/:id/results", eventHandler.GetEventResults)
	v1.GET("/events/:id/feed", videoHandler.GetFeed) // Flux TikTok

	// Candidates (public)
	v1.GET("/candidates/:id", candidateHandler.GetCandidate)

	// Vote & Paiement
	v1.POST("/vote/initiate", middleware.VoteRateLimiter(), voteHandler.InitiateVote)
	v1.GET("/transactions/:ref/status", voteHandler.GetTransactionStatus)

	// Vidéos (public)
	v1.GET("/videos/:id/comments", videoHandler.GetComments)
	v1.POST("/videos/:id/like", middleware.LikeRateLimiter(), videoHandler.LikeVideo)
	v1.POST("/videos/:id/comment", videoHandler.AddComment)
	v1.POST("/upload/request", middleware.UploadRateLimiter(), uploadHandler.RequestSignedURL)
	v1.POST("/report", middleware.ReportRateLimiter(), reportHandler.ReportVideo)

	// Webhooks (pas de rate limit)
	v1.POST("/webhooks/notchpay", webhookHandler.HandleNotchPay)
	v1.POST("/webhook/video-ready", webhookVideoHandler.HandleVideoReady)

	// Admin (JWT + rôle admin requis)
	admin := v1.Group("/admin")
	admin.Use(middleware.AuthMiddleware(), middleware.AdminOnly())
	{
		admin.GET("/dashboard", adminHandler.Dashboard)
		admin.GET("/events", eventHandler.AdminListEvents)
		admin.POST("/events", eventHandler.CreateEvent)
		admin.PUT("/events/:id", eventHandler.UpdateEvent)
		admin.DELETE("/events/:id", eventHandler.DeleteEvent)
		admin.GET("/events/:id/dashboard", adminHandler.EventDashboard)
		admin.POST("/events/:id/candidates", candidateHandler.CreateCandidate)
		admin.PUT("/candidates/:id", candidateHandler.UpdateCandidate)
		admin.DELETE("/candidates/:id", candidateHandler.DeleteCandidate)
		admin.GET("/transactions", adminHandler.ListTransactions)
		admin.GET("/transactions/export", adminHandler.ExportTransactionsCSV)
		admin.GET("/logs", adminHandler.ListAuditLogs)

		// Media Admin
		admin.GET("/videos", videoHandler.AdminListVideos)
		admin.GET("/videos/stats", videoHandler.AdminGetVideoStats)
		admin.GET("/videos/:id", videoHandler.AdminGetVideoDetail)
		admin.PATCH("/videos/:id/approve", videoHandler.AdminApproveVideo)
		admin.PATCH("/videos/:id/reject", videoHandler.AdminRejectVideo)
		admin.DELETE("/videos/:id", videoHandler.AdminDeleteVideo)
	}

	// WebSocket
	router.GET("/ws/events/:id/scores", wsHub.HandleWebSocket)

	// ─── Server ─────────────────────────────────────────────────
	srv := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Graceful shutdown
	go func() {
		log.Printf("🚀 UNI-VOTE API démarré sur le port %s", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("❌ Erreur serveur: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("🛑 Arrêt du serveur...")
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()
	srv.Shutdown(shutdownCtx)
	cancel() // Arrêter la sync Redis
	log.Println("✅ Serveur arrêté proprement")
}

// seedAdmin crée le premier utilisateur admin si la table est vide.
func seedAdmin(cfg *config.Config) {
	db := database.DB
	var count int64
	db.Model(&models.User{}).Count(&count)

	if count == 0 && cfg.AdminEmail != "" && cfg.AdminPassword != "" {
		hash, err := bcrypt.GenerateFromPassword([]byte(cfg.AdminPassword), 12)
		if err != nil {
			log.Printf("⚠️  Erreur hash mot de passe admin: %v", err)
			return
		}
		admin := models.User{
			ID:       uuid.New(),
			Email:    cfg.AdminEmail,
			Password: string(hash),
			Role:     "admin",
		}
		db.Create(&admin)
		log.Printf("✅ Admin seed créé: %s", cfg.AdminEmail)
	}
}
