# RENALGUARD AI - Cloudflare Deployment Guide

This guide provides step-by-step instructions for deploying RENALGUARD AI to Cloudflare infrastructure.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Account Setup](#account-setup)
3. [Database Setup (Neon)](#database-setup-neon)
4. [Cloudflare Hyperdrive Setup](#cloudflare-hyperdrive-setup)
5. [Frontend Deployment (Pages)](#frontend-deployment-pages)
6. [Backend Deployment (Containers)](#backend-deployment-containers)
7. [MCP Server Deployment](#mcp-server-deployment)
8. [Environment Variables](#environment-variables)
9. [Domain Configuration](#domain-configuration)
10. [Verification](#verification)
11. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before starting, ensure you have:

- **Node.js 20+** installed locally
- **Docker** installed for local container builds
- **Git** for version control
- **Wrangler CLI** installed: `npm install -g wrangler`
- A **Cloudflare account** (free tier available)
- A **Neon account** for PostgreSQL (free tier available)
- An **Anthropic API key** for Claude AI features

---

## Account Setup

### 1. Create Cloudflare Account

1. Go to [cloudflare.com](https://cloudflare.com) and sign up
2. Verify your email address
3. Navigate to **Workers & Pages** in the dashboard
4. Note your **Account ID** from the right sidebar

### 2. Create Cloudflare API Token

1. Go to **My Profile** > **API Tokens**
2. Click **Create Token**
3. Use the **Edit Cloudflare Workers** template
4. Add permissions:
   - **Account** > **Cloudflare Pages** > **Edit**
   - **Account** > **Workers Scripts** > **Edit**
   - **Zone** > **Zone** > **Read** (if using custom domain)
5. Save the token securely

### 3. Create Neon Account

1. Go to [neon.tech](https://neon.tech) and sign up
2. Create a new project named `renalguard-production`
3. Select a region close to your expected user base
4. Note the connection string from the dashboard

---

## Database Setup (Neon)

### 1. Create Database

Neon automatically creates a default database. You can use it or create a new one:

```sql
-- Optional: Create dedicated database
CREATE DATABASE renalguard;
```

### 2. Get Connection String

From the Neon dashboard, copy your connection string:

```
postgresql://USER:PASSWORD@ep-xxx-yyy.us-east-1.aws.neon.tech/neondb?sslmode=require
```

### 3. Run Database Migrations

```bash
# Clone the repository
git clone <repository-url>
cd renalguard

# Set database URL
export DATABASE_URL="postgresql://USER:PASSWORD@ep-xxx.neon.tech/neondb?sslmode=require"

# Install dependencies
cd backend
npm install

# Run migrations
npm run migrate
# Or manually: node runMigration.js
```

### 4. Seed Initial Data (Optional)

```bash
# Populate with demo patients
curl -X POST http://localhost:3000/api/init/populate
```

---

## Cloudflare Hyperdrive Setup

Hyperdrive accelerates database connections from Cloudflare edge locations.

### 1. Install Wrangler

```bash
npm install -g wrangler

# Authenticate with Cloudflare
wrangler login
```

### 2. Create Hyperdrive Configuration

```bash
wrangler hyperdrive create renalguard-db \
  --connection-string="postgresql://USER:PASSWORD@ep-xxx.neon.tech/neondb?sslmode=require"
```

### 3. Note the Hyperdrive ID

The command will output a Hyperdrive ID like `abc123-def456-...`. Save this for later use.

---

## Frontend Deployment (Pages)

### 1. Create Cloudflare Pages Project

```bash
cd frontend

# Create the project (first time only)
wrangler pages project create renalguard-frontend

# Or via dashboard:
# Workers & Pages > Create application > Pages > Connect to Git
```

### 2. Configure Build Settings

In the Cloudflare dashboard or `wrangler.toml`:

| Setting | Value |
|---------|-------|
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | `frontend` |
| Node.js version | `20` |

### 3. Set Environment Variables

In the Cloudflare Pages dashboard > Settings > Environment variables:

```
VITE_API_URL = https://renalguard-backend.<account>.cloudflare.dev
```

### 4. Deploy

```bash
cd frontend

# Build locally
npm run build

# Deploy to Cloudflare Pages
wrangler pages deploy dist --project-name=renalguard-frontend
```

### 5. Verify Deployment

Your frontend will be available at:
- Production: `https://renalguard-frontend.pages.dev`
- Preview: `https://<commit-hash>.renalguard-frontend.pages.dev`

---

## Backend Deployment (Containers)

### 1. Build Docker Image

```bash
# From project root
docker build -t renalguard-backend:latest -f Dockerfile .
```

### 2. Push to Cloudflare Container Registry

```bash
# Login to Cloudflare registry
docker login registry.cloudflare.com \
  --username <ACCOUNT_ID> \
  --password <API_TOKEN>

# Tag the image
docker tag renalguard-backend:latest \
  registry.cloudflare.com/<ACCOUNT_ID>/renalguard-backend:latest

# Push the image
docker push registry.cloudflare.com/<ACCOUNT_ID>/renalguard-backend:latest
```

### 3. Deploy Container

Currently, Cloudflare Containers deployment is done via the dashboard or API:

1. Go to **Workers & Pages** > **Containers**
2. Click **Create Container**
3. Select your pushed image
4. Configure:
   - Memory: 512 Mi
   - CPU: 0.5
   - Port: 3000
5. Add environment variables (see below)
6. Deploy

### 4. Configure Container Environment

Set these environment variables in the container settings:

```
NODE_ENV = production
PORT = 3000
DATABASE_URL = <Hyperdrive connection string>
ANTHROPIC_API_KEY = <your Anthropic API key>
MCP_SERVER_URL = https://renalguard-mcp-server.<account>.cloudflare.dev
CORS_ORIGIN = https://renalguard-frontend.pages.dev
```

---

## MCP Server Deployment

### 1. Build MCP Server Image

```bash
cd mcp-server
docker build -t renalguard-mcp-server:latest .
```

### 2. Push to Registry

```bash
docker tag renalguard-mcp-server:latest \
  registry.cloudflare.com/<ACCOUNT_ID>/renalguard-mcp-server:latest

docker push registry.cloudflare.com/<ACCOUNT_ID>/renalguard-mcp-server:latest
```

### 3. Deploy Container

1. Go to **Workers & Pages** > **Containers**
2. Create new container with the MCP server image
3. Configure:
   - Memory: 256 Mi
   - CPU: 0.25
   - Port: 3001
   - **Internal only** (not publicly accessible)
4. Add environment variables:

```
NODE_ENV = production
MCP_SERVER_PORT = 3001
DATABASE_URL = <Hyperdrive connection string>
```

---

## Environment Variables

### Required Secrets

Set these in the Cloudflare dashboard or via Wrangler:

```bash
# Database
wrangler pages secret put DATABASE_URL --project-name=renalguard-frontend
# Enter: postgresql://... or hyperdrive://...

# AI Service
wrangler pages secret put ANTHROPIC_API_KEY --project-name=renalguard-frontend
# Enter: sk-ant-api03-...

# Neon API (for MCP server)
wrangler pages secret put NEON_API_KEY --project-name=renalguard-frontend
# Enter: napi_...
```

### Using the Setup Script

Alternatively, use the provided setup script:

```bash
# First, create backend/.dev.vars with your credentials
cp backend/.dev.vars.example backend/.dev.vars
# Edit backend/.dev.vars with your values

# Source the variables
source backend/.dev.vars

# Run the setup script
./scripts/setup-cloudflare-secrets.sh
```

### Complete Environment Variable Reference

| Variable | Service | Required | Description |
|----------|---------|----------|-------------|
| `DATABASE_URL` | Backend, MCP | Yes | PostgreSQL connection string |
| `ANTHROPIC_API_KEY` | Backend | Yes | Claude AI API key |
| `NEON_API_KEY` | MCP Server | No | Neon management API key |
| `MCP_SERVER_URL` | Backend | Yes | URL to MCP server |
| `CORS_ORIGIN` | Backend | Yes | Allowed frontend origins |
| `VITE_API_URL` | Frontend | Yes | Backend API URL |
| `STRIPE_SECRET_KEY` | Backend | No | Stripe payments |
| `RESEND_API_KEY` | Backend | No | Email notifications |
| `UPSTASH_REDIS_REST_URL` | Backend | No | Redis caching |

---

## Domain Configuration

### Custom Domain for Pages

1. Go to **Pages** > **renalguard-frontend** > **Custom domains**
2. Click **Set up a custom domain**
3. Enter your domain (e.g., `app.renalguard.com`)
4. Add the provided DNS records to your domain registrar:
   - CNAME: `app` -> `renalguard-frontend.pages.dev`

### Custom Domain for Containers

1. Go to **Workers & Pages** > **Containers** > **Your container**
2. Navigate to **Custom domains**
3. Add your domain (e.g., `api.renalguard.com`)

---

## Verification

### 1. Test Frontend

```bash
# Visit your Pages URL
curl -I https://renalguard-frontend.pages.dev
# Should return 200 OK
```

### 2. Test Backend API

```bash
# Health check
curl https://renalguard-backend.<account>.cloudflare.dev/health
# Should return: {"status":"ok","timestamp":"..."}

# API endpoint
curl https://renalguard-backend.<account>.cloudflare.dev/api/patients
```

### 3. Test Database Connection

```bash
# Via backend health endpoint with database check
curl https://renalguard-backend.<account>.cloudflare.dev/health?db=true
```

### 4. Test MCP Server

The MCP server should be accessible only from the backend container:

```bash
# From backend container logs, verify MCP connection
# Look for: "Connected to MCP server successfully"
```

---

## Troubleshooting

### Common Issues

#### 1. Database Connection Fails

**Symptoms**: Backend logs show "ECONNREFUSED" or "timeout"

**Solutions**:
- Verify DATABASE_URL is correct
- Check Neon project is active (not suspended)
- Ensure Hyperdrive is configured correctly
- Try direct connection first, then Hyperdrive

```bash
# Test direct connection
psql "postgresql://USER:PASS@ep-xxx.neon.tech/neondb?sslmode=require"
```

#### 2. CORS Errors

**Symptoms**: Browser console shows "Access-Control-Allow-Origin" errors

**Solutions**:
- Update CORS_ORIGIN to match your frontend URL exactly
- Include both http and https if needed
- For multiple origins, use comma-separated values

```
CORS_ORIGIN=https://renalguard-frontend.pages.dev,https://app.renalguard.com
```

#### 3. Container Won't Start

**Symptoms**: Container status shows "Failed" or "CrashLoopBackOff"

**Solutions**:
- Check container logs in Cloudflare dashboard
- Verify all required environment variables are set
- Ensure Docker image builds successfully locally
- Check memory/CPU limits are sufficient

```bash
# Test locally first
docker run -e NODE_ENV=production -e PORT=3000 renalguard-backend:latest
```

#### 4. Frontend Can't Reach Backend

**Symptoms**: API calls fail with network errors

**Solutions**:
- Verify VITE_API_URL is set correctly during build
- Check backend container is running and healthy
- Verify CORS is configured correctly
- Check backend URL includes protocol (https://)

#### 5. Anthropic API Errors

**Symptoms**: AI features return 401 or "invalid API key"

**Solutions**:
- Verify ANTHROPIC_API_KEY is set correctly
- Check API key hasn't expired
- Ensure key has correct permissions
- Check Anthropic API status

#### 6. Slow Database Queries

**Symptoms**: Requests timeout or take >5 seconds

**Solutions**:
- Enable Hyperdrive for connection pooling
- Check Neon compute is scaled appropriately
- Add database indexes for slow queries
- Consider upgrading Neon plan

### Useful Commands

```bash
# View Wrangler logs
wrangler pages deployment tail --project-name=renalguard-frontend

# List Pages deployments
wrangler pages deployment list --project-name=renalguard-frontend

# Rollback to previous deployment
wrangler pages deployment rollback --project-name=renalguard-frontend

# Check Hyperdrive status
wrangler hyperdrive get renalguard-db

# Test secret is set
wrangler pages secret list --project-name=renalguard-frontend
```

### Getting Help

- **Cloudflare Status**: [cloudflarestatus.com](https://www.cloudflarestatus.com)
- **Neon Status**: [neonstatus.com](https://neonstatus.com)
- **Cloudflare Community**: [community.cloudflare.com](https://community.cloudflare.com)
- **Wrangler Docs**: [developers.cloudflare.com/workers/wrangler](https://developers.cloudflare.com/workers/wrangler)

---

## Next Steps

After successful deployment:

1. **Configure monitoring**: Set up Cloudflare Analytics
2. **Enable caching**: Configure Cloudflare CDN caching rules
3. **Set up alerts**: Configure health check alerts
4. **Enable backups**: Ensure Neon automatic backups are enabled
5. **Review security**: Enable Cloudflare WAF if needed

---

*Last Updated: January 2026*
