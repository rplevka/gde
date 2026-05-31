// challenge.js - District/Region Challenge Mode
const ChallengeMode = (() => {
    let state = {
        type: null,
        mode: null,
        queue: [],
        currentIndex: 0,
        results: [],
        settings: { showFill: true },
        status: 'idle',
        saveFailed: false
    };

    function shuffle(arr) {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    function getStorageKey(type) {
        return `gde_challenge_${type || state.type}`;
    }

    function sanitizeRestoredData(data) {
        // Reconstruct with explicit property copying (prototype pollution safe)
        const safe = Object.create(null);
        safe.type = typeof data.type === 'string' ? data.type : null;
        safe.mode = typeof data.mode === 'string' ? data.mode : null;
        safe.currentIndex = typeof data.currentIndex === 'number' ? data.currentIndex : 0;
        safe.queue = Array.isArray(data.queue) ? data.queue.filter(k => typeof k === 'string') : [];
        safe.results = Array.isArray(data.results)
            ? data.results.map(r => ({
                key: typeof r.key === 'string' ? r.key : '',
                score: typeof r.score === 'number' ? r.score : 0,
                correct: r.correct === true,
                guessLocation: (r.guessLocation && typeof r.guessLocation.lat === 'number' && typeof r.guessLocation.lon === 'number')
                    ? { lat: r.guessLocation.lat, lon: r.guessLocation.lon }
                    : { lat: 0, lon: 0 }
            }))
            : [];
        safe.settings = (data.settings && typeof data.settings === 'object')
            ? { showFill: data.settings.showFill !== false }
            : { showFill: true };
        return safe;
    }

    return {
        isActive() {
            return state.status === 'active';
        },

        getStatus() {
            return state.status;
        },

        getType() {
            return state.type;
        },

        getMode() {
            return state.mode;
        },

        getSettings() {
            return { ...state.settings };
        },

        setSetting(key, value) {
            if (typeof key !== 'string') return;
            state.settings[key] = value;
            this.save();
        },

        async start(type, mode) {
            if (typeof loadBoundaryIndex !== 'function' || typeof REGIONS === 'undefined') {
                throw new Error('Challenge: required globals not available');
            }
            state.type = type;
            state.mode = mode;
            state.currentIndex = 0;
            state.results = [];

            await loadBoundaryIndex();
            const index = boundaryIndex;
            let keys = [];
            if (type === 'districts') {
                keys = (index.districts || []).map(d => d.key);
            } else {
                keys = (index.regions || []).map(r => r.key);
            }

            if (keys.length === 0) {
                state.status = 'idle';
                throw new Error(`No ${type} found in boundary index`);
            }

            state.queue = shuffle(keys);
            state.status = 'active';
            this.save();
        },

        getCurrentTarget() {
            if (state.status !== 'active') return null;
            if (state.currentIndex >= state.queue.length) return null;
            const key = state.queue[state.currentIndex];
            const region = REGIONS[key];
            if (!region) return null;
            return {
                key,
                name: region.name,
                name_cz: region.name_cz,
                bounds: region.bounds,
                paths: region.paths,
                file: region.file
            };
        },

        submitResult(guessLocation, score) {
            if (state.status !== 'active') return null;
            if (state.currentIndex >= state.queue.length) return null;

            // Defensive: ensure guessLocation is valid
            if (!guessLocation || typeof guessLocation.lat !== 'number' || typeof guessLocation.lon !== 'number') {
                guessLocation = { lat: 0, lon: 0 };
            }
            if (typeof score !== 'number') score = 0;

            const key = state.queue[state.currentIndex];
            const region = REGIONS[key];

            let correct = false;
            if (region && region.paths) {
                for (const path of region.paths) {
                    if (isPointInPolygon(guessLocation.lat, guessLocation.lon, path)) {
                        correct = true;
                        break;
                    }
                }
            }

            const result = { key, score, correct, guessLocation: { lat: guessLocation.lat, lon: guessLocation.lon } };
            state.results.push(result);
            state.currentIndex++;

            if (state.currentIndex >= state.queue.length) {
                state.status = 'complete';
            }

            this.save();

            const i18nKey = `region.${key}`;
            const translated = typeof t === 'function' ? t(i18nKey) : key;
            const targetName = translated !== i18nKey ? translated :
                ((typeof currentLanguage !== 'undefined' && currentLanguage === 'cs' && region && region.name_cz) ? region.name_cz : (region ? region.name : key));

            return { correct, targetKey: key, targetName };
        },

        getProgress() {
            const correctCount = state.results.filter(r => r.correct).length;
            const totalScore = state.results.reduce((sum, r) => sum + (typeof r.score === 'number' ? r.score : 0), 0);
            return {
                currentIndex: state.currentIndex,
                total: state.queue.length,
                correctCount,
                totalScore,
                results: [...state.results],
                isComplete: state.status === 'complete'
            };
        },

        drawBoundariesOnMap(map, showFill) {
            if (!state.queue.length) return;

            for (const key of state.queue) {
                const region = REGIONS[key];
                if (!region || !region.paths) continue;

                region.paths.forEach(path => {
                    L.polyline(path, {
                        color: '#888',
                        weight: 1,
                        opacity: 0.4,
                        interactive: false
                    }).addTo(map);
                });
            }

            if (showFill) {
                this.drawCompletedFills(map);
            }
        },

        drawCompletedFills(map) {
            for (const result of state.results) {
                const region = REGIONS[result.key];
                if (!region || !region.paths) continue;

                const color = result.correct ? '#4caf50' : '#f44336';
                const fillOpacity = result.correct ? 0.25 : 0.15;

                region.paths.forEach(path => {
                    L.polygon(path, {
                        color: color,
                        fillColor: color,
                        fillOpacity: fillOpacity,
                        weight: 1,
                        opacity: 0.6,
                        interactive: false
                    }).addTo(map);
                });
            }
        },

        drawResultBoundary(map, targetKey) {
            const region = REGIONS[targetKey];
            if (!region || !region.paths) return;

            region.paths.forEach(path => {
                L.polygon(path, {
                    color: '#667eea',
                    fillColor: '#667eea',
                    fillOpacity: 0.1,
                    weight: 3,
                    opacity: 0.8,
                    interactive: false
                }).addTo(map);
            });
        },

        save() {
            try {
                localStorage.setItem(getStorageKey(), JSON.stringify({
                    type: state.type,
                    mode: state.mode,
                    queue: state.queue,
                    currentIndex: state.currentIndex,
                    results: state.results,
                    settings: state.settings
                }));
                state.saveFailed = false;
            } catch (e) {
                console.warn('Failed to save challenge progress:', e);
                state.saveFailed = true;
            }
        },

        isSaveFailed() {
            return !!state.saveFailed;
        },

        resume(type) {
            try {
                const key = getStorageKey(type);
                const saved = localStorage.getItem(key);
                if (!saved) return false;

                const raw = JSON.parse(saved);
                const data = sanitizeRestoredData(raw);

                // Validate data structure
                if (!data.queue.length) return false;
                if (data.currentIndex > data.queue.length) return false;
                if (!data.type || !data.mode) return false;

                // Validate queue keys exist in REGIONS
                const currentKey = data.queue[data.currentIndex < data.queue.length ? data.currentIndex : 0];
                if (!REGIONS[currentKey]) return false;

                state.type = data.type;
                state.mode = data.mode;
                state.queue = data.queue;
                state.currentIndex = data.currentIndex;
                state.results = data.results;
                state.settings = data.settings;
                state.status = data.currentIndex >= data.queue.length ? 'complete' : 'active';
                return true;
            } catch (e) {
                console.warn('Failed to resume challenge:', e);
                return false;
            }
        },

        hasSavedProgress(type) {
            try {
                const key = getStorageKey(type);
                const saved = localStorage.getItem(key);
                if (!saved) return false;
                const data = JSON.parse(saved);
                if (!data || !Array.isArray(data.queue) || typeof data.currentIndex !== 'number') return false;
                return data.currentIndex < data.queue.length;
            } catch (e) {
                return false;
            }
        },

        reset(type) {
            const keyToRemove = type || state.type;
            if (keyToRemove) {
                localStorage.removeItem(getStorageKey(keyToRemove));
            }
            state = {
                type: null, mode: null, queue: [], currentIndex: 0,
                results: [], settings: { showFill: true }, status: 'idle',
                saveFailed: false
            };
        }
    };
})();
