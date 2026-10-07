package main

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type DatabaseService struct {
	pool *pgxpool.Pool
}

func NewDatabaseService(ctx context.Context, connString string) (*DatabaseService, error) {
	config, err := pgxpool.ParseConfig(connString)
	if err != nil {
		return nil, fmt.Errorf("failed to parse DB connection string: %w", err)
	}

	config.MaxConns = 20
	config.MinConns = 2
	config.MaxConnLifetime = 1 * time.Hour
	config.MaxConnIdleTime = 30 * time.Minute

	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return nil, fmt.Errorf("failed to create connection pool: %w", err)
	}

	pingCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	if err := pool.Ping(pingCtx); err != nil {
		return nil, fmt.Errorf("failed to ping DB: %w", err)
	}

	log.Println("[DB] Successfully connected to PostgreSQL")
	return &DatabaseService{pool: pool}, nil
}

func (d *DatabaseService) Close() {
	if d.pool != nil {
		d.pool.Close()
	}
}

func (d *DatabaseService) IsChatMember(ctx context.Context, chatID, userID string) (bool, error) {
	cUUID, err := uuid.Parse(chatID)
	if err != nil {
		return false, fmt.Errorf("invalid chat UUID: %w", err)
	}
	uUUID, err := uuid.Parse(userID)
	if err != nil {
		return false, fmt.Errorf("invalid user UUID: %w", err)
	}

	query := `
		SELECT EXISTS(
			SELECT 1 FROM chat_members
			WHERE chat_id = $1 AND user_id = $2
		)
	`
	var isMember bool
	err = d.pool.QueryRow(ctx, query, cUUID, uUUID).Scan(&isMember)
	if err != nil {
		return false, fmt.Errorf("database query error: %w", err)
	}

	return isMember, nil
}

func (d *DatabaseService) GetChatMembers(ctx context.Context, chatID string) ([]string, error) {
	cUUID, err := uuid.Parse(chatID)
	if err != nil {
		return nil, fmt.Errorf("invalid chat UUID: %w", err)
	}

	query := `SELECT user_id FROM chat_members WHERE chat_id = $1`
	rows, err := d.pool.Query(ctx, query, cUUID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var members []string
	for rows.Next() {
		var uid uuid.UUID
		if err := rows.Scan(&uid); err == nil {
			members = append(members, uid.String())
		}
	}
	return members, nil
}
