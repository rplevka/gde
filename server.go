package main

import (
	"crypto/md5"
	"crypto/tls"
	"encoding/hex"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"gopkg.in/yaml.v3"
)

type APIKey struct {
	ID    string
	Value string
}

// CacheConfig holds cache settings from YAML
type CacheConfig struct {
	TTLDays       int    `yaml:"ttl_days"`
	MaxSizeMB     int    `yaml:"max_size_mb"`
	Dir           string `yaml:"dir"`
	CleanupHours  int    `yaml:"cleanup_hours"`
}

type Config struct {
	APIKeys []map[string]string `yaml:"api_keys"`
	Cache   CacheConfig         `yaml:"cache"`
}

type LogLevel int

const (
	DEBUG LogLevel = iota
	INFO
	WARN
	ERROR
)

// Cache configuration defaults - tiles are immutable, cache them for months
const (
	DefaultCacheTTLDays    = 90           // 3 months cache TTL
	DefaultCacheDir        = ".tile_cache" // Cache directory
	DefaultCacheMaxSizeMB  = 5000          // 5GB max cache size
	DefaultCacheCleanupInt = 24            // Cleanup interval in hours
)

// Runtime cache config (loaded from YAML or defaults)
var cacheConfig = CacheConfig{
	TTLDays:      DefaultCacheTTLDays,
	MaxSizeMB:    DefaultCacheMaxSizeMB,
	Dir:          DefaultCacheDir,
	CleanupHours: DefaultCacheCleanupInt,
}

// Cache statistics
type CacheStats struct {
	hits       uint64
	misses     uint64
	savedBytes uint64
}

var (
	apiKeys      []APIKey
	keyIndex     uint32
	httpClient   *http.Client
	staticServer http.Handler
	keyMutex     sync.RWMutex
	logLevel     LogLevel = INFO
	cacheStats   CacheStats
	cacheMutex   sync.RWMutex
	
	// Patterns for cacheable tile requests
	tilePatterns = []*regexp.Regexp{
		regexp.MustCompile(`^v1/maptiles/`),              // Map tiles
		regexp.MustCompile(`^v1/panorama/tiles/`),        // Panorama tiles (actual format!)
		regexp.MustCompile(`^v1/panorama/\d+/thumbnail`), // Panorama thumbnails
	}
)

func logDebug(format string, v ...interface{}) {
	if logLevel <= DEBUG {
		log.Printf("[DEBUG] "+format, v...)
	}
}

func logInfo(format string, v ...interface{}) {
	if logLevel <= INFO {
		log.Printf("[INFO] "+format, v...)
	}
}

func logWarn(format string, v ...interface{}) {
	if logLevel <= WARN {
		log.Printf("[WARN] "+format, v...)
	}
}

func logError(format string, v ...interface{}) {
	if logLevel <= ERROR {
		log.Printf("[ERROR] "+format, v...)
	}
}

// ==================== TILE CACHING ====================

// isCacheable checks if a request path should be cached
func isCacheable(path string) bool {
	for _, pattern := range tilePatterns {
		if pattern.MatchString(path) {
			logDebug("✅ Cacheable: %s", path)
			return true
		}
	}
	logDebug("❌ Not cacheable: %s", path)
	return false
}

// getCacheKey generates a unique cache key for a request
func getCacheKey(path string, query url.Values) string {
	// Create a normalized key from path + sorted query params (excluding apikey)
	cleanQuery := url.Values{}
	for k, v := range query {
		// Exclude API key from cache key - same tile regardless of which key fetched it
		if strings.ToLower(k) != "apikey" {
			cleanQuery[k] = v
		}
	}
	
	keyStr := path + "?" + cleanQuery.Encode()
	hash := md5.Sum([]byte(keyStr))
	cacheKey := hex.EncodeToString(hash[:])
	
	logDebug("🔑 Cache key: %s -> %s", keyStr, cacheKey)
	return cacheKey
}

// getCachePath returns the file path for a cache entry
func getCachePath(cacheKey string) string {
	// Use first 2 chars as subdirectory to avoid too many files in one dir
	subdir := cacheKey[:2]
	return filepath.Join(cacheConfig.Dir, subdir, cacheKey)
}

// getCacheMetaPath returns the metadata file path
func getCacheMetaPath(cacheKey string) string {
	return getCachePath(cacheKey) + ".meta"
}

// readFromCache tries to read a cached response
func readFromCache(cacheKey string) ([]byte, map[string]string, bool) {
	cachePath := getCachePath(cacheKey)
	metaPath := getCacheMetaPath(cacheKey)
	
	// Check if cache file exists
	info, err := os.Stat(cachePath)
	if err != nil {
		logDebug("📂 Cache file not found: %s", cachePath)
		return nil, nil, false
	}
	
	logDebug("📂 Cache file found: %s (size: %d)", cachePath, info.Size())
	
	// Check TTL
	age := time.Since(info.ModTime())
	if age > time.Duration(cacheConfig.TTLDays)*24*time.Hour {
		// Cache expired, delete it
		os.Remove(cachePath)
		os.Remove(metaPath)
		return nil, nil, false
	}
	
	// Read the cached data
	data, err := os.ReadFile(cachePath)
	if err != nil {
		return nil, nil, false
	}
	
	// Read metadata (content-type, etc)
	headers := make(map[string]string)
	if metaData, err := os.ReadFile(metaPath); err == nil {
		for _, line := range strings.Split(string(metaData), "\n") {
			if parts := strings.SplitN(line, ": ", 2); len(parts) == 2 {
				headers[parts[0]] = parts[1]
			}
		}
	}
	
	return data, headers, true
}

// writeToCache stores a response in the cache
func writeToCache(cacheKey string, data []byte, headers map[string]string) error {
	cachePath := getCachePath(cacheKey)
	metaPath := getCacheMetaPath(cacheKey)
	
	// Create subdirectory
	dir := filepath.Dir(cachePath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}
	
	// Write data
	if err := os.WriteFile(cachePath, data, 0644); err != nil {
		return err
	}
	
	// Write metadata
	var metaLines []string
	for k, v := range headers {
		metaLines = append(metaLines, k+": "+v)
	}
	if err := os.WriteFile(metaPath, []byte(strings.Join(metaLines, "\n")), 0644); err != nil {
		// Non-fatal, we can still serve without metadata
		logWarn("Failed to write cache metadata: %v", err)
	}
	
	return nil
}

// initCache creates cache directory and starts cleanup goroutine
func initCache() {
	// Create cache directory
	if err := os.MkdirAll(cacheConfig.Dir, 0755); err != nil {
		logError("Failed to create cache directory: %v", err)
		return
	}
	
	// Get initial cache size
	size, count := getCacheSize()
	logInfo("📦 Tile cache initialized: %d files, %.2f MB", count, float64(size)/(1024*1024))
	
	// Start background cleanup
	go func() {
		for {
			time.Sleep(time.Duration(cacheConfig.CleanupHours) * time.Hour)
			cleanupCache()
		}
	}()
}

// getCacheSize returns total cache size and file count
func getCacheSize() (int64, int) {
	var totalSize int64
	var count int
	
	filepath.Walk(cacheConfig.Dir, func(path string, info os.FileInfo, err error) error {
		if err != nil || info.IsDir() {
			return nil
		}
		totalSize += info.Size()
		count++
		return nil
	})
	
	return totalSize, count
}

// cleanupCache removes expired entries and enforces size limit
func cleanupCache() {
	logDebug("🧹 Starting cache cleanup...")
	
	type fileInfo struct {
		path    string
		modTime time.Time
		size    int64
	}
	
	var files []fileInfo
	var totalSize int64
	var expired int
	
	now := time.Now()
	maxAge := time.Duration(cacheConfig.TTLDays) * 24 * time.Hour
	
	filepath.Walk(cacheConfig.Dir, func(path string, info os.FileInfo, err error) error {
		if err != nil || info.IsDir() {
			return nil
		}
		
		age := now.Sub(info.ModTime())
		if age > maxAge {
			// Remove expired files
			os.Remove(path)
			expired++
			return nil
		}
		
		files = append(files, fileInfo{path, info.ModTime(), info.Size()})
		totalSize += info.Size()
		return nil
	})
	
	// If over size limit, delete oldest files first
	maxSize := int64(cacheConfig.MaxSizeMB) * 1024 * 1024
	var sizeDeleted int64
	var countDeleted int
	
	if totalSize > maxSize {
		// Sort by mod time (oldest first) - simple bubble sort is fine for this
		for i := 0; i < len(files)-1; i++ {
			for j := 0; j < len(files)-i-1; j++ {
				if files[j].modTime.After(files[j+1].modTime) {
					files[j], files[j+1] = files[j+1], files[j]
				}
			}
		}
		
		// Delete until under limit
		for _, f := range files {
			if totalSize <= maxSize {
				break
			}
			os.Remove(f.path)
			os.Remove(f.path + ".meta") // Also remove metadata
			totalSize -= f.size
			sizeDeleted += f.size
			countDeleted++
		}
	}
	
	if expired > 0 || countDeleted > 0 {
		logInfo("🧹 Cache cleanup: %d expired, %d removed (%.2f MB freed)", 
			expired, countDeleted, float64(sizeDeleted)/(1024*1024))
	}
}

// logCacheStats periodically logs cache performance
func logCacheStats() {
	hits := atomic.LoadUint64(&cacheStats.hits)
	misses := atomic.LoadUint64(&cacheStats.misses)
	savedBytes := atomic.LoadUint64(&cacheStats.savedBytes)
	
	total := hits + misses
	if total == 0 {
		return
	}
	
	hitRate := float64(hits) / float64(total) * 100
	savedMB := float64(savedBytes) / (1024 * 1024)
	
	logInfo("📊 Cache stats: %d hits, %d misses (%.1f%% hit rate), %.2f MB saved", 
		hits, misses, hitRate, savedMB)
}

// ==================== END TILE CACHING ====================

func init() {
	// Parse log level from environment
	logLevelStr := strings.ToUpper(os.Getenv("LOG_LEVEL"))
	switch logLevelStr {
	case "DEBUG":
		logLevel = DEBUG
	case "INFO", "":
		logLevel = INFO
	case "WARN", "WARNING":
		logLevel = WARN
	case "ERROR":
		logLevel = ERROR
	default:
		logLevel = INFO
		logWarn("Unknown LOG_LEVEL '%s', defaulting to INFO", logLevelStr)
	}
	
	logInfo("Log level set to: %s", []string{"DEBUG", "INFO", "WARN", "ERROR"}[logLevel])
	
	// Load API keys from YAML file
	if err := loadAPIKeys(); err != nil {
		logWarn("Failed to load api_keys.yaml: %v", err)
		logWarn("Falling back to environment variable...")
		
		// Fallback to environment variable
		keysEnv := os.Getenv("MAPY_API_KEYS")
		if keysEnv == "" {
			logWarn("No API keys found. Set MAPY_API_KEYS or create api_keys.yaml")
			apiKeys = []APIKey{{ID: "default", Value: "YOUR_API_KEY"}}
		} else {
			for i, key := range strings.Split(keysEnv, ",") {
				apiKeys = append(apiKeys, APIKey{
					ID:    fmt.Sprintf("env-%d", i+1),
					Value: strings.TrimSpace(key),
				})
			}
			logInfo("🔑 Loaded %d API key(s) from environment", len(apiKeys))
		}
	} else {
		logInfo("🔑 Loaded %d API key(s) from api_keys.yaml", len(apiKeys))
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
	
	// Initialize tile cache
	initCache()
	
	// Periodically log cache stats
	go func() {
		for {
			time.Sleep(5 * time.Minute)
			logCacheStats()
		}
	}()
}

func loadAPIKeys() error {
	// Try settings.yaml first, fall back to api_keys.yaml
	var data []byte
	var err error
	var configFile string
	
	data, err = os.ReadFile("settings.yaml")
	if err == nil {
		configFile = "settings.yaml"
	} else {
		data, err = os.ReadFile("api_keys.yaml")
		if err != nil {
			return err
		}
		configFile = "api_keys.yaml"
	}
	
	logInfo("📄 Loading config from %s", configFile)

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
		return fmt.Errorf("no API keys found in %s", configFile)
	}
	
	// Load cache config with defaults for missing values
	cacheMutex.Lock()
	defer cacheMutex.Unlock()
	
	if config.Cache.TTLDays > 0 {
		cacheConfig.TTLDays = config.Cache.TTLDays
	}
	if config.Cache.MaxSizeMB > 0 {
		cacheConfig.MaxSizeMB = config.Cache.MaxSizeMB
	}
	if config.Cache.Dir != "" {
		cacheConfig.Dir = config.Cache.Dir
	}
	if config.Cache.CleanupHours > 0 {
		cacheConfig.CleanupHours = config.Cache.CleanupHours
	}
	
	logInfo("📦 Cache config: TTL=%d days, MaxSize=%dMB, Dir=%s, Cleanup=%dh",
		cacheConfig.TTLDays, cacheConfig.MaxSizeMB, cacheConfig.Dir, cacheConfig.CleanupHours)

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

// Proxy handler for Mapy.cz API requests with retry logic and caching
func proxyHandler(w http.ResponseWriter, r *http.Request) {
	// Extract path after /api/mapy/
	apiPath := strings.TrimPrefix(r.URL.Path, "/api/mapy/")
	
	// Parse query parameters
	query := r.URL.Query()
	
	// Check if this request is cacheable (tile requests)
	shouldCache := isCacheable(apiPath)
	var cacheKey string
	
	if shouldCache {
		cacheKey = getCacheKey(apiPath, query)
		
		// Try to serve from cache
		if data, headers, found := readFromCache(cacheKey); found {
			// Cache hit! Serve from cache
			atomic.AddUint64(&cacheStats.hits, 1)
			atomic.AddUint64(&cacheStats.savedBytes, uint64(len(data)))
			
			// Set headers from cache
			for k, v := range headers {
				w.Header().Set(k, v)
			}
			
			// Add CORS and cache headers
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("X-Cache", "HIT")
			w.Header().Set("Cache-Control", "public, max-age="+strconv.Itoa(cacheConfig.TTLDays*24*60*60))
			
			w.WriteHeader(http.StatusOK)
			w.Write(data)
			
			logDebug("📦 Cache HIT: %s", apiPath)
			return
		}
		
		// Cache miss
		atomic.AddUint64(&cacheStats.misses, 1)
		logDebug("📦 Cache MISS: %s", apiPath)
	}
	
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
		
		// Construct target URL with proper URL encoding
		queryParams := url.Values{}
		for k, v := range attemptQuery {
			for _, val := range v {
				queryParams.Add(k, val)
			}
		}
		targetURL := fmt.Sprintf("https://api.mapy.cz/%s?%s", apiPath, queryParams.Encode())
		
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
			logError("❌ [%s] Network error: %v", apiKey.ID, err)
			if attempt < maxAttempts-1 {
				logInfo("🔄 Retrying with next API key...")
				continue
			}
			http.Error(w, err.Error(), http.StatusBadGateway)
			return
		}
		
		// Check for API key errors (401, 403)
		if resp.StatusCode == 401 || resp.StatusCode == 403 {
			logError("❌ [%s] Invalid API key (HTTP %d)", apiKey.ID, resp.StatusCode)
			resp.Body.Close() // Close before retrying
			if attempt < maxAttempts-1 {
				logInfo("🔄 Retrying with next API key...")
				continue
			}
			// Last attempt failed, return the error
			http.Error(w, "API key authentication failed", resp.StatusCode)
			return
		}
		
		// Success! Log at DEBUG level for 200s
		if resp.StatusCode >= 200 && resp.StatusCode < 300 {
			logDebug("✅ [%s] Request successful (HTTP %d) - %s", apiKey.ID, resp.StatusCode, apiPath)
		} else if resp.StatusCode >= 400 {
			logWarn("⚠️  [%s] Request returned error (HTTP %d) - %s", apiKey.ID, resp.StatusCode, apiPath)
		}
		
		// Read response body (we need it for caching anyway)
		body, err := io.ReadAll(resp.Body)
		resp.Body.Close() // Close immediately after reading
		if err != nil {
			http.Error(w, "Failed to read response", http.StatusBadGateway)
			return
		}
		
		// Cache successful tile responses
		if shouldCache && resp.StatusCode == 200 && len(body) > 0 {
			logDebug("📝 Will cache: %s (key: %s, size: %d)", apiPath, cacheKey, len(body))
			// Prepare headers to cache
			cacheHeaders := map[string]string{
				"Content-Type": resp.Header.Get("Content-Type"),
			}
			if ct := resp.Header.Get("Content-Length"); ct != "" {
				cacheHeaders["Content-Length"] = ct
			}
			
			// Write to cache asynchronously - capture apiPath in closure
			pathForLog := apiPath
			go func(key string, data []byte, headers map[string]string, logPath string) {
				if err := writeToCache(key, data, headers); err != nil {
					logWarn("Failed to cache tile: %v", err)
				} else {
					logDebug("📦 Cached: %s (%d bytes)", logPath, len(data))
				}
			}(cacheKey, body, cacheHeaders, pathForLog)
		} else if shouldCache {
			logDebug("⚠️ Not caching: status=%d, bodyLen=%d", resp.StatusCode, len(body))
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
		
		// Add cache headers
		if shouldCache {
			w.Header().Set("X-Cache", "MISS")
			w.Header().Set("Cache-Control", "public, max-age="+strconv.Itoa(cacheConfig.TTLDays*24*60*60))
		}
		
		// Write status code
		w.WriteHeader(resp.StatusCode)
		
		// Write response body
		w.Write(body)
		return
	}
	
	// All attempts failed
	logError("❌ All %d API keys failed", maxAttempts)
	http.Error(w, "All API keys failed", http.StatusUnauthorized)
}

// Cache stats and management endpoint
func cacheHandler(w http.ResponseWriter, r *http.Request) {
	action := r.URL.Query().Get("action")
	
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	
	switch action {
	case "clear":
		// Clear the entire cache
		if err := os.RemoveAll(cacheConfig.Dir); err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			fmt.Fprintf(w, `{"error": "Failed to clear cache: %s"}`, err.Error())
			return
		}
		os.MkdirAll(cacheConfig.Dir, 0755)
		
		// Reset stats
		atomic.StoreUint64(&cacheStats.hits, 0)
		atomic.StoreUint64(&cacheStats.misses, 0)
		atomic.StoreUint64(&cacheStats.savedBytes, 0)
		
		logInfo("🗑️ Cache cleared by request")
		fmt.Fprintf(w, `{"status": "cleared"}`)
		
	case "cleanup":
		// Force cleanup
		go cleanupCache()
		fmt.Fprintf(w, `{"status": "cleanup_started"}`)
		
	default:
		// Return stats
		hits := atomic.LoadUint64(&cacheStats.hits)
		misses := atomic.LoadUint64(&cacheStats.misses)
		savedBytes := atomic.LoadUint64(&cacheStats.savedBytes)
		size, count := getCacheSize()
		
		total := hits + misses
		hitRate := float64(0)
		if total > 0 {
			hitRate = float64(hits) / float64(total) * 100
		}
		
		fmt.Fprintf(w, `{
	"hits": %d,
	"misses": %d,
	"hit_rate_percent": %.2f,
	"saved_bytes": %d,
	"saved_mb": %.2f,
	"cache_size_bytes": %d,
	"cache_size_mb": %.2f,
	"cached_files": %d,
	"ttl_days": %d,
	"max_size_mb": %d
}`, hits, misses, hitRate, savedBytes, float64(savedBytes)/(1024*1024),
			size, float64(size)/(1024*1024), count, cacheConfig.TTLDays, cacheConfig.MaxSizeMB)
	}
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
	
	// WebSocket endpoint
	if r.URL.Path == "/ws" {
		handleWebSocket(w, r)
		return
	}
	
	// Cache management endpoint
	if r.URL.Path == "/api/cache" {
		cacheHandler(w, r)
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
	logInfo("🚀 Server running on http://localhost%s", addr)
	logInfo("📊 Connection pool: 100 max idle connections")
	logInfo("📦 Tile cache: %d-day TTL, %dMB max size, dir: %s", cacheConfig.TTLDays, cacheConfig.MaxSizeMB, cacheConfig.Dir)
	logInfo("📍 Cache stats endpoint: /api/cache")
	
	if err := http.ListenAndServe(addr, nil); err != nil {
		logError("Failed to start server: %v", err)
		os.Exit(1)
	}
}
