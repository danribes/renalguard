# RENALGUARD AI - Troubleshooting Guide

This guide covers common issues and solutions for both local development and Cloudflare deployment.

## Table of Contents

1. [Local Development Issues](#local-development-issues)
2. [Docker Issues](#docker-issues)
3. [Database Issues](#database-issues)
4. [Cloudflare Deployment Issues](#cloudflare-deployment-issues)
5. [AI/Anthropic Issues](#aianthropic-issues)
6. [MCP Server Issues](#mcp-server-issues)
7. [Frontend Issues](#frontend-issues)
8. [Email/Notification Issues](#emailnotification-issues)

---

## Local Development Issues

### Application Won't Start

**Symptom**: `npm run dev` fails or backend crashes immediately

**Check 1: Node.js version**
```bash
node --version
# Should be v20.x or higher
```

**Check 2: Dependencies installed**
```bash
cd backend && npm install
cd ../frontend && npm install
cd ../mcp-server && npm install
```

**Check 3: Environment variables**
```bash
# Ensure .env file exists
cat .env

# Required variables:
# - DATABASE_URL
# - ANTHROPIC_API_KEY (for AI features)
```

### Port Already in Use

**Symptom**: `EADDRINUSE: address already in use :::3000`

**Solution**:
```bash
# Find and kill the process using the port
lsof -i :3000
kill -9 <PID>

# Or use a different port
PORT=3001 npm run dev
```

### TypeScript Compilation Errors

**Symptom**: Build fails with type errors

**Solution**:
```bash
# Clean and rebuild
rm -rf dist node_modules/.cache
npm run build

# Check TypeScript version
npx tsc --version
# Should match package.json version
```

---

## Docker Issues

### Docker Compose Won't Start

**Symptom**: `docker-compose up` fails

**Check 1: Docker is running**
```bash
docker info
# Should show system information
```

**Check 2: Ports available**
```bash
# Check if ports 3000, 3001, 5432, 8080 are free
lsof -i :3000 -i :3001 -i :5432 -i :8080
```

**Check 3: Clean restart**
```bash
docker-compose down -v
docker-compose up --build
```

### Container Health Check Fails

**Symptom**: Container shows "unhealthy" status

**Diagnosis**:
```bash
# Check container logs
docker-compose logs backend
docker-compose logs mcp-server

# Check health status
docker inspect --format='{{json .State.Health}}' healthcare-backend
```

**Common Causes**:
- Database not ready yet (wait for postgres to be healthy first)
- Missing environment variables
- Port binding issues inside container

### Out of Disk Space

**Symptom**: `no space left on device`

**Solution**:
```bash
# Clean Docker resources
docker system prune -a --volumes

# Remove specific images
docker image prune -a
```

### Build Fails with Network Issues

**Symptom**: `npm install` fails inside Docker with network errors

**Solution**:
```bash
# Use --network=host during build
docker build --network=host -t renalguard-backend .

# Or configure Docker DNS
# Add to /etc/docker/daemon.json:
# {"dns": ["8.8.8.8", "8.8.4.4"]}
```

---

## Database Issues

### Cannot Connect to Database

**Symptom**: `ECONNREFUSED 127.0.0.1:5432` or connection timeout

**Check 1: Database is running**
```bash
# For Docker
docker-compose ps postgres
# Should show "Up" status

# For Neon
# Check neon.tech dashboard for project status
```

**Check 2: Connection string format**
```bash
# Local Docker:
DATABASE_URL=postgresql://healthcare_user:healthcare_pass@localhost:5432/healthcare_ai_db

# Neon (requires SSL):
DATABASE_URL=postgresql://user:pass@ep-xxx.neon.tech/dbname?sslmode=require
```

**Check 3: Network connectivity**
```bash
# Test connection
psql "$DATABASE_URL"

# Or via Node.js
node -e "require('pg').Pool({connectionString: process.env.DATABASE_URL}).query('SELECT 1')"
```

### Migrations Fail

**Symptom**: `relation does not exist` or migration errors

**Solution**:
```bash
# Run migrations in order
cd backend
node runMigration.js

# Check migration status
psql "$DATABASE_URL" -c "SELECT * FROM schema_migrations ORDER BY version;"

# Reset and rerun (DESTRUCTIVE)
psql "$DATABASE_URL" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
node runMigration.js
```

### Slow Queries

**Symptom**: API requests timeout or take >5 seconds

**Diagnosis**:
```bash
# Check slow queries in Neon dashboard
# Or enable query logging locally

# Add to PostgreSQL:
# log_min_duration_statement = 1000
```

**Solutions**:
- Add missing indexes (check EXPLAIN ANALYZE output)
- Use Hyperdrive for Cloudflare deployment
- Upgrade Neon compute size

### Neon Database Suspended

**Symptom**: Connection works initially then fails

**Cause**: Neon suspends inactive databases on free tier

**Solution**:
- Enable "Scale to zero" with longer timeout
- Upgrade to paid plan for always-on compute
- Implement connection retry logic

---

## Cloudflare Deployment Issues

### Pages Deployment Fails

**Symptom**: Wrangler deploy fails or build errors

**Check 1: Build locally first**
```bash
cd frontend
npm run build
# Should complete without errors
```

**Check 2: Correct output directory**
```bash
# Verify dist folder exists and contains index.html
ls frontend/dist/index.html
```

**Check 3: Wrangler authentication**
```bash
wrangler whoami
# Should show your account

# Re-authenticate if needed
wrangler login
```

### Container Won't Start

**Symptom**: Container shows "Failed" in Cloudflare dashboard

**Diagnosis**:
- Check container logs in Cloudflare dashboard
- Review environment variables are set correctly
- Verify image was pushed successfully

**Common Issues**:
```bash
# Missing env vars - container won't start without required config
# Check these are set:
# - DATABASE_URL
# - NODE_ENV
# - PORT

# Image not found - verify push succeeded
docker images | grep renalguard
```

### CORS Errors

**Symptom**: Browser console shows `Access-Control-Allow-Origin` errors

**Solution**:

1. Check CORS_ORIGIN environment variable:
```bash
# Must match exactly (including protocol)
CORS_ORIGIN=https://renalguard-frontend.pages.dev
```

2. For multiple origins:
```bash
CORS_ORIGIN=https://renalguard-frontend.pages.dev,https://app.renalguard.com
```

3. Verify backend CORS middleware:
```javascript
// backend/src/index.ts should have:
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(','),
  credentials: true
}));
```

### Hyperdrive Connection Issues

**Symptom**: Database works locally but fails in Cloudflare

**Check 1: Hyperdrive is configured**
```bash
wrangler hyperdrive list
# Should show renalguard-db
```

**Check 2: Connection string format**
```bash
# Direct connection (for testing):
DATABASE_URL=postgresql://user:pass@ep-xxx.neon.tech/db?sslmode=require

# Hyperdrive connection (for production):
DATABASE_URL=hyperdrive://renalguard-db
```

**Check 3: Hyperdrive caching**
```bash
# Disable caching for debugging
wrangler hyperdrive update renalguard-db --caching=disabled
```

### SSL/TLS Certificate Issues

**Symptom**: `SSL_ERROR_HANDSHAKE_FAILURE` or certificate errors

**For Custom Domains**:
1. Verify DNS is properly configured
2. Wait for SSL certificate provisioning (up to 24 hours)
3. Check Cloudflare SSL/TLS settings (Full or Full (Strict))

---

## AI/Anthropic Issues

### API Key Invalid

**Symptom**: `401 Unauthorized` or `Invalid API key`

**Solutions**:
```bash
# Verify key format
echo $ANTHROPIC_API_KEY | head -c 20
# Should start with: sk-ant-api03-

# Check key is set in environment
grep ANTHROPIC_API_KEY .env

# For Cloudflare, verify secret is set
wrangler pages secret list --project-name=renalguard-frontend
```

### Rate Limiting

**Symptom**: `429 Too Many Requests`

**Solutions**:
- Implement exponential backoff (already in code)
- Reduce concurrent AI requests
- Upgrade Anthropic API tier
- Cache AI responses where appropriate

### Timeout Errors

**Symptom**: AI requests timeout after 30 seconds

**Solutions**:
```javascript
// Increase timeout in doctorAgent.ts
const AI_TIMEOUT = 60000; // 60 seconds

// Or use streaming responses for long operations
```

### Claude Overloaded

**Symptom**: `503 Service Unavailable` or `overloaded_error`

**Solution**: The application already implements retry logic:
- First retry after 2 seconds
- Second retry after 4 seconds
- Third retry after 8 seconds

If persists, check [Anthropic Status](https://status.anthropic.com)

---

## MCP Server Issues

### MCP Server Not Responding

**Symptom**: Backend can't connect to MCP server

**Check 1: MCP server is running**
```bash
# Docker
docker-compose ps mcp-server
# Should show "Up" status

# Check logs
docker-compose logs mcp-server
```

**Check 2: Correct URL configured**
```bash
# For Docker:
MCP_SERVER_URL=http://mcp-server:3001

# For local development:
MCP_SERVER_URL=http://localhost:3001
```

**Check 3: Network connectivity**
```bash
# From backend container
docker-compose exec backend wget -qO- http://mcp-server:3001/health
```

### MCP Tools Not Available

**Symptom**: "Tool not found" errors

**Diagnosis**:
```bash
# Check MCP server logs for tool registration
docker-compose logs mcp-server | grep "Registered tool"
```

**Solution**: Ensure MCP server builds successfully:
```bash
cd mcp-server
npm run build
ls dist/tools/
# Should list all tool files
```

### Database Queries Fail in MCP

**Symptom**: MCP tools return database errors

**Check**: MCP server has correct database configuration:
```bash
# In docker-compose.yml, mcp-server should have:
environment:
  DB_HOST: postgres
  DB_PORT: 5432
  DB_NAME: healthcare_ai_db
  DB_USER: healthcare_user
  DB_PASSWORD: healthcare_pass
```

---

## Frontend Issues

### Blank Page After Deployment

**Symptom**: Frontend loads but shows blank white page

**Check 1: Browser console for errors**
- Open Developer Tools > Console
- Look for JavaScript errors

**Check 2: API URL configured correctly**
```bash
# During build, VITE_API_URL must be set
VITE_API_URL=https://renalguard-backend.example.com npm run build
```

**Check 3: SPA routing configured**
```bash
# Ensure _redirects file exists
cat frontend/public/_redirects
# Should contain: /* /index.html 200
```

### API Requests Fail

**Symptom**: Network errors or 404 on API calls

**Check 1: VITE_API_URL is correct**
```bash
# In browser console:
console.log(import.meta.env.VITE_API_URL)
# Should show your backend URL
```

**Check 2: Backend is accessible**
```bash
curl -I https://your-backend-url/health
# Should return 200 OK
```

### Build Fails

**Symptom**: Vite build errors

**Common Issues**:
```bash
# TypeScript errors
npm run build 2>&1 | grep error

# Out of memory
NODE_OPTIONS=--max-old-space-size=4096 npm run build

# Clear cache
rm -rf node_modules/.vite
npm run build
```

---

## Email/Notification Issues

### Emails Not Sending

**Symptom**: Test emails fail or notifications don't arrive

**Check 1: SMTP configuration**
```bash
# Verify Resend API key is set
echo $RESEND_API_KEY | head -c 10
# Should start with: re_
```

**Check 2: Test email sending**
```bash
curl -X POST http://localhost:3000/api/settings/email/test \
  -H "Content-Type: application/json" \
  -d '{"to": "test@example.com"}'
```

**Check 3: Email service logs**
- Check Resend dashboard for delivery status
- Look for bounces or spam blocks

### Notification Queue Backlog

**Symptom**: Notifications delayed or not processing

**Diagnosis**:
```bash
# Check pending notifications
curl http://localhost:3000/api/notifications/stats
```

**Solution**:
- Restart notification service
- Check for database connection issues
- Increase notification processing frequency

---

## Useful Debugging Commands

### Docker

```bash
# View all logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f backend

# Shell into container
docker-compose exec backend sh

# Check container resources
docker stats
```

### Database

```bash
# Connect to database
docker-compose exec postgres psql -U healthcare_user -d healthcare_ai_db

# Check table sizes
SELECT relname, pg_size_pretty(pg_total_relation_size(relid))
FROM pg_catalog.pg_statio_user_tables
ORDER BY pg_total_relation_size(relid) DESC;

# Check active connections
SELECT * FROM pg_stat_activity WHERE datname = 'healthcare_ai_db';
```

### Cloudflare

```bash
# View deployment logs
wrangler pages deployment tail --project-name=renalguard-frontend

# List secrets
wrangler pages secret list --project-name=renalguard-frontend

# Rollback deployment
wrangler pages deployment rollback --project-name=renalguard-frontend
```

### Network

```bash
# Test backend connectivity
curl -v https://backend-url/health

# Test with detailed timing
curl -w "@curl-format.txt" -o /dev/null -s https://backend-url/api/patients
```

---

## Getting Help

If issues persist:

1. **Check Logs**: Always review logs first
2. **Search Issues**: Check GitHub issues for similar problems
3. **Documentation**: Review relevant docs
4. **Community**: Ask on Cloudflare Community or Stack Overflow
5. **File Issue**: Create a GitHub issue with:
   - Error messages
   - Steps to reproduce
   - Environment details
   - Relevant logs

---

*Last Updated: January 2026*
