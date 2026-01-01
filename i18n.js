// Internationalization (i18n) for GDE Game
// Supported languages: English (en), Czech (cs)

const translations = {
    en: {
        // Main titles
        'app.title': 'GDE SU?!',
        'app.subtitle': 'Geo Guessing Game',
        
        // Mode Selection Screen
        'mode.select.title': 'Select Play Mode',
        'mode.single': 'Single Player',
        'mode.single.desc': 'Play alone at your own pace',
        'mode.multi': 'Multiplayer',
        'mode.multi.desc': 'Compete with friends online',
        
        // Start Screen - Region Selection
        'region.select': 'Select Region',
        'region.czechia': 'Czech Republic',
        'region.prague': 'Prague',
        'region.brno': 'Brno',
        'region.moravia': 'Moravia',
        'region.bohemia': 'Bohemia',
        'region.draw': 'Draw Region',
        
        // Start Screen - Game Mode
        'gamemode.select': 'Select Game Mode',
        'gamemode.explorer': 'Explorer Mode',
        'gamemode.explorer.desc': 'Move around and explore the panorama',
        'gamemode.static': 'Static Mode',
        'gamemode.static.desc': 'Fixed view, no movement allowed',
        
        // Buttons
        'btn.settings': 'Game Settings',
        'btn.start': 'Start Game',
        'btn.submit': 'Submit Guess',
        'btn.next': 'Next Round',
        'btn.finish': 'Finish Game',
        'btn.minimize': 'Minimize',
        'btn.restore': 'Show Results',
        'btn.reset': 'Reset Location',
        'btn.backmenu': 'Back to Menu',
        
        // Game Header
        'header.round': 'Round:',
        'header.score': 'Total Score:',
        'header.time': 'Time:',
        
        // Map Overlay
        'map.title': 'Make your guess',
        'map.layer.basic': 'Basic',
        'map.layer.outdoor': 'Outdoor',
        'map.layer.winter': 'Winter',
        'map.layer.aerial': 'Aerial',
        
        // Results
        'result.title': 'Round Result',
        'result.round': 'Round {round} Result',
        'result.distance': 'Distance:',
        'result.score': 'Score:',
        'result.timeout': 'Time\'s Up!',
        'result.noguess': 'No guess submitted',
        'result.points': '{score} points',
        'result.viewfinal': 'View Final Score',
        
        // Final Score
        'final.title': 'Game Finished!',
        'final.score': 'Final Score',
        'final.breakdown': 'Round Breakdown:',
        'final.round': 'Round {round}:',
        'final.timeout': 'Time out',
        
        // Settings Modal
        'settings.title': 'Game Settings',
        'settings.subtitle': 'Customize your game settings',
        'settings.maplayers': 'Switch Map Layers',
        'settings.maplayers.desc': 'Allow changing map style in minimap',
        'settings.showregion': 'Show Play Region',
        'settings.showregion.desc': 'Display region boundaries on minimap',
        'settings.turnaround': 'Turn Around in Panorama',
        'settings.turnaround.desc': 'Allow rotating view 360°',
        'settings.zoom': 'Allow Zoom',
        'settings.zoom.desc': 'Enable zooming in the panorama view',
        'settings.targetoriginal': 'Score from Original Location (Explorer Mode)',
        'settings.targetoriginal.desc': 'ON: starting point. OFF: current position',
        'settings.timetrial': 'Time Trial Mode',
        'settings.timetrial.desc': 'Add a countdown timer to each round',
        'settings.timelimit': 'Time Limit (seconds):',
        'settings.infinite': 'Infinite Mode',
        'settings.infinite.desc': 'Play endless rounds',
        'settings.close': 'Close',
        
        // Draw Region Modal
        'draw.title': 'Draw Custom Region',
        'draw.instructions': 'Draw one or more areas on the map to create your custom play region.',
        'draw.mode.draw': 'Draw Mode',
        'draw.mode.pan': 'Pan Mode',
        'draw.clear': 'Clear Drawing',
        'draw.confirm': 'Use This Region',
        'draw.save': 'Save Region',
        'draw.cancel': 'Cancel',
        'draw.name': 'Region Name:',
        'draw.name.placeholder': 'Enter a name for this region',
        'draw.slots': '{used}/{total} slots used',
        
        // Panorama Error
        'error.panorama.title': 'No Panorama Found',
        'error.panorama.message': 'Could not find a panorama in the selected region after {attempts} attempts.',
        'error.panorama.retry': 'Retry',
        'error.panorama.cancel': 'Cancel',
        'error.panorama.attempts': 'Search attempts: {count}',
        
        // Multiplayer
        'mp.winner': 'Winner: {name}!',
        'mp.tie': 'It\'s a tie!',
        'mp.countdown': 'Next round starts in {seconds} seconds...',
        'mp.create': 'Create New Session',
        'mp.join': 'Join Existing Session',
        'mp.sessioncode': 'Session Code:',
        'mp.yourname': 'Your Name:',
        'mp.selecticon': 'Select Icon:',
        'mp.createsession': 'Create Session',
        'mp.joinsession': 'Join Session',
        'mp.lobby': 'Lobby',
        'mp.waiting': 'Waiting for players...',
        'mp.ready': 'Ready',
        'mp.startgame': 'Start Game',
        'mp.scoreboard': 'Scoreboard',
        
        // Misc
        'units.km': 'km',
        'units.points': 'pts',
        'language': 'Language:',
    },
    cs: {
        // Main titles
        'app.title': 'GDE SU?!',
        'app.subtitle': 'Geografická hra',
        
        // Mode Selection Screen
        'mode.select.title': 'Vyber režim hry',
        'mode.single': 'Jeden hráč',
        'mode.single.desc': 'Hraj sám svým tempem',
        'mode.multi': 'Více hráčů',
        'mode.multi.desc': 'Soutěž s přáteli online',
        
        // Start Screen - Region Selection
        'region.select': 'Vyber region',
        'region.czechia': 'Česká republika',
        'region.prague': 'Praha',
        'region.brno': 'Brno',
        'region.moravia': 'Morava',
        'region.bohemia': 'Čechy',
        'region.draw': 'Vlastní region',
        
        // Start Screen - Game Mode
        'gamemode.select': 'Vyber herní režim',
        'gamemode.explorer': 'Průzkumník',
        'gamemode.explorer.desc': 'Pohybuj se a prozkoumávej panorama',
        'gamemode.static': 'Statický',
        'gamemode.static.desc': 'Pevný pohled bez pohybu',
        
        // Buttons
        'btn.settings': 'Nastavení',
        'btn.start': 'Začít hru',
        'btn.submit': 'Potvrdit',
        'btn.next': 'Další kolo',
        'btn.finish': 'Ukončit hru',
        'btn.minimize': 'Skrýt',
        'btn.restore': 'Zobrazit výsledky',
        'btn.reset': 'Vrátit na začátek',
        'btn.backmenu': 'Zpět do menu',
        
        // Game Header
        'header.round': 'Kolo:',
        'header.score': 'Celkem bodů:',
        'header.time': 'Čas:',
        
        // Map Overlay
        'map.title': 'Označ místo na mapě',
        'map.layer.basic': 'Základní',
        'map.layer.outdoor': 'Turistická',
        'map.layer.winter': 'Zimní',
        'map.layer.aerial': 'Letecká',
        
        // Results
        'result.title': 'Výsledek kola',
        'result.round': 'Výsledek {round}. kola',
        'result.distance': 'Vzdálenost:',
        'result.score': 'Body:',
        'result.timeout': 'Čas vypršel!',
        'result.noguess': 'Nebyl odeslán žádný tip',
        'result.points': '{score} bodů',
        'result.viewfinal': 'Zobrazit celkové skóre',
        
        // Final Score
        'final.title': 'Konec hry!',
        'final.score': 'Celkové skóre',
        'final.breakdown': 'Přehled kol:',
        'final.round': 'Kolo {round}:',
        'final.timeout': 'Čas vypršel',
        
        // Settings Modal
        'settings.title': 'Nastavení hry',
        'settings.subtitle': 'Přizpůsob si hru podle sebe',
        'settings.maplayers': 'Přepínání vrstev mapy',
        'settings.maplayers.desc': 'Povolit změnu stylu mapy v minimapě',
        'settings.showregion': 'Zobrazit herní region',
        'settings.showregion.desc': 'Zobrazit hranice regionu na minimapě',
        'settings.turnaround': 'Otáčení v panoramatu',
        'settings.turnaround.desc': 'Povolit otáčení o 360°',
        'settings.zoom': 'Přibližování',
        'settings.zoom.desc': 'Povolit přibližování v panoramatu',
        'settings.targetoriginal': 'Body za vzdálenost od startu (průzkumník)',
        'settings.targetoriginal.desc': 'ZAP: od začátku. VYP: od aktuální pozice',
        'settings.timetrial': 'Hra na čas',
        'settings.timetrial.desc': 'Přidat časový limit do každého kola',
        'settings.timelimit': 'Časový limit (sekundy):',
        'settings.infinite': 'Nekonečný režim',
        'settings.infinite.desc': 'Hraj bez omezení počtu kol',
        'settings.close': 'Zavřít',
        
        // Draw Region Modal
        'draw.title': 'Vlastní region',
        'draw.instructions': 'Nakresli jednu nebo více oblastí na mapě.',
        'draw.mode.draw': 'Kreslit',
        'draw.mode.pan': 'Posouvat mapu',
        'draw.clear': 'Smazat',
        'draw.confirm': 'Použít tento region',
        'draw.save': 'Uložit region',
        'draw.cancel': 'Zrušit',
        'draw.name': 'Název regionu:',
        'draw.name.placeholder': 'Zadej název regionu',
        'draw.slots': '{used}/{total} slotů použito',
        
        // Panorama Error
        'error.panorama.title': 'Panorama nenalezeno',
        'error.panorama.message': 'Nepodařilo se najít panorama ve vybraném regionu po {attempts} pokusech.',
        'error.panorama.retry': 'Zkusit znovu',
        'error.panorama.cancel': 'Zrušit',
        'error.panorama.attempts': 'Počet pokusů: {count}',
        
        // Multiplayer
        'mp.winner': 'Vítěz: {name}!',
        'mp.tie': 'Remíza!',
        'mp.countdown': 'Další kolo za {seconds} sekund...',
        'mp.create': 'Vytvořit novou hru',
        'mp.join': 'Připojit se ke hře',
        'mp.sessioncode': 'Kód hry:',
        'mp.yourname': 'Tvoje jméno:',
        'mp.selecticon': 'Vyber ikonu:',
        'mp.createsession': 'Vytvořit hru',
        'mp.joinsession': 'Připojit se',
        'mp.lobby': 'Čekárna',
        'mp.waiting': 'Čeká se na hráče...',
        'mp.ready': 'Připraven',
        'mp.startgame': 'Začít hru',
        'mp.scoreboard': 'Žebříček',
        
        // Misc
        'units.km': 'km',
        'units.points': 'bodů',
        'language': 'Jazyk:',
    }
};

// Current language (default: English)
let currentLanguage = 'en';

// Initialize i18n system
function initI18n() {
    // Load saved language preference
    const savedLang = localStorage.getItem('gde_language');
    if (savedLang && translations[savedLang]) {
        currentLanguage = savedLang;
    } else {
        // Auto-detect browser language
        const browserLang = navigator.language.split('-')[0]; // Get 'cs' from 'cs-CZ'
        if (translations[browserLang]) {
            currentLanguage = browserLang;
        }
    }
    
    updatePageLanguage();
}

// Get translation for a key
function t(key, replacements = {}) {
    let translation = translations[currentLanguage]?.[key] || translations['en'][key] || key;
    
    // Replace placeholders like {round}, {score}, etc.
    Object.keys(replacements).forEach(placeholder => {
        translation = translation.replace(`{${placeholder}}`, replacements[placeholder]);
    });
    
    return translation;
}

// Change language
function setLanguage(lang) {
    if (translations[lang]) {
        currentLanguage = lang;
        localStorage.setItem('gde_language', lang);
        updatePageLanguage();
    }
}

// Update all elements with data-i18n attribute
function updatePageLanguage() {
    // Update elements with data-i18n attribute
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        element.textContent = t(key);
    });
    
    // Update elements with data-i18n-placeholder attribute
    document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
        const key = element.getAttribute('data-i18n-placeholder');
        element.placeholder = t(key);
    });
    
    // Update elements with data-i18n-title attribute
    document.querySelectorAll('[data-i18n-title]').forEach(element => {
        const key = element.getAttribute('data-i18n-title');
        element.title = t(key);
    });
    
    // Update language selector if it exists
    const langSelector = document.getElementById('languageSelect');
    if (langSelector) {
        langSelector.value = currentLanguage;
    }
    
    // Update HTML lang attribute
    document.documentElement.lang = currentLanguage;
}

// Get current language
function getCurrentLanguage() {
    return currentLanguage;
}

// Export functions for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { t, setLanguage, getCurrentLanguage, initI18n };
}
