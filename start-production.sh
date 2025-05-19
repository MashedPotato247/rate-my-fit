#!/bin/bash

# Startup script for Rate My Fit in production mode

# Check if .env file exists
if [ ! -f .env ]; then
  echo "Error: .env file not found. Please create one based on sample.env"
  exit 1
fi

# Check for required environment variables
source .env
REQUIRED_VARS=("SESSION_SECRET" "FIREBASE_DATABASE_URL" "GOOGLE_APPLICATION_CREDENTIALS")

for var in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!var}" ]; then
    echo "Error: Required environment variable $var is not set"
    exit 1
  fi
done

# Set production environment
export NODE_ENV=production

# Start the server
echo "Starting Rate My Fit in production mode..."
npm start
