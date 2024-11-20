package main

import (
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
	// Load environment variables
	err := godotenv.Load()
	if err != nil {
		log.Fatalf("Error loading .env file: %v", err)
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/login", loginHandler)
	fmt.Println("Server is running on port 8080")
	log.Fatal(http.ListenAndServe(":8080", enableCors(mux)))
}

func enableCors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "http://localhost:3000")
		w.Header().Set("Access-Control-Allow-Credentials", "true")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func loginHandler(w http.ResponseWriter, r *http.Request) {
	log.Println("Handling login request")

	// Parse request body for credentials
	var credentials struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}

	err := json.NewDecoder(r.Body).Decode(&credentials)
	if err != nil {
		log.Printf("Invalid request body: %v\n", err)
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	log.Printf("Attempting login for user: %s\n", credentials.Email)

	// Load AWS configuration
	cfg, err := config.LoadDefaultConfig(r.Context())
	if err != nil {
		log.Printf("Failed to load AWS config: %v\n", err)
		http.Error(w, "Failed to load AWS config", http.StatusInternalServerError)
		return
	}

	// Create Cognito client
	client := cognitoidentityprovider.NewFromConfig(cfg)

	// Set up Cognito authentication input
	input := &cognitoidentityprovider.InitiateAuthInput{
		AuthFlow: "USER_PASSWORD_AUTH",
		ClientId: aws.String(os.Getenv("COGNITO_CLIENT_ID")),
		AuthParameters: map[string]string{
			"USERNAME": credentials.Email,
			"PASSWORD": credentials.Password,
		},
	}

	// Log input (except sensitive fields) for debugging
	log.Printf("Cognito auth input prepared for user: %s\n", credentials.Email)

	// Authenticate user with Cognito
	result, err := client.InitiateAuth(r.Context(), input)
	if err != nil {
		log.Printf("Cognito authentication failed: %v\n", err)
		http.Error(w, "Authentication failed", http.StatusUnauthorized)
		return
	}

	log.Println("Authentication successful")

	// Set HTTP-only cookie with the access token
	http.SetCookie(w, &http.Cookie{
		Name:     "access_token",
		Value:    *result.AuthenticationResult.AccessToken,
		HttpOnly: true,
		Secure:   false, // Change to true in production with HTTPS
		Path:     "/",
		MaxAge:   3600, // Token expiration in seconds
	})

	w.WriteHeader(http.StatusOK)
	fmt.Fprintln(w, "Login successful")
	log.Printf("Access token set for user: %s\n", credentials.Email)
}
