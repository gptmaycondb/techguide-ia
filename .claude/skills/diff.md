# /diff — Revisão do Diff Atual

Revisa apenas o que mudou desde o último commit ou upstream.
Não lê arquivos completos — economiza tokens proporcional ao tamanho dos arquivos tocados.

## Instruções

```bash
# Diff completo (staged + unstaged)
git diff HEAD

# Diff contra upstream (o que será incluído no PR)
git diff @{upstream}...HEAD 2>/dev/null || git diff main...HEAD
```

Revisar o diff linha a linha. Para cada hunk alterado, verificar:

### Checklist por arquivo

**src/tips.js:**
- [ ] Dicas novas têm `model:` definido se mencionam equipamento específico
- [ ] Part numbers são do modelo correto (não cruzado)
- [ ] SC codes Ricoh usam formato do modelo (sem sufixo = IM C3000, com hífen = MP C3004)

**src/data.js:**
- [ ] `searchKeys` inclui `indexKey`
- [ ] `searchKeys` tem `*_service` se o modelo tem service manual
- [ ] `BRAND_GROUPS` tem `url` preenchida

**src/search.js:**
- [ ] Novas entradas em MANUAL_INDEX_MAP apontam para si mesmas
- [ ] Todos os valores de `searchKeys` adicionados têm entrada no mapa

**src/ChatScreen.js:**
- [ ] `serviceKey` derivado de `searchKeys.find(k => k.includes('service'))`
- [ ] Sem roteamento hardcoded por marca

**scripts/build_index.py:**
- [ ] `service_key` passado explicitamente para `extract_ricoh_sc_sections()`
- [ ] Novos blocos em `build_error_codes_index()` não sobrescrevem entradas existentes

**CLAUDE.md:**
- [ ] Tabela de manuais indexados atualizada se chunks mudaram

## Quando ler arquivo completo

Só fazer Read de um arquivo se o diff sozinho for insuficiente para entender o contexto
de uma mudança. Nesse caso, ler apenas o trecho relevante com `offset` + `limit`.

## Output

Lista de ✅/⚠️/❌ por arquivo tocado. Se tudo ok: "✅ diff limpo — pode commitar."
