# /auditoria — Checklist Pré-Merge

Execute esta auditoria **antes de qualquer merge para main**. Verifica consistência
entre os arquivos do projeto, integridade das dicas e cobertura dos índices.

## Instruções

Leia os arquivos a seguir e execute cada item do checklist. Gere um relatório final
com ✅ PASSOU / ⚠️ AVISO / ❌ ERRO para cada item. Se houver qualquer ❌, corrija
antes de aprovar o merge.

---

## 1. src/tips.js — Contaminação cruzada entre modelos

**Problema mais comum:** dicas com `brand: 'ricoh'` sem `model` que mencionam
equipamentos específicos aparecem para TODOS os modelos Ricoh.

Verificar:
- [ ] Toda dica cujo texto menciona "IM C3000", "IM C3500", "IM C3000/3500" tem `model: 'ricoh_imc3000'`
- [ ] Toda dica cujo texto menciona "MP C3004", "MP C3504" tem `model: 'ricoh_mpc3004'`
- [ ] Toda dica com `model: 'mfpe52645'` não cita outros modelos HP
- [ ] Toda dica com `model: 'mfpe62655'` não cita outros modelos HP
- [ ] Códigos SC no formato `SC543` (sem sufixo) são restritos a `model: 'ricoh_imc3000'`
- [ ] Códigos SC no formato `SC541-00` (com hífen) são restritos a `model: 'ricoh_mpc3004'`
- [ ] Part numbers HP (formato `CF287A`, `W9004MC`, `J8J87A`, `RM2-xxxx`) pertencem
     ao modelo correto — nunca referenciar peça de modelo diferente

---

## 2. src/data.js — Consistência dos registros

- [ ] Todos os modelos em `MANUALS` (HP) e `MANUALS_RICOH` têm `searchKeys` definido
- [ ] `indexKey` de cada modelo está incluído em seu próprio `searchKeys`
- [ ] Para modelos Ricoh com service manual: `searchKeys` inclui a chave `*_service`
     (necessário para o `serviceKey` do ChatScreen funcionar corretamente)
- [ ] Todos os modelos têm entrada correspondente em `BRAND_GROUPS`
- [ ] Nenhum `url` em `BRAND_GROUPS` aponta para ID de Drive incorreto ou de outro modelo

---

## 3. src/search.js — MANUAL_INDEX_MAP

- [ ] Todo `id` em `ALL_MANUALS` tem entrada em `MANUAL_INDEX_MAP`
- [ ] Todo valor em `searchKeys` de qualquer modelo tem entrada em `MANUAL_INDEX_MAP`
- [ ] Cada chave de índice aponta para si mesma (ex.: `'e62655_service': 'e62655_service'`)

Verificação rápida: listar todos os `searchKeys` de `data.js` e confirmar que cada um
está em `MANUAL_INDEX_MAP`.

---

## 4. src/ChatScreen.js — Roteamento data-driven

- [ ] `serviceKey` é derivado via `searchKeys.find(k => k.includes('service')) || primaryKey`
- [ ] `searchErrorCode` recebe `serviceKey` como segundo argumento
- [ ] `noChunksMsg` usa `manual.label` (não string hardcoded de modelo específico)
- [ ] Não há roteamento hardcoded por marca (ex.: `if brand === 'ricoh'`)

---

## 5. CLAUDE.md — Documentação atualizada

- [ ] Tabela "Manuais atuais indexados" lista todos os modelos presentes em `data.js`
- [ ] Seção "Como adicionar um novo modelo" reflete o fluxo atual
- [ ] Seção "Parsers de erro por marca" está atualizada

---

## Relatório Final

Ao terminar, imprimir:

```
=== AUDITORIA PRÉ-MERGE ===
[data/hora]

tips.js
  ✅/⚠️/❌  item...

data.js
  ✅/⚠️/❌  item...

search.js
  ✅/⚠️/❌  item...

ChatScreen.js
  ✅/⚠️/❌  item...

CLAUDE.md
  ✅/⚠️/❌  item...

RESULTADO: ✅ APROVADO PARA MERGE / ❌ BLOQUEADO — X problema(s) encontrado(s)
```

Se bloqueado, listar os problemas com arquivo e linha para correção imediata.
