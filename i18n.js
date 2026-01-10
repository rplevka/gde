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
        'region.czech_regions': 'Czech Regions',
        'region.select_region': 'Select a region...',
        
        // Czech Regions
        'region.praha': 'Prague',
        'region.stredocesky_kraj': 'Central Bohemian Region',
        'region.jihocesky_kraj': 'South Bohemian Region',
        'region.plzeňsky_kraj': 'Plzeň Region',
        'region.karlovarsky_kraj': 'Karlovy Vary Region',
        'region.ústecky_kraj': 'Ústí nad Labem Region',
        'region.liberecky_kraj': 'Liberec Region',
        'region.kralovehradecky_kraj': 'Hradec Králové Region',
        'region.pardubicky_kraj': 'Pardubice Region',
        'region.kraj_vysocina': 'Vysočina Region',
        'region.jihomoravsky_kraj': 'South Moravian Region',
        'region.olomoucky_kraj': 'Olomouc Region',
        'region.zlinsky_kraj': 'Zlín Region',
        'region.moravskoslezsky_kraj': 'Moravian-Silesian Region',
        
        // Czech Districts
        'region.czech_districts': 'Czech Districts',
        'region.select_district': 'Select a district...',
        'district.benesov': 'Benešov',
        'district.beroun': 'Beroun',
        'district.blansko': 'Blansko',
        'district.breclav': 'Břeclav',
        'district.brno_mesto': 'Brno-město',
        'district.brno_venkov': 'Brno-venkov',
        'district.bruntal': 'Bruntál',
        'district.ceska_lipa': 'Česká Lípa',
        'district.ceske_budejovice': 'České Budějovice',
        'district.cesky_krumlov': 'Český Krumlov',
        'district.cheb': 'Cheb',
        'district.chomutov': 'Chomutov',
        'district.chrudim': 'Chrudim',
        'district.decin': 'Děčín',
        'district.domazlice': 'Domažlice',
        'district.frydek_mistek': 'Frýdek-Místek',
        'district.havlickuv_brod': 'Havlíčkův Brod',
        'district.hodonin': 'Hodonín',
        'district.hradec_kralove': 'Hradec Králové',
        'district.jablonec_nad_nisou': 'Jablonec nad Nisou',
        'district.jesenik': 'Jeseník',
        'district.jicin': 'Jičín',
        'district.jihlava': 'Jihlava',
        'district.jindrichuv_hradec': 'Jindřichův Hradec',
        'district.karlovy_vary': 'Karlovy Vary',
        'district.karvina': 'Karviná',
        'district.kladno': 'Kladno',
        'district.klatovy': 'Klatovy',
        'district.kolin': 'Kolín',
        'district.kromeriz': 'Kroměříž',
        'district.kutna_hora': 'Kutná Hora',
        'district.liberec': 'Liberec',
        'district.litomerice': 'Litoměřice',
        'district.louny': 'Louny',
        'district.melnik': 'Mělník',
        'district.mlada_boleslav': 'Mladá Boleslav',
        'district.most': 'Most',
        'district.nachod': 'Náchod',
        'district.novy_jicin': 'Nový Jičín',
        'district.nymburk': 'Nymburk',
        'district.olomouc': 'Olomouc',
        'district.opava': 'Opava',
        'district.ostrava_mesto': 'Ostrava-město',
        'district.pardubice': 'Pardubice',
        'district.pelhrimov': 'Pelhřimov',
        'district.pisek': 'Písek',
        'district.plzen_jih': 'Plzeň-jih',
        'district.plzen_mesto': 'Plzeň-město',
        'district.plzen_sever': 'Plzeň-sever',
        'district.prachatice': 'Prachatice',
        'district.praha_vychod': 'Praha-východ',
        'district.praha_zapad': 'Praha-západ',
        'district.prerov': 'Přerov',
        'district.pribram': 'Příbram',
        'district.prostejov': 'Prostějov',
        'district.rakovnik': 'Rakovník',
        'district.rokycany': 'Rokycany',
        'district.rychnov_nad_kneznou': 'Rychnov nad Kněžnou',
        'district.semily': 'Semily',
        'district.sokolov': 'Sokolov',
        'district.strakonice': 'Strakonice',
        'district.sumperk': 'Šumperk',
        'district.svitavy': 'Svitavy',
        'district.tabor': 'Tábor',
        'district.tachov': 'Tachov',
        'district.teplice': 'Teplice',
        'district.trebic': 'Třebíč',
        'district.trutnov': 'Trutnov',
        'district.uherske_hradiste': 'Uherské Hradiště',
        'district.usti_nad_labem': 'Ústí nad Labem',
        'district.usti_nad_orlici': 'Ústí nad Orlicí',
        'district.vsetin': 'Vsetín',
        'district.vyskov': 'Vyškov',
        'district.zdar_nad_sazavou': 'Žďár nad Sázavou',
        'district.zlin': 'Zlín',
        'district.znojmo': 'Znojmo',
        
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
        'btn.multiplayer': '👥 Multiplayer Mode',
        
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
        'region.czech_regions': 'České kraje',
        'region.select_region': 'Vyber kraj...',
        
        // Czech Regions
        'region.praha': 'Praha',
        'region.stredocesky_kraj': 'Středočeský kraj',
        'region.jihocesky_kraj': 'Jihočeský kraj',
        'region.plzeňsky_kraj': 'Plzeňský kraj',
        'region.karlovarsky_kraj': 'Karlovarský kraj',
        'region.ústecky_kraj': 'Ústecký kraj',
        'region.liberecky_kraj': 'Liberecký kraj',
        'region.kralovehradecky_kraj': 'Královéhradecký kraj',
        'region.pardubicky_kraj': 'Pardubický kraj',
        'region.kraj_vysocina': 'Kraj Vysočina',
        'region.jihomoravsky_kraj': 'Jihomoravský kraj',
        'region.olomoucky_kraj': 'Olomoucký kraj',
        'region.zlinsky_kraj': 'Zlínský kraj',
        'region.moravskoslezsky_kraj': 'Moravskoslezský kraj',
        
        // Czech Districts
        'region.czech_districts': 'České okresy',
        'region.select_district': 'Vyber okres...',
        'district.benesov': 'Benešov',
        'district.beroun': 'Beroun',
        'district.blansko': 'Blansko',
        'district.breclav': 'Břeclav',
        'district.brno_mesto': 'Brno-město',
        'district.brno_venkov': 'Brno-venkov',
        'district.bruntal': 'Bruntál',
        'district.ceska_lipa': 'Česká Lípa',
        'district.ceske_budejovice': 'České Budějovice',
        'district.cesky_krumlov': 'Český Krumlov',
        'district.cheb': 'Cheb',
        'district.chomutov': 'Chomutov',
        'district.chrudim': 'Chrudim',
        'district.decin': 'Děčín',
        'district.domazlice': 'Domažlice',
        'district.frydek_mistek': 'Frýdek-Místek',
        'district.havlickuv_brod': 'Havlíčkův Brod',
        'district.hodonin': 'Hodonín',
        'district.hradec_kralove': 'Hradec Králové',
        'district.jablonec_nad_nisou': 'Jablonec nad Nisou',
        'district.jesenik': 'Jeseník',
        'district.jicin': 'Jičín',
        'district.jihlava': 'Jihlava',
        'district.jindrichuv_hradec': 'Jindřichův Hradec',
        'district.karlovy_vary': 'Karlovy Vary',
        'district.karvina': 'Karviná',
        'district.kladno': 'Kladno',
        'district.klatovy': 'Klatovy',
        'district.kolin': 'Kolín',
        'district.kromeriz': 'Kroměříž',
        'district.kutna_hora': 'Kutná Hora',
        'district.liberec': 'Liberec',
        'district.litomerice': 'Litoměřice',
        'district.louny': 'Louny',
        'district.melnik': 'Mělník',
        'district.mlada_boleslav': 'Mladá Boleslav',
        'district.most': 'Most',
        'district.nachod': 'Náchod',
        'district.novy_jicin': 'Nový Jičín',
        'district.nymburk': 'Nymburk',
        'district.olomouc': 'Olomouc',
        'district.opava': 'Opava',
        'district.ostrava_mesto': 'Ostrava-město',
        'district.pardubice': 'Pardubice',
        'district.pelhrimov': 'Pelhřimov',
        'district.pisek': 'Písek',
        'district.plzen_jih': 'Plzeň-jih',
        'district.plzen_mesto': 'Plzeň-město',
        'district.plzen_sever': 'Plzeň-sever',
        'district.prachatice': 'Prachatice',
        'district.praha_vychod': 'Praha-východ',
        'district.praha_zapad': 'Praha-západ',
        'district.prerov': 'Přerov',
        'district.pribram': 'Příbram',
        'district.prostejov': 'Prostějov',
        'district.rakovnik': 'Rakovník',
        'district.rokycany': 'Rokycany',
        'district.rychnov_nad_kneznou': 'Rychnov nad Kněžnou',
        'district.semily': 'Semily',
        'district.sokolov': 'Sokolov',
        'district.strakonice': 'Strakonice',
        'district.sumperk': 'Šumperk',
        'district.svitavy': 'Svitavy',
        'district.tabor': 'Tábor',
        'district.tachov': 'Tachov',
        'district.teplice': 'Teplice',
        'district.trebic': 'Třebíč',
        'district.trutnov': 'Trutnov',
        'district.uherske_hradiste': 'Uherské Hradiště',
        'district.usti_nad_labem': 'Ústí nad Labem',
        'district.usti_nad_orlici': 'Ústí nad Orlicí',
        'district.vsetin': 'Vsetín',
        'district.vyskov': 'Vyškov',
        'district.zdar_nad_sazavou': 'Žďár nad Sázavou',
        'district.zlin': 'Zlín',
        'district.znojmo': 'Znojmo',
        
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
        'btn.multiplayer': '👥 Hra pro více hráčů',
        
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
    const langSelector2 = document.getElementById('languageSelect2');
    if (langSelector2) {
        langSelector2.value = currentLanguage;
    }
    
    // Update HTML lang attribute
    document.documentElement.lang = currentLanguage;
}

// Get current language
function getCurrentLanguage() {
    return currentLanguage;
}

// Expose functions globally
window.initI18n = initI18n;
window.t = t;
window.setLanguage = setLanguage;
window.getCurrentLanguage = getCurrentLanguage;
window.updatePageLanguage = updatePageLanguage;

// Export functions for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { t, setLanguage, getCurrentLanguage, initI18n };
}
