package jwt

import (
	"net/http"
	"strings"
	"github.com/gin-gonic/gin"
)

func AuthMiddleware() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		authHeader := ctx.GetHeader("Authorization")
		if authHeader == "" {
			ctx.JSON(http.StatusUnauthorized, gin.H{"error":"Authorization Header required"})
			ctx.Abort()
			return
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			ctx.JSON(http.StatusUnauthorized, gin.H{"error":"Bad Authorization header format"})
			ctx.Abort()
			return
		}

		claims, err := ValidateToken(parts[1])
		if err != nil {
			ctx.JSON(http.StatusUnauthorized, gin.H{"error":err.Error()})
			ctx.Abort()
			return
		}
		ctx.Set("userID", claims.UserID)
		ctx.Set("username", claims.Username)
		ctx.Next()
	}
}