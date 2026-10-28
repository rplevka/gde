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

// NOTE: No Image interceptor. Library fast path is
// fetch(tileUrl)->blob()->createImageBitmap(), covered by the fetch
// wrapper above; the fallback uses `new Image` only where fetch/
// createImageBitmap is unavailable. A global window.Image override
// would break `new Image(w,h)` args and instanceof while adding a
// per-instance src descriptor lookup on the tile path.

console.log('✅ Panorama API proxy initialized (XHR, Fetch)');
