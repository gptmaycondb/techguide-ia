# /atualizar-docs — Atualizar CLAUDE.md

Sincroniza o CLAUDE.md com o estado atual do projeto.
Use após reindexar, adicionar modelo ou fazer mudanças arquiteturais.

## Passo 1 — Coletar contagens reais do search_index

```bash
# Chunks por chave (ordenado por quantidade)
jq 'to_entries | map({key: .key, chunks: (.value | length)}) | sort_by(-.chunks)' \
  assets/search_index.json
```

## Passo 2 — Coletar contagens do error_codes_index

```bash
# Total de códigos
jq 'keys | length' assets/error_codes_index.json

# Entradas por modelo (service_key)
jq '[.[] | .[0].key] | group_by(.) | map({model: .[0], entries: length}) | sort_by(-.entries)' \
  assets/error_codes_index.json
```

## Passo 3 — Listar modelos registrados

```bash
grep -E "^\s+id:|brand:|indexKey:|searchKeys:" src/data.js | paste - - - -
```

## Passo 4 — Tamanhos dos arquivos de índice

```bash
ls -lh assets/search_index.json assets/error_codes_index.json
```

## Passo 5 — Atualizar CLAUDE.md

Com os dados coletados, atualizar as seguintes seções:

### Tabela "Manuais atuais indexados"
Atualizar coluna **Chunks** com os valores do Passo 1.
Atualizar tamanhos de arquivo na coluna Fonte se mudaram.

### Linha do error_codes_index em Arquitetura
Atualizar tamanho e contagem de entradas.

### Seção "Reindexar do zero"
Verificar se todos os modelos listados em data.js têm comandos gdown documentados.
Adicionar comandos faltantes para modelos novos.

## O que NÃO alterar

- Procedimentos e regras (apenas dados/contagens mudam automaticamente)
- Seção "Melhorias planejadas"
- Seção "Parsers de erro por marca"
- Qualquer texto narrativo

## Ao finalizar

Mostrar um diff resumido das linhas alteradas antes de salvar.
Commitar com:
```bash
git add CLAUDE.md
git commit -m "docs: sincronizar CLAUDE.md com estado atual dos índices"
```
