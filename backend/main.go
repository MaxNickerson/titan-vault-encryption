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

	

	
	w.WriteHeader(http.StatusOK)
	fmt.Fprintln(w, "Login successful")

}
