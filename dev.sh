#!/bin/bash

# Function to kill processes on exit
cleanup() {
    echo "Stopping servers..."
    kill $(jobs -p) 2>/dev/null
    exit
}

# Trap signals (Ctrl+C)
trap cleanup SIGINT SIGTERM

# Start Backend (Encore)
echo "Starting Backend..."
./dev.macos &
BACKEND_PID=$!

# Wait for Backend to initialize (optional, adjust sleep if needed)
sleep 2

# Start Frontend (Vite)
echo "Starting Frontend..."
cd apps/frontend
bun run dev &
FRONTEND_PID=$!

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID
