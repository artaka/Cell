package models

import (
	"time"
	"github.com/google/uuid"
)

type ChatType string
const (
	ChatTypeDirect 		ChatType = "direct"
	ChatTypeGroup 		ChatType = "group"
	ChatTypeChannel 	ChatType = "channel"
)

type MemberRole string
const (
	RoleOwner 	MemberRole = "owner"
	RoleAdmin 	MemberRole = "admin"
	RoleMember 	MemberRole = "member"
)

type Chat struct {
	ID 			uuid.UUID 	`json:"id" db:"id"`
	Type 		ChatType 	`json:"type" db:"type"`
	CreatedAt 	time.Time 	`json:"created_at" db:"created_at"`
}

type DirectChatMetadata struct {
	ChatID 		uuid.UUID `json:"chat_id" db:"chat_id"`
	UserOneID 	uuid.UUID `json:"user_one_id" db:"user_one_id"`
	UserTwoID 	uuid.UUID `json:"user_two_id" db:"user_two_id"`
}

type GroupChatMetadata struct {
	ChatID    uuid.UUID `json:"chat_id" db:"chat_id"`
	Title     string    `json:"title" db:"title"`
	AvatarURL *string   `json:"avatar_url" db:"avatar_url"`
	OwnerID   uuid.UUID `json:"owner_id" db:"owner_id"`
}

type ChatMember struct {
	ChatID 				uuid.UUID 	`json:"chat_id" db:"chat_id"`
	UserID 				uuid.UUID 	`json:"user_id" db:"user_id"`
	Role 				MemberRole 	`json:"role" db:"role"`
	LastReadMessageId 	int64 		`json:"last_read_message_id" db:"last_read_message_id"`
	JoinedAt 			time.Time 	`json:"joined_at" db:"joined_at"`
}

type Message struct {
	ID 			int64 		`json:"id" db:"id"`
	ChatID 		uuid.UUID 	`json:"chat_id" db:"chat_id"`
	SenderID 	uuid.UUID 	`json:"sender_id" db:"sender_id"`
	Content 	string 		`json:"content" db:"content"`
	Created_at 	time.Time 	`json:"created_at" db:"created_at"`
}