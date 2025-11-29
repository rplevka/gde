# Build stage
FROM golang:1.21-alpine AS builder

WORKDIR /build

# Copy go files
COPY go.mod ./
COPY server.go ./

# Generate go.sum and download dependencies
RUN go mod tidy && go mod download

# Build the Go binary
RUN go build -o server server.go

# Runtime stage
FROM alpine:latest

WORKDIR /app

# Copy binary from builder
COPY --from=builder /build/server /app/server

# Copy static files
COPY index.html styles.css app.js panorama-proxy.js regions-boundaries.json ./

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
