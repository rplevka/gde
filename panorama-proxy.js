/**
 * Panorama API Proxy Wrapper
 * Intercepts Panorama API calls and routes them through our proxy server
 */

// Rewrite Mapy.cz API URLs to our proxy prefix. Single regex, no per-request logging
// (tile fetches run up to 8 concurrent; console.log there costs devtools + alloc).
function rewriteMapyUrl(url) {
    return url.replace(/^https?:\/\/(api|mapserver)\.mapy\.cz\//, '/api/mapy/');
}

// Patch XMLHttpRequest.prototype.open once (preserves prototype, constants,
// instanceof). Library JSON path uses fetch, so this is a fallback.
const origXhrOpen = XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open = function (method, url, ...args) {
    if (typeof url === 'string') {
        url = rewriteMapyUrl(url);
    }
    return origXhrOpen.call(this, method, url, ...args);
};

// Also intercept fetch (library fast path: fetch(tileUrl)->blob->createImageBitmap).
// Handles string URLs and Request objects.
const originalFetch = window.fetch.bind(window);
window.fetch = function (input, ...args) {
    if (typeof input === 'string') {
        input = rewriteMapyUrl(input);
    } else if (input instanceof Request) {
        const rewritten = rewriteMapyUrl(input.url);
        if (rewritten !== input.url) {
            input = new Request(rewritten, input);
        }
    }
    return originalFetch(input, ...args);
};

// Intercept Image loading (panorama tiles might use this)
const OriginalImage = window.Image;
window.Image = function() {
    const img = new OriginalImage();
    const originalSrcDescriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
    
    Object.defineProperty(img, 'src', {
        get: function() {
            return originalSrcDescriptor.get.call(this);
        },
        set: function(url) {
            if (typeof url === 'string') {
                // Replace Mapy.cz API domains
                url = url.replace('https://api.mapy.cz/', '/api/mapy/');
                url = url.replace('http://api.mapy.cz/', '/api/mapy/');
                url = url.replace('https://mapserver.mapy.cz/', '/api/mapy/');
                url = url.replace('http://mapserver.mapy.cz/', '/api/mapy/');
            }
            return originalSrcDescriptor.set.call(this, url);
        }
    });
    
    return img;
};

console.log('✅ Panorama API proxy initialized (XHR, Fetch, Image)');
