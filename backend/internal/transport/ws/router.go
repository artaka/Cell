package ws

import (
	"encoding/json"
	"fmt"
)

type HandlerFunc func(client *Client, payload json.RawMessage) error

type Router struct {
	handlers 	map[string]HandlerFunc
	hub 		*Hub
}

func NewRouter(hub *Hub) *Router {
	r := &Router{
		handlers: 	make(map[string]HandlerFunc),
		hub: 		hub,
	}
	r.registerRoutes()
	return r
}

func (r *Router) registerRoutes(){
	r.handlers[string(EventSendMessage)] = handleSendMessage
	r.handlers[string(EventTyping)] = handleTyping
	r.handlers[string(EventRead)] = handleReadMessage
}

func (r *Router) Handle(client *Client, raw []byte) error {
	var req Request
	if err := json.Unmarshal(raw, &req); err != nil {
		return fmt.Errorf("Bad requst format: %w", err)
	}

	handler, exists := r.handlers[req.Action]
	if !exists {
		return fmt.Errorf("Unkwonw action: %s", req.Action)
	}
	return handler(client, req.Payload)
}