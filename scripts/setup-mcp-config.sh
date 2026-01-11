#!/bin/bash

# Setup Multi-MCP Server Configuration for Claude Desktop
# This script helps configure the three MCP servers: CKD, GitHub, and Filesystem

set -e

echo "========================================="
echo "Multi-MCP Server Configuration Setup"
echo "========================================="
echo ""

# Determine OS and config path
if [[ "$OSTYPE" == "darwin"* ]]; then
    CONFIG_DIR="$HOME/Library/Application Support/Claude"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    CONFIG_DIR="$HOME/.config/Claude"
elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
    CONFIG_DIR="$APPDATA/Claude"
else
    echo "❌ Unsupported OS: $OSTYPE"
    exit 1
fi

CONFIG_FILE="$CONFIG_DIR/claude_desktop_config.json"

echo "📁 Configuration will be written to:"
echo "   $CONFIG_FILE"
echo ""

# Check if Claude Desktop is installed
if [ ! -d "$CONFIG_DIR" ]; then
    echo "⚠️  WARNING: Claude Desktop directory not found!"
    echo "   Please install Claude Desktop first: https://claude.ai/download"
    echo ""
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
    mkdir -p "$CONFIG_DIR"
fi

# Get project root (assuming script is in scripts/)
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🏥 Project root detected: $PROJECT_ROOT"
echo ""

# Verify MCP server build exists
if [ ! -f "$PROJECT_ROOT/mcp-server/dist/index.js" ]; then
    echo "⚠️  MCP server not built yet!"
    echo "   Building now..."
    cd "$PROJECT_ROOT/mcp-server"
    npm install
    npm run build
    cd "$PROJECT_ROOT"
    echo "✅ MCP server built successfully"
fi

# Get GitHub token
echo "🔑 GitHub Personal Access Token Setup"
echo "────────────────────────────────────"
echo "You need a GitHub token with these scopes:"
echo "  ✓ repo (Full control of private repositories)"
echo "  ✓ workflow (Update GitHub Actions)"
echo "  ✓ user (Read user profile data)"
echo ""
echo "Generate token at: https://github.com/settings/tokens/new"
echo ""

read -p "Enter your GitHub Personal Access Token (ghp_...): " GITHUB_TOKEN
if [[ ! $GITHUB_TOKEN =~ ^ghp_ ]]; then
    echo "⚠️  WARNING: Token doesn't start with 'ghp_' - are you sure it's correct?"
fi
echo ""

# Get database URL
echo "🗄️  Database Configuration"
echo "────────────────────────────────────"
echo "Enter your PostgreSQL connection URL"
echo "Format: postgresql://user:password@host:port/database"
echo ""
read -p "Database URL: " -i "postgresql://postgres:postgres@localhost:5432/healthcare_db" -e DATABASE_URL
echo ""

# Verify Node.js installation
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found! Please install Node.js 18+ first."
    echo "   Download: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node --version)
echo "✅ Node.js version: $NODE_VERSION"
echo ""

# Create backup of existing config
if [ -f "$CONFIG_FILE" ]; then
    BACKUP_FILE="$CONFIG_FILE.backup.$(date +%Y%m%d_%H%M%S)"
    echo "📋 Backing up existing config to:"
    echo "   $BACKUP_FILE"
    cp "$CONFIG_FILE" "$BACKUP_FILE"
fi

# Generate configuration
echo "📝 Generating MCP configuration..."
cat > "$CONFIG_FILE" << EOF
{
  "mcpServers": {
    "healthcare-ckd": {
      "command": "node",
      "args": ["$PROJECT_ROOT/mcp-server/dist/index.js"],
      "env": {
        "DATABASE_URL": "$DATABASE_URL",
        "NODE_ENV": "production"
      }
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "$GITHUB_TOKEN"
      }
    },
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "$PROJECT_ROOT/backend",
        "$PROJECT_ROOT/frontend",
        "$PROJECT_ROOT/mcp-server",
        "$PROJECT_ROOT/docs"
      ]
    }
  }
}
EOF

echo "✅ Configuration written successfully!"
echo ""

# Test database connection
echo "🧪 Testing database connection..."
if command -v psql &> /dev/null; then
    if psql "$DATABASE_URL" -c "SELECT 1" &> /dev/null; then
        echo "✅ Database connection successful!"
    else
        echo "⚠️  Database connection failed - please verify DATABASE_URL"
    fi
else
    echo "⚠️  psql not found - skipping database test"
fi
echo ""

# Test GitHub token
echo "🧪 Testing GitHub token..."
if command -v curl &> /dev/null; then
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: token $GITHUB_TOKEN" https://api.github.com/user)
    if [ "$HTTP_STATUS" = "200" ]; then
        GITHUB_USER=$(curl -s -H "Authorization: token $GITHUB_TOKEN" https://api.github.com/user | grep -o '"login":"[^"]*' | cut -d'"' -f4)
        echo "✅ GitHub token valid! Authenticated as: $GITHUB_USER"
    else
        echo "⚠️  GitHub token validation failed (HTTP $HTTP_STATUS)"
    fi
else
    echo "⚠️  curl not found - skipping GitHub test"
fi
echo ""

# Summary
echo "========================================="
echo "✅ Setup Complete!"
echo "========================================="
echo ""
echo "📋 Configuration Summary:"
echo "   • CKD MCP Server: $PROJECT_ROOT/mcp-server/dist/index.js"
echo "   • GitHub MCP Server: @modelcontextprotocol/server-github"
echo "   • Filesystem MCP Server: @modelcontextprotocol/server-filesystem"
echo ""
echo "📚 Next Steps:"
echo "   1. Restart Claude Desktop"
echo "   2. Verify all 3 MCP servers are connected (check status bar)"
echo "   3. Test with prompt: 'List all available MCP tools'"
echo "   4. Try example prompts from: $PROJECT_ROOT/docs/AGENTIC_PROMPTS_LIBRARY.md"
echo ""
echo "📖 Documentation:"
echo "   • Agentic Workflow Guide: $PROJECT_ROOT/docs/AGENTIC_WORKFLOW_GUIDE.md"
echo "   • Prompt Library: $PROJECT_ROOT/docs/AGENTIC_PROMPTS_LIBRARY.md"
echo ""
echo "🔐 Security Reminder:"
echo "   • Your GitHub token is stored in: $CONFIG_FILE"
echo "   • Keep this file secure (never commit to Git!)"
echo "   • Rotate your token every 90 days"
echo ""
