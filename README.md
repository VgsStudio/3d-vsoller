# 3D · Vitor Soller

Log público (só leitura) das impressões 3D feitas na Ender 3 V3 — `3d.vsoller.com.br`.

## Arquitetura

- **Frontend**: Vite + React + TypeScript, SPA estática (`web/`).
- **Backend**: Lambda em Python, sem dependências externas além do `boto3` já embutido no runtime (`backend/`).
- **Dados**: DynamoDB (`vsoller-3d-prints`).
- **Mídia**: bucket S3 dedicado (fotos, STL, gcode).
- **API**: API Gateway HTTP API, domínio próprio `api.3d.vsoller.com.br`.
- **Hosting do site**: S3 + CloudFront + Route53 (`3d.vsoller.com.br`), reaproveitando a hosted zone já existente de `vsoller.com.br`.
- **IaC**: AWS CDK v2 (TypeScript) — `infra/`.

Tudo 100% serverless: sem servidor fixo, custo essencialmente pay-per-use (na prática, poucos dólares/mês pra um site pessoal de baixo tráfego).

## Estrutura

```
3d-vsoller/
├── infra/      # AWS CDK (TypeScript) — toda a infraestrutura
├── backend/    # Lambda Python (API: listar/criar/atualizar impressões, URLs de upload)
├── web/        # Frontend Vite + React + TS
└── scripts/    # update_print.py — CLI pra publicar/atualizar impressões via API
```

## Deploy

```bash
cd infra
npm install
npm run cdk deploy
```

O CDK cria: tabela DynamoDB, buckets S3 (site + mídia), Lambda, HTTP API com domínio próprio,
certificados ACM (validação DNS automática via Route53) e o distribution do CloudFront com o
registro DNS de `3d.vsoller.com.br`.

Depois do deploy, publicar o frontend:

```bash
cd web
npm install
npm run build
aws s3 sync dist/ s3://<SiteBucketName> --delete
aws cloudfront create-invalidation --distribution-id <DistributionId> --paths "/*"
```

(os nomes exatos do bucket e da distribution saem nos `Outputs` do `cdk deploy`.)

## Atualizando o log de impressões

A chave de admin (`ADMIN_API_KEY`) fica em `infra/.env` (não versionado) e também injetada como
variável de ambiente da Lambda. Para publicar/atualizar impressões:

```bash
export VSOLLER_3D_API_KEY=<a chave>

# nova impressão
python scripts/update_print.py create --title "Chaveiro AWS 30mm" \
  --material PLA --status printing --started-at 2026-08-17T11:46:00

# progresso ao vivo
python scripts/update_print.py update <id> --progress 42

# fim da impressão
python scripts/update_print.py update <id> --status completed \
  --duration 4888 --grams 38 --finished-at 2026-08-17T13:08:00

# anexar foto/STL/gcode (upload direto pro S3 via URL assinada)
python scripts/update_print.py upload <id> --kind photo --file foto.jpg
python scripts/update_print.py upload <id> --kind stl --file peca.stl
```

Uma impressão com `"hidden": true` fica fora da listagem pública (a rota de detalhe também
passa a devolver 404), mas continua existindo no banco — útil pra impressões que não devem
aparecer no site.
