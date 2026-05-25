#!/bin/bash
# Script de build para Render (ambiente Linux)
set -e

echo "=== Building Backend ==="
npm run build:backend

echo "=== Installing Frontend Dependencies ==="
cd frontend
npm install

echo "=== Building Frontend ==="
npm run build
cd ..

echo "=== Build Complete ==="
