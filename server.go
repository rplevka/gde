package main

import (
	"crypto/tls"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"sync/atomic"

	"gopkg.in/yaml.v3"
)

type APIKey struct {
	ID    string
	Value string
}

type Config struct {
	APIKeys []map[string]string `yaml:"api_keys"`
}

var (
	apiKeys      []APIKey
	keyIndex     uint32
	httpClient   *http.Client
	staticServer http.Handler
	keyMutex     sync.RWMutex
)

func init() {
	// Load API keys from YAML file
	if err := loadAPIKeys(); err != nil {
		log.Printf("⚠️  WARNING: Failed to load api_keys.yaml: %v\n", err)
		log.Println("⚠️  Falling back to environment variable...")
		
		// Fallback to environment variable
		keysEnv := os.Getenv("MAPY_API_KEYS")
		if keysEnv == "" {
			log.Println("⚠️  WARNING: No API keys found. Set MAPY_API_KEYS or create api_keys.yaml")
			apiKeys = []APIKey{{ID: "default", Value: "YOUR_API_KEY"}}
		} else {
			for i, key := range strings.Split(keysEnv, ",") {
				apiKeys = append(apiKeys, APIKey{
					ID:    fmt.Sprintf("env-%d", i+1),
					Value: strings.TrimSpace(key),
				})
			}
			log.Printf("🔑 Loaded %d API key(s) from environment\n", len(apiKeys))
		}
	} else {
		log.Printf("🔑 Loaded %d API key(s) from api_keys.yaml\n", len(apiKeys))
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

func loadAPIKeys() error {
	data, err := os.ReadFile("api_keys.yaml")
	if err != nil {
		return err
	}

	var config Config
	if err := yaml.Unmarshal(data, &config); err != nil {
		return err
	}

	keyMutex.Lock()
	defer keyMutex.Unlock()

	apiKeys = nil
	for _, keyMap := range config.APIKeys {
		for id, value := range keyMap {
			apiKeys = append(apiKeys, APIKey{
				ID:    id,
				Value: value,
			})
		}
	}

	if len(apiKeys) == 0 {
		return fmt.Errorf("no API keys found in api_keys.yaml")
	}

	return nil
}

// Get next API key with atomic rotation
func getAPIKey() APIKey {
	keyMutex.RLock()
	defer keyMutex.RUnlock()
	
	if len(apiKeys) == 0 {
		return APIKey{ID: "none", Value: ""}
	}
	
	idx := atomic.AddUint32(&keyIndex, 1) % uint32(len(apiKeys))
	return apiKeys[idx]
}

// Proxy handler for Mapy.cz API requests with retry logic
func proxyHandler(w http.ResponseWriter, r *http.Request) {
	// Extract path after /api/mapy/
	apiPath := strings.TrimPrefix(r.URL.Path, "/api/mapy/")
	
	// Parse query parameters
	query := r.URL.Query()
	
	// Try each API key until one works
	keyMutex.RLock()
	maxAttempts := len(apiKeys)
	keyMutex.RUnlock()
	
	if maxAttempts == 0 {
		http.Error(w, "No API keys configured", http.StatusInternalServerError)
		return
	}
	
	for attempt := 0; attempt < maxAttempts; attempt++ {
		apiKey := getAPIKey()
		
		// Clone query for this attempt
		attemptQuery := make(map[string][]string)
		for k, v := range query {
			attemptQuery[k] = v
		}
		
		// Replace 'proxy' key or add real API key
		if attemptQuery["apikey"] == nil || attemptQuery["apikey"][0] == "proxy" || attemptQuery["apikey"][0] == "" {
			attemptQuery["apikey"] = []string{apiKey.Value}
		}
		if attemptQuery["apiKey"] != nil && attemptQuery["apiKey"][0] == "proxy" {
			attemptQuery["apiKey"] = []string{apiKey.Value}
		}
		
		// Construct target URL
		queryStr := ""
		for k, v := range attemptQuery {
			for _, val := range v {
				if queryStr != "" {
					queryStr += "&"
				}
				queryStr += fmt.Sprintf("%s=%s", k, val)
			}
		}
		targetURL := fmt.Sprintf("https://api.mapy.cz/%s?%s", apiPath, queryStr)
		
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
			log.Printf("❌ [%s] Network error: %v\n", apiKey.ID, err)
			if attempt < maxAttempts-1 {
				log.Printf("🔄 Retrying with next API key...\n")
				continue
			}
			http.Error(w, err.Error(), http.StatusBadGateway)
			return
		}
		defer resp.Body.Close()
		
		// Check for API key errors (401, 403)
		if resp.StatusCode == 401 || resp.StatusCode == 403 {
			log.Printf("❌ [%s] Invalid API key (HTTP %d)\n", apiKey.ID, resp.StatusCode)
			if attempt < maxAttempts-1 {
				log.Printf("🔄 Retrying with next API key...\n")
				continue
			}
			// Last attempt failed, return the error
		}
		
		// Success! Copy response
		if resp.StatusCode < 400 {
			log.Printf("✅ [%s] Request successful (HTTP %d)\n", apiKey.ID, resp.StatusCode)
		}
		
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
		return
	}
	
	// All attempts failed
	log.Printf("❌ All %d API keys failed\n", maxAttempts)
	http.Error(w, "All API keys failed", http.StatusUnauthorized)
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
