#!/bin/bash

# Enhanced Codecov upload script with retry logic
# Handles rate limiting and network issues gracefully

set -e

# Configuration
MAX_RETRIES=5
BASE_DELAY=10
MAX_DELAY=300
COVERAGE_FILE="./coverage/lcov.info"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Function to calculate exponential backoff delay
calculate_delay() {
    local attempt=$1
    local delay=$((BASE_DELAY * (2 ** (attempt - 1))))
    if [ $delay -gt $MAX_DELAY ]; then
        delay=$MAX_DELAY
    fi
    echo $delay
}

# Function to upload to Codecov with retries
upload_with_retry() {
    local attempt=1
    
    while [ $attempt -le $MAX_RETRIES ]; do
        print_status "$YELLOW" "Attempt $attempt/$MAX_RETRIES: Uploading coverage to Codecov..."
        
        if [ -n "$CODECOV_TOKEN" ]; then
            # Use token-based upload
            if npx codecov -f "$COVERAGE_FILE" -t "$CODECOV_TOKEN" -F unittests -n "llm-router-coverage"; then
                print_status "$GREEN" "✅ Coverage uploaded successfully on attempt $attempt"
                return 0
            fi
        else
            # Fallback to tokenless upload (for local development)
            print_status "$YELLOW" "⚠️  No CODECOV_TOKEN found, attempting tokenless upload..."
            if npx codecov -f "$COVERAGE_FILE" -F unittests -n "llm-router-coverage"; then
                print_status "$GREEN" "✅ Coverage uploaded successfully on attempt $attempt"
                return 0
            fi
        fi
        
        if [ $attempt -eq $MAX_RETRIES ]; then
            print_status "$RED" "❌ Failed to upload coverage after $MAX_RETRIES attempts"
            return 1
        fi
        
        local delay=$(calculate_delay $attempt)
        print_status "$YELLOW" "⏳ Upload failed, retrying in ${delay}s..."
        sleep $delay
        
        attempt=$((attempt + 1))
    done
}

# Main execution
print_status "$YELLOW" "🚀 Starting Codecov upload process..."

# Check if coverage file exists
if [ ! -f "$COVERAGE_FILE" ]; then
    print_status "$RED" "❌ Coverage file not found: $COVERAGE_FILE"
    print_status "$YELLOW" "💡 Make sure to run 'npm run test:ci' first to generate coverage"
    exit 1
fi

# Check file size
file_size=$(wc -c < "$COVERAGE_FILE")
if [ $file_size -eq 0 ]; then
    print_status "$RED" "❌ Coverage file is empty: $COVERAGE_FILE"
    exit 1
fi

print_status "$GREEN" "✅ Coverage file found: $COVERAGE_FILE (${file_size} bytes)"

# Install codecov if not available
if ! command -v npx &> /dev/null; then
    print_status "$RED" "❌ npx not found. Please install Node.js and npm"
    exit 1
fi

# Attempt upload with retry logic
if upload_with_retry; then
    print_status "$GREEN" "🎉 Coverage upload completed successfully!"
    exit 0
else
    print_status "$RED" "💥 Coverage upload failed after all retry attempts"
    print_status "$YELLOW" "💡 This might be due to:"
    print_status "$YELLOW" "   - Network connectivity issues"
    print_status "$YELLOW" "   - Codecov service rate limiting"
    print_status "$YELLOW" "   - Missing or invalid CODECOV_TOKEN"
    print_status "$YELLOW" "   - Repository not properly configured on Codecov"
    exit 1
fi 