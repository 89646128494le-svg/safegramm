#!/bin/bash
# Debug script to check what Vercel sees during build

echo "=== Vercel Build Debug ==="
echo "Current directory: $(pwd)"
echo "Root directory contents:"
ls -la
echo ""
echo "Checking web directory:"
if [ -d "web" ]; then
  echo "web/ exists"
  echo "web/package.json exists: $([ -f web/package.json ] && echo 'YES' || echo 'NO')"
  echo "web/package-lock.json exists: $([ -f web/package-lock.json ] && echo 'YES' || echo 'NO')"
  echo ""
  echo "Checking for @vitejs/plugin-react in package.json:"
  grep -q "@vitejs/plugin-react" web/package.json && echo "FOUND in package.json" || echo "NOT FOUND in package.json"
  echo ""
  echo "Checking node_modules:"
  if [ -d "web/node_modules/@vitejs" ]; then
    echo "web/node_modules/@vitejs exists"
    ls -la web/node_modules/@vitejs/ 2>/dev/null || echo "Cannot list @vitejs"
  else
    echo "web/node_modules/@vitejs NOT FOUND"
  fi
else
  echo "web/ directory NOT FOUND"
fi
