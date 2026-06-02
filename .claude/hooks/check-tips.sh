#!/bin/bash
set -euo pipefail

# Recebe JSON do PostToolUse no stdin
FILE=$(jq -r '.tool_input.file_path // empty' 2>/dev/null)

# Só age em edições ao tips.js
[[ "$FILE" != *"tips.js" ]] && exit 0

# Dicas brand:'ricoh' sem model: que citam equipamentos específicos → contaminação cruzada
HITS=$(grep "brand: 'ricoh'" "$FILE" | grep -v "model:" | grep -cE "IM C[0-9]|MP C[0-9]|imc[0-9]|mpc[0-9]" || true)

if [ "$HITS" -gt 0 ]; then
  echo '{"systemMessage":"⚠️ tips.js: dica Ricoh sem model: menciona equipamento específico — rode /audit"}'
fi
