#!/usr/bin/env bash
set -e

echo "============================================="
echo "🔍 CadCat Quality & Build Verification"
echo "============================================="

# 1. Version Synchronization & Zero-Hardcoding Check
echo "📌 [1/4] Verificando versionado dinámico (Cero Hardcoding)..."
PKG_VER=$(node -p "require('./package.json').version")

if grep -qE "APP_VERSION\s*=\s*['\"][0-9]+" src/version.ts; then
  echo "❌ Error de versionado: src/version.ts contiene una versión hardcodeada. Debe resolverse dinámicamente desde package.json."
  exit 1
fi

echo "✅ Versión canónica: v$PKG_VER (resuelta dinámicamente sin hardcoding)."

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
