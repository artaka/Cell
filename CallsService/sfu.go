package main

import (
	"log"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/pion/rtcp"
	"github.com/pion/webrtc/v3"
)

type Peer struct {
	id         string
	userID     string
	username   string
	ws         *websocket.Conn
	wsMu       sync.Mutex
	pc         *webrtc.PeerConnection
	audioTrack *webrtc.TrackLocalStaticRTP
	videoTrack        *webrtc.TrackLocalStaticRTP
	incomingVideoSSRC uint32
	senders           map[string][]*webrtc.RTPSender // target peerID -> its senders in our connection
	joinedAt   time.Time
}

func (p *Peer) SendJSON(v interface{}) error {
	p.wsMu.Lock()
	defer p.wsMu.Unlock()
	if p.ws == nil {
		return nil
	}
	return p.ws.WriteJSON(v)
}

func (p *Peer) Renegotiate() {
	p.wsMu.Lock()
	defer p.wsMu.Unlock()

	if p.pc == nil || p.pc.ConnectionState() == webrtc.PeerConnectionStateClosed {
		return
	}

	offer, err := p.pc.CreateOffer(nil)
	if err != nil {
		log.Printf("[WS] Peer %s CreateOffer error: %v", p.id, err)
		return
	}

	gatherComplete := webrtc.GatheringCompletePromise(p.pc)
	if err := p.pc.SetLocalDescription(offer); err != nil {
		log.Printf("[WS] Peer %s SetLocalDescription error: %v", p.id, err)
		return
	}
	<-gatherComplete

	_ = p.ws.WriteJSON(map[string]interface{}{
		"type": "offer",
		"sdp":  p.pc.LocalDescription().SDP,
	})
	log.Printf("[WS] Sent renegotiation offer to Peer %s (%s)", p.id, p.username)
}

func (p *Peer) Close() {
	p.wsMu.Lock()
	if p.ws != nil {
		_ = p.ws.Close()
		p.ws = nil
	}
	p.wsMu.Unlock()

	if p.pc != nil {
		_ = p.pc.Close()
	}
}

type Room struct {
	id            string
	chatID        string
	callType      string
	initiatorID   string
	initiatorName string
	createdAt     time.Time
	isActive      bool
	mu            sync.Mutex
	peers         map[string]*Peer
	manager       *RoomManager
}

func (r *Room) GetInfo() RoomInfo {
	r.mu.Lock()
	defer r.mu.Unlock()

	participants := make([]ParticipantInfo, 0, len(r.peers))
	for _, p := range r.peers {
		participants = append(participants, ParticipantInfo{
			PeerID:   p.id,
			UserID:   p.userID,
			Username: p.username,
			JoinedAt: p.joinedAt,
		})
	}

	return RoomInfo{
		RoomID:        r.id,
		ChatID:        r.chatID,
		CallType:      r.callType,
		InitiatorID:   r.initiatorID,
		InitiatorName: r.initiatorName,
		CreatedAt:     r.createdAt,
		Participants:  participants,
		IsActive:      r.isActive,
	}
}

func (r *Room) Join(id, userID, username string, ws *websocket.Conn, pc *webrtc.PeerConnection) (*Peer, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	streamID := "stream-" + id
	audio, err := webrtc.NewTrackLocalStaticRTP(
		webrtc.RTPCodecCapability{MimeType: webrtc.MimeTypeOpus},
		"audio-"+id, streamID,
	)
	if err != nil {
		return nil, err
	}

	video, err := webrtc.NewTrackLocalStaticRTP(
		webrtc.RTPCodecCapability{MimeType: webrtc.MimeTypeVP8},
		"video-"+id, streamID,
	)
	if err != nil {
		return nil, err
	}

	currentPeer := &Peer{
		id:         id,
		userID:     userID,
		username:   username,
		ws:         ws,
		pc:         pc,
		audioTrack: audio,
		videoTrack: video,
		senders:    make(map[string][]*webrtc.RTPSender),
		joinedAt:   time.Now().UTC(),
	}

	r.peers[id] = currentPeer

	// Prepare participants list for room-info
	participantsList := make([]map[string]interface{}, 0, len(r.peers))
	for _, p := range r.peers {
		participantsList = append(participantsList, map[string]interface{}{
			"peer_id":   p.id,
			"user_id":   p.userID,
			"username":  p.username,
			"stream_id": "stream-" + p.id,
		})
	}

	// Send room-info to newly connected peer
	_ = currentPeer.SendJSON(map[string]interface{}{
		"type":         "room-info",
		"room_id":      r.id,
		"chat_id":      r.chatID,
		"call_type":    r.callType,
		"peer_id":      id,
		"stream_id":    streamID,
		"participants": participantsList,
	})

	// Broadcast user-joined to all other peers
	for _, other := range r.peers {
		if other.id == id {
			continue
		}
		_ = other.SendJSON(map[string]interface{}{
			"type":      "user-joined",
			"room_id":   r.id,
			"peer_id":   id,
			"user_id":   userID,
			"username":  username,
			"stream_id": streamID,
		})
	}

	// Media forwarding
	pc.OnTrack(func(remoteTrack *webrtc.TrackRemote, receiver *webrtc.RTPReceiver) {
		isVideo := remoteTrack.Kind() == webrtc.RTPCodecTypeVideo
		ssrc := uint32(remoteTrack.SSRC())
		log.Printf("[Room %s] OnTrack received from %s (%s): kind=%s, codec=%s, ssrc=%d, id=%s",
			r.id, id, username, remoteTrack.Kind().String(), remoteTrack.Codec().MimeType, ssrc, remoteTrack.ID())

		if isVideo {
			currentPeer.wsMu.Lock()
			currentPeer.incomingVideoSSRC = ssrc
			currentPeer.wsMu.Unlock()

			// Immediately request a keyframe (PLI) so subscribers receive picture without delay
			_ = pc.WriteRTCP([]rtcp.Packet{
				&rtcp.PictureLossIndication{MediaSSRC: ssrc},
			})

			// Periodically request PLI every 2 seconds to refresh keyframes
			go func() {
				ticker := time.NewTicker(2 * time.Second)
				defer ticker.Stop()
				for range ticker.C {
					if pc.ConnectionState() == webrtc.PeerConnectionStateClosed {
						return
					}
					_ = pc.WriteRTCP([]rtcp.Packet{
						&rtcp.PictureLossIndication{MediaSSRC: ssrc},
					})
				}
			}()
		}

		for {
			packet, _, readErr := remoteTrack.ReadRTP()
			if readErr != nil {
				log.Printf("[Room %s] ReadRTP finished on track %s: %v", r.id, remoteTrack.ID(), readErr)
				break
			}

			if isVideo {
				if err := currentPeer.videoTrack.WriteRTP(packet); err != nil {
				}
			} else {
				if err := currentPeer.audioTrack.WriteRTP(packet); err != nil {
				}
			}
		}
	})

	return currentPeer, nil
}

// SyncTracks ensures all peers in the room send tracks to each other and renegotiates if needed
func (r *Room) SyncTracks() {
	r.mu.Lock()
	peersList := make([]*Peer, 0, len(r.peers))
	for _, p := range r.peers {
		peersList = append(peersList, p)
	}
	r.mu.Unlock()

	for _, p1 := range peersList {
		needsRenegotiation := false
		for _, p2 := range peersList {
			if p1.id == p2.id {
				continue
			}

			p1.wsMu.Lock()
			_, exists := p1.senders[p2.id]
			if !exists {
				sA, errA := p1.pc.AddTrack(p2.audioTrack)
				sV, errV := p1.pc.AddTrack(p2.videoTrack)
				if errA == nil && errV == nil {
					go discardRTCP(sA)
					go r.forwardRTCP(p2.id, sV)
					p1.senders[p2.id] = []*webrtc.RTPSender{sA, sV}
					needsRenegotiation = true

					// Ask p2 (the camera owner) for a keyframe so p1 gets an immediate frame
					p2.wsMu.Lock()
					videoSSRC := p2.incomingVideoSSRC
					p2.wsMu.Unlock()
					if videoSSRC != 0 {
						_ = p2.pc.WriteRTCP([]rtcp.Packet{
							&rtcp.PictureLossIndication{MediaSSRC: videoSSRC},
						})
					}
				} else {
					log.Printf("[WS] AddTrack error from %s to %s: audio=%v, video=%v", p2.id, p1.id, errA, errV)
				}
			}
			p1.wsMu.Unlock()
		}

		if needsRenegotiation {
			go p1.Renegotiate()
		}
	}
}

// Leave removes peer and notifies others
func (r *Room) Leave(id string) {
	r.mu.Lock()
	leavingPeer, ok := r.peers[id]
	if !ok {
		r.mu.Unlock()
		return
	}
	delete(r.peers, id)
	remainingCount := len(r.peers)
	r.mu.Unlock()

	log.Printf("[Room %s] Peer %s (User %s) left. Remaining peers: %d", r.id, id, leavingPeer.userID, remainingCount)

	r.mu.Lock()
	for _, other := range r.peers {
		if sendersList, exists := other.senders[id]; exists {
			for _, s := range sendersList {
				_ = other.pc.RemoveTrack(s)
			}
			delete(other.senders, id)
		}

		_ = other.SendJSON(map[string]interface{}{
			"type":      "user-left",
			"room_id":   r.id,
			"peer_id":   id,
			"user_id":   leavingPeer.userID,
			"username":  leavingPeer.username,
			"id":        "stream-" + id,
			"remaining": remainingCount,
		})
	}
	r.mu.Unlock()

	leavingPeer.Close()

	if remainingCount == 0 && r.manager != nil {
		r.manager.onRoomEmpty(r.id, r.chatID)
	}
}

// End terminates the entire room for all participants
func (r *Room) End(reason string) {
	r.mu.Lock()
	r.isActive = false
	peersToClose := make([]*Peer, 0, len(r.peers))
	for _, p := range r.peers {
		peersToClose = append(peersToClose, p)
	}
	r.peers = make(map[string]*Peer)
	r.mu.Unlock()

	log.Printf("[Room %s] Call ended. Reason: %s", r.id, reason)

	for _, p := range peersToClose {
		_ = p.SendJSON(map[string]interface{}{
			"type":    "call-ended",
			"room_id": r.id,
			"reason":  reason,
		})
		p.Close()
	}
}

func (r *Room) forwardRTCP(targetPeerID string, sender *webrtc.RTPSender) {
	if sender == nil {
		return
	}
	for {
		packets, _, err := sender.ReadRTCP()
		if err != nil {
			return
		}

		for _, pkt := range packets {
			switch pkt.(type) {
			case *rtcp.PictureLossIndication, *rtcp.FullIntraRequest:
				r.mu.Lock()
				producer, ok := r.peers[targetPeerID]
				var producerSSRC uint32
				var producerPC *webrtc.PeerConnection
				if ok && producer != nil {
					producer.wsMu.Lock()
					producerSSRC = producer.incomingVideoSSRC
					producerPC = producer.pc
					producer.wsMu.Unlock()
				}
				r.mu.Unlock()

				if producerPC != nil && producerSSRC != 0 {
					_ = producerPC.WriteRTCP([]rtcp.Packet{
						&rtcp.PictureLossIndication{MediaSSRC: producerSSRC},
					})
				}
			}
		}
	}
}

func discardRTCP(sender *webrtc.RTPSender) {
	if sender == nil {
		return
	}
	buf := make([]byte, 1500)
	for {
		if _, _, err := sender.Read(buf); err != nil {
			return
		}
	}
}