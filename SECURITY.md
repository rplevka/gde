# Security Guide

## API Key Protection

### The Problem

Client-side JavaScript applications expose all code to users, including API keys. Anyone can:
- Open browser DevTools and view the source code
- Inspect network requests
- Extract API keys from `config.js`

### Solutions

#### Option 1: Backend Proxy (Recommended for Production)

Use the included `server.go` which acts as a high-performance proxy:

**How it works:**
1. API keys are stored server-side (environment variables)
2. Client makes requests to `/api/mapy/*` 
3. Server adds API key and forwards to Mapy.cz
4. Client never sees the actual API key

**Setup with Docker:**

```bash
# Build image
docker build -t gde-game .

# Run with API keys as environment variable
docker run -p 8000:8000 \
  -e MAPY_API_KEYS="key1,key2,key3" \
  gde-game
```

**Setup locally:**

```bash
# Set environment variable
export MAPY_API_KEYS="key1,key2,key3"

# Run server
go run server.go
```

**Client-side changes needed:**
- Remove `config.js` (no longer needed)
- Update API calls to use `/api/mapy/` instead of direct Mapy.cz URLs
- Remove API key from client-side code

#### Option 2: API Key Restrictions (Partial Protection)

If you must use client-side keys, restrict them in the Mapy.cz developer console:

1. **HTTP Referrer Restrictions**: Limit to your domain
2. **IP Address Restrictions**: Limit to specific IPs
3. **Rate Limiting**: Set usage quotas
4. **Separate Keys**: Use different keys for dev/prod

**Limitations:**
- Keys are still visible in source code
- Users can still extract and abuse them
- Only reduces risk, doesn't eliminate it

#### Option 3: Authentication Layer (Most Secure)

For production applications:

1. Implement user authentication
2. Track usage per user
3. Apply rate limiting per user
4. Use backend API with authentication tokens
5. Never expose actual API keys to client

### Recommendations

- **Development**: Use client-side keys with restrictions
- **Production**: Use backend proxy (Option 1)
- **Public/Demo**: Use proxy with rate limiting and monitoring

### Current Implementation

By default, this app uses client-side `config.js` for simplicity. For production:

1. Delete or don't commit `config.js`
2. Use `server.go` with environment variables (or Docker)
3. Client code already uses proxy endpoints via `panorama-proxy.js`
4. Deploy with proper environment variable management
