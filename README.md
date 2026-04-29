# Odonto Modular AI

MVP SaaS modular para dentistas e clinicas odontologicas, com base para cobranca por modulos e por consumo de inteligencia artificial.

## Stack

- React + TypeScript + Vite
- Tailwind CSS
- Node.js + Express
- Firebase Firestore
- JWT para autenticacao
- Upload local no MVP, preparado para trocar por S3 ou equivalente
- Camada abstrata de IA com provider mock por padrao

## Requisitos

- Node.js 20+
- Projeto Firebase com Firestore habilitado
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

3. Configure as variaveis Firebase no `.env`.

4. Rode o seed:

```bash
npm run firebase:seed
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
- `npm run firebase:seed`: cria dados demo e modulos iniciais no Firestore

## Firebase e Firestore em producao

O app usa Firebase Admin no backend e Firestore como banco principal. As rotas server-side inicializam o Firebase em `src/server/firebase.ts`.

### 1. Criar Firebase e Firestore

1. Crie ou abra um projeto no Firebase Console.
2. Ative `Firestore Database`.
3. Escolha o modo de producao.
4. Crie uma conta de servico em `Project settings` > `Service accounts`.
5. Gere uma chave JSON da conta de servico.

O backend usa o Admin SDK, entao as regras publicas do Firestore nao substituem validacao server-side. Mesmo assim, mantenha regras restritivas para acessos client-side futuros.

### 2. Configurar variaveis na Vercel

Pelo dashboard:

1. Acesse o projeto `odonto-modular-ai` na Vercel.
2. Abra `Settings` > `Environment Variables`.
3. Adicione as variaveis abaixo em `Production`.
4. Salve e faca um novo deploy para o runtime receber as variaveis.

Variaveis obrigatorias em producao:

```text
JWT_SECRET=uma-string-longa-aleatoria-e-secreta
FIREBASE_PROJECT_ID=seu-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@seu-project-id.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n
AI_PROVIDER=mock
AI_MODEL_BASIC=mock-basic
AI_MODEL_STANDARD=mock-standard
AI_MODEL_ADVANCED=mock-advanced
AI_MODEL_SPECIALIST=mock-specialist
```

Como alternativa aos tres campos `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL` e `FIREBASE_PRIVATE_KEY`, configure uma unica variavel:

```text
FIREBASE_SERVICE_ACCOUNT_BASE64=conteudo-json-da-service-account-em-base64
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
- Em `FIREBASE_PRIVATE_KEY`, preserve as quebras de linha como `\n` se estiver colando no painel da Vercel.

Tambem e possivel configurar via Vercel CLI:

```bash
npx vercel@latest env add JWT_SECRET production
npx vercel@latest env add FIREBASE_PROJECT_ID production
npx vercel@latest env add FIREBASE_CLIENT_EMAIL production
npx vercel@latest env add FIREBASE_PRIVATE_KEY production
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

### 3. Rodar seed de producao

Firestore nao usa migrations SQL. Para criar modulos iniciais e dados demo, rode o seed apontando para o projeto Firebase:

Exemplo com campos separados no PowerShell:

```powershell
$env:FIREBASE_PROJECT_ID="seu-project-id"
$env:FIREBASE_CLIENT_EMAIL="firebase-adminsdk-xxxxx@seu-project-id.iam.gserviceaccount.com"
$env:FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
npm run firebase:seed
```

Exemplo com service account em Base64:

```powershell
$json = Get-Content .\service-account.json -Raw
$env:FIREBASE_SERVICE_ACCOUNT_BASE64=[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($json))
npm run firebase:seed
```

O seed cria:

- modulos iniciais;
- clinica demo;
- usuario demo `dentista@demo.com`;
- senha demo `demo1234`;
- paciente, consulta e prontuario de exemplo.

Em um ambiente real, troque a senha demo ou remova o usuario demo depois da validacao inicial.

### 4. Testar producao

Depois de configurar variaveis, rodar seed e redeployar:

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
scripts/
  firebase-seed.ts
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
- Upload usa armazenamento local em desenvolvimento e `/tmp` em Vercel; arquivos nao sao persistentes entre execucoes serverless.
- Nao ha gateway de pagamento.
- Analise de imagem odontologica nao foi implementada, apenas deixada como caminho arquitetural.
- Permissoes por role existem na base, mas os fluxos ainda usam controle simples.
