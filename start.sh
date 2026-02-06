#!/bin/bash

echo "🚀 Starting Finance Bill Splitter Application..."
echo ""

# Start the backend server in background
echo "📊 Starting backend server on port 3001..."
npm run server &
SERVER_PID=$!

# Wait a moment for server to start
sleep 2

# Start the frontend dev server
echo "🎨 Starting frontend dev server..."
npm run dev

# Cleanup on exit
trap "kill $SERVER_PID" EXIT
