#!/usr/bin/env bash
set -e

echo "============================================="
echo "🔍 CadCat Quality & Build Verification"
echo "============================================="

# 1. Version Synchronization Check
echo "📌 [1/4] Verificando sincronización de versiones..."
PKG_VER=$(node -p "require('./package.json').version")
SRC_VER=$(grep "export const APP_VERSION" src/version.ts | sed -E "s/.*'([^']+)'.*/\1/")

if [ "$PKG_VER" != "$SRC_VER" ]; then
  echo "❌ Error de versión: package.json ($PKG_VER) no coincide con src/version.ts ($SRC_VER)"
  exit 1
fi
echo "✅ Versión sincronizada: v$PKG_VER"

# 2. TypeScript Static Typecheck
echo "📌 [2/4] Verificando tipos TypeScript (tsc --noEmit)..."
npx tsc --noEmit
echo "✅ Verificación de tipos exitosa (0 errores)."

# 3. Test Suite (Vitest)
echo "📌 [3/4] Ejecutando suite de pruebas automatizadas..."
npm test
echo "✅ Todas las pruebas unitarias y de integración pasaron."

# 4. Production Build & PWA bundle
echo "📌 [4/4] Verificando compilación de producción y bundle PWA..."
npm run build
echo "✅ Build de producción generado correctamente."

echo "============================================="
echo "🎉 Verificación completa: El proyecto cumple con los estándares mínimos de build y tipos."
echo "============================================="
