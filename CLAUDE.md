# TechGuide IA — Projeto

App React Native (Expo) de suporte técnico para impressoras HP e Ricoh.
Usa RAG local (índices JSON) + Claude API via backend em `https://manuais-hp.onrender.com`.

## Arquitetura

```
assets/
  manuals/          ← PDFs HP E52645 (guia_e52645, cpmd_2023, service_part1-4) — bundled no app
  search_index.json ← chunks de texto para busca semântica (~14.7 MB)
  error_codes_index.json ← código → descrição do erro (~3.5 MB, ~1848 entradas)
scripts/
  build_index.py    ← indexador v2; reprocessa todos os PDFs
src/
  data.js           ← registro de todos os manuais (id, brand, indexKey, searchKeys, prompts)
  search.js         ← searchManual(), searchErrorCode(), hasRelevantContent(), MANUAL_INDEX_MAP
  ChatScreen.js     ← fluxo de chat; monta contexto e chama API (usa ScrollView, não FlatList)
  tips.js           ← ASSISTANT_TIPS[] com dicas por model/brand
  AssistantBubble.js← bolha flutuante; filtra dicas por modelId
.claude/
  settings.json     ← hooks (SessionStart, PreToolUse, PostToolUse)
  hooks/
    session-start.sh← instala npm deps em sessões remotas (Claude Code on the web)
    check-tips.sh   ← alerta contaminação cruzada ao editar tips.js
  skills/           ← 12 skills /auditoria /novo-modelo /reindexar /contexto
                       /buscar-erro /status-indices /checar-modelo /ver-diff
                       /gerar-dicas /debug-busca /atualizar-docs /criar-pr
```

## Como adicionar um novo modelo

### 1. Registrar o manual em `src/data.js`
> **Onde registrar:** modelos **HP** entram em `MANUALS`; modelos de **outras marcas**
> (Ricoh, Canon, etc.) entram em `MANUALS_RICOH`. `ALL_MANUALS` junta os dois e a
> WelcomeScreen deriva o picker por marca automaticamente — não há lista de marcas
> hardcoded para editar.

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

**Codes de erro do service:** adicionar também um bloco em `build_error_codes_index()`
para o service do modelo (espelhe o bloco "Ricoh MP C3004/3504 Service Manual").
Os parsers Ricoh SC são parametrizados por `service_key` — passe a chave do modelo
(ex.: `extract_ricoh_sc_sections(text, 'ricoh_mpc3004_service')`) para que os códigos
SC fiquem atribuídos ao índice correto e não ao IM C3000.

> **Atenção — formato dos códigos SC Ricoh:** diferentes service manuals usam formatos
> distintos. O IM C3000/3500 usa `SC20200` (sem separador), o MP C3004/3504 usa `SC285-00`
> (com hífen). O regex `RICOH_SC_RE` em `build_index.py` já cobre ambos (`-?` opcional).
> Ao adicionar um novo modelo Ricoh, **verifique o formato** antes de assumir que a extração
> funcionou — rode o script e confira se o log exibe contagem de SC codes maior que zero.

### 3. Mapear índices em `src/search.js`
Adicionar as chaves do modelo em `MANUAL_INDEX_MAP` (id do manual → índice primário,
e cada índice apontando para si mesmo). **O `id` do modelo também deve ter entrada**
(ex: `'mfpe52645': 'e52645_guia'`) — sem isso o ChatScreen cai no fallback `indexKey`.
Ex:
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

O `serviceKey` para `searchErrorCode` é derivado automaticamente do `searchKeys`:
```javascript
// Usa o índice de service do modelo ativo p/ filtrar erros — evita misturar SC codes entre modelos.
const serviceKey = searchKeys.find(k => k.includes('service')) || primaryKey;
const errorChunks = searchErrorCode(q, serviceKey);
```
Isso garante que consultas de código de erro em um modelo Ricoh não retornem resultados
do service manual de outro modelo. **Não é necessário editar o ChatScreen** para novos
modelos — o `serviceKey` é resolvido automaticamente desde que `searchKeys` contenha
a chave `*_service` do modelo.

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

## Manuais somente-consulta (download, sem busca no chat)

A aba **Manuais** (`BRAND_GROUPS` em `src/data.js`) e a **busca do chat** (`MANUALS` /
`MANUALS_RICOH` + `searchKeys` + `search_index.json`) são **estruturas desacopladas**.
Para disponibilizar um PDF **apenas para download/consulta** (sem influenciar as respostas
do chat), adicione-o **somente** em `BRAND_GROUPS` — nunca em `MANUALS`/`searchKeys` nem
no índice. Não é preciso reindexar nem tocar em `search.js`/`build_index.py`.

Cada manual em `BRAND_GROUPS` precisa de: `id`, `title`, `subtitle`, `desc`, `color`,
`icon`, `tags`, `url`, `localName`, `size`. A `url` é o link direto do Drive no formato
`https://drive.usercontent.google.com/download?id=<FILE_ID>&export=download&confirm=t`.
Sem `url`, o card aparece como "⏳ Em breve".

> **Convenção:** todo manual Ricoh nomeado **"Parts Catalog"** é **somente consulta** —
> entra apenas em `BRAND_GROUPS` (grupo Ricoh), nunca em `searchKeys`/índice.

---

## Decisões arquiteturais

### ChatScreen usa ScrollView (não FlatList)
O `FlatList` foi substituído por `ScrollView` + `map()` para habilitar seleção de texto
nativa (`<Text selectable>`). O `FlatList` tem um responder interno que intercepta o
long-press antes de ele chegar ao `Text`, impedindo a seleção. A `ScrollView` não tem
esse conflito. Auto-scroll funciona via `onContentSizeChange → scrollToEnd()`.

### AssistantBubble — texto da dica é `selectable`
`AssistantBubble.js` usa `<Text selectable>` no card de dicas (linha ~180).
Funciona porque o texto está num `Animated.View` absoluto, sem scroll container.

### MANUAL_INDEX_MAP — todo id de modelo deve ter entrada
`src/search.js` → `MANUAL_INDEX_MAP`: além das chaves de índice (`e52645_guia` etc.),
o `id` de cada modelo também precisa de entrada (`'mfpe52645': 'e52645_guia'`).
Sem isso, `ChatScreen` usa `manual.indexKey` como fallback — funciona, mas é frágil.

### Skills e Hooks
`.claude/skills/` — 12 skills invocadas manualmente com `/nome` na sessão do Claude Code.
`.claude/settings.json` — 4 hooks automáticos:
- `SessionStart`: instala npm deps + exibe lista de skills
- `PreToolUse(Bash, git push*)`: lembra de rodar `/auditoria`
- `PostToolUse(Edit|Write em tips.js)`: `check-tips.sh` detecta contaminação cruzada Ricoh
- `PostToolUse(Bash, build_index.py)`: exibe contagem de chunks após reindexar

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

| Marca   | Formato de código                  | Parser atual       |
|---------|------------------------------------|--------------------|
| HP      | `49.XX.YZ`                         | `extract_hp_errors_from_cpmd()` |
| Ricoh   | `SC20200` ou `SC285-00` (hífen)    | `extract_ricoh_sc_sections(text, service_key)` |
| Canon   | `Exxx`, `Fxxx`                     | ⚠ não implementado |
| Kyocera | `C-xxxx`                           | ⚠ não implementado |
| Xerox   | `xxx-xxx`                          | ⚠ não implementado |

> **Ricoh — dois formatos SC:** o IM C3000/3500 usa `SC20200` (sem separador); o MP C3004/3504
> usa `SC285-00` (com hífen). O `RICOH_SC_RE` atual cobre ambos com hífen opcional (`-?`).
> Ambos os parsers (`extract_ricoh_sc_sections` e `extract_ricoh_sc_groups`) são
> parametrizados por `service_key` — sempre passe a chave do modelo para que os códigos
> fiquem atribuídos ao índice correto no `error_codes_index.json`.

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
| `ricoh_mpc3004_guia`     | `/tmp/ricoh_mpc3004_guia.pdf` (7 MB, Drive)  | 161    |
| `ricoh_mpc3004_service`  | `/tmp/ricoh_mpc3004_service.pdf` (61 MB, Drive) | 1213 |

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

# Ricoh MP C3004/3504 (Parts Catalog = somente consulta, NAO indexar)
# gdown "https://drive.google.com/uc?id=1NbV4S5IIX5e8wX4spY2TciXzfhdYy-rC" -O /tmp/ricoh_mpc3004_guia.pdf
# gdown "https://drive.google.com/uc?id=1ylExuQ9rQJsi25u4VEhnSb1BG05l05QA" -O /tmp/ricoh_mpc3004_service.pdf

# 2. Rodar o indexador
python3 scripts/build_index.py

# 3. Commitar os índices gerados
git add assets/search_index.json assets/error_codes_index.json
git commit -m "chore: reindexar manuais"
git push
```
