# Build stage
FROM golang:1.21-alpine AS builder

WORKDIR /build

# Copy go files
COPY go.mod ./
COPY go.sum ./
COPY server.go ./
COPY multiplayer.go ./

# Download dependencies
RUN go mod download

# Build the Go binary (include both server.go and multiplayer.go)
RUN go build -o server server.go multiplayer.go

# Runtime stage
FROM alpine:latest

WORKDIR /app

# Copy binary from builder
COPY --from=builder /build/server /app/server

# Copy static files
COPY index.html styles.css app.js i18n.js multiplayer.js panorama-proxy.js regions-boundaries.json ./

# Copy API keys file if it exists (optional, can be mounted as volume or use env vars)
COPY api_keys.example.yaml ./

# Expose port 8000
EXPOSE 8000

# Set API keys via environment variable (override at runtime)
ENV MAPY_API_KEYS=""
ENV PORT=8000
ENV LOG_LEVEL=INFO

# Run the Go server
CMD ["/app/server"]
