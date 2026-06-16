#!/bin/bash
echo ""
echo "🥤 Welcome to Sip Log setup!"
echo "-----------------------------"
echo ""

# Check Node is installed
if ! command -v node &> /dev/null; then
  echo "❌ Node.js is not installed."
  echo "   Please go to https://nodejs.org and install it first, then run this script again."
  exit 1
fi

echo "✅ Node.js found ($(node -v))"

# Install dependencies
echo ""
echo "📦 Installing packages (this takes about 1 minute)..."
npm install

echo ""
echo "🎉 All done! Starting the app now..."
echo ""
echo "👇 A QR code will appear below."
echo "   - iPhone: Open Camera app → point at the QR code"
echo "   - Android: Open Expo Go → tap 'Scan QR code'"
echo ""
echo "   Make sure your phone and computer are on the SAME WiFi!"
echo ""

npx expo start
