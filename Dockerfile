# Root Dockerfile - Healthcare AI Backend + MCP Server
# This Dockerfile builds both the backend API and MCP server together
# Use this for Render deployment to include MCP server functionality

# Stage 1: Build both backend and MCP server
FROM node:20-alpine AS builder

WORKDIR /app

# Copy MCP server first
COPY mcp-server/package*.json ./mcp-server/
COPY mcp-server/tsconfig.json ./mcp-server/
RUN cd mcp-server && npm ci --prefer-offline --no-audit

# Copy backend
COPY backend/package*.json ./backend/
COPY backend/tsconfig.json ./backend/
RUN cd backend && npm ci --prefer-offline --no-audit

# Copy source code for both
COPY mcp-server/src ./mcp-server/src
COPY backend/src ./backend/src

# Build MCP server
RUN cd mcp-server && npm run build

# Build backend
RUN cd backend && npm run build:backend

# Stage 2: Production
FROM node:20-alpine

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Copy backend package files and install production dependencies
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --only=production --prefer-offline --no-audit && npm cache clean --force

# Copy MCP server package files and install production dependencies
COPY mcp-server/package*.json ./mcp-server/
RUN cd mcp-server && npm ci --only=production --prefer-offline --no-audit && npm cache clean --force

# Copy built files from builder
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/mcp-server/dist ./mcp-server/dist

# Copy migration files and runner scripts
COPY infrastructure/postgres/migrations ./infrastructure/postgres/migrations
COPY backend/autoMigrate.js ./backend/autoMigrate.js
COPY backend/runMigration.js ./backend/runMigration.js
COPY backend/markMigrationsApplied.js ./backend/markMigrationsApplied.js

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Set working directory to backend
WORKDIR /app/backend

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the backend with automatic migrations (which will spawn MCP server as child process)
# autoMigrate.js runs first to apply any pending migrations, then starts the server
CMD ["sh", "-c", "node autoMigrate.js && node dist/index.js"]
