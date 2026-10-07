package http

import (
	"cell-api/internal/jwt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

func (s *Server) handleRegister(c *gin.Context) {
	var req RegisterRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), 12)
	if err != nil {
		c.JSON(
			http.StatusInternalServerError,
			gin.H{
				"error": "failed to hash passsword",
			},
		)
		return
	}

	query := `
		INSERT INTO users(username, email, password)
		VALUES ($1, $2, $3)
		RETURNING id;
	`

	var userID string

	err = s.DB.QueryRow(c.Request.Context(), query, req.Username, req.Email, string(hashedPassword)).Scan(&userID)
	if err != nil {
		c.JSON(
			http.StatusConflict,
			gin.H{
				"error": "user already exist or database error",
			},
		)
		return
	}

	userUUID, err := uuid.Parse(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error":"failed to parse uuid"})
	}

	res := UserResponse{
		ID:       userUUID,
		Username: req.Username,
		Email:    req.Email,
	}
	token, err := jwt.GenerateToken(userID, req.Username)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error":"failed to generate acces token", "sys":err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"user":res,
		"token":token,
	})
}