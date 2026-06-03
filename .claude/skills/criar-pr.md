# /criar-pr — Criar Pull Request

Gera título e corpo do PR a partir do histórico de commits e diff atual.
Segue o padrão do projeto: Summary em bullets + Test plan como checklist.

## Passo 1 — Coletar contexto do branch

```bash
# Commits à frente do main
git log main...HEAD --oneline

# Diff resumido (arquivos e estatísticas)
git diff main...HEAD --stat

# Branch atual
git branch --show-current
```

## Passo 2 — Analisar as mudanças

Categorizar os commits por tipo:
- `feat:` → nova funcionalidade
- `fix:` → correção de bug
- `docs:` → documentação
- `chore:` → manutenção/infraestrutura

Identificar o tema principal da branch para o título do PR.

## Passo 3 — Gerar título

Regras:
- Máximo 70 caracteres
- Começar com verbo no imperativo: "Adicionar", "Corrigir", "Atualizar"
- Não incluir número de commits nem detalhes técnicos

## Passo 4 — Gerar corpo

Formato:

```markdown
## Summary
- <bullet principal — o que muda e por quê>
- <bullet 2 se relevante>
- <bullet 3 se relevante>

## Arquivos principais alterados
- `src/data.js` — <o que mudou>
- `src/tips.js` — <o que mudou>
- (listar apenas os arquivos com mudanças significativas)

## Test plan
- [ ] Abrir o app → selecionar <modelo afetado> → testar query relacionada
- [ ] Verificar que modelos não afetados continuam funcionando (regressão)
- [ ] <check específico da mudança>
- [ ] /audit passou sem ❌

## Notas
<Apenas se houver contexto importante que não fica claro nos commits>
```

## Passo 5 — Confirmar e criar

Mostrar o título e corpo gerados para revisão antes de criar.
Após aprovação, criar via GitHub MCP:

```
mcp__github__create_pull_request com:
  owner: gptmaycondb
  repo: techguide-ia
  head: <branch atual>
  base: main
  title: <título gerado>
  body: <corpo gerado>
```

> Só criar o PR se o usuário confirmar explicitamente.
