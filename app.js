// API requests now go through proxy server at /api/mapy/*
// Use dummy key - proxy server will replace with real key
const PROXY_API_KEY = 'proxy';

// Game Configuration
const CONFIG = {
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
    praha: {
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

// Boundary index cache
let boundaryIndex = null;

// Load boundary index from boundaries/index.json
async function loadBoundaryIndex() {
    if (boundaryIndex) return boundaryIndex;
    
    console.log('🔄 Loading boundary index...');
    try {
        const response = await fetch('boundaries/index.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        boundaryIndex = await response.json();
        console.log('✅ Boundary index loaded:', boundaryIndex);
        
        // Initialize REGIONS with metadata from index
        const allBoundaries = [
            ...(boundaryIndex.misc || []),
            ...(boundaryIndex.cities || []),
            ...(boundaryIndex.regions || []),
            ...(boundaryIndex.districts || [])
        ];
        
        for (const region of allBoundaries) {
            if (!REGIONS[region.key]) {
                REGIONS[region.key] = {
                    name: region.name,
                    name_cz: region.name_cz,
                    file: region.file,
                    isCzechRegion: !!region.name_cz,
                    isDistrict: !!(boundaryIndex.districts && boundaryIndex.districts.find(d => d.key === region.key))
                };
            } else {
                // Update existing regions with file reference
                REGIONS[region.key].file = region.file;
                if (boundaryIndex.districts && boundaryIndex.districts.find(d => d.key === region.key)) {
                    REGIONS[region.key].isDistrict = true;
                }
            }
        }
        
        console.log('✅ REGIONS initialized with metadata');
        return boundaryIndex;
    } catch (error) {
        console.error('❌ Could not load boundary index:', error);
        throw error;
    }
}

// Load specific boundary file
async function loadBoundaryFile(regionKey) {
    const region = REGIONS[regionKey];
    
    // Already loaded
    if (region.paths) {
        console.log(`✓ Boundary already loaded for ${regionKey}`);
        return;
    }
    
    if (!region.file) {
        console.warn(`⚠️  No boundary file defined for ${regionKey}`);
        return;
    }
    
    console.log(`🔄 Loading boundary for ${regionKey} from ${region.file}...`);
    try {
        const response = await fetch(`boundaries/${region.file}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const boundaryData = await response.json();
        
        // Process coordinates
        const geoCoords = boundaryData.coordinates[0];
        const coords = geoCoords.map(coord => [coord[1], coord[0]]);
        
        // Calculate bounds if not already set
        if (!region.bounds || !region.bounds.minLat) {
            const lats = coords.map(c => c[0]);
            const lons = coords.map(c => c[1]);
            region.bounds = {
                minLat: Math.min(...lats),
                maxLat: Math.max(...lats),
                minLon: Math.min(...lons),
                maxLon: Math.max(...lons)
            };
        }
        
        region.paths = [coords];
        console.log(`✅ Loaded ${coords.length} points for ${regionKey}`);
    } catch (error) {
        console.error(`❌ Failed to load boundary for ${regionKey}:`, error);
    }
}

// Legacy function for compatibility - now loads index
async function loadRegionBoundaries() {
    console.log('🔄 Starting to load region boundaries...');
    try {
        await loadBoundaryIndex();
        console.log('✅ Region boundaries index loaded successfully');
        console.log('REGIONS after loading:', Object.keys(REGIONS));
    } catch (error) {
        console.error('❌ Could not load region boundaries:', error);
        console.error('Error details:', error.message, error.stack);
    }
}

// Load and display version info
async function loadVersionInfo() {
    try {
        const response = await fetch('version.json');
        if (!response.ok) {
            throw new Error('Version file not found');
        }
        const versionData = await response.json();
        
        // Format version display
        const shortVersion = versionData.version.substring(0, 7);
        let versionText = `v ${shortVersion}`;
        
        if (versionData.date && versionData.date !== 'unknown' && versionData.date !== 'local-development') {
            const date = new Date(versionData.date);
            const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
            versionText += ` (${dateStr})`;
        }
        
        if (versionData.branch && versionData.branch !== 'main') {
            versionText += ` [${versionData.branch}]`;
        }
        
        const versionElement = document.getElementById('versionInfo');
        if (versionElement) {
            versionElement.textContent = versionText;
            versionElement.title = `Version: ${versionData.version}\nBranch: ${versionData.branch}\nBuilt: ${versionData.date}`;
        }
        
        console.log('📋 Version:', versionData);
    } catch (error) {
        console.warn('Could not load version info:', error);
        const versionElement = document.getElementById('versionInfo');
        if (versionElement) {
            versionElement.textContent = 'v-dev';
        }
    }
}

// Populate Czech region buttons
function populateCzechRegionButtons(onRegionSelect) {
    const regionGrid = document.querySelector('.region-grid');
    if (!regionGrid) return;
    
    // Remove existing Czech region button (for language switching)
    const existingBtn = document.getElementById('czechRegionsBtn');
    if (existingBtn) existingBtn.remove();
    
    // Get all Czech regions (those with name_cz property)
    const czechRegions = Object.entries(REGIONS)
        .filter(([key, region]) => region.isCzechRegion)
        .sort((a, b) => a[1].name.localeCompare(b[1].name));
    
    // Find insertion point - before saved custom regions or draw button
    const firstSavedRegion = document.querySelector('.saved-custom-region-btn');
    const drawBtn = document.getElementById('drawRegionBtn');
    const insertBefore = firstSavedRegion || drawBtn;
    
    // Create single button with dropdown
    const btn = document.createElement('button');
    btn.id = 'czechRegionsBtn';
    btn.className = 'region-btn';
    btn.type = 'button';
    btn.innerHTML = `
        <span class="region-icon">🏛️</span>
        <span class="region-name" data-i18n="region.czech_regions">Czech Regions</span>
        <select id="czechRegionSelect" class="region-select" onclick="event.stopPropagation();">
            <option value="" data-i18n="region.select_region">Select a region...</option>
        </select>
    `;
    
    // Insert before saved custom regions or draw button
    if (insertBefore) {
        regionGrid.insertBefore(btn, insertBefore);
    } else {
        regionGrid.appendChild(btn);
    }
    
    // Populate select options
    const select = btn.querySelector('#czechRegionSelect');
    czechRegions.forEach(([key, region]) => {
        const option = document.createElement('option');
        option.value = key;
        option.setAttribute('data-i18n', `region.${key}`);
        option.textContent = region.name;
        select.appendChild(option);
    });
    
    // Handle button click - show/focus select
    btn.addEventListener('click', function(e) {
        if (e.target === select || select.contains(e.target)) return;
        select.focus();
        select.click();
    });
    
    // Handle select change
    select.addEventListener('change', function(e) {
        const selectedKey = this.value;
        if (selectedKey) {
            document.querySelectorAll('.region-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            
            // Update button to show it's selected and store the key as data attribute
            btn.setAttribute('data-region', selectedKey);
            
            // Update button text to show selected region
            const regionName = btn.querySelector('.region-name');
            regionName.textContent = this.options[this.selectedIndex].text;
            
            // Call the callback to update selectedRegion in setupStartScreen scope
            if (onRegionSelect) {
                onRegionSelect(selectedKey);
            }
        }
    });
    
    console.log(`✓ Added Czech regions selector with ${czechRegions.length} regions`);
    
    // Apply current language translations
    if (typeof updatePageLanguage === 'function') {
        updatePageLanguage();
    }
}

// Populate Czech district buttons with dropdown
function populateCzechDistrictButtons(onDistrictSelect) {
    const regionGrid = document.querySelector('.region-grid');
    if (!regionGrid) return;
    
    // Remove existing Czech districts button (for language switching)
    const existingBtn = document.getElementById('czechDistrictsBtn');
    if (existingBtn) existingBtn.remove();
    
    // Get all Czech districts from index
    if (!boundaryIndex || !boundaryIndex.districts) {
        console.warn('District data not loaded yet');
        return;
    }
    
    const czechDistricts = boundaryIndex.districts
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name));
    
    // Find insertion point - after Czech regions button, before saved custom regions or draw button
    const czechRegionsBtn = document.getElementById('czechRegionsBtn');
    const firstSavedRegion = document.querySelector('.saved-custom-region-btn');
    const drawBtn = document.getElementById('drawRegionBtn');
    const insertBefore = firstSavedRegion || drawBtn;
    
    // Create single button with dropdown
    const btn = document.createElement('button');
    btn.id = 'czechDistrictsBtn';
    btn.className = 'region-btn';
    btn.type = 'button';
    btn.innerHTML = `
        <span class="region-icon">🏘️</span>
        <span class="region-name" data-i18n="region.czech_districts">Czech Districts</span>
        <select id="czechDistrictSelect" class="region-select" onclick="event.stopPropagation();">
            <option value="" data-i18n="region.select_district">Select a district...</option>
        </select>
    `;
    
    // Insert before saved custom regions or draw button
    if (insertBefore) {
        regionGrid.insertBefore(btn, insertBefore);
    } else {
        regionGrid.appendChild(btn);
    }
    
    // Populate select options
    const select = btn.querySelector('#czechDistrictSelect');
    czechDistricts.forEach(district => {
        const option = document.createElement('option');
        option.value = district.key;
        option.setAttribute('data-i18n', `district.${district.key}`);
        option.textContent = district.name;
        select.appendChild(option);
    });
    
    // Handle button click - show/focus select
    btn.addEventListener('click', function(e) {
        if (e.target === select || select.contains(e.target)) return;
        select.focus();
        select.click();
    });
    
    // Handle select change
    select.addEventListener('change', function(e) {
        const selectedKey = this.value;
        if (selectedKey) {
            document.querySelectorAll('.region-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            
            // Update button to show it's selected and store the key as data attribute
            btn.setAttribute('data-region', selectedKey);
            
            // Update button text to show selected district
            const districtName = btn.querySelector('.region-name');
            districtName.textContent = this.options[this.selectedIndex].text;
            
            // Call the callback to update selectedRegion in setupStartScreen scope
            if (onDistrictSelect) {
                onDistrictSelect(selectedKey);
            }
        }
    });
    
    console.log(`✓ Added Czech districts selector with ${czechDistricts.length} districts`);
    
    // Apply current language translations
    if (typeof updatePageLanguage === 'function') {
        updatePageLanguage();
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
    isMultiplayer: false, // Multiplayer mode flag
    preferences: {
        mapLayers: true,
        showRegion: true,
        turnAround: true,
        zoom: true,
        targetOriginal: true, // Score based on original location (true) or current position (false)
        timeTrial: false, // Enable time trial mode
        timeLimit: 120, // Time limit per round in seconds
        infiniteMode: false // Infinite mode - play until user decides to end
    },
    originalLocation: null, // Store the original start location for explorer mode
    timer: null, // Timer interval
    timeRemaining: 0, // Seconds remaining in current round
    startingNewRound: false, // Prevent multiple simultaneous startNewRound calls
    eventListenersSetup: false // Prevent duplicate event listener registration
};

// Get current panorama position (uses stored position from pano-place events)
function getCurrentPanoramaPosition() {
    // Use position tracked by pano-place listener if available
    if (gameState.currentPanoramaPosition) {
        return gameState.currentPanoramaPosition;
    }
    // Fallback to original location
    return gameState.originalLocation;
}

// LocalStorage helpers for preferences
function savePreferencesToLocalStorage() {
    try {
        localStorage.setItem('gde_preferences', JSON.stringify(gameState.preferences));
    } catch (error) {
        console.warn('Failed to save preferences to localStorage:', error);
    }
}

function loadPreferencesFromLocalStorage() {
    try {
        const saved = localStorage.getItem('gde_preferences');
        if (saved) {
            const preferences = JSON.parse(saved);
            // Merge saved preferences with defaults (in case new preferences were added)
            gameState.preferences = { ...gameState.preferences, ...preferences };
            return true;
        }
    } catch (error) {
        console.warn('Failed to load preferences from localStorage:', error);
    }
    return false;
}

function saveGameSelectionToLocalStorage(region, mode) {
    try {
        localStorage.setItem('gde_lastRegion', region);
        localStorage.setItem('gde_lastMode', mode);
    } catch (error) {
        console.warn('Failed to save game selection to localStorage:', error);
    }
}

function loadGameSelectionFromLocalStorage() {
    try {
        return {
            region: localStorage.getItem('gde_lastRegion') || 'czechia',
            mode: localStorage.getItem('gde_lastMode') || 'static'
        };
    } catch (error) {
        console.warn('Failed to load game selection from localStorage:', error);
        return { region: 'czechia', mode: 'static' };
    }
}

// Custom regions management (max 5 saved regions)
const MAX_SAVED_REGIONS = 5;

function getSavedCustomRegions() {
    try {
        const saved = localStorage.getItem('gde_customRegions');
        return saved ? JSON.parse(saved) : [];
    } catch (error) {
        console.warn('Failed to load custom regions from localStorage:', error);
        return [];
    }
}

function saveCustomRegion(name, region) {
    try {
        const regions = getSavedCustomRegions();
        
        // Check if name already exists
        const existingIndex = regions.findIndex(r => r.name === name);
        if (existingIndex !== -1) {
            regions[existingIndex] = { name, region };
        } else {
            // Check limit
            if (regions.length >= MAX_SAVED_REGIONS) {
                alert(t('alert.regionlimit', { max: MAX_SAVED_REGIONS }));
                return false;
            }
            regions.push({ name, region });
        }
        
        localStorage.setItem('gde_customRegions', JSON.stringify(regions));
        return true;
    } catch (error) {
        console.warn('Failed to save custom region to localStorage:', error);
        return false;
    }
}

function deleteCustomRegion(name) {
    try {
        const regions = getSavedCustomRegions();
        const filtered = regions.filter(r => r.name !== name);
        localStorage.setItem('gde_customRegions', JSON.stringify(filtered));
        return true;
    } catch (error) {
        console.warn('Failed to delete custom region from localStorage:', error);
        return false;
    }
}

// Initialize the game when page loads
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM Content Loaded - Initializing game...');

    // Check if i18n is loaded
    if (typeof initI18n === 'undefined') {
        console.error('ERROR: i18n.js not loaded! Make sure i18n.js is included before app.js');
        return;
    }

    // Ensure mode selection screen is hidden and start screen is visible
    const modeSelectionScreen = document.getElementById('modeSelectionScreen');
    const startScreen = document.getElementById('startScreen');
    if (modeSelectionScreen) {
        modeSelectionScreen.style.display = 'none';
    }
    if (startScreen) {
        startScreen.style.display = 'flex';
    }

    // Initialize i18n first
    initI18n();
    
    // Load version info
    loadVersionInfo();

    // Setup language selector
    const languageSelect = document.getElementById('languageSelect');
    if (languageSelect) {
        languageSelect.addEventListener('change', (e) => {
            setLanguage(e.target.value);
        });
    }
    const languageSelect2 = document.getElementById('languageSelect2');
    if (languageSelect2) {
        languageSelect2.addEventListener('change', (e) => {
            setLanguage(e.target.value);
        });
    }

    // Load saved preferences first
    loadPreferencesFromLocalStorage();

    await loadRegionBoundaries();
    setupStartScreen();
    setupDifficultyPreferences();
    setupPanoramaErrorHandlers();

    console.log('Game initialization complete');
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
    document.getElementById('retryPanorama').addEventListener('click', async () => {
        document.getElementById('panoramaErrorModal').style.display = 'none';
        await startNewRound();
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
        
        // Remove full-screen classes
        document.body.classList.remove('game-active');
        document.getElementById('app').classList.remove('game-active');
    });
}

function setupDifficultyPreferences() {
    // Apply loaded preferences to UI
    document.getElementById('pref-mapLayers').checked = gameState.preferences.mapLayers;
    document.getElementById('pref-showRegion').checked = gameState.preferences.showRegion;
    document.getElementById('pref-turnAround').checked = gameState.preferences.turnAround;
    document.getElementById('pref-zoom').checked = gameState.preferences.zoom;
    document.getElementById('pref-targetOriginal').checked = gameState.preferences.targetOriginal;
    document.getElementById('pref-timeTrial').checked = gameState.preferences.timeTrial;
    document.getElementById('pref-timeLimit').value = gameState.preferences.timeLimit;
    document.getElementById('pref-infiniteMode').checked = gameState.preferences.infiniteMode;
    
    // Show/hide time trial settings based on loaded preference
    document.getElementById('timeTrialSettings').style.display = gameState.preferences.timeTrial ? 'flex' : 'none';
    
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
        savePreferencesToLocalStorage();
        // Hide/show map layer selector if game is running
        const selector = document.getElementById('mapLayerSelect');
        if (selector && gameState.gameStarted) {
            selector.style.display = e.target.checked ? 'block' : 'none';
        }
    });
    
    document.getElementById('pref-showRegion').addEventListener('change', (e) => {
        gameState.preferences.showRegion = e.target.checked;
        savePreferencesToLocalStorage();
        // Will be applied when map is initialized
    });
    
    document.getElementById('pref-turnAround').addEventListener('change', (e) => {
        gameState.preferences.turnAround = e.target.checked;
        savePreferencesToLocalStorage();
    });
    
    document.getElementById('pref-zoom').addEventListener('change', (e) => {
        gameState.preferences.zoom = e.target.checked;
        savePreferencesToLocalStorage();
    });
    
    document.getElementById('pref-targetOriginal').addEventListener('change', (e) => {
        gameState.preferences.targetOriginal = e.target.checked;
        savePreferencesToLocalStorage();
    });
    
    document.getElementById('pref-timeTrial').addEventListener('change', (e) => {
        gameState.preferences.timeTrial = e.target.checked;
        savePreferencesToLocalStorage();
        // Show/hide time limit input
        document.getElementById('timeTrialSettings').style.display = e.target.checked ? 'flex' : 'none';
    });
    
    document.getElementById('pref-timeLimit').addEventListener('change', (e) => {
        gameState.preferences.timeLimit = parseInt(e.target.value);
        savePreferencesToLocalStorage();
    });
    
    document.getElementById('pref-infiniteMode').addEventListener('change', (e) => {
        gameState.preferences.infiniteMode = e.target.checked;
        savePreferencesToLocalStorage();
    });
}

function setupStartScreen() {
    console.log('Setting up start screen...');

    // Load saved selections
    const savedSelection = loadGameSelectionFromLocalStorage();
    let selectedRegion = savedSelection.region;
    let selectedMode = savedSelection.mode;
    
    console.log('Loaded saved selection:', savedSelection);

    // Display saved custom regions first
    displaySavedCustomRegions();
    
    // Populate Czech regions button AFTER saved custom regions so it appears before them
    populateCzechRegionButtons((region) => {
        selectedRegion = region;
        saveGameSelectionToLocalStorage(selectedRegion, selectedMode);
        checkStartButton();
    });
    
    // Populate Czech districts button
    populateCzechDistrictButtons((district) => {
        selectedRegion = district;
        saveGameSelectionToLocalStorage(selectedRegion, selectedMode);
        checkStartButton();
    });
    
    // Preselect saved region (or default to Czech Republic)
    let regionBtn = null;
    
    // Check if it's a saved custom region (format: 'custom_RegionName')
    if (selectedRegion.startsWith('custom_')) {
        const customRegionName = selectedRegion.substring(7); // Remove 'custom_' prefix
        regionBtn = document.querySelector(`.saved-custom-region-btn[data-custom-region="${customRegionName}"]`);
        
        if (regionBtn) {
            regionBtn.classList.add('selected');
            // Load the custom region data
            const savedRegions = getSavedCustomRegions();
            const savedRegion = savedRegions.find(r => r.name === customRegionName);
            if (savedRegion) {
                gameState.customRegion = savedRegion.region;
                gameState.selectedRegion = 'custom';
            }
        }
    } else if (REGIONS[selectedRegion]?.isDistrict) {
        // Czech district - need to select it in the dropdown
        const czechDistrictsBtn = document.getElementById('czechDistrictsBtn');
        const czechDistrictSelect = document.getElementById('czechDistrictSelect');
        
        if (czechDistrictsBtn && czechDistrictSelect) {
            // Select the district in the dropdown
            czechDistrictSelect.value = selectedRegion;
            
            // Mark button as selected
            czechDistrictsBtn.classList.add('selected');
            czechDistrictsBtn.setAttribute('data-region', selectedRegion);
            
            // Update button text to show selected district
            const districtName = czechDistrictsBtn.querySelector('.region-name');
            const selectedOption = czechDistrictSelect.options[czechDistrictSelect.selectedIndex];
            if (selectedOption) {
                districtName.textContent = selectedOption.text;
            }
            
            regionBtn = czechDistrictsBtn; // Mark as found
        }
    } else if (REGIONS[selectedRegion]?.isCzechRegion) {
        // Czech region - need to select it in the dropdown
        const czechRegionsBtn = document.getElementById('czechRegionsBtn');
        const czechRegionSelect = document.getElementById('czechRegionSelect');
        
        if (czechRegionsBtn && czechRegionSelect) {
            // Select the region in the dropdown
            czechRegionSelect.value = selectedRegion;
            
            // Mark button as selected
            czechRegionsBtn.classList.add('selected');
            czechRegionsBtn.setAttribute('data-region', selectedRegion);
            
            // Update button text to show selected region
            const regionName = czechRegionsBtn.querySelector('.region-name');
            const selectedOption = czechRegionSelect.options[czechRegionSelect.selectedIndex];
            if (selectedOption) {
                regionName.textContent = selectedOption.text;
            }
            
            regionBtn = czechRegionsBtn; // Mark as found
        }
    } else {
        // Standard region
        regionBtn = document.querySelector(`.region-btn[data-region="${selectedRegion}"]`);
        if (regionBtn) {
            regionBtn.classList.add('selected');
        }
    }
    
    // Fallback to czechia if saved region not found
    if (!regionBtn) {
        const czechiaBtn = document.querySelector('.region-btn[data-region="czechia"]');
        if (czechiaBtn) czechiaBtn.classList.add('selected');
        selectedRegion = 'czechia';
    }
    
    // Preselect saved mode (or default to Static)
    const modeBtn = document.querySelector(`.mode-btn[data-mode="${selectedMode}"]`);
    if (modeBtn) {
        modeBtn.classList.add('selected');
    } else {
        // Fallback to static if saved mode not found
        const staticBtn = document.querySelector('.mode-btn[data-mode="static"]');
        if (staticBtn) staticBtn.classList.add('selected');
        selectedMode = 'static';
    }
    
    // Enable start button since we have preselections
    const startGameBtn = document.getElementById('startGameBtn');
    if (startGameBtn) {
        startGameBtn.disabled = false;
    }
    
    // Region selection
    const regionButtons = document.querySelectorAll('.region-btn');
    console.log(`Found ${regionButtons.length} region buttons`);

    document.querySelectorAll('.region-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            console.log('Region button clicked:', btn.dataset.region);

            // Ignore if this is the draw region button (it has its own handler)
            if (btn.id === 'drawRegionBtn') {
                console.log('Ignoring draw region button click (has own handler)');
                return;
            }

            document.querySelectorAll('.region-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            selectedRegion = btn.dataset.region;
            saveGameSelectionToLocalStorage(selectedRegion, selectedMode);
            checkStartButton();
        });
    });
    
    // Draw region button
    const drawRegionBtn = document.getElementById('drawRegionBtn');
    if (drawRegionBtn) {
        drawRegionBtn.addEventListener('click', () => {
            openDrawRegionModal(selectedRegion, checkStartButton);
        });
    }
    
    // Mode selection
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            selectedMode = btn.dataset.mode;
            saveGameSelectionToLocalStorage(selectedRegion, selectedMode);
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
    document.getElementById('startGameBtn').addEventListener('click', async () => {
        const startBtn = document.getElementById('startGameBtn');
        
        // Prevent double-click
        if (startBtn.disabled) return;
        startBtn.disabled = true;
        
        // Check if multiplayer mode
        if (typeof multiplayerState !== 'undefined' && multiplayerState.isMultiplayer) {
            // In multiplayer, only owner can start
            if (multiplayerState.isOwner) {
                sendWS('startGame', {});
            }
        } else {
            // Single player mode
            if (gameState.customRegion) {
                gameState.selectedRegion = 'custom';
            } else {
                gameState.selectedRegion = selectedRegion;
            }
            gameState.selectedMode = selectedMode;
            await startGame();
        }
    });
}

async function startGame() {
    // Load boundary for selected region if needed
    if (gameState.selectedRegion && REGIONS[gameState.selectedRegion]) {
        console.log(`🔄 Loading boundary for selected region: ${gameState.selectedRegion}`);
        await loadBoundaryFile(gameState.selectedRegion);
    }
    
    // Hide start screen
    document.getElementById('startScreen').style.display = 'none';
    document.querySelector('header').style.display = 'flex';
    document.getElementById('gameContainer').style.display = 'block';
    
    // Add full-screen classes
    document.body.classList.add('game-active');
    document.getElementById('app').classList.add('game-active');
    
    gameState.gameStarted = true;

    // Initialize map
    initializeMap();

    // Set up event listeners
    setupEventListeners();

    // Start first round
    await startNewRound();
}

function setupEventListeners() {
    const mapLayerSelect = document.getElementById('mapLayerSelect');
    
    // Apply map layer preference (needs to be done each game start)
    if (!gameState.preferences.mapLayers) {
        mapLayerSelect.style.display = 'none';
    } else {
        mapLayerSelect.style.display = '';
    }
    
    // Prevent duplicate event listener registration
    if (gameState.eventListenersSetup) {
        console.log('Event listeners already setup, skipping');
        return;
    }
    gameState.eventListenersSetup = true;
    
    // Map layer selection
    mapLayerSelect.addEventListener('change', (e) => {
        gameState.currentMapLayer = e.target.value;
        updateMapLayer();
    });

    // Submit guess button
    document.getElementById('submitGuess').addEventListener('click', submitGuess);

    // Next round button
    document.getElementById('nextRound').addEventListener('click', async () => {
        // Prevent double-clicking
        const nextRoundBtn = document.getElementById('nextRound');
        if (nextRoundBtn.disabled) return;
        nextRoundBtn.disabled = true;

        // Close result modal and restore button
        document.getElementById('resultModal').style.display = 'none';
        document.getElementById('restoreResult').style.display = 'none';
        
        // Check if game is complete (not in infinite mode)
        if (!gameState.preferences.infiniteMode && gameState.currentRound >= CONFIG.TOTAL_ROUNDS) {
            // Game is complete - show final score
            showFinalScore();
        } else if (gameState.isMultiplayer && typeof sendWS !== 'undefined') {
            // In multiplayer, notify server to start next round for everyone
            sendWS('nextRound', {});
        } else {
            // Single player - start next round directly
            gameState.currentRound++;
            await startNewRound();
        }
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
    
    // Game title click - return to start screen
    document.querySelector('.game-title').addEventListener('click', () => {
        if (gameState.gameStarted) {
            if (confirm(t('confirm.returntomenu'))) {
                returnToStartScreen();
            }
        }
    });
    
    // Reset location button (explorer mode)
    document.getElementById('resetLocationBtn').addEventListener('click', async () => {
        if (gameState.originalLocation) {
            // Destroy existing panorama
            if (gameState.panoramaInstance) {
                gameState.panoramaInstance.destroy();
                gameState.panoramaInstance = null;
            }
            
            // Reload at original location
            await loadPanorama(gameState.originalLocation.lat, gameState.originalLocation.lon);
            
            // Reset current location to original
            gameState.currentLocation = { ...gameState.originalLocation };
        }
    });

    // Toggle map size button
    document.getElementById('toggleMapSize').addEventListener('click', toggleMapSize);
    
    // Finish game button (for infinite mode)
    document.getElementById('finishGame').addEventListener('click', () => {
        if (confirm(t('confirm.endgame'))) {
            showFinalScore();
        }
    });
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
    L.tileLayer(`/api/mapy/v1/maptiles/${mapset}/256/{z}/{x}/{y}`, {
        minZoom: 0,
        maxZoom: 20,
        attribution: '<a href="https://api.mapy.com/copyright" target="_blank">&copy; Seznam.cz a.s. a další</a>',
    }).addTo(gameState.map);
}

// Timer functions
function startTimer() {
    if (!gameState.preferences.timeTrial) return;
    
    // Clear any existing timer
    if (gameState.timer) {
        clearInterval(gameState.timer);
    }
    
    // Initialize time remaining
    gameState.timeRemaining = gameState.preferences.timeLimit;
    
    // Show timer display
    const timerDisplay = document.getElementById('timerDisplay');
    timerDisplay.style.display = 'flex';
    
    // Update timer display
    updateTimerDisplay();
    
    // Start countdown
    gameState.timer = setInterval(() => {
        gameState.timeRemaining--;
        updateTimerDisplay();
        
        // Check if time is up
        if (gameState.timeRemaining <= 0) {
            clearInterval(gameState.timer);
            handleTimeOut();
        }
    }, 1000);
}

function stopTimer() {
    if (gameState.timer) {
        clearInterval(gameState.timer);
        gameState.timer = null;
    }
    
    // Remove warning class from header when timer stops
    const header = document.querySelector('header');
    if (header) {
        header.classList.remove('time-warning');
    }
}

function updateTimerDisplay() {
    const minutes = Math.floor(gameState.timeRemaining / 60);
    const seconds = gameState.timeRemaining % 60;
    const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    const timerValue = document.getElementById('timerValue');
    timerValue.textContent = timeString;
    
    const header = document.querySelector('header');
    
    // Add warning class for last 10 seconds
    if (gameState.timeRemaining <= 10) {
        timerValue.classList.add('warning');
        header.classList.add('time-warning');
    } else {
        timerValue.classList.remove('warning');
        header.classList.remove('time-warning');
    }
}

function handleTimeOut() {
    // Don't process if round already submitted
    if (gameState.roundSubmitted) return;
    
    // Mark round as submitted
    gameState.roundSubmitted = true;
    
    // Record round with 0 score (no guess made)
    gameState.rounds.push({
        round: gameState.currentRound,
        score: 0,
        distance: null,
        actualLocation: gameState.preferences.targetOriginal ? gameState.originalLocation : getCurrentPanoramaPosition(),
        guessLocation: null, // No guess was made
        timeOut: true
    });
    
    // Update total score (no change)
    updateScoreDisplay();
    
    // Show result
    showTimeOutResult();
}

function showTimeOutResult() {
    // Remove warning class from header only (keep timer text blinking)
    const header = document.querySelector('header');
    if (header) {
        header.classList.remove('time-warning');
    }
    
    // Update result details
    document.getElementById('resultTitle').textContent = t('result.timeout');
    document.getElementById('resultDistance').textContent = t('result.noguess');
    document.getElementById('resultScore').textContent = t('result.points', { score: 0 });
    
    // Get actual location
    const actualLocation = gameState.preferences.targetOriginal ? gameState.originalLocation : getCurrentPanoramaPosition();
    
    // Create result map
    const resultMapContainer = document.getElementById('resultMap');
    
    // Destroy previous result map if it exists
    if (gameState.resultMap) {
        gameState.resultMap.remove();
        gameState.resultMap = null;
    }
    
    resultMapContainer.innerHTML = ''; // Clear previous map
    
    // Center on actual location only (no guess)
    gameState.resultMap = L.map(resultMapContainer).setView([
        actualLocation.lat,
        actualLocation.lon
    ], 12);
    
    L.tileLayer(`/api/mapy/v1/maptiles/basic/256/{z}/{x}/{y}`, {
        attribution: '<a href="https://api.mapy.com/copyright" target="_blank">&copy; Seznam.cz a.s.</a>',
    }).addTo(gameState.resultMap);
    
    // Add actual location marker (green)
    L.marker([actualLocation.lat, actualLocation.lon], {
        icon: L.divIcon({
            className: 'custom-marker',
            iconSize: [20, 20],
            iconAnchor: [10, 10],
            html: '<div style="background: #44ff44; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>'
        })
    }).addTo(gameState.resultMap).bindPopup('Actual Location');
    
    // Show modal first
    const modal = document.getElementById('resultModal');
    modal.style.display = 'flex';
    
    // Hide submit button
    document.getElementById('submitGuess').style.display = 'none';
    
    const nextBtn = document.getElementById('nextRound');
    const minimizeBtn = document.getElementById('minimizeResult');
    
    if (gameState.currentRound >= CONFIG.TOTAL_ROUNDS) {
        // Last round - hide buttons and auto-show final score
        nextBtn.style.display = 'none';
        minimizeBtn.style.display = 'none';
        
        // Auto-show final score after a delay
        setTimeout(() => {
            modal.style.display = 'none';
            showFinalScore();
        }, 5000);
    } else {
        // Not last round - show next round button
        nextBtn.textContent = t('btn.next');
        nextBtn.style.display = 'inline-block';
        minimizeBtn.style.display = 'inline-block';
    }
    
    // Wait for modal to be visible, then fix map size
    setTimeout(() => {
        gameState.resultMap.invalidateSize();
        gameState.resultMap.setView([actualLocation.lat, actualLocation.lon], 12);
    }, 100);
}

async function startNewRound() {
    // Prevent multiple simultaneous executions
    if (gameState.startingNewRound) {
        console.warn('⚠️ startNewRound already in progress, skipping');
        return;
    }
    gameState.startingNewRound = true;
    
    try {
        // Reset round state
        gameState.roundSubmitted = false;
    
        // Clear shared location for new round in multiplayer
        if (gameState.isMultiplayer && typeof multiplayerState !== 'undefined') {
            multiplayerState.sharedLocation = null;
            multiplayerState.waitingForLocation = false;
        }
    
        // Stop any existing timer
        stopTimer();
    
        // Update UI
        updateScoreDisplay();
        const submitBtn = document.getElementById('submitGuess');
        submitBtn.style.display = 'inline-block';
        submitBtn.disabled = true;
        submitBtn.textContent = t('btn.submit');
        const nextRoundBtn = document.getElementById('nextRound');
        nextRoundBtn.style.display = 'none';
        nextRoundBtn.disabled = false; // Re-enable for next time
    
        // Show/hide finish game button based on infinite mode
        const finishGameBtn = document.getElementById('finishGame');
        if (finishGameBtn) {
            finishGameBtn.style.display = gameState.preferences.infiniteMode ? 'inline-block' : 'none';
        }

        // Reset map view to region bounds
        const region = gameState.selectedRegion === 'custom' && gameState.customRegion 
            ? gameState.customRegion 
            : REGIONS[gameState.selectedRegion];
    
        if (!region) {
            console.error('❌ Region not found:', gameState.selectedRegion);
            console.error('Available regions:', Object.keys(REGIONS));
            alert(t('alert.regionnotfound'));
            return;
        }
    
        if (!region.bounds) {
            console.error('❌ Region bounds not found for:', gameState.selectedRegion, region);
            alert(t('alert.boundsnotfound'));
            return;
        }
    
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
        let location;
    
        // In multiplayer, wait for server to provide location
        if (gameState.isMultiplayer && typeof getSharedLocation !== 'undefined') {
            console.log('Multiplayer mode: requesting location from server...');
        
            // Request location from server (will wait for response)
            location = await getSharedLocation();
        
            if (!location) {
                console.error('Failed to get location from server');
                showPanoramaErrorModal();
                return;
            }
        
            console.log('Received location from server:', location);
        } else {
            // Single player - just find a location
            location = await findRandomLocationWithPanorama();
            if (!location) {
                showPanoramaErrorModal();
                return;
            }
        }

        gameState.currentLocation = location;
        gameState.originalLocation = { lat: location.lat, lon: location.lon }; // Store original location
        gameState.currentPanoramaPosition = { lat: location.lat, lon: location.lon }; // Initialize current position
    
        // Show/hide reset button based on mode
        const resetBtn = document.getElementById('resetLocationBtn');
        if (gameState.selectedMode === 'explorer') {
            resetBtn.style.display = 'block';
        } else {
            resetBtn.style.display = 'none';
        }

        // Load panorama - retry if it fails
        const loaded = await loadPanorama(location.lat, location.lon);
    
        if (!loaded) {
            // If panorama failed to load, try finding another location
            console.log('Panorama failed to load, trying another location...');
        
            // In multiplayer, notify server that location failed so everyone retries together
            if (gameState.isMultiplayer && typeof sendWS !== 'undefined') {
                sendWS('locationFailed', {
                    lat: location.lat,
                    lon: location.lon
                });
                // Server will broadcast retry to all players
            } else {
                // Single player - retry directly
                gameState.startingNewRound = false; // Allow retry
                await startNewRound();
            }
        } else {
            // Start timer after panorama loads successfully
            startTimer();
        }
    } finally {
        // Always reset the flag when done (success, error, or early return)
        gameState.startingNewRound = false;
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
                apiKey: PROXY_API_KEY,
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
            apiKey: PROXY_API_KEY,
            radius: CONFIG.PANORAMA_SEARCH_RADIUS,
            showNavigation: showNavigation,
            lang: getCurrentLanguage()
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

        // Listen for position changes in explorer mode (when user navigates to a new panorama)
        if (showNavigation) {
            panoData.addListener('pano-place', (data) => {
                // Store current position for scoring - coordinates are in data.info
                if (data && data.info && data.info.lat !== undefined && data.info.lon !== undefined) {
                    gameState.currentPanoramaPosition = { lat: data.info.lat, lon: data.info.lon };
                }
            });
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
    submitBtn.textContent = t('btn.submit');
}

function submitGuess() {
    if (!gameState.guessLocation) {
        return;
    }
    
    // Prevent double submission
    if (gameState.roundSubmitted) {
        console.log('Round already submitted, ignoring');
        return;
    }
    
    // Stop timer
    stopTimer();
    
    // Mark round as submitted
    gameState.roundSubmitted = true;
    
    // Disable submit button
    const submitBtn = document.getElementById('submitGuess');
    submitBtn.disabled = true;
    submitBtn.textContent = t('result.title');

    // Determine target location based on preference
    // If targetOriginal is true (or explorer mode not active), use original location
    // Otherwise use current panorama position
    const targetLocation = (gameState.preferences.targetOriginal || gameState.selectedMode !== 'explorer')
        ? gameState.originalLocation
        : getCurrentPanoramaPosition();
    
    // Calculate distance
    const distance = calculateDistance(
        targetLocation.lat,
        targetLocation.lon,
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
        actualLocation: { ...targetLocation },
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
    document.getElementById('resultTitle').textContent = t('result.round', { round: result.round });
    document.getElementById('resultDistance').textContent = result.distance ? `${result.distance.toFixed(2)} ${t('units.km')}` : 'N/A';
    document.getElementById('resultScore').textContent = t('result.points', { score: result.score });

    // Create result map
    const resultMapContainer = document.getElementById('resultMap');
    
    // Destroy previous result map if it exists
    if (gameState.resultMap) {
        gameState.resultMap.remove();
        gameState.resultMap = null;
    }
    
    resultMapContainer.innerHTML = ''; // Clear previous map

    // Handle timeout case (no guess location)
    if (!result.guessLocation) {
        // Center on actual location only
        gameState.resultMap = L.map(resultMapContainer).setView([
            result.actualLocation.lat,
            result.actualLocation.lon
        ], 12);
    } else {
        // Center between actual and guess locations
        gameState.resultMap = L.map(resultMapContainer).setView([
            (result.actualLocation.lat + result.guessLocation.lat) / 2,
            (result.actualLocation.lon + result.guessLocation.lon) / 2
        ], 10);
    }

    L.tileLayer(`/api/mapy/v1/maptiles/basic/256/{z}/{x}/{y}`, {
        attribution: '<a href="https://api.mapy.com/copyright" target="_blank">&copy; Seznam.cz a.s.</a>',
    }).addTo(gameState.resultMap);

    // Add actual location marker (green)
    L.marker([result.actualLocation.lat, result.actualLocation.lon], {
        icon: L.divIcon({
            className: 'custom-marker',
            iconSize: [20, 20],
            iconAnchor: [10, 10],
            html: '<div style="background: #44ff44; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>'
        })
    }).addTo(gameState.resultMap).bindPopup('Actual Location');

    // Only add guess marker and line if guess was made
    if (result.guessLocation) {
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
    }

    // Show modal first
    document.getElementById('resultModal').style.display = 'flex';
    
    // Show Next Round button if not the last round (but not in multiplayer)
    const nextRoundBtn = document.getElementById('nextRound');
    const minimizeBtn = document.getElementById('minimizeResult');
    
    // In infinite mode, always show next round button and minimize
    if (gameState.preferences.infiniteMode) {
        if (gameState.isMultiplayer) {
            nextRoundBtn.style.display = 'none';
        } else {
            nextRoundBtn.style.display = 'inline-block';
            nextRoundBtn.textContent = t('btn.next');
        }
        minimizeBtn.style.display = 'inline-block';
    } else if (gameState.currentRound < CONFIG.TOTAL_ROUNDS) {
        // In multiplayer, never show Next Round button (server controls rounds)
        if (gameState.isMultiplayer) {
            nextRoundBtn.style.display = 'none';
        } else {
            nextRoundBtn.style.display = 'inline-block';
            nextRoundBtn.textContent = t('btn.next');
        }
        minimizeBtn.style.display = 'inline-block';
    } else {
        // Last round - show button to view final score
        if (gameState.isMultiplayer) {
            nextRoundBtn.style.display = 'none';
        } else {
            nextRoundBtn.style.display = 'inline-block';
            nextRoundBtn.textContent = t('result.viewfinal');
        }
        minimizeBtn.style.display = 'none';
    }
    
    // Wait for modal to be visible, then fix map size and fit bounds
    setTimeout(() => {
        gameState.resultMap.invalidateSize();
        
        // Fit bounds to show markers
        if (result.guessLocation) {
            // Show both markers
            const bounds = L.latLngBounds([
                [result.actualLocation.lat, result.actualLocation.lon],
                [result.guessLocation.lat, result.guessLocation.lon]
            ]);
            gameState.resultMap.fitBounds(bounds, { padding: [50, 50] });
        } else {
            // Only actual location, already centered
            gameState.resultMap.setView([result.actualLocation.lat, result.actualLocation.lon], 12);
        }
    }, 100);
}

function showFinalScore() {
    document.getElementById('finalScore').textContent = gameState.totalScore;

    // Create round breakdown
    const breakdownContainer = document.getElementById('roundBreakdown');
    breakdownContainer.innerHTML = `<h3 style="margin-bottom: 15px;">${t('final.breakdown')}</h3>`;

    gameState.rounds.forEach(round => {
        const roundDiv = document.createElement('div');
        roundDiv.className = 'round-result';
        const distanceText = round.distance !== null ? `${round.distance.toFixed(2)} ${t('units.km')}` : t('final.timeout');
        roundDiv.innerHTML = `
            <div>
                <strong>${t('final.round', { round: round.round })}</strong> ${distanceText}
            </div>
            <div class="score">${round.score} ${t('units.points')}</div>
        `;
        breakdownContainer.appendChild(roundDiv);
    });

    document.getElementById('finalScoreModal').style.display = 'flex';
}

async function resetGame() {
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
    document.getElementById('submitGuess').textContent = t('btn.submit.placeholder');
    document.getElementById('nextRound').style.display = 'none';

    // Start new game
    await startNewRound();
}

function updateScoreDisplay() {
    document.getElementById('currentRound').textContent = gameState.currentRound;
    const totalRoundsElement = document.getElementById('totalRounds');
    const roundSeparator = totalRoundsElement.previousSibling; // The "/" text node
    
    if (gameState.preferences.infiniteMode) {
        // Hide the slash and total rounds in infinite mode
        totalRoundsElement.style.display = 'none';
        if (roundSeparator && roundSeparator.nodeType === Node.TEXT_NODE) {
            roundSeparator.textContent = '';
        }
    } else {
        totalRoundsElement.style.display = 'inline';
        if (roundSeparator && roundSeparator.nodeType === Node.TEXT_NODE) {
            roundSeparator.textContent = '/';
        }
        totalRoundsElement.textContent = CONFIG.TOTAL_ROUNDS;
    }
    
    document.getElementById('totalScore').textContent = gameState.totalScore;
}

function returnToStartScreen() {
    // Stop any running timer
    stopTimer();
    
    // Hide all modals
    document.getElementById('finalScoreModal').style.display = 'none';
    document.getElementById('resultModal').style.display = 'none';
    document.getElementById('restoreResult').style.display = 'none';
    
    // Hide game elements
    document.querySelector('header').style.display = 'none';
    document.getElementById('gameContainer').style.display = 'none';
    
    // Remove full-screen classes
    document.body.classList.remove('game-active');
    document.getElementById('app').classList.remove('game-active');
    
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
    
    // Reset game state completely
    gameState.currentRound = 1;
    gameState.totalScore = 0;
    gameState.rounds = [];
    gameState.guessLocation = null;
    gameState.guessMarker = null;
    gameState.gameStarted = false;
    gameState.currentLocation = null;
    gameState.originalLocation = null;
    gameState.roundSubmitted = false;
    gameState.timer = null;
    gameState.timeRemaining = 0;
    gameState.currentPanoramaPosition = null;
    gameState.startingNewRound = false;
    
    // Reset UI elements
    document.getElementById('submitGuess').disabled = true;
    document.getElementById('submitGuess').textContent = t('btn.submit');
    document.getElementById('nextRound').style.display = 'none';
    document.getElementById('nextRound').disabled = false;
    document.getElementById('resetLocationBtn').style.display = 'none';
    
    // Show start screen
    document.getElementById('startScreen').style.display = 'flex';
    
    // Clear selections
    document.querySelectorAll('.region-btn').forEach(b => b.classList.remove('selected'));
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('selected'));
    
    // Restore saved selections
    const savedSelection = loadGameSelectionFromLocalStorage();
    
    // Restore region selection
    let regionBtn = null;
    if (savedSelection.region.startsWith('custom_')) {
        const customRegionName = savedSelection.region.substring(7);
        regionBtn = document.querySelector(`.saved-custom-region-btn[data-custom-region="${customRegionName}"]`);
        
        if (regionBtn) {
            regionBtn.classList.add('selected');
            // Load the custom region data
            const savedRegions = getSavedCustomRegions();
            const savedRegion = savedRegions.find(r => r.name === customRegionName);
            if (savedRegion) {
                gameState.customRegion = savedRegion.region;
            }
        }
    } else {
        regionBtn = document.querySelector(`.region-btn[data-region="${savedSelection.region}"]`);
        if (regionBtn) {
            regionBtn.classList.add('selected');
        }
    }
    
    // Fallback to czechia if saved region not found
    if (!regionBtn) {
        const czechiaBtn = document.querySelector('.region-btn[data-region="czechia"]');
        if (czechiaBtn) czechiaBtn.classList.add('selected');
    }
    
    // Restore mode selection
    const modeBtn = document.querySelector(`.mode-btn[data-mode="${savedSelection.mode}"]`);
    if (modeBtn) {
        modeBtn.classList.add('selected');
    } else {
        const staticBtn = document.querySelector('.mode-btn[data-mode="static"]');
        if (staticBtn) staticBtn.classList.add('selected');
    }
    
    // Enable start button since we have restored selections
    document.getElementById('startGameBtn').disabled = false;
}

function showError(message) {
    console.error(message);
    alert(message);
}

// Display saved custom regions on start screen
function displaySavedCustomRegions() {
    const savedRegions = getSavedCustomRegions();
    const regionGrid = document.querySelector('.region-grid');
    
    // Remove any previously added custom region buttons
    document.querySelectorAll('.saved-custom-region-btn').forEach(btn => btn.remove());
    
    // Add buttons for each saved region (before the "Draw Region" button)
    const drawRegionBtn = document.getElementById('drawRegionBtn');
    
    savedRegions.forEach(({ name, region }) => {
        const btn = document.createElement('button');
        btn.className = 'region-btn saved-custom-region-btn';
        btn.dataset.customRegion = name;
        btn.innerHTML = `
            <span class="region-icon">📍</span>
            <span class="region-name">${name}</span>
            <button class="delete-region-btn" title="Delete this region">×</button>
        `;
        
        // Insert before draw region button
        regionGrid.insertBefore(btn, drawRegionBtn);
        
        // Handle selection
        btn.addEventListener('click', (e) => {
            // Don't trigger if clicking delete button
            if (e.target.classList.contains('delete-region-btn')) {
                return;
            }
            
            document.querySelectorAll('.region-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            
            // Load this custom region
            gameState.customRegion = region;
            gameState.selectedRegion = 'custom';
            
            // Save selection
            saveGameSelectionToLocalStorage('custom_' + name, gameState.selectedMode || 'static');
            
            // Enable start button
            document.getElementById('startGameBtn').disabled = false;
        });
        
        // Handle deletion
        const deleteBtn = btn.querySelector('.delete-region-btn');
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            
            if (confirm(t('confirm.deleteregion', { name }))) {
                deleteCustomRegion(name);
                displaySavedCustomRegions();
                
                // If this region was selected, clear selection
                if (btn.classList.contains('selected')) {
                    gameState.customRegion = null;
                    gameState.selectedRegion = null;
                    document.getElementById('startGameBtn').disabled = true;
                }
            }
        });
    });
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
    
    L.tileLayer(`/api/mapy/v1/maptiles/basic/256/{z}/{x}/{y}`, {
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
            document.getElementById('saveDrawing').disabled = false;
            
            // Show save section and update slot count
            const saveSection = document.getElementById('drawSaveSection');
            saveSection.style.display = 'block';
            document.getElementById('saveDrawing').style.display = 'inline-block';
            
            const savedRegions = getSavedCustomRegions();
            document.getElementById('regionSlotCount').textContent = t('draw.slots', { used: savedRegions.length, total: MAX_SAVED_REGIONS });
            
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
        document.getElementById('saveDrawing').disabled = true;
        document.getElementById('drawSaveSection').style.display = 'none';
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
    
    // Save drawing button
    document.getElementById('saveDrawing').onclick = () => {
        if (allPaths.length > 0) {
            const regionName = document.getElementById('customRegionName').value.trim();
            
            if (!regionName) {
                alert(t('alert.entername'));
                return;
            }
            
            // Validate name length
            if (regionName.length > 30) {
                alert(t('alert.nametoolong'));
                return;
            }
            
            // Calculate bounding box from all drawn paths
            const allLats = allPaths.flat().map(p => p.lat);
            const allLons = allPaths.flat().map(p => p.lng);
            
            // Convert paths from Leaflet LatLng objects to [lat, lon] arrays
            const convertedPaths = allPaths.map(path => 
                path.map(point => [point.lat, point.lng])
            );
            
            const regionData = {
                name: regionName,
                bounds: {
                    minLat: Math.min(...allLats),
                    maxLat: Math.max(...allLats),
                    minLon: Math.min(...allLons),
                    maxLon: Math.max(...allLons)
                },
                paths: convertedPaths
            };
            
            // Save to localStorage
            const saved = saveCustomRegion(regionName, regionData);
            
            if (saved) {
                // Set as current custom region
                gameState.customRegion = regionData;
                
                // Close modal
                modal.style.display = 'none';
                gameState.drawMap.remove();
                gameState.drawMap = null;
                
                // Refresh the saved regions display
                displaySavedCustomRegions();
                
                // Auto-select the newly saved region
                const savedBtn = document.querySelector(`.saved-custom-region-btn[data-custom-region="${regionName}"]`);
                if (savedBtn) {
                    savedBtn.click();
                }
                
                // Clear the name input for next time
                document.getElementById('customRegionName').value = '';
            }
        }
    };
    
    // Cancel button
    document.getElementById('cancelDrawing').onclick = () => {
        modal.style.display = 'none';
        if (gameState.drawMap) {
            gameState.drawMap.remove();
            gameState.drawMap = null;
        }
        // Clear the name input
        document.getElementById('customRegionName').value = '';
        document.getElementById('drawSaveSection').style.display = 'none';
    };
    
    // Fix map size after modal is visible
    setTimeout(() => {
        gameState.drawMap.invalidateSize();
        
        // Update slot count
        const savedRegions = getSavedCustomRegions();
        document.getElementById('regionSlotCount').textContent = t('draw.slots', { used: savedRegions.length, total: MAX_SAVED_REGIONS });
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
