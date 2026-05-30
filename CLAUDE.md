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
- `prompts` — instruções de sistema por perfil (user/tecnico)

### 2. Adicionar PDFs em `scripts/build_index.py`
No dicionário `PDF_SOURCES`, adicionar:
```python
'canon_ir2630_service': [Path('/tmp/canon_ir2630_service.pdf')],
'canon_ir2630_guia':    [Path('/tmp/canon_ir2630_guia.pdf')],
```
Se a marca usa formato de código de erro diferente (ex: Canon `Exxx`, Kyocera `C-xxxx`),
adicionar um parser dedicado similar a `extract_ricoh_sc_sections()` ou
`extract_hp_errors_from_cpmd()`.

### 3. Reindexar
```bash
# Colocar os PDFs nas paths configuradas, depois:
python3 scripts/build_index.py
```

### 4. Atualizar routing de busca no `ChatScreen.js`
O trecho abaixo precisa ser expandido para novas marcas:
```javascript
// LINHA ~54 — hoje hardcoded para ricoh/hp
const searchKeys = manual.brand === 'ricoh'
  ? ['ricoh_imc3000_service', 'ricoh_imc3000_guia', 'ricoh_imc3000_parts']
  : [primaryKey, 'cpmd', 'service']...
```

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
