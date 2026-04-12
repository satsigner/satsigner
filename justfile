# SatSigner Development Commands

mobile := "apps/mobile"

# Remove node_modules, native dirs, reinstall deps, and prebuild
clean-workspace:
    @echo "🧹 Step 1: Removing all node_modules..."
    rm -rf node_modules
    rm -rf {{mobile}}/node_modules
    @echo "✅ node_modules removed"

    @echo ""
    @echo "🧹 Step 1.1: Deleting android and ios folders..."
    rm -rf {{mobile}}/android
    rm -rf {{mobile}}/ios
    @echo "✅ android and ios folders deleted"

    @echo ""
    @echo "📦 Step 2: Installing dependencies with pnpm..."
    pnpm install
    @echo "✅ Dependencies installed"

    @echo ""
    @echo "🔨 Step 3: Running expo prebuild --clean in {{mobile}}..."
    cd {{mobile}} && pnpm expo prebuild --clean
    @echo "✅ Expo prebuild complete"

    @echo ""
    @echo "🎉 Workspace clean done. Fresh state."
    @echo "You might also want to delete the satsigner app on your emulator/simulator before running the app again."
