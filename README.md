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
OPENAI_API_KEY=sk-...
OPENAI_VISION_MODEL=gpt-5.5
PAYMENT_PROVIDER=mock
PAYMENT_WEBHOOK_SECRET=uma-string-secreta-para-webhooks
STRIPE_SECRET_KEY=sk_live_ou_sk_test
STRIPE_WEBHOOK_SECRET=whsec_...
APP_BASE_URL=https://odonto-modular-ai.vercel.app
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
npx vercel@latest env add OPENAI_API_KEY production
npx vercel@latest env add OPENAI_VISION_MODEL production
npx vercel@latest env add PAYMENT_PROVIDER production
npx vercel@latest env add PAYMENT_WEBHOOK_SECRET production
npx vercel@latest env add STRIPE_SECRET_KEY production
npx vercel@latest env add STRIPE_WEBHOOK_SECRET production
npx vercel@latest env add APP_BASE_URL production
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

Os modulos sao organizados por escopo:

- `COMMON`: modulos comuns a todas as areas da odontologia;
- `SPECIALTY`: modulos especificos de uma especialidade.

Na interface, a tela `Modulos` possui uma aba raiz `Comuns` e abas por especialidade. Cada modulo continua sendo ativavel/desativavel por clinica e participando da cobranca mensal.

Quando uma clinica ativa qualquer modulo de especialidade, o menu `Especialidades` fica disponivel. Essa area mostra apenas os modulos especificos ativos e permite registrar acompanhamentos, notas e status por paciente dentro de cada modulo. Modulos com tela propria, como `IA para imagens de exames`, continuam expondo sua funcionalidade dedicada.

Todos os modulos de especialidade ativos possuem acoes de IA:

- `Analisar IA`: gera uma analise tecnica do contexto do modulo;
- `Perguntar IA`: responde uma pergunta livre com base no paciente, modulo e historico recente.

Perguntas para IA sao cobradas por pergunta realizada, independentemente da especialidade perguntada estar ativa como modulo. Isso permite que uma clinica assine uma especialidade especifica, mas ainda faca perguntas pontuais sobre outras areas usando a tela `Uso de IA`. No MVP, `specialty-question` gera um evento `AI_QUESTION` e aplica uma cobranca minima por pergunta, alem do registro de tokens em `AIUsageLog`.

Os precos de modulos e submodulos podem ser ajustados pela OEL Startup no `Console OEL Startup`, na secao `Precificacao de modulos`. O valor editado atualiza o `basePrice` no Firestore e passa a ser usado por:

- tela de modulos da clinica;
- estimativa mensal;
- eventos de cobranca por ativacao/desativacao;
- telas de especialidades.

A sincronizacao automatica de modulos preserva precos editados pela OEL Startup. O campo `defaultBasePrice` guarda o valor inicial sugerido do MVP para referencia.

Nas funcoes de IA por submodulo, o contexto e restrito por padrao aos dados adicionados naquele submodulo e ao historico do mesmo modulo. O prontuario e as imagens do paciente so entram na entrada enviada para IA quando o usuario marca explicitamente `Incluir prontuario deste paciente na IA` ou `Incluir imagens/analises deste paciente na IA`. Essa regra evita mistura indevida de dados entre especialidades/submodulos e reduz consumo desnecessario.

A Radiologia Odontologica e Imaginologia e organizada em submodulos comerciais e funcionais. Cada submodulo pode ser ativado/desativado individualmente, possui preco proprio e aparece separadamente em `Especialidades` quando ativo:

- Radiologia com inteligencia artificial: R$ 199,90/mes;
- Laudos radiologicos: R$ 129,90/mes;
- Radiologia convencional intraoral: R$ 89,90/mes;
- Radiologia extraoral: R$ 99,90/mes;
- Tomografia computadorizada CBCT: R$ 169,90/mes;
- Radiologia para planejamento cirurgico: R$ 149,90/mes;
- Imaginologia digital: R$ 119,90/mes;
- Diagnostico por imagem: R$ 139,90/mes;
- Radiologia para patologias bucais: R$ 149,90/mes;
- Radiologia ortodontica: R$ 119,90/mes;
- Radiologia endodontica: R$ 129,90/mes;
- Radiologia para implantodontia: R$ 149,90/mes.

Campos especificos de cada submodulo de Radiologia entram no registro e no contexto de IA: submodulo, escopo, modalidade de imagem, regiao/estrutura avaliada, indicacao clinica, achados radiologicos, hipotese/diagnostico por imagem, recomendacao/conduta sugerida e observacoes. O submodulo `Radiologia com inteligencia artificial` tambem habilita a tela dedicada `Exames IA` para upload de imagem e analise visual.

A Endodontia e organizada em submodulos comerciais e funcionais, sem tratar essas frentes como especialidades formais reconhecidas pelo CFO. Cada submodulo pode ser ativado/desativado individualmente, possui preco proprio e aparece separadamente em `Especialidades` quando ativo:

- Planejamento endodontico: R$ 89,90/mes;
- Endodontia clinica convencional: R$ 79,90/mes;
- Endodontia microscopica: R$ 129,90/mes;
- Endodontia cirurgica / parendodontica: R$ 149,90/mes;
- Endodontia regenerativa: R$ 159,90/mes;
- Endodontia biologica / vital: R$ 99,90/mes;
- Diagnostico endodontico avancado: R$ 119,90/mes;
- Microbiologia endodontica: R$ 109,90/mes;
- Endodontia tecnologica: R$ 119,90/mes.

Campos especificos de cada submodulo endodontico entram no registro e no contexto de IA: submodulo, escopo, dente/regiao, hipotese diagnostica, status pulpar, status periapical, achados de imagem, objetivo endodontico, canais, testes e observacoes.

A Implantodontia tambem e organizada em submodulos comerciais e funcionais. Cada submodulo pode ser ativado/desativado individualmente, possui preco proprio e aparece separadamente em `Especialidades` quando ativo:

- Planejamento de implantes: R$ 149,90/mes;
- Implantodontia cirurgica: R$ 139,90/mes;
- Implantodontia protetica: R$ 129,90/mes;
- Implantodontia com regeneracao ossea: R$ 159,90/mes;
- Implantodontia com cirurgias avancadas: R$ 179,90/mes;
- Implantodontia imediata: R$ 149,90/mes;
- Implantodontia guiada: R$ 169,90/mes;
- Implantodontia estetica: R$ 149,90/mes;
- Implantodontia peri-implantar: R$ 119,90/mes;
- Implantodontia biomateriais e superficies: R$ 109,90/mes;
- Implantodontia digital / inteligente: R$ 189,90/mes.

Campos especificos de cada submodulo de Implantodontia entram no registro e no contexto de IA: submodulo, escopo, regiao/elementos, avaliacao ossea, planejamento protetico, planejamento cirurgico, achados de imagem/CBCT, fatores de risco e manutencao.

A Periodontia tambem e organizada em submodulos comerciais e funcionais, sem tratar essas frentes como subdivisoes formais do CFO. Cada submodulo pode ser ativado/desativado individualmente, possui preco proprio e aparece separadamente em `Especialidades` quando ativo:

- Periodontograma: R$ 99,90/mes;
- Periodontia preventiva: R$ 69,90/mes;
- Periodontia clinica: R$ 109,90/mes;
- Periodontia cirurgica: R$ 139,90/mes;
- Regeneracao periodontal: R$ 159,90/mes;
- Periodontia estetica: R$ 139,90/mes;
- Interface perio-implante: R$ 149,90/mes;
- Periodontia sistemica: R$ 129,90/mes;
- Microbiologia e imunologia periodontal: R$ 119,90/mes;
- Periodontia para pacientes especiais: R$ 139,90/mes;
- Periodontia de manutencao: R$ 99,90/mes;
- Periodontia digital / IA: R$ 169,90/mes.

Campos especificos de cada submodulo de Periodontia entram no registro e no contexto de IA: submodulo, escopo, diagnostico periodontal, periodontograma/achados, plano terapeutico periodontal, fatores de risco periodontal, contexto sistemico, plano de manutencao e observacoes.

A Odontologia Estetica/Dentistica Estetica tambem e organizada em submodulos comerciais e funcionais. Cada submodulo pode ser ativado/desativado individualmente, possui preco proprio e aparece separadamente em `Especialidades` quando ativo:

- Planejamento estetico: R$ 109,90/mes;
- Dentistica estetica restauradora: R$ 99,90/mes;
- Clareamento dental: R$ 69,90/mes;
- Lentes de contato dentais e facetas: R$ 139,90/mes;
- Reanatomizacao dental: R$ 89,90/mes;
- Planejamento estetico digital / DSD: R$ 149,90/mes;
- Estetica gengival: R$ 119,90/mes;
- Odontologia biomimetica: R$ 129,90/mes;
- Estetica com proteses dentarias: R$ 139,90/mes;
- Materiais esteticos avancados: R$ 109,90/mes;
- Odontologia estetica digital / IA: R$ 179,90/mes.

Campos especificos de cada submodulo de Odontologia Estetica entram no registro e no contexto de IA: submodulo, escopo, queixa/objetivo estetico, meta de cor/clareamento, forma/proporcao/reanatomizacao, materiais e tecnica, estetica gengival, planejamento digital/DSD/IA e observacoes.

A Odontopediatria tambem e organizada em submodulos comerciais e funcionais. Cada submodulo pode ser ativado/desativado individualmente, possui preco proprio e aparece separadamente em `Especialidades` quando ativo:

- Odontologia para bebes: R$ 79,90/mes;
- Odontopediatria preventiva: R$ 69,90/mes;
- Dentistica em odontopediatria: R$ 89,90/mes;
- Manejo comportamental infantil: R$ 119,90/mes;
- Endodontia em dentes deciduos: R$ 99,90/mes;
- Odontopediatria interceptiva: R$ 109,90/mes;
- Traumatologia dentaria infantil: R$ 119,90/mes;
- Odontologia hospitalar pediatrica: R$ 149,90/mes;
- Pacientes infantis com necessidades especiais: R$ 139,90/mes;
- Cariologia infantil: R$ 99,90/mes;
- Odontopediatria digital / IA: R$ 159,90/mes.

Campos especificos de cada submodulo de Odontopediatria entram no registro e no contexto de IA: submodulo, escopo, idade/fase infantil, orientacao aos pais/responsaveis, prevencao/dieta/higiene, manejo comportamental, achados clinicos pediatricos, fatores de risco, necessidades especiais e observacoes.

A Ortodontia tambem e organizada em submodulos comerciais e funcionais. Cada submodulo pode ser ativado/desativado individualmente, possui preco proprio e aparece separadamente em `Especialidades` quando ativo:

- Planejamento ortodontico: R$ 119,90/mes;
- Ortodontia preventiva: R$ 79,90/mes;
- Ortodontia interceptiva: R$ 99,90/mes;
- Ortodontia corretiva: R$ 119,90/mes;
- Ortopedia funcional dos maxilares: R$ 129,90/mes;
- Ortodontia estetica: R$ 139,90/mes;
- Ortodontia digital: R$ 149,90/mes;
- Ortodontia com alinhadores: R$ 159,90/mes;
- Ortodontia cirurgica: R$ 179,90/mes;
- Ortodontia lingual: R$ 169,90/mes;
- Ortodontia funcional miofuncional: R$ 119,90/mes;
- Ortodontia biologica / personalizada: R$ 139,90/mes;
- Ortodontia com inteligencia artificial: R$ 189,90/mes.

Campos especificos de cada submodulo de Ortodontia entram no registro e no contexto de IA: submodulo, escopo, classe esqueletica/relacao sagital, maloclusao e achados principais, objetivos ortodonticos e observacoes.

### Balcao OEL Startup de funcionalidades personalizadas

Cada modulo de especialidade possui um `Balcao OEL Startup`, usado para solicitar extras especificos da especialidade. O fluxo do MVP e:

- o usuario solicita uma funcionalidade extra dentro da especialidade ativa;
- a solicitacao fica em analise pela OEL Startup;
- a equipe OEL Startup analisa o pedido com apoio de especialistas em odontologia;
- se aprovado, a OEL Startup adiciona a funcionalidade e libera somente para o usuario solicitante;
- o extra aprovado entra na fatura como custo mensal adicional em `Extras personalizados`;
- a aprovacao cria um `BillingEvent` do tipo `CUSTOM_FEATURE_APPROVED`.

Essa estrutura permite vender diferenciais personalizados por usuario, sem obrigar toda a clinica a contratar a mesma funcionalidade.

A rota de revisao fica restrita a usuarios `LEO_TECH_ADMIN`, evitando que gestores da propria clinica aprovem seus pedidos.

## Console OEL Startup

O app possui um console operacional separado para a empresa mantenedora da plataforma. Usuarios com role `LEO_TECH_ADMIN` entram no `Console OEL Startup` em vez do menu da clinica.

Esse console permite:

- ver indicadores gerais da plataforma;
- listar clinicas;
- monitorar pedidos de funcionalidades personalizadas;
- aprovar ou rejeitar pedidos;
- definir o custo mensal adicional do extra aprovado;
- registrar o evento de cobranca da funcionalidade personalizada.

Usuario criado pelo seed:

```text
E-mail: admin@oelstartup.com.br
Senha: demo1234
Role: LEO_TECH_ADMIN
```

Em producao, configure:

```text
OEL_STARTUP_ADMIN_EMAILS=admin@oelstartup.com.br
```

Para criar outro operador OEL Startup, crie um documento em `users` com `role: "LEO_TECH_ADMIN"`, `clinicId: null`, `email`, `name` e `passwordHash`.

## Copyright

© OEL Startup. São Luís - MA. Todos os direitos reservados.

## Marketplace odontologico

O MVP inclui o `Marketplace odontologico`, pensado como vitrine odontologica controlada, sem checkout e sem pagamento direto. A aba fica disponivel para qualquer usuario autenticado, incluindo dentistas individuais, MEI e freelancers. O usuario pode criar anuncios de:

- produtos odontologicos;
- equipamentos;
- cursos;
- servicos odontologicos, como radiologia, laudos, planejamento digital, guias cirurgicos, manutencao e consultorias.

Os anuncios criados entram com status `PENDING` e precisam ser aprovados no `Console OEL Startup` antes de aparecerem para outros usuarios. Interessados usam `Solicitar orcamento`, gerando um registro em `marketplaceQuoteRequests`. A negociacao e o pagamento ficam fora da plataforma nesta fase.

Para demonstracao do MVP, a vitrine cria automaticamente um anuncio aprovado de exemplo para `Laudo radiologico odontologico por especialista`, marcado com `isDemo: true`.

Colecoes usadas:

- `marketplaceListings`;
- `marketplaceQuoteRequests`.

Rotas principais:

- `GET /api/marketplace/listings`;
- `POST /api/marketplace/listings`;
- `POST /api/marketplace/listings/:id/quote-requests`;
- `GET /api/marketplace/quote-requests`;
- `GET /api/platform/marketplace/listings`;
- `PATCH /api/platform/marketplace/listings/:id/review`;
- `DELETE /api/platform/marketplace/listings/:id`.

- Pacientes
- Agenda
- Prontuario
- Documentos
- IA Basica
- IA Avancada
- IA para imagens de exames
- Cobranca
- Seguranca avancada

Especialidades iniciais:

- Radiologia odontologica
- Endodontia
- Ortodontia
- Implantodontia
- Periodontia
- Odontopediatria
- Odontologia estetica

Cada modulo tem `basePrice` e pode ser ativado/desativado por clinica em `ClinicModule`.

Rotas de funcionalidades validam modulos ativos no backend. Se uma clinica desativar um modulo, a tela sai do menu e a API correspondente retorna `403`.

## Usuarios e roles

O app permite cadastro de nova clinica na tela inicial e criacao de usuarios da equipe por clinica.

Roles disponiveis:

- `ADMIN`
- `CLINIC_MANAGER`
- `DENTIST`
- `ASSISTANT`

Somente `ADMIN` e `CLINIC_MANAGER` podem listar usuarios, criar usuarios e alterar roles dentro da propria clinica.

## Prontuario clinico estruturado

O modulo de prontuario inclui:

- evolucoes clinicas textuais por paciente;
- procedimentos por dente ou regiao;
- status de tratamento: `PLANNED`, `IN_PROGRESS`, `COMPLETED`;
- perfil clinico consolidado do paciente;
- geracao de resumo por IA a partir do historico clinico, quando modulo de IA estiver ativo.

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
- `exam-image-analysis`
- `specialty-analysis`
- `specialty-question`

Se nao houver provider real configurado, o servico usa mock seguro, estima tokens, calcula custo, grava `AIUsageLog` e cria `BillingEvent`.

Politica de cobranca da IA no MVP:

- analises e geracoes comuns sao cobradas por consumo estimado de tokens;
- perguntas livres por especialidade usam `specialty-question` e sao cobradas por pergunta;
- cada pergunta gera `BillingEvent` do tipo `AI_QUESTION`;
- a fatura estimada separa `IA por tokens` de `Perguntas IA`.

Aviso exibido em conteudos clinicos:

> Conteudo gerado por inteligencia artificial para apoio profissional. A decisao clinica final deve ser tomada por cirurgiao-dentista habilitado.

## Exames por imagem com IA

O modulo `exam-images-ai` adiciona a tela `Exames IA`, com:

- upload de imagens odontologicas por paciente;
- tipo de exame e pergunta clinica;
- listagem de imagens por paciente;
- analise assistida por IA;
- interpretacao de pixels por modelo multimodal quando `OPENAI_API_KEY` estiver configurada;
- registro de consumo em `AIUsageLog`;
- evento de cobranca em `BillingEvent`.

Para ativar visao computacional real, configure:

```text
OPENAI_API_KEY=sk-...
OPENAI_VISION_MODEL=gpt-5.5
```

Quando configurado, o backend le o arquivo da imagem, envia os pixels em Base64 para o modelo multimodal e gera um relatorio com qualidade tecnica, achados visuais, hipoteses diagnosticas assistivas, limitacoes e proximos passos.

Para apresentacao clinica, use a familia GPT-5 atual. O padrao do projeto e `gpt-5.5`; alternativas de custo/latencia podem ser `gpt-5.2`, `gpt-5-mini` ou outro modelo GPT-5 com entrada de imagem habilitada na API.

Este modulo nao usa fallback simulado para apresentacao clinica: se `OPENAI_API_KEY` nao estiver configurada ou se o arquivo nao estiver disponivel no runtime, a analise falha e o exame fica com status `FAILED`.

Importante: o relatorio nao e laudo definitivo nem substitui especialista. A OpenAI documenta que modelos de visao tem limitacoes para imagens medicas especializadas; por isso o app apresenta resultados como apoio e exige revisao por cirurgiao-dentista habilitado.

## Cobranca

A estimativa mensal considera:

```ts
monthlyPrice = basePlanPrice + activeModulesPrice + storagePrice + aiUsagePrice + securityPrice
```

O MVP nao integra gateway de pagamento. Os eventos de consumo ficam em `BillingEvent`.

Politica de cobranca dos modulos:

- modulos sao cobrados por ciclo mensal;
- no MVP nao ha pro-rata;
- ativar modulo cria evento `MODULE_ACTIVATED` e inclui a mensalidade no ciclo atual;
- desativar modulo cria evento `MODULE_DEACTIVATED` e remove a renovacao no proximo ciclo;
- IA segue cobranca por consumo em `AI_USAGE`;
- storage segue estimativa por consumo.

O endpoint `GET /api/billing/invoice/current` gera uma pre-fatura `DRAFT` do ciclo atual, com itens consolidados e eventos do periodo. Essa estrutura prepara a futura integracao com gateway de pagamento.

## Assinaturas e gateway de pagamento

A base de assinatura ja existe sem prender o app a um gateway especifico. O provedor e controlado por:

```text
PAYMENT_PROVIDER=mock
PAYMENT_WEBHOOK_SECRET=uma-string-secreta-para-webhooks
STRIPE_SECRET_KEY=sk_live_ou_sk_test
STRIPE_WEBHOOK_SECRET=whsec_...
APP_BASE_URL=https://odonto-modular-ai.vercel.app
```

No MVP, `PAYMENT_PROVIDER=mock` cria um checkout simulado e grava os dados no Firestore. As colecoes usadas sao:

- `subscriptions`: assinatura atual da clinica;
- `paymentCheckoutSessions`: sessoes de checkout criadas;
- `paymentWebhookEvents`: webhooks recebidos, com idempotencia por `eventId`;
- `billingEvents`: eventos internos de cobranca e auditoria financeira.

Endpoints:

- `GET /api/subscription/current`: retorna a assinatura atual da clinica;
- `POST /api/subscription/checkout`: cria checkout da assinatura para o ciclo atual;
- `POST /api/subscription/mock/activate`: ativa a assinatura em modo mock.
- `POST /api/subscription/webhook`: recebe eventos do gateway e atualiza assinatura/eventos internos.

O webhook aceita um payload normalizado:

```json
{
  "eventId": "evt_123",
  "eventType": "invoice.paid",
  "clinicId": "clinic_123",
  "provider": "mock",
  "amount": 299.9,
  "metadata": {
    "providerSubscriptionId": "sub_123"
  }
}
```

Quando `PAYMENT_WEBHOOK_SECRET` estiver configurado, envie o header:

```text
x-payment-webhook-secret: sua-string-secreta
```

Eventos reconhecidos inicialmente:

- pagamento confirmado: `checkout.completed`, `invoice.paid`, `payment.approved`, `subscription.activated`;
- pagamento falhou: `invoice.payment_failed`, `payment.failed`, `subscription.past_due`;
- assinatura cancelada: `subscription.canceled`, `subscription.cancelled`, `customer.subscription.deleted`.

A tela `Cobranca` mostra o status da assinatura e permite criar/ativar checkout mock. Para integrar Stripe, Mercado Pago ou outro gateway, implemente um provider real mantendo o contrato do servico em `src/server/services/payment.service.ts` e converta webhooks externos em eventos internos no Firestore.

### Stripe

Para usar Stripe como gateway real:

1. Configure as variaveis na Vercel:

```text
PAYMENT_PROVIDER=stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
APP_BASE_URL=https://odonto-modular-ai.vercel.app
```

2. No Stripe Dashboard, crie um endpoint de webhook apontando para:

```text
https://odonto-modular-ai.vercel.app/api/subscription/stripe/webhook
```

3. Habilite estes eventos:

- `checkout.session.completed`
- `invoice.paid`
- `invoice.payment_failed`
- `customer.subscription.deleted`

Quando `PAYMENT_PROVIDER=stripe`, o endpoint `POST /api/subscription/checkout` cria uma Stripe Checkout Session em modo `subscription`, com valor mensal calculado pela pre-fatura atual da clinica. O webhook Stripe valida a assinatura `stripe-signature`, normaliza o evento e grava `paymentWebhookEvents`, `subscriptions` e `billingEvents`.

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
- A analise de imagens depende de `OPENAI_API_KEY` e da disponibilidade do arquivo no runtime. Em Vercel, uploads em `/tmp` nao sao armazenamento persistente; para demonstracao, envie e analise a imagem na mesma sessao. Para uso real, trocar por S3, Firebase Storage ou equivalente.
- Upload usa armazenamento local em desenvolvimento e `/tmp` em Vercel; arquivos nao sao persistentes entre execucoes serverless.
- Nao ha gateway de pagamento.
- O checkout de assinatura ainda e mock; nao captura cartao nem boleto.
- Analise de imagem odontologica nao foi implementada, apenas deixada como caminho arquitetural.
- Permissoes por role existem na base, mas os fluxos ainda usam controle simples.
