# /debug-busca — Simular Pipeline de Busca

Reproduz exatamente o que o ChatScreen faria para uma query num modelo,
sem abrir o app. Útil para diagnosticar respostas ruins ou contaminação entre modelos.

## Uso

```
/debug-query ricoh_mpc3004 "SC541 fusor"
/debug-query mfpe62655 "erro 50 fusor"
/debug-query ricoh_imc3000 "SC543"
```

## Passo 1 — Resolver searchKeys e serviceKey do modelo

```bash
MODEL="<model-id>"
grep -A 20 "id: '$MODEL'" src/data.js | grep -E "indexKey|searchKeys"
```

O `serviceKey` é o primeiro item de `searchKeys` que contém "service".
Se não houver, usa o `indexKey`.

## Passo 2 — Simular searchErrorCode

```bash
# Normalizar query: extrair padrões de código
# HP: XX.YY.ZZ  |  Ricoh IM: SC543  |  Ricoh MP: SC541-00
QUERY="<query>"

# Buscar no error_codes_index pelo serviceKey do modelo
jq --arg q "<código_extraído>" --arg k "<serviceKey>" \
  '[to_entries[] | select(.key | ascii_downcase | contains($q | ascii_downcase))] |
   map(.value[] | select(.key == $k)) |
   .[0:5]' \
  assets/error_codes_index.json

# Se não retornar nada com filtro de modelo, mostrar sem filtro (fallback)
jq --arg q "<código_extraído>" \
  '[to_entries[] | select(.key | ascii_downcase | contains($q | ascii_downcase))] |
   map(.value[]) | .[0:5]' \
  assets/error_codes_index.json
```

## Passo 3 — Simular searchManual (aproximação por keywords)

Para cada chave em `searchKeys`:

```bash
# Extrair tokens da query (palavras > 3 chars, sem stopwords)
# Buscar chunks onde os keywords aparecem
jq --arg k "<search_key>" --arg q "<termo_principal>" \
  '.[$k] | map(select(.k | test($q;"i") or (.t | test($q;"i")))) |
   sort_by(.k | split(" ") | map(if test($q;"i") then 3 else 0 end) | add) |
   reverse | .[0:3] | .[].t' \
  assets/search_index.json
```

## Passo 4 — Exibir resultado simulado

Mostrar:
```
=== DEBUG: <model-id> | "<query>" ===

serviceKey: <serviceKey>
searchKeys: [<lista>]

ERROR CHUNKS (<n> encontrados):
[1] <texto do chunk>
[2] ...

MANUAL CHUNKS (<n> encontrados):
[1] <key: e62655_service> <texto>
[2] ...

TOTAL: <n> chunks → seria enviado ao Claude
CONTAMINAÇÃO: chunks de outros modelos? <sim/não + detalhe>
```

## Passo 5 — Diagnóstico

Identificar o problema:
- **0 chunks**: índice ausente, searchKeys errado, ou query sem match
- **Chunks do modelo errado**: serviceKey não filtrou corretamente → verificar data.js
- **Chunks irrelevantes**: keywords da query muito genéricos → problema no tokenizer
- **Resposta boa mas IA errou**: problema no prompt, não na busca
