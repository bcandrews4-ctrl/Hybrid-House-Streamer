#!/bin/bash

echo "🚀 GitHub Push Helper"
echo "===================="
echo ""
echo "This script will help you push your code to GitHub"
echo ""

# Check if git is initialized
if [ ! -d ".git" ]; then
    echo "📦 Initializing git repository..."
    git init
    git branch -M main
fi

# Ask for GitHub repository URL if not set
if ! git remote | grep -q "origin"; then
    echo ""
    echo "❓ Enter your GitHub repository URL"
    echo "   Example: https://github.com/yourusername/hybrid-house-streamer.git"
    read -p "   URL: " REPO_URL
    
    if [ -z "$REPO_URL" ]; then
        echo "❌ No URL provided. Exiting."
        exit 1
    fi
    
    echo "🔗 Adding remote repository..."
    git remote add origin "$REPO_URL"
else
    echo "✅ Git remote already configured"
    git remote -v
fi

# Check git status
echo ""
echo "📊 Checking file status..."
git status --short

# Add all files
echo ""
read -p "➕ Add all files? (y/n): " ADD_FILES
if [ "$ADD_FILES" = "y" ]; then
    git add .
    echo "✅ Files added"
fi

# Commit
echo ""
read -p "📝 Enter commit message (or press Enter for default): " COMMIT_MSG
if [ -z "$COMMIT_MSG" ]; then
    COMMIT_MSG="Add PostgreSQL support for persistent storage"
fi

git commit -m "$COMMIT_MSG"

# Push
echo ""
echo "🚀 Pushing to GitHub..."
if git push -u origin main; then
    echo "✅ Successfully pushed to GitHub!"
else
    echo "❌ Push failed. You might need to:"
    echo "   1. Configure git credentials: git config user.name 'Your Name'"
    echo "   2. Configure git email: git config user.email 'your@email.com'"
    echo "   3. Authenticate with GitHub (you may need a Personal Access Token)"
fi

echo ""
echo "✅ Done!"

