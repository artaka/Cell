package main

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"log"
	"net/http"
	"strings"

	"github.com/gorilla/websocket"
	"github.com/pion/webrtc/v3"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

func generateID() string {
	b := make([]byte, 6)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

type Server struct {
	cfg         *Config
	auth        *AuthValidator
	db          *DatabaseService
	roomManager *RoomManager
}

func NewServer(cfg *Config, auth *AuthValidator, db *DatabaseService, rm *RoomManager) *Server {
	return &Server{
		cfg:         cfg,
		auth:        auth,
		db:          db,
		roomManager: rm,
	}
}

func (s *Server) writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}

func (s *Server) writeError(w http.ResponseWriter, status int, message string) {
	s.writeJSON(w, status, map[string]string{"error": message})
}

func (s *Server) authenticateRequest(r *http.Request) (*Claims, error) {
	token := s.auth.ExtractToken(r)
	if token == "" {
		return nil, http.ErrNoCookie
	}
	return s.auth.ValidateToken(token)
}

type CreateRoomRequest struct {
	ChatID   string `json:"chat_id"`
	CallType string `json:"type"`
}

// POST /api/v1/calls/rooms
func (s *Server) handleCreateRoom(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		s.writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	claims, err := s.authenticateRequest(r)
	if err != nil {
		s.writeError(w, http.StatusUnauthorized, "unauthorized: "+err.Error())
		return
	}

	var req CreateRoomRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	req.ChatID = strings.TrimSpace(req.ChatID)
	if req.ChatID == "" {
		s.writeError(w, http.StatusBadRequest, "chat_id is required")
		return
	}

	// Verify chat membership
	isMember, err := s.db.IsChatMember(r.Context(), req.ChatID, claims.UserID)
	if err != nil {
		log.Printf("[Server] Error checking membership: %v", err)
		s.writeError(w, http.StatusInternalServerError, "database error")
		return
	}
	if !isMember {
		s.writeError(w, http.StatusForbidden, "forbidden: you are not a member of this chat")
		return
	}

	callType := req.CallType
	if callType != "audio" && callType != "video" {
		callType = "video"
	}

	room, created := s.roomManager.GetOrCreateRoom(req.ChatID, claims.UserID, claims.Username, callType)
	info := room.GetInfo()

	statusCode := http.StatusOK
	if created {
		statusCode = http.StatusCreated
	}
	s.writeJSON(w, statusCode, info)
}

// GET /api/v1/calls/active?chat_id=...
func (s *Server) handleGetActiveCall(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		s.writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	claims, err := s.authenticateRequest(r)
	if err != nil {
		s.writeError(w, http.StatusUnauthorized, "unauthorized: "+err.Error())
		return
	}

	chatID := strings.TrimSpace(r.URL.Query().Get("chat_id"))
	if chatID == "" {
		s.writeError(w, http.StatusBadRequest, "chat_id query parameter is required")
		return
	}

	// Verify chat membership
	isMember, err := s.db.IsChatMember(r.Context(), chatID, claims.UserID)
	if err != nil {
		s.writeError(w, http.StatusInternalServerError, "database error")
		return
	}
	if !isMember {
		s.writeError(w, http.StatusForbidden, "forbidden: you are not a member of this chat")
		return
	}

	room := s.roomManager.GetActiveRoomForChat(chatID)
	if room == nil {
		s.writeJSON(w, http.StatusOK, map[string]interface{}{
			"active":  false,
			"chat_id": chatID,
		})
		return
	}

	s.writeJSON(w, http.StatusOK, map[string]interface{}{
		"active": true,
		"room":   room.GetInfo(),
	})
}

// GET /api/v1/calls/rooms/{id} or POST /api/v1/calls/rooms/{id}/end
func (s *Server) handleRoomByID(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/api/v1/calls/rooms/")
	path = strings.TrimPrefix(path, "/rooms/")
	parts := strings.Split(path, "/")
	if len(parts) == 0 || parts[0] == "" {
		s.writeError(w, http.StatusBadRequest, "room ID is required")
		return
	}
	roomID := parts[0]

	claims, err := s.authenticateRequest(r)
	if err != nil {
		s.writeError(w, http.StatusUnauthorized, "unauthorized: "+err.Error())
		return
	}

	room := s.roomManager.GetRoom(roomID)
	if room == nil {
		s.writeError(w, http.StatusNotFound, "room not found")
		return
	}

	// Verify membership in the room's chat
	isMember, err := s.db.IsChatMember(r.Context(), room.chatID, claims.UserID)
	if err != nil {
		s.writeError(w, http.StatusInternalServerError, "database error")
		return
	}
	if !isMember {
		s.writeError(w, http.StatusForbidden, "forbidden: you are not a member of this chat")
		return
	}

	if len(parts) > 1 && parts[1] == "end" {
		if r.Method != http.MethodPost {
			s.writeError(w, http.StatusMethodNotAllowed, "method not allowed")
			return
		}
		s.roomManager.EndRoom(roomID, "ended by user "+claims.Username)
		s.writeJSON(w, http.StatusOK, map[string]interface{}{
			"status":  "ok",
			"message": "call ended",
			"room_id": roomID,
		})
		return
	}

	if r.Method != http.MethodGet {
		s.writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	s.writeJSON(w, http.StatusOK, room.GetInfo())
}

// GET /api/v1/calls/health
func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	activeRooms := s.roomManager.ListActiveRooms()
	s.writeJSON(w, http.StatusOK, map[string]interface{}{
		"status":       "ok",
		"service":      "CallsService",
		"active_rooms": len(activeRooms),
	})
}

// GET /api/v1/calls/ws?token=...&chat_id=...&room_id=...
func (s *Server) handleWebSocket(w http.ResponseWriter, r *http.Request) {
	claims, err := s.authenticateRequest(r)
	if err != nil {
		s.writeError(w, http.StatusUnauthorized, "unauthorized: invalid or missing token")
		return
	}

	chatID := strings.TrimSpace(r.URL.Query().Get("chat_id"))
	roomID := strings.TrimSpace(r.URL.Query().Get("room_id"))

	if chatID == "" && roomID == "" {
		s.writeError(w, http.StatusBadRequest, "chat_id or room_id is required")
		return
	}

	var targetRoom *Room
	if roomID != "" {
		targetRoom = s.roomManager.GetRoom(roomID)
		if targetRoom == nil {
			s.writeError(w, http.StatusNotFound, "room not found")
			return
		}
		chatID = targetRoom.chatID
	}

	// Verify chat membership in DB
	isMember, err := s.db.IsChatMember(r.Context(), chatID, claims.UserID)
	if err != nil {
		log.Printf("[WS] DB error checking membership: %v", err)
		s.writeError(w, http.StatusInternalServerError, "database error")
		return
	}
	if !isMember {
		s.writeError(w, http.StatusForbidden, "forbidden: you are not a member of this chat")
		return
	}

	// If no room by roomID, get or create for chatID
	if targetRoom == nil {
		callType := r.URL.Query().Get("type")
		if callType != "audio" && callType != "video" {
			callType = "video"
		}
		targetRoom, _ = s.roomManager.GetOrCreateRoom(chatID, claims.UserID, claims.Username, callType)
	}

	ws, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("[WS] Upgrade failed: %v", err)
		return
	}
	defer ws.Close()

	config := webrtc.Configuration{
		ICEServers: []webrtc.ICEServer{
			{
				URLs: []string{
					"stun:stun.relay.metered.ca:80",
					"stun:stun.cloudflare.com:3478",
				},
			},
			{
				URLs: []string{
					"turn:global.relay.metered.ca:80",
					"turn:global.relay.metered.ca:80?transport=tcp",
					"turn:global.relay.metered.ca:443",
					"turns:global.relay.metered.ca:443?transport=tcp",
				},
				Username:       "089c7a03d37f148503bd0a37",
				Credential:     "SSaJsDxbP7gSuJDU",
				CredentialType: webrtc.ICECredentialTypePassword,
			},
		},
	}

	mediaEngine := &webrtc.MediaEngine{}
	if err := mediaEngine.RegisterCodec(webrtc.RTPCodecParameters{
		RTPCodecCapability: webrtc.RTPCodecCapability{
			MimeType:     webrtc.MimeTypeOpus,
			ClockRate:    48000,
			Channels:     2,
			SDPFmtpLine:  "minptime=10;useinbandfec=1",
			RTCPFeedback: nil,
		},
		PayloadType: 111,
	}, webrtc.RTPCodecTypeAudio); err != nil {
		log.Printf("[WS] Failed to register Opus codec: %v", err)
	}

	videoRTCPFeedback := []webrtc.RTCPFeedback{
		{Type: "goog-remb", Parameter: ""},
		{Type: "ccm", Parameter: "fir"},
		{Type: "nack", Parameter: ""},
		{Type: "nack", Parameter: "pli"},
	}
	if err := mediaEngine.RegisterCodec(webrtc.RTPCodecParameters{
		RTPCodecCapability: webrtc.RTPCodecCapability{
			MimeType:     webrtc.MimeTypeVP8,
			ClockRate:    90000,
			Channels:     0,
			SDPFmtpLine:  "",
			RTCPFeedback: videoRTCPFeedback,
		},
		PayloadType: 96,
	}, webrtc.RTPCodecTypeVideo); err != nil {
		log.Printf("[WS] Failed to register VP8 codec: %v", err)
	}

	settingEngine := webrtc.SettingEngine{}
	if s.cfg.UDPMinPort > 0 && s.cfg.UDPMaxPort > 0 {
		if err := settingEngine.SetEphemeralUDPPortRange(s.cfg.UDPMinPort, s.cfg.UDPMaxPort); err != nil {
			log.Printf("[WS] Warning: failed to set UDP port range: %v", err)
		}
	}
	if s.cfg.Nat1To1IP != "" {
		settingEngine.SetNAT1To1IPs([]string{s.cfg.Nat1To1IP}, webrtc.ICECandidateTypeHost)
	}

	api := webrtc.NewAPI(
		webrtc.WithSettingEngine(settingEngine),
		webrtc.WithMediaEngine(mediaEngine),
	)
	peerConn, err := api.NewPeerConnection(config)
	if err != nil {
		log.Printf("[WS] NewPeerConnection error: %v", err)
		return
	}
	defer peerConn.Close()

	peerID := generateID()
	peer, err := targetRoom.Join(peerID, claims.UserID, claims.Username, ws, peerConn)
	if err != nil {
		log.Printf("[WS] Room Join error: %v", err)
		return
	}
	defer targetRoom.Leave(peerID)

	peerConn.OnICECandidate(func(c *webrtc.ICECandidate) {
		if c == nil {
			return
		}
		_ = peer.SendJSON(map[string]interface{}{
			"type":      "candidate",
			"candidate": c.ToJSON(),
		})
	})

	peerConn.OnConnectionStateChange(func(state webrtc.PeerConnectionState) {
		log.Printf("[WS] Peer %s connection state changed: %s", peerID, state.String())
		if state == webrtc.PeerConnectionStateFailed || state == webrtc.PeerConnectionStateClosed {
			_ = ws.Close()
		}
	})

	for {
		_, rawMsg, readErr := ws.ReadMessage()
		if readErr != nil {
			break
		}

		var payload map[string]interface{}
		if err := json.Unmarshal(rawMsg, &payload); err != nil {
			continue
		}

		switch payload["type"] {
		case "offer":
			offerSDP, ok := payload["sdp"].(string)
			if !ok {
				continue
			}
			offer := webrtc.SessionDescription{
				Type: webrtc.SDPTypeOffer,
				SDP:  offerSDP,
			}
			if err := peerConn.SetRemoteDescription(offer); err != nil {
				log.Printf("[WS] SetRemoteDescription error: %v", err)
				return
			}

			answer, err := peerConn.CreateAnswer(nil)
			if err != nil {
				log.Printf("[WS] CreateAnswer error: %v", err)
				return
			}

			gatherComplete := webrtc.GatheringCompletePromise(peerConn)
			if err := peerConn.SetLocalDescription(answer); err != nil {
				log.Printf("[WS] SetLocalDescription error: %v", err)
				return
			}
			<-gatherComplete

			_ = peer.SendJSON(map[string]interface{}{
				"type": "answer",
				"sdp":  peerConn.LocalDescription().SDP,
			})

			// Synchronize all room tracks so every participant receives media
			go targetRoom.SyncTracks()

		case "answer":
			if answerSDP, ok := payload["sdp"].(string); ok {
				ans := webrtc.SessionDescription{
					Type: webrtc.SDPTypeAnswer,
					SDP:  answerSDP,
				}
				if err := peerConn.SetRemoteDescription(ans); err != nil {
					log.Printf("[WS] SetRemoteDescription answer error: %v", err)
				}
			}

		case "candidate":
			candMap, _ := json.Marshal(payload["candidate"])
			var init webrtc.ICECandidateInit
			if err := json.Unmarshal(candMap, &init); err == nil {
				_ = peerConn.AddICECandidate(init)
			}

		case "leave":
			return
		}
	}
}
