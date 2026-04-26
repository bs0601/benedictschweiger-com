#!/bin/bash
# Build script for Netlify
# Build Hugo site
hugo

# Inject Brevo API key from environment variable into the built HTML
if [ ! -z "$BREVO_API_KEY" ]; then
  sed -i "s|var BREVO_API_KEY = \"\"|var BREVO_API_KEY = \"$BREVO_API_KEY\"|" public/index.html
  echo "✓ Brevo API key injected"
else
  echo "⚠ Warning: BREVO_API_KEY environment variable not set"
fi

# Inject Google Client ID into auth-init page
if [ ! -z "$GOOGLE_CLIENT_ID" ]; then
  find public -name "*.html" -exec sed -i "s|GOOGLE_CLIENT_ID_PLACEHOLDER|$GOOGLE_CLIENT_ID|g" {} \;
  echo "✓ Google Client ID injected"
else
  echo "⚠ Warning: GOOGLE_CLIENT_ID environment variable not set"
fi
