package middleware

import (
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// StaticCacheMiddleware adds Cache-Control headers for static assets.
func StaticCacheMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		path := c.Request.URL.Path

		// Si c'est un fichier statique (js, css, img, vendor)
		if strings.HasPrefix(path, "/css/") ||
			strings.HasPrefix(path, "/js/") ||
			strings.HasPrefix(path, "/img/") ||
			strings.HasPrefix(path, "/vendor/") {
			
			// Cache pendant 7 jours
			c.Header("Cache-Control", "public, max-age=604800")
			c.Header("Expires", time.Now().AddDate(0, 0, 7).Format(time.RFC1123))
		}

		c.Next()
	}
}
