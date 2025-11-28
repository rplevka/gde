# 🌍 GDE - Geo Guessing Game

A geo-guessing game powered by Mapy.cz panoramas. Explore Czech Republic through street-level imagery and test your geographic knowledge!

## Features

- 🎮 **Two Game Modes**: Explorer (movable) and Static (fixed view)
- 🗺️ **Multiple Regions**: Czech Republic, Prague, Brno, Moravia, Bohemia
- ✏️ **Custom Regions**: Draw your own play areas on the map
- 📍 **Interactive Minimap**: Expandable map overlay for making guesses
- 🗾 **Region Boundaries**: Visual polygon overlays showing exact play area
- ⚙️ **Difficulty Preferences**: Customize game difficulty with toggles
- 🔑 **API Key Pool**: Support for multiple API keys with automatic rotation
- 🎯 **Scoring System**: Distance-based scoring (max 5000 points per round)
- 📊 **Round Breakdown**: Detailed results with visual comparison

## Setup

### 1. Get API Key

Get a free API key from [Mapy.cz Developer Portal](https://developer.mapy.com):
1. Sign up for an account
2. Create a new project
3. Generate an API key

### 2. Configure API Key

```bash
# Copy the example config file
cp config.example.js config.js

# Edit config.js and add your API key(s)
```

**Configure API Keys:**
```javascript
const APP_CONFIG = {
    MAPY_API_KEYS: [
        'your-api-key-here'
    ]
};
```

**Multiple API Keys (recommended for high usage):**
```javascript
const APP_CONFIG = {
    MAPY_API_KEYS: [
        'your-api-key-1',
        'your-api-key-2',
        'your-api-key-3'
    ]
};
```

The game will automatically rotate through multiple keys to distribute API usage and avoid rate limits. You can use a single key in the array for basic usage.

### 3. Run the Game

Open `index.html` in a web browser, or serve it with a local server:

```bash
# Using Python
python3 -m http.server 8000

# Using Node.js
npx http-server

# Then open http://localhost:8000
```

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

## Technologies

- **Mapy.cz Panorama API** - Street-level imagery
- **Leaflet.js** - Interactive maps
- **Vanilla JavaScript** - No frameworks, pure vibes

## Credits

Heavily vibe-coded, as God intended.

Powered by [Mapy.cz](https://mapy.cz) API.
