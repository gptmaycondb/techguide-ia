#!/bin/bash
set -euo pipefail

SCRIPT_DIR=${BASH_SOURCE[0]%/*}
ROOT=$(cd "$SCRIPT_DIR/../.." && pwd)

if [[ $# -gt 0 ]]; then
  FILE=$1
else
  # PostToolUse envia JSON no stdin; fora do hook, passe src/tips.js como argumento.
  FILE=$(jq -r '.tool_input.file_path // empty' 2>/dev/null || true)
fi

[[ "$FILE" != *"tips.js" ]] && exit 0

node - "$FILE" "$ROOT/assets/error_codes_index.json" <<'NODE'
const fs = require('fs');

const tipsPath = process.argv[2];
const indexPath = process.argv[3];
const source = fs.readFileSync(tipsPath, 'utf8');
const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));

const modelKeys = {
  mfpe52645: ['cpmd', 'service'],
  mfpe62655: ['e62655_cpmd', 'e62655_service'],
  ricoh_imc3000: ['ricoh_imc3000_service'],
  ricoh_mpc3004: ['ricoh_mpc3004_service'],
  ricoh_sp3710: ['ricoh_sp3710_service'],
};

const canon = value => value.toUpperCase().replace(/[\s.\-/]/g, '');
const indexedByModel = Object.fromEntries(
  Object.entries(modelKeys).map(([model, keys]) => [
    model,
    new Set(
      Object.entries(index)
        .filter(([, entries]) => entries.some(entry => keys.includes(entry.key)))
        .map(([code]) => canon(code))
    ),
  ])
);

const errors = [];
const tipRe = /\{\s*brand:\s*'([^']+)'(?:,\s*model:\s*'([^']+)')?,\s*text:\s*'([^']*)'\s*\}/g;
const hyphenPartNumberRe = /\b(?=[A-Z0-9-]*[A-Z])(?=[A-Z0-9-]*\d)[A-Z0-9]{2,}-\d[A-Z0-9-]*\b/g;
const compactPartNumberRe = /(?<![A-Z0-9-])[A-Z]{1,3}\d[A-Z0-9]*[A-Z][A-Z0-9]*(?![A-Z0-9-])/g;
const hpSpecificRe = /\b\d{2}\.(?![XWYZ]{1,2}\b)[A-Z0-9]{2}\.(?![XWYZ]{1,2}\b)[A-Z0-9]{2}\b/gi;
const ricohSpecificRe = /\bSC\d{3}(?:-\d{2})?\b/gi;

let match;
let tipNumber = 0;
while ((match = tipRe.exec(source))) {
  tipNumber += 1;
  const [, brand, model, text] = match;

  const partNumbers = [
    ...(text.match(hyphenPartNumberRe) || []),
    ...(text.match(compactPartNumberRe) || []),
  ]
    .filter(value => !/^SC\d{3}(?:-\d{2})?$/i.test(value));
  for (const part of partNumbers) {
    errors.push(`#${tipNumber}: part number específico proibido: ${part}`);
  }

  const codes = [
    ...(text.match(hpSpecificRe) || []),
    ...(text.match(ricohSpecificRe) || []),
  ];
  for (const code of codes) {
    if (!model || !indexedByModel[model]) {
      errors.push(`#${tipNumber}: código específico sem modelo validável: ${code}`);
    } else if (!indexedByModel[model].has(canon(code))) {
      errors.push(`#${tipNumber}: ${code} não existe no índice para ${model}`);
    }
  }

  if (brand === 'ricoh' && !model && /IM C\d|MP C\d|imc\d|mpc\d/i.test(text)) {
    errors.push(`#${tipNumber}: dica Ricoh sem model menciona equipamento específico`);
  }
}

if (errors.length) {
  console.error(`check-tips: ${errors.length} violação(ões)`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`check-tips: ${tipNumber} dicas verificadas, gate OK`);
NODE
