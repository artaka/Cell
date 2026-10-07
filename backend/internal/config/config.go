package config

import (
	"os"
)

type Config struct {
	Port   		string
	AppEnv 		string
	DBConn 		string
	SecretKey 	string
	S3Endpoint 	string
	S3Bucket 	string
	S3AccessKey string
	S3SecretKey string
	S3PublicURL string
}

func Load() *Config {
	return &Config{
		Port:   getEnv("PORT", "8080"),
		AppEnv: getEnv("APP_ENV", "local"),
		DBConn: getEnv("DB_URL", "postgres://celldb:mysuperstrongpassword@localhost:5432/cell_db?sslmode=disable"),
		SecretKey: getEnv("SECRET_KEY", "super-secret-key123"),
		S3Endpoint: getEnv("S3_ENDPOINT", "http://minio"),
		S3Bucket: getEnv("S3_BUCKET", "cell-media"),
		S3AccessKey: getEnv("S3_ACCESS_KEY", "123456789"),
		S3SecretKey: getEnv("S3_SECRET_KEY", "123456789"),
		S3PublicURL: getEnv("S3_PUBLIC_URL", "http://localhost:9000/"),
	}
}

func getEnv(key, fallback string) string {
	if val, ok := os.LookupEnv(key); ok {
		return val
	}
	return fallback
}
