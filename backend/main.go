package main

import (
	verification "backend/auth"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/cognitoidentityprovider"
	"github.com/joho/godotenv"
)

func main() {
	// Load environment variables from .env file
	err := godotenv.Load()
	if err != nil {
		log.Fatalf("Error loading .env file: %v", err)
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/login", loginHandler)

	mux.HandleFunc("/verify", verification.TokenVerify)

	mux.HandleFunc("/subextract", verification.ReturnSub)

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

// authenticateUser uses AWS Cognito to authenticate user credentials
func authenticateUser(username, password string) (map[string]string, error) {
	userPoolID := os.Getenv("COGNITO_USER_POOL_ID")
	clientID := os.Getenv("COGNITO_APP_CLIENT_ID")
	region := os.Getenv("AWS_REGION")

	if userPoolID == "" || clientID == "" || region == "" {
		return nil, fmt.Errorf("missing environment variables for Cognito configuration")
	}

	// Create a new AWS session
	sess, err := session.NewSession(&aws.Config{
		Region: aws.String(region),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create AWS session: %v", err)
	}

	// Initialize the CognitoIdentityProvider client
	cip := cognitoidentityprovider.New(sess)

	// Build the input for InitiateAuth
	input := &cognitoidentityprovider.InitiateAuthInput{
		AuthFlow: aws.String("USER_PASSWORD_AUTH"),
		ClientId: aws.String(clientID),
		AuthParameters: map[string]*string{
			"USERNAME": aws.String(username),
			"PASSWORD": aws.String(password),
		},
	}

	// Make the request to Cognito
	result, err := cip.InitiateAuth(input)
	if err != nil {
		return nil, fmt.Errorf("cognito InitiateAuth error: %v", err)
	}

	// If result.AuthenticationResult is nil, it means authentication was not successful
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
