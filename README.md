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
- `npm run prisma:seed`: cria dados demo e modulos iniciais

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
