# RENALGUARD AI - Cloudflare Migration Plan

## Overview

This document outlines the complete migration plan for RENALGUARD AI from Render to Cloudflare infrastructure. The migration includes removing all Render-related code, optimizing containerization for all services, and configuring Cloudflare deployment.

**Migration Date:** January 2026
**Target Platform:** Cloudflare (Pages, Containers, Hyperdrive)
**Database Strategy:** External PostgreSQL (Neon/Supabase) with Cloudflare Hyperdrive

---

## Architecture Overview

### Current Architecture (Render)

```
┌─────────────────────────────────────────────────────────────┐
│                        RENDER.COM                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │    Frontend     │  │    Backend      │  │  PostgreSQL │ │
│  │  (Static Site)  │  │   (Docker)      │  │    (DB)     │ │
│  │                 │  │  + MCP Server   │  │             │ │
│  └─────────────────┘  └─────────────────┘  └─────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Target Architecture (Cloudflare)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            CLOUDFLARE                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │ Cloudflare      │  │ Cloudflare      │  │ Cloudflare      │             │
│  │ Pages           │  │ Containers      │  │ Containers      │             │
│  │                 │  │                 │  │                 │             │
│  │ ┌─────────────┐ │  │ ┌─────────────┐ │  │ ┌─────────────┐ │             │
│  │ │  Frontend   │ │  │ │  Backend    │ │  │ │ MCP Server  │ │             │
│  │ │  (React)    │ │  │ │  (Express)  │ │  │ │ (Clinical)  │ │             │
│  │ └─────────────┘ │  │ └─────────────┘ │  │ └─────────────┘ │             │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘             │
│           │                    │                    │                       │
│           │                    │                    │                       │
│           │                    ▼                    ▼                       │
│           │           ┌─────────────────────────────────┐                   │
│           │           │     Cloudflare Hyperdrive       │                   │
│           │           │   (Connection Pooling)          │                   │
│           │           └─────────────────────────────────┘                   │
│           │                         │                                       │
└───────────┼─────────────────────────┼───────────────────────────────────────┘
            │                         │
            │                         ▼
            │           ┌─────────────────────────────────┐
            │           │   External PostgreSQL           │
            │           │   (Neon / Supabase)             │
            │           │   - PostgreSQL 16               │
            │           │   - Auto-scaling                │
            │           │   - Backups                     │
            │           └─────────────────────────────────┘
            │
            ▼
    ┌─────────────────┐
    │  Global CDN     │
    │  (Static Assets)│
    └─────────────────┘
```

---

## Service Mapping

| Component | Render Service | Cloudflare Service | Container Required |
|-----------|---------------|-------------------|-------------------|
| Frontend | Static Site | Cloudflare Pages | No (static build) |
| Backend API | Web Service (Docker) | Cloudflare Containers | Yes |
| MCP Server | Bundled with Backend | Cloudflare Containers | Yes (new) |
| PostgreSQL | Managed PostgreSQL | External (Neon/Supabase) + Hyperdrive | No |

---

## Phase 1: Remove Render-Related Code

### 1.1 Files to Delete

| File | Description | Action |
|------|-------------|--------|
| `render.yaml` | Render Blueprint configuration | DELETE |
| `RENDER_DATABASE_INIT.sql` | Render database initialization | DELETE |
| `RENDER_DEPLOY_SUMMARY.txt` | Render deployment documentation | DELETE |
| `scripts/init-render-db.sh` | Render database init script | DELETE |
| `scripts/init_render_database.sh` | Render database init script | DELETE |
| `scripts/run_migration_020_render.sh` | Render migration script | DELETE |

### 1.2 Files to Update

| File | Changes Required |
|------|-----------------|
| `README.md` | Remove Render URLs, update Live Demo section, update deployment instructions |
| `infrastructure/postgres/migrations/README_020.md` | Remove Render-specific references |
| `scripts/README_PATIENT_GENERATION.md` | Remove Render references if any |

### 1.3 Code References to Update

Search and update any hardcoded Render URLs:
- `https://ckd-analyzer-backend.onrender.com`
- `https://ckd-analyzer-frontend.onrender.com`
- References to `onrender.com` domain

---

## Phase 2: Containerization

### 2.1 Create MCP Server Dockerfile

**File:** `mcp-server/Dockerfile`

```dockerfile
# MCP Server Dockerfile - Clinical Decision Support Tools
# Multi-stage build for optimized production image

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --prefer-offline --no-audit

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Stage 2: Production
FROM node:20-alpine

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production --prefer-offline --no-audit && \
    npm cache clean --force

# Copy built application
COPY --from=builder /app/dist ./dist

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

# Expose MCP server port (if using HTTP transport)
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "console.log('healthy')" || exit 1

ENTRYPOINT ["dumb-init", "--"]

CMD ["node", "dist/index.js"]
```

### 2.2 Create MCP Server .dockerignore

**File:** `mcp-server/.dockerignore`

```
node_modules
npm-debug.log
dist
.env
.env.*
*.md
.git
.gitignore
.vscode
coverage
.nyc_output
*.test.ts
*.spec.ts
__tests__
```

### 2.3 Update Backend Dockerfile

**File:** `backend/Dockerfile` - Optimize for Cloudflare Containers

Changes:
- Add environment variable for MCP server connection
- Optimize layer caching
- Add Cloudflare-specific health check endpoint

### 2.4 Update Root Dockerfile

**File:** `Dockerfile` - Combined Backend + MCP Server

Changes:
- Optimize for Cloudflare container registry
- Update health check for Cloudflare
- Add proper labels for container management

### 2.5 Update docker-compose.yml

**File:** `docker-compose.yml`

Add MCP server as separate service:

```yaml
services:
  postgres:
    # ... existing config ...

  backend:
    # ... existing config ...
    environment:
      MCP_SERVER_URL: http://mcp-server:3001
    depends_on:
      - postgres
      - mcp-server

  mcp-server:
    build:
      context: ./mcp-server
      dockerfile: Dockerfile
    container_name: healthcare-mcp-server
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      NODE_ENV: production
      DB_HOST: postgres
      DB_PORT: 5432
      DB_NAME: healthcare_ai_db
      DB_USER: healthcare_user
      DB_PASSWORD: healthcare_pass
    ports:
      - "3001:3001"
    healthcheck:
      test: ["CMD-SHELL", "node -e \"console.log('healthy')\""]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 20s
    networks:
      - healthcare-network

  frontend:
    # ... existing config ...
```

### 2.6 Update docker-compose.dev.yml

Add development configuration for MCP server with hot reload.

### 2.7 Add Root .dockerignore

**File:** `.dockerignore` (root level)

```
.git
.gitignore
*.md
docs/
.env
.env.*
node_modules
coverage
.nyc_output
*.log
.vscode
.idea
```

---

## Phase 3: Cloudflare Configuration

### 3.1 Frontend - Cloudflare Pages

**File:** `frontend/wrangler.toml`

```toml
name = "renalguard-frontend"
compatibility_date = "2024-01-01"

[site]
bucket = "./dist"

[env.production]
vars = { ENVIRONMENT = "production" }

[env.preview]
vars = { ENVIRONMENT = "preview" }
```

**File:** `frontend/public/_headers`

```
/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()

/assets/*
  Cache-Control: public, max-age=31536000, immutable
```

**File:** `frontend/public/_redirects`

```
/* /index.html 200
```

### 3.2 Backend - Cloudflare Containers

**File:** `backend/cloudflare-container.toml`

```toml
name = "renalguard-backend"
image = "renalguard-backend:latest"

[env]
NODE_ENV = "production"
PORT = "3000"

[resources]
memory = "512Mi"
cpu = "0.5"

[health_check]
path = "/health"
interval = "30s"
timeout = "5s"
```

### 3.3 MCP Server - Cloudflare Containers

**File:** `mcp-server/cloudflare-container.toml`

```toml
name = "renalguard-mcp-server"
image = "renalguard-mcp-server:latest"

[env]
NODE_ENV = "production"

[resources]
memory = "256Mi"
cpu = "0.25"

[health_check]
interval = "30s"
timeout = "5s"
```

### 3.4 Hyperdrive Configuration

**File:** `infrastructure/cloudflare/hyperdrive.toml`

```toml
# Cloudflare Hyperdrive configuration for PostgreSQL connection pooling
# Create via: wrangler hyperdrive create renalguard-db --connection-string="postgresql://..."

[hyperdrive]
name = "renalguard-db"
# Connection string set via Cloudflare dashboard (secret)
```

### 3.5 Environment Variables

**Cloudflare Dashboard Configuration:**

| Variable | Service | Description |
|----------|---------|-------------|
| `DATABASE_URL` | Backend, MCP Server | Hyperdrive connection string |
| `ANTHROPIC_API_KEY` | Backend | Claude AI API key (secret) |
| `CORS_ORIGIN` | Backend | Frontend Cloudflare Pages URL |
| `VITE_API_URL` | Frontend (build) | Backend container URL |
| `MCP_SERVER_URL` | Backend | MCP server container URL |
| `NODE_ENV` | All | `production` |

---

## Phase 4: Database Migration

### 4.1 PostgreSQL Provider Selection

**Recommended: Neon**

| Feature | Neon | Supabase |
|---------|------|----------|
| Free Tier | 0.5 GB storage, 1 project | 500 MB, 2 projects |
| Auto-scaling | Yes | Limited |
| Branching | Yes (great for dev) | No |
| Serverless | Yes | Pooler mode |
| PostgreSQL Version | 16 | 15 |
| Hyperdrive Support | Yes | Yes |

### 4.2 Database Setup Steps

1. **Create Neon Account**
   - Sign up at https://neon.tech
   - Create new project: `renalguard-production`
   - Select region closest to Cloudflare containers

2. **Configure Database**
   ```sql
   -- Create database (if not auto-created)
   CREATE DATABASE renalguard;
   ```

3. **Run Migrations**
   ```bash
   # Set connection string
   export DATABASE_URL="postgresql://user:pass@ep-xxx.neon.tech/renalguard?sslmode=require"

   # Run migrations
   cd backend
   node runMigration.js
   ```

4. **Configure Hyperdrive**
   ```bash
   # Create Hyperdrive configuration
   wrangler hyperdrive create renalguard-db \
     --connection-string="postgresql://user:pass@ep-xxx.neon.tech/renalguard?sslmode=require"
   ```

5. **Update Application**
   - Backend and MCP server use Hyperdrive connection string
   - Format: `hyperdrive://renalguard-db`

---

## Phase 5: CI/CD Pipeline

### 5.1 GitHub Actions Workflow

**File:** `.github/workflows/cloudflare-deploy.yml`

```yaml
name: Deploy to Cloudflare

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
  CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}

jobs:
  # Job 1: Deploy Frontend to Cloudflare Pages
  deploy-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json

      - name: Install dependencies
        working-directory: frontend
        run: npm ci

      - name: Build frontend
        working-directory: frontend
        env:
          VITE_API_URL: ${{ vars.BACKEND_URL }}
        run: npm run build

      - name: Deploy to Cloudflare Pages
        uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          projectName: renalguard-frontend
          directory: frontend/dist
          gitHubToken: ${{ secrets.GITHUB_TOKEN }}

  # Job 2: Build and Push Backend Container
  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Login to Cloudflare Container Registry
        uses: docker/login-action@v3
        with:
          registry: registry.cloudflare.com
          username: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          password: ${{ secrets.CLOUDFLARE_API_TOKEN }}

      - name: Build and push Backend
        uses: docker/build-push-action@v5
        with:
          context: .
          file: ./Dockerfile
          push: true
          tags: registry.cloudflare.com/${{ secrets.CLOUDFLARE_ACCOUNT_ID }}/renalguard-backend:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max

  # Job 3: Build and Push MCP Server Container
  deploy-mcp-server:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Login to Cloudflare Container Registry
        uses: docker/login-action@v3
        with:
          registry: registry.cloudflare.com
          username: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          password: ${{ secrets.CLOUDFLARE_API_TOKEN }}

      - name: Build and push MCP Server
        uses: docker/build-push-action@v5
        with:
          context: ./mcp-server
          file: ./mcp-server/Dockerfile
          push: true
          tags: registry.cloudflare.com/${{ secrets.CLOUDFLARE_ACCOUNT_ID }}/renalguard-mcp-server:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max

  # Job 4: Deploy Containers (after builds complete)
  deploy-containers:
    needs: [deploy-backend, deploy-mcp-server]
    runs-on: ubuntu-latest
    steps:
      - name: Deploy containers to Cloudflare
        run: |
          echo "Trigger Cloudflare container deployment"
          # Use Cloudflare API to deploy updated containers
          # This step depends on Cloudflare Containers GA API
```

---

## Phase 6: Documentation Updates

### 6.1 Update README.md

- Remove all Render references
- Update Live Demo section with Cloudflare URLs
- Update Quick Start Guide for Cloudflare
- Add Cloudflare-specific environment variables

### 6.2 Create CLOUDFLARE_DEPLOYMENT.md

Step-by-step deployment guide including:
- Cloudflare account setup
- Pages project creation
- Container registry setup
- Hyperdrive configuration
- Environment variable configuration
- Domain configuration

### 6.3 Update Environment Documentation

- Create `.env.example` with Cloudflare variables
- Document required secrets for CI/CD
- Document Hyperdrive connection string format

---

## Task Checklist

### Phase 1: Remove Render Code
- [x] 1.1 Delete `render.yaml`
- [x] 1.2 Delete `RENDER_DATABASE_INIT.sql`
- [x] 1.3 Delete `RENDER_DEPLOY_SUMMARY.txt`
- [x] 1.4 Delete `scripts/init-render-db.sh`
- [x] 1.5 Delete `scripts/init_render_database.sh`
- [x] 1.6 Delete `scripts/run_migration_020_render.sh`
- [x] 1.7 Update `README.md` - remove Render references
- [x] 1.8 Search and update hardcoded Render URLs

### Phase 2: Containerization
- [x] 2.1 Create `mcp-server/Dockerfile`
- [x] 2.2 Create `mcp-server/.dockerignore`
- [x] 2.3 Update `backend/Dockerfile` for Cloudflare
- [x] 2.4 Update root `Dockerfile` for Cloudflare
- [x] 2.5 Update `docker-compose.yml` with MCP server service
- [x] 2.6 Update `docker-compose.dev.yml` with MCP server
- [x] 2.7 Update root `.dockerignore`
- [ ] 2.8 Test local Docker Compose deployment

### Phase 3: Cloudflare Configuration
- [x] 3.1 Create `frontend/wrangler.toml`
- [x] 3.2 Create `frontend/public/_headers`
- [x] 3.3 Create `frontend/public/_redirects`
- [x] 3.4 Create `backend/cloudflare-container.toml`
- [x] 3.5 Create `mcp-server/cloudflare-container.toml`
- [x] 3.6 Create `infrastructure/cloudflare/hyperdrive.toml`
- [x] 3.7 Document environment variables (updated .env.example)

### Phase 4: Database Migration
- [x] 4.1 Add Neon MCP server configuration
- [x] 4.2 Add Supabase MCP server configuration
- [x] 4.3 Add Cloudflare MCP server configuration
- [x] 4.4 Create database setup documentation (`docs/DATABASE_SETUP.md`)
- [ ] 4.5 Create Neon/Supabase account and project (user action required)
- [ ] 4.6 Configure Cloudflare Hyperdrive (user action required)
- [ ] 4.7 Run database migrations (user action required)
- [ ] 4.8 Test database connectivity from containers (user action required)

### Phase 5: CI/CD Pipeline
- [ ] 5.1 Create `.github/workflows/cloudflare-deploy.yml`
- [ ] 5.2 Configure GitHub secrets
- [ ] 5.3 Test deployment pipeline
- [ ] 5.4 Configure branch previews

### Phase 6: Documentation
- [ ] 6.1 Update `README.md` with Cloudflare info
- [ ] 6.2 Create `CLOUDFLARE_DEPLOYMENT.md`
- [ ] 6.3 Update `.env.example`
- [ ] 6.4 Create troubleshooting guide

---

## Deployment URLs (Post-Migration)

| Service | URL Pattern |
|---------|-------------|
| Frontend | `https://renalguard.pages.dev` |
| Backend API | `https://renalguard-backend.<account>.cloudflare.dev` |
| MCP Server | `https://renalguard-mcp.<account>.cloudflare.dev` (internal) |
| Database | Via Hyperdrive (internal) |

---

## Rollback Plan

If issues occur during migration:

1. **Frontend**: Cloudflare Pages maintains previous deployments - instant rollback via dashboard
2. **Backend/MCP**: Container images are tagged - redeploy previous image version
3. **Database**: Neon supports point-in-time recovery and branching

---

## Cost Estimation

| Service | Free Tier | Paid Tier |
|---------|-----------|-----------|
| Cloudflare Pages | Unlimited sites, 500 builds/month | $20/mo for more builds |
| Cloudflare Containers | TBD (new service) | Usage-based |
| Cloudflare Hyperdrive | Included | Included |
| Neon PostgreSQL | 0.5 GB, 1 compute | $19/mo for more |

**Estimated Monthly Cost:** $0 - $50 depending on usage

---

## Timeline

| Phase | Estimated Duration | Dependencies |
|-------|-------------------|--------------|
| Phase 1 | 1-2 hours | None |
| Phase 2 | 2-4 hours | Phase 1 |
| Phase 3 | 2-3 hours | Phase 2 |
| Phase 4 | 1-2 hours | Phase 3 |
| Phase 5 | 2-3 hours | Phase 4 |
| Phase 6 | 1-2 hours | Phase 5 |

**Total Estimated Time:** 9-16 hours

---

## Notes

- Cloudflare Containers is a relatively new service - check current availability and pricing
- Alternative to Containers: Refactor backend to use Hono framework for Workers compatibility
- Hyperdrive significantly improves database connection performance from edge
- Consider Cloudflare R2 for any file storage needs (medical documents, exports)

---

*Last Updated: January 2026*
*Version: 1.0*
