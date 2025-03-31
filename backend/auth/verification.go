package auth

import (
	url "backend/url"
	"bytes"
	"context"
	"encoding/gob" // this can encode structs to an array of bytes and decode it as well
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/golang-jwt/jwt/v5"
	cognitoJwtVerify "github.com/jhosan7/cognito-jwt-verify"
)

type EncryptedPackage struct {
	IV            string `json:"iv"`
	Salt          string `json:"salt"`
	EncryptedData string `json:"encryptedData"`
	FileName      string `json:"fileName"`
	FileType      string `json:"fileType"`
}

type payload jwt.Claims

func verifyJWT(w http.ResponseWriter, authHeader string) payload {
	// gets the access token from the request header
	if authHeader == "" {
		http.Error(w, "Missing Authorization header", http.StatusUnauthorized)
		return nil
	}

	// splits the auth header to make sure the first part has bearer included in it
	parts := strings.Split(authHeader, " ")
	if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
		http.Error(w, "Invalid Authorization header format", http.StatusUnauthorized)
		return nil
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
		return nil
	}

	// creates a payload that contains all of the relevant information in the token
	payload, err := verifier.Verify(tokenString)
	if err != nil {
		http.Error(w, fmt.Sprintf("Token verification failed: %v", err), http.StatusUnauthorized)
		return nil
	}

	return payload
}

// TokenVerify checks if the ID token is valid AND if the user's email is verified.
func TokenVerify(w http.ResponseWriter, r *http.Request) {
	// gets the access token from the request header
	authHeader := r.Header.Get("Authorization")
	payload := verifyJWT(w, authHeader)
	if payload == nil {
		return
	}
	// convert the claims interface to JSON so we can access individual fields
	// first marshal the interface to a JSON byte array
	raw, err := json.Marshal(payload)
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

	s3Service, err := url.NewR2Service()
	if err != nil {
		log.Fatal(err)
	}

	// gets the access token from the request header
	authHeader := r.Header.Get("Authorization")

	// calls the method verify JWT which checks the token validation
	payload := verifyJWT(w, authHeader)
	if payload == nil {
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

	// decode the body contents of the api call and make sure it matches what it should be
	// fmt.Println(r.Body)

	dec := json.NewDecoder(r.Body)

	var req EncryptedPackage
	if err := dec.Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}
	// fmt.Printf("Got EncryptedPackage: %+v\n", req)

	// write back to the frontend status 200 and the sub
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{
		"status": "ok",
		"sub":    sub,
	})

	// stand in var, Normally enc and dec would be
	// bound to network connections and the encoder and decoder would
	// run in different processes.
	var network bytes.Buffer
	enc := gob.NewEncoder(&network)

	err = enc.Encode(req)
	if err != nil {
		log.Fatal("encode error:", err)
	}

	// fmt.Println(network.Bytes()) // yep its literally just numbers
	// Upload a sample file
	err = s3Service.UploadFileToR2(context.TODO(), sub+"/"+req.FileName, network.Bytes())
	if err != nil {
		log.Fatal(err)
	}

}

func DownloadPackage(w http.ResponseWriter, r *http.Request) {
	// this will intake, idtoken and then what file they are attempting to access (i.e. user-sub/filename.png)
	s3Service, err := url.NewR2Service()
	if err != nil {
		log.Fatal(err)
	}

	// gets the access token from the request header
	authHeader := r.Header.Get("Authorization")

	payload := verifyJWT(w, authHeader)
	if payload == nil {
		return
	}

	// from the payload variable it has a method to grab the subject, sub
	sub, err := payload.GetSubject()
	if err != nil {
		http.Error(w, fmt.Sprintf("No sub in token: %v", err), http.StatusUnauthorized)
		return
	}

	// create a struct of what the request should look like
	var body struct {
		FileName string `json:"fileName"`
	}

	// create a json decoder
	dec := json.NewDecoder(r.Body)

	if err := dec.Decode(&body); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	sep := strings.Split(body.FileName, "/")[0]
	if sep != sub {
		http.Error(w, "Unmatching Sub Token", http.StatusForbidden)
	}

	encPkg, err := s3Service.GetObject(context.TODO(), body.FileName)
	if err != nil {
		http.Error(w, fmt.Sprintf("Issue exracting object: %v", err), http.StatusInternalServerError)
	}

	json.NewEncoder(w).Encode(encPkg)
}

func ListUserObjects(w http.ResponseWriter, r *http.Request) {
	// this will intake, idtoken and then what file they are attempting to access (i.e. user-sub/filename.png)
	s3Service, err := url.NewR2Service()
	if err != nil {
		log.Fatal(err)
	}

	// gets the access token from the request header
	authHeader := r.Header.Get("Authorization")

	// calls the method verify JWT which checks the token validation
	payload := verifyJWT(w, authHeader)
	if payload == nil {
		return
	}

	// from the payload variable it has a method to grab the subject, sub
	sub, err := payload.GetSubject()
	if err != nil {
		http.Error(w, fmt.Sprintf("No sub in token: %v", err), http.StatusUnauthorized)
		return
	}

	ArrObjects, err := s3Service.ListObjects(context.TODO(), sub)
	if err != nil {
		http.Error(w, fmt.Sprintf("User object-list extraction failed: %v", err), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(ArrObjects)
}
