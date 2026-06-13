# TechGuide IA — Guia de Processo para Agentes

Este arquivo é o ponto de entrada para qualquer executor (Codex, Jules, Claude Code, em qualquer conta). Leia-o antes de fazer qualquer alteração no projeto.

**Arquitetura técnica** (contrato legado, parsers, busca semântica, deploy, provedores de IA): ver `CLAUDE.md`.

---

## Regras de Processo

### 1. Prova executada, nunca deduzida

Todo ANTES/DEPOIS apresentado em checkpoint ou revisão de PR deve derivar de `git show <hash> -- <arquivo>` ou leitura direta do arquivo com o hash confirmado — **nunca da documentação**.

O `CLAUDE.md` é mapa, não território. Se o mapa divergir do código, o código é a verdade. Nunca deduza o estado do código a partir do que o CLAUDE.md diz sobre ele.

```bash
# Prova correta:
git show HEAD~1:src/search.js | grep searchErrorCode
git diff HEAD~1 -- src/search.js
```

### 2. Funções puras testáveis + sync guard

Toda lógica crítica sai em função pura coberta por teste. Cópias verbatim em arquivos de teste têm um **sync guard** que compara a cópia com a fonte e falha se divergirem.

Exemplos existentes:
- `resolveProviders()` em `App.js` → testada em `scripts/test_providers.js` (sync guard na linha 46)
- `buildGeminiMessages()` em `backend/server.js` → testada em `scripts/test_backend.js` (sync guard na linha 57)
- `searchErrorCode()` em `src/search.js` → testada em `scripts/test_findability.js` (sync guard)

Quando alterar uma dessas funções, **atualizar a cópia verbatim no arquivo de teste** imediatamente — o sync guard vai falhar na CI de qualquer forma.

### 3. Node verde ≠ comportamento no device

Testes em Node provam a lógica; **não substituem o smoke test no APK**. O gate booleano `foundInManual=false` ficou invisível por meses nos testes Node mas foi detectado imediatamente no device.

Todo APK novo passa pela checklist de release do `CLAUDE.md` antes de ser distribuído:
- 5 buscas padrão (todas devem exibir o selo "● Manual")
- 1 busca em modo avião (deve exibir o chunk direto)

### 4. `npm ci` no CI é intencional

O workflow `build.yml` usa `npm ci`. Se o build falhar por desync entre `package.json` e `package-lock.json`, a correção é sincronizar o lock — **nunca rebaixar para `npm install`**. Isso já foi feito uma vez (dc47c1a2) e escondeu uma dívida de lockfile no main por meses.

Ao adicionar ou remover um pacote npm:
```bash
npm install <pacote>   # atualiza package.json + package-lock.json
git add package.json package-lock.json
git commit -m "..."
```

### 5. Modelos de IA são env var, nunca hardcoded

O backend usa três constantes lidas em runtime:
```js
const GEMINI_MODEL    = process.env.GEMINI_MODEL    || 'gemini-2.5-flash';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
const OPENAI_MODEL    = process.env.OPENAI_MODEL    || 'gpt-4o';
```

O app exibe o **provider** (Gemini, Claude), nunca o model ID. Para mudar o modelo em produção: setar a env var no Render — sem deploy de código.

### 6. Gate de cobertura — baseline só encolhe, nunca cresce

O `scripts/coverage_report.json` é commitado e contém o hash SHA-256 do `error_codes_index.json` que o gerou. O gate `audit_index.py --fail-missing` valida:

1. **Frescor:** se o índice mudou desde a geração do relatório → exit 1 pedindo regeneração.
2. **Regressão nova:** código encontrado no PDF mas ausente do índice, fora do baseline e fora do `codes_ignore.json` → exit 1.
3. **Baseline:** `coverage_baseline.json` lista os missing conhecidos (dívida técnica em triagem). O arquivo **só pode encolher** — nunca adicionar novos códigos ao baseline para encobrir regressão. Use `--shrink-baseline` para remover entradas resolvidas.

Fluxo após reindexar com PDFs novos:
```bash
python3 scripts/coverage_report.py          # requer PDFs em /tmp
python3 scripts/audit_index.py --fail-short --fail-missing
# se houver novos missing legítimos: adicionar a codes_ignore.json com motivo
# se forem bugs de extração: corrigir o parser em build_index.py e reindexar
git add scripts/coverage_report.json scripts/coverage_baseline.json
```

### 7. Regra de ouro dos códigos de erro

> "A impressora pode exibir este código no painel?"

Esse critério governa toda triagem de indexação. Se a resposta for não (part number, número de página, referência cruzada de tabela), o código vai para `codes_ignore.json` com o motivo. Se a resposta for sim, vai para o índice.

### 8. Trabalho de risco para em checkpoint

Antes de fazer qualquer alteração que possa introduzir regressão (mudar o formato de chave do índice, alterar regex de extração, trocar SDK de IA), pare e apresente um checkpoint com:
- O diagnóstico do estado atual (via git, não via documentação)
- O diff proposto
- A prova de que os testes passam antes e depois
- Qual é o plano de rollback

**Não improvise em território desconhecido.** Apresente o checkpoint e espere confirmação.

---

## Comandos Canônicos

### Testes (rodar antes de qualquer commit)

```bash
node scripts/test_findability.js   # 52 testes: searchErrorCode multi-key + isolamento cross-model
node scripts/test_providers.js     # 18 testes: resolveProviders + migração de preferências
node scripts/test_backend.js       # 18 testes: buildGeminiMessages + sync guard
```

O gate de CI (`.github/workflows/quality-gate.yml`) roda os três + `audit_index.py` em todo PR para a `main`.

### Auditoria de qualidade + cobertura

```bash
python3 scripts/audit_index.py --fail-short --fail-missing
# Saída esperada:
#   "X pendente(s) de triagem (baseline) | 0 novos — gate OK."
# Exit 1 se houver novos missing (regressão) ou fixable > 0 (regressão de build).
```

### Reindexar do zero (requer PDFs em /tmp)

```bash
# 1. Baixar PDFs que não estão bundled (Ricoh e HP E62655)
#    IDs do Google Drive estão em src/data.js → BRAND_GROUPS
#    Exemplo:
#      pip install gdown
#      gdown "https://drive.google.com/uc?id=<FILE_ID>" -O /tmp/<nome>.pdf

# 2. Gerar índices
python3 scripts/build_index.py

# 3. Gerar relatório de cobertura
python3 scripts/coverage_report.py

# 4. Verificar gate
python3 scripts/audit_index.py --fail-short --fail-missing

# 5. Commitar
git add assets/search_index.json assets/error_codes_index.json \
        scripts/coverage_report.json
git commit -m "chore: reindexar manuais"
```

### Deploy

O deploy é automático via GitHub Actions no push para `main`:
- **Alterações em `backend/`** → `sync-backend.yml` atualiza `gptmaycondb/manuais-hp` via GitHub API → Render faz redeploy automático (~2 min).
- **APK** → `build.yml` gera o APK no runner; baixar em Actions → Artifacts.

Não há deploy manual. Merge na `main` é o gatilho.

### Verificar o backend em produção

```bash
curl https://manuais-hp.onrender.com/ping
curl https://manuais-hp.onrender.com/providers
# /providers retorna {"providers":["gemini","claude"]} se as keys estiverem configuradas no Render
```

---

## Nota de Portabilidade entre Contas

**O estado verdadeiro do projeto vive no GitHub.** O histórico de tarefas dentro de qualquer agente (contexto de sessão, planos locais) é efêmero e não deve ser confiado para continuidade.

### Ao trocar de conta/executor

1. Instalar o novo executor (Codex, Claude Code, Jules) na conta nova.
2. Conectar o GitHub App ao repositório `gptmaycondb/techguide-ia`.
3. Fazer `git clone` do repo.
4. Ler este arquivo (`AGENTS.md`) e o `CLAUDE.md`.
5. Verificar branches em andamento: `git branch -r | grep -v main`.
6. Continuar a partir do último commit na branch ativa — sem perda de contexto técnico.

### Antes de uma conta expirar

**Garantir que toda branch em andamento foi commitada e pushada.** Branch local não-pushada é a única coisa que se perde numa troca de conta.

```bash
git status                   # confirmar que não há alterações não-commitadas
git push -u origin <branch>  # garantir que a branch está no GitHub
```

O plano de execução atual (se houver) deve estar documentado num commit ou num issue aberto no GitHub — não em notas locais do agente.

### O que não se perde na troca

- Todo o histórico de PRs e decisões técnicas no GitHub.
- Os índices gerados (`assets/error_codes_index.json`, `assets/search_index.json`).
- O relatório de cobertura commitado (`scripts/coverage_report.json`).
- As regras de processo (este arquivo).
- Os testes e o gate de CI.

---

## Gate de CI — Resumo Técnico

O workflow `.github/workflows/quality-gate.yml` roda em todo PR para a `main` e falha se:

| Condição | Script | Exit |
|---|---|---|
| Algum teste Node falhar | `test_findability.js`, `test_providers.js`, `test_backend.js` | 1 |
| `fixable > 0` (regressão de build do índice) | `audit_index.py --fail-short` | 1 |
| Código novo no PDF ausente do índice (fora do baseline) | `audit_index.py --fail-missing` | 1 |
| `coverage_report.json` desatualizado em relação ao `error_codes_index.json` do PR | `audit_index.py --fail-missing` | 1 |
| `coverage_baseline.json` cresceu (baseline anti-carpet) | `audit_index.py --fail-missing` | 1 |

**Modo robusto (workflow_dispatch opcional):** baixa os PDFs do Google Drive com `gdown`, roda `build_index.py` + `coverage_report.py` do zero e audita a cobertura real. Mais lento, mas pega divergências que o relatório commitado poderia mascarar. Documentado para uso manual antes de releases importantes — não roda em cada PR por custo.
