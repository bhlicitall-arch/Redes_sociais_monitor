#!/bin/bash
set -e
echo "=== Starting Build ==="

# 1. Build Backend
echo "--- Building Backend ---"
npm run build:backend
echo "Backend build complete"

# 2. Build Frontend
echo "--- Installing Frontend Dependencies ---"
cd frontend
npm install
echo "Frontend deps installed"

echo "--- Building Frontend ---"
npm run build
echo "Frontend build complete"

cd ..
echo "=== Build Complete ==="
