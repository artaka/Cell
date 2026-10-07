package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"cell-api/internal/config"
	"cell-api/internal/database"
	"cell-api/internal/storage"
	appHTTP "cell-api/internal/transport/http"
	appWS "cell-api/internal/transport/ws"
)

func main() {
	cfg := config.Load()

	ctx := context.Background()
	dbPool, err := database.NewPGPool(ctx, cfg.DBConn)
	if err != nil {
		slog.Error("Failed to init database", "error", err)
		os.Exit(1)
	}
	defer dbPool.Close()

	wsHub := appWS.NewHub(dbPool)
	go wsHub.Run()

	s3, err := storage.NewS3Storage(
		ctx,
		cfg.S3Endpoint,
		cfg.S3Bucket,
		cfg.S3AccessKey,
		cfg.S3SecretKey,
		cfg.S3PublicURL,
	)
	if err != nil {
		slog.Error("Failed to init s3 connection", "error", err)
	}

	server := appHTTP.NewServer(dbPool, wsHub, s3)

	httpServer := &http.Server{
		Addr:    fmt.Sprintf(":%s", cfg.Port),
		Handler: server.Engine,
	}

	go func() {
		slog.Info("Server running successfully", "port", cfg.Port)
		if err := httpServer.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			slog.Error("Server failed,", "error", err)
			os.Exit(1)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_ = httpServer.Shutdown(ctx)
	slog.Info("Server exited gracefully")
}
