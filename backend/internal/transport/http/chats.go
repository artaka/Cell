package http

import (
	"bytes"
	"cell-api/internal/models"
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

func (s *Server) handleCreateDirectChat(c *gin.Context) {
	var req CreateDirectChatRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	requstedUserID, _ := uuid.Parse(c.GetString("userID"))
	if req.UserID == requstedUserID {
		c.JSON(http.StatusConflict, gin.H{"error":"cannot create chat with yourself"})
		return
	}

	userOne, userTwo := requstedUserID, req.UserID
    if bytes.Compare(userOne[:], userTwo[:]) > 0 {
        userOne, userTwo = userTwo, userOne
    }

    checkQuery := `
    WITH target_user AS (
        SELECT id, username
        FROM users
        WHERE id = $1
    ),
    existing_chat AS (
        SELECT chat_id
        FROM direct_chat_metadata
        WHERE user_one_id = $2 AND user_two_id = $3
    )
    SELECT
        tu.id,
        tu.username,
        ec.chat_id
    FROM target_user tu
    LEFT JOIN existing_chat ec ON true;
    `

    var (
        targetUser models.User
        existingChatID *uuid.UUID
    )

    err := s.DB.QueryRow(c.Request.Context(), checkQuery, req.UserID, userOne, userTwo).
        Scan(&targetUser.Id, &targetUser.Username, &existingChatID)

    if err != nil {
        if errors.Is(err, pgx.ErrNoRows) {
            c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
            return
        }
        c.JSON(http.StatusInternalServerError, gin.H{"error": "database error", "sys": err.Error()})
        return
    }

    if existingChatID != nil {
        c.JSON(http.StatusOK, gin.H{
            "message": "chat already exists",
            "chat_id": *existingChatID,
        })
        return
    }

	createDirectChatQuery := `
	WITH new_chat AS (
		INSERT INTO chats (type)
		VALUES ('direct')
		RETURNING id, type, created_at
	),
	new_meta AS (
		INSERT INTO direct_chat_metadata (chat_id, user_one_id, user_two_id)
		SELECT id, $1, $2 FROM new_chat
	),
	members AS (
		INSERT INTO chat_members (chat_id, user_id)
		SELECT id, $1 FROM new_chat
		UNION ALL
		SELECT id, $2 FROM new_chat
	)
	SELECT id, type, created_at FROM new_chat
	`

	var newChatInfo models.Chat
	err = s.DB.QueryRow(c.Request.Context(), createDirectChatQuery, userOne, userTwo).
		Scan(
			&newChatInfo.ID,
			&newChatInfo.Type,
			&newChatInfo.CreatedAt,
		)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":"database error",
			"sys":err.Error(),
		})
		return
	}

	avatarURL := "/media/avatar-" + targetUser.Id.String()
	c.JSON(http.StatusCreated, DirectChatResponse{
		ID: newChatInfo.ID,
		Type: newChatInfo.Type,
		CreatedAt: newChatInfo.CreatedAt,
		User: UserPrivew{
			ID: targetUser.Id,
			Username: targetUser.Username,
			AvatarURL: &avatarURL,
			IsOnline: true,
		},
	})
}

func (s *Server) handleCreateGroupChat(c *gin.Context) {
	var req CreateGroupChatRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error":"bad request body"})
	}

	creatorID, err := uuid.Parse(c.GetString("userID"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "error while parsing uuid", "sys":err.Error()})
		return
	}

	if len(req.Title) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error":"chat title cannot be empty"})
		return
	}
	memberMap := make(map[uuid.UUID]struct{})
	for _, id := range req.UserIDs {
		if id != creatorID {
			memberMap[id] = struct{}{}
		}
	}

	otherMemberIDs := make([]uuid.UUID, 0, len(memberMap))
	for id := range memberMap {
		otherMemberIDs = append(otherMemberIDs, id)
	}

	createGroupQuery := `
		WITH new_chat AS (
			INSERT INTO chats (type)
			VALUES ('group')
			RETURNING id, type, created_at
		),
		new_meta AS (
			INSERT INTO group_chat_metadata (chat_id, title, owner_id)
			SELECT id, $1, $2 FROM new_chat
		),
		add_owner AS (
			INSERT INTO chat_members (chat_id, user_id, role)
			SELECT id, $2, 'owner' FROM new_chat
		),
		add_members AS (
			INSERT INTO chat_members (chat_id, user_id, role)
			SELECT nc.id, m.user_id, 'member'
			FROM new_chat nc
			CROSS JOIN UNNEST($3::uuid[]) AS m(user_id)
		)
		SELECT id, type, created_at FROM new_chat;
	`

	var newChat models.Chat
	err = s.DB.QueryRow(c.Request.Context(), createGroupQuery, req.Title, creatorID, otherMemberIDs).
		Scan(
			&newChat.ID,
			&newChat.Type,
			&newChat.CreatedAt,
		)
	if err != nil {
		c.JSON(
			http.StatusInternalServerError,
			gin.H{
				"error":"database error",
				"sys": err.Error(),
			},
		)
		return
	}

	c.JSON(http.StatusCreated, NewChatResponse{
		ID: newChat.ID,
		Type: newChat.Type,
		Title: req.Title,
		CreatedAt: newChat.CreatedAt,
	})
}

func (s *Server) handleGetChatList(c *gin.Context) {
	currentUserID, err := uuid.Parse(c.GetString("userID"))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	query := `
		SELECT
			c.id AS chat_id,
			c.type,
			CASE
				WHEN c.type = 'direct' THEN other_user.username
				ELSE COALESCE(gm.title, 'Группа')
			END AS title,
			other_user.id AS other_user_id,
			lm.id AS last_message_id,
			lm.sender_id AS last_message_sender_id,
			lm.content AS last_message_content,
			lm.created_at AS last_message_created_at,
			COALESCE(unread.count, 0) AS unread_count,
			COALESCE(lm.created_at, c.created_at) AS updated_at
		FROM chat_members cm
		JOIN chats c ON c.id = cm.chat_id
		LEFT JOIN direct_chat_metadata dm ON dm.chat_id = c.id AND c.type = 'direct'
		LEFT JOIN users other_user ON other_user.id = (
			CASE
				WHEN dm.user_one_id = $1 THEN dm.user_two_id
				ELSE dm.user_one_id
			END
		)
		LEFT JOIN group_chat_metadata gm ON gm.chat_id = c.id AND c.type = 'group'
		LEFT JOIN LATERAL (
			SELECT id, sender_id, content, created_at
			FROM messages
			WHERE chat_id = c.id
			ORDER BY id DESC
			LIMIT 1
		) lm ON true
		LEFT JOIN LATERAL (
			SELECT COUNT(*) AS count
			FROM messages
			WHERE chat_id = c.id AND id > cm.last_read_message_id
		) unread ON true
		WHERE cm.user_id = $1
		ORDER BY updated_at DESC;
	`

	rows, err := s.DB.Query(c.Request.Context(), query, currentUserID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "database error",
			"sys":   err.Error(),
		})
		return
	}
	defer rows.Close()

	chatList := make([]GetChatListItemResponse, 0)

	for rows.Next() {
		var (
			item             GetChatListItemResponse
			otherUserID      *uuid.UUID
			lastMsgID        *int64
			lastMsgSenderID  *uuid.UUID
			lastMsgContent   *string
			lastMsgCreatedAt *time.Time
			updatedAt        time.Time
		)

		err := rows.Scan(
			&item.ID,
			&item.Type,
			&item.Title,
			&otherUserID,
			&lastMsgID,
			&lastMsgSenderID,
			&lastMsgContent,
			&lastMsgCreatedAt,
			&item.UnreadCount,
			&updatedAt,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "scan error",
				"sys":   err.Error(),
			})
			return
		}

		if item.Type == models.ChatTypeGroup {
			item.AvatarURL = "/media/group-avatar-" + item.ID.String()
		} else if otherUserID != nil {
			item.AvatarURL = "/media/avatar-" + otherUserID.String()
		}

		if lastMsgID != nil {
			item.LastMessage = MessagePreview{
				ID:        *lastMsgID,
				SenderID:  *lastMsgSenderID,
				Content:   *lastMsgContent,
				CreatedAt: *lastMsgCreatedAt,
			}
		}

		chatList = append(chatList, item)
	}

	if err := rows.Err(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "rows error", "sys": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"chats": chatList,
	})
}

func (s *Server) handleGetChatMembers(c *gin.Context) {
	chatID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid chat_id"})
		return
	}

	currentUserID, err := uuid.Parse(c.GetString("userID"))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	query := `
	WITH user_check AS (
		SELECT 1 FROM chat_members WHERE chat_id = $1 AND user_id = $2
	)
	SELECT
		cm.user_id,
		u.username,
		cm.role,
		cm.joined_at
	FROM chat_members cm
	JOIN users u ON u.id = cm.user_id
	WHERE cm.chat_id = $1 AND EXISTS (SELECT 1 FROM user_check)
	ORDER BY
		CASE cm.role
			WHEN 'owner' THEN 1
			WHEN 'admin' THEN 2
			ELSE 3
		END,
		cm.joined_at ASC;
	`

	rows, err := s.DB.Query(c.Request.Context(), query, chatID, currentUserID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database error", "sys": err.Error()})
		return
	}
	defer rows.Close()

	members := make([]ChatMemberResponse, 0)
	for rows.Next() {
		var m ChatMemberResponse
		if err := rows.Scan(&m.UserID, &m.Username, &m.Role, &m.JoinedAt); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "scan error", "sys": err.Error()})
			return
		}
		m.AvatarURL = "/media/avatar-" + m.UserID.String()
		members = append(members, m)
	}

	if len(members) == 0 {
		c.JSON(http.StatusForbidden, gin.H{"error": "access denied or chat not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"members": members})
}

func (s *Server) handleGetChatMessages(c *gin.Context) {
	chatID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid chat_id"})
		return
	}

	currentUserID, err := uuid.Parse(c.GetString("userID"))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	limit := 30
	if l := c.Query("limit"); l != "" {
		if parsedLimit, err := strconv.Atoi(l); err == nil && parsedLimit > 0 && parsedLimit <= 100 {
			limit = parsedLimit
		}
	}

	var cursor int64
	if cur := c.Query("cursor"); cur != "" {
		cursor, _ = strconv.ParseInt(cur, 10, 64)
	}

	query := `
	WITH is_member AS (
		SELECT 1 FROM chat_members WHERE chat_id = $1 AND user_id = $2
	)
	SELECT id, chat_id, sender_id, content, created_at
	FROM messages
	WHERE chat_id = $1
	  AND ($3::bigint = 0 OR id < $3)
	  AND EXISTS (SELECT 1 FROM is_member)
	ORDER BY id DESC
	LIMIT $4;
	`

	rows, err := s.DB.Query(c.Request.Context(), query, chatID, currentUserID, cursor, limit+1)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database error", "sys": err.Error()})
		return
	}
	defer rows.Close()

	messages := make([]MessageResponse, 0, limit)
	for rows.Next() {
		var m MessageResponse
		if err := rows.Scan(&m.ID, &m.ChatID, &m.SenderID, &m.Content, &m.CreatedAt); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "scan error", "sys": err.Error()})
			return
		}
		messages = append(messages, m)
	}

	if len(messages) == 0 && cursor == 0 {
		var isMember bool
		_ = s.DB.QueryRow(c.Request.Context(),
			"SELECT EXISTS(SELECT 1 FROM chat_members WHERE chat_id = $1 AND user_id = $2)",
			chatID, currentUserID,
		).Scan(&isMember)

		if !isMember {
			c.JSON(http.StatusForbidden, gin.H{"error": "access denied or chat not found"})
			return
		}
	}

	hasMore := len(messages) > limit
	var nextCursor *int64

	if hasMore {
		messages = messages[:limit]
		lastID := messages[len(messages)-1].ID
		nextCursor = &lastID
	}

	c.JSON(http.StatusOK, ChatMessagesResponse{
		Messages:   messages,
		NextCursor: nextCursor,
		HasMore:    hasMore,
	})
}