#!/bin/bash

echo "========================================"
echo "SafeGram - Git Repository Initialization"
echo "========================================"
echo ""

# Check if git is installed
if ! command -v git &> /dev/null; then
    echo "[ERROR] Git is not installed"
    echo "Please install Git: https://git-scm.com/"
    exit 1
fi

# Check if already a git repository
if [ -d .git ]; then
    echo "[WARNING] This directory is already a git repository"
    echo ""
    read -p "Do you want to continue? (y/n): " continue
    if [ "$continue" != "y" ] && [ "$continue" != "Y" ]; then
        echo "Cancelled."
        exit 0
    fi
fi

echo "[1/4] Initializing git repository..."
git init
if [ $? -ne 0 ]; then
    echo "[ERROR] Failed to initialize git repository"
    exit 1
fi

echo "[2/4] Adding all files..."
git add .
if [ $? -ne 0 ]; then
    echo "[ERROR] Failed to add files"
    exit 1
fi

echo "[3/4] Creating initial commit..."
git commit -m "Initial commit: SafeGram messenger"
if [ $? -ne 0 ]; then
    echo "[ERROR] Failed to create commit"
    exit 1
fi

echo ""
echo "[4/4] Git repository initialized successfully!"
echo ""
echo "Next steps:"
echo "1. Create a repository on GitHub"
echo "2. Add remote: git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git"
echo "3. Push: git push -u origin main"
echo ""
echo "Current branch:"
git branch --show-current
echo ""
echo "Status:"
git status --short
echo ""
