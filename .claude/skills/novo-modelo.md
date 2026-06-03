# /novo-modelo — Adicionar Novo Modelo

Guia interativo para adicionar um novo equipamento ao TechGuide IA.
Executa o procedimento de 6 passos do CLAUDE.md de forma assistida.

## Antes de Começar

Perguntar ao usuário:
1. **Marca** — `hp` / `ricoh` / outra (se outra, avisar que parser de erros pode precisar ser criado)
2. **Nome do modelo** — ex.: "Canon iR2630", "Ricoh MP C6004"
3. **IDs dos PDFs no Google Drive** — Guia do Usuário, Service Manual, CPMD (se HP), Parts Catalog (se Ricoh)
4. **Formato dos códigos de erro** — HP: `49.XX.YZ`; Ricoh: verificar se é `SC20200` ou `SC285-00`

---

## Passo 1 — src/data.js

**Onde registrar:**
- HP → adicionar em `MANUALS`
- Ricoh / outras marcas → adicionar em `MANUALS_RICOH`

Campos obrigatórios:
```javascript
{
  id: '<marca>_<modelo>',       // ex.: 'ricoh_mpc6004', 'mfpe72535'
  brand: '<marca>',
  label: '<nome exibido>',
  subtitle: '<linha do produto>',
  color: '#0096ff',             // HP: #0096ff | Ricoh: #e63946
  indexKey: '<chave_guia>',
  searchKeys: ['<service_key>', '<guia_key>'],  // service SEMPRE primeiro (serviceKey logic)
  tags: [...],
  topics: { user: {...}, tech: {...} },
  prompts: { user: '...', tech: '...' },
}
```

Adicionar entrada em `BRAND_GROUPS` com todos os PDFs do modelo (url + localName + size).
URL format: `https://drive.usercontent.google.com/download?id=<ID>&export=download&confirm=t`

> Parts Catalog Ricoh → somente BRAND_GROUPS, NUNCA em searchKeys ou índice.

---

## Passo 2 — src/search.js → MANUAL_INDEX_MAP

```javascript
'<id_modelo>':     '<indexKey>',
'<indexKey>':      '<indexKey>',
'<service_key>':   '<service_key>',   // se houver service manual
```

---

## Passo 3 — scripts/build_index.py → PDF_SOURCES

```python
'<indexKey>':    [Path('/tmp/<nome_guia>.pdf')],
'<service_key>': [Path('/tmp/<nome_service>.pdf')],
```

**Ricoh:** adicionar bloco em `build_error_codes_index()` espelhando o bloco
"Ricoh MP C3004/3504 Service Manual". Passar `service_key` explicitamente:
```python
errors = extract_ricoh_sc_sections(text, '<service_key>')
groups = extract_ricoh_sc_groups(text, '<service_key>')
```

**HP com CPMD:** usar `extract_hp_errors_from_cpmd()` se houver arquivo CPMD/erros.

> **Ricoh:** após rodar o script, verificar no log se o contador de SC codes é > 0.
> Se for 0, o formato no service manual pode diferir — checar SC20200 vs SC285-00.

---

## Passo 4 — src/tips.js

Adicionar bloco com **mínimo 5 dicas** com `model: '<id_modelo>'`.

Regras:
- Basear EXCLUSIVAMENTE nos manuais reais — nunca inventar part numbers ou SC codes
- SC codes Ricoh: usar o formato exato como aparece no painel do equipamento
- Part numbers HP: verificar no service manual ou CPMD antes de incluir
- Dicas genéricas da marca (sem `model`) só se o conteúdo for válido para TODOS os modelos da marca

Categorias sugeridas (3–5 dicas em cada para modelos principais):
- Atolamentos (códigos, rolos, part numbers)
- Toner/suprimentos (part numbers verificados)
- Erros críticos (firmware, fusor, motor)
- Qualidade de impressão

---

## Passo 5 — Reindexar

```bash
# Baixar PDFs para /tmp/ (IDs estão em BRAND_GROUPS)
gdown "https://drive.google.com/uc?id=<ID>" -O /tmp/<nome>.pdf

# Indexar
python3 scripts/build_index.py

# Verificar contagens no log — cada chave deve ter > 0 chunks
```

---

## Passo 6 — Verificar com /audit

Rodar `/audit` antes de commitar. Confirmar:
- Novo modelo aparece em todos os checks sem ❌
- Modelos existentes continuam passando (regressão)

Commitar somente após `/audit` retornar ✅ APROVADO.
