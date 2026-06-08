# TechGuide IA — Projeto

App React Native (Expo) de suporte técnico para impressoras HP e Ricoh.
Backend em `https://manuais-hp.onrender.com` — código em `backend/server.js` **neste repo**,
sincronizado automaticamente para `gptmaycondb/manuais-hp` via GitHub Action no push ao `main`.
O provedor de IA (Claude Sonnet, Claude Opus, OpenAI GPT-4o, Gemini) é selecionável
dentro do app; o backend roteia com base no campo `provider`.

**Modo online:** app faz RAG local (error_codes_index + search_index) → envia systemPrompt
montado ao backend → backend chama a IA com streaming SSE → texto aparece ao vivo no app.
**Modo offline:** app faz RAG keyword local → exibe trechos diretamente, sem IA.

## Arquitetura

```
assets/
  manuals/          ← PDFs HP E52645 (guia_e52645, cpmd_2023, service_part1-4) — bundled no app
  search_index.json ← chunks de texto para busca keyword offline (~20 MB, bundled)
  error_codes_index.json ← código → descrição do erro (~4.8 MB, ~1770 entradas, 363 HP + 521 Ricoh)
  embeddings/       ← vetores por índice para busca semântica no backend — 11 arquivos *.json
                       (ex: e52645_guia.json, ricoh_imc3000_service.json)
                       Gerados por build_index.py --embeddings; backend baixa do GitHub no start.
backend/
  server.js         ← servidor Express completo (SSE streaming, RAG semântico/keyword,
                       providers lazy Claude/OpenAI/Gemini, /ping, telemetria)
  package.json      ← dependências + start script --max-old-space-size=460
.github/
  workflows/
    sync-backend.yml← push ao main com mudança em backend/ → atualiza manuais-hp via GitHub API
                       Requer secret MANUAIS_HP_TOKEN (fine-grained PAT, write em manuais-hp)
scripts/
  build_index.py    ← indexador v2; reprocessa todos os PDFs
  audit_index.py    ← auditor de qualidade do error_codes_index.json (HP + Ricoh)
src/
  data.js           ← manuais, AI_PROVIDERS (lista de provedores), API_URL, DEFAULT_PROVIDER
  search.js         ← searchManual(), searchErrorCode(), hasRelevantContent(), MANUAL_INDEX_MAP
  ChatScreen.js     ← fluxo de chat; monta contexto e chama API (usa ScrollView, não FlatList)
  tips.js           ← ASSISTANT_TIPS[] com dicas por model/brand
  AssistantBubble.js← bolha flutuante; filtra dicas por modelId
  DrawerContent.js  ← drawer lateral; inclui seletor de modelo de IA (modal)
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

> **Verificação de URL:** ao trocar ou corrigir um Drive ID em `BRAND_GROUPS`, confirme
> que o ID correto abre o arquivo esperado antes de commitar. Exemplo rápido:
> `curl -sI "https://drive.usercontent.google.com/download?id=<FILE_ID>&export=download&confirm=t" | grep -i content-disposition`
> O `filename=` retornado deve bater com o título do card.
> Ao corrigir um ID errado, **bumpar o `localName`** (ex: `_v2`) para invalidar o cache
> de usuários que já baixaram o arquivo incorreto.

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

### Seletor de provedor de IA
`src/data.js` exporta `AI_PROVIDERS` (lista fixa) e `DEFAULT_PROVIDER = 'claude'`.
O `App.js` mantém o estado `provider`, carregado do AsyncStorage (`tg_provider`) no mount.
O `DrawerContent` exibe um botão "Modelo de IA" no rodapé que abre um modal com a lista.
Ao escolher, a seleção é salva no AsyncStorage e passa como campo `provider` no corpo do
`POST /chat`. O backend roteia para o SDK correspondente e normaliza a resposta para
`{ content: [{ text }] }` — o único formato que o app aceita.

Provedores disponíveis:

| id | Modelo | Chave no Render |
|----|--------|----------------|
| `claude` (padrão) | claude-sonnet-4-6 | `ANTHROPIC_API_KEY` |
| `claude-opus` | claude-opus-4-8 | `ANTHROPIC_API_KEY` |
| `openai` | gpt-4o | `OPENAI_API_KEY` |
| `gemini` | gemini-1.5-pro | `GEMINI_API_KEY` |

Para adicionar um novo provedor: adicionar entrada em `AI_PROVIDERS` (`src/data.js`) e
adicionar o handler `callXxx()` + caso no `if/else` do `app.post('/chat')` em `backend/server.js`
(o sync automático cuida de enviar para `manuais-hp`).

### Histórico de conversa persistente
`App.js` salva `allMessages` no AsyncStorage com chave `tg_messages_${authEmail}`:
- Carregado no init (após `restoreSession`)
- Salvo com debounce de 800 ms a cada mudança de `allMessages`
- Cap de 30 mensagens por manual (prune automático antes de salvar)
- Limpo no logout (`AsyncStorage.removeItem`)
- Isolado por usuário (chave inclui o e-mail)

### Mensagens de erro amigáveis
`src/ChatScreen.js` → função `friendlyError(err)` (antes do componente):
- `AbortError` → "Tempo limite excedido. Servidor iniciando — tente novamente em 30s."
- `*_API_KEY` no message → instrução específica por provedor
- `Failed to fetch` / `Network request failed` → "Sem conexão com o servidor."
- `Resposta vazia` / `Resposta invalida` → mensagens descritivas
- Erros entram como bolha com `isError: true` (fundo vermelho escuro)

### Keepalive e detecção de online
`App.js` — `wakeUpServer()` e `checkOnline()` usam `GET https://manuais-hp.onrender.com/ping`:
- `checkOnline` considera online qualquer `status < 500` (404 de server antigo sem `/ping`
  não derruba o app — só timeout ou erro de rede setam offline)
- Timer de 10 s com `AbortController`; timer é cancelado (`clearTimeout`) se fetch responder
- Keepalive externo: cron-job.org → `GET /ping` a cada 10 min (previne hibernação Render free)
- Botão "OFF/ON" no header chama `wakeUpServer()` + `checkOnline()` manualmente

### Streaming SSE no modo online
`src/ChatScreen.js` usa `XMLHttpRequest` (não `fetch`) para suportar streaming em React Native:
- Header `Accept: text/event-stream` sinaliza ao backend que o app aceita SSE
- `xhr.onprogress` parseia linhas `data: {...}` incrementalmente via `responseText.slice(lastIndex)`
- Primeiro `delta` recebido → `setLoading(false)` (spinner some, texto começa a aparecer)
- `streaming: true` na mensagem → cursor `▌` visível até o evento `done`
- `xhr.onload` com `!doneReceived` → fallback JSON puro (backward compat)
- `max_tokens: 3072` — cabe procedimentos completos (passo a passo longo). Era 1024,
  que truncava respostas detalhadas no meio.

### Retry automático no ChatScreen (`startRequest`)
Toda a lógica XHR está encapsulada em `startRequest(attempt)` (chamada com `startRequest(1)`):
- `xhr.onerror` com `attempt < 2` → aguarda 1200 ms e chama `startRequest(attempt + 1)`
- Retry é seguro porque `onerror` significa que o request **nunca chegou ao servidor**
  (sem risco de processar a mesma query duas vezes)
- Na segunda tentativa, se `onerror` novamente → exibe "Sem conexão com o servidor."
- Resolve o erro de conexão falsa ao retornar de background (Android stale network)

### Reconexão ao voltar do background (AppState)
`App.js` registra `AppState.addEventListener('change', handler)` no mount:
- Quando estado muda para `'active'` (app volta ao foreground) → chama `wakeUpServer()` + `checkOnline()`
- Combinado com o retry de `startRequest`, elimina o "Sem conexão" falso após minimizar o app
- `sub.remove()` no cleanup do `useEffect` evita listener duplicado

### Timeout de inatividade (não timeout total)
`src/ChatScreen.js` → `armTimeout()`: o limite de 60 s é de **inatividade**, não de
duração total. `armTimeout()` faz `clearTimeout` + novo `setTimeout(60s)` e é chamado:
- uma vez antes do `xhr.send` (cold-start: 60 s para o 1º token)
- no início de cada `xhr.onprogress` (reinicia a contagem a cada chunk recebido)

Assim respostas longas completam por mais que demorem, desde que os tokens continuem
fluindo (gap < 60 s). Se o servidor travar de verdade (60 s sem chunk), `xhr.abort()`
dispara e vira bolha de erro "Tempo limite excedido…". `onload`/`onerror`/`done`
cancelam o timer com `clearTimeout`.

> **Por que não timeout total fixo?** Com `max_tokens` alto, uma resposta legítima pode
> levar mais de 60 s de geração. Um timeout total a abortaria no meio; o de inatividade não.

### key={chatKey} no ChatScreen
`App.js` passa `key={chatKey}` para `<ChatScreen>`. Isso força o React a remontar
o componente quando o manual muda, resetando todo o estado local (`loading`, scroll, etc.).
Sem o `key`, trocar de manual com uma requisição em andamento deixava o input bloqueado.

### searchErrorCode sem fallback cross-manual
`src/search.js` → `searchErrorCode()`: quando o código existe no índice mas não para
o `indexKey` do modelo ativo, o resultado é vazio (não há fallback para outros manuais).
Sem isso, um usuário Ricoh poderia receber descrições de erros HP e vice-versa ao buscar
códigos que existem em múltiplos manuais.

### Indexador HP — entradas específicas por código

`extract_hp_errors_from_cpmd()` usa `SECTION_START` regex com três âncoras:
- `^` / `(?<=\n)` — código no início de linha (padrão E62655 CPMD)
- `(?<=\. )` — código inline após ponto (ex.: `50.2F.00` em `...replacement. 50.2F.00 Fuser Error`)
- `(?<=● )` — código após bullet inline (padrão E52645 CPMD: `● 13.B2.A4 description`)

Cada código HP específico (`XX.YY.ZZ`) recebe sua própria chave no índice. O indexador
também cria chaves de prefixo (`XX.YY` e `XX`) com o mesmo conteúdo para fallback.

**`is_book_index_chunk()` — guard de troubleshooting:** o filtro de índice remissivo
retorna `False` imediatamente se o texto contiver linguagem de troubleshooting
(`recommended action`, `turn the printer off`, etc.). Sem isso, seções HP com tabelas de
part numbers (`RM2-xxxx-000CN`) inflavam a contagem de números e eram descartadas.

### Propagação de irmãos (`propagate_sibling_descriptions`)

Resolve o truncamento onde o bloco de "Recommended action" aparece APÓS o último irmão
na tabela do PDF, deixando os primeiros irmãos com apenas a descrição:

- **HP:** agrupa por `XX.YY`. Para cada código curto (< 300 chars), sintetiza
  `"desc própria + action_block do irmão mais rico"`.
  - Variante **cross-group:** se a descrição menciona outro código explicitamente
    (ex.: `55.01.06, 55.02.06`), propaga do código referenciado mesmo sendo outro `XX.YY`.
- **Ricoh (mesmo grupo):** agrupa por `SCxxx`. Para curtos (< 120 chars) com irmão rico
  (≥ 300 chars), sintetiza `"linha própria + texto do irmão rico"`.
- **Ricoh (grupo adjacente):** quando TODO o grupo `SCxxx` tem max < 300 chars, busca
  em `SCxxx±1` por um entry com ação explícita (ex.: `SC913-00` → solução em `SC914-00`).

### `audit_index.py` — auditoria reproduzível

```bash
python3 scripts/audit_index.py              # relatório completo
python3 scripts/audit_index.py --fail-short # exit 1 se houver fixable pendente
```

Classifica cada código HP (`XX.YY.ZZ`) e Ricoh (`SC-com-hífen`) como:
- `OK` — texto ≥ limiar mínimo com palavra-chave de ação (HP: 200 chars, Ricoh: 120 chars)
  OU entrada com `HAS_ACTION_RE` match e len > 150 (completa mas compacta, ex.: `56.00.01`)
  OU entrada com `no action necessary` e len > 80
- `fixable` — curto mas irmão rico existe (≥ 400 chars) → regressão do build
- `short` — curto sem irmão rico → manual genuinamente terso (aceitável)
- `noAction` — tamanho OK mas sem palavra-chave de ação (informacional)

Estado atual: HP 362/363 OK (100%), Ricoh 474/521 OK (91%), 0 fixable, 0 short.
`80.00.00` (167 chars) é o único `short` restante — licensing error sem ação no CPMD.

### Skills e Hooks
`.claude/skills/` — 12 skills invocadas manualmente com `/nome` na sessão do Claude Code.
`.claude/settings.json` — 4 hooks automáticos:
- `SessionStart`: instala npm deps + exibe lista de skills
- `PreToolUse(Bash, git push*)`: lembra de rodar `/auditoria`
- `PostToolUse(Edit|Write em tips.js)`: `check-tips.sh` detecta contaminação cruzada Ricoh
- `PostToolUse(Bash, build_index.py)`: exibe contagem de chunks após reindexar

---

## Modo online vs offline (RAG)

O `ChatScreen.js` bifurca o fluxo com base em `isOnline` (prop do `App.js`):

### Modo online (padrão quando servidor disponível)
O app sempre faz o RAG **localmente** antes de chamar o backend:
1. `searchErrorCode(q, serviceKey)` → `error_codes_index.json` (bundled, ~1770 entradas)
2. `searchManual(q, k, 3)` para cada `k` em `manual.searchKeys` → `search_index.json`
3. Monta `systemPrompt = manual.prompts[mode] + contextBlock` com os trechos

Depois envia para `POST /chat` usando **contrato legado**:
```json
{ "system": "<systemPrompt completo com trechos>", "messages": [...histórico + query],
  "max_tokens": 3072, "provider": "claude" }
```
O backend apenas chama a IA com o prompt recebido — **não refaz RAG**.
O `foundInManual` é calculado localmente e usado no selo "● Manual" vs "⚠ Resposta geral".

> **Por que contrato legado (não `{systemBase, query, manualId}`)?**
> O backend não tem `error_codes_index.json` — só os embeddings do `search_index.json`.
> Se o app delegasse a busca ao backend, consultas de código SC/49.xx retornariam
> alucinações (o backend achava chunks irrelevantes e a IA inventava a resposta).
> Enviar o `systemPrompt` já montado garante que o `error_codes_index.json` bundled
> seja sempre consultado, independente do que o backend tenha disponível.

A resposta chega em **SSE streaming** (`text/event-stream`):
- Cada chunk: `data: {"type":"delta","text":"..."}` → texto aparece ao vivo no app
- Fim: `data: {"type":"done","foundInManual":true}`
- Fallback automático: se o backend não suportar SSE, o app aceita JSON puro

### Modo offline (`!isOnline`)
O app exibe os trechos do RAG local diretamente, sem chamar a IA:
- `searchErrorCode(q, serviceKey)` → `error_codes_index.json` bundled
- `searchManual(q, k, 3)` para cada chave em `manual.searchKeys`
- Mensagem: "Modo offline — Trechos encontrados: ..." ou "Nenhum resultado encontrado"

### Contrato legado vs novo no backend
O backend aceita dois formatos:
- **Legado** (`system + messages`) — usado pelo app atual; backend usa o prompt como recebido
- **Novo** (`query + systemBase + manualId + history`) — backend faz RAG semântico próprio
  (útil quando `SEMANTIC_SEARCH=1` e `error_codes_index.json` não é necessário)
O discriminador é `isNew = !!req.body.query`.

---

## Busca semântica (embeddings)

**Modelo:** `paraphrase-multilingual-MiniLM-L12-v2` — 384 dimensões, suporta português,
sem API key. Usado tanto para gerar (Python) quanto para embedar queries (Node.js).

### Geração dos embeddings (uma vez, localmente)
```bash
pip install sentence-transformers
python3 scripts/build_index.py --embeddings
# Gera embeddings_index.json (~62 MB, em .gitignore)
```
Depois fatiar por índice e commitar em `assets/embeddings/`:
```bash
# (feito automaticamente via script Python no setup)
# Arquivos: assets/embeddings/{key}.json — um por índice, ~1-18 MB cada
git add assets/embeddings/
git commit -m "feat: embeddings semanticos"
```

### Como o backend carrega
1. Ao iniciar, baixa cada `assets/embeddings/{key}.json` do raw.githubusercontent
   (sequencial para evitar pico de memória)
2. Vetores armazenados como `Float32Array` (fora do heap V8)
3. Na query: embeda com `@xenova/transformers` (modelo int8 quantized, ~30 MB)
4. Ranqueia chunks por similaridade de cosseno e retorna os top-5

### Limites de memória no Render free (512 MB)
- `package.json` do backend usa `--max-old-space-size=460 --expose-gc`
- Carga sequencial dos índices para evitar pico paralelo
- Se ainda houver OOM: setar `SEMANTIC_SEARCH=0` nas env vars do Render →
  servidor usa keyword search nos mesmos embeddings (só campo `t`, sem vetores)
  e sobe sem carregar o modelo pesado

### Variável de ambiente do backend
| Var | Padrão | Efeito |
|-----|--------|--------|
| `SEMANTIC_SEARCH` | `1` | `0` = desliga modelo, usa keyword search |
| `ANTHROPIC_API_KEY` | — | Obrigatória para Claude funcionar |
| `OPENAI_API_KEY` | — | Opcional (provedor OpenAI) |
| `GEMINI_API_KEY` | — | Opcional (provedor Gemini) |

**Todos os providers são instanciados lazy** (dentro de `callXxx()`), não no topo do
arquivo — evita crash no start quando `OPENAI_API_KEY`/`GEMINI_API_KEY` não estão
configuradas. Apenas `ANTHROPIC_API_KEY` é necessária para o app funcionar normalmente.

---

## Melhorias planejadas (não implementadas)

> **Já implementadas** (não repetir aqui): histórico persistente, erros amigáveis,
> RAG semântico no backend, keepalive `/ping`, telemetria JSON, embeddings
> `paraphrase-multilingual-MiniLM-L12-v2`, `SEMANTIC_SEARCH` flag, SSE streaming,
> `max_tokens: 3072`, `searchErrorCode` sem fallback cross-manual, `key={chatKey}`
> no ChatScreen, contrato legado (RAG local no app), AppState listener, retry automático
> (`startRequest`), fix URLs E52645 invertidos + `localName` `_v2`, indexação completa
> HP/Ricoh (When SC, propagação de irmãos, `audit_index.py`, entradas específicas por código).
> `search_index.json` off-bundle continua **deferido** — necessário para modo offline.

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
| `ricoh_imc3000_guia`     | `/tmp/ricoh_guia.pdf` (Google Drive)         | 220    |
| `ricoh_imc3000_service`  | `/tmp/ricoh_service.pdf` (84 MB, Drive)      | 1764   |
| `ricoh_imc3000_parts`    | `/tmp/ricoh_parts.pdf` (Google Drive)        | 10     |
| `e62655_guia`            | `/tmp/e62655_guia.pdf` (Google Drive)        | 162    |
| `e62655_cpmd`            | `/tmp/e62655_cpmd.pdf` (Google Drive)        | 316    |
| `e62655_service`         | `/tmp/e62655_service.pdf` (71 MB, Drive)     | 1095   |
| `ricoh_mpc3004_guia`     | `/tmp/ricoh_mpc3004_guia.pdf` (7 MB, Drive)  | 163    |
| `ricoh_mpc3004_service`  | `/tmp/ricoh_mpc3004_service.pdf` (61 MB, Drive) | 1223 |

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

# 3. (Opcional) Gerar embeddings semânticos — requer sentence-transformers
pip install sentence-transformers
python3 scripts/build_index.py --embeddings
# Gera embeddings_index.json (~62 MB, em .gitignore)
# Depois fatiar por índice:
python3 -c "
import json, os
os.makedirs('assets/embeddings', exist_ok=True)
idx = json.load(open('embeddings_index.json'))
for k, v in idx.items():
    json.dump({k: v}, open(f'assets/embeddings/{k}.json','w'), ensure_ascii=False, separators=(',',':'))
    print(k)
"

# 4. Commitar os índices gerados
git add assets/search_index.json assets/error_codes_index.json assets/embeddings/
git commit -m "chore: reindexar manuais"
git push
```
