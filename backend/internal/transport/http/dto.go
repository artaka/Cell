package http

import (
	"cell-api/internal/models"
	"time"

	"github.com/google/uuid"
)

type RegisterRequest struct {
	Username string `json:"username" binding:"required,min=3,max=32"`
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=8,max=32"`
}

type LoginRequest struct {
	Email 		string `json:"email" binding:"required,email"`
	Password 	string `json:"password" binding:"required,min=8,max=32"`
}

type UserResponse struct {
	ID       	uuid.UUID 	`json:"id"`
	Username 	string 		`json:"username"`
	Email    	string 		`json:"email"`
	AvatarURL 	string 		`json:"avatar_url"`
}

type CreateDirectChatRequest struct {
	UserID uuid.UUID `json:"user"`
}

type CreateGroupChatRequest struct {
	Title 	string 		`json:"title"`
	UserIDs []uuid.UUID `json:"user_ids"`
}

type NewChatResponse struct {
	ID 			uuid.UUID 		`json:"id"`
	Type 		models.ChatType `json:"chat_type"`
	Title 		string 			`json:"title"`
	CreatedAt 	time.Time 		`json:"created_at"`
}

type DeleteDirectChatRequest struct {
	UserID uuid.UUID `json:"user"`
}

type GetDirectChatInfoRequest struct {
	UserID uuid.UUID `json:"user"`
}

type GetChatListItemResponse struct {
	ID 				uuid.UUID 			`json:"id"`
	Type 			models.ChatType 	`json:"type"`
	Title 			string 				`json:"title"`
	AvatarURL 		string 				`json:"avatar_url"`
	LastMessage 	MessagePreview 		`json:"last_message"`
	UnreadCount 	int 				`json:"unread_count"`
}

type MessagePreview struct {
	ID 			int64 		`json:"id"`
	SenderID 	uuid.UUID 	`json:"sender_id"`
	Content 	string 		`json:"content"`
	CreatedAt 	time.Time 	`json:"created_at"`
}

type UserPrivew struct {
	ID 			uuid.UUID 	`json:"id"`
	Username 	string 		`json:"username"`
	AvatarURL 	*string 	`json:"avatar_url"`
	IsOnline 	bool 		`json:"is_online"`
}

type DirectChatResponse struct {
	ID 			uuid.UUID 		`json:"id"`
	Type 		models.ChatType `json:"chat_type"`
	CreatedAt 	time.Time 		`json:"created_at"`
	User 		UserPrivew 		`json:"user"`
}

type ChatMemberResponse struct {
	UserID   	uuid.UUID         	`json:"user_id"`
	Username 	string            	`json:"username"`
	AvatarURL 	string 				`json:"avatar_url"`
	Role     	models.MemberRole 	`json:"role"`
	JoinedAt 	time.Time         	`json:"joined_at"`
}

type MessageResponse struct {
	ID        int64     `json:"id"`
	ChatID    uuid.UUID `json:"chat_id"`
	SenderID  uuid.UUID `json:"sender_id"`
	Content   string    `json:"content"`
	CreatedAt time.Time `json:"created_at"`
}

type ChatMessagesResponse struct {
	Messages   []MessageResponse `json:"messages"`
	NextCursor *int64            `json:"next_cursor"`
	HasMore    bool              `json:"has_more"`
}

type PhotoOrVideoUploadResponse struct {
	MediaURL 	string `json:"media_url"`
	MediaType 	string `json:"media_type"`
}