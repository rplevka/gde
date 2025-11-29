package main

import (
	"crypto/tls"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"sync/atomic"
)

var (
	apiKeys      []string
	keyIndex     uint32
	httpClient   *http.Client
	staticServer http.Handler
)

func init() {
	// Load API keys from environment
	keysEnv := os.Getenv("MAPY_API_KEYS")
	if keysEnv == "" {
		log.Println("⚠️  WARNING: No API keys found. Set MAPY_API_KEYS environment variable.")
		apiKeys = []string{"YOUR_API_KEY"}
	} else {
		apiKeys = strings.Split(keysEnv, ",")
		log.Printf("🔑 Loaded %d API key(s)\n", len(apiKeys))
	}

	// Create HTTP client with connection pooling and no SSL verification
	httpClient = &http.Client{
		Transport: &http.Transport{
			MaxIdleConns:        100,
			MaxIdleConnsPerHost: 100,
			IdleConnTimeout:     90,
			TLSClientConfig: &tls.Config{
				InsecureSkipVerify: true,
			},
		},
	}

	// Static file server
	staticServer = http.FileServer(http.Dir("."))
}

// Get next API key with atomic rotation
func getAPIKey() string {
	idx := atomic.AddUint32(&keyIndex, 1) % uint32(len(apiKeys))
	return apiKeys[idx]
}

// Proxy handler for Mapy.cz API requests
func proxyHandler(w http.ResponseWriter, r *http.Request) {
	// Extract path after /api/mapy/
	apiPath := strings.TrimPrefix(r.URL.Path, "/api/mapy/")
	
	// Parse query parameters
	query := r.URL.Query()
	
	// Replace 'proxy' key or add real API key
	apiKey := getAPIKey()
	if query.Get("apikey") == "proxy" || query.Get("apikey") == "" {
		query.Set("apikey", apiKey)
	}
	if query.Get("apiKey") == "proxy" {
		query.Set("apiKey", apiKey)
	}
	
	// Construct target URL (always use api.mapy.cz)
	targetURL := fmt.Sprintf("https://api.mapy.cz/%s?%s", apiPath, query.Encode())
	
	// Create proxy request
	proxyReq, err := http.NewRequest(r.Method, targetURL, r.Body)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	
	// Copy headers
	for key, values := range r.Header {
		for _, value := range values {
			proxyReq.Header.Add(key, value)
		}
	}
	
	// Make request to Mapy.cz
	resp, err := httpClient.Do(proxyReq)
	if err != nil {
		log.Printf("❌ Proxy error: %v\n", err)
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()
	
	// Copy response headers
	for key, values := range resp.Header {
		for _, value := range values {
			w.Header().Add(key, value)
		}
	}
	
	// Add CORS headers
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
	
	// Write status code
	w.WriteHeader(resp.StatusCode)
	
	// Stream response body
	io.Copy(w, resp.Body)
}

// Main handler
func mainHandler(w http.ResponseWriter, r *http.Request) {
	// Handle CORS preflight
	if r.Method == "OPTIONS" {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		w.WriteHeader(http.StatusOK)
		return
	}
	
	// Proxy API requests
	if strings.HasPrefix(r.URL.Path, "/api/mapy/") {
		proxyHandler(w, r)
		return
	}
	
	// Serve static files
	staticServer.ServeHTTP(w, r)
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8000"
	}
	
	http.HandleFunc("/", mainHandler)
	
	addr := fmt.Sprintf(":%s", port)
	log.Printf("🚀 Server running on http://localhost%s\n", addr)
	log.Printf("📊 Connection pool: 100 max idle connections\n")
	
	if err := http.ListenAndServe(addr, nil); err != nil {
		log.Fatal(err)
	}
}
