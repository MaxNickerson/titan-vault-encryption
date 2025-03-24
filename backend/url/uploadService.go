package url

import (
	"bytes"
	"context"
	"encoding/gob"
	"fmt"
	"io"
	"log"
	"os"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	s3types "github.com/aws/aws-sdk-go-v2/service/s3/types" // since I use this in my code I have to import
	// GetObjectOutput "github.com/aws/aws-sdk-go-v2/service/s3/GetObjectOutput"
)

type S3Service struct {
	s3Client *s3.Client
	bucket   string
}

type EncryptedPackage struct {
	IV            string `json:"iv"`
	Salt          string `json:"salt"`
	EncryptedData string `json:"encryptedData"`
	FileName      string `json:"fileName"`
	FileType      string `json:"fileType"`
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
		fmt.Printf("%d) Key: %s, eTag: %d, Size: %d, LastModified: %v\n",
			idx,
			aws.ToString(obj.Key),
			obj.ETag,
			obj.Size,
			obj.LastModified,
		)
	}
	// return the list of objects from the output
	return out.Contents, nil
}

func (s *S3Service) GetObject(ctx context.Context, obj_name string) (*EncryptedPackage, error) {
	input := &s3.GetObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(obj_name),
	}

	// get the object with the given information, bucket/name_of_file.jpg
	out, err := s.s3Client.GetObject(ctx, input)
	if err != nil {
		return nil, err
	}

	defer out.Body.Close() // close io stream

	// Read all the data
	data, err := io.ReadAll(out.Body)
	if err != nil {
		return nil, err
	}

	fmt.Printf("Retrieved object: %s, content type: %s, size %d bytes\n",
		obj_name,
		aws.ToString(out.ContentType),
		*out.ContentLength)
	// Print the data as bytes
	// fmt.Println(data)
	var network bytes.Buffer
	// Write data to the buffer first
	network.Write(data)

	// Create a decoder from the buffer
	dec := gob.NewDecoder(&network)

	var encPkg EncryptedPackage

	// You need a variable of the correct type to decode into
	err = dec.Decode(&encPkg)
	if err != nil {
		fmt.Println("Error decoding gob data:", err)
	} else {
		fmt.Printf("Decoded object:, %s\nFile type, %s\nIV: %s\nSalt: %s",
			encPkg.FileName, encPkg.FileType, encPkg.IV, encPkg.Salt)
	}

	// should return a json map of the encrypted package back
	return &encPkg, nil

}
