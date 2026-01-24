package main

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for development
	},
}

type Player struct {
	ID        string          `json:"id"`
	Nick      string          `json:"nick"`
	Icon      string          `json:"icon"`
	IsReady   bool            `json:"isReady"`
	IsOwner   bool            `json:"isOwner"`
	Conn      *websocket.Conn `json:"-"`
	Session   *GameSession    `json:"-"`
	HasGuess  bool            `json:"hasGuess"`
	Score     int             `json:"score"`
	GuessLat  float64         `json:"guessLat,omitempty"`
	GuessLon  float64         `json:"guessLon,omitempty"`
	RoundScore int            `json:"roundScore,omitempty"`
}

type GameSession struct {
	Code        string             `json:"code"`
	Players     map[string]*Player `json:"players"`
	Owner       *Player            `json:"-"`
	Settings    GameSettings       `json:"settings"`
	State       string             `json:"state"` // "lobby", "playing", "finished"
	Round       int                `json:"round"`
	Location    *Location          `json:"location,omitempty"`
	StartTime   time.Time          `json:"startTime,omitempty"`
	TimerCancel chan bool          `json:"-"` // Channel to cancel active timer
	mutex       sync.RWMutex
}

// CustomRegionBounds defines the bounding box for a custom region
type CustomRegionBounds struct {
	MinLat float64 `json:"minLat"`
	MaxLat float64 `json:"maxLat"`
	MinLon float64 `json:"minLon"`
	MaxLon float64 `json:"maxLon"`
}

// CustomRegion represents a user-defined region (drawn polygon or search-based circle)
type CustomRegion struct {
	Name   string               `json:"name"`
	Bounds CustomRegionBounds   `json:"bounds"`
	Paths  [][][]float64        `json:"paths"` // Array of polygons, each polygon is array of [lat, lon]
	Center *Location            `json:"center,omitempty"` // Only for search-based regions
	Radius *int                 `json:"radius,omitempty"` // Only for search-based regions (km)
}

type GameSettings struct {
	Region         string        `json:"region"`
	Mode           string        `json:"mode"`
	MapLayers      bool          `json:"mapLayers"`
	ShowRegion     bool          `json:"showRegion"`
	TurnAround     bool          `json:"turnAround"`
	Zoom           bool          `json:"zoom"`
	TargetOriginal bool          `json:"targetOriginal"`
	CustomRegion   *CustomRegion `json:"customRegion,omitempty"`
}

type Location struct {
	Lat  float64 `json:"lat"`
	Lon  float64 `json:"lon"`
	Date string  `json:"date,omitempty"`
}

type WSMessage struct {
	Type    string      `json:"type"`
	Payload interface{} `json:"payload"`
}

var (
	sessions      = make(map[string]*GameSession)
	sessionsMutex sync.RWMutex
)

// Parse custom region from JSON map
func parseCustomRegion(data map[string]interface{}) *CustomRegion {
	cr := &CustomRegion{}
	
	if name, ok := data["name"].(string); ok {
		cr.Name = name
	}
	
	if boundsMap, ok := data["bounds"].(map[string]interface{}); ok {
		cr.Bounds = CustomRegionBounds{
			MinLat: getFloat(boundsMap, "minLat"),
			MaxLat: getFloat(boundsMap, "maxLat"),
			MinLon: getFloat(boundsMap, "minLon"),
			MaxLon: getFloat(boundsMap, "maxLon"),
		}
	}
	
	if paths, ok := data["paths"].([]interface{}); ok {
		for _, pathData := range paths {
			if pathArray, ok := pathData.([]interface{}); ok {
				var path [][]float64
				for _, pointData := range pathArray {
					if pointArray, ok := pointData.([]interface{}); ok && len(pointArray) >= 2 {
						lat := getFloatFromInterface(pointArray[0])
						lon := getFloatFromInterface(pointArray[1])
						path = append(path, []float64{lat, lon})
					}
				}
				cr.Paths = append(cr.Paths, path)
			}
		}
	}
	
	// Optional center (for search-based regions)
	if centerMap, ok := data["center"].(map[string]interface{}); ok {
		cr.Center = &Location{
			Lat: getFloat(centerMap, "lat"),
			Lon: getFloat(centerMap, "lon"),
		}
	}
	
	// Optional radius (for search-based regions)
	if radius, ok := data["radius"].(float64); ok {
		radiusInt := int(radius)
		cr.Radius = &radiusInt
	}
	
	return cr
}

// Helper to get float from map
func getFloat(m map[string]interface{}, key string) float64 {
	if val, ok := m[key].(float64); ok {
		return val
	}
	return 0
}

// Helper to get float from interface
func getFloatFromInterface(val interface{}) float64 {
	if f, ok := val.(float64); ok {
		return f
	}
	return 0
}

// Generate random session code
func generateSessionCode() string {
	bytes := make([]byte, 3)
	rand.Read(bytes)
	return hex.EncodeToString(bytes)
}

// Create new session
func createSession(owner *Player, initialSettings *GameSettings) *GameSession {
	code := generateSessionCode()
	
	// Default settings
	settings := GameSettings{
		Region:         "czechia",
		Mode:           "static",
		MapLayers:      true,
		ShowRegion:     true,
		TurnAround:     true,
		Zoom:           true,
		TargetOriginal: true,
	}
	
	// Use initial settings if provided
	if initialSettings != nil {
		if initialSettings.Region != "" {
			settings.Region = initialSettings.Region
		}
		if initialSettings.Mode != "" {
			settings.Mode = initialSettings.Mode
		}
		settings.MapLayers = initialSettings.MapLayers
		settings.ShowRegion = initialSettings.ShowRegion
		settings.TurnAround = initialSettings.TurnAround
		settings.Zoom = initialSettings.Zoom
		settings.TargetOriginal = initialSettings.TargetOriginal
		// Apply custom region if provided
		if initialSettings.CustomRegion != nil {
			settings.CustomRegion = initialSettings.CustomRegion
		}
	}
	
	session := &GameSession{
		Code:        code,
		Players:     make(map[string]*Player),
		Owner:       owner,
		State:       "lobby",
		Round:       0,
		TimerCancel: make(chan bool, 1),
		Settings:    settings,
	}
	
	owner.Session = session
	owner.IsOwner = true
	session.Players[owner.ID] = owner
	
	sessionsMutex.Lock()
	sessions[code] = session
	sessionsMutex.Unlock()
	
	return session
}

// Join existing session
func joinSession(code string, player *Player) (*GameSession, error) {
	// Convert to lowercase for case-insensitive lookup
	code = strings.ToLower(code)
	
	sessionsMutex.RLock()
	log.Printf("Attempting to join session: %s", code)
	log.Printf("Available sessions: %d total", len(sessions))
	for k := range sessions {
		log.Printf("  - Session: %s", k)
	}
	session, exists := sessions[code]
	sessionsMutex.RUnlock()
	
	if !exists {
		log.Printf("Session not found: %s", code)
		return nil, fmt.Errorf("session not found")
	}
	
	log.Printf("Session found: %s with %d players", code, len(session.Players))
	
	session.mutex.Lock()
	defer session.mutex.Unlock()
	
	if session.State != "lobby" {
		return nil, fmt.Errorf("game already started")
	}
	
	player.Session = session
	session.Players[player.ID] = player
	
	return session, nil
}

// Broadcast message to all players in session
func (s *GameSession) broadcast(msgType string, payload interface{}) {
	s.mutex.RLock()
	defer s.mutex.RUnlock()
	
	msg := WSMessage{
		Type:    msgType,
		Payload: payload,
	}
	
	data, err := json.Marshal(msg)
	if err != nil {
		log.Printf("Error marshaling message: %v", err)
		return
	}
	
	for _, player := range s.Players {
		if player.Conn != nil {
			err := player.Conn.WriteMessage(websocket.TextMessage, data)
			if err != nil {
				log.Printf("Error sending to player %s: %v", player.Nick, err)
			}
		}
	}
}

// Send message to specific player
func (p *Player) send(msgType string, payload interface{}) {
	msg := WSMessage{
		Type:    msgType,
		Payload: payload,
	}
	
	data, err := json.Marshal(msg)
	if err != nil {
		log.Printf("Error marshaling message: %v", err)
		return
	}
	
	if p.Conn != nil {
		err := p.Conn.WriteMessage(websocket.TextMessage, data)
		if err != nil {
			log.Printf("Error sending to player %s: %v", p.Nick, err)
		}
	}
}

// Send error message directly to a connection (before player is created)
func sendErrorToConn(conn *websocket.Conn, message string) {
	msg := WSMessage{
		Type:    "error",
		Payload: map[string]string{"message": message},
	}
	
	data, err := json.Marshal(msg)
	if err != nil {
		log.Printf("Error marshaling error message: %v", err)
		return
	}
	
	if conn != nil {
		conn.WriteMessage(websocket.TextMessage, data)
	}
}

// Remove player from session
func (s *GameSession) removePlayer(playerID string) {
	s.mutex.Lock()
	
	player, exists := s.Players[playerID]
	if !exists {
		s.mutex.Unlock()
		return
	}
	
	delete(s.Players, playerID)
	
	// If owner left, assign new owner
	if player.IsOwner && len(s.Players) > 0 {
		for _, p := range s.Players {
			p.IsOwner = true
			s.Owner = p
			break
		}
	}
	
	// Check if session should be deleted
	shouldDelete := len(s.Players) == 0
	s.mutex.Unlock()
	
	// If no players left, delete session and cancel timers
	if shouldDelete {
		// Cancel any active timers
		select {
		case s.TimerCancel <- true:
		default:
		}
		
		sessionsMutex.Lock()
		delete(sessions, s.Code)
		sessionsMutex.Unlock()
		
		log.Printf("Session %s deleted (no players left)", s.Code)
	} else {
		// Notify remaining players (mutex already unlocked)
		log.Printf("Broadcasting playerLeft for %s to %d remaining players in session %s", playerID, len(s.Players), s.Code)
		s.broadcast("playerLeft", map[string]interface{}{
			"playerId": playerID,
			"players":  s.getPlayersList(),
		})
	}
}

// Get list of players for broadcasting
func (s *GameSession) getPlayersList() []map[string]interface{} {
	players := make([]map[string]interface{}, 0, len(s.Players))
	for _, p := range s.Players {
		players = append(players, map[string]interface{}{
			"id":      p.ID,
			"nick":    p.Nick,
			"icon":    p.Icon,
			"isReady": p.IsReady,
			"isOwner": p.IsOwner,
			"score":   p.Score,
		})
	}
	return players
}

// Get player results with guess locations for round end
func (s *GameSession) getPlayerResults() []map[string]interface{} {
	s.mutex.RLock()
	defer s.mutex.RUnlock()
	
	players := make([]map[string]interface{}, 0, len(s.Players))
	for _, p := range s.Players {
		players = append(players, map[string]interface{}{
			"id":         p.ID,
			"nick":       p.Nick,
			"icon":       p.Icon,
			"score":      p.Score,
			"roundScore": p.RoundScore,
			"guessLat":   p.GuessLat,
			"guessLon":   p.GuessLon,
			"hasGuess":   p.HasGuess,
		})
	}
	return players
}

// Check if all players are ready
func (s *GameSession) allPlayersReady() bool {
	s.mutex.RLock()
	defer s.mutex.RUnlock()
	
	if len(s.Players) == 0 {
		return false
	}
	
	for _, p := range s.Players {
		if !p.IsReady {
			return false
		}
	}
	return true
}

// Handle WebSocket connection
func handleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade error: %v", err)
		return
	}
	defer conn.Close()
	
	var player *Player
	
	for {
		var msg WSMessage
		err := conn.ReadJSON(&msg)
		if err != nil {
			if player != nil && player.Session != nil {
				player.Session.removePlayer(player.ID)
			}
			break
		}
		
		handleMessage(conn, &player, msg)
	}
}

func handleMessage(conn *websocket.Conn, player **Player, msg WSMessage) {
	switch msg.Type {
	case "createSession":
		payload, ok := msg.Payload.(map[string]interface{})
		if !ok {
			log.Printf("Invalid createSession payload")
			return
		}
		
		nick, _ := payload["nick"].(string)
		icon, _ := payload["icon"].(string)
		if nick == "" {
			nick = "Player"
		}
		if icon == "" {
			icon = "😀"
		}
		
		*player = &Player{
			ID:      generateSessionCode() + "-" + generateSessionCode(),
			Nick:    nick,
			Icon:    icon,
			IsReady: false,
			Conn:    conn,
			Score:   0,
		}
		
		// Parse initial settings if provided
		var initialSettings *GameSettings
		if settingsMap, ok := payload["settings"].(map[string]interface{}); ok {
			initialSettings = &GameSettings{}
			if region, ok := settingsMap["region"].(string); ok {
				initialSettings.Region = region
			}
			if mode, ok := settingsMap["mode"].(string); ok {
				initialSettings.Mode = mode
			}
			if mapLayers, ok := settingsMap["mapLayers"].(bool); ok {
				initialSettings.MapLayers = mapLayers
			}
			if showRegion, ok := settingsMap["showRegion"].(bool); ok {
				initialSettings.ShowRegion = showRegion
			}
			if turnAround, ok := settingsMap["turnAround"].(bool); ok {
				initialSettings.TurnAround = turnAround
			}
			if zoom, ok := settingsMap["zoom"].(bool); ok {
				initialSettings.Zoom = zoom
			}
			if targetOriginal, ok := settingsMap["targetOriginal"].(bool); ok {
				initialSettings.TargetOriginal = targetOriginal
			}
			// Parse custom region if provided
			if customRegion, ok := settingsMap["customRegion"]; ok && customRegion != nil {
				if crMap, ok := customRegion.(map[string]interface{}); ok {
					initialSettings.CustomRegion = parseCustomRegion(crMap)
				}
			}
		}
		
		session := createSession(*player, initialSettings)
	
		log.Printf("Session created: %s", session.Code)
	
		(*player).send("sessionCreated", map[string]interface{}{
			"code":     session.Code,
			"players":  session.getPlayersList(),
			"settings": session.Settings,
			"isOwner":  true,
		})
		
	case "joinSession":
		payload, ok := msg.Payload.(map[string]interface{})
		if !ok {
			log.Printf("Invalid joinSession payload")
			return
		}
		
		nick, _ := payload["nick"].(string)
		icon, _ := payload["icon"].(string)
		code, _ := payload["code"].(string)
		
		if nick == "" {
			nick = "Player"
		}
		if icon == "" {
			icon = "😀"
		}
		if code == "" {
			sendErrorToConn(conn, "Session code is required")
			return
		}
		
		*player = &Player{
			ID:      generateSessionCode() + "-" + generateSessionCode(),
			Nick:    nick,
			Icon:    icon,
			IsReady: false,
			Conn:    conn,
			Score:   0,
		}
		
		session, err := joinSession(code, *player)
		if err != nil {
			(*player).send("error", map[string]string{"message": err.Error()})
			return
		}
		
		(*player).send("sessionJoined", map[string]interface{}{
			"code":     session.Code,
			"players":  session.getPlayersList(),
			"settings": session.Settings,
			"isOwner":  false,
		})
		
		session.broadcast("playerJoined", map[string]interface{}{
			"players": session.getPlayersList(),
		})
		
	case "toggleReady":
		if *player == nil || (*player).Session == nil {
			return
		}
		
		session := (*player).Session
		session.mutex.Lock()
		(*player).IsReady = !(*player).IsReady
		session.mutex.Unlock()
		
		session.broadcast("playerReady", map[string]interface{}{
			"playerId":      (*player).ID,
			"isReady":       (*player).IsReady,
			"allReady":      session.allPlayersReady(),
			"players":       session.getPlayersList(),
		})
		
	case "updateSettings":
		if *player == nil || (*player).Session == nil || !(*player).IsOwner {
			return
		}
		
		payload := msg.Payload.(map[string]interface{})
		session := (*player).Session
		
		session.mutex.Lock()
		if region, ok := payload["region"].(string); ok {
			session.Settings.Region = region
		}
		if mode, ok := payload["mode"].(string); ok {
			session.Settings.Mode = mode
		}
		if mapLayers, ok := payload["mapLayers"].(bool); ok {
			session.Settings.MapLayers = mapLayers
		}
		if showRegion, ok := payload["showRegion"].(bool); ok {
			session.Settings.ShowRegion = showRegion
		}
		if turnAround, ok := payload["turnAround"].(bool); ok {
			session.Settings.TurnAround = turnAround
		}
		if zoom, ok := payload["zoom"].(bool); ok {
			session.Settings.Zoom = zoom
		}
		if targetOriginal, ok := payload["targetOriginal"].(bool); ok {
			session.Settings.TargetOriginal = targetOriginal
		}
		// Handle custom region data
		if customRegion, ok := payload["customRegion"]; ok {
			if customRegion == nil {
				session.Settings.CustomRegion = nil
			} else if crMap, ok := customRegion.(map[string]interface{}); ok {
				session.Settings.CustomRegion = parseCustomRegion(crMap)
			}
		}
		session.mutex.Unlock()
		
		session.broadcast("settingsUpdated", map[string]interface{}{
			"settings": session.Settings,
		})
		
	case "kickPlayer":
		if *player == nil || (*player).Session == nil || !(*player).IsOwner {
			return
		}
		
		payload := msg.Payload.(map[string]interface{})
		targetID := payload["playerId"].(string)
		session := (*player).Session
		
		session.mutex.RLock()
		targetPlayer, exists := session.Players[targetID]
		session.mutex.RUnlock()
		
		if exists && targetPlayer.ID != (*player).ID {
			log.Printf("Kicking player %s from session %s", targetID, session.Code)
			
			// Save connection reference before removing
			targetConn := targetPlayer.Conn
			
			// Notify the kicked player first
			targetPlayer.send("kicked", map[string]string{"message": "You were kicked from the session"})
			
			// Remove from session and notify others
			session.removePlayer(targetID)
			
			// Close the kicked player's connection
			if targetConn != nil {
				targetConn.Close()
			}
		}
		
	case "startGame":
		if *player == nil || (*player).Session == nil || !(*player).IsOwner {
			return
		}
		
		session := (*player).Session
		if !session.allPlayersReady() {
			(*player).send("error", map[string]string{"message": "Not all players are ready"})
			return
		}
		
		session.mutex.Lock()
		session.State = "playing"
		session.Round = 1
		// Reset all players' guess status
		for _, p := range session.Players {
			p.HasGuess = false
		}
		// Clear location for new game
		session.Location = nil
		session.mutex.Unlock()
		
		session.broadcast("gameStarted", map[string]interface{}{
			"settings": session.Settings,
		})
		
	case "submitGuess":
		if *player == nil || (*player).Session == nil {
			return
		}
		
		payload := msg.Payload.(map[string]interface{})
		session := (*player).Session
		
		session.mutex.Lock()
		(*player).HasGuess = true
		(*player).GuessLat = payload["lat"].(float64)
		(*player).GuessLon = payload["lon"].(float64)
		
		// Calculate score if payload includes it
		if score, ok := payload["score"].(float64); ok {
			(*player).RoundScore = int(score)
			(*player).Score += int(score)
		}
		
		// Check if this is the first guess and if all players have submitted
		firstGuess := true
		allSubmitted := true
		for _, p := range session.Players {
			if p.ID != (*player).ID && p.HasGuess {
				firstGuess = false
			}
			if !p.HasGuess {
				allSubmitted = false
			}
		}
		session.mutex.Unlock()
		
		// If all players submitted, end round immediately
		if allSubmitted {
			log.Printf("All players submitted in session %s", session.Code)
			
			// Cancel any existing 60-second timer
			select {
			case session.TimerCancel <- true:
			default:
			}
			
			// Broadcast round end immediately
			session.broadcast("roundEnd", map[string]interface{}{
				"round":   session.Round,
				"players": session.getPlayerResults(),
			})
			
			// Start 5-second countdown for next round (with its own cancel channel)
			go func(s *GameSession) {
				timer := time.NewTimer(5 * time.Second)
				nextRoundCancel := make(chan bool, 1)
				
				// Replace the cancel channel so new cancellations don't affect this timer
				s.mutex.Lock()
				s.TimerCancel = nextRoundCancel
				s.mutex.Unlock()
				
				select {
				case <-timer.C:
					s.mutex.Lock()
					currentRound := s.Round
					s.mutex.Unlock()
					
					// Check if game is finished (5 rounds total)
					if currentRound >= 5 {
						log.Printf("Game finished for session %s", s.Code)
						s.broadcast("gameFinished", map[string]interface{}{
							"players": s.getPlayerResults(),
						})
					} else {
						s.mutex.Lock()
						s.Round++
						s.Location = nil
						for _, p := range s.Players {
							p.HasGuess = false
							p.GuessLat = 0
							p.GuessLon = 0
							p.RoundScore = 0
						}
						s.mutex.Unlock()
						
						log.Printf("Starting next round %d for session %s", s.Round, s.Code)
						s.broadcast("startNextRound", map[string]interface{}{
							"round": s.Round,
						})
					}
				case <-nextRoundCancel:
					timer.Stop()
					log.Printf("Next round timer cancelled for session %s", s.Code)
				}
			}(session)
			
		} else if firstGuess {
			// If first guess, start 10-second timer
			session.StartTime = time.Now()
			
			// Cancel any existing timer
			select {
			case session.TimerCancel <- true:
			default:
			}
			
			// Create new cancel channel for this timer
			newTimerCancel := make(chan bool, 1)
			session.mutex.Lock()
			session.TimerCancel = newTimerCancel
			session.mutex.Unlock()
			
			log.Printf("Starting 10-second timer for session %s", session.Code)
			
			session.broadcast("timerStarted", map[string]interface{}{
				"duration": 10,
			})
			
			// Start timer goroutine with cancellation support
			go func(s *GameSession, cancelChan chan bool) {
				log.Printf("Timer goroutine started for session %s", s.Code)
				timer := time.NewTimer(10 * time.Second)
				
				select {
				case <-timer.C:
					// Timer completed normally
					log.Printf("10-second timer expired for session %s", s.Code)
					
					// Broadcast round end with all player results
					s.broadcast("roundEnd", map[string]interface{}{
						"round":   s.Round,
						"players": s.getPlayerResults(),
					})
					
					// Wait 5 seconds before next round (with new cancel channel)
					nextRoundTimer := time.NewTimer(5 * time.Second)
					nextRoundCancel := make(chan bool, 1)
					
					// Replace the cancel channel so new cancellations don't affect this timer
					s.mutex.Lock()
					s.TimerCancel = nextRoundCancel
					s.mutex.Unlock()
					
					select {
					case <-nextRoundTimer.C:
						s.mutex.Lock()
						currentRound := s.Round
						s.mutex.Unlock()
						
						// Check if game is finished (5 rounds total)
						if currentRound >= 5 {
							log.Printf("Game finished for session %s", s.Code)
							s.broadcast("gameFinished", map[string]interface{}{
								"players": s.getPlayerResults(),
							})
						} else {
							// Auto-start next round
							s.mutex.Lock()
							s.Round++
							s.Location = nil
							for _, p := range s.Players {
								p.HasGuess = false
								p.GuessLat = 0
								p.GuessLon = 0
								p.RoundScore = 0
							}
							s.mutex.Unlock()
							
							log.Printf("Starting next round %d for session %s", s.Round, s.Code)
							s.broadcast("startNextRound", map[string]interface{}{
								"round": s.Round,
							})
						}
					case <-nextRoundCancel:
						// Cancelled during 5-second wait
						nextRoundTimer.Stop()
						log.Printf("Next round timer cancelled for session %s", s.Code)
					}
					
				case <-cancelChan:
					// Timer was cancelled
					timer.Stop()
					log.Printf("Round timer cancelled for session %s", s.Code)
				}
			}(session, newTimerCancel)
		}
		
		// Broadcast that player submitted with their info
		session.broadcast("playerSubmitted", map[string]interface{}{
			"playerId": (*player).ID,
			"nick":     (*player).Nick,
			"icon":     (*player).Icon,
		})
		
		// Store guess data
		(*player).send("guessReceived", payload)
	
	case "requestLocation":
		if *player == nil || (*player).Session == nil {
			return
		}
		
		payload := msg.Payload.(map[string]interface{})
		session := (*player).Session
		
		// Store location from client (first player to find it)
		session.mutex.Lock()
		if session.Location == nil && payload["lat"].(float64) != 0 {
			// Client found a location, store and broadcast it
			session.Location = &Location{
				Lat: payload["lat"].(float64),
				Lon: payload["lon"].(float64),
			}
			if date, ok := payload["date"].(string); ok {
				session.Location.Date = date
			}
			log.Printf("Location set for session %s: %.6f, %.6f", session.Code, session.Location.Lat, session.Location.Lon)
			
			// Broadcast to all players
			session.mutex.Unlock()
			session.broadcast("locationData", map[string]interface{}{
				"lat":  session.Location.Lat,
				"lon":  session.Location.Lon,
				"date": session.Location.Date,
			})
			return
		}
		
		// If location already exists, send it to this player
		if session.Location != nil {
			loc := session.Location
			session.mutex.Unlock()
			(*player).send("locationData", map[string]interface{}{
				"lat":  loc.Lat,
				"lon":  loc.Lon,
				"date": loc.Date,
			})
		} else {
			session.mutex.Unlock()
		}
	
	case "nextRound":
		if *player == nil || (*player).Session == nil {
			return
		}
		
		session := (*player).Session
		
		session.mutex.Lock()
		session.Round++
		session.Location = nil // Clear location for next round
		for _, p := range session.Players {
			p.HasGuess = false
		}
		session.mutex.Unlock()
		
		log.Printf("Session %s starting round %d", session.Code, session.Round)
		
		// Notify all players to start next round
		session.broadcast("startNextRound", map[string]interface{}{
			"round": session.Round,
		})
		
	case "locationFailed":
		if *player == nil || (*player).Session == nil {
			return
		}
		
		payload := msg.Payload.(map[string]interface{})
		session := (*player).Session
		
		log.Printf("Location failed for session %s: %.6f, %.6f", session.Code, payload["lat"].(float64), payload["lon"].(float64))
		
		// Clear the failed location
		session.mutex.Lock()
		session.Location = nil
		session.mutex.Unlock()
		
		// Broadcast to all players to retry
		session.broadcast("retryLocation", map[string]interface{}{
			"message": "Panorama failed to load, finding new location...",
		})
	}
}
