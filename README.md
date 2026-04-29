# Odonto Modular AI

MVP SaaS modular para dentistas e clinicas odontologicas, com base para cobranca por modulos e por consumo de inteligencia artificial.

## Stack

- React + TypeScript + Vite
- Tailwind CSS
- Node.js + Express
- PostgreSQL + Prisma
- JWT para autenticacao
- Upload local no MVP, preparado para trocar por S3 ou equivalente
- Camada abstrata de IA com provider mock por padrao

## Requisitos

- Node.js 20+
- PostgreSQL local ou remoto
- npm

## Configuracao local

1. Instale dependencias:

```bash
npm install
```

2. Copie o arquivo de ambiente:

```bash
cp .env.example .env
```

3. Ajuste `DATABASE_URL` no `.env`.

4. Rode migracao e seed:

```bash
npm run prisma:migrate
npm run prisma:seed
```

5. Inicie a aplicacao:

```bash
npm run dev
```

Frontend: `http://localhost:5173`

API: `http://localhost:4000/api`

Login demo:

- E-mail: `dentista@demo.com`
- Senha: `demo1234`

## Scripts

- `npm run dev`: sobe API Express e Vite
- `npm run server:dev`: sobe apenas a API
- `npm run client:dev`: sobe apenas o frontend
- `npm run build`: compila backend e frontend
- `npm run start`: executa build de producao
- `npm run typecheck`: valida TypeScript
- `npm run prisma:generate`: gera Prisma Client
- `npm run prisma:migrate`: cria/aplica migracoes locais
- `npm run prisma:migrate:deploy`: aplica migracoes pendentes em producao
- `npm run prisma:seed`: cria dados demo e modulos iniciais

## Banco de producao na Vercel

O app usa PostgreSQL via Prisma. A conexao com o banco e lida pelo Prisma em `prisma/schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

Em producao, `DATABASE_URL` precisa existir nas variaveis de ambiente do projeto Vercel. Sem essa variavel, rotas que acessam o banco, como `/api/auth/login`, retornam erro interno.

### 1. Criar um PostgreSQL de producao

Use um provedor PostgreSQL gerenciado, por exemplo:

- Vercel Postgres ou Neon via Vercel Marketplace
- Neon
- Supabase
- Railway
- Render
- AWS RDS

Crie um banco para producao e copie a connection string no formato PostgreSQL:

```text
postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public&sslmode=require
```

Nao use a URL local `localhost` em producao. A Vercel precisa acessar um host publico ou gerenciado.

### 2. Configurar variaveis na Vercel

Pelo dashboard:

1. Acesse o projeto `odonto-modular-ai` na Vercel.
2. Abra `Settings` > `Environment Variables`.
3. Adicione as variaveis abaixo em `Production`.
4. Salve e faca um novo deploy para o runtime receber as variaveis.

Variaveis obrigatorias em producao:

```text
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public&sslmode=require
JWT_SECRET=uma-string-longa-aleatoria-e-secreta
AI_PROVIDER=mock
AI_MODEL_BASIC=mock-basic
AI_MODEL_STANDARD=mock-standard
AI_MODEL_ADVANCED=mock-advanced
AI_MODEL_SPECIALIST=mock-specialist
```

Variaveis opcionais:

```text
UPLOAD_DIR=/tmp/uploads
PORT=4000
```

Observacoes:

- `UPLOAD_DIR` pode ser omitida na Vercel. O app usa `/tmp/uploads` automaticamente quando detecta `VERCEL`.
- `PORT` pode ser omitida na Vercel. Ela e relevante apenas para execucao local com `npm run start`.
- `JWT_SECRET` deve ser diferente do valor de exemplo.

Tambem e possivel configurar via Vercel CLI:

```bash
npx vercel@latest env add DATABASE_URL production
npx vercel@latest env add JWT_SECRET production
npx vercel@latest env add AI_PROVIDER production
npx vercel@latest env add AI_MODEL_BASIC production
npx vercel@latest env add AI_MODEL_STANDARD production
npx vercel@latest env add AI_MODEL_ADVANCED production
npx vercel@latest env add AI_MODEL_SPECIALIST production
```

Depois de alterar variaveis:

```bash
npx vercel@latest --prod
```

### 3. Rodar migracoes em producao

Com `DATABASE_URL` apontando para o banco de producao, rode:

```bash
npm run prisma:generate
npm run prisma:migrate:deploy
```

Exemplo local no PowerShell, sem salvar credenciais no Git:

```powershell
$env:DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public&sslmode=require"
npm run prisma:migrate:deploy
```

`prisma migrate deploy` aplica migrations existentes e e o comando adequado para ambiente de producao. Use `prisma migrate dev` apenas em desenvolvimento local.

### 4. Rodar seed de producao

Depois das migracoes:

```bash
npm run prisma:seed
```

Exemplo local no PowerShell:

```powershell
$env:DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public&sslmode=require"
npm run prisma:seed
```

O seed cria:

- modulos iniciais;
- clinica demo;
- usuario demo `dentista@demo.com`;
- senha demo `demo1234`;
- paciente, consulta e prontuario de exemplo.

Em um ambiente real, troque a senha demo ou remova o usuario demo depois da validacao inicial.

### 5. Testar producao

Depois de configurar variaveis, aplicar migrations, rodar seed e redeployar:

```bash
curl https://odonto-modular-ai.vercel.app/api/health
```

Depois acesse:

```text
https://odonto-modular-ai.vercel.app
```

Login demo:

```text
dentista@demo.com
demo1234
```

Se o login ainda falhar, verifique os logs:

```bash
npx vercel@latest logs https://odonto-modular-ai.vercel.app --no-follow --level error --since 10m --expand
```

## Modulos iniciais

- Pacientes
- Agenda
- Prontuario
- Documentos
- IA Basica
- IA Avancada
- Cobranca
- Seguranca avancada

Cada modulo tem `basePrice` e pode ser ativado/desativado por clinica em `ClinicModule`.

## IA no MVP

A API exposta e:

```ts
generateText({
  featureKey,
  precisionLevel,
  input,
  context,
  userId,
  clinicId,
  patientId
})
```

Funcoes disponiveis:

- `record-summary`
- `clinical-report`
- `patient-guidance`

Se nao houver provider real configurado, o servico usa mock seguro, estima tokens, calcula custo, grava `AIUsageLog` e cria `BillingEvent`.

Aviso exibido em conteudos clinicos:

> Conteudo gerado por inteligencia artificial para apoio profissional. A decisao clinica final deve ser tomada por cirurgiao-dentista habilitado.

## Cobranca

A estimativa mensal considera:

```ts
monthlyPrice = basePlanPrice + activeModulesPrice + storagePrice + aiUsagePrice + securityPrice
```

O MVP nao integra gateway de pagamento. Os eventos de consumo ficam em `BillingEvent`.

## Seguranca e LGPD

Implementado na base:

- Senhas com bcrypt
- JWT
- Separacao de dados por `clinicId`
- Validacao de entrada com Zod
- Auditoria inicial em `ActionLog`
- Consentimento de IA em `Patient.consentForAI`
- Aviso obrigatorio para conteudo gerado por IA

Pontos para evolucao:

- MFA
- Controle de permissao granular por modulo
- Politicas de retencao
- Criptografia em campos sensiveis
- Consentimentos versionados
- Logs imutaveis

## Estrutura

```text
prisma/
  schema.prisma
  seed.ts
src/
  client/
    App.tsx
    api.ts
    styles.css
  server/
    middleware/
    routes/
    services/
    config.ts
    db.ts
    index.ts
```

## Limitacoes do MVP

- A IA real ainda nao esta conectada a um provider externo.
- Upload usa armazenamento local.
- Nao ha gateway de pagamento.
- Analise de imagem odontologica nao foi implementada, apenas deixada como caminho arquitetural.
- Permissoes por role existem na base, mas os fluxos ainda usam controle simples.
