package http

import (
	"cell-api/internal/jwt"
	"cell-api/internal/transport/ws"
	"cell-api/internal/storage"
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Server struct {
	Engine *gin.Engine
	DB     *pgxpool.Pool
	WSHub  *ws.Hub
	Storage *storage.S3Storage
}

func NewServer(db *pgxpool.Pool, hub *ws.Hub, s3 *storage.S3Storage) *Server {
	r := gin.New()

	r.Use(gin.Recovery())

	r.Use(gin.LoggerWithFormatter(func(param gin.LogFormatterParams) string {
		formattedTime := param.TimeStamp.Format("02/01/2006 - 15:04:05.000")

		latencyMs := float64(param.Latency.Microseconds()) / 1000.0

		return fmt.Sprintf("[GIN] %s | %3d | %7.2fms | %15s | %-7s %#v\n%s",
			formattedTime,
			param.StatusCode,
			latencyMs,
			param.ClientIP,
			param.Method,
			param.Path,
			param.ErrorMessage,
		)
	}))

	s := &Server{
		Engine: r,
		DB:     db,
		WSHub:  hub,
		Storage: s3,
	}
	s.setupRoutes()
	return s
}

func (s *Server) setupRoutes() {
	v1 := s.Engine.Group("/api/v1")
	{
		v1.GET("/health", s.handleHealth)
		v1.POST("/auth/register", s.handleRegister)
		v1.POST("/auth/login", s.handleLogin)
		v1.GET("/users/:id", s.handleGetUser)
	}
	wsUpgrade := s.Engine.Group("/api/v1/ws")
	{
		wsUpgrade.GET("/", s.handleWebSocket)
	}
	chatsHandlers := s.Engine.Group("/api/v1/chats")
	chatsHandlers.Use(jwt.AuthMiddleware())
	{
		chatsHandlers.POST("/direct", s.handleCreateDirectChat)
		chatsHandlers.POST("/group", s.handleCreateGroupChat)
		chatsHandlers.GET("/list", s.handleGetChatList)
		chatsHandlers.GET("/:id/members", s.handleGetChatMembers)
		chatsHandlers.GET("/:id/messages", s.handleGetChatMessages)
		chatsHandlers.GET("/users/search", s.handleSearchUsers)
	}
	filesHandlers := s.Engine.Group("/api/v1/files")
	filesHandlers.Use(jwt.AuthMiddleware())
	{
		filesHandlers.POST("/avatar", s.handleUploadAvatar)
		filesHandlers.POST("/chats/:id/avatar", s.handleUploadGroupChatAvatar)
		filesHandlers.POST("/messages/", s.handleUploadPhotoOrVideo)
	}
}

func (s *Server) handleHealth(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status": "ok",
	})
}