package storage

import (
	"context"
	"fmt"
	"io"
	"path/filepath"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/google/uuid"
)

type S3Storage struct {
	client *s3.Client
	bucket string
	publicURL string
}

func NewS3Storage(ctx context.Context, endpoint, bucket, accessKey, secretKey, publicURL string) (*S3Storage, error) {
	cfg := aws.Config{
		Region: "us-east-1",
		Credentials: credentials.NewStaticCredentialsProvider(accessKey, secretKey, ""),
	}

	client := s3.NewFromConfig(cfg, func(o *s3.Options) {
		o.BaseEndpoint = aws.String(endpoint)
		o.UsePathStyle = true
	})

	_, _ = client.CreateBucket(ctx, &s3.CreateBucketInput{
		Bucket: aws.String(bucket),
	})
	publicPolicy := fmt.Sprintf(`{
			"Version": "2012-10-17",
			"Statement": [
				{
					"Sid": "PublicReadGetObject",
					"Effect": "Allow",
					"Principal": "*",
					"Action": ["s3:GetObject"],
					"Resource": ["arn:aws:s3:::%s/*"]
				}
			]
		}`, bucket)

		_, err := client.PutBucketPolicy(ctx, &s3.PutBucketPolicyInput{
			Bucket: aws.String(bucket),
			Policy: aws.String(publicPolicy),
		})
		if err != nil {
			return nil, fmt.Errorf("failed to set public bucket policy: %w", err)
		}

	return &S3Storage{
		client: client,
		bucket: bucket,
		publicURL: strings.TrimRight(publicURL, "/"),
	}, nil
}

func (s *S3Storage) UploadFile(
	ctx context.Context,
	fileReader io.Reader,
	filename string,
	contentType string) (string, error) {

	ext := filepath.Ext(filename)
	objKey := fmt.Sprintf("%s%s", uuid.New().String(), ext)

	_, err := s.client.PutObject(ctx, &s3.PutObjectInput{
		Bucket: aws.String(s.bucket),
		Key: aws.String(objKey),
		Body: fileReader,
		ContentType: aws.String(contentType),
	})

	if err != nil {
		return "", fmt.Errorf("failed to put object to s3: %w", err)
	}

	fileURL := fmt.Sprintf("/media/%s", objKey)
	return fileURL, nil
}

func (s *S3Storage) UploadAvatar(
	ctx context.Context,
	fileReader io.Reader,
	contentType string,
	userID uuid.UUID,
	isUserAvatar bool) (string, error) {

	var objKey string
	if isUserAvatar {
		objKey = fmt.Sprintf("avatar-%s", userID)
	} else {
		objKey = fmt.Sprintf("group-avatar-%s", userID)
	}

	_, err := s.client.PutObject(ctx, &s3.PutObjectInput{
		Bucket: aws.String(s.bucket),
		Key: aws.String(objKey),
		Body: fileReader,
		ContentType: aws.String(contentType),
	})

	if err != nil {
		return "", fmt.Errorf("failed to put object to s3: %w", err)
	}

	fileURL := fmt.Sprintf("/media/%s", objKey)
	return fileURL, nil
}