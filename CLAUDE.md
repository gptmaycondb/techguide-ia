# TechGuide IA — Projeto

App React Native (Expo) de suporte técnico para impressoras HP e Ricoh.
Usa RAG local (índices JSON) + Claude API via backend em `https://manuais-hp.onrender.com`.

## Arquitetura

```
assets/
  manuals/          ← PDFs HP E52645 (guia_e52645, cpmd_2023, service_part1-4) — bundled no app
  search_index.json ← chunks de texto para busca semântica (~14.7 MB)
  error_codes_index.json ← código → descrição do erro (~2.7 MB, 1682 entradas)
scripts/
  build_index.py    ← indexador v2; reprocessa todos os PDFs
src/
  data.js           ← registro de todos os manuais (id, brand, indexKey, searchKeys, prompts)
  search.js         ← searchManual(), searchErrorCode(), hasRelevantContent()
  ChatScreen.js     ← fluxo de chat; monta contexto e chama API
  tips.js           ← ASSISTANT_TIPS[] com dicas por model/brand
  AssistantBubble.js← bolha flutuante; filtra dicas por modelId
```

## Como adicionar um novo modelo

### 1. Registrar o manual em `src/data.js`
Cada manual precisa de:
- `id` único (ex: `'canon_ir2630'`)
- `brand` (ex: `'canon'`)
- `indexKey` — chave primária no search_index.json (ex: `'canon_ir2630_guia'`)
- `searchKeys` — array de todos os índices consultados na busca (ex: `['canon_ir2630_guia', 'canon_ir2630_service']`)
- `topics` — perguntas sugeridas por perfil (user/tech); aparecem como "Sugestões de pesquisa"
- `prompts` — instruções de sistema por perfil (user/tech)

Também adicionar uma entrada do modelo em `BRAND_GROUPS` (usado pela ManualsScreen para
download dos PDFs) com os links do Google Drive.

### 2. Adicionar PDFs em `scripts/build_index.py`
No dicionário `PDF_SOURCES`, adicionar:
```python
'canon_ir2630_service': [Path('/tmp/canon_ir2630_service.pdf')],
'canon_ir2630_guia':    [Path('/tmp/canon_ir2630_guia.pdf')],
```
Se a marca usa formato de código de erro diferente (ex: Canon `Exxx`, Kyocera `C-xxxx`),
adicionar um parser dedicado similar a `extract_ricoh_sc_sections()` ou
`extract_hp_errors_from_cpmd()`.

### 3. Mapear índices em `src/search.js`
Adicionar as chaves do modelo em `MANUAL_INDEX_MAP` (id do manual → índice primário,
e cada índice apontando para si mesmo). Ex:
```javascript
'canon_ir2630':         'canon_ir2630_guia',
'canon_ir2630_guia':    'canon_ir2630_guia',
'canon_ir2630_service': 'canon_ir2630_service',
```

### 4. Reindexar
```bash
# Colocar os PDFs nas paths configuradas, depois:
python3 scripts/build_index.py
```

### 5. Roteamento de busca (já data-driven)
O `ChatScreen.js` usa `manual.searchKeys` diretamente — **não precisa editar o ChatScreen**.
Basta declarar `searchKeys` no `data.js`.
```javascript
// ChatScreen.js — roteamento data-driven
const searchKeys = (manual.searchKeys && manual.searchKeys.length
  ? manual.searchKeys
  : [primaryKey]).filter((v, i, a) => a.indexOf(v) === i);
```

### 6. Dicas do assistente flutuante em `src/tips.js`
Adicionar um bloco de dicas **específicas do modelo** com o campo `model` igual ao `id`
do manual (ex: `model: 'canon_ir2630'`). Sem isso, o modelo mostra apenas as dicas genéricas
da marca + as `general`. Basear as dicas nos manuais reais (part numbers, códigos de erro).
```javascript
{ brand: 'canon', model: 'canon_ir2630', text: 'Erro Exxx no iR2630 indica...' },
```
O filtro em `AssistantBubble.js` seleciona por `model` quando presente, caindo para
`brand` quando a dica não tem `model`. O `App.js` passa `modelId={selectedManualId}`.

---

## Melhorias planejadas (não implementadas)

### A) `scripts/sources.json` — configuração de PDFs externalizada
Em vez de hardcodar `PDF_SOURCES` em `build_index.py`, ler de um JSON:
```json
{
  "canon_ir2630_service": {
    "paths": ["/tmp/canon_ir2630_service.pdf"],
    "parser": "generic",
    "error_prefix": "E"
  },
  "kyocera_ta3212": {
    "paths": ["/tmp/kyocera_ta3212.pdf"],
    "parser": "kyocera",
    "error_prefix": "C-"
  }
}
```
O indexador leria esse arquivo e escolheria o parser correto por `"parser"`.

### B) Tips de placeholder do chat filtradas por marca
O array `TIPS[]` exibido como sugestão na barra de input do `ChatScreen.js` ainda é genérico.
Para múltiplas marcas, organizar por brand e filtrar pelo manual ativo:
```javascript
const TIPS_BY_BRAND = {
  hp:     ['💡 "Como resolver erro 50 no E52645?"', ...],
  ricoh:  ['💡 "O que significa SC 543?"', ...],
  generic:['💡 "Digite o código de erro para diagnóstico"', ...],
};
const TIPS = TIPS_BY_BRAND[manual.brand] || TIPS_BY_BRAND.generic;
```

---

## Parsers de erro por marca (referência)

| Marca   | Formato de código | Parser atual       |
|---------|-------------------|--------------------|
| HP      | `49.XX.YZ`        | `extract_hp_errors_from_cpmd()` |
| Ricoh   | `SC20200`         | `extract_ricoh_sc_sections()` |
| Canon   | `Exxx`, `Fxxx`    | ⚠ não implementado |
| Kyocera | `C-xxxx`          | ⚠ não implementado |
| Xerox   | `xxx-xxx`         | ⚠ não implementado |

Para adicionar um parser novo, seguir o padrão de `extract_ricoh_sc_sections()`:
regex que captura o código + seção de texto até o próximo código.

---

## Manuais atuais indexados

| Key                      | Fonte                                        | Chunks |
|--------------------------|----------------------------------------------|--------|
| `e52645_guia`            | `assets/manuals/guia_e52645.pdf` (bundled)   | 166    |
| `cpmd`                   | `assets/manuals/cpmd_2023.pdf` (bundled)     | 300    |
| `service`                | `assets/manuals/service_part1-4` (bundled)   | 615    |
| `ricoh_imc3000_guia`     | `/tmp/ricoh_guia.pdf` (Google Drive)         | 218    |
| `ricoh_imc3000_service`  | `/tmp/ricoh_service.pdf` (84 MB, Drive)      | 1763   |
| `ricoh_imc3000_parts`    | `/tmp/ricoh_parts.pdf` (Google Drive)        | 10     |
| `e62655_guia`            | `/tmp/e62655_guia.pdf` (Google Drive)        | 160    |
| `e62655_cpmd`            | `/tmp/e62655_cpmd.pdf` (Google Drive)        | 316    |
| `e62655_service`         | `/tmp/e62655_service.pdf` (71 MB, Drive)     | 1094   |

> Os PDFs Ricoh e E62655 estão no Google Drive (IDs em `src/data.js` → `BRAND_GROUPS`).
> Para reindexar, baixar para `/tmp/` com os nomes acima antes de rodar o script.

## Reindexar do zero

```bash
# 1. Baixar PDFs que não estão bundled (Ricoh e HP E62655) para /tmp/
#    IDs do Google Drive estão em src/data.js → BRAND_GROUPS
#    Exemplo com gdown:
#      gdown "https://drive.google.com/uc?id=<FILE_ID>" -O /tmp/<nome>.pdf

# HP E62655
# gdown "https://drive.google.com/uc?id=1nReLfTlkWvTXU8JEdUNnkqrYZ_kNEdG8" -O /tmp/e62655_guia.pdf
# gdown "https://drive.google.com/uc?id=1PKE-eD_-Ixk5vfC9ANb45nyDlHiJbcDf" -O /tmp/e62655_cpmd.pdf
# gdown "https://drive.google.com/uc?id=1hg-Ji4DNHCQXu2y1w5pO9cOj3oD-NsaJ" -O /tmp/e62655_service.pdf

# Ricoh IM C3000 (ver IDs em src/data.js → ricoh_imc3000_group)

# 2. Rodar o indexador
python3 scripts/build_index.py

# 3. Commitar os índices gerados
git add assets/search_index.json assets/error_codes_index.json
git commit -m "chore: reindexar manuais"
git push
```
