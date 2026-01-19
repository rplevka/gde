# 🌍 GDE - Geo Guessing Game

A geo-guessing game powered by Mapy.cz panoramas. Explore Czech Republic through street-level imagery and test your geographic knowledge!

## Features

### Single Player
- 🎮 **Two Game Modes**: Explorer (movable) and Static (fixed view)
- 🗺️ **Multiple Regions**: Czech Republic, Prague, Brno, Moravia, Bohemia
- ✏️ **Custom Regions**: Draw your own play areas on the map
- 📍 **Interactive Minimap**: Expandable map overlay for making guesses
- 🗾 **Region Boundaries**: Visual polygon overlays showing exact play area
- ⚙️ **Difficulty Preferences**: Customize game difficulty with toggles
- ⏱️ **Time Trial Mode**: Optional countdown timer per round
- 🎯 **Scoring System**: Distance-based scoring (max 5000 points per round)
- 📊 **Round Breakdown**: Detailed results with visual comparison

### Multiplayer
- 👥 **Real-time Multiplayer**: Play with friends via WebSocket connections
- 🎮 **Session System**: Create or join game sessions with unique codes
- 🏆 **Competitive Gameplay**: First player to submit triggers 60-second timer
- 👑 **Host Controls**: Session owner manages settings and can kick players
- ✅ **Ready System**: All players must be ready before game starts
- 🎨 **Player Profiles**: Choose nickname and emoji icon
- 📊 **Live Lobby**: See all players and their ready status in real-time

### Technical
- 🔑 **API Key Pool**: Support for multiple API keys with automatic rotation
- 🔄 **WebSocket Server**: Real-time communication for multiplayer
- 🐳 **Docker Support**: Easy deployment with containerization

## Setup

### 1. Get API Keys

Get your free API key(s) from [Mapy.cz Developer Portal](https://developer.mapy.com):
1. Sign up for an account
2. Create a new project
3. Generate one or more API keys

**Note:** API keys are stored server-side for security using a YAML configuration file.

### 2. Configure API Keys

Create `api_keys.yaml` from the example:

```bash
cp api_keys.example.yaml api_keys.yaml
```

Edit `api_keys.yaml` and add your API keys with descriptive names:

```yaml
api_keys:
  - production_key: "your-actual-api-key-1"
  - backup_key: "your-actual-api-key-2"
  - dev_key: "your-actual-api-key-3"
```

**Features:**
- **Named keys**: Each key has an ID for easy identification in logs
- **Automatic retry**: If a key fails (401/403), automatically tries the next one
- **Fallback**: Can still use `MAPY_API_KEYS` environment variable if YAML file is missing

### 3. Run the Game

**Option A: Using Docker with Secure Proxy (Recommended)**

```bash
# Build the Docker image
docker build -t gde-game .

# Run with api_keys.yaml mounted as volume
docker run -p 8000:8000 \
  -v $(pwd)/api_keys.yaml:/app/api_keys.yaml \
  gde-game

# With custom log level (DEBUG, INFO, WARN, ERROR)
docker run -p 8000:8000 \
  -v $(pwd)/api_keys.yaml:/app/api_keys.yaml \
  -e LOG_LEVEL=DEBUG \
  gde-game

# Alternative: Use environment variable (fallback method)
docker run -p 8000:8000 \
  -e MAPY_API_KEYS="your-key-1,your-key-2" \
  gde-game

# Then open http://localhost:8000
```

This uses a high-performance Go proxy server with automatic retry logic.

**Option B: Local Go Server with Proxy**

```bash
# Install Go if you don't have it: https://go.dev/dl/

# Make sure api_keys.yaml is configured (see step 2)

# Download dependencies (including WebSocket support)
go mod download

# Run both server files (includes multiplayer support)
go run server.go multiplayer.go

# With custom log level
LOG_LEVEL=DEBUG go run server.go multiplayer.go

# Then open http://localhost:8000
```

**Log Levels:**
- `DEBUG` - Shows all requests including successful 200 responses
- `INFO` - Shows startup info, key loading, retries (default)
- `WARN` - Shows warnings and errors only
- `ERROR` - Shows errors only

The server will automatically load keys from `api_keys.yaml` and log which key is being used for each request.

## How to Play

1. **Select Region**: Choose from predefined regions or draw your own
2. **Select Mode**: Explorer (move around) or Static (fixed view)
3. **Start Game**: Click "Start Game" to begin
4. **Explore**: Look around the panorama to identify your location
5. **Make Guess**: Click on the minimap to place your guess
6. **Submit**: Click "Submit Guess" to see results
7. **Next Round**: Continue for 5 rounds total

## Custom Region Drawing

1. Click **"Draw Region"** on the start screen
2. Use **"Move Map"** mode to navigate to your desired area
3. Switch to **"Draw"** mode and paint your custom region
4. Draw multiple separate areas if desired
5. Click **"Confirm Region"** to use your custom area

## Project Structure

```
gde/
├── index.html          # Main HTML file
├── app.js              # Game logic
├── styles.css          # Styling
├── config.js           # API key (gitignored)
├── config.example.js   # API key template
└── README.md           # This file
```

## Security

⚠️ **Important**: API keys in client-side JavaScript are always exposed and can be extracted from browser DevTools.

**For Production Use:**
- Use the included `server.go` proxy server (runs automatically with Docker)
- Store API keys as environment variables, never in code
- See [SECURITY.md](SECURITY.md) for detailed security guide

**For Development:**
- Use `config.js` with API key restrictions in Mapy.cz console
- Restrict by HTTP referrer or IP address
- Monitor usage and set rate limits

## Technologies

- **Mapy.cz Panorama API** - Street-level imagery
- **Leaflet.js** - Interactive maps
- **Vanilla JavaScript** - No frameworks, pure vibes
- **Go Proxy Server** - High-performance secure API key handling with connection pooling

## Credits

Heavily vibe-coded, as God intended.

Powered by [Mapy.cz](https://mapy.cz) API.
