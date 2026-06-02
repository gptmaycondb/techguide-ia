# /ctx — Bootstrap de Sessão (Contexto Mínimo)

Use no início de toda sessão antes de qualquer tarefa.
Carrega apenas o essencial — nunca lê arquivos grandes desnecessariamente.

## ⚠️ Regra de Ouro deste Projeto

**NUNCA use Read em:**
- `assets/search_index.json` (20 MB — 70k tokens)
- `assets/error_codes_index.json` (3.5 MB — 12k tokens)

Para consultar esses arquivos, use sempre `jq` ou `grep` via Bash.

---

## Executar estes comandos (em paralelo)

```bash
# 1. Status git
git log --oneline -5
git status --short

# 2. Modelos registrados
grep -E "^\s+id:" src/data.js

# 3. Índices disponíveis no search_index
jq 'keys' assets/search_index.json

# 4. Saúde dos índices (chunks por chave)
jq 'to_entries | map({key: .key, chunks: (.value | length)}) | sort_by(-.chunks)' assets/search_index.json

# 5. Branch atual e upstream
git branch -vv
```

## Exibir Resumo

Após os comandos, exibir:
- Branch atual e quantos commits à frente/atrás do main
- Lista de modelos (id + brand) com indicação de qual tem searchKeys definido
- Chaves indexadas com contagem de chunks
- Arquivos modificados (git status)

## Não ler nesta fase

- Nenhum arquivo `.js` completo (ler só se uma tarefa específica exigir)
- Nenhum JSON de índice (usar jq para consultas pontuais)
- `build_index.py` (só se a tarefa envolver reindexação)
