# 3D · Vitor Soller

Central pública (só leitura) do que acontece na minha Ender 3 V3 — `3d.vsoller.com.br`. Timeline com
impressões, problemas de hardware e manutenções, mais recente primeiro. Repositório público, sem
nenhuma informação sensível versionada (chave de admin fica só em segredo do GitHub Actions / `.env`
local, nunca no código).

## Arquitetura

- **Frontend**: Vite + React + TypeScript, SPA estática (`web/`). Design híbrido: acento azul do
  OctoPrint + par de fontes mono/sans dos relatórios de impressão, paleta grafite quase-preta e
  polimento com framer-motion no estilo do site principal (vsoller.com.br).
- **Backend**: Lambda em Python, sem dependências externas além do `boto3` já embutido no runtime (`backend/`).
- **Dados**: DynamoDB (`vsoller-3d-prints`) — cada item pode ser categoria `print`, `issue` ou `maintenance`.
- **Mídia**: bucket S3 dedicado (fotos, STL, gcode).
- **API**: API Gateway HTTP API, domínio próprio `api.3d.vsoller.com.br`.
- **Hosting do site**: S3 + CloudFront + Route53 (`3d.vsoller.com.br`), reaproveitando a hosted zone já existente de `vsoller.com.br`.
- **IaC**: AWS CDK v2 (TypeScript) — `infra/`.
- **CI/CD**: GitHub Actions (`.github/workflows/deploy.yml`), autenticando via OIDC (sem access keys) —
  todo push em `main` builda o frontend e roda `cdk deploy --all`, que já sincroniza o S3 e invalida o
  CloudFront (via `BucketDeployment`, não precisa de passo manual).

Tudo 100% serverless: sem servidor fixo, custo essencialmente pay-per-use (na prática, poucos dólares/mês pra um site pessoal de baixo tráfego).

## Estrutura

```
3d-vsoller/
├── .github/workflows/deploy.yml  # CI/CD — build + cdk deploy no push pra main
├── infra/      # AWS CDK (TypeScript) — toda a infraestrutura + o role de OIDC do GH Actions
├── backend/    # Lambda Python (API: listar/criar/atualizar impressões, URLs de upload)
├── web/        # Frontend Vite + React + TS
└── scripts/    # update_print.py — CLI pra publicar/atualizar impressões via API
```

## Deploy

Automático: qualquer push em `main` dispara o workflow. Pra rodar manualmente (ex: primeira vez,
ou iterando local):

```bash
cd web && npm install && npm run build   # o CDK empacota web/dist direto no BucketDeployment
cd ../infra && npm install
npm run cdk deploy -- --all
```

O CDK cria: tabela DynamoDB, buckets S3 (site + mídia), Lambda, HTTP API com domínio próprio,
certificados ACM (validação DNS automática via Route53), o distribution do CloudFront com o
registro DNS de `3d.vsoller.com.br`, o role de OIDC do GitHub Actions, **e já sincroniza o
conteúdo de `web/dist` pro bucket do site + invalida o CloudFront** (via `s3deploy.BucketDeployment`
em `three-d-stack.ts`) — não precisa de `aws s3 sync`/`create-invalidation` manual.

## Atualizando o log de impressões

A chave de admin (`ADMIN_API_KEY`) fica em `infra/.env` (não versionado, usada nos deploys locais)
e como segredo `ADMIN_API_KEY` no GitHub Actions (usado nos deploys automáticos) — nunca commitada.
Para publicar/atualizar impressões:

```bash
export VSOLLER_3D_API_KEY=<a chave>

# nova impressão
python scripts/update_print.py create --title "Chaveiro AWS 30mm" \
  --material PLA --status printing --started-at 2026-08-17T11:46:00

# progresso ao vivo (o site atualiza sozinho via polling, sem precisar dar refresh)
python scripts/update_print.py update <id> --progress 42

# fim da impressão
python scripts/update_print.py update <id> --status completed \
  --duration 4888 --grams 38 --finished-at 2026-08-17T13:08:00

# anexar foto/STL/gcode (upload direto pro S3 via URL assinada)
python scripts/update_print.py upload <id> --kind photo --file foto.jpg
python scripts/update_print.py upload <id> --kind stl --file peca.stl

# problema ou manutenção de hardware, não uma peça (aparece nas abas Problemas/Manutenção)
python scripts/update_print.py create --title "..." --json-file payload.json
# payload.json: {"category": "issue", "status": "monitoring", "description": "..."}
```

Título/descrição com acento: **sempre via `--json-file payload.json`**, nunca como argumento de
linha de comando (ver nota no próprio `--help` do script).

Uma impressão com `"hidden": true` fica fora da listagem pública (a rota de detalhe também
passa a devolver 404), mas continua existindo no banco — útil pra impressões que não devem
aparecer no site.
