# /tips-gen [model-id] — Gerar Rascunho de Dicas

Gera dicas para um modelo consultando os chunks reais do search_index.
Use ao adicionar novo modelo ou para enriquecer dicas existentes.

**Nunca inventar part numbers ou SC codes — apenas o que estiver nos chunks.**

## Passo 1 — Identificar as chaves do modelo

```bash
MODEL="<model-id>"  # ex: ricoh_mpc3004, mfpe62655

# Buscar searchKeys do modelo em data.js
grep -A 30 "id: '$MODEL'" src/data.js | grep -E "searchKeys|indexKey"
```

## Passo 2 — Extrair chunks representativos (sem ler o arquivo inteiro)

Para cada chave em `searchKeys`, extrair amostras temáticas via jq:

```bash
# Chunks de erros/SC codes (buscar por padrão SC ou erro)
jq --arg k "<service_key>" '.[$k] | map(select(.k | test("SC|erro|fault|fuser|fusao|tambor|drum|laser";"i"))) | .[0:8] | .[].t' assets/search_index.json

# Chunks de suprimentos/part numbers
jq --arg k "<service_key>" '.[$k] | map(select(.k | test("part|peca|toner|cartucho|kit|roller|rolo";"i"))) | .[0:6] | .[].t' assets/search_index.json

# Chunks do guia (atolamentos, operação)
jq --arg k "<guia_key>" '.[$k] | map(select(.k | test("jam|atol|papel|feed|tray|bandeja";"i"))) | .[0:5] | .[].t' assets/search_index.json
```

## Passo 3 — Verificar dicas existentes

```bash
grep -A2 "model: '$MODEL'" src/tips.js
```

## Passo 4 — Gerar rascunho

Com base nos chunks extraídos, gerar 6–10 dicas seguindo estas regras:

- `{ brand: '<brand>', model: '<model-id>', text: '...' }`
- Cobrir: atolamentos, toner/suprimentos, erros críticos, qualidade de impressão
- Part numbers: copiar exatamente como aparecem nos chunks (nunca reescrever)
- SC codes Ricoh: usar o formato do modelo (IM C3000 = `SC543`, MP C3004 = `SC541-00`)
- Dicas genéricas da marca (sem `model`) só se válidas para TODOS os modelos da marca
- Máximo 160 caracteres por dica (exibição na bolha flutuante)

## Passo 5 — Validar antes de propor

Checar cada dica gerada:
- [ ] Part number aparece literalmente em algum chunk extraído?
- [ ] SC code aparece literalmente em algum chunk?
- [ ] A dica não cita outro modelo por engano?

Apresentar o rascunho e aguardar aprovação antes de editar `src/tips.js`.
