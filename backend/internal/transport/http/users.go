package http

import (
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

func (s *Server) handleGetUser(c *gin.Context) {
	userID := c.Param("id")

	query := `
		SELECT id, username, email
		FROM users
		WHERE id = $1
	`
	var user UserResponse

	err := s.DB.QueryRow(c.Request.Context(), query, userID).Scan(
		&user.ID,
		&user.Username,
		&user.Email,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "user not found",
			})
			return
		}

		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "database error",
		})
		return
	}
	user.AvatarURL = "/media/avatar-" + userID

	c.JSON(http.StatusOK, user)
}

func (s *Server) handleSearchUsers(c *gin.Context) {
	currentUserID, err := uuid.Parse(c.GetString("userID"))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	queryParam := strings.TrimSpace(c.Query("q"))
	if len(queryParam) < 2 {
		c.JSON(http.StatusOK, gin.H{"users": []UserResponse{}})
		return
	}

	searchQuery := `
		SELECT id, username, email
		FROM users
		WHERE id != $1
		  AND (username ILIKE '%' || $2 || '%' OR email ILIKE '%' || $2 || '%')
		ORDER BY
			CASE WHEN username ILIKE $2 || '%' THEN 1 ELSE 2 END,
			username ASC
		LIMIT 20;
	`

	rows, err := s.DB.Query(c.Request.Context(), searchQuery, currentUserID, queryParam)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "database error",
			"sys":   err.Error(),
		})
		return
	}
	defer rows.Close()

	users := make([]UserResponse, 0, 20)
	for rows.Next() {
		var u UserResponse
		if err := rows.Scan(&u.ID, &u.Username, &u.Email); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "scan error",
				"sys":   err.Error(),
			})
			return
		}
		u.AvatarURL = "/media/avatar-" + u.ID.String()
		users = append(users, u)
	}

	if err := rows.Err(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "rows iteration error"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"users": users})
}

