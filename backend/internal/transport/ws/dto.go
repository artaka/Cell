package ws

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type EventType string
const (
	EventSendMessage 	EventType = "message:send"
	EventMessageAck 	EventType = "message:ack"
	EventNewMessage 	EventType = "message:new"
	EventRead 			EventType = "read"
	EventTyping 		EventType = "typing"
)

type Request struct {
	Action string			`json:"action"`
	Payload json.RawMessage `json:"payload,omitempty"`
}

type Response struct {
	Event string 	`json:"event"`
	Payload any 	`json:"payload"`
}

type TypingPayload struct {
	UserID 		uuid.UUID 	`json:"user_id"`
	ChatID 		uuid.UUID 	`json:"chat_id"`
	IsTyping 	bool 		`json:"is_typing"`
}

type SendMessagePayload struct {
	ClientMsgTempID string 		`json:"client_msg_temp_id"`
	ChatID 			uuid.UUID 	`json:"chat_id"`
	Content 		string 		`json:"content"`
}

type NewMessageNotification struct {
	ID 			int64 		`json:"id"`
	ChatID 		uuid.UUID 	`json:"chat_id"`
	SenderID 	uuid.UUID 	`json:"sender_id"`
	Content 	string 		`json:"content"`
	CreatedAt 	time.Time 	`json:"created_at"`
}

type PrivateMessage struct {
	RecipientID string
	Data []byte
}

type MessagAckPayload struct {
	ClientMsgTempID string 		`json:"client_msg_temp_id"`
	MessageID 		int64 		`json:"message_id"`
	ChatID 			uuid.UUID 	`json:"chat_id"`
	CreatedAt 		time.Time 	`json:"created_at"`
}

type ReadPayload struct {
	ChatID 		uuid.UUID 	`json:"chat_id"`
	MessageID 	int64 		`json:"message_id"`
}

type ReadNotification struct {
	UserID 		uuid.UUID 	`json:"user_id"`
	ChatID 		uuid.UUID 	`json:"chat_id"`
	MessageID 	int64 		`json:"message_id"`
}

type ErrorPayload struct {
	ClientMsgTempID string `json:"client_msg_temp_id,omitempty"`
	Error 			string `json:"error"`
}