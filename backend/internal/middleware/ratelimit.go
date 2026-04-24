package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// RateLimiter implémente un rate limiter par IP basé sur le token bucket.
type RateLimiter struct {
	visitors map[string]*visitor
	mu       sync.RWMutex
	rate     int           // requêtes autorisées
	window   time.Duration // fenêtre de temps
}

type visitor struct {
	count    int
	lastSeen time.Time
}

// NewRateLimiter crée un nouveau rate limiter.
func NewRateLimiter(rate int, window time.Duration) *RateLimiter {
	rl := &RateLimiter{
		visitors: make(map[string]*visitor),
		rate:     rate,
		window:   window,
	}

	// Goroutine de nettoyage toutes les minutes
	go rl.cleanup()

	return rl
}

// cleanup supprime les visiteurs expirés.
func (rl *RateLimiter) cleanup() {
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		rl.mu.Lock()
		for ip, v := range rl.visitors {
			if time.Since(v.lastSeen) > rl.window*2 {
				delete(rl.visitors, ip)
			}
		}
		rl.mu.Unlock()
	}
}

// isAllowed vérifie si une IP est autorisée à faire une requête.
func (rl *RateLimiter) isAllowed(ip string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	v, exists := rl.visitors[ip]
	if !exists {
		rl.visitors[ip] = &visitor{count: 1, lastSeen: time.Now()}
		return true
	}

	// Réinitialiser si la fenêtre est expirée
	if time.Since(v.lastSeen) > rl.window {
		v.count = 1
		v.lastSeen = time.Now()
		return true
	}

	// Vérifier la limite
	if v.count >= rl.rate {
		return false
	}

	v.count++
	v.lastSeen = time.Now()
	return true
}

// Middleware retourne un middleware Gin pour le rate limiting.
func (rl *RateLimiter) Middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		ip := c.ClientIP()

		if !rl.isAllowed(ip) {
			c.JSON(http.StatusTooManyRequests, gin.H{
				"success": false,
				"error":   "Trop de requêtes. Veuillez réessayer dans quelques instants.",
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

// VoteRateLimiter crée un rate limiter pour les votes (10 req/min par IP).
func VoteRateLimiter() gin.HandlerFunc {
	limiter := NewRateLimiter(10, time.Minute)
	return limiter.Middleware()
}

// AuthRateLimiter crée un rate limiter pour l'authentification (5 req/min par IP).
func AuthRateLimiter() gin.HandlerFunc {
	limiter := NewRateLimiter(5, time.Minute)
	return limiter.Middleware()
}

// UploadRateLimiter crée un rate limiter pour les uploads (3 req/heure par IP).
func UploadRateLimiter() gin.HandlerFunc {
	limiter := NewRateLimiter(3, time.Hour)
	return limiter.Middleware()
}

// ReportRateLimiter crée un rate limiter pour les signalements (20 req/heure par IP).
func ReportRateLimiter() gin.HandlerFunc {
	limiter := NewRateLimiter(20, time.Hour)
	return limiter.Middleware()
}

// LikeRateLimiter crée un rate limiter pour les likes (100 req/minute par IP).
func LikeRateLimiter() gin.HandlerFunc {
	limiter := NewRateLimiter(100, time.Minute)
	return limiter.Middleware()
}
