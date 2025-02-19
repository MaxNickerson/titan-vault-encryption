package main

import (
	verification "backend/auth"
	"encoding/json"
	"fmt"
	"log"
	"net/http"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/cognitoidentityprovider"
	// "github.com/joho/godotenv" // Uncomment if using .env
	// "os"
)

func main() {
	// If using .env, uncomment:
	// err := godotenv.Load()
	// if err != nil {
	// 	log.Fatalf("Error loading .env file: %v", err)
	// }

	mux := http.NewServeMux()

	// Public routes
	mux.HandleFunc("/login", loginHandler)
	mux.HandleFunc("/resendVerification", resendVerificationHandler)

	// New route for responding to MFA challenges
	mux.HandleFunc("/respondMFA", respondMFAHandler)

	// Protected routes
	mux.HandleFunc("/verify", verification.TokenVerify)
	mux.HandleFunc("/subextract", verification.ReturnSub)

	fmt.Println("Server is running on port 8080")
	log.Fatal(http.ListenAndServe(":8080", enableCors(mux)))
}

// enableCors sets the CORS headers for your React app at http://localhost:3000.
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

// loginHandler authenticates the user with Cognito and returns tokens.
func loginHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Invalid request method", http.StatusMethodNotAllowed)
		return
	}

	var creds struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}

	if err := json.NewDecoder(r.Body).Decode(&creds); err != nil {
		http.Error(w, "Invalid JSON payload", http.StatusBadRequest)
		return
	}

	fmt.Printf("Received login: Email=%s\n", creds.Email)

	authResult, err := authenticateUser(creds.Email, creds.Password)
	if err != nil {
		http.Error(w, err.Error(), http.StatusUnauthorized)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(authResult)
}

// authenticateUser uses AWS Cognito to authenticate user credentials.
func authenticateUser(username, password string) (map[string]string, error) {
	// Hardcode or read from environment. Using new IDs directly:
	// userPoolID := "us-east-1_ZSdwAA8FJ" // not currently used
	clientID := "28bk3ok0246oodeorj8l5ikk6c"
	region := "us-east-1"

	sess, err := session.NewSession(&aws.Config{
		Region: aws.String(region),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create AWS session: %v", err)
	}

	cip := cognitoidentityprovider.New(sess)
	input := &cognitoidentityprovider.InitiateAuthInput{
		AuthFlow: aws.String("USER_PASSWORD_AUTH"),
		ClientId: aws.String(clientID),
		AuthParameters: map[string]*string{
			"USERNAME": aws.String(username),
			"PASSWORD": aws.String(password),
		},
	}

	result, err := cip.InitiateAuth(input)
	if err != nil {
		return nil, fmt.Errorf("cognito InitiateAuth error: %v", err)
	}

	// If Cognito returns a challenge (e.g. SMS_MFA), we won't have tokens yet.
	if result.ChallengeName != nil {
		return map[string]string{
			"ChallengeName": *result.ChallengeName,
			"Session":       *result.Session,
			"Message":       "MFA required. Please submit your 2FA code via /respondMFA.",
		}, nil
	}

	if result.AuthenticationResult == nil {
		return nil, fmt.Errorf("authentication failed: no tokens returned")
	}

	// Successful sign-in with tokens
	tokens := map[string]string{
		"IdToken":      *result.AuthenticationResult.IdToken,
		"AccessToken":  *result.AuthenticationResult.AccessToken,
		"RefreshToken": *result.AuthenticationResult.RefreshToken,
		"TokenType":    *result.AuthenticationResult.TokenType,
	}
	return tokens, nil
}

// resendVerificationHandler allows users to request a new verification code.
func resendVerificationHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Invalid request method", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Email string `json:"email"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON payload", http.StatusBadRequest)
		return
	}

	clientID := "28bk3ok0246oodeorj8l5ikk6c"
	region := "us-east-1"

	sess, err := session.NewSession(&aws.Config{Region: aws.String(region)})
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to create session: %v", err), http.StatusInternalServerError)
		return
	}

	cip := cognitoidentityprovider.New(sess)
	input := &cognitoidentityprovider.ResendConfirmationCodeInput{
		ClientId: aws.String(clientID),
		Username: aws.String(req.Email),
	}

	_, err = cip.ResendConfirmationCode(input)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to resend confirmation code: %v", err), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Verification email resent. Please check your inbox.",
	})
}

// respondMFAHandler responds to SMS_MFA or SOFTWARE_TOKEN_MFA challenge
// after the user enters their MFA code. On success, returns the tokens.
func respondMFAHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Invalid request method", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Session string `json:"session"`
		MfaCode string `json:"mfaCode"`
		Email   string `json:"email"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON payload", http.StatusBadRequest)
		return
	}

	clientID := "28bk3ok0246oodeorj8l5ikk6c"
	region := "us-east-1"

	sess, err := session.NewSession(&aws.Config{
		Region: aws.String(region),
	})
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to create AWS session: %v", err), http.StatusInternalServerError)
		return
	}

	cip := cognitoidentityprovider.New(sess)

	// We assume SMS_MFA here, but if you're using TOTP, use SOFTWARE_TOKEN_MFA
	respondInput := &cognitoidentityprovider.RespondToAuthChallengeInput{
		ClientId:      aws.String(clientID),
		ChallengeName: aws.String("SMS_MFA"),
		Session:       aws.String(req.Session),
		ChallengeResponses: map[string]*string{
			"USERNAME":     aws.String(req.Email),
			"SMS_MFA_CODE": aws.String(req.MfaCode),
		},
	}

	resp, err := cip.RespondToAuthChallenge(respondInput)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to respond to MFA challenge: %v", err), http.StatusUnauthorized)
		return
	}

	if resp.AuthenticationResult == nil {
		http.Error(w, "MFA challenge not satisfied, no tokens returned.", http.StatusUnauthorized)
		return
	}

	tokens := map[string]string{
		"IdToken":      *resp.AuthenticationResult.IdToken,
		"AccessToken":  *resp.AuthenticationResult.AccessToken,
		"RefreshToken": *resp.AuthenticationResult.RefreshToken,
		"TokenType":    *resp.AuthenticationResult.TokenType,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(tokens)
}
