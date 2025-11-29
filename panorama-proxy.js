/**
 * Panorama API Proxy Wrapper
 * Intercepts Panorama API calls and routes them through our proxy server
 */

// Store original XMLHttpRequest
const OriginalXHR = window.XMLHttpRequest;

// Create proxy XMLHttpRequest
window.XMLHttpRequest = function() {
    const xhr = new OriginalXHR();
    const originalOpen = xhr.open;
    
    // Intercept open() to modify URLs
    xhr.open = function(method, url, ...args) {
        // Check if this is a Mapy.cz API call
        if (typeof url === 'string') {
            const originalUrl = url;
            
            // Replace all Mapy.cz API domains with our proxy
            url = url.replace('https://api.mapy.cz/', '/api/mapy/');
            url = url.replace('http://api.mapy.cz/', '/api/mapy/');
            url = url.replace('https://mapserver.mapy.cz/', '/api/mapy/');
            url = url.replace('http://mapserver.mapy.cz/', '/api/mapy/');
            
            if (url !== originalUrl) {
                console.log('🔄 Proxying XHR:', url);
            }
        }
        
        return originalOpen.call(this, method, url, ...args);
    };
    
    return xhr;
};

// Also intercept fetch if Panorama uses it
const originalFetch = window.fetch;
window.fetch = function(url, ...args) {
    if (typeof url === 'string') {
        const originalUrl = url;
        
        // Replace all Mapy.cz API domains with our proxy
        url = url.replace('https://api.mapy.cz/', '/api/mapy/');
        url = url.replace('http://api.mapy.cz/', '/api/mapy/');
        url = url.replace('https://mapserver.mapy.cz/', '/api/mapy/');
        url = url.replace('http://mapserver.mapy.cz/', '/api/mapy/');
        
        if (url !== originalUrl) {
            console.log('🔄 Proxying fetch:', url);
        }
    }
    
    return originalFetch.call(this, url, ...args);
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
