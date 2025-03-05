package url

import (
	"bytes"
	"context"
	"fmt"
	"log"
	"os"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

type S3Service struct {
	s3Client *s3.Client
	bucket   string
}

func NewR2Service() (*S3Service, error) {

	// var accountId = os.Getenv("ACCESS_KEY_ID")
	bucketName := "test-bucket"
	accessKeyId := os.Getenv("ACCESS_KEY_ID")
	accessKeySecret := os.Getenv("SECRET_ACCESS_KEY")
	accountId := os.Getenv("CLOUDFLARE_ACCOUNT_ID")

	cfg, err := config.LoadDefaultConfig(context.TODO(),
		config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(accessKeyId, accessKeySecret, "")),
		config.WithRegion("auto"),
	)
	if err != nil {
		log.Fatal(err)
	}

	// Create cloudflare R2 CLIENT
	s3Client := s3.NewFromConfig(cfg, func(o *s3.Options) {
		o.BaseEndpoint = aws.String(fmt.Sprintf("https://%s.r2.cloudflarestorage.com", accountId))
	})

	// retrun the type
	return &S3Service{
		s3Client: s3Client,
		bucket:   bucketName,
	}, nil
}

// Function to upload file to Cloudflare R2 Storage
func (s *S3Service) UploadFileToR2(ctx context.Context, key string, file []byte) error {
	input := &s3.PutObjectInput{
		Bucket:      aws.String(s.bucket),
		Key:         aws.String(key),
		Body:        bytes.NewReader(file),
		ContentType: aws.String("image/jpeg"),
	}

	// Upload the file
	_, err := s.s3Client.PutObject(ctx, input)
	if err != nil {
		return err
	}

	return nil
}

// func main() {
// 	// Initialize the Cloudflare R2 service
// 	s3Service, err := NewR2Service()
// 	if err != nil {
// 	 log.Fatal(err)
// 	}

// 	// Upload a sample file
// 	err = s3Service.UploadFileToR2(context.TODO(), "image.jpg", []byte("test"))
// 	if err != nil {
// 	 log.Fatal(err)
// 	}
// }
