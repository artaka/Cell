package http

import (
	"net/http"

	"cell-api/internal/jwt"
	"cell-api/internal/transport/ws"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,

	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

func (s *Server) handleWebSocket(c *gin.Context) {
	token := c.DefaultQuery("token", "")
	if token == "" {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error":"access token not found"})
		return
	}

	claims, err := jwt.ValidateToken(token)
	if err != nil {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error":"invalid token"})
		return
	}

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "failed to upgrade to websocket",
		})
		return
	}

	client := &ws.Client{
		Hub:    s.WSHub,
		Conn:   conn,
		Send:   make(chan []byte, 256),
		UserID: claims.UserID,
	}

	client.Hub.Register <- client

	go client.WritePump()
	go client.ReadPump()
}
