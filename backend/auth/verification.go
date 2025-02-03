package verification

import (
	"fmt"
	"net/http"
	"os"
	"strings"

	cognitoJwtVerify "github.com/jhosan7/cognito-jwt-verify"
)

// eventually have methods like this seperate from main
func TokenVerify(w http.ResponseWriter, r *http.Request) {
	authHeader := r.Header.Get("Authorization")
	fmt.Print(authHeader)
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

	// 5. If we reach here, the token is valid. You can continue handling the request.
	//    For demonstration, just return a success message:
	fmt.Fprintf(w, "Token is valid! Payload: %#v", payload)

}
