#!/usr/bin/env bash
# ساخت APKهای اندروید کارپارت (دو Flavor: mechanic و courier)
# پیش‌نیاز: JDK 21 + Android SDK (compileSdk 35) — مطابق apps/mobile/ANDROID.md
set -euo pipefail

cd "$(dirname "$0")/../apps/mobile"

echo "==> بیلد وب (dist)"
npm run build

echo "==> همگام‌سازی دارایی‌ها با پروژه اندروید (cap sync)"
npx cap sync android

echo "==> ساخت APKها"
cd android
./gradlew --no-daemon assembleMechanicDebug assembleCourierDebug assembleSellerDebug

echo "==> خروجی:"
echo "  app/build/outputs/apk/mechanic/debug/app-mechanic-debug.apk"
echo "  app/build/outputs/apk/courier/debug/app-courier-debug.apk"
echo "  app/build/outputs/apk/seller/debug/app-seller-debug.apk"
echo ""
echo "برای نسخه release (با keystore واقعی):"
echo "  CARPART_KEYSTORE_FILE=... CARPART_KEYSTORE_PASSWORD=... CARPART_KEY_ALIAS=... CARPART_KEY_PASSWORD=... \\"
echo "    ./gradlew assembleMechanicRelease assembleCourierRelease assembleSellerRelease"
