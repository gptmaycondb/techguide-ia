# /lookup [código] — Consulta de Código de Erro

Busca um código de erro (HP ou SC Ricoh) no índice sem ler o arquivo inteiro.
Economiza ~12k tokens por consulta vs. Read do error_codes_index.json.

## Uso

```
/lookup 49.38.00
/lookup SC543
/lookup SC541-00
```

## Instruções

Use exclusivamente Bash com jq ou grep — **nunca Read em error_codes_index.json**.

### Para códigos HP (formato XX.YY.ZZ)

```bash
# Busca exata
jq '.["49.38.00"] // "Código não encontrado"' assets/error_codes_index.json

# Busca por prefixo (ex.: todos os 49.xx)
jq 'to_entries | map(select(.key | startswith("49."))) | from_entries' assets/error_codes_index.json
```

### Para SC codes Ricoh — IM C3000 (formato SC543)

```bash
# Exato
jq '.["SC543"] // .["SC54300"] // "Não encontrado"' assets/error_codes_index.json

# Grupo (ex.: todos SC54x)
jq 'to_entries | map(select(.key | test("^SC54"))) | from_entries' assets/error_codes_index.json
```

### Para SC codes Ricoh — MP C3004 (formato SC541-00)

```bash
# Exato
jq '.["SC541-00"] // "Não encontrado"' assets/error_codes_index.json

# Grupo
jq 'to_entries | map(select(.key | test("^SC541"))) | from_entries' assets/error_codes_index.json
```

## Output

Exibir:
- O código buscado
- Modelo/fonte (campo `key` nas entradas)
- Descrição do erro
- Se não encontrado: sugerir variações do formato (com/sem hífen, com/sem sufixo)
