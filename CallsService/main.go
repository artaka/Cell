package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
)

func main() {
	cfg := LoadConfig()
	log.Printf("[CallsService] Starting on port %s...", cfg.Port)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// 1. Initialize PostgreSQL database connection
	db, err := NewDatabaseService(ctx, cfg.DBConn)
	if err != nil {
		log.Fatalf("[CallsService] Failed to initialize DB pool: %v", err)
	}
	defer db.Close()

	// 2. Initialize Auth and Room Manager
	auth := NewAuthValidator(cfg.SecretKey)
	roomManager := NewRoomManager()

	// 3. Initialize HTTP/WS Server
	server := NewServer(cfg, auth, db, roomManager)

	mux := http.NewServeMux()

	// Test HTML page
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/" && r.URL.Path != "/index.html" && r.URL.Path != "/calls/" && r.URL.Path != "/calls/index.html" {
			http.NotFound(w, r)
			return
		}
		http.ServeFile(w, r, "index.html")
	})

	// Health check
	mux.HandleFunc("/api/v1/calls/health", server.handleHealth)
	mux.HandleFunc("/health", server.handleHealth)

	// Calls rooms API
	mux.HandleFunc("/api/v1/calls/rooms", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost {
			server.handleCreateRoom(w, r)
		} else {
			server.writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		}
	})
	mux.HandleFunc("/rooms", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost {
			server.handleCreateRoom(w, r)
		} else {
			server.writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		}
	})

	mux.HandleFunc("/api/v1/calls/rooms/", server.handleRoomByID)
	mux.HandleFunc("/rooms/", server.handleRoomByID)

	mux.HandleFunc("/api/v1/calls/active", server.handleGetActiveCall)
	mux.HandleFunc("/active", server.handleGetActiveCall)

	// WebSocket signaling
	mux.HandleFunc("/api/v1/calls/ws", server.handleWebSocket)
	mux.HandleFunc("/ws", server.handleWebSocket)

	httpServer := &http.Server{
		Addr:         fmt.Sprintf(":%s", cfg.Port),
		Handler:      corsMiddleware(mux),
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
	}

	go func() {
		log.Printf("[CallsService] Listening on http://0.0.0.0:%s", cfg.Port)
		if err := httpServer.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("[CallsService] ListenAndServe error: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("[CallsService] Shutting down gracefully...")
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()

	if err := httpServer.Shutdown(shutdownCtx); err != nil {
		log.Printf("[CallsService] Shutdown error: %v", err)
	}
	log.Println("[CallsService] Server exited")
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}