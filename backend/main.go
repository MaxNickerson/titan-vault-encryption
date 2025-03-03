package main

import (
	auth "backend/auth"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/cognitoidentityprovider"
	"github.com/joho/godotenv"
)

func main() {
	// Load environment variables from .env file
	err := godotenv.Load()
	if err != nil {
		log.Fatalf("Error loading .env file: %v", err)
	}
	// url.ListObjects()

	mux := http.NewServeMux()
	mux.HandleFunc("/login", loginHandler)
	mux.HandleFunc("/verify", auth.TokenVerify)
	mux.HandleFunc("/subextract", auth.ReturnSub)

	fmt.Println("Server is running on port 8080")
	log.Fatal(http.ListenAndServe(":8080", enableCors(mux)))
}

// enableCors is a middleware function to set CORS headers
func enableCors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "http://localhost:3000")
		w.Header().Set("Access-Control-Allow-Credentials", "true")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// loginHandler handles the POST request to /login
func loginHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Invalid request method", http.StatusMethodNotAllowed)
		return
	}

	var creds struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}

	// Decode request body into creds
	if err := json.NewDecoder(r.Body).Decode(&creds); err != nil {
		http.Error(w, "Invalid JSON payload", http.StatusBadRequest)
		return
	}

	// Debug log (remove in production)
	fmt.Printf("Received login: Email=%s, Password=%s\n", creds.Email, creds.Password)

	// Authenticate via Cognito
	authResult, err := authenticateUser(creds.Email, creds.Password)
	if err != nil {
		http.Error(w, err.Error(), http.StatusUnauthorized)
		return
	}

	// On success, respond with JSON containing tokens
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(authResult)
}

// authenticateUser uses AWS Cognito to authenticate user credentials (using AWS SDK V2)
func authenticateUser(username, password string) (map[string]string, error) {
	userPoolID := os.Getenv("COGNITO_USER_POOL_ID")
	clientID := os.Getenv("COGNITO_APP_CLIENT_ID")
	region := os.Getenv("AWS_REGION")

	if userPoolID == "" || clientID == "" || region == "" {
		return nil, fmt.Errorf("missing environment variables for Cognito configuration")
	}

	ctx := context.Background()

	cfg, err := config.LoadDefaultConfig(ctx, config.WithRegion(region))
	if err != nil {
		return nil, fmt.Errorf("failed to load AWS config: %v", err)
	}

	// Initialize the CognitoIdentityProvider client using V2
	cip := cognitoidentityprovider.NewFromConfig(cfg)

	// Build the input for InitiateAuth
	input := &cognitoidentityprovider.InitiateAuthInput{
		AuthFlow: "USER_PASSWORD_AUTH",
		ClientId: aws.String(clientID),
		AuthParameters: map[string]string{
			"USERNAME": username,
			"PASSWORD": password,
		},
	}

	// Make the request to Cognito, using the context
	result, err := cip.InitiateAuth(ctx, input)
	if err != nil {
		return nil, fmt.Errorf("cognito InitiateAuth error: %v", err)
	}

	if result.AuthenticationResult == nil {
		return nil, fmt.Errorf("authentication failed: no tokens returned")
	}

	// Return the tokens in a map
	tokens := map[string]string{
		"IdToken":      *result.AuthenticationResult.IdToken,
		"AccessToken":  *result.AuthenticationResult.AccessToken,
		"RefreshToken": *result.AuthenticationResult.RefreshToken,
		"TokenType":    *result.AuthenticationResult.TokenType,
	}

	return tokens, nil
}
