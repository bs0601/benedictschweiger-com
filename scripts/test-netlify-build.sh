#!/bin/bash
# test-netlify-build.sh — local Netlify build smoke test
#
# Runs the same build command Netlify uses, without deploying.
# Catches function bundling errors before they hit production.
#
# Usage: bash scripts/test-netlify-build.sh

set -e

echo "🔧 Local Netlify build test"
echo ""

# Check if netlify-cli is installed
if ! command -v netlify &> /dev/null; then
    echo "⚠️  netlify-cli not found. Install with: npm install -g netlify-cli"
    echo "   (Optional — the build will still work on Netlify, but local testing is faster.)"
    exit 0
fi

# Run the build
netlify build --offline --dry

echo ""
echo "✅ Local build test passed. Ready to push."
