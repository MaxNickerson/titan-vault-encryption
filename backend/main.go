// main.go
package main

import (
	"fmt"
	"log"
	"net/http"

	// "os"
	"github.com/joho/godotenv"
)

func main() {

	err := godotenv.Load()
	if err != nil {
		log.Fatalf("Error loading .env file")
	}

	http.HandleFunc("/login", loginHandler)
	fmt.Println("Server is running on port 8080")
	log.Fatal(http.ListenAndServe(":8080", nil))

}

func loginHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Invalid request method", http.StatusMethodNotAllowed)
		return
	}

	// For now, just log a message to confirm the handler works
	fmt.Fprintln(w, "Login endpoint reached")
}
