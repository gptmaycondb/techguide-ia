# /reindex — Reindexar Manuais

Orquestra o processo completo de reindexação. Use quando:
- Adicionar novo modelo (após configurar PDF_SOURCES)
- Atualizar um PDF existente
- Regenerar os JSONs do zero em novo ambiente

---

## Passo 1 — Verificar PDFs presentes em /tmp/

```bash
ls -lh /tmp/*.pdf 2>/dev/null || echo "Nenhum PDF em /tmp/"
```

---

## Passo 2 — Identificar PDFs ausentes

Comparar com `PDF_SOURCES` em `scripts/build_index.py`. Os PDFs bundled em
`assets/manuals/` não precisam estar em `/tmp/` — são lidos diretamente.

Para cada PDF ausente em `/tmp/`, mostrar o comando gdown correspondente:

| Chave de índice         | Arquivo esperado em /tmp/          | ID Google Drive                      |
|-------------------------|------------------------------------|--------------------------------------|
| `e62655_guia`           | `e62655_guia.pdf`                  | `1nReLfTlkWvTXU8JEdUNnkqrYZ_kNEdG8` |
| `e62655_cpmd`           | `e62655_cpmd.pdf`                  | `1PKE-eD_-Ixk5vfC9ANb45nyDlHiJbcDf` |
| `e62655_service`        | `e62655_service.pdf` (71 MB)       | `1hg-Ji4DNHCQXu2y1w5pO9cOj3oD-NsaJ` |
| `ricoh_imc3000_guia`    | `ricoh_guia.pdf`                   | ver `src/data.js → ricoh_imc3000_group` |
| `ricoh_imc3000_service` | `ricoh_service.pdf` (84 MB)        | ver `src/data.js → ricoh_imc3000_group` |
| `ricoh_imc3000_parts`   | `ricoh_parts.pdf`                  | ver `src/data.js → ricoh_imc3000_group` |
| `ricoh_mpc3004_guia`    | `ricoh_mpc3004_guia.pdf` (7 MB)    | `1NbV4S5IIX5e8wX4spY2TciXzfhdYy-rC` |
| `ricoh_mpc3004_service` | `ricoh_mpc3004_service.pdf` (61 MB)| `1ylExuQ9rQJsi25u4VEhnSb1BG05l05QA` |

Comando para baixar:
```bash
gdown "https://drive.google.com/uc?id=<ID>" -O /tmp/<arquivo>.pdf
```

---

## Passo 3 — Confirmar antes de rodar

Listar o que será indexado (chaves com PDFs presentes) e o que será pulado
(chaves com PDFs ausentes). Perguntar ao usuário se pode continuar.

---

## Passo 4 — Rodar o indexador

```bash
python3 scripts/build_index.py
```

Monitorar o log de saída. Verificar:
- Cada chave configurada aparece com contagem de chunks > 0
- Chaves Ricoh: verificar contagem de SC codes extraídos (deve ser > 0 para service manuals)
- Se alguma chave aparecer com 0 chunks: **parar e investigar** antes de commitar

---

## Passo 5 — Atualizar CLAUDE.md

Após reindexação bem-sucedida, atualizar a tabela "Manuais atuais indexados"
no `CLAUDE.md` com as novas contagens de chunks do log.

---

## Passo 6 — Commitar

```bash
git add assets/search_index.json assets/error_codes_index.json
git commit -m "chore: reindexar manuais"
git push
```

> Não commitar `assets/manuals/*.pdf` — os PDFs bundled já estão no repo.
> Os PDFs de /tmp/ (Ricoh, E62655) não são versionados.
