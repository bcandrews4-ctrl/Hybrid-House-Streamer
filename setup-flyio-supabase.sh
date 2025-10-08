#!/bin/bash
# Setup script for deploying to fly.io with Supabase

set -e

echo "🚀 Setting up Hybrid House Streamer on Fly.io with Supabase"
echo ""

# Check if fly CLI is installed
if ! command -v fly &> /dev/null; then
    echo "❌ Fly CLI is not installed. Please install it first:"
    echo "   https://fly.io/docs/hands-on/install-flyctl/"
    exit 1
fi

# Check if user is logged in
if ! fly auth whoami &> /dev/null; then
    echo "❌ You're not logged in to Fly.io"
    echo "Run: fly auth login"
    exit 1
fi

echo "✅ Fly CLI is installed and you're logged in"
echo ""

# Get app name from fly.toml or prompt
APP_NAME="hybrid-house-streamer"
read -p "Enter your app name (default: $APP_NAME): " input_name
if [ ! -z "$input_name" ]; then
    APP_NAME=$input_name
fi

echo ""
echo "📦 Step 1: Create or verify app exists"
if fly apps list | grep -q "$APP_NAME"; then
    echo "✅ App '$APP_NAME' already exists"
else
    echo "Creating app '$APP_NAME'..."
    fly apps create $APP_NAME
    echo "✅ App created"
fi

echo ""
echo "🗄️  Step 2: Set up Supabase"
echo ""
echo "Go to https://supabase.com and:"
echo "  1. Create a new project (or use existing)"
echo "  2. Go to Settings → Database"
echo "  3. Copy the 'Connection string' (URI format)"
echo "  4. Replace [YOUR-PASSWORD] with your database password"
echo ""
echo "The connection string looks like:"
echo "  postgresql://postgres:YOUR-PASSWORD@db.xxxxx.supabase.co:5432/postgres"
echo ""

read -p "Have you created your Supabase project? (y/n): " supabase_ready

if [ "$supabase_ready" != "y" ] && [ "$supabase_ready" != "Y" ]; then
    echo ""
    echo "⚠️  Please create your Supabase project first, then run this script again."
    echo "   Visit: https://supabase.com"
    exit 0
fi

echo ""
read -p "Paste your Supabase connection string: " database_url

if [ -z "$database_url" ]; then
    echo "❌ No connection string provided. Exiting."
    exit 1
fi

# Validate connection string format
if [[ ! $database_url =~ ^postgresql:// ]]; then
    echo "❌ Invalid connection string. It should start with 'postgresql://'"
    exit 1
fi

if [[ $database_url =~ \[YOUR-PASSWORD\] ]]; then
    echo "❌ Please replace [YOUR-PASSWORD] with your actual database password"
    exit 1
fi

echo "Setting DATABASE_URL..."
fly secrets set --app $APP_NAME DATABASE_URL="$database_url"
echo "✅ DATABASE_URL configured"

echo ""
echo "🔐 Step 3: Set Basic Auth (optional but recommended)"
read -p "Do you want to set up basic authentication? (y/n): " setup_auth

if [ "$setup_auth" = "y" ] || [ "$setup_auth" = "Y" ]; then
    read -p "Enter username: " auth_user
    read -s -p "Enter password: " auth_pass
    echo ""
    fly secrets set --app $APP_NAME BASIC_AUTH_USER=$auth_user BASIC_AUTH_PASS=$auth_pass
    echo "✅ Basic auth configured"
else
    echo "⚠️  Skipping basic auth (your app will be publicly accessible)"
fi

echo ""
echo "🚀 Step 4: Deploy the app"
read -p "Deploy now? (y/n): " deploy_now

if [ "$deploy_now" = "y" ] || [ "$deploy_now" = "Y" ]; then
    fly deploy --app $APP_NAME
    echo ""
    echo "✅ Deployment complete!"
    echo ""
    echo "🌐 Your app is available at: https://${APP_NAME}.fly.dev"
    echo ""
    echo "📊 Checking logs for database connection..."
    echo ""
    sleep 5
    fly logs --app $APP_NAME | tail -20
    echo ""
    echo "Look for: '✅ PostgreSQL configured - data will persist'"
    echo ""
    echo "🎯 Useful commands:"
    echo "   fly logs --app $APP_NAME          - View logs"
    echo "   fly status --app $APP_NAME        - Check status"
    echo "   fly ssh console --app $APP_NAME   - SSH into container"
    echo ""
    echo "🗄️  View your data in Supabase:"
    echo "   Dashboard → Table Editor → app_state table"
else
    echo ""
    echo "📝 To deploy later, run: fly deploy --app $APP_NAME"
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "💡 Tips:"
echo "   - Supabase free tier includes 500MB database (plenty for this app!)"
echo "   - Your data is automatically backed up by Supabase"
echo "   - View/edit data in Supabase Table Editor"
echo "   - Export data anytime: curl https://${APP_NAME}.fly.dev/api/export"
