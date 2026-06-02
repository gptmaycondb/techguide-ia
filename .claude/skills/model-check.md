# /model-check [model-id] — Validação de Modelo Específico

Valida um único modelo sem executar a auditoria completa.
Use quando só alterou um modelo — economiza ~60% dos tokens do /audit.

## Uso

```
/model-check ricoh_mpc3004
/model-check mfpe62655
/model-check ricoh_imc3000
```

## Instruções

Use grep/jq para extrair apenas as seções relevantes — **nunca ler os arquivos completos**.

### 1. Extrair registro do modelo em data.js

```bash
MODEL_ID="<model-id>"

# Localizar linha de início e extrair o bloco do modelo
grep -n "id: '$MODEL_ID'" src/data.js
```

Depois, ler apenas as linhas do bloco do modelo (Read com offset + limit).

### 2. Verificar MANUAL_INDEX_MAP em search.js

```bash
grep "$MODEL_ID\|$(grep -oP "(?<=indexKey: ')[^']+" <<< '<bloco_modelo>')" src/search.js
```

### 3. Verificar searchKeys no search_index

```bash
# Listar chaves declaradas em searchKeys do modelo
# Para cada chave: verificar se existe no índice e quantos chunks tem
for KEY in <searchKeys do modelo>; do
  jq --arg k "$KEY" '.[$k] | length // "AUSENTE"' assets/search_index.json | \
    sed "s/^/$KEY: /"
done
```

### 4. Verificar dicas do modelo em tips.js

```bash
grep -n "model: '$MODEL_ID'" src/tips.js
```

Checar se:
- Há pelo menos 3 dicas específicas do modelo
- Nenhuma dica genérica da marca menciona este modelo sem `model:` definido

### 5. Verificar BRAND_GROUPS em data.js

```bash
grep -A5 "id: '${MODEL_ID}_group'" src/data.js
```

## Output

```
=== CHECK: <model-id> ===

data.js         ✅ id, brand, indexKey, searchKeys presentes
search.js       ✅ MANUAL_INDEX_MAP contém todas as chaves
search_index    ✅ e62655_guia: 160 chunks | e62655_service: 1094 chunks
tips.js         ✅ 8 dicas específicas (model: 'mfpe62655')
BRAND_GROUPS    ✅ entry encontrada com url preenchida

RESULTADO: ✅ modelo consistente
```
