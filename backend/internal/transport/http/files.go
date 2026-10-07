package http

import (
	"net/http"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

const MaxUploadSize = 50 * 1024 * 1024

func (s *Server) handleUploadPhotoOrVideo(c *gin.Context) {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, MaxUploadSize)

	fileHeader, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusRequestEntityTooLarge, gin.H{"error":"file is required or too large"})
		return
	}

	ext := strings.ToLower(filepath.Ext(fileHeader.Filename))
	var mediaType string
	switch ext {
		case ".jpg", ".jpeg", ".png", ".webp", ".gif":
			mediaType = "image"
		case ".mp4", ".mov":
			mediaType = "video"
		case ".webm", ".ogg", ".mp3", ".m4a", ".wav":
    		mediaType = "audio"
		default:
			c.JSON(http.StatusUnprocessableEntity, gin.H{"error": "unsupported file format"})
			return
	}

	src, err := fileHeader.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error":"failed to open file"})
		return
	}
	defer src.Close()

	contentType := fileHeader.Header.Get("Content-Type")
	fileURL, err := s.Storage.UploadFile(c.Request.Context(), src, fileHeader.Filename, contentType)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error":"s3 upload error", "sys":err.Error()})
	}

	c.JSON(http.StatusCreated, PhotoOrVideoUploadResponse{
		MediaURL: fileURL,
		MediaType: mediaType,
	})
}

func (s *Server) handleUploadAvatar(c *gin.Context) {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, MaxUploadSize)
	requstedUserID, _ := uuid.Parse(c.GetString("userID"))

	fileHeader, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusRequestEntityTooLarge, gin.H{"error":"file is required or too large"})
		return
	}
	ext := strings.ToLower(filepath.Ext(fileHeader.Filename))
	mediaType := "avatar"
	if ext != ".jpg" && ext != ".jpeg" && ext != ".webp" && ext != ".gif" {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"error":"avatar must be an image"})
	}

	src, err := fileHeader.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error":"failed to open file"})
		return
	}
	defer src.Close()

	contentType := fileHeader.Header.Get("Content-Type")
	fileURL, err := s.Storage.UploadAvatar(c.Request.Context(), src, contentType, requstedUserID, true)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error":"s3 upload error", "sys":err.Error()})
	}

	c.JSON(http.StatusCreated, PhotoOrVideoUploadResponse{
		MediaURL: fileURL,
		MediaType: mediaType,
	})
}

func (s *Server) handleUploadGroupChatAvatar(c *gin.Context) {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, MaxUploadSize)
	groupIDString := c.Param("id")
	groupID, _ := uuid.Parse(groupIDString)

	fileHeader, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusRequestEntityTooLarge, gin.H{"error":"file is required or too large"})
		return
	}
	ext := strings.ToLower(filepath.Ext(fileHeader.Filename))
	mediaType := "Chat_avatar"
	if ext != ".jpg" && ext != ".jpeg" && ext != ".webp" && ext != ".gif" {
		c.JSON(http.StatusUnprocessableEntity, gin.H{"error":"avatar must be an image"})
	}

	src, err := fileHeader.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error":"failed to open file"})
		return
	}
	defer src.Close()

	contentType := fileHeader.Header.Get("Content-Type")
	fileURL, err := s.Storage.UploadAvatar(c.Request.Context(), src, contentType, groupID, false)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error":"s3 upload error", "sys":err.Error()})
	}

	c.JSON(http.StatusCreated, PhotoOrVideoUploadResponse{
		MediaURL: fileURL,
		MediaType: mediaType,
	})
}