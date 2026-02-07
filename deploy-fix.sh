#!/bin/bash

echo "🚀 Deploying Single-Machine Fix for Hybrid House Streamer"
echo "=========================================================="
echo ""

# Check if we're in the right directory
if [ ! -f "fly.toml" ]; then
    echo "❌ Error: fly.toml not found. Please run this script from the project root."
    exit 1
fi

# Deploy the app
echo "📦 Step 1: Deploying updated application..."
fly deploy

if [ $? -ne 0 ]; then
    echo "❌ Deployment failed. Please check the errors above."
    exit 1
fi

echo ""
echo "✅ Deployment successful!"
echo ""

# Enforce single machine
echo "🔒 Step 2: Enforcing single machine..."
fly scale count 1 --max-per-region 1

if [ $? -ne 0 ]; then
    echo "⚠️  Warning: Scale command failed, but app should still work."
    echo "   You can manually run: fly scale count 1 --max-per-region 1"
fi

echo ""
echo "🎉 Deployment Complete!"
echo ""
echo "📊 Checking status..."
fly status

echo ""
echo "✅ All done! Your app should now be:"
echo "   - Always running (no more 503 errors)"
echo "   - Single machine (no swapping)"
echo "   - Instantly accessible"
echo ""
echo "🔗 Test your app: https://hybrid-house-streamer.fly.dev"
echo ""
echo "📝 For more details, see DEPLOY_SINGLE_MACHINE.md"



