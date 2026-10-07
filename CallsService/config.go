package main

import (
	"os"
	"strconv"
)

type Config struct {
	Port       string
	DBConn     string
	SecretKey  string
	StunServer string
	Nat1To1IP  string
	UDPMinPort uint16
	UDPMaxPort uint16
}

func LoadConfig() *Config {
	minPort, _ := strconv.ParseUint(getEnv("UDP_MIN_PORT", "50000"), 10, 16)
	maxPort, _ := strconv.ParseUint(getEnv("UDP_MAX_PORT", "50050"), 10, 16)

	return &Config{
		Port:       getEnv("PORT", "8000"),
		DBConn:     getEnv("DB_URL", "postgres://celldb:mysuperstrongpassword@localhost:5432/cell_db?sslmode=disable"),
		SecretKey:  getEnv("SECRET_KEY", "super-secret-key123"),
		StunServer: getEnv("STUN_SERVER", "stun:stun.l.google.com:19302"),
		Nat1To1IP:  getEnv("NAT_1TO1_IP", ""),
		UDPMinPort: uint16(minPort),
		UDPMaxPort: uint16(maxPort),
	}
}

func getEnv(key, fallback string) string {
	if val, ok := os.LookupEnv(key); ok && val != "" {
		return val
	}
	return fallback
}
