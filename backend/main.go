package main

import (
	auth "backend/auth"
	// url "backend/url"
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
	// Load environment variables
	err := godotenv.Load()
	if err != nil {
		log.Fatalf("Error loading .env file: %v", err)
	}

	// s3Service, err := url.NewR2Service()
	// if err != nil {
	// 	log.Fatal(err)
	// }

	// // list objects with sub
	// out, err := s3Service.ListObjects(context.Background(), "04d8f4b8-1041-70e4-4a2a-fcb5edf1969b")
	// if err != nil {
	// 	fmt.Println(err, "hi")
	// }
	// fmt.Println(out)

	// out2, err2 := s3Service.GetObject(context.Background(), "04d8f4b8-1041-70e4-4a2a-fcb5edf1969b/unknown (53).png")
	// if err2 != nil {
	// 	fmt.Println(err2, "helo")
	// }
	// defer out2.Body.Close()

	mux := http.NewServeMux()

	mux.HandleFunc("/downloadPackage", auth.DownloadPackage)

	// Public routes
	mux.HandleFunc("/login", loginHandler)
	mux.HandleFunc("/resendVerification", resendVerificationHandler)

	// New route for responding to MFA challenges
	mux.HandleFunc("/respondMFA", respondMFAHandler)

	// Protected routes
	mux.HandleFunc("/verify", auth.TokenVerify)
	mux.HandleFunc("/upload", auth.VerifyAndUpload)

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
// authenticateUser uses AWS Cognito to authenticate user credentials.
func authenticateUser(username, password string) (map[string]string, error) {
	userPoolID := os.Getenv("COGNITO_USER_POOL_ID")
	clientID := os.Getenv("COGNITO_APP_CLIENT_ID")
	region := os.Getenv("AWS_REGION")

	if userPoolID == "" || clientID == "" || region == "" {
		return nil, fmt.Errorf("missing environment variables for Cognito configuration")
	}

	// Load AWS configuration
	cfg, err := config.LoadDefaultConfig(context.TODO(), config.WithRegion(region))
	if err != nil {
		return nil, fmt.Errorf("failed to load AWS config: %v", err)
	}

	// Initialize the CognitoIdentityProvider client using V2
	cip := cognitoidentityprovider.NewFromConfig(cfg)

	// Prepare authentication input
	input := &cognitoidentityprovider.InitiateAuthInput{
		AuthFlow: "USER_PASSWORD_AUTH",
		ClientId: aws.String(clientID),
		AuthParameters: map[string]string{
			"USERNAME": username,
			"PASSWORD": password,
		},
	}

	// Make the request to Cognito
	result, err := cip.InitiateAuth(context.TODO(), input)
	if err != nil {
		return nil, fmt.Errorf("Cognito InitiateAuth error: %v", err)
	}

	// Handle MFA challenge if needed
	if result.ChallengeName != "" {
		sessionValue := ""
		if result.Session != nil {
			sessionValue = *result.Session
		}

		return map[string]string{
			"ChallengeName": string(result.ChallengeName),
			"Session":       sessionValue,
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

	cfg, err := config.LoadDefaultConfig(context.TODO(), config.WithRegion(region))
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to load AWS config: %v", err), http.StatusInternalServerError)
		return
	}

	cip := cognitoidentityprovider.NewFromConfig(cfg)
	input := &cognitoidentityprovider.ResendConfirmationCodeInput{
		ClientId: &clientID,
		Username: &req.Email,
	}

	_, err = cip.ResendConfirmationCode(context.TODO(), input)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to resend confirmation code: %v", err), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Verification email resent. Please check your inbox.",
	})
}

// respondMFAHandler handles MFA challenges
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

	clientID := os.Getenv("COGNITO_APP_CLIENT_ID")
	region := "us-east-1"

	cfg, err := config.LoadDefaultConfig(context.TODO(), config.WithRegion(region))
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to load AWS config: %v", err), http.StatusInternalServerError)
		return
	}

	cip := cognitoidentityprovider.NewFromConfig(cfg)

	respondInput := &cognitoidentityprovider.RespondToAuthChallengeInput{
		ClientId:      &clientID,
		ChallengeName: "SMS_MFA",
		Session:       &req.Session,
		ChallengeResponses: map[string]string{
			"USERNAME":     req.Email,
			"SMS_MFA_CODE": req.MfaCode,
		},
	}
	resp, err := cip.RespondToAuthChallenge(context.TODO(), respondInput)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to respond to MFA challenge: %v", err), http.StatusUnauthorized)
		// fmt.Println("Error here")
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
