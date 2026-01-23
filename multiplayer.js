// Multiplayer WebSocket Client

let ws = null;
let multiplayerState = {
    isMultiplayer: false,
    sessionCode: null,
    playerId: null,
    playerNick: 'Player',
    playerIcon: '😀',
    isOwner: false,
    isReady: false,
    players: [],
    settings: null,
    sharedLocation: null,
    waitingForLocation: false,
    countdownInterval: null
};

// Initialize multiplayer UI handlers
function setupMultiplayerUI() {
    // Switch to multiplayer from start screen
    const switchToMultiplayerBtn = document.getElementById('switchToMultiplayerBtn');
    if (switchToMultiplayerBtn) {
        switchToMultiplayerBtn.addEventListener('click', () => {
            multiplayerState.isMultiplayer = true;
            document.getElementById('multiplayerModal').style.display = 'flex';
        });
    }
    
    // Icon selection
    document.querySelectorAll('.icon-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.icon-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            multiplayerState.playerIcon = btn.dataset.icon;
        });
    });
    
    // Create session
    document.getElementById('createSessionBtn').addEventListener('click', () => {
        const nick = document.getElementById('playerNick').value.trim() || 'Player';
        multiplayerState.playerNick = nick;
        createSession(nick, multiplayerState.playerIcon);
    });
    
    // Join session
    document.getElementById('joinSessionBtn').addEventListener('click', () => {
        const code = document.getElementById('sessionCodeInput').value.trim().toLowerCase();
        const nick = document.getElementById('playerNick').value.trim() || 'Player';
        
        if (!code) {
            alert(t('mp.entercode'));
            return;
        }
        
        multiplayerState.playerNick = nick;
        joinSession(code, nick, multiplayerState.playerIcon);
    });
    
    // Cancel multiplayer
    document.getElementById('cancelMultiplayer').addEventListener('click', () => {
        document.getElementById('multiplayerModal').style.display = 'none';
    });
    
    // Toggle ready
    document.getElementById('toggleReadyBtn').addEventListener('click', () => {
        toggleReady();
    });
    
    // Leave lobby
    document.getElementById('leaveLobbyBtn').addEventListener('click', () => {
        leaveLobby();
    });
    
    // Copy session code
    document.getElementById('copySessionCode').addEventListener('click', () => {
        const code = document.getElementById('lobbySessionCode').textContent;
        navigator.clipboard.writeText(code).then(() => {
            showToast(t('mp.codecopied'), 'success');
        });
    });
}

// Connect to WebSocket
function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
        console.log('WebSocket connected');
    };
    
    ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        handleWebSocketMessage(msg);
    };
    
    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        alert(t('mp.connectionerror'));
    };
    
    ws.onclose = () => {
        console.log('WebSocket disconnected');
        if (multiplayerState.isMultiplayer) {
            alert(t('mp.connectionlost'));
            returnToModeSelection();
        }
    };
}

// Send WebSocket message
function sendWS(type, payload) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type, payload }));
    }
}

// Handle incoming WebSocket messages
function handleWebSocketMessage(msg) {
    console.log('Received:', msg);
    
    switch (msg.type) {
        case 'sessionCreated':
            multiplayerState.sessionCode = msg.payload.code;
            multiplayerState.isOwner = true;
            multiplayerState.players = msg.payload.players;
            multiplayerState.settings = msg.payload.settings;
            showLobby();
            break;
            
        case 'sessionJoined':
            multiplayerState.sessionCode = msg.payload.code;
            multiplayerState.isOwner = false;
            multiplayerState.players = msg.payload.players;
            multiplayerState.settings = msg.payload.settings;
            showLobby();
            break;
            
        case 'playerJoined':
            console.log('Player joined:', msg.payload);
            multiplayerState.players = msg.payload.players;
            updateLobbyPlayers();
            break;
            
        case 'playerLeft':
            console.log('Player left:', msg.payload);
            multiplayerState.players = msg.payload.players;
            updateLobbyPlayers();
            break;
            
        case 'playerReady':
            console.log('Player ready:', msg.payload);
            multiplayerState.players = msg.payload.players;
            updateLobbyPlayers();
            // Update start button if owner
            if (multiplayerState.isOwner && msg.payload.allReady !== undefined) {
                document.getElementById('startGameBtn').disabled = !msg.payload.allReady;
            }
            break;
            
        case 'settingsUpdated':
            multiplayerState.settings = msg.payload.settings;
            applyMultiplayerSettings();
            break;
            
        case 'kicked':
            alert(msg.payload.message);
            returnToModeSelection();
            break;
            
        case 'gameStarted':
            startMultiplayerGame();
            break;
            
        case 'timerStarted':
            startMultiplayerTimer(msg.payload.duration);
            break;
            
        case 'playerSubmitted':
            showPlayerSubmittedNotification(msg.payload);
            break;
            
        case 'roundEnd':
            handleMultiplayerRoundEnd(msg.payload);
            break;
            
        case 'locationData':
            applySharedLocation(msg.payload);
            break;
            
        case 'startNextRound':
            console.log('Received startNextRound message:', msg.payload);
            handleStartNextRound(msg.payload);
            break;
            
        case 'gameFinished':
            handleGameFinished(msg.payload);
            break;
            
        case 'retryLocation':
            handleRetryLocation(msg.payload);
            break;
            
        case 'error':
            showToast(msg.payload.message, 'error');
            break;
    }
}

// Create session
function createSession(nick, icon) {
    connectWebSocket();
    
    // Wait for connection then send
    setTimeout(() => {
        sendWS('createSession', { nick, icon });
    }, 500);
}

// Join session
function joinSession(code, nick, icon) {
    connectWebSocket();
    
    // Wait for connection then send
    setTimeout(() => {
        sendWS('joinSession', { code, nick, icon });
    }, 500);
}

// Show lobby
function showLobby() {
    document.getElementById('multiplayerModal').style.display = 'none';
    document.getElementById('startScreen').style.display = 'flex';
    document.getElementById('lobbyPanel').style.display = 'block';
    
    // Update session code
    document.getElementById('lobbySessionCode').textContent = multiplayerState.sessionCode;
    
    // Disable start button until all players are ready
    document.getElementById('startGameBtn').disabled = true;
    
    // Apply settings if owner
    if (multiplayerState.isOwner) {
        enableOwnerControls();
    } else {
        disableOwnerControls();
    }
    
    // Apply multiplayer settings
    applyMultiplayerSettings();
    
    // Update players list
    updateLobbyPlayers();
}

// Update lobby players list
function updateLobbyPlayers() {
    const container = document.getElementById('lobbyPlayersList');
    container.innerHTML = '';
    
    multiplayerState.players.forEach(player => {
        const playerDiv = document.createElement('div');
        playerDiv.className = 'player-item';
        
        const isMe = player.nick === multiplayerState.playerNick;
        
        playerDiv.innerHTML = `
            <div class="player-icon">${player.icon}</div>
            <div class="player-info">
                <div class="player-nick">
                    ${player.nick}${isMe ? ' (You)' : ''}
                    ${player.isOwner ? '<span class="player-owner-badge">HOST</span>' : ''}
                </div>
            </div>
            <div class="${player.isReady ? 'player-ready' : 'player-not-ready'}">
                ${player.isReady ? '✓' : '○'}
            </div>
            ${multiplayerState.isOwner && !player.isOwner ? 
                `<button class="kick-btn" onclick="kickPlayer('${player.id}')">Kick</button>` : ''}
        `;
        
        container.appendChild(playerDiv);
    });
}

// Toggle ready state
function toggleReady() {
    multiplayerState.isReady = !multiplayerState.isReady;
    sendWS('toggleReady', {});
    
    const btn = document.getElementById('toggleReadyBtn');
    if (multiplayerState.isReady) {
        btn.textContent = t('mp.notready');
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-secondary');
    } else {
        btn.textContent = t('mp.ready');
        btn.classList.remove('btn-secondary');
        btn.classList.add('btn-primary');
    }
}

// Kick player
function kickPlayer(playerId) {
    sendWS('kickPlayer', { playerId });
}

// Leave lobby
function leaveLobby() {
    if (ws) {
        ws.close();
    }
    returnToModeSelection();
}

// Return to start screen
function returnToModeSelection() {
    document.getElementById('lobbyPanel').style.display = 'none';
    document.getElementById('startScreen').style.display = 'flex';
    
    multiplayerState = {
        isMultiplayer: false,
        sessionCode: null,
        playerId: null,
        playerNick: 'Player',
        playerIcon: '😀',
        isOwner: false,
        isReady: false,
        players: [],
        settings: null
    };
}

// Enable owner controls
function enableOwnerControls() {
    // Enable region and mode buttons
    document.querySelectorAll('.region-btn, .mode-btn').forEach(btn => {
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
    });
    
    // Enable settings button
    document.getElementById('difficultyPrefsBtn').disabled = false;
    
    // Listen for setting changes
    document.querySelectorAll('.region-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            sendWS('updateSettings', { region: btn.dataset.region });
        });
    });
    
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            sendWS('updateSettings', { mode: btn.dataset.mode });
        });
    });
    
    // Listen for preference changes
    ['mapLayers', 'showRegion', 'turnAround', 'zoom', 'targetOriginal'].forEach(pref => {
        const checkbox = document.getElementById(`pref-${pref}`);
        if (checkbox) {
            checkbox.addEventListener('change', () => {
                const update = {};
                update[pref] = checkbox.checked;
                sendWS('updateSettings', update);
            });
        }
    });
}

// Disable owner controls
function disableOwnerControls() {
    // Disable region and mode buttons
    document.querySelectorAll('.region-btn, .mode-btn').forEach(btn => {
        btn.disabled = true;
        btn.style.opacity = '0.5';
        btn.style.cursor = 'not-allowed';
    });
    
    // Disable settings button
    document.getElementById('difficultyPrefsBtn').disabled = true;
}

// Apply multiplayer settings
function applyMultiplayerSettings() {
    if (!multiplayerState.settings) return;
    
    const settings = multiplayerState.settings;
    
    // Select region
    document.querySelectorAll('.region-btn').forEach(btn => {
        btn.classList.remove('selected');
        if (btn.dataset.region === settings.region) {
            btn.classList.add('selected');
        }
    });
    
    // Select mode
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.classList.remove('selected');
        if (btn.dataset.mode === settings.mode) {
            btn.classList.add('selected');
        }
    });
    
    // Apply preferences
    gameState.preferences.mapLayers = settings.mapLayers;
    gameState.preferences.showRegion = settings.showRegion;
    gameState.preferences.turnAround = settings.turnAround;
    gameState.preferences.zoom = settings.zoom;
    gameState.preferences.targetOriginal = settings.targetOriginal;
    
    // Update checkboxes
    document.getElementById('pref-mapLayers').checked = settings.mapLayers;
    document.getElementById('pref-showRegion').checked = settings.showRegion;
    document.getElementById('pref-turnAround').checked = settings.turnAround;
    document.getElementById('pref-zoom').checked = settings.zoom;
    document.getElementById('pref-targetOriginal').checked = settings.targetOriginal;
}

// Start multiplayer game
function startMultiplayerGame() {
    // Hide lobby
    document.getElementById('lobbyPanel').style.display = 'none';
    
    // Reset shared location for new game
    multiplayerState.sharedLocation = null;
    multiplayerState.waitingForLocation = false;
    
    // Start game with multiplayer settings
    gameState.selectedRegion = multiplayerState.settings.region;
    gameState.selectedMode = multiplayerState.settings.mode;
    
    // Hide start screen and start game
    document.getElementById('startScreen').style.display = 'none';
    document.querySelector('header').style.display = 'flex';
    document.getElementById('gameContainer').style.display = 'block';
    
    document.body.classList.add('game-active');
    document.getElementById('app').classList.add('game-active');
    
    gameState.gameStarted = true;
    gameState.isMultiplayer = true;
    
    initializeMap();
    setupEventListeners();
    startNewRound();
}

// Request shared location from server (called by first player who finds it)
function requestSharedLocation(location) {
    if (multiplayerState.isMultiplayer) {
        console.log('Sharing location with other players:', location);
        sendWS('requestLocation', {
            lat: location.lat,
            lon: location.lon,
            date: location.date || ''
        });
    }
}

// Get shared location - returns a promise that resolves with the location
async function getSharedLocation() {
    // If we already have a cached location, return it
    if (multiplayerState.sharedLocation) {
        console.log('Using cached location:', multiplayerState.sharedLocation);
        return multiplayerState.sharedLocation;
    }
    
    // Set up promise to wait for server broadcast
    return new Promise(async (resolve) => {
        // Store resolver so applySharedLocation can resolve it
        multiplayerState.locationResolver = resolve;
        multiplayerState.waitingForLocation = true;
        
        // Try to be the first to find and share a location
        console.log('Finding new location to share...');
        const location = await findRandomLocationWithPanorama();
        
        if (location && !multiplayerState.sharedLocation) {
            // Send to server - it will broadcast to all players including us
            console.log('Sending location to server:', location);
            requestSharedLocation(location);
        }
        
        // If we already got location from server while finding, resolve immediately
        if (multiplayerState.sharedLocation) {
            resolve(multiplayerState.sharedLocation);
        }
        // Otherwise wait for server broadcast (applySharedLocation will resolve)
    });
}

// Apply shared location from server
function applySharedLocation(locationData) {
    console.log('Received shared location:', locationData);
    multiplayerState.sharedLocation = locationData;
    
    // If someone is waiting for location, resolve the promise
    if (multiplayerState.waitingForLocation && multiplayerState.locationResolver) {
        multiplayerState.locationResolver(locationData);
        multiplayerState.waitingForLocation = false;
        multiplayerState.locationResolver = null;
    }
}

// Start multiplayer timer (when first player submits)
function startMultiplayerTimer(duration) {
    // Show timer
    const timerDisplay = document.getElementById('timerDisplay');
    timerDisplay.style.display = 'flex';
    
    gameState.timeRemaining = duration;
    updateTimerDisplay();
    
    // Start countdown
    if (gameState.timer) {
        clearInterval(gameState.timer);
    }
    
    gameState.timer = setInterval(() => {
        gameState.timeRemaining--;
        updateTimerDisplay();
        
        if (gameState.timeRemaining <= 0) {
            clearInterval(gameState.timer);
            // Round will end from server
        }
    }, 1000);
}

// Show a toast notification
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    // Animate in
    setTimeout(() => toast.classList.add('show'), 10);
    
    // Remove after 2.5 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}

// Show notification when player submits
function showPlayerSubmittedNotification(playerData) {
    // Don't show notification for own submission
    if (playerData.nick === multiplayerState.playerNick) {
        return;
    }
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'player-submitted-notification';
    notification.innerHTML = `${playerData.icon} <strong>${playerData.nick}</strong> ${t('mp.submitted')}`;
    
    // Add to header
    const header = document.querySelector('header');
    header.appendChild(notification);
    
    // Animate in
    setTimeout(() => notification.classList.add('show'), 10);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Handle multiplayer round end
function handleMultiplayerRoundEnd(data) {
    // Force submit if not already submitted
    if (!gameState.roundSubmitted && gameState.guessLocation) {
        submitGuess();
    } else if (!gameState.roundSubmitted) {
        // No guess made - timeout
        handleTimeOut();
    }
    
    // Stop and hide the round timer
    if (gameState.timer) {
        clearInterval(gameState.timer);
        gameState.timer = null;
    }
    const timerDisplay = document.getElementById('timerDisplay');
    if (timerDisplay) {
        timerDisplay.style.display = 'none';
    }
    
    // Hide Next Round button in multiplayer
    document.getElementById('nextRound').style.display = 'none';
    
    // Clear any existing countdown
    if (multiplayerState.countdownInterval) {
        clearInterval(multiplayerState.countdownInterval);
        multiplayerState.countdownInterval = null;
    }
    
    // Show countdown timer
    const countdownDiv = document.getElementById('multiplayerCountdown');
    const countdownTimer = document.getElementById('countdownTimer');
    if (countdownDiv && countdownTimer) {
        countdownDiv.style.display = 'block';
        let secondsLeft = 5;
        countdownTimer.textContent = secondsLeft;
        
        multiplayerState.countdownInterval = setInterval(() => {
            secondsLeft--;
            if (secondsLeft > 0) {
                countdownTimer.textContent = secondsLeft;
            } else {
                clearInterval(multiplayerState.countdownInterval);
                multiplayerState.countdownInterval = null;
                countdownDiv.style.display = 'none';
            }
        }, 1000);
    }
    
    // Store player results for displaying on map
    if (data && data.players) {
        multiplayerState.roundResults = data.players;
        
        // Wait a bit for result modal to open, then add player markers
        setTimeout(() => {
            showMultiplayerResults(data.players);
        }, 500);
    }
}

// Show multiplayer results on map and scoreboard
function showMultiplayerResults(players) {
    const resultMap = gameState.resultMap;
    if (!resultMap) return;
    
    // Get actual location
    const actualLocation = getCurrentPanoramaPosition();
    if (!actualLocation) return;
    
    // Array to store all bounds for fitting
    const allLatLngs = [[actualLocation.lat, actualLocation.lon]];
    
    // Add markers and lines for each player's guess
    players.forEach(player => {
        if (player.hasGuess && player.guessLat && player.guessLon) {
            const guessLatLng = [player.guessLat, player.guessLon];
            allLatLngs.push(guessLatLng);
            
            // Calculate distance
            const distance = calculateDistance(
                actualLocation.lat,
                actualLocation.lon,
                player.guessLat,
                player.guessLon
            );
            
            // Create custom icon with player emoji
            const iconHtml = `
                <div style="text-align: center;">
                    <div style="font-size: 24px;">${player.icon}</div>
                    <div style="font-size: 10px; font-weight: bold; color: #333; background: white; padding: 2px 4px; border-radius: 3px; margin-top: 2px;">
                        ${player.nick}
                    </div>
                </div>
            `;
            
            const playerIcon = L.divIcon({
                html: iconHtml,
                className: 'player-guess-marker',
                iconSize: [50, 50],
                iconAnchor: [25, 50]
            });
            
            // Add marker
            L.marker(guessLatLng, { icon: playerIcon })
                .addTo(resultMap);
            
            // Draw line from actual location to guess
            const line = L.polyline([
                [actualLocation.lat, actualLocation.lon],
                guessLatLng
            ], {
                color: getPlayerColor(player.id),
                weight: 2,
                opacity: 0.7,
                dashArray: '5, 5'
            }).addTo(resultMap);
            
            // Add distance label at midpoint
            const midLat = (actualLocation.lat + player.guessLat) / 2;
            const midLon = (actualLocation.lon + player.guessLon) / 2;
            
            const distanceText = distance < 1 
                ? `${Math.round(distance * 1000)}m`
                : `${distance.toFixed(1)}km`;
            
            L.marker([midLat, midLon], {
                icon: L.divIcon({
                    html: `<div style="background: white; padding: 2px 6px; border-radius: 3px; font-size: 11px; font-weight: bold; border: 1px solid #ccc; white-space: nowrap;">${distanceText}</div>`,
                    className: 'distance-label',
                    iconSize: [50, 20],
                    iconAnchor: [25, 10]
                })
            }).addTo(resultMap);
        }
    });
    
    // Fit map to show all markers
    if (allLatLngs.length > 1) {
        resultMap.fitBounds(allLatLngs, {
            padding: [50, 50],
            maxZoom: 15
        });
    }
    
    // Add scoreboard to result modal
    addScoreboardToModal(players);
}

// Get consistent color for each player
function getPlayerColor(playerId) {
    const colors = [
        '#667eea', // Purple
        '#f093fb', // Pink
        '#4facfe', // Blue
        '#43e97b', // Green
        '#fa709a', // Red-pink
        '#feca57', // Yellow
        '#ff6b6b', // Red
        '#48dbfb'  // Cyan
    ];
    
    // Use player ID to consistently assign color
    const hash = playerId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
}

// Add scoreboard to result modal
function addScoreboardToModal(players) {
    // Sort players by total score (descending)
    const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
    
    // Check if scoreboard already exists
    let scoreboard = document.getElementById('multiplayerScoreboard');
    if (!scoreboard) {
        scoreboard = document.createElement('div');
        scoreboard.id = 'multiplayerScoreboard';
        scoreboard.className = 'multiplayer-scoreboard';
        
        // Insert after result details
        const resultDetails = document.querySelector('.result-details');
        if (resultDetails) {
            resultDetails.parentNode.insertBefore(scoreboard, resultDetails.nextSibling);
        }
    }
    
    // Build scoreboard HTML
    let html = '<h3>🏆 Scoreboard</h3><div class="scoreboard-list">';
    sortedPlayers.forEach((player, index) => {
        const rank = index + 1;
        const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '';
        html += `
            <div class="scoreboard-item ${player.nick === multiplayerState.playerNick ? 'current-player' : ''}">
                <span class="rank">${medal || rank}</span>
                <span class="player-info">
                    <span class="player-icon">${player.icon}</span>
                    <span class="player-nick">${player.nick}</span>
                </span>
                <span class="scores">
                    <span class="round-score">+${player.roundScore || 0}</span>
                    <span class="total-score">${player.score}</span>
                </span>
            </div>
        `;
    });
    html += '</div>';
    
    scoreboard.innerHTML = html;
}

// Handle start next round from server
function handleStartNextRound(data) {
    console.log('Server starting round:', data.round);
    
    // Clear countdown interval
    if (multiplayerState.countdownInterval) {
        clearInterval(multiplayerState.countdownInterval);
        multiplayerState.countdownInterval = null;
    }
    
    // Close result modal
    document.getElementById('resultModal').style.display = 'none';
    document.getElementById('minimizedControls').style.display = 'none';
    
    // Hide countdown
    const countdownDiv = document.getElementById('multiplayerCountdown');
    if (countdownDiv) {
        countdownDiv.style.display = 'none';
    }
    
    // Clear shared location for new round
    multiplayerState.sharedLocation = null;
    multiplayerState.waitingForLocation = false;
    
    // Update round number from server
    gameState.currentRound = data.round;
    
    console.log('Starting new round:', gameState.currentRound);
    
    // Start the new round
    startNewRound();
}

// Handle game finished
function handleGameFinished(data) {
    console.log('Game finished!', data);
    
    // Close result modal
    document.getElementById('resultModal').style.display = 'none';
    
    // Sort players by score
    const sortedPlayers = [...data.players].sort((a, b) => b.score - a.score);
    const winner = sortedPlayers[0];
    
    // Show winner announcement
    const winnerAnnouncement = document.getElementById('winnerAnnouncement');
    winnerAnnouncement.innerHTML = `
        <div style="font-size: 48px; margin-bottom: 10px;">${winner.icon}</div>
        <div>${t('mp.wins', { player: winner.nick })}</div>
        <div style="font-size: 18px; color: #888; margin-top: 5px;">${t('mp.withpoints', { score: winner.score })}</div>
    `;
    
    // Build final scoreboard
    const finalScoreboard = document.getElementById('finalScoreboard');
    let html = '<div class="scoreboard-list" style="margin-top: 20px;">';
    sortedPlayers.forEach((player, index) => {
        const rank = index + 1;
        const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '';
        html += `
            <div class="scoreboard-item ${player.nick === multiplayerState.playerNick ? 'current-player' : ''}">
                <span class="rank">${medal || rank}</span>
                <span class="player-info">
                    <span class="player-icon">${player.icon}</span>
                    <span class="player-nick">${player.nick}</span>
                </span>
                <span class="scores">
                    <span class="total-score">${player.score}</span>
                </span>
            </div>
        `;
    });
    html += '</div>';
    finalScoreboard.innerHTML = html;
    
    // Show winner modal
    document.getElementById('winnerModal').style.display = 'flex';
    
    // Setup back to menu button
    document.getElementById('backToMenuBtn').onclick = () => {
        // Close winner modal
        document.getElementById('winnerModal').style.display = 'none';
        
        // Leave lobby and disconnect
        leaveLobby();
        
        // Reset game state
        gameState.gameStarted = false;
        gameState.isMultiplayer = false;
        
        // Hide game UI
        document.getElementById('gameContainer').style.display = 'none';
        document.querySelector('header').style.display = 'none';
        document.body.classList.remove('game-active');
        document.getElementById('app').classList.remove('game-active');
        
        // Show start screen
        document.getElementById('startScreen').style.display = 'flex';
    };
}

// Handle retry location from server (when panorama fails)
function handleRetryLocation(data) {
    console.log('Server requesting location retry:', data.message);
    // Clear shared location so we find a new one
    multiplayerState.sharedLocation = null;
    multiplayerState.waitingForLocation = false;
    
    // Retry the current round (will find new location)
    startNewRound();
}

// Override submitGuess for multiplayer
const originalSubmitGuess = window.submitGuess;
window.submitGuess = function() {
    if (multiplayerState.isMultiplayer) {
        // Calculate score before sending
        const targetLocation = (gameState.preferences.targetOriginal || gameState.selectedMode !== 'explorer')
            ? gameState.originalLocation
            : getCurrentPanoramaPosition();
        
        const distance = calculateDistance(
            targetLocation.lat,
            targetLocation.lon,
            gameState.guessLocation.lat,
            gameState.guessLocation.lon
        );
        
        const score = calculateScore(distance);
        
        // Send guess with score to server
        sendWS('submitGuess', {
            lat: gameState.guessLocation.lat,
            lon: gameState.guessLocation.lon,
            score: score
        });
    }
    
    // Call original function
    originalSubmitGuess();
};

// Initialize multiplayer on page load
document.addEventListener('DOMContentLoaded', () => {
    setupMultiplayerUI();
});
