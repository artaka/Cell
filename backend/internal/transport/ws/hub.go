package ws

import (
	"context"
	"log/slog"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Hub struct {
	clients    	map[*Client]bool
	Broadcast  	chan []byte
	Register   	chan *Client
	Unregister 	chan *Client
	SendTo 	   	chan PrivateMessage
	Router 	   	*Router
	clientsIndex map[string]map[*Client]bool
	DB 			*pgxpool.Pool
}

func NewHub(db *pgxpool.Pool) *Hub {
	h := &Hub{
		Broadcast:  make(chan []byte),
		Register:   make(chan *Client),
		Unregister: make(chan *Client),
		SendTo:     make(chan PrivateMessage),
		clients:    make(map[*Client]bool),
		clientsIndex: make(map[string]map[*Client]bool),
		DB: 		db,
	}
	h.Router = NewRouter(h)
	return h
}

func (h *Hub) SendJSONTo(userID string, data []byte) error {
	h.SendTo <- PrivateMessage{
		RecipientID: userID,
		Data: data,
	}
	return nil
}

func (h *Hub) BroadcastToChat(ctx context.Context, chatID uuid.UUID, data []byte, excludeUserID string) {
	query := `
			SELECT user_id
			FROM chat_members
			WHERE chat_id = $1 AND user_id != $2
		`
	rows, err := h.DB.Query(ctx, query, chatID, excludeUserID)
	if err != nil {
		slog.Error("failed to get chat members for broadcast", "err", err)
		return
	}
	defer rows.Close()

	for rows.Next() {
		var memberID uuid.UUID
		if err := rows.Scan(&memberID); err == nil {
			h.SendJSONTo(memberID.String(), data)
		}
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.Register:
			h.clients[client] = true
			if h.clientsIndex[client.UserID] == nil {
							h.clientsIndex[client.UserID] = make(map[*Client]bool)
						}
						h.clientsIndex[client.UserID][client] = true
			slog.Info("WS Client connected", "user_id", client.UserID, "total_clients", len(h.clients))

		case client := <-h.Unregister:
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.Send)

				if userConns, exists := h.clientsIndex[client.UserID]; exists {
									delete(userConns, client)
									if len(userConns) == 0 {
										delete(h.clientsIndex, client.UserID)
									}
								}
				slog.Warn("WS Cliet disconnected", "user_id", client.UserID, "total_clients", len(h.clients))
			}

		case message := <-h.Broadcast:
			for client := range h.clients {
				select {
				case client.Send <- message:
				default:
					close(client.Send)
					delete(h.clients, client)
				}
			}
		case pm := <-h.SendTo:
			conns, exists := h.clientsIndex[pm.RecipientID]
			if !exists {
				slog.Debug("User offline, private message dropped.", "Recipient ID:", pm.RecipientID)
			}
			for client := range conns {
				slog.Info("new private message")
				select{
					case client.Send <- pm.Data:
					default:
						close(client.Send)
						delete(h.clients, client)
						delete(conns, client)
				}
			}
		}
	}
}
