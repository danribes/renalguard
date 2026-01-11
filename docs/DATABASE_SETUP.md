# RENALGUARD Database Setup Guide

This guide covers setting up PostgreSQL databases for RENALGUARD AI using either **Neon** (recommended) or **Supabase**, and configuring **Cloudflare Hyperdrive** for optimal performance.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Option A: Neon Setup (Recommended)](#option-a-neon-setup-recommended)
3. [Option B: Supabase Setup](#option-b-supabase-setup)
4. [Cloudflare Hyperdrive Configuration](#cloudflare-hyperdrive-configuration)
5. [Running Database Migrations](#running-database-migrations)
6. [MCP Server Setup](#mcp-server-setup)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before starting, ensure you have:

- [Node.js 20+](https://nodejs.org/) installed
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) installed (`npm install -g wrangler`)
- A Cloudflare account (for Hyperdrive)
- Either a Neon or Supabase account

---

## Option A: Neon Setup (Recommended)

Neon is a serverless PostgreSQL platform with excellent Cloudflare integration and a generous free tier.

### Step 1: Create Neon Account

1. Go to [neon.tech](https://neon.tech) and sign up
2. Verify your email address

### Step 2: Create a Project

1. Click **"New Project"**
2. Configure:
   - **Project name**: `renalguard-production`
   - **PostgreSQL version**: `16` (recommended)
   - **Region**: Choose closest to your Cloudflare region (e.g., `us-east-1`)
3. Click **"Create Project"**

### Step 3: Get Connection Details

1. Go to your project dashboard
2. Click **"Connection Details"**
3. Copy the connection string (looks like):
   ```
   postgresql://USER:PASSWORD@ep-xxx-xxx-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```

### Step 4: Create a Database

Using the Neon Console SQL Editor or psql:

```sql
-- Create the database (if not using default 'neondb')
CREATE DATABASE renalguard;

-- Connect to the database and verify
\c renalguard
SELECT version();
```

### Step 5: Get API Key (for MCP Server)

1. Go to **Account Settings** → **API Keys**
2. Click **"Create new API Key"**
3. Name it `renalguard-mcp`
4. Copy and save the key securely

### Quick Setup with Neon CLI

Alternatively, use the Neon CLI for automated setup:

```bash
# Install Neon CLI
npm install -g neonctl

# Authenticate
neonctl auth

# Create project
neonctl projects create --name renalguard-production

# Get connection string
neonctl connection-string --project-id <PROJECT_ID>
```

---

## Option B: Supabase Setup

Supabase provides PostgreSQL with additional features like authentication and real-time subscriptions.

### Step 1: Create Supabase Account

1. Go to [supabase.com](https://supabase.com) and sign up
2. Verify your email address

### Step 2: Create a Project

1. Click **"New Project"**
2. Configure:
   - **Project name**: `renalguard-production`
   - **Database password**: Generate a strong password (save it!)
   - **Region**: Choose closest to your Cloudflare region
   - **Pricing plan**: Free tier is sufficient for development
3. Click **"Create new project"**
4. Wait for the project to be provisioned (2-3 minutes)

### Step 3: Get Connection Details

1. Go to **Project Settings** → **Database**
2. Under **Connection string**, select **URI**
3. Copy the connection string:
   ```
   postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
   ```

> **Note**: Use the **pooler** connection string (port 6543) for better performance with Cloudflare.

### Step 4: Get Access Token (for MCP Server)

1. Go to [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens)
2. Click **"Generate new token"**
3. Name it `renalguard-mcp`
4. Copy and save the token securely

---

## Cloudflare Hyperdrive Configuration

Hyperdrive provides connection pooling and caching for your PostgreSQL database, significantly reducing latency from Cloudflare edge.

### Step 1: Login to Cloudflare

```bash
wrangler login
```

### Step 2: Create Hyperdrive Configuration

```bash
# For Neon
wrangler hyperdrive create renalguard-db \
  --connection-string="postgresql://USER:PASSWORD@ep-xxx.neon.tech/renalguard?sslmode=require"

# For Supabase
wrangler hyperdrive create renalguard-db \
  --connection-string="postgresql://postgres.xxx:PASSWORD@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require"
```

### Step 3: Note the Hyperdrive ID

The command will output a Hyperdrive ID like:
```
Created Hyperdrive config renalguard-db with ID abc123def456...
```

Save this ID - you'll need it for environment configuration.

### Step 4: Configure Environment Variables

Update your Cloudflare container configuration:

```toml
# In backend/cloudflare-container.toml or via Cloudflare dashboard
[container.env]
DATABASE_URL = "hyperdrive://abc123def456"  # Your Hyperdrive ID
```

### Step 5: Verify Hyperdrive

```bash
# List your Hyperdrive configurations
wrangler hyperdrive list

# Get details of specific config
wrangler hyperdrive get renalguard-db
```

---

## Running Database Migrations

Once your database is set up, run the RENALGUARD migrations.

### Method 1: Using the Migration Script

```bash
# Set your database URL
export DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require"

# Run migrations
cd backend
node runMigration.js
```

### Method 2: Using psql

```bash
# Connect and run migrations manually
psql $DATABASE_URL

# Run each migration file
\i infrastructure/postgres/migrations/001_initial_schema.sql
\i infrastructure/postgres/migrations/002_...
# ... continue for all migration files
```

### Method 3: Automated with Docker

```bash
# Start only postgres locally for testing
docker-compose up postgres -d

# Run migrations
docker-compose exec backend node runMigration.js
```

### Verify Migrations

```sql
-- Check applied migrations
SELECT * FROM schema_migrations ORDER BY applied_at;

-- Verify table creation
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

---

## MCP Server Setup

The MCP servers allow AI assistants to manage your databases directly.

### Configure MCP Servers

Edit `.claude/mcp-config.json` with your credentials:

```json
{
  "mcpServers": {
    "neon": {
      "command": "npx",
      "args": ["-y", "@neondatabase/mcp-server-neon"],
      "env": {
        "NEON_API_KEY": "neon_api_key_here"
      }
    },
    "supabase": {
      "command": "npx",
      "args": ["-y", "@supabase/mcp-server"],
      "env": {
        "SUPABASE_ACCESS_TOKEN": "supabase_token_here"
      }
    },
    "cloudflare": {
      "command": "npx",
      "args": ["-y", "@cloudflare/mcp-server-cloudflare"],
      "env": {
        "CLOUDFLARE_API_TOKEN": "cloudflare_token_here",
        "CLOUDFLARE_ACCOUNT_ID": "account_id_here"
      }
    }
  }
}
```

### Using Neon MCP Server

Once configured, you can use natural language commands:

- "Create a new Neon branch called 'feature-test'"
- "Run SELECT COUNT(*) FROM patients on the renalguard database"
- "Show me all tables in the renalguard project"
- "Create a database migration for adding a new column"

### Using Supabase MCP Server

- "List all tables in my Supabase project"
- "Run a query to count patients by CKD stage"
- "Generate TypeScript types for my database schema"
- "Show me the database logs from the last hour"

### Using Cloudflare MCP Server

- "Create a new Hyperdrive configuration"
- "List all my Hyperdrive databases"
- "Deploy my Workers application"
- "Show me the status of my Cloudflare Pages deployment"

---

## Troubleshooting

### Connection Issues

**Error: "connection refused"**
- Verify your IP is allowed in database firewall rules
- Check SSL mode is set correctly (`?sslmode=require`)

**Error: "authentication failed"**
- Double-check username and password
- Ensure URL encoding for special characters in password

### Migration Issues

**Error: "relation already exists"**
- Migrations may have partially run
- Check `schema_migrations` table for applied migrations
- Use `--force` flag if safe to re-run

**Error: "permission denied"**
- Verify database user has CREATE/ALTER permissions
- For Neon: Use the default user which has full permissions
- For Supabase: Use the `postgres` user

### Hyperdrive Issues

**Error: "Hyperdrive not found"**
- Verify Hyperdrive ID is correct
- Ensure Hyperdrive is in the same Cloudflare account
- Check Hyperdrive status: `wrangler hyperdrive get <ID>`

**Slow connections**
- Verify Hyperdrive region matches database region
- Check caching is enabled in Hyperdrive config
- Monitor with: `wrangler hyperdrive get <ID> --json`

---

## Quick Reference

### Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | Full PostgreSQL connection string | `postgresql://user:pass@host/db` |
| `NEON_API_KEY` | Neon API key for MCP | `neon_api_xxx` |
| `SUPABASE_ACCESS_TOKEN` | Supabase access token | `sbp_xxx` |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token | `xxx` |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID | `abc123` |
| `HYPERDRIVE_ID` | Cloudflare Hyperdrive config ID | `abc123def456` |

### Useful Commands

```bash
# Neon CLI
neonctl projects list
neonctl branches list --project-id <ID>
neonctl connection-string --project-id <ID>

# Supabase CLI
npx supabase projects list
npx supabase db dump --project-ref <REF>

# Cloudflare Wrangler
wrangler hyperdrive list
wrangler hyperdrive get <ID>
wrangler hyperdrive update <ID> --max-age 120
```

---

## Resources

- [Neon Documentation](https://neon.tech/docs)
- [Neon MCP Server](https://neon.com/docs/ai/neon-mcp-server)
- [Supabase Documentation](https://supabase.com/docs)
- [Supabase MCP Server](https://supabase.com/docs/guides/getting-started/mcp)
- [Cloudflare Hyperdrive](https://developers.cloudflare.com/hyperdrive/)
- [Cloudflare MCP Servers](https://developers.cloudflare.com/agents/model-context-protocol/mcp-servers-for-cloudflare/)

---

*Last Updated: January 2026*
