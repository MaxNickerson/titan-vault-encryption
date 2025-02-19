package auth

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"

	cognitoJwtVerify "github.com/jhosan7/cognito-jwt-verify"
)

func TokenVerify(w http.ResponseWriter, r *http.Request) {
	authHeader := r.Header.Get("Authorization")
	// fmt.Print(authHeader)
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

	// 3. Set up the Cognito config
	//    Typically, "access" is used if you want to validate the Access token.
	//    If you want to validate the ID token, set TokenUse to "id".
	cognitoConfig := cognitoJwtVerify.Config{
		UserPoolId: os.Getenv("COGNITO_USER_POOL_ID"), // Must be actual User Pool ID, e.g. "us-east-1_XXXXXXX"
		ClientId:   os.Getenv("COGNITO_APP_CLIENT_ID"),
		TokenUse:   "access", // or "id" if you’re verifying an ID token
	}

	verifier, err := cognitoJwtVerify.Create(cognitoConfig)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to create verifier: %v", err), http.StatusInternalServerError)
		return
	}

	// verify token from header
	payload, err := verifier.Verify(tokenString)
	if err != nil {
		http.Error(w, fmt.Sprintf("Token verification failed: %v", err), http.StatusUnauthorized)
		return
	}

	// fmt.Print("\n", payload)
	// // okok get subject returns the sub
	// fmt.Print("\n")
	// fmt.Print(payload.GetSubject())
	// fmt.Print("\n")

	fmt.Fprintf(w, "Token is valid! Payload: %#v", payload)

}

// first thsi needs to check tokenID to make sure its legit (i.e. call tokenVerify)
func ReturnSub(w http.ResponseWriter, r *http.Request) {
	authHeader := r.Header.Get("Authorization")
	// fmt.Print(authHeader)
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
		UserPoolId: os.Getenv("COGNITO_USER_POOL_ID"), // Must be actual User Pool ID, e.g. "us-east-1_XXXXXXX"
		ClientId:   os.Getenv("COGNITO_APP_CLIENT_ID"),
		TokenUse:   "id", // or "id" if you’re verifying an ID token
	}

	verifier, err := cognitoJwtVerify.Create(cognitoConfig)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to create verifier: %v", err), http.StatusInternalServerError)
		return
	}

	// verify token from header
	payload, err := verifier.Verify(tokenString)
	if err != nil {
		http.Error(w, fmt.Sprintf("Token verification failed: %v", err), http.StatusUnauthorized)
		return
	}

	sub, err := payload.GetSubject()
	if err != nil {
		http.Error(w, fmt.Sprintf("No sub in token: %v", err), http.StatusUnauthorized)
		return
	}
	fmt.Println("\n" + sub)
	// fmt.Fprintf(w, sub)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(sub)

}
