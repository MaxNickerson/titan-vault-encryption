// main.go
package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"

	// "os"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/cognitoidentityprovider"
	"github.com/joho/godotenv"
)

func main() {

	err := godotenv.Load()
	if err != nil {
		log.Fatalf("Error loading .env file")
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
	// fmt.Println("Hello")

	var credentials struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}

	err := json.NewDecoder(r.Body).Decode(&credentials)
	if err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	// fmt.Println(credentials) // passes credentials fine
	// Load AWS configuration
	cfg, err := config.LoadDefaultConfig(r.Context())
	if err != nil {
		http.Error(w, "Failed to load AWS config", http.StatusInternalServerError)
		return
	}

	// Create Cognito client
	client := cognitoidentityprovider.NewFromConfig(cfg)

	// Authenticate user with Cognito
	input := &cognitoidentityprovider.InitiateAuthInput{
		AuthFlow: "USER_PASSWORD_AUTH",
		ClientId: aws.String(os.Getenv("COGNITO_CLIENT_ID")),
		AuthParameters: map[string]string{
			"USERNAME": credentials.Email,
			"PASSWORD": credentials.Password,
		},
	}
	// fmt.Println(input)
	result, err := client.InitiateAuth(r.Context(), input)
	if err != nil {
		http.Error(w, "Authentication failed", http.StatusUnauthorized)
		return
	}

	// Set HTTP-only cookie with the access token
	http.SetCookie(w, &http.Cookie{
		Name:     "access_token",
		Value:    *result.AuthenticationResult.AccessToken,
		HttpOnly: true,
		Secure:   false, // Ensure this is true in production (requires HTTPS)
		Path:     "/",
		MaxAge:   3600, // Token expiration in seconds
	})

	w.WriteHeader(http.StatusOK)
	fmt.Fprintln(w, "Login successful")

}
