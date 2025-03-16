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
	s3types "github.com/aws/aws-sdk-go-v2/service/s3/types" // since I use this in my code I have to import
)

type S3Service struct {
	s3Client *s3.Client
	bucket   string
}

// type Object struct {
// 	name *string
// 	size *int64
// }

// type Client struct {
// 	options Options
// }

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
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
		Body:   bytes.NewReader(file),
	}

	// Upload the file
	_, err := s.s3Client.PutObject(ctx, input)
	if err != nil {
		return err
	}

	return nil
}

// (*s3.ListObjectsV2Output, error)
func (s *S3Service) ListObjects(ctx context.Context, sub string) ([]s3types.Object, error) {
	input := &s3.ListObjectsV2Input{
		Bucket: aws.String(s.bucket),
		Prefix: aws.String(sub),
	}

	// yes
	out, err := s.s3Client.ListObjectsV2(ctx, input)

	// if error return nil for the output
	if err != nil {
		return nil, err
	}

	// looking at the specific contents of each key
	for idx, obj := range out.Contents {
		// obj.Key is the object "name" in S3. Use aws.ToString to safely convert from *string.
		fmt.Printf("%d) Key: %s, Size: %d, LastModified: %v\n",
			idx,
			aws.ToString(obj.Key),
			obj.Size,
			obj.LastModified,
		)
	}
	// return the list of objects from the output
	return out.Contents, nil
}
