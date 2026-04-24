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
