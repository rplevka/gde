// API Key Management
let API_KEYS = [];
let currentKeyIndex = 0;

if (typeof APP_CONFIG !== 'undefined') {
    // Support multiple API keys
    if (APP_CONFIG.MAPY_API_KEYS && Array.isArray(APP_CONFIG.MAPY_API_KEYS) && APP_CONFIG.MAPY_API_KEYS.length > 0) {
        API_KEYS = APP_CONFIG.MAPY_API_KEYS;
    } else if (APP_CONFIG.MAPY_API_KEY) {
        API_KEYS = [APP_CONFIG.MAPY_API_KEY];
    }
} else {
    API_KEYS = ['YOUR_API_KEY'];
}

// Function to get current API key and rotate to next
function getApiKey() {
    const key = API_KEYS[currentKeyIndex];
    currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
    return key;
}

// Function to get API key without rotation (for display/check)
function getCurrentApiKey() {
    return API_KEYS[currentKeyIndex];
}

// Game Configuration
const CONFIG = {
    API_KEY: getCurrentApiKey(), // Initial key for validation
    TOTAL_ROUNDS: 5,
    MAX_SCORE_PER_ROUND: 5000,
    PANORAMA_SEARCH_RADIUS: 100, // meters
    MAX_ATTEMPTS_PER_LOCATION: 10
};

// Region boundaries (bounding boxes and polygons)
let REGIONS = {
    czechia: {
        name: 'Czech Republic',
        bounds: {
            minLat: 48.5,
            maxLat: 51.1,
            minLon: 12.0,
            maxLon: 18.9
        }
    },
    prague: {
        name: 'Prague',
        bounds: {
            minLat: 49.94,
            maxLat: 50.18,
            minLon: 14.22,
            maxLon: 14.71
        }
    },
    brno: {
        name: 'Brno',
        bounds: {
            minLat: 49.13,
            maxLat: 49.27,
            minLon: 16.48,
            maxLon: 16.73
        }
    },
    moravia: {
        name: 'Moravia',
        bounds: {
            minLat: 48.5,
            maxLat: 50.3,
            minLon: 16.5,
            maxLon: 18.9
        }
    },
    bohemia: {
        name: 'Bohemia',
        bounds: {
            minLat: 48.5,
            maxLat: 51.1,
            minLon: 12.0,
            maxLon: 16.5
        }
    }
};

// Load region boundaries from GeoJSON file
async function loadRegionBoundaries() {
    console.log('🔄 Starting to load region boundaries...');
    try {
        console.log('📡 Fetching regions-boundaries.json...');
        const response = await fetch('regions-boundaries.json');
        console.log('📡 Response status:', response.status, response.ok);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const boundaries = await response.json();
        console.log('📦 JSON parsed successfully');
        
        console.log('Boundaries file loaded:', Object.keys(boundaries));
        
        // Add polygon paths to each region
        for (const [key, region] of Object.entries(REGIONS)) {
            if (boundaries[key]) {
                console.log(`Processing ${key}:`, boundaries[key].coordinates);
                // Convert GeoJSON coordinates to Leaflet format [lat, lon]
                // GeoJSON format: coordinates[0] = array of [lon, lat] pairs
                const geoCoords = boundaries[key].coordinates[0];
                console.log(`First 3 coords for ${key}:`, geoCoords.slice(0, 3));
                const coords = geoCoords.map(coord => [coord[1], coord[0]]);
                region.paths = [coords];
                console.log(`✓ Loaded ${coords.length} points for ${key}`, coords.slice(0, 2));
            } else {
                console.log(`✗ No boundary data for ${key}`);
            }
        }
        
        console.log('✅ Region boundaries loaded successfully');
        console.log('REGIONS after loading:', REGIONS);
    } catch (error) {
        console.error('❌ Could not load region boundaries:', error);
        console.error('Error details:', error.message, error.stack);
    }
}

// Game State
let gameState = {
    currentRound: 1,
    totalScore: 0,
    rounds: [],
    currentLocation: null,
    guessLocation: null,
    panoramaInstance: null,
    map: null,
    resultMap: null,
    drawMap: null,
    guessMarker: null,
    selectedRegion: 'czechia',
    selectedMode: 'explorer',
    currentMapLayer: 'basic',
    gameStarted: false,
    customRegion: null,
    drawnPath: [],
    panoramaCache: [], // Cache found panorama locations to reduce API calls
    roundSubmitted: false, // Track if current round has been submitted
    preferences: {
        mapLayers: true,
        showRegion: true,
        turnAround: true,
        zoom: true
    }
};

// Initialize the game when page loads
document.addEventListener('DOMContentLoaded', async () => {
    await loadRegionBoundaries();
    setupStartScreen();
    setupDifficultyPreferences();
    setupPanoramaErrorHandlers();
});

function showPanoramaErrorModal() {
    const modal = document.getElementById('panoramaErrorModal');
    modal.style.display = 'flex';
    
    // Update attempt count
    document.getElementById('attemptCount').textContent = gameState.lastSearchAttempts.length;
    
    // Create debug map
    setTimeout(() => {
        const mapContainer = document.getElementById('debugMap');
        mapContainer.innerHTML = ''; // Clear previous map
        
        const debugMap = L.map('debugMap').setView([50, 15], 7);
        
        // Add tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(debugMap);
        
        // Add region polygon if available
        if (gameState.lastSearchRegion.paths) {
            gameState.lastSearchRegion.paths.forEach(path => {
                L.polygon(path, {
                    color: '#667eea',
                    fillColor: '#667eea',
                    fillOpacity: 0.1,
                    weight: 2
                }).addTo(debugMap);
            });
        }
        
        // Add all attempt points
        gameState.lastSearchAttempts.forEach(attempt => {
            const color = attempt.inside ? 'green' : 'red';
            L.circleMarker([attempt.lat, attempt.lon], {
                radius: 3,
                fillColor: color,
                color: color,
                weight: 1,
                opacity: 0.7,
                fillOpacity: 0.5
            }).addTo(debugMap);
        });
        
        // Fit map to region bounds
        const bounds = L.latLngBounds(
            [gameState.lastSearchRegion.bounds.minLat, gameState.lastSearchRegion.bounds.minLon],
            [gameState.lastSearchRegion.bounds.maxLat, gameState.lastSearchRegion.bounds.maxLon]
        );
        debugMap.fitBounds(bounds, { padding: [20, 20] });
    }, 100);
}

function setupPanoramaErrorHandlers() {
    // Retry button - try to start the round again
    document.getElementById('retryPanorama').addEventListener('click', () => {
        document.getElementById('panoramaErrorModal').style.display = 'none';
        startNewRound();
    });
    
    // Cancel button - return to start screen
    document.getElementById('cancelPanorama').addEventListener('click', () => {
        document.getElementById('panoramaErrorModal').style.display = 'none';
        // Reset game state
        gameState.gameStarted = false;
        gameState.currentRound = 1;
        gameState.totalScore = 0;
        gameState.rounds = [];
        
        // Clean up panorama and map
        if (gameState.panoramaInstance) {
            gameState.panoramaInstance.destroy();
            gameState.panoramaInstance = null;
        }
        if (gameState.map) {
            gameState.map.remove();
            gameState.map = null;
        }
        
        // Show start screen, hide game screen
        document.getElementById('startScreen').style.display = 'flex';
        document.getElementById('gameScreen').style.display = 'none';
    });
}

function setupDifficultyPreferences() {
    // Open difficulty modal
    document.getElementById('difficultyPrefsBtn').addEventListener('click', () => {
        document.getElementById('difficultyModal').style.display = 'flex';
    });
    
    // Close difficulty modal
    document.getElementById('closeDifficultyModal').addEventListener('click', () => {
        document.getElementById('difficultyModal').style.display = 'none';
    });
    
    // Handle preference changes
    document.getElementById('pref-mapLayers').addEventListener('change', (e) => {
        gameState.preferences.mapLayers = e.target.checked;
        // Hide/show map layer selector if game is running
        const selector = document.getElementById('mapLayerSelect');
        if (selector && gameState.gameStarted) {
            selector.style.display = e.target.checked ? 'block' : 'none';
        }
    });
    
    document.getElementById('pref-showRegion').addEventListener('change', (e) => {
        gameState.preferences.showRegion = e.target.checked;
        // Will be applied when map is initialized
    });
    
    document.getElementById('pref-turnAround').addEventListener('change', (e) => {
        gameState.preferences.turnAround = e.target.checked;
    });
    
    document.getElementById('pref-zoom').addEventListener('change', (e) => {
        gameState.preferences.zoom = e.target.checked;
    });
}

function setupStartScreen() {
    let selectedRegion = null;
    let selectedMode = null;
    
    // Region selection
    document.querySelectorAll('.region-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.region-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            selectedRegion = btn.dataset.region;
            checkStartButton();
        });
    });
    
    // Draw region button
    document.getElementById('drawRegionBtn').addEventListener('click', () => {
        openDrawRegionModal(selectedRegion, checkStartButton);
    });
    
    // Mode selection
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            selectedMode = btn.dataset.mode;
            checkStartButton();
        });
    });
    
    // Check if start button should be enabled
    function checkStartButton() {
        const startBtn = document.getElementById('startGameBtn');
        const hasRegion = selectedRegion || gameState.customRegion;
        if (hasRegion && selectedMode) {
            startBtn.disabled = false;
        }
    }
    
    // Start game button
    document.getElementById('startGameBtn').addEventListener('click', () => {
        if (gameState.customRegion) {
            gameState.selectedRegion = 'custom';
        } else {
            gameState.selectedRegion = selectedRegion;
        }
        gameState.selectedMode = selectedMode;
        startGame();
    });
}

function startGame() {
    // Check if API key is set
    if (CONFIG.API_KEY === 'YOUR_API_KEY') {
        showError('Please set your Mapy.cz API key in app.js');
        return;
    }
    
    // Hide start screen
    document.getElementById('startScreen').style.display = 'none';
    document.querySelector('header').style.display = 'flex';
    document.getElementById('gameContainer').style.display = 'block';
    
    gameState.gameStarted = true;

    // Initialize map
    initializeMap();

    // Set up event listeners
    setupEventListeners();

    // Start first round
    startNewRound();
}

function setupEventListeners() {
    // Map layer selection
    const mapLayerSelect = document.getElementById('mapLayerSelect');
    mapLayerSelect.addEventListener('change', (e) => {
        gameState.currentMapLayer = e.target.value;
        updateMapLayer();
    });
    
    // Apply map layer preference
    if (!gameState.preferences.mapLayers) {
        mapLayerSelect.style.display = 'none';
    }

    // Submit guess button
    document.getElementById('submitGuess').addEventListener('click', submitGuess);

    // Next round button
    document.getElementById('nextRound').addEventListener('click', () => {
        // Close result modal and restore button
        document.getElementById('resultModal').style.display = 'none';
        document.getElementById('restoreResult').style.display = 'none';
        
        // Start next round
        gameState.currentRound++;
        startNewRound();
    });

    // Minimize result modal
    document.getElementById('minimizeResult').addEventListener('click', () => {
        document.getElementById('resultModal').style.display = 'none';
        document.getElementById('restoreResult').style.display = 'block';
    });

    // Restore result modal
    document.getElementById('restoreResult').addEventListener('click', () => {
        document.getElementById('resultModal').style.display = 'flex';
        document.getElementById('restoreResult').style.display = 'none';
    });

    // Play again button
    document.getElementById('playAgain').addEventListener('click', () => {
        document.getElementById('finalScoreModal').style.display = 'none';
        resetGame();
    });

    // Return to menu button
    document.getElementById('returnToMenu').addEventListener('click', () => {
        returnToStartScreen();
    });

    // Toggle map size button
    document.getElementById('toggleMapSize').addEventListener('click', toggleMapSize);
}

function toggleMapSize() {
    const mapOverlay = document.getElementById('mapOverlay');
    const toggleIcon = document.getElementById('toggleIcon');
    
    if (mapOverlay.classList.contains('collapsed')) {
        mapOverlay.classList.remove('collapsed');
        mapOverlay.classList.add('expanded');
        toggleIcon.textContent = '⊡'; // Collapse icon (minimize)
    } else {
        mapOverlay.classList.remove('expanded');
        mapOverlay.classList.add('collapsed');
        toggleIcon.textContent = '⛶'; // Expand icon (maximize)
    }
    
    // Resize map after transition
    setTimeout(() => {
        if (gameState.map) {
            gameState.map.invalidateSize();
        }
    }, 300);
}

function initializeMap() {
    // Get the region bounds
    const region = gameState.selectedRegion === 'custom' && gameState.customRegion 
        ? gameState.customRegion 
        : REGIONS[gameState.selectedRegion];
    
    // Safety check
    if (!region || !region.bounds) {
        console.error('Region not found:', gameState.selectedRegion);
        return;
    }
    
    // Calculate center of the region
    const centerLat = (region.bounds.minLat + region.bounds.maxLat) / 2;
    const centerLon = (region.bounds.minLon + region.bounds.maxLon) / 2;
    
    // Create map centered on the selected region
    gameState.map = L.map('mapContainer').setView([centerLat, centerLon], 7);

    // Add tile layer
    updateMapLayer();
    
    // Fit map to region bounds after a short delay
    setTimeout(() => {
        const bounds = L.latLngBounds(
            [region.bounds.minLat, region.bounds.minLon],
            [region.bounds.maxLat, region.bounds.maxLon]
        );
        gameState.map.fitBounds(bounds, { padding: [20, 20] });
    }, 100);

    // Add region overlay if preference is enabled
    if (gameState.preferences.showRegion && region.paths) {
        console.log(`Adding region overlay with ${region.paths.length} path(s), ${region.paths[0].length} points`);
        region.paths.forEach(path => {
            L.polygon(path, {
                color: '#667eea',
                fillColor: '#667eea',
                fillOpacity: 0.15,
                weight: 2,
                opacity: 0.4,
                interactive: false // Don't interfere with map clicks
            }).addTo(gameState.map);
        });
    } else {
        console.log('Region overlay not shown:', {
            showRegion: gameState.preferences.showRegion,
            hasPaths: !!region.paths
        });
    }

    // Add logo control
    const LogoControl = L.Control.extend({
        options: { position: 'bottomleft' },
        onAdd: function (map) {
            const container = L.DomUtil.create('div');
            const link = L.DomUtil.create('a', '', container);
            link.setAttribute('href', 'http://mapy.com/');
            link.setAttribute('target', '_blank');
            link.innerHTML = '<img src="https://api.mapy.com/img/api/logo.svg" />';
            L.DomEvent.disableClickPropagation(link);
            return container;
        },
    });
    new LogoControl().addTo(gameState.map);

    // Add click handler for guesses
    gameState.map.on('click', (e) => {
        placeGuess(e.latlng.lat, e.latlng.lng);
    });
}

function updateMapLayer() {
    // Remove existing tile layer
    gameState.map.eachLayer((layer) => {
        if (layer instanceof L.TileLayer) {
            gameState.map.removeLayer(layer);
        }
    });

    // Add new tile layer
    const mapset = gameState.currentMapLayer;
    L.tileLayer(`https://api.mapy.com/v1/maptiles/${mapset}/256/{z}/{x}/{y}?apikey=${getApiKey()}`, {
        minZoom: 0,
        maxZoom: 20,
        attribution: '<a href="https://api.mapy.com/copyright" target="_blank">&copy; Seznam.cz a.s. a další</a>',
    }).addTo(gameState.map);
}

async function startNewRound() {
    // Reset round state
    gameState.roundSubmitted = false;
    
    // Update UI
    updateScoreDisplay();
    const submitBtn = document.getElementById('submitGuess');
    submitBtn.style.display = 'inline-block';
    submitBtn.disabled = true;
    submitBtn.textContent = 'Place your guess on the map';
    document.getElementById('nextRound').style.display = 'none';

    // Reset map view to region bounds
    const region = gameState.selectedRegion === 'custom' && gameState.customRegion 
        ? gameState.customRegion 
        : REGIONS[gameState.selectedRegion];
    
    const bounds = L.latLngBounds(
        [region.bounds.minLat, region.bounds.minLon],
        [region.bounds.maxLat, region.bounds.maxLon]
    );
    gameState.map.fitBounds(bounds, { padding: [20, 20] });

    // Clear previous guess
    if (gameState.guessMarker) {
        gameState.map.removeLayer(gameState.guessMarker);
        gameState.guessMarker = null;
    }
    gameState.guessLocation = null;

    // Destroy previous panorama
    if (gameState.panoramaInstance) {
        gameState.panoramaInstance.destroy();
        gameState.panoramaInstance = null;
    }

    // Find a random location with panorama
    const location = await findRandomLocationWithPanorama();
    
    if (!location) {
        showPanoramaErrorModal();
        return;
    }

    gameState.currentLocation = location;

    // Load panorama - retry if it fails
    const loaded = await loadPanorama(location.lat, location.lon);
    
    if (!loaded) {
        // If panorama failed to load, try finding another location
        console.log('Panorama failed to load, trying another location...');
        await startNewRound();
    }
}

async function findRandomLocationWithPanorama() {
    // Use custom region if available, otherwise use predefined region
    const region = gameState.selectedRegion === 'custom' && gameState.customRegion 
        ? gameState.customRegion 
        : REGIONS[gameState.selectedRegion];
    
    console.log('🔍 Searching for panorama in region:', gameState.selectedRegion);
    console.log('Region has paths:', !!region.paths);
    console.log('Region bounds:', region.bounds);
    
    // Use more attempts for regions with polygon paths since we're filtering by polygon
    const maxAttempts = region.paths ? CONFIG.MAX_ATTEMPTS_PER_LOCATION * 20 : CONFIG.MAX_ATTEMPTS_PER_LOCATION;
    let attempts = 0;
    const debugAttempts = []; // Track all attempts for debugging
    let insideCount = 0;
    let outsideCount = 0;

    while (attempts < maxAttempts) {
        // Generate random coordinates within region bounds
        const lat = region.bounds.minLat + Math.random() * (region.bounds.maxLat - region.bounds.minLat);
        const lon = region.bounds.minLon + Math.random() * (region.bounds.maxLon - region.bounds.minLon);
        
        // If region has polygon paths, check if point is inside the polygon
        let insidePolygon = true;
        if (region.paths) {
            let insideAnyPolygon = false;
            for (const path of region.paths) {
                if (isPointInPolygon(lat, lon, path)) {
                    insideAnyPolygon = true;
                    break;
                }
            }
            if (!insideAnyPolygon) {
                debugAttempts.push({ lat, lon, inside: false, hasPanorama: false });
                outsideCount++;
                attempts++;
                continue; // Skip this point, it's outside all drawn areas
            }
            insidePolygon = true;
            insideCount++;
        }

        // Check if panorama exists at this location
        try {
            const result = await Panorama.panoramaExists({
                lon: lon,
                lat: lat,
                apiKey: getApiKey(),
                radius: CONFIG.PANORAMA_SEARCH_RADIUS
            });

            if (result.exists) {
                return {
                    lat: result.info.lat,
                    lon: result.info.lon,
                    date: result.info.date
                };
            } else {
                debugAttempts.push({ lat, lon, inside: insidePolygon, hasPanorama: false });
            }
        } catch (error) {
            console.error('Error checking panorama:', error);
            debugAttempts.push({ lat, lon, inside: insidePolygon, hasPanorama: false, error: true });
        }

        attempts++;
    }

    // Store debug info for error modal
    gameState.lastSearchAttempts = debugAttempts;
    gameState.lastSearchRegion = region;
    
    console.log(`❌ Failed to find panorama after ${attempts} attempts`);
    console.log(`Points outside polygon: ${outsideCount}`);
    console.log(`Points inside polygon (checked): ${insideCount}`);
    console.log(`Total debug attempts logged: ${debugAttempts.length}`);
    
    return null; // No panorama found after all attempts
}

async function loadPanorama(lat, lon) {
    try {
        const container = document.getElementById('panoramaContainer');
        
        // Enable navigation only in explorer mode
        const showNavigation = gameState.selectedMode === 'explorer';
        
        const panoData = await Panorama.panoramaFromPosition({
            parent: container,
            lon: lon,
            lat: lat,
            apiKey: getApiKey(),
            radius: CONFIG.PANORAMA_SEARCH_RADIUS,
            showNavigation: showNavigation,
            lang: 'en'
        });

        if (panoData.errorCode !== 'NONE') {
            console.error(`Panorama error: ${panoData.error}`);
            return false;
        }

        gameState.panoramaInstance = panoData;
        
        // Apply difficulty preferences to panorama
        const initialCamera = panoData.getCamera();
        
        // Store initial camera for restrictions
        if (!gameState.preferences.turnAround || !gameState.preferences.zoom) {
            const restrictedCamera = {
                yaw: initialCamera.yaw,
                pitch: initialCamera.pitch,
                fov: initialCamera.fov
            };
            
            // Add listener to enforce restrictions
            panoData.addListener('pano-view', () => {
                const currentCamera = panoData.getCamera();
                const newCamera = { ...currentCamera };
                
                // Lock rotation if preference is off
                if (!gameState.preferences.turnAround) {
                    newCamera.yaw = restrictedCamera.yaw;
                    newCamera.pitch = restrictedCamera.pitch;
                }
                
                // Lock zoom if preference is off
                if (!gameState.preferences.zoom) {
                    newCamera.fov = restrictedCamera.fov;
                }
                
                // Apply restrictions if camera changed
                if (newCamera.yaw !== currentCamera.yaw || 
                    newCamera.pitch !== currentCamera.pitch || 
                    newCamera.fov !== currentCamera.fov) {
                    panoData.setCamera(newCamera);
                }
            });
        }

        // Update actual location if panorama position differs
        if (panoData.info) {
            gameState.currentLocation.lat = panoData.info.lat;
            gameState.currentLocation.lon = panoData.info.lon;
        }
        
        return true;

    } catch (error) {
        console.error('Error loading panorama:', error);
        return false;
    }
}

function placeGuess(lat, lon) {
    // Don't allow placing guess after submission
    if (gameState.roundSubmitted) {
        return;
    }
    
    // Remove previous marker
    if (gameState.guessMarker) {
        gameState.map.removeLayer(gameState.guessMarker);
    }

    // Add new marker
    gameState.guessMarker = L.marker([lat, lon], {
        icon: L.divIcon({
            className: 'guess-marker',
            iconSize: [20, 20],
            iconAnchor: [10, 10]
        })
    }).addTo(gameState.map);

    // Store guess location
    gameState.guessLocation = { lat, lon };

    // Enable submit button
    const submitBtn = document.getElementById('submitGuess');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit Guess';
}

function submitGuess() {
    if (!gameState.guessLocation) {
        return;
    }
    
    // Mark round as submitted
    gameState.roundSubmitted = true;
    
    // Disable submit button
    const submitBtn = document.getElementById('submitGuess');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Round Complete';

    // Calculate distance
    const distance = calculateDistance(
        gameState.currentLocation.lat,
        gameState.currentLocation.lon,
        gameState.guessLocation.lat,
        gameState.guessLocation.lon
    );

    // Calculate score
    const score = calculateScore(distance);

    // Store round result
    const roundResult = {
        round: gameState.currentRound,
        distance: distance,
        score: score,
        actualLocation: { ...gameState.currentLocation },
        guessLocation: { ...gameState.guessLocation }
    };
    gameState.rounds.push(roundResult);
    gameState.totalScore += score;

    // Show result
    showRoundResult(roundResult);
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    // Haversine formula
    const R = 6371; // Earth's radius in km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    return distance;
}

function toRad(degrees) {
    return degrees * Math.PI / 180;
}

function calculateScore(distanceKm) {
    // Scoring system: closer = more points
    // Perfect guess (< 0.1 km): 5000 points
    // < 1 km: 4000-5000 points
    // < 5 km: 3000-4000 points
    // < 25 km: 2000-3000 points
    // < 100 km: 1000-2000 points
    // < 500 km: 0-1000 points
    // > 500 km: 0 points

    if (distanceKm < 0.1) return 5000;
    if (distanceKm < 1) return Math.round(4000 + (1 - distanceKm) * 1000);
    if (distanceKm < 5) return Math.round(3000 + (5 - distanceKm) / 4 * 1000);
    if (distanceKm < 25) return Math.round(2000 + (25 - distanceKm) / 20 * 1000);
    if (distanceKm < 100) return Math.round(1000 + (100 - distanceKm) / 75 * 1000);
    if (distanceKm < 500) return Math.round((500 - distanceKm) / 400 * 1000);
    return 0;
}

function showRoundResult(result) {
    // Update result details
    document.getElementById('resultTitle').textContent = `Round ${result.round} Result`;
    document.getElementById('resultDistance').textContent = `${result.distance.toFixed(2)} km`;
    document.getElementById('resultScore').textContent = `${result.score} points`;

    // Create result map
    const resultMapContainer = document.getElementById('resultMap');
    
    // Destroy previous result map if it exists
    if (gameState.resultMap) {
        gameState.resultMap.remove();
        gameState.resultMap = null;
    }
    
    resultMapContainer.innerHTML = ''; // Clear previous map

    gameState.resultMap = L.map(resultMapContainer).setView([
        (result.actualLocation.lat + result.guessLocation.lat) / 2,
        (result.actualLocation.lon + result.guessLocation.lon) / 2
    ], 10);

    L.tileLayer(`https://api.mapy.com/v1/maptiles/basic/256/{z}/{x}/{y}?apikey=${getApiKey()}`, {
        attribution: '<a href="https://api.mapy.com/copyright" target="_blank">&copy; Seznam.cz a.s.</a>',
    }).addTo(gameState.resultMap);

    // Add markers
    L.marker([result.actualLocation.lat, result.actualLocation.lon], {
        icon: L.divIcon({
            className: 'custom-marker',
            iconSize: [20, 20],
            iconAnchor: [10, 10],
            html: '<div style="background: #44ff44; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>'
        })
    }).addTo(gameState.resultMap).bindPopup('Actual Location');

    L.marker([result.guessLocation.lat, result.guessLocation.lon], {
        icon: L.divIcon({
            className: 'custom-marker',
            iconSize: [20, 20],
            iconAnchor: [10, 10],
            html: '<div style="background: #ff4444; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>'
        })
    }).addTo(gameState.resultMap).bindPopup('Your Guess');

    // Draw line between points
    L.polyline([
        [result.actualLocation.lat, result.actualLocation.lon],
        [result.guessLocation.lat, result.guessLocation.lon]
    ], {
        color: '#667eea',
        weight: 3,
        opacity: 0.7
    }).addTo(gameState.resultMap);

    // Show modal first
    document.getElementById('resultModal').style.display = 'flex';
    
    // Show Next Round button if not the last round
    const nextRoundBtn = document.getElementById('nextRound');
    const minimizeBtn = document.getElementById('minimizeResult');
    
    if (gameState.currentRound < CONFIG.TOTAL_ROUNDS) {
        nextRoundBtn.style.display = 'inline-block';
        minimizeBtn.style.display = 'inline-block';
    } else {
        // Last round - hide minimize, clicking Next Round will show final score
        nextRoundBtn.style.display = 'none';
        minimizeBtn.style.display = 'none';
        
        // Auto-show final score after a delay
        setTimeout(() => {
            document.getElementById('resultModal').style.display = 'none';
            showFinalScore();
        }, 5000);
    }
    
    // Wait for modal to be visible, then fix map size and fit bounds
    setTimeout(() => {
        gameState.resultMap.invalidateSize();
        
        // Fit bounds to show both markers
        const bounds = L.latLngBounds([
            [result.actualLocation.lat, result.actualLocation.lon],
            [result.guessLocation.lat, result.guessLocation.lon]
        ]);
        gameState.resultMap.fitBounds(bounds, { padding: [50, 50] });
    }, 100);
}

function showFinalScore() {
    document.getElementById('finalScore').textContent = gameState.totalScore;

    // Create round breakdown
    const breakdownContainer = document.getElementById('roundBreakdown');
    breakdownContainer.innerHTML = '<h3 style="margin-bottom: 15px;">Round Breakdown:</h3>';

    gameState.rounds.forEach(round => {
        const roundDiv = document.createElement('div');
        roundDiv.className = 'round-result';
        roundDiv.innerHTML = `
            <div>
                <strong>Round ${round.round}:</strong> ${round.distance.toFixed(2)} km
            </div>
            <div class="score">${round.score} pts</div>
        `;
        breakdownContainer.appendChild(roundDiv);
    });

    document.getElementById('finalScoreModal').style.display = 'flex';
}

function resetGame() {
    // Reset game state
    gameState.currentRound = 1;
    gameState.totalScore = 0;
    gameState.rounds = [];
    gameState.guessLocation = null;

    // Clear markers
    if (gameState.guessMarker) {
        gameState.map.removeLayer(gameState.guessMarker);
        gameState.guessMarker = null;
    }

    // Destroy panorama
    if (gameState.panoramaInstance) {
        gameState.panoramaInstance.destroy();
        gameState.panoramaInstance = null;
    }

    // Reset UI
    document.getElementById('submitGuess').disabled = true;
    document.getElementById('submitGuess').textContent = 'Place your guess on the map';
    document.getElementById('nextRound').style.display = 'none';

    // Start new game
    startNewRound();
}

function updateScoreDisplay() {
    document.getElementById('currentRound').textContent = gameState.currentRound;
    document.getElementById('totalRounds').textContent = CONFIG.TOTAL_ROUNDS;
    document.getElementById('totalScore').textContent = gameState.totalScore;
}

function returnToStartScreen() {
    // Hide final score modal
    document.getElementById('finalScoreModal').style.display = 'none';
    
    // Hide game elements
    document.querySelector('header').style.display = 'none';
    document.getElementById('gameContainer').style.display = 'none';
    
    // Destroy panorama
    if (gameState.panoramaInstance) {
        gameState.panoramaInstance.destroy();
        gameState.panoramaInstance = null;
    }
    
    // Destroy maps
    if (gameState.map) {
        gameState.map.remove();
        gameState.map = null;
    }
    if (gameState.resultMap) {
        gameState.resultMap.remove();
        gameState.resultMap = null;
    }
    
    // Reset game state
    gameState.currentRound = 1;
    gameState.totalScore = 0;
    gameState.rounds = [];
    gameState.guessLocation = null;
    gameState.guessMarker = null;
    gameState.gameStarted = false;
    
    // Show start screen
    document.getElementById('startScreen').style.display = 'flex';
    
    // Clear selections
    document.querySelectorAll('.region-btn').forEach(b => b.classList.remove('selected'));
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('selected'));
    document.getElementById('startGameBtn').disabled = true;
}

function showError(message) {
    console.error(message);
    alert(message);
}

// Draw Region Functionality
function openDrawRegionModal(currentSelectedRegion, checkStartButtonCallback) {
    const modal = document.getElementById('drawRegionModal');
    modal.style.display = 'flex';
    
    // Initialize draw map
    if (gameState.drawMap) {
        gameState.drawMap.remove();
    }
    
    gameState.drawMap = L.map('drawMapContainer', {
        dragging: true,  // Start with dragging enabled (pan mode)
        scrollWheelZoom: true,  // Keep zoom enabled
        doubleClickZoom: false,
        touchZoom: false
    }).setView([49.8, 15.5], 7);
    
    L.tileLayer(`https://api.mapy.com/v1/maptiles/basic/256/{z}/{x}/{y}?apikey=${getApiKey()}`, {
        attribution: '<a href="https://api.mapy.com/copyright" target="_blank">&copy; Seznam.cz a.s.</a>',
    }).addTo(gameState.drawMap);
    
    // Drawing state
    let isDrawing = false;
    let currentPolyline = null;
    let currentPath = [];
    let allPolylines = []; // Store all drawn shapes
    let allPaths = []; // Store all path coordinates
    let drawMode = false; // Start in pan mode (false = pan, true = draw)
    
    // Mode toggle buttons
    const drawModeBtn = document.getElementById('drawModeBtn');
    const panModeBtn = document.getElementById('panModeBtn');
    const mapContainer = document.getElementById('drawMapContainer');
    
    // Set initial button states (pan mode active)
    panModeBtn.classList.add('active');
    drawModeBtn.classList.remove('active');
    mapContainer.style.cursor = 'grab';
    
    drawModeBtn.onclick = () => {
        drawMode = true;
        drawModeBtn.classList.add('active');
        panModeBtn.classList.remove('active');
        gameState.drawMap.dragging.disable();
        mapContainer.style.cursor = 'crosshair';
    };
    
    panModeBtn.onclick = () => {
        drawMode = false;
        panModeBtn.classList.add('active');
        drawModeBtn.classList.remove('active');
        gameState.drawMap.dragging.enable();
        mapContainer.style.cursor = 'grab';
    };
    
    // Create canvas overlay for raster drawing
    const canvasOverlay = L.DomUtil.create('canvas', 'draw-canvas', mapContainer);
    canvasOverlay.style.position = 'absolute';
    canvasOverlay.style.top = '0';
    canvasOverlay.style.left = '0';
    canvasOverlay.style.pointerEvents = 'none';
    canvasOverlay.style.zIndex = '1000';
    
    function resizeCanvas() {
        const size = gameState.drawMap.getSize();
        canvasOverlay.width = size.x;
        canvasOverlay.height = size.y;
    }
    resizeCanvas();
    gameState.drawMap.on('resize', resizeCanvas);
    
    const ctx = canvasOverlay.getContext('2d');
    let lastPoint = null;
    
    // Mouse events for raster drawing
    gameState.drawMap.on('mousedown', (e) => {
        if (!drawMode) return;
        
        isDrawing = true;
        currentPath = [e.latlng];
        const point = gameState.drawMap.latLngToContainerPoint(e.latlng);
        lastPoint = point;
        
        // Draw initial point
        ctx.fillStyle = 'rgba(102, 126, 234, 0.5)';
        ctx.beginPath();
        ctx.arc(point.x, point.y, 15, 0, Math.PI * 2);
        ctx.fill();
    });
    
    gameState.drawMap.on('mousemove', (e) => {
        if (isDrawing && drawMode) {
            currentPath.push(e.latlng);
            const point = gameState.drawMap.latLngToContainerPoint(e.latlng);
            
            // Draw line from last point to current
            ctx.strokeStyle = 'rgba(102, 126, 234, 0.5)';
            ctx.lineWidth = 5;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();
            ctx.moveTo(lastPoint.x, lastPoint.y);
            ctx.lineTo(point.x, point.y);
            ctx.stroke();
            
            lastPoint = point;
        }
    });
    
    gameState.drawMap.on('mouseup', () => {
        if (isDrawing && currentPath.length > 2) {
            isDrawing = false;
            
            // Convert raster to vector polygon
            const polygon = L.polygon(currentPath, {
                color: '#667eea',
                fillColor: '#667eea',
                fillOpacity: 0.3,
                weight: 2,
                opacity: 0.8
            }).addTo(gameState.drawMap);
            
            // Save this shape
            allPolylines.push(polygon);
            allPaths.push([...currentPath]);
            document.getElementById('confirmDrawing').disabled = false;
            
            // Clear canvas for next drawing
            ctx.clearRect(0, 0, canvasOverlay.width, canvasOverlay.height);
        }
    });
    
    // Clear drawing button
    document.getElementById('clearDrawing').onclick = () => {
        // Remove all drawn polylines
        allPolylines.forEach(polyline => {
            gameState.drawMap.removeLayer(polyline);
        });
        allPolylines = [];
        allPaths = [];
        document.getElementById('confirmDrawing').disabled = true;
    };
    
    // Confirm drawing button
    document.getElementById('confirmDrawing').onclick = () => {
        if (allPaths.length > 0) {
            // Calculate bounding box from all drawn paths
            const allLats = allPaths.flat().map(p => p.lat);
            const allLons = allPaths.flat().map(p => p.lng);
            
            // Convert paths from Leaflet LatLng objects to [lat, lon] arrays
            // to match the format used by pre-defined regions
            const convertedPaths = allPaths.map(path => 
                path.map(point => [point.lat, point.lng])
            );
            
            gameState.customRegion = {
                name: 'Custom Region',
                bounds: {
                    minLat: Math.min(...allLats),
                    maxLat: Math.max(...allLats),
                    minLon: Math.min(...allLons),
                    maxLon: Math.max(...allLons)
                },
                paths: convertedPaths // Store converted paths in [lat, lon] format
            };
            
            // Mark draw region button as selected
            document.querySelectorAll('.region-btn').forEach(b => b.classList.remove('selected'));
            document.getElementById('drawRegionBtn').classList.add('selected');
            
            // Update the callback to enable start button
            if (checkStartButtonCallback) {
                checkStartButtonCallback();
            }
            
            // Close modal
            modal.style.display = 'none';
            gameState.drawMap.remove();
            gameState.drawMap = null;
        }
    };
    
    // Cancel button
    document.getElementById('cancelDrawing').onclick = () => {
        modal.style.display = 'none';
        if (gameState.drawMap) {
            gameState.drawMap.remove();
            gameState.drawMap = null;
        }
    };
    
    // Fix map size after modal is visible
    setTimeout(() => {
        gameState.drawMap.invalidateSize();
    }, 100);
}

// Point in Polygon algorithm (Ray Casting)
function isPointInPolygon(lat, lon, path) {
    let inside = false;
    
    for (let i = 0, j = path.length - 1; i < path.length; j = i++) {
        // Path is array of [lat, lon] pairs
        const xi = path[i][0]; // lat
        const yi = path[i][1]; // lon
        const xj = path[j][0]; // lat
        const yj = path[j][1]; // lon
        
        const intersect = ((yi > lon) !== (yj > lon)) &&
            (lat < (xj - xi) * (lon - yi) / (yj - yi) + xi);
        
        if (intersect) inside = !inside;
    }
    
    return inside;
}
