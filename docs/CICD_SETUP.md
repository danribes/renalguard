# RENALGUARD CI/CD Setup Guide

This guide covers setting up the CI/CD pipeline for automated deployment to Cloudflare using GitHub Actions.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [GitHub Secrets Configuration](#github-secrets-configuration)
4. [GitHub Variables Configuration](#github-variables-configuration)
5. [Cloudflare Pages Setup](#cloudflare-pages-setup)
6. [Workflow Overview](#workflow-overview)
7. [Manual Deployment](#manual-deployment)
8. [Troubleshooting](#troubleshooting)

---

## Overview

The CI/CD pipeline automates:

- **Linting and testing** on every push and PR
- **Building** frontend, backend, and MCP server
- **Deploying frontend** to Cloudflare Pages
- **Building container images** and pushing to GitHub Container Registry
- **Preview deployments** for pull requests

### Deployment Flow

```
Push to main/master
       │
       ▼
┌─────────────────┐
│  Lint & Test    │
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌────────┐ ┌────────┐ ┌────────────┐
│Frontend│ │Backend │ │MCP Server  │
│ Build  │ │ Build  │ │   Build    │
└───┬────┘ └───┬────┘ └─────┬──────┘
    │          │            │
    ▼          ▼            ▼
┌────────┐ ┌─────────────────────┐
│CF Pages│ │   GitHub Container  │
│ Deploy │ │      Registry       │
└────────┘ └─────────────────────┘
```

---

## Prerequisites

Before setting up CI/CD, ensure you have:

1. A GitHub repository with the RENALGUARD codebase
2. A Cloudflare account with:
   - API Token with Pages and Workers permissions
   - Account ID
3. (Optional) Neon or Supabase database configured

---

## GitHub Secrets Configuration

GitHub Secrets are encrypted environment variables. Configure these in your repository:

**Settings → Secrets and variables → Actions → Secrets → New repository secret**

### Required Secrets

| Secret Name | Description | How to Get |
|-------------|-------------|------------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token for deployments | [Create Token](#creating-cloudflare-api-token) |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID | [Find Account ID](#finding-cloudflare-account-id) |

### Optional Secrets (for full deployment)

| Secret Name | Description | How to Get |
|-------------|-------------|------------|
| `DATABASE_URL` | PostgreSQL connection string | From Neon/Supabase dashboard |
| `ANTHROPIC_API_KEY` | Claude AI API key | [console.anthropic.com](https://console.anthropic.com) |
| `NEON_API_KEY` | Neon API key (if using Neon) | Neon dashboard → API Keys |
| `SUPABASE_ACCESS_TOKEN` | Supabase token (if using Supabase) | Supabase dashboard → Access Tokens |

### Creating Cloudflare API Token

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Click your profile icon → **My Profile**
3. Go to **API Tokens** → **Create Token**
4. Use the **Edit Cloudflare Workers** template or create custom:
   - **Permissions:**
     - Account: Cloudflare Pages: Edit
     - Account: Workers Scripts: Edit
     - Zone: Workers Routes: Edit (if using custom domains)
   - **Account Resources:** Include your account
5. Click **Continue to summary** → **Create Token**
6. Copy the token (you won't see it again!)

### Finding Cloudflare Account ID

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Select any domain or go to **Workers & Pages**
3. Look in the right sidebar for **Account ID**
4. Or find it in the URL: `dash.cloudflare.com/<ACCOUNT_ID>/...`

---

## GitHub Variables Configuration

Variables are non-sensitive configuration values:

**Settings → Secrets and variables → Actions → Variables → New repository variable**

| Variable Name | Description | Example |
|---------------|-------------|---------|
| `BACKEND_URL` | URL of deployed backend API | `https://renalguard-backend.cloudflare.dev` |

---

## Cloudflare Pages Setup

Before the first deployment, create the Pages project:

### Option 1: Via Wrangler CLI

```bash
# Login to Cloudflare
wrangler login

# Create the Pages project
wrangler pages project create renalguard-frontend --production-branch main
```

### Option 2: Via Cloudflare Dashboard

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Click **Workers & Pages** → **Create application** → **Pages**
3. Select **Connect to Git** or **Direct Upload**
4. Name the project: `renalguard-frontend`
5. Configure build settings:
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Root directory:** `frontend`

### Custom Domain (Optional)

1. Go to your Pages project
2. Click **Custom domains** → **Set up a custom domain**
3. Enter your domain (e.g., `app.renalguard.com`)
4. Follow DNS configuration instructions

---

## Workflow Overview

### Triggers

The workflow runs on:

- **Push to main/master:** Full deployment
- **Pull requests:** Preview deployment
- **Manual dispatch:** On-demand deployment

### Jobs

| Job | Description | Runs On |
|-----|-------------|---------|
| `lint-and-test` | Lints and tests all packages | All triggers |
| `build-frontend` | Builds React frontend | After lint-and-test |
| `build-backend` | Builds backend Docker image | After lint-and-test |
| `build-mcp-server` | Builds MCP server Docker image | After lint-and-test |
| `deploy-frontend` | Deploys to Cloudflare Pages | Push to main only |
| `deploy-containers` | Notifies about container deployment | Push to main only |
| `preview-deployment` | Creates PR preview | Pull requests only |

### Container Images

Docker images are pushed to GitHub Container Registry (GHCR):

- **Backend:** `ghcr.io/<owner>/<repo>/renalguard-backend:latest`
- **MCP Server:** `ghcr.io/<owner>/<repo>/renalguard-mcp-server:latest`

To use these images:

```bash
# Pull the images
docker pull ghcr.io/<owner>/<repo>/renalguard-backend:latest
docker pull ghcr.io/<owner>/<repo>/renalguard-mcp-server:latest

# Run locally
docker run -p 3000:3000 ghcr.io/<owner>/<repo>/renalguard-backend:latest
```

---

## Manual Deployment

### Trigger Workflow Manually

1. Go to **Actions** tab in your repository
2. Select **Deploy to Cloudflare** workflow
3. Click **Run workflow**
4. Select branch and environment
5. Click **Run workflow**

### Deploy Frontend Only

```bash
cd frontend

# Build
npm run build

# Deploy to Cloudflare Pages
wrangler pages deploy dist --project-name=renalguard-frontend
```

### Deploy Containers Only

```bash
# Build and push backend
docker build -t ghcr.io/<owner>/<repo>/renalguard-backend:latest .
docker push ghcr.io/<owner>/<repo>/renalguard-backend:latest

# Build and push MCP server
docker build -t ghcr.io/<owner>/<repo>/renalguard-mcp-server:latest ./mcp-server
docker push ghcr.io/<owner>/<repo>/renalguard-mcp-server:latest
```

---

## Troubleshooting

### Common Issues

#### "Error: No account id provided"

**Cause:** `CLOUDFLARE_ACCOUNT_ID` secret is missing or incorrect.

**Solution:**
1. Verify the secret is set in repository settings
2. Check for typos in the secret name
3. Ensure the account ID is correct

#### "Error: Authentication error"

**Cause:** `CLOUDFLARE_API_TOKEN` is invalid or lacks permissions.

**Solution:**
1. Create a new API token with correct permissions
2. Update the secret in repository settings
3. Verify token has Pages Edit permission

#### "Error: Project not found"

**Cause:** Cloudflare Pages project doesn't exist.

**Solution:**
1. Create the project via Wrangler or Dashboard
2. Ensure project name matches (`renalguard-frontend`)

#### Build fails with "npm ci" error

**Cause:** Missing or corrupt package-lock.json.

**Solution:**
```bash
# Regenerate lock files
rm -rf node_modules package-lock.json
npm install
git add package-lock.json
git commit -m "fix: Regenerate package-lock.json"
```

#### Container build fails

**Cause:** Dockerfile or build context issues.

**Solution:**
1. Test build locally: `docker build -t test .`
2. Check Dockerfile syntax
3. Verify all required files are present

### Viewing Logs

1. Go to **Actions** tab
2. Click on the failed workflow run
3. Expand the failed job
4. Click on the failed step to see logs

### Re-running Failed Jobs

1. Go to the failed workflow run
2. Click **Re-run jobs** → **Re-run failed jobs**

---

## Environment Protection Rules

For production deployments, consider adding protection rules:

1. Go to **Settings** → **Environments**
2. Click on **production**
3. Configure:
   - **Required reviewers:** Add team members
   - **Wait timer:** Set delay before deployment
   - **Deployment branches:** Restrict to `main`

---

## Workflow Customization

### Adding Tests

Edit `.github/workflows/cloudflare-deploy.yml`:

```yaml
- name: Run backend tests
  working-directory: backend
  run: npm test

- name: Run frontend tests
  working-directory: frontend
  run: npm test -- --coverage
```

### Adding Notifications

Add Slack/Discord notifications:

```yaml
- name: Notify Slack
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    webhook_url: ${{ secrets.SLACK_WEBHOOK }}
  if: always()
```

### Caching Dependencies

The workflow already uses GitHub's built-in caching. To optimize further:

```yaml
- name: Cache node modules
  uses: actions/cache@v4
  with:
    path: ~/.npm
    key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
    restore-keys: |
      ${{ runner.os }}-node-
```

---

## Security Best Practices

1. **Rotate secrets regularly** - Update API tokens every 90 days
2. **Use environment protection** - Require approvals for production
3. **Limit token permissions** - Only grant necessary permissions
4. **Review Actions logs** - Monitor for suspicious activity
5. **Enable branch protection** - Require PR reviews before merge

---

## Quick Reference

### Required Secrets Checklist

- [ ] `CLOUDFLARE_API_TOKEN` - Cloudflare API token
- [ ] `CLOUDFLARE_ACCOUNT_ID` - Cloudflare account ID

### Useful Commands

```bash
# Check Cloudflare Pages projects
wrangler pages project list

# Check deployment status
wrangler pages deployment list --project-name=renalguard-frontend

# View deployment logs
wrangler pages deployment tail --project-name=renalguard-frontend
```

### Workflow Status Badges

Add to your README.md:

```markdown
![Deploy to Cloudflare](https://github.com/<owner>/<repo>/actions/workflows/cloudflare-deploy.yml/badge.svg)
```

---

*Last Updated: January 2026*
