package cache

import (
	"context"
	"log"
	"time"

	"github.com/redis/go-redis/v9"
)

// Client est l'instance globale du client Redis.
var Client *redis.Client

// Connect initialise la connexion Redis.
func Connect(redisURL string) *redis.Client {
	opts, err := redis.ParseURL(redisURL)
	if err != nil {
		log.Fatalf("❌ URL Redis invalide: %v", err)
	}

	// Configuration du pool Redis
	opts.PoolSize = 50
	opts.MinIdleConns = 10
	opts.DialTimeout = 5 * time.Second
	opts.ReadTimeout = 3 * time.Second
	opts.WriteTimeout = 3 * time.Second

	Client = redis.NewClient(opts)

	// Tester la connexion avec retry
	ctx := context.Background()
	maxRetries := 5
	for i := 0; i < maxRetries; i++ {
		_, err = Client.Ping(ctx).Result()
		if err == nil {
			break
		}
		log.Printf("⏳ Tentative de connexion Redis %d/%d...", i+1, maxRetries)
		time.Sleep(2 * time.Second)
	}

	if err != nil {
		log.Fatalf("❌ Impossible de se connecter à Redis: %v", err)
	}

	log.Println("✅ Redis connecté avec succès")

	return Client
}

// Close ferme la connexion Redis.
func Close() {
	if Client != nil {
		if err := Client.Close(); err != nil {
			log.Printf("⚠️  Erreur lors de la fermeture Redis: %v", err)
			return
		}
		log.Println("🔒 Connexion Redis fermée")
	}
}

// IncrBy incrémente atomiquement un compteur Redis.
func IncrBy(ctx context.Context, key string, value int64) (int64, error) {
	return Client.IncrBy(ctx, key, value).Result()
}

// Get retourne la valeur d'une clé Redis.
func Get(ctx context.Context, key string) (string, error) {
	return Client.Get(ctx, key).Result()
}

// Set définit une valeur avec un TTL optionnel (0 = pas d'expiration).
func Set(ctx context.Context, key string, value interface{}, expiration time.Duration) error {
	return Client.Set(ctx, key, value, expiration).Err()
}
