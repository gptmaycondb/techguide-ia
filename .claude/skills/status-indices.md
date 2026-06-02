# /status-indices — Saúde dos Índices JSON

Verifica o estado dos JSONs de índice sem ler o conteúdo.
Economiza 82k tokens vs. ler os dois arquivos completos.

## Instruções

Use apenas Bash com jq — **nunca Read nos arquivos JSON**.

```bash
# Tamanho dos arquivos
ls -lh assets/search_index.json assets/error_codes_index.json

# Chaves e contagem de chunks do search_index
jq 'to_entries | map({key: .key, chunks: (.value | length)}) | sort_by(-.chunks)' \
  assets/search_index.json

# Total de entradas no error_codes_index
jq 'keys | length' assets/error_codes_index.json

# Distribuição por modelo (error_codes_index)
jq '[.[] | .[0].key] | group_by(.) | map({model: .[0], count: length}) | sort_by(-.count)' \
  assets/error_codes_index.json

# Verificar se há chaves em data.js sem entrada no search_index
```

```bash
# Extrair searchKeys de data.js e verificar quais estão no índice
KEYS=$(grep -oP "(?<=indexKey: ')[^']+" src/data.js)
for k in $KEYS; do
  COUNT=$(jq --arg k "$k" '.[$k] | length // 0' assets/search_index.json)
  echo "$k: $COUNT chunks"
done
```

## Output

Exibir tabela com:

| Chave de índice | Chunks | Status |
|-----------------|--------|--------|
| ricoh_imc3000_service | 1763 | ✅ |
| ... | ... | ... |

Marcar com ⚠️ qualquer chave com 0 chunks ou ausente.
Marcar com ❌ qualquer modelo em `data.js` sem entrada no `search_index.json`.
