package ws

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"strconv"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

func handleSendMessage(c *Client, raw json.RawMessage) error {
	var p SendMessagePayload
	if err := json.Unmarshal(raw, &p); err != nil {
		return SendClientError(c, "", "invalid payload format")
	}

	if len(p.Content) == 0 {
		return SendClientError(c, p.ClientMsgTempID, "message content cannot be empty")
	}

	userUUID, err := uuid.Parse(c.UserID)
	if err != nil {
		return SendClientError(c, p.ClientMsgTempID, "invalid sender user id")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	insertMessageQuery := `
		INSERT INTO messages (chat_id, sender_id, content)
		SELECT $1, $2, $3
		WHERE EXISTS (
			SELECT 1 FROM chat_members
			WHERE chat_id = $1 AND user_id = $2
		)
		RETURNING id, created_at;
	`

	var (
		messageID int64
		createdAt time.Time
	)
	err = c.Hub.DB.QueryRow(ctx, insertMessageQuery, p.ChatID, userUUID, p.Content).
		Scan(&messageID, &createdAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return SendClientError(c, p.ClientMsgTempID, "forbidden: you are not a member of this chat")
		}
		slog.Error("DB error while inserting message", "err", err)
		return SendClientError(c, p.ClientMsgTempID, "internal server error")
	}

	ackResp := Response{
		Event: string(EventMessageAck),
		Payload: MessagAckPayload{
			ClientMsgTempID: p.ClientMsgTempID,
			MessageID: messageID,
			ChatID: p.ChatID,
			CreatedAt: createdAt,
		},
	}
	ackBytes, _ := json.Marshal(ackResp)
	c.Send <- ackBytes

	newMessageNotification := Response{
		Event: string(EventNewMessage),
		Payload: NewMessageNotification{
			ID: messageID,
			ChatID: p.ChatID,
			SenderID: userUUID,
			Content: p.Content,
			CreatedAt: createdAt,
		},
	}
	notifyBytes, _ := json.Marshal(newMessageNotification)

	go c.Hub.BroadcastToChat(context.Background(), p.ChatID, notifyBytes, c.UserID)
	return nil
}

func handleTyping(c *Client, raw json.RawMessage) error {
	var p TypingPayload
	if err := json.Unmarshal(raw, &p); err != nil {
		return SendClientError(c, "", "invalid payload format")
	}
	if p.UserID == uuid.Nil {
		return SendClientError(c, "", "invalid user_id")
	}

	typingResp := Response{
		Event:   string(EventTyping),
		Payload: p,
	}
	typingBytes, _ := json.Marshal(typingResp)

	go c.Hub.BroadcastToChat(context.Background(), p.ChatID, typingBytes, c.UserID)
	return nil
}

func handleReadMessage(c *Client, raw json.RawMessage) error {
	var p ReadPayload
	if err := json.Unmarshal(raw, &p); err != nil {
		return SendClientError(c, "", "invalid payload format")
	}

	currentUser, err := uuid.Parse(c.UserID)
	if err != nil {
		return SendClientError(c, strconv.FormatInt(p.MessageID, 10), "invalid user id")
	}
	UpdateCursorQuery := `
		UPDATE chat_members
		SET last_read_message_id = $1
		WHERE chat_id = $2
		AND user_id = $3
		AND last_read_message_id < $1
	`

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, err = c.Hub.DB.Exec(ctx, UpdateCursorQuery, p.MessageID, p.ChatID, currentUser)
	if err != nil {
		slog.Error("DB error while updating last read message", "err", err)
		return SendClientError(c, strconv.FormatInt(p.MessageID, 10), "error while updating last readed message")
	}

	readResp := Response{
		Event: string(EventRead),
		Payload: ReadNotification{
			UserID:    currentUser,
			MessageID: p.MessageID,
			ChatID:    p.ChatID,
		},
	}
	resBytes, _ := json.Marshal(readResp)
	go c.Hub.BroadcastToChat(context.Background(), p.ChatID, resBytes, c.UserID)
	return nil
}

func SendClientError(c *Client, tempID string, errMsg string) error {
	resp := Response {
		Event: "error",
		Payload: ErrorPayload {
			ClientMsgTempID: tempID,
			Error: errMsg,
		},
	}
	data, _ := json.Marshal(resp)
	c.Send <- data
	return nil
}