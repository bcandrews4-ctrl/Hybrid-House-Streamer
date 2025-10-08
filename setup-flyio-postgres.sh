#!/bin/bash
# Setup script for deploying to fly.io with PostgreSQL

set -e

echo "🚀 Setting up Hybrid House Streamer on Fly.io with PostgreSQL"
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
echo "🗄️  Step 2: Create PostgreSQL database"
DB_NAME="${APP_NAME}-db"
read -p "Create a new Postgres database named '$DB_NAME'? (y/n): " create_db

if [ "$create_db" = "y" ] || [ "$create_db" = "Y" ]; then
    echo "Creating Postgres database..."
    fly postgres create --name $DB_NAME --region iad --initial-cluster-size 1 --vm-size shared-cpu-1x --volume-size 1
    echo "✅ Database created"
    
    echo ""
    echo "🔗 Step 3: Attach database to app"
    fly postgres attach --app $APP_NAME $DB_NAME
    echo "✅ Database attached (DATABASE_URL set automatically)"
else
    echo "⚠️  Skipping database creation"
    echo "⚠️  WARNING: Without DATABASE_URL set, your data will be lost on restarts!"
    echo ""
    read -p "Do you have an existing database to attach? (y/n): " attach_existing
    if [ "$attach_existing" = "y" ] || [ "$attach_existing" = "Y" ]; then
        read -p "Enter the name of your existing Postgres app: " existing_db
        fly postgres attach --app $APP_NAME $existing_db
        echo "✅ Database attached"
    fi
fi

echo ""
echo "🔐 Step 4: Set Basic Auth (optional but recommended)"
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
echo "🚀 Step 5: Deploy the app"
read -p "Deploy now? (y/n): " deploy_now

if [ "$deploy_now" = "y" ] || [ "$deploy_now" = "Y" ]; then
    fly deploy --app $APP_NAME
    echo ""
    echo "✅ Deployment complete!"
    echo ""
    echo "🌐 Your app is available at: https://${APP_NAME}.fly.dev"
    echo ""
    echo "📊 Useful commands:"
    echo "   fly logs --app $APP_NAME          - View logs"
    echo "   fly status --app $APP_NAME        - Check status"
    echo "   fly ssh console --app $APP_NAME   - SSH into container"
    echo "   fly secrets list --app $APP_NAME  - View secrets"
    echo ""
    echo "🔍 Check the logs to verify database connection:"
    echo "   You should see: '✅ PostgreSQL configured - data will persist'"
else
    echo ""
    echo "📝 To deploy later, run: fly deploy --app $APP_NAME"
fi

echo ""
echo "✅ Setup complete!"
