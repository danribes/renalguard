#!/bin/bash
# RENALGUARD - Cloudflare Secrets Setup Script
# This script sets up all environment variables for Cloudflare deployment
#
# USAGE:
# 1. Copy backend/.dev.vars.example to backend/.dev.vars and fill in your credentials
# 2. Source the .dev.vars file: source backend/.dev.vars
# 3. Run this script: ./scripts/setup-cloudflare-secrets.sh
#
# Or set environment variables directly before running this script.

set -e

# Check required environment variables
if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
    echo "ERROR: CLOUDFLARE_API_TOKEN environment variable is required"
    echo "Please set it or source your .dev.vars file first"
    exit 1
fi

if [ -z "$CLOUDFLARE_ACCOUNT_ID" ]; then
    echo "ERROR: CLOUDFLARE_ACCOUNT_ID environment variable is required"
    echo "Please set it or source your .dev.vars file first"
    exit 1
fi

# Project name
PAGES_PROJECT="renalguard-frontend"

echo "================================================"
echo "RENALGUARD - Cloudflare Secrets Setup"
echo "================================================"
echo ""
echo "Account ID: $CLOUDFLARE_ACCOUNT_ID"
echo "Project: $PAGES_PROJECT"
echo ""

# Function to set a secret for Pages
set_pages_secret() {
    local name=$1
    local value=$2
    if [ -n "$value" ]; then
        echo "Setting Pages secret: $name"
        echo "$value" | npx wrangler pages secret put "$name" --project-name="$PAGES_PROJECT" 2>/dev/null || echo "  (Warning: Could not set secret - project may not exist yet)"
    else
        echo "Skipping $name (not set)"
    fi
}

echo ""
echo "================================================"
echo "Setting up secrets..."
echo "================================================"
echo ""

# Database Configuration (Neon)
echo "--- Database (Neon) ---"
set_pages_secret "DATABASE_URL" "$DATABASE_URL"
set_pages_secret "NEON_API_KEY" "$NEON_API_KEY"

# AI Configuration (Anthropic)
echo ""
echo "--- AI (Anthropic) ---"
set_pages_secret "ANTHROPIC_API_KEY" "$ANTHROPIC_API_KEY"

# Email Service (Resend)
echo ""
echo "--- Email (Resend) ---"
set_pages_secret "RESEND_API_KEY" "$RESEND_API_KEY"

# Payment Processing (Stripe)
echo ""
echo "--- Payments (Stripe) ---"
set_pages_secret "STRIPE_PUBLISHABLE_KEY" "$STRIPE_PUBLISHABLE_KEY"
set_pages_secret "STRIPE_SECRET_KEY" "$STRIPE_SECRET_KEY"
set_pages_secret "STRIPE_WEBHOOK_SECRET" "$STRIPE_WEBHOOK_SECRET"
set_pages_secret "STRIPE_LIVE_SECRET_KEY" "$STRIPE_LIVE_SECRET_KEY"
set_pages_secret "STRIPE_LIVE_PUBLISHABLE_KEY" "$STRIPE_LIVE_PUBLISHABLE_KEY"

# Cache (Redis/Upstash)
echo ""
echo "--- Cache (Redis/Upstash) ---"
set_pages_secret "UPSTASH_REDIS_REST_URL" "$UPSTASH_REDIS_REST_URL"
set_pages_secret "UPSTASH_REDIS_REST_TOKEN" "$UPSTASH_REDIS_REST_TOKEN"
set_pages_secret "REDIS_URL" "$REDIS_URL"

# GitHub Integration
echo ""
echo "--- GitHub ---"
set_pages_secret "GITHUB_TOKEN" "$GITHUB_TOKEN"

# LinkedIn OAuth
echo ""
echo "--- LinkedIn OAuth ---"
set_pages_secret "LINKEDIN_CLIENT_ID" "$LINKEDIN_CLIENT_ID"
set_pages_secret "LINKEDIN_CLIENT_SECRET" "$LINKEDIN_CLIENT_SECRET"

# Vercel (if needed)
echo ""
echo "--- Vercel ---"
set_pages_secret "VERCEL_TOKEN" "$VERCEL_TOKEN"

echo ""
echo "================================================"
echo "Secrets setup complete!"
echo "================================================"
echo ""
echo "Note: If secrets failed, ensure the Cloudflare Pages project exists."
echo "Create it with: npx wrangler pages project create $PAGES_PROJECT"
echo ""
echo "To verify secrets were set:"
echo "  npx wrangler pages secret list --project-name=$PAGES_PROJECT"
echo ""
