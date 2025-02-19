package verification

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"

	cognitoJwtVerify "github.com/jhosan7/cognito-jwt-verify"
)

// TokenVerify checks if the ID token is valid AND if the user's email is verified.
// The frontend must send the **ID Token** in the Authorization header.
func TokenVerify(w http.ResponseWriter, r *http.Request) {
	authHeader := r.Header.Get("Authorization")
	fmt.Println("Authorization header:", authHeader)

	if authHeader == "" {
		http.Error(w, "Missing Authorization header", http.StatusUnauthorized)
		return
	}

	parts := strings.Split(authHeader, " ")
	if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
		http.Error(w, "Invalid Authorization header format", http.StatusUnauthorized)
		return
	}
	tokenString := parts[1]

	cognitoConfig := cognitoJwtVerify.Config{
		UserPoolId: os.Getenv("COGNITO_USER_POOL_ID"),
		ClientId:   os.Getenv("COGNITO_APP_CLIENT_ID"),
		TokenUse:   "id", // Using ID token to check email_verified.
	}

	verifier, err := cognitoJwtVerify.Create(cognitoConfig)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to create verifier: %v", err), http.StatusInternalServerError)
		return
	}

	claimsInterface, err := verifier.Verify(tokenString)
	if err != nil {
		http.Error(w, fmt.Sprintf("Token verification failed: %v", err), http.StatusUnauthorized)
		return
	}

	// Use a JSON round-trip to convert the claims to a plain map[string]interface{}
	raw, err := json.Marshal(claimsInterface)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to marshal claims: %v", err), http.StatusInternalServerError)
		return
	}

	var claims map[string]interface{}
	if err := json.Unmarshal(raw, &claims); err != nil {
		http.Error(w, fmt.Sprintf("Failed to unmarshal claims: %v", err), http.StatusInternalServerError)
		return
	}

	// Check the email_verified claim.
	emailVerified, _ := claims["email_verified"].(bool)
	if !emailVerified {
		w.WriteHeader(http.StatusForbidden)
		json.NewEncoder(w).Encode(map[string]string{
			"error":   "email_not_verified",
			"message": "Your email must be verified. Please confirm your email address.",
		})
		return
	}

	// If email is verified, return success.
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Token is valid"})
}

// ReturnSub verifies the ID token and extracts the "sub" claim (unique user ID).
func ReturnSub(w http.ResponseWriter, r *http.Request) {
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		http.Error(w, "Missing Authorization header", http.StatusUnauthorized)
		return
	}

	parts := strings.Split(authHeader, " ")
	if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
		http.Error(w, "Invalid Authorization header format", http.StatusUnauthorized)
		return
	}
	tokenString := parts[1]

	cognitoConfig := cognitoJwtVerify.Config{
		UserPoolId: os.Getenv("COGNITO_USER_POOL_ID"),
		ClientId:   os.Getenv("COGNITO_APP_CLIENT_ID"),
		TokenUse:   "id",
	}

	verifier, err := cognitoJwtVerify.Create(cognitoConfig)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to create verifier: %v", err), http.StatusInternalServerError)
		return
	}

	claimsInterface, err := verifier.Verify(tokenString)
	if err != nil {
		http.Error(w, fmt.Sprintf("Token verification failed: %v", err), http.StatusUnauthorized)
		return
	}

	raw, err := json.Marshal(claimsInterface)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to marshal claims: %v", err), http.StatusInternalServerError)
		return
	}

	var claims map[string]interface{}
	if err := json.Unmarshal(raw, &claims); err != nil {
		http.Error(w, fmt.Sprintf("Failed to unmarshal claims: %v", err), http.StatusInternalServerError)
		return
	}

	userSub, _ := claims["sub"].(string)
	if userSub == "" {
		http.Error(w, "Unable to extract user sub", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"sub": userSub})
}
