package http

import (
	"cell-api/internal/jwt"
	"cell-api/internal/models"
	"net/http"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

func (s *Server) handleLogin(c *gin.Context){
	var req LoginRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	searchUserQuery := `
		SELECT id, username, email, password, created_at
		FROM users
		WHERE email = $1
	`

	var user models.User

	ok := s.DB.QueryRow(c.Request.Context(), searchUserQuery, req.Email).
		Scan(&user.Id, &user.Username, &user.Email, &user.Password, &user.CreatedAt)
	if ok != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "user with this email not found",
		})
		return
	}

	isPasswordValidError := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password))
	if isPasswordValidError != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "wrong password",
		})
		return
	}

	token, err := jwt.GenerateToken(user.Id.String(), user.Username)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to generate token",
		})
		return
	}

	res := UserResponse{
		ID: user.Id,
		Username: user.Username,
		Email: user.Email,
		AvatarURL: "/media/avatar-" + user.Id.String(),
	}
	c.JSON(http.StatusOK, gin.H{
		"user": res,
		"token": token,
	})
}