#!/bin/bash
set -euo pipefail

# Só executa em sessões remotas (Claude Code on the web)
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

echo "=== TechGuide IA — setup da sessão ==="

# Instalar dependências Node se necessário
if [ ! -d node_modules ] || [ package.json -nt node_modules/.package-lock.json ]; then
  echo "→ Instalando dependências npm..."
  npm install
else
  echo "→ node_modules ok (sem alterações)"
fi

echo "=== Setup concluído ==="
