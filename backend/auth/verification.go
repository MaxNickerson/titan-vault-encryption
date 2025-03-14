package auth

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"

	cognitoJwtVerify "github.com/jhosan7/cognito-jwt-verify"
)

// TokenVerify checks if the ID token is valid AND if the user's email is verified.
func TokenVerify(w http.ResponseWriter, r *http.Request) {
	// gets the access token from the request header
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		http.Error(w, "Missing Authorization header", http.StatusUnauthorized)
		return
	}

	// splits the auth header to make sure the first part has bearer included in it
	parts := strings.Split(authHeader, " ")
	if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
		http.Error(w, "Invalid Authorization header format", http.StatusUnauthorized)
		return
	}
	tokenString := parts[1] // this is the actual bearer token base64 encrypted

	// makes a cognito config that matches what we use to verify a user
	cognitoConfig := cognitoJwtVerify.Config{
		UserPoolId: os.Getenv("COGNITO_USER_POOL_ID"),
		ClientId:   os.Getenv("COGNITO_APP_CLIENT_ID"),
		TokenUse:   "access",
	}

	// creates a verifier with the config we created
	verifier, err := cognitoJwtVerify.Create(cognitoConfig)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to create verifier: %v", err), http.StatusInternalServerError)
		return
	}

	// verify the token using the cognito verifier
	// this checks signature, expiration, and other JWT claims
	claimsInterface, err := verifier.Verify(tokenString)
	if err != nil {
		http.Error(w, fmt.Sprintf("Token verification failed: %v", err), http.StatusUnauthorized)
		return
	}

	// convert the claims interface to JSON so we can access individual fields
	// first marshal the interface to a JSON byte array
	raw, err := json.Marshal(claimsInterface)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to marshal claims: %v", err), http.StatusInternalServerError)
		return
	}

	// then unmarshal the JSON into a map for easy access to claim fields
	var claims map[string]interface{}
	if err := json.Unmarshal(raw, &claims); err != nil {
		http.Error(w, fmt.Sprintf("Failed to unmarshal claims: %v", err), http.StatusInternalServerError)
		return
	}

	// check that the user's email is verified by examining the email_verified claim
	// this ensures we only allow users with verified emails
	emailVerified, _ := claims["email_verified"].(bool)
	if !emailVerified {
		w.WriteHeader(http.StatusForbidden)
		json.NewEncoder(w).Encode(map[string]string{
			"error":   "email_not_verified",
			"message": "Your email must be verified. Please confirm your email address.",
		})
		return
	}

	// if we get here, the token is valid and the user's email is verified
	// return a 200 OK with a success message
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Token is valid"})
}

// ReturnSub verifies the ID token and extracts the "sub" claim.
func VerifyAndUpload(w http.ResponseWriter, r *http.Request) {
	// s3Service, err := url.NewR2Service()
	// if err != nil {
	// 	log.Fatal(err)
	// }
	// gets the access token from the request header
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		http.Error(w, "Missing Authorization header", http.StatusUnauthorized)
		return
	}

	// splits the auth header to make sure the first part has bearer included in it
	parts := strings.Split(authHeader, " ")
	if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
		http.Error(w, "Invalid Authorization header format", http.StatusUnauthorized)
		return
	}
	tokenString := parts[1] // this is the actual bearer token base64 encrypted

	// makes a cognito config that matches what we use to verify a user
	cognitoConfig := cognitoJwtVerify.Config{
		UserPoolId: os.Getenv("COGNITO_USER_POOL_ID"),
		ClientId:   os.Getenv("COGNITO_APP_CLIENT_ID"),
		TokenUse:   "id",
	}

	// creates a verifier with the config we created
	verifier, err := cognitoJwtVerify.Create(cognitoConfig)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to create verifier: %v", err), http.StatusInternalServerError)
		return
	}

	// creates a payload that contains all of the relevant information in the token
	payload, err := verifier.Verify(tokenString)
	if err != nil {
		http.Error(w, fmt.Sprintf("Token verification failed: %v", err), http.StatusUnauthorized)
		return
	}

	// from the payload variable it has a method to grab the subject, sub
	sub, err := payload.GetSubject()
	if err != nil {
		http.Error(w, fmt.Sprintf("No sub in token: %v", err), http.StatusUnauthorized)
		return
	}
	fmt.Println("\n" + sub)
	// w.Header().Set("Content-Type", "application/json")
	// json.NewEncoder(w).Encode(sub)

	// If the Content-Type header is present, check that it has the value
	// application/json. Note that we parse and normalize the header to remove
	// any additional parameters (like charset or boundary information) and normalize
	// it by stripping whitespace and converting to lowercase before we check the
	// value.
	ct := r.Header.Get("Content-Type")
	if ct != "" {
		mediaType := strings.ToLower(strings.TrimSpace(strings.Split(ct, ";")[0]))
		if mediaType != "application/json" {
			msg := "Content-Type header is not application/json"
			http.Error(w, msg, http.StatusUnsupportedMediaType)
			return
		}
	}

	// now create a path in r2, this maxbytes reader may need to be large in the future
	r.Body = http.MaxBytesReader(w, r.Body, 1048576)

	// Setup the decoder and call the DisallowUnknownFields() method on it.
	// This will cause Decode() to return a "json: unknown field ..." error
	// if it encounters any extra unexpected fields in the JSON. Strictly
	// speaking, it returns an error for "keys which do not match any
	// non-ignored, exported fields in the destination".
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()

}
