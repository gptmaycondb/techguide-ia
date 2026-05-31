# TechGuide IA — Projeto

App React Native (Expo) de suporte técnico para impressoras HP e Ricoh.
Usa RAG local (índices JSON) + Claude API via backend em `https://manuais-hp.onrender.com`.

## Arquitetura

```
assets/
  manuals/          ← PDFs HP (guia_e52645, cpmd_2023, service_part1-4)
  search_index.json ← chunks de texto para busca semântica (~9.7 MB)
  error_codes_index.json ← código → descrição do erro (~1.7 MB)
scripts/
  build_index.py    ← indexador v2; reprocessa todos os PDFs
src/
  data.js           ← registro de todos os manuais (id, brand, indexKey, prompts)
  search.js         ← searchManual(), searchErrorCode(), hasRelevantContent()
  ChatScreen.js     ← fluxo de chat; monta contexto e chama API
```

## Como adicionar um novo modelo

### 1. Registrar o manual em `src/data.js`
Cada manual precisa de:
- `id` único (ex: `'canon_ir2630'`)
- `brand` (ex: `'canon'`)
- `indexKey` — chave no search_index.json (ex: `'canon_ir2630_service'`)
- `searchKeys` — array de índices consultados na busca (ex: `['canon_ir2630_guia', 'canon_ir2630_service']`)
- `topics` — perguntas sugeridas por perfil (user/tecnico); aparecem como "Sugestões de pesquisa"
- `prompts` — instruções de sistema por perfil (user/tecnico)

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
O `ChatScreen.js` usa `manual.searchKeys` diretamente — **não precisa mais editar**
o ChatScreen por marca (Melhoria B implementada). Basta declarar `searchKeys` no `data.js`.
```javascript
// ChatScreen.js — roteamento data-driven
const searchKeys = (manual.searchKeys && manual.searchKeys.length
  ? manual.searchKeys
  : [primaryKey]).filter((v, i, a) => a.indexOf(v) === i);
```

### 6. Dicas do assistente flutuante em `src/tips.js`
Adicionar um bloco de dicas **específicas do modelo** com o campo `model` igual ao `id`
do manual (ex: `model: 'canon_ir2630'`). Sem isso, o modelo só mostra as dicas genéricas
da marca + as `general`. Basear as dicas nos manuais reais (part numbers, códigos de erro).
```javascript
{ brand: 'canon', model: 'canon_ir2630', text: 'Erro Exxx no iR2630 indica...' },
```
O filtro em `AssistantBubble.js` já seleciona por `model` quando presente, caindo para
`brand` quando a dica não tem `model`. O `App.js` passa `modelId={activeManual.id}`.

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

### B) `searchKeys` data-driven em `src/data.js`
Em vez do `if (brand === 'ricoh') ...` no ChatScreen, cada manual declararia
seus próprios índices de busca:
```javascript
// src/data.js
{
  id: 'ricoh_imc3000',
  brand: 'ricoh',
  searchKeys: ['ricoh_imc3000_service', 'ricoh_imc3000_guia', 'ricoh_imc3000_parts'],
  ...
}
```
O ChatScreen usaria `manual.searchKeys` diretamente, sem if/else por marca.

### C) Tips filtradas por marca
O array `TIPS[]` em `ChatScreen.js` é genérico. Para múltiplas marcas,
organizar por brand e filtrar pelo manual ativo:
```javascript
const TIPS_BY_BRAND = {
  hp:     ['💡 "Como resolver erro 50 no E52645?"', ...],
  ricoh:  ['💡 "O que significa SC 543?"', ...],
  canon:  ['💡 "Erro E002 no Canon iR2630?"', ...],
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

| Key                      | Fonte                              | Chunks |
|--------------------------|------------------------------------|--------|
| `e52645_guia`            | `assets/manuals/guia_e52645.pdf`   | 166    |
| `cpmd`                   | `assets/manuals/cpmd_2023.pdf`     | 300    |
| `service`                | `assets/manuals/service_part1-4`   | 615    |
| `ricoh_imc3000_guia`     | `/tmp/ricoh_guia.pdf` (Google Drive)| 218   |
| `ricoh_imc3000_service`  | `/tmp/ricoh_service.pdf` (84 MB)   | 1763   |
| `ricoh_imc3000_parts`    | `/tmp/ricoh_parts.pdf`             | 10     |
| `e62655_guia`            | `/tmp/e62655_guia.pdf` (Google Drive)| 160  |
| `e62655_cpmd`            | `/tmp/e62655_cpmd.pdf` (Google Drive)| 316  |
| `e62655_service`         | `/tmp/e62655_service.pdf` (71 MB)  | 1094   |

> **Nota:** Os PDFs Ricoh estão no Google Drive (ver URLs em `src/data.js`).
> Para reindexar, baixar para `/tmp/` com os nomes acima antes de rodar o script.

## Reindexar do zero

```bash
# Baixar PDFs Ricoh do Google Drive para /tmp/
# (URLs em src/data.js → ricoh_imc3000_service/guia/parts)

python3 scripts/build_index.py
git add assets/search_index.json assets/error_codes_index.json
git commit -m "chore: reindexar manuais"
git push
```
