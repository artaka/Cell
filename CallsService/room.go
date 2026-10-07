package main

import (
	"sync"
	"time"

	"github.com/google/uuid"
)

type RoomInfo struct {
	RoomID        string             `json:"room_id"`
	ChatID        string             `json:"chat_id"`
	CallType      string             `json:"call_type"`
	InitiatorID   string             `json:"initiator_id"`
	InitiatorName string             `json:"initiator_name"`
	CreatedAt     time.Time          `json:"created_at"`
	Participants  []ParticipantInfo  `json:"participants"`
	IsActive      bool               `json:"is_active"`
}

type ParticipantInfo struct {
	PeerID    string    `json:"peer_id"`
	UserID    string    `json:"user_id"`
	Username  string    `json:"username"`
	JoinedAt  time.Time `json:"joined_at"`
}

type RoomManager struct {
	mu        sync.RWMutex
	rooms     map[string]*Room   // roomID -> Room
	chatRooms map[string]string  // chatID -> roomID
}

func NewRoomManager() *RoomManager {
	return &RoomManager{
		rooms:     make(map[string]*Room),
		chatRooms: make(map[string]string),
	}
}

// GetOrCreateRoom returns the active room for the chat, or creates a new one
func (rm *RoomManager) GetOrCreateRoom(chatID, initiatorID, initiatorName, callType string) (*Room, bool) {
	rm.mu.Lock()
	defer rm.mu.Unlock()

	if roomID, exists := rm.chatRooms[chatID]; exists {
		if r, ok := rm.rooms[roomID]; ok && r.isActive {
			return r, false
		}
	}

	if callType == "" {
		callType = "video"
	}

	roomID := uuid.New().String()
	r := &Room{
		id:            roomID,
		chatID:        chatID,
		callType:      callType,
		initiatorID:   initiatorID,
		initiatorName: initiatorName,
		createdAt:     time.Now().UTC(),
		isActive:      true,
		peers:         make(map[string]*Peer),
		manager:       rm,
	}

	rm.rooms[roomID] = r
	rm.chatRooms[chatID] = roomID
	return r, true
}

func (rm *RoomManager) GetRoom(roomID string) *Room {
	rm.mu.RLock()
	defer rm.mu.RUnlock()
	return rm.rooms[roomID]
}

func (rm *RoomManager) GetActiveRoomForChat(chatID string) *Room {
	rm.mu.RLock()
	defer rm.mu.RUnlock()

	roomID, exists := rm.chatRooms[chatID]
	if !exists {
		return nil
	}
	r := rm.rooms[roomID]
	if r != nil && r.isActive {
		return r
	}
	return nil
}

func (rm *RoomManager) EndRoom(roomID, reason string) bool {
	rm.mu.Lock()
	r, exists := rm.rooms[roomID]
	if !exists {
		rm.mu.Unlock()
		return false
	}
	delete(rm.chatRooms, r.chatID)
	delete(rm.rooms, roomID)
	rm.mu.Unlock()

	r.End(reason)
	return true
}

func (rm *RoomManager) onRoomEmpty(roomID, chatID string) {
	rm.mu.Lock()
	defer rm.mu.Unlock()

	// If room has no peers left, remove it from active chat rooms
	if currentRoomID, exists := rm.chatRooms[chatID]; exists && currentRoomID == roomID {
		delete(rm.chatRooms, chatID)
	}
	if r, exists := rm.rooms[roomID]; exists {
		r.isActive = false
		delete(rm.rooms, roomID)
	}
}

func (rm *RoomManager) ListActiveRooms() []RoomInfo {
	rm.mu.RLock()
	defer rm.mu.RUnlock()

	result := make([]RoomInfo, 0, len(rm.rooms))
	for _, r := range rm.rooms {
		if r.isActive {
			result = append(result, r.GetInfo())
		}
	}
	return result
}
