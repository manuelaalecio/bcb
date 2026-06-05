# BCB — Big Chat Brasil

> Documentação técnica gerada a partir da análise integral da base de código (backend NestJS +
> frontend React). Sempre que possível, cada afirmação aponta o arquivo de origem. Este documento é
> o README oficial do projeto e descreve **o que o código realmente faz hoje**, incluindo
> divergências e débitos.

---

## Sumário

1. [Visão Geral do Sistema](#1-visão-geral-do-sistema)
2. [Arquitetura Geral](#2-arquitetura-geral)
3. [Estrutura do Projeto](#3-estrutura-do-projeto)
4. [Tecnologias Utilizadas](#4-tecnologias-utilizadas)
5. [Guia para Desenvolvedores Novos](#5-guia-para-desenvolvedores-novos)
6. [Como Trabalhar no Projeto](#6-como-trabalhar-no-projeto)
7. [Frontend](#7-frontend)
8. [Backend](#8-backend)
9. [Banco de Dados](#9-banco-de-dados)
10. [API](#10-api)
11. [Fluxos de Negócio](#11-fluxos-de-negócio)
12. [Variáveis de Ambiente](#12-variáveis-de-ambiente)
13. [Convenções e Padrões](#13-convenções-e-padrões)
14. [Troubleshooting](#14-troubleshooting)
15. [Débitos Técnicos e Melhorias](#15-débitos-técnicos-e-melhorias)
16. [Onboarding Rápido — Primeira Semana no Projeto](#16-onboarding-rápido--primeira-semana-no-projeto)
17. [Resumo Executivo](#17-resumo-executivo)

---

## 1. Visão Geral do Sistema

### Objetivo do projeto
**BCB (Big Chat Brasil)** é uma plataforma de chat fullstack para que **empresas enviem mensagens
para seus clientes finais**, cobrando por mensagem enviada e priorizando o tráfego por uma fila.
Referências: este README e [CLAUDE.md](CLAUDE.md).

### Problema que resolve
Empresas precisam de um canal de mensageria corporativa com:
- **Controle financeiro** por mensagem (modelos pré-pago e pós-pago);
- **Priorização** de mensagens urgentes sobre normais;
- **Feedback em tempo real** de entrega/leitura (estilo WhatsApp).

### Público-alvo
Empresas (Pessoa Física via **CPF** ou Pessoa Jurídica via **CNPJ**) que autenticam no sistema e
disparam mensagens. O **destinatário final é simulado** — não há app do lado do cliente final; o
ciclo de vida da mensagem é avançado por um worker com timers (ver [message.worker.ts](backend/src/queue/message.worker.ts)).

### Principais funcionalidades (verificadas no código)
| Funcionalidade | Onde está implementada |
|---|---|
| Login por CPF/CNPJ → JWT | [auth.service.ts](backend/src/auth/auth.service.ts), [LoginPage.tsx](frontend/src/features/auth/LoginPage.tsx) |
| Cadastro de cliente (empresa) | [clients.service.ts](backend/src/clients/clients.service.ts), [RegisterPage.tsx](frontend/src/features/auth/RegisterPage.tsx) |
| Listar conversas e histórico de mensagens | [conversations.service.ts](backend/src/conversations/conversations.service.ts) |
| Envio de mensagem com cobrança + fila | [messages.service.ts](backend/src/messages/messages.service.ts) |
| Fila com prioridade (normal/urgente) | [priority-queue.ts](backend/src/queue/priority-queue.ts) |
| Cobrança pré-pago (saldo) e pós-pago (limite mensal) | [billing/strategies/](backend/src/billing/strategies/) |
| Status de mensagem em tempo real | [chat.gateway.ts](backend/src/realtime/chat.gateway.ts), [useChatSocket.ts](frontend/src/hooks/useChatSocket.ts) |
| Indicador de digitação / presença | [chat.gateway.ts](backend/src/realtime/chat.gateway.ts) (ver ressalvas na seção 15) |
| Adicionar crédito / aumentar limite | [clients.controller.ts](backend/src/clients/clients.controller.ts), [AddCreditModal.tsx](frontend/src/features/chat/AddCreditModal.tsx) |

---

## 2. Arquitetura Geral

### Organização macro
Monorepo com três peças no nível raiz: `backend/`, `frontend/` e o `docker-compose.yml`.

```mermaid
graph LR
  subgraph Browser
    FE[Frontend React + Vite<br/>:8080 nginx]
  end
  subgraph Server
    BE[Backend NestJS<br/>:3000 REST + Swagger]
    WS[WebSocket socket.io<br/>namespace /chat]
    Q[Fila em memória<br/>+ MessageWorker]
  end
  DB[(PostgreSQL<br/>:5432)]

  FE -- HTTP REST + Bearer JWT --> BE
  FE <-- socket.io eventos --> WS
  BE -- Prisma --> DB
  BE --> Q
  Q -- emite status --> WS
  Q -- atualiza --> DB
```

### Fluxo completo de dados (envio de mensagem)
1. O frontend faz `POST /messages` com `Bearer <token>` ([useSendMessage.ts](frontend/src/hooks/useSendMessage.ts)).
2. `AuthGuard` valida o JWT e injeta o `Client` no request ([auth.guard.ts](backend/src/common/guards/auth.guard.ts)).
3. `MessagesService.send` abre uma **transação Prisma**: cobra via `BillingService`, cria a `Message(queued)`, registra a `Transaction` e atualiza a `Conversation` ([messages.service.ts](backend/src/messages/messages.service.ts)).
4. Fora da transação, o id da mensagem entra na **fila com prioridade** (`MessageQueueService.enqueue`).
5. O `MessageWorker` consome a fila a cada 1s, avança `processing → sent` e agenda `delivered`/`read` por timers, **emitindo `message:status`** via WebSocket a cada passo.
6. O frontend, inscrito na sala da conversa (`useChatSocket`), atualiza o cache do React Query e re-renderiza os "ticks" da mensagem.

### Comunicação entre módulos (backend)
```mermaid
graph TD
  App[AppModule] --> Auth[AuthModule]
  App --> Clients[ClientsModule]
  App --> Conv[ConversationsModule]
  App --> Msg[MessagesModule]
  App --> RT[RealtimeModule]
  App --> Prisma[PrismaModule @Global]

  Msg --> Auth
  Msg --> Billing[BillingModule]
  Msg --> Queue[QueueModule]
  Queue --> RT
  Clients --> Auth
  Conv --> Auth
```
- `PrismaModule` é `@Global` → `PrismaService` está disponível em qualquer módulo sem reimportar ([prisma.module.ts](backend/src/prisma/prisma.module.ts)).
- `AuthModule` exporta `JwtModule`; módulos que usam `AuthGuard` importam `AuthModule` para obter o `JwtService` ([messages.module.ts](backend/src/messages/messages.module.ts), [clients.module.ts](backend/src/clients/clients.module.ts), [conversations.module.ts](backend/src/conversations/conversations.module.ts)).
- `QueueModule` importa `RealtimeModule` para que o worker possa emitir eventos ([queue.module.ts](backend/src/queue/queue.module.ts)).

### Comunicação frontend ↔ backend
- **REST** via `axios` com interceptor que injeta o Bearer token ([api.ts](frontend/src/lib/api.ts)).
- **WebSocket** via `socket.io-client` singleton, namespace `/chat`, `autoConnect: false` ([socket.ts](frontend/src/lib/socket.ts)). A conexão é aberta ao entrar no chat e fechada no logout ([HomePage.tsx](frontend/src/features/chat/HomePage.tsx)).

---

## 3. Estrutura do Projeto

```
bcb-fullstack/
├── docker-compose.yml      # orquestra db + backend + frontend
├── .env / .env.example     # variáveis do compose (Postgres, JWT)
├── README.md / CLAUDE.md
├── backend/                # API NestJS
│   ├── prisma/             # schema, migrations, seed
│   └── src/                # vertical slices (um módulo por feature)
└── frontend/               # SPA React + Vite
    ├── nginx.conf          # serve a SPA em produção
    └── src/
```

### Backend — `backend/src/`
Organizado em **vertical slices**: cada feature dona do seu módulo, controller, service e DTOs.

| Diretório | Responsabilidade | O que colocar | O que **não** colocar |
|---|---|---|---|
| `prisma/` | Cliente Prisma global | `PrismaService` e helpers de acesso ao client | Lógica de negócio |
| `common/` | Infra transversal | Guards, decorators, filters ([common/](backend/src/common/)) | Regras de negócio de uma feature |
| `auth/` | Login + emissão de JWT | Validação de credenciais | CRUD de cliente (vai em `clients/`) |
| `clients/` | CRUD e crédito/limite | Criação de cliente, ajuste financeiro | Cobrança por mensagem (vai em `billing/`) |
| `billing/` | Cobrança (Strategy) | Estratégias pré/pós-pago, cálculo de custo | Persistência da mensagem |
| `conversations/` | Leitura de conversas/mensagens | Queries de listagem | Envio de mensagem (vai em `messages/`) |
| `messages/` | Orquestração de envio | Transação cobrança→criação→enfileira | Avanço de status (vai em `queue/`) |
| `queue/` | Fila + worker | Estrutura de fila, worker com timers | Emissão direta de WebSocket (delega ao gateway) |
| `realtime/` | WebSocket gateway | Eventos socket.io | Acesso ao banco |

**Exemplo encontrado** — `messages/` contém exatamente: [messages.module.ts](backend/src/messages/messages.module.ts), [messages.controller.ts](backend/src/messages/messages.controller.ts), [messages.service.ts](backend/src/messages/messages.service.ts) e `dto/` com [send-message.dto.ts](backend/src/messages/dto/send-message.dto.ts) e [send-message-response.dto.ts](backend/src/messages/dto/send-message-response.dto.ts).

> ⚠️ **Dead code:** [app.controller.ts](backend/src/app.controller.ts) e [app.service.ts](backend/src/app.service.ts) existem mas **não estão registrados** em [app.module.ts](backend/src/app.module.ts) (não há `controllers`). Logo `GET /` retorna 404 (ver seção 15).

### Frontend — `frontend/src/`
| Diretório | Responsabilidade | Exemplos |
|---|---|---|
| `lib/` | Infra sem React | [api.ts](frontend/src/lib/api.ts), [socket.ts](frontend/src/lib/socket.ts), [types.ts](frontend/src/lib/types.ts), [queryClient.ts](frontend/src/lib/queryClient.ts), [format.ts](frontend/src/lib/format.ts), [error.ts](frontend/src/lib/error.ts) |
| `store/` | Estado global (Zustand) | [auth.store.ts](frontend/src/store/auth.store.ts) |
| `hooks/` | Hooks de dados (React Query) e socket | [useConversations.ts](frontend/src/hooks/useConversations.ts), [useMessages.ts](frontend/src/hooks/useMessages.ts), [useSendMessage.ts](frontend/src/hooks/useSendMessage.ts), [useChatSocket.ts](frontend/src/hooks/useChatSocket.ts) |
| `components/` | UI genérica reutilizável | [Spinner.tsx](frontend/src/components/Spinner.tsx), [Modal.tsx](frontend/src/components/Modal.tsx), [toast/](frontend/src/components/toast/) |
| `features/` | Componentes de página por domínio | [auth/](frontend/src/features/auth/), [chat/](frontend/src/features/chat/) |

**Regra implícita:** componentes específicos de uma tela ficam em `features/<dominio>/`; componentes genéricos (sem regra de negócio) ficam em `components/`. Acesso a rede/estado fica em `hooks/` e `lib/`, nunca dentro do JSX da página.

---

## 4. Tecnologias Utilizadas

### Backend
| Tecnologia | O que é | Por que aqui | Onde aparece |
|---|---|---|---|
| **NestJS 11** | Framework Node com DI e módulos | Estrutura previsível em vertical slices, DI nativa, suporte a WS e Swagger | [package.json](backend/package.json), todos os `*.module.ts` |
| **Prisma 6** (`@prisma/client`) | ORM com schema declarativo e migrations | Tipagem forte + `Prisma.Decimal` para dinheiro. **Fixado no 6 propositalmente** (Prisma 7 tem conflito ESM/CommonJS com Nest) | [schema.prisma](backend/prisma/schema.prisma), [prisma.service.ts](backend/src/prisma/prisma.service.ts) |
| **PostgreSQL 16** | Banco relacional | Tipos `DECIMAL(10,2)` para valores monetários | [docker-compose.yml](docker-compose.yml), [migration.sql](backend/prisma/migrations/20260604115522_add_models/migration.sql) |
| **socket.io 4** | WebSocket com salas/rooms | Tempo real (status, typing, presence) com rooms por conversa | [chat.gateway.ts](backend/src/realtime/chat.gateway.ts) |
| **@nestjs/jwt** | Emissão/validação de JWT | Auth stateless, expira em 7d | [auth.module.ts](backend/src/auth/auth.module.ts), [auth.guard.ts](backend/src/common/guards/auth.guard.ts) |
| **class-validator / class-transformer** | Validação declarativa de DTOs | `ValidationPipe` global com `whitelist:true` | DTOs e [main.ts](backend/src/main.ts) |
| **@nestjs/swagger** | Documentação OpenAPI | Swagger em `/docs` | [main.ts](backend/src/main.ts), decorators `@Api*` nos controllers |

### Frontend
| Tecnologia | O que é | Por que aqui | Onde aparece |
|---|---|---|---|
| **React 19 + Vite 8** | UI + bundler | DX rápida, HMR | [main.tsx](frontend/src/main.tsx), [vite.config.ts](frontend/vite.config.ts) |
| **TypeScript** | Tipagem estática | Contrato compartilhado de tipos | [types.ts](frontend/src/lib/types.ts) |
| **@tanstack/react-query 5** | Estado de servidor | Cache, optimistic updates, invalidação | hooks em [hooks/](frontend/src/hooks/) |
| **Zustand 5** (+persist) | Estado global de cliente | Auth (token+client) persistido em `localStorage` (`bcb-auth`) | [auth.store.ts](frontend/src/store/auth.store.ts) |
| **react-router-dom 7** | Roteamento SPA | 3 rotas + fallback | [App.tsx](frontend/src/App.tsx) |
| **react-hook-form + zod** | Formulários + validação | Validação de CPF/CNPJ, valores | [LoginPage.tsx](frontend/src/features/auth/LoginPage.tsx), [RegisterPage.tsx](frontend/src/features/auth/RegisterPage.tsx) |
| **axios** | HTTP client | Interceptor de Bearer token | [api.ts](frontend/src/lib/api.ts) |
| **socket.io-client** | WebSocket | Eventos em tempo real | [socket.ts](frontend/src/lib/socket.ts), [useChatSocket.ts](frontend/src/hooks/useChatSocket.ts) |

### Infra
- **Docker / Docker Compose** orquestra `db`, `backend`, `frontend` ([docker-compose.yml](docker-compose.yml)).
- **nginx** serve a SPA com fallback para `index.html` ([nginx.conf](frontend/nginx.conf)).

---

## 5. Guia para Desenvolvedores Novos

### 5.1 Clonar
```bash
git clone <seu-repo>
cd bcb-fullstack
```

### 5.2 Caminho mais rápido — tudo via Docker
```bash
cp .env.example .env       # cria as vars do compose
docker compose up --build
```
Serviços (ver [README.md](README.md)):

| Serviço  | URL |
|----------|-----|
| Frontend | http://localhost:8080 |
| Backend  | http://localhost:3000 |
| Swagger  | http://localhost:3000/docs |
| Postgres | localhost:5432 |

O [backend/Dockerfile](backend/Dockerfile) já roda `prisma migrate deploy && npm run seed && node dist/main` ao subir — ou seja, **migrations e seed são aplicados automaticamente** no container.

### 5.3 Desenvolvimento local (sem Docker)
```bash
# terminal 1 — apenas o banco
docker compose up db

# terminal 2 — backend
cd backend
npm install
npx prisma migrate dev      # aplica migrations no DB local
npm run seed                # popula clientes de exemplo (opcional)
npm run start:dev           # API com watch em :3000

# terminal 3 — frontend
cd frontend
npm install
npm run dev                 # Vite (porta varia, ex.: :5173)
```

### 5.4 Variáveis de ambiente
- **Raiz** (`.env`, consumido pelo compose): `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `JWT_SECRET` — ver [.env.example](.env.example).
- **Backend** ([backend/.env](backend/.env)): `DATABASE_URL`, `JWT_SECRET`. *(Atenção: hoje há um `.env` commitado com segredo — ver seção 15.)*
- **Frontend** ([frontend/.env.example](frontend/.env.example)): `VITE_API_URL` (default `http://localhost:3000`). No Docker, é "assada" no build via `ARG`.

### 5.5 Rodar testes
O Jest e os scripts continuam configurados ([backend/package.json](backend/package.json)), mas **não há
suítes de teste no momento** — o scaffolding padrão do Nest foi removido por testar apenas código
boilerplate. Ao adicionar testes (`*.spec.ts`), use:
```bash
cd backend
npm run test            # unit (Jest)
npm run test:cov        # cobertura
npx jest src/path/to/file.spec.ts   # um único arquivo
```
> O frontend **não tem suíte de testes** configurada ([frontend/package.json](frontend/package.json) só tem `dev/build/lint/format/preview`).

### 5.6 Build
```bash
cd backend  && npm run build   # nest build → dist/
cd frontend && npm run build   # tsc -b && vite build → dist/
```

### 5.7 Deploy
Não há pipeline de deploy versionado. O caminho suportado é **imagens Docker**:
- Backend: imagem multi-stage que aplica migrations + seed na inicialização ([backend/Dockerfile](backend/Dockerfile)).
- Frontend: build estático servido por nginx ([frontend/Dockerfile](frontend/Dockerfile) + [nginx.conf](frontend/nginx.conf)).

Para produção real, ver recomendações na seção 15 (remover seed do CMD, externalizar `JWT_SECRET`, etc.).

---

## 6. Como Trabalhar no Projeto

### 6.1 Criar uma nova funcionalidade no backend (vertical slice)
Siga o padrão de `messages/`. Para uma feature `foo`:

1. Crie `backend/src/foo/` com `foo.module.ts`, `foo.controller.ts`, `foo.service.ts`, `dto/`.
2. Registre o módulo em [app.module.ts](backend/src/app.module.ts) (`imports: [...]`).
3. Se precisar de autenticação, importe `AuthModule` e adicione `AuthGuard` aos `providers`, exatamente como em [conversations.module.ts](backend/src/conversations/conversations.module.ts).

**Esqueleto de service** (toda regra de negócio mora aqui):
```ts
@Injectable()
export class FooService {
  constructor(private readonly prisma: PrismaService) {}
  async findAll(clientId: string) {
    return this.prisma.foo.findMany({ where: { clientId } })
  }
}
```

### 6.2 Criar um novo endpoint / API
Espelhe [conversations.controller.ts](backend/src/conversations/conversations.controller.ts):
```ts
@ApiTags('foo')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('foo')
export class FooController {
  constructor(private readonly fooService: FooService) {}

  @Get()
  @ApiOperation({ summary: 'Listar foo' })
  @ApiOkResponse({ type: [FooResponseDto] })
  findAll(@CurrentClient() client: Client) {
    return this.fooService.findAll(client.id)
  }
}
```
Pontos obrigatórios pela convenção do projeto:
- O controller **só** recebe dados resolvidos via `@CurrentClient()` — nunca acessa `req` ([current-client.ts](backend/src/common/decorators/current-client.ts)).
- DTOs de entrada usam `class-validator`; DTOs de resposta usam `@ApiProperty` para o Swagger.
- Toda lógica vai no service.

### 6.3 Criar um DTO com validação
Veja [send-message.dto.ts](backend/src/messages/dto/send-message.dto.ts):
```ts
export class SendMessageDto {
  @IsOptional() @IsString() conversationId?: string
  @IsString() @IsNotEmpty() content!: string
  @IsEnum(Priority) priority!: Priority
}
```
Como o `ValidationPipe` global usa `whitelist: true` ([main.ts](backend/src/main.ts)), **campos não decorados são removidos** do payload.

### 6.4 Criar uma migration
```bash
cd backend
# edite prisma/schema.prisma e então:
npx prisma migrate dev --name add_foo
```
Isso gera `prisma/migrations/<timestamp>_add_foo/migration.sql` e regenera o client. **Migrations devem ser commitadas** (convenção em [CLAUDE.md](CLAUDE.md)).

### 6.5 Adicionar uma nova entidade
1. Adicione o `model` em [schema.prisma](backend/prisma/schema.prisma) (use `@db.Decimal(10,2)` para dinheiro, `@@index` para FKs consultadas).
2. Rode `npx prisma migrate dev --name add_<entidade>`.
3. (Opcional) popule em [seed.ts](backend/prisma/seed.ts).
4. Acesse via `this.prisma.<entidade>` no service.

### 6.6 Adicionar regra de cobrança (Strategy)
O billing usa **Strategy pattern** ([billing.service.ts](backend/src/billing/billing.service.ts)). Para um novo plano:
1. Crie `strategies/novo.strategy.ts` implementando `BillingStrategy` ([billing-strategy.interface.ts](backend/src/billing/strategies/billing-strategy.interface.ts)).
2. Registre em [billing.module.ts](backend/src/billing/billing.module.ts).
3. Selecione-a em `BillingService.charge` conforme `client.planType`.

### 6.7 Frontend — criar nova página + rota
1. Crie o componente em `features/<dominio>/MinhaPagina.tsx`.
2. Adicione a rota em [App.tsx](frontend/src/App.tsx):
```tsx
<Route path="/minha-pagina" element={<MinhaPagina />} />
```
Para proteger a rota, replique o guard de [HomePage.tsx](frontend/src/features/chat/HomePage.tsx):
```tsx
if (!token || !client) return <Navigate to="/" replace />
```

### 6.8 Frontend — criar um hook de dados
Espelhe [useConversations.ts](frontend/src/hooks/useConversations.ts):
```ts
export const fooKey = ['foo'] as const
export function useFoo() {
  return useQuery({
    queryKey: fooKey,
    queryFn: async () => (await api.get<Foo[]>('/foo')).data,
  })
}
```
Para mutações com optimistic update, use [useSendMessage.ts](frontend/src/hooks/useSendMessage.ts) como referência (`onMutate`/`onSuccess`/`onError` com rollback).

### 6.9 Frontend — criar um componente compartilhado
Coloque em `components/` se for genérico (sem regra de negócio), como [Modal.tsx](frontend/src/components/Modal.tsx). Toasts são consumidos via `useToast()` ([useToast.ts](frontend/src/components/toast/useToast.ts)).

### 6.10 Permissões / autorização
Hoje o único mecanismo é o `AuthGuard` (autenticação por JWT). **Não há papéis/roles**. A "posse" de recursos é verificada manualmente no service (ex.: `conversation.clientId !== client.id` em [conversations.service.ts](backend/src/conversations/conversations.service.ts) e [messages.service.ts](backend/src/messages/messages.service.ts)). Para adicionar autorização fina, replique essa checagem por `client.id` — ver lacuna importante em `/clients/:id/credit` na seção 15.

---

## 7. Frontend

### 7.1 Estrutura de páginas e rotas
Definidas em [App.tsx](frontend/src/App.tsx):

| Rota | Componente | Proteção |
|---|---|---|
| `/` | `LoginPage` | pública |
| `/register` | `RegisterPage` | pública |
| `/chat` | `HomePage` | redireciona para `/` se não houver token/client |
| `*` | `Navigate to="/"` | fallback |

### 7.2 Providers (ordem importa)
Em [main.tsx](frontend/src/main.tsx):
```
StrictMode → QueryClientProvider → ToastProvider → App(BrowserRouter)
```
- **QueryClientProvider**: cache global do React Query, configurado em [queryClient.ts](frontend/src/lib/queryClient.ts) (`staleTime 30s`, `retry 1`, sem refetch on focus).
- **ToastProvider**: pilha de toasts auto-dismiss em 4s ([ToastProvider.tsx](frontend/src/components/toast/ToastProvider.tsx)).

### 7.3 Gerenciamento de estado (a divisão central)
- **Estado de servidor** → React Query (`conversations`, `messages`).
- **Estado de cliente/auth** → Zustand persistido (`token` + `client`) em [auth.store.ts](frontend/src/store/auth.store.ts), chave `bcb-auth` no `localStorage`.
- **Saldo/uso** vivem no store e são atualizados após enviar mensagem ou adicionar crédito (`updateClient`).

### 7.4 Fluxo de autenticação
```mermaid
sequenceDiagram
  participant U as Usuário
  participant L as LoginPage
  participant API as api (axios)
  participant S as auth.store (Zustand)
  U->>L: CPF/CNPJ + tipo
  L->>API: POST /auth
  API-->>L: { token, client }
  L->>S: setAuth(token, client)
  L->>U: navigate('/chat')
  Note over API: interceptor injeta<br/>Authorization: Bearer token
```
- O interceptor de [api.ts](frontend/src/lib/api.ts) lê o token do store em **toda** requisição.
- Logout (`logout()` no store) limpa token+client e desconecta o socket ([HomePage.tsx](frontend/src/features/chat/HomePage.tsx)).

### 7.5 Consumo de APIs e tempo real
- `useConversations` → `GET /conversations`.
- `useMessages(conversationId)` → `GET /conversations/:id/messages` (só dispara com `enabled: !!conversationId`).
- `useSendMessage` → `POST /messages` com **optimistic update**: a mensagem aparece como `queued` na hora, é reconciliada com `id/cost` reais no sucesso e revertida em erro (ex.: 422 saldo insuficiente).
- `useChatSocket(conversationId)`: faz `join` na sala, aplica `message:status` ao cache, expõe `isRecipientTyping`, `isRecipientOnline` e `emitTyping` (debounce de 1,5s).

### 7.6 Componentes do chat (mapa)
[HomePage.tsx](frontend/src/features/chat/HomePage.tsx) compõe: [ChatHeader](frontend/src/features/chat/ChatHeader.tsx) (saldo/limite + logout), [ConversationList](frontend/src/features/chat/ConversationList.tsx) → [ConversationItem](frontend/src/features/chat/ConversationItem.tsx), [ChatPanel](frontend/src/features/chat/ChatPanel.tsx) → [MessageBubble](frontend/src/features/chat/MessageBubble.tsx) / [MessageComposer](frontend/src/features/chat/MessageComposer.tsx) / [TypingIndicator](frontend/src/features/chat/TypingIndicator.tsx) / [PresenceBadge](frontend/src/features/chat/PresenceBadge.tsx), e os modais [NewConversationModal](frontend/src/features/chat/NewConversationModal.tsx) / [AddCreditModal](frontend/src/features/chat/AddCreditModal.tsx).

### 7.7 Como criar um novo recurso seguindo o padrão
Exemplo: "marcar conversa como favorita".
1. Endpoint no backend (`PATCH /conversations/:id/favorite`) — seção 6.2.
2. Hook `useToggleFavorite` em `hooks/` com `useMutation` + `invalidateQueries(conversationsKey)`.
3. Botão em `ConversationItem` chamando o hook; feedback via `useToast`.

---

## 8. Backend

### 8.1 Arquitetura
NestJS com DI; cada feature é um módulo isolado (vertical slice). Inicialização em [main.ts](backend/src/main.ts):
- `app.enableCors()` (hoje libera todas as origens);
- `ValidationPipe({ whitelist: true })` global;
- `HttpExceptionFilter` global ([http-exception.filter.ts](backend/src/common/filters/http-exception.filter.ts));
- Swagger em `/docs` com Bearer auth;
- escuta em `0.0.0.0:${PORT ?? 3000}`.

### 8.2 Controllers
Finos: recebem DTO validado + `@CurrentClient()`, delegam ao service e anotam Swagger. Exemplo [messages.controller.ts](backend/src/messages/messages.controller.ts).

### 8.3 Services
Detêm toda a regra de negócio. Destaques:
- [messages.service.ts](backend/src/messages/messages.service.ts): orquestra `billing.charge → create Message → transaction → update conversation` dentro de `prisma.$transaction`, e **só depois** enfileira (o enqueue fica fora da transação, intencionalmente).
- [conversations.service.ts](backend/src/conversations/conversations.service.ts): leitura + verificação de posse + mapeamento para o formato de resposta (converte `Decimal → number`).
- [clients.service.ts](backend/src/clients/clients.service.ts): cria cliente (com checagem de documento único) e incrementa saldo/limite conforme o plano.

### 8.4 "Repositories"
**Não há camada de repositório explícita.** O `PrismaService` (que estende `PrismaClient`) é injetado direto nos services e funciona como acesso a dados ([prisma.service.ts](backend/src/prisma/prisma.service.ts)).

### 8.5 Middlewares / Guards / Filters / Decorators
- **AuthGuard** ([auth.guard.ts](backend/src/common/guards/auth.guard.ts)): exige `Bearer`, verifica JWT, busca o `Client` por `payload.sub`, rejeita inativo e injeta `request.client`.
- **@CurrentClient()** ([current-client.ts](backend/src/common/decorators/current-client.ts)): lê `request.client`.
- **HttpExceptionFilter**: normaliza o corpo do erro. Se o corpo da exceção já é objeto, repassa; senão monta `{ statusCode, message }`.

### 8.6 Validações
Decorators `class-validator` nos DTOs + `ValidationPipe` global. Erros de validação viram **400** automaticamente.

### 8.7 Regras de negócio (cobrança)
```mermaid
graph TD
  C[BillingService.charge] -->|getCost por prioridade| Cost{prioridade}
  Cost -->|normal| N[R$0,25]
  Cost -->|urgent| U[R$0,50]
  C -->|planType| P{plano}
  P -->|prepaid| PRE[PrepaidStrategy<br/>balance.lt cost? → 422<br/>senão debita]
  P -->|postpaid| POS[PostpaidStrategy<br/>usage+cost > limit? → 422<br/>senão soma uso]
```
- Custos centralizados em [billing.service.ts](backend/src/billing/billing.service.ts) (`COST_NORMAL = 0.25`, `COST_URGENT = 0.50`).
- Falha financeira → **422** com `{ statusCode, error, message }` ([prepaid.strategy.ts](backend/src/billing/strategies/prepaid.strategy.ts), [postpaid.strategy.ts](backend/src/billing/strategies/postpaid.strategy.ts)).
- **Dinheiro é sempre `Prisma.Decimal`** no service/DB; só vira `number` na resposta JSON.

### 8.8 Fila e worker
- [priority-queue.ts](backend/src/queue/priority-queue.ts): dois buckets FIFO (urgent/normal); `dequeue` esvazia urgentes primeiro.
- [message-queue.service.ts](backend/src/queue/message-queue.service.ts): wrapper injetável guardando uma `PriorityQueue<string>` em memória.
- [message.worker.ts](backend/src/queue/message.worker.ts): `setInterval` de 1s; por tick desenfileira **1** mensagem, avança `processing → sent` no banco e emite cada status; agenda `delivered` (2s) e `read` (4s). Erros levam a `failed`.

### 8.9 WebSocket
[chat.gateway.ts](backend/src/realtime/chat.gateway.ts), namespace `/chat`:
- `join` → entra na sala `conversation:<id>`;
- `typing` → repassa para a sala;
- `emitMessageStatus` (chamado pelo worker) → emite `message:status` para a sala;
- `presence` em connect/disconnect (ver ressalva na seção 15).

### 8.10 Como criar novos endpoints/services/módulos/regras
Coberto na seção 6 (6.1–6.6) com esqueletos prontos.

---

## 9. Banco de Dados

### 9.1 Entidades e relacionamentos
Fonte: [schema.prisma](backend/prisma/schema.prisma).

```mermaid
erDiagram
  Client ||--o{ Conversation : possui
  Client ||--o{ Transaction : registra
  Conversation ||--o{ Message : contém
  Message ||--o| Transaction : gera

  Client {
    uuid id PK
    string name
    string documentId UK
    enum documentType "CPF|CNPJ"
    enum planType "prepaid|postpaid"
    decimal balance "10,2 (pré-pago)"
    decimal monthlyLimit "10,2 (pós-pago)"
    decimal monthlyUsage "10,2 (pós-pago)"
    bool active
  }
  Conversation {
    uuid id PK
    uuid clientId FK
    string recipientId
    string recipientName
    string lastMessageContent
    datetime lastMessageTime
    int unreadCount
  }
  Message {
    uuid id PK
    uuid conversationId FK
    string content
    string senderId
    enum senderType "client|user"
    enum priority "normal|urgent"
    enum status "queued..read|failed"
    decimal cost "10,2"
  }
  Transaction {
    uuid id PK
    uuid clientId FK
    uuid messageId FK "unique, opcional"
    decimal amount "10,2"
    string type "debit|usage"
    decimal balanceAfter "10,2"
  }
```

**Enums:** `DocumentType`, `PlanType`, `Priority`, `SenderType`, `MessageStatus`.

**Relações chave:**
- `Client 1—N Conversation` (uma conversa por destinatário).
- `Conversation 1—N Message`.
- `Message 1—0..1 Transaction` (`messageId` é `@unique`; `ON DELETE SET NULL`).
- Índices em `Conversation.clientId`, `Message.conversationId`, `Transaction.clientId` ([migration.sql](backend/prisma/migrations/20260604115522_add_models/migration.sql)).

### 9.2 Ciclo de vida da mensagem
`queued → processing → sent → delivered → read` (ou `failed`). O lado do destinatário é **simulado** pelo worker via timers (seção 8.8).

### 9.3 Migrations
- Diretório [prisma/migrations/](backend/prisma/migrations/). Há **uma** migration: `20260604115522_add_models`.
- Dev: `npx prisma migrate dev --name <nome>`. Produção/Docker: `npx prisma migrate deploy` (no [backend/Dockerfile](backend/Dockerfile)).

### 9.4 Seeds
[seed.ts](backend/prisma/seed.ts) cria via `upsert` (idempotente):
- **Pré-pago (CPF `52998224725`)** — "Loja do Zé", saldo R$50,00, com 1 conversa de exemplo (João Silva) e 3 mensagens.
- **Pós-pago (CNPJ `11222333000181`)** — "Mercado Central", limite mensal R$100,00.

Rodar: `npm run seed` ([backend/package.json](backend/package.json)).

### 9.5 Como criar tabelas / modificar entidades
Seção 6.4 e 6.5. Sempre via `schema.prisma` + `migrate dev`; nunca edite SQL manualmente fora do fluxo do Prisma.

---

## 10. API

Base URL local: `http://localhost:3000`. Todos os endpoints, **exceto `POST /auth` e `POST /clients`**, exigem `Authorization: Bearer <token>`. Documentação interativa em `/docs`.

Formato de erro padrão: `{ statusCode, error, message }` (normalizado pelo [HttpExceptionFilter](backend/src/common/filters/http-exception.filter.ts)).

### `POST /auth` — Login
- **Finalidade:** autenticar por documento e obter JWT.
- **Body** ([auth-request.dto.ts](backend/src/auth/dto/auth-request.dto.ts)):
```json
{ "documentId": "52998224725", "documentType": "CPF" }
```
- **Resposta 201:**
```json
{
  "token": "eyJhbGci...",
  "client": {
    "id": "uuid", "name": "Loja do Zé (Pré-pago)",
    "documentId": "52998224725", "documentType": "CPF",
    "planType": "prepaid", "active": true, "balance": 50
  }
}
```
  (`limit` aparece no lugar de `balance` para pós-pago — ver [auth.service.ts](backend/src/auth/auth.service.ts).)
- **Erros:** 400 (dados inválidos), 401 (credenciais inválidas / inativo).

### `POST /clients` — Criar cliente (público hoje)
- **Body** ([create-client.dto.ts](backend/src/clients/dto/create-client.dto.ts)): `{ name, documentId, documentType, planType }`.
- **Resposta 201:** objeto do cliente (`balance`, `monthlyLimit`, `monthlyUsage` como `number`).
- **Erros:** 400 (inválido), 409 (documento já existe).

### `PATCH /clients/:id/credit` — Adicionar crédito/limite 🔒
- **Body** ([update-credit.dto.ts](backend/src/clients/dto/update-credit.dto.ts)): `{ "amount": 50.0 }` (positivo).
- **Comportamento:** pré-pago → incrementa `balance`; pós-pago → incrementa `monthlyLimit` ([clients.service.ts](backend/src/clients/clients.service.ts)).
- **Resposta 200:** cliente atualizado.
- **Erros:** 401, 404 (cliente não encontrado).
- ⚠️ **Lacuna de autorização** (seção 15): qualquer cliente autenticado pode alterar o crédito de **qualquer** `:id`.

### `GET /conversations` — Listar conversas 🔒
- **Resposta 200** ([conversation-response.dto.ts](backend/src/conversations/dto/conversation-response.dto.ts)): array de
```json
{ "id":"uuid","recipientId":"...","recipientName":"João Silva",
  "lastMessageContent":"...","lastMessageTime":"ISO","unreadCount":0 }
```
  Ordenado por `lastMessageTime desc`.

### `GET /conversations/:id/messages` — Histórico 🔒
- **Resposta 200** ([message-response.dto.ts](backend/src/conversations/dto/message-response.dto.ts)): array de mensagens em ordem cronológica, com `sentBy: { id, type }`, `status`, `priority`, `cost`.
- **Erros:** 401, 404 (conversa não é do cliente).

### `POST /messages` — Enviar mensagem 🔒
- **Body** ([send-message.dto.ts](backend/src/messages/dto/send-message.dto.ts)):
```json
// conversa existente
{ "conversationId":"uuid", "content":"Olá", "priority":"normal" }
// nova conversa (exige recipientId + recipientName)
{ "recipientId":"r-1", "recipientName":"João", "content":"Oi", "priority":"urgent" }
```
- **Resposta 201** ([send-message-response.dto.ts](backend/src/messages/dto/send-message-response.dto.ts)):
```json
{ "id":"uuid","status":"queued","timestamp":"ISO",
  "estimatedDelivery":"ISO (+5s)","cost":0.25,"currentBalance":49.75 }
```
  `currentBalance` só aparece para pré-pago.
- **Erros:** 400 (faltou `recipientId`/`recipientName` ao iniciar conversa), 401, 404 (conversa inexistente/de outro cliente), **422** (saldo insuficiente / limite excedido).

> **Ausências notáveis:** não há `GET /clients` nem `GET /clients/:id`; não há endpoint para listar transações. O `GET /` (raiz) **não funciona** (controller não registrado).

---

## 11. Fluxos de Negócio

### 11.1 Cadastro de empresa
1. Usuário acessa `/register` ([RegisterPage.tsx](frontend/src/features/auth/RegisterPage.tsx)).
2. Zod valida nome, documento (11 ou 14 dígitos) e plano.
3. `POST /clients` → [clients.service.ts](backend/src/clients/clients.service.ts) checa documento único e cria.
4. Redireciona para `/` para login.

### 11.2 Login
Ver diagrama na seção 7.4. Backend valida documento+tipo e ativo, assina JWT (`sub = client.id`, 7d).

### 11.3 Envio de mensagem (fluxo completo)
```mermaid
sequenceDiagram
  participant FE as Frontend
  participant API as MessagesController
  participant SVC as MessagesService
  participant BIL as BillingService
  participant DB as Postgres
  participant Q as MessageQueue
  participant W as MessageWorker
  participant WS as ChatGateway

  FE->>API: POST /messages (Bearer)
  API->>SVC: send(client, dto)
  SVC->>DB: $transaction begin
  SVC->>BIL: charge(client, priority, tx)
  BIL-->>SVC: cost / balanceAfter (ou 422)
  SVC->>DB: create Message(queued) + Transaction + update Conversation
  SVC->>DB: commit
  SVC->>Q: enqueue(messageId, priority)
  SVC-->>FE: 201 { status: queued, cost, currentBalance? }
  loop a cada 1s
    W->>Q: dequeue()
    W->>DB: status processing → sent
    W->>WS: emitMessageStatus(...)
    WS-->>FE: message:status
  end
  W->>DB: (+2s) delivered  / (+4s) read
  W->>WS: message:status
  WS-->>FE: atualiza ticks
```
Passo a passo:
1. Frontend insere mensagem otimista (`queued`) no cache ([useSendMessage.ts](frontend/src/hooks/useSendMessage.ts)).
2. `MessagesService.resolveConversationId` usa a conversa (validando posse) ou cria uma nova.
3. Transação: cobra, cria `Message`, cria `Transaction`, atualiza `lastMessage*`.
4. Enfileira o id; resposta reconcilia o otimista e atualiza saldo/uso no store.
5. Worker avança status e emite via WS; `useChatSocket` atualiza os ticks.

### 11.4 Adicionar crédito / limite
1. `AddCreditModal` envia `PATCH /clients/:id/credit` ([AddCreditModal.tsx](frontend/src/features/chat/AddCreditModal.tsx)).
2. Service incrementa `balance` (pré) ou `monthlyLimit` (pós).
3. Frontend atualiza o store com a resposta e exibe toast.

### 11.5 Tempo real (status / typing / presença)
- `join` ao abrir conversa → recebe `message:status` da sala.
- Digitar dispara `emitTyping` (debounce 1,5s) → `typing` na sala.
- Connect/disconnect emite `presence` (ver ressalvas).

---

## 12. Variáveis de Ambiente

### Raiz `.env` (Docker Compose) — [.env.example](.env.example)
| Nome | Finalidade | Obrigatória | Exemplo |
|---|---|---|---|
| `POSTGRES_USER` | Usuário do Postgres | Sim (tem default `bcb`) | `bcb` |
| `POSTGRES_PASSWORD` | Senha do Postgres | Sim (default `bcb`) | `bcb` |
| `POSTGRES_DB` | Nome do banco | Sim (default `bcb`) | `bcb` |
| `JWT_SECRET` | Segredo de assinatura do JWT | **Sim** | `troque-este-segredo` |

### Backend — [backend/.env](backend/.env)
| Nome | Finalidade | Obrigatória | Exemplo |
|---|---|---|---|
| `DATABASE_URL` | Conexão Prisma↔Postgres | **Sim** | `postgresql://bcb:bcb@localhost:5432/bcb?schema=public` |
| `JWT_SECRET` | Segredo do JWT (lido por `AuthModule`) | **Sim** | `5962...` |
| `PORT` | Porta da API (default 3000) | Não | `3000` |
| `CORS_ORIGIN` | Origem CORS (definida no compose, **não usada** no código) | Não | `http://localhost:8080` |

### Frontend — [frontend/.env.example](frontend/.env.example)
| Nome | Finalidade | Obrigatória | Exemplo |
|---|---|---|---|
| `VITE_API_URL` | Base da API REST + WS | Não (default `http://localhost:3000`) | `http://localhost:3000` |

> No Docker, `VITE_API_URL` é injetada como `ARG` no build do frontend ([frontend/Dockerfile](frontend/Dockerfile)) — alterá-la exige rebuild.

---

## 13. Convenções e Padrões

- **Vertical slices** no backend (módulo por feature) — [CLAUDE.md](CLAUDE.md).
- **Controllers finos, services gordos**: regra de negócio só no service; controller recebe dados resolvidos via `@CurrentClient()`.
- **DTOs**: entrada com `class-validator`; saída com `@ApiProperty` (Swagger). `ValidationPipe` global com `whitelist: true`.
- **Dinheiro sempre `Prisma.Decimal`** no domínio; `number` apenas no JSON. Use `.add()/.sub()/.lt()/.gt()`.
- **Prisma 6 fixado** (não migrar para 7 — conflito ESM/CommonJS com Nest).
- **Commits por slice**: ex. `feat(auth): login via documentId` (ver histórico `git log`).
- **Migrations sempre commitadas**.
- **Frontend**: React Query para servidor, Zustand para auth; `features/` para telas, `components/` para genéricos, `hooks/` para acesso a dados.
- **Custos**: normal R$0,25, urgente R$0,50 — duplicados em [billing.service.ts](backend/src/billing/billing.service.ts) (backend) e [types.ts](frontend/src/lib/types.ts) (`MESSAGE_COST`).
- **Nomenclatura**: arquivos em kebab/camel conforme tipo (`*.service.ts`, `*.controller.ts`, `*.dto.ts`; React em PascalCase).
- **Lint/format**: ESLint + Prettier nos dois projetos (`npm run lint` / `npm run format`).

---

## 14. Troubleshooting

| Sintoma | Diagnóstico | Solução |
|---|---|---|
| `401` em todas as rotas | Token ausente/expirado; `JWT_SECRET` diferente entre quem assinou e quem valida | Refazer login; garantir mesmo `JWT_SECRET` no `.env` do backend |
| `422` ao enviar mensagem | Pré-pago sem saldo ou pós-pago acima do limite ([prepaid](backend/src/billing/strategies/prepaid.strategy.ts)/[postpaid](backend/src/billing/strategies/postpaid.strategy.ts)) | Adicionar crédito/limite via `PATCH /clients/:id/credit` |
| Mensagem fica eternamente `queued` | Backend reiniciou → fila em memória perdida; worker não reprocessa pendências | Reenviar; em produção, trocar a fila por durável (seção 15) |
| Status não atualiza no chat | Socket desconectado ou não entrou na sala (`join`) | Verificar `connectSocket()` em [HomePage.tsx](frontend/src/features/chat/HomePage.tsx) e `VITE_API_URL` |
| Frontend chama URL errada da API | `VITE_API_URL` "assada" no build do Docker | Rebuild com o `ARG` correto |
| Prisma: `Environment variable not found: DATABASE_URL` | `.env` ausente no backend | Criar `backend/.env` com `DATABASE_URL` |
| `prisma generate` falha por OpenSSL | Falta libssl (containers slim) | Imagem já instala `openssl` ([backend/Dockerfile](backend/Dockerfile)) |
| `409` ao cadastrar | Documento já existe | Usar outro documento |

---

## 15. Débitos Técnicos e Melhorias

### Bugs / inconsistências
1. **`AppController`/`AppService` órfãos** — não registrados em [app.module.ts](backend/src/app.module.ts); `GET /` retorna 404. São código morto: registrar (se um healthcheck for desejado) ou remover ambos.
2. **Indicador de digitação reflete para o próprio remetente** — `handleTyping` faz `server.to(room).emit(...)` para **toda** a sala, incluindo quem enviou; como o único participante real é o próprio cliente, ele tende a ver "digitando…" de si mesmo ([chat.gateway.ts](backend/src/realtime/chat.gateway.ts) + [useChatSocket.ts](frontend/src/hooks/useChatSocket.ts)). Usar `client.broadcast.to(room)`.
3. **Presença é fictícia** — `presence` usa `recipientId: client.id` (o socket id) e o frontend liga/desliga `isRecipientOnline` para qualquer evento, sem correlacionar com o destinatário da conversa aberta ([chat.gateway.ts](backend/src/realtime/chat.gateway.ts)).
4. **`unreadCount` nunca é incrementado** — fica sempre 0 (exceto o que vier do seed); o worker não o atualiza. O badge de não lidas é, na prática, inerte.
5. **Saldo pós-pago pode divergir** — o backend não devolve o uso atual; o frontend **incrementa localmente** `monthlyUsage` ([useSendMessage.ts](frontend/src/hooks/useSendMessage.ts)), podendo dessincronizar do servidor.

### Segurança / autorização
6. **`PATCH /clients/:id/credit` sem checagem de posse** — qualquer cliente autenticado pode adicionar crédito/limite a **qualquer** `:id`. Deveria validar `id === client.id` (ou ter papel admin).
7. **`POST /clients` totalmente público** — rotulado "admin" no Swagger, mas sem guard; permite criação livre de clientes.
8. **Segredo commitado** — [backend/.env](backend/.env) tem `JWT_SECRET` real versionado; e o compose usa fallback `dev-secret-change-me`. Externalizar e remover do versionamento.
9. **CORS aberto** — `app.enableCors()` sem origem ([main.ts](backend/src/main.ts)); `CORS_ORIGIN` do compose é ignorado. Restringir por origem.

### Arquitetura / robustez
10. **Fila e estado em memória** — `PriorityQueue` e timers vivem no processo ([message-queue.service.ts](backend/src/queue/message-queue.service.ts), [message.worker.ts](backend/src/queue/message.worker.ts)): reinício perde mensagens enfileiradas e os timers `delivered/read` não sobrevivem nem são cancelados no shutdown. Migrar para fila durável (Redis/BullMQ) ou reprocessar `queued` no boot.
11. **Throughput de 1 msg/s** — o worker desenfileira só 1 item por tick de 1s. Processar em lote/loop por tick.
12. **Custos duplicados** — `0.25/0.50` no backend e no frontend; risco de divergência. Centralizar (ex.: expor via endpoint/config).
13. **Sem testes** — o scaffolding padrão do Nest foi removido (testava apenas boilerplate). Não há cobertura no backend nem no frontend. Adicionar testes de billing (422), `messages.service` (transação) e hooks.
14. **README desatualizado** — checklist de funcionalidades em [README.md](README.md) está com itens desmarcados embora implementados; "Premissas" e "Trabalho futuro" incompletos.
15. **Dockerfile do backend roda `seed` em todo start** — em produção isso re-popula dados a cada deploy. Mover seed para etapa manual/controlada.

---

## 16. Onboarding Rápido — Primeira Semana no Projeto

### Dia 1 — Panorama
- Leia [README.md](README.md), [CLAUDE.md](CLAUDE.md) e as seções 1–2 deste documento.
- Suba tudo com Docker (`cp .env.example .env && docker compose up --build`) e abra `/docs`.
- Faça login no Swagger com o cliente de seed pré-pago (`52998224725` / `CPF`).

### Dia 2 — Caminho da mensagem (o coração do sistema)
Leia **nesta ordem**:
1. [messages.controller.ts](backend/src/messages/messages.controller.ts) → 2. [messages.service.ts](backend/src/messages/messages.service.ts) → 3. [billing.service.ts](backend/src/billing/billing.service.ts) e as estratégias → 4. [message.worker.ts](backend/src/queue/message.worker.ts) → 5. [chat.gateway.ts](backend/src/realtime/chat.gateway.ts).
Acompanhe o diagrama da seção 11.3.

### Dia 3 — Autenticação e dados
- [auth.service.ts](backend/src/auth/auth.service.ts) + [auth.guard.ts](backend/src/common/guards/auth.guard.ts) + [current-client.ts](backend/src/common/decorators/current-client.ts).
- [schema.prisma](backend/prisma/schema.prisma) e [seed.ts](backend/prisma/seed.ts) (seção 9).

### Dia 4 — Frontend
- [main.tsx](frontend/src/main.tsx) → [App.tsx](frontend/src/App.tsx) → [auth.store.ts](frontend/src/store/auth.store.ts) → [api.ts](frontend/src/lib/api.ts).
- Fluxo de chat: [HomePage.tsx](frontend/src/features/chat/HomePage.tsx) → [ChatPanel.tsx](frontend/src/features/chat/ChatPanel.tsx) → [useSendMessage.ts](frontend/src/hooks/useSendMessage.ts) → [useChatSocket.ts](frontend/src/hooks/useChatSocket.ts).

### Dia 5 — Primeira contribuição (sugestões de baixo risco)
Boas tarefas para começar, baseadas na seção 15:
- **Corrigir o typing self-echo** (item 2) trocando para `client.broadcast.to(room)`.
- **Registrar ou remover `AppController`/`AppService`** (código morto — item 1).
- **Adicionar checagem de posse** em `/clients/:id/credit` (item 6).

Fluxo de contribuição: crie branch a partir de `main`, faça commit por slice (`feat(...)`/`fix(...)`), rode `npm run lint` nos dois projetos e abra PR.

---

## 17. Resumo Executivo

**BCB (Big Chat Brasil)** é uma plataforma de mensageria corporativa: empresas autenticam por
**CPF/CNPJ**, enviam mensagens para clientes finais (simulados) e são **cobradas por mensagem**
(pré-pago = debita saldo; pós-pago = consome limite mensal). Mensagens normais custam R$0,25 e
urgentes R$0,50.

**Stack:** backend **NestJS + Prisma + PostgreSQL + socket.io**; frontend **React + Vite + React
Query + Zustand**; tudo orquestrado por **Docker Compose**.

**Como funciona em uma frase:** `POST /messages` abre uma transação que **cobra → cria a mensagem
`queued` → registra transação → enfileira**; um **worker em memória** avança o status
(`processing → sent → delivered → read`) por timers e **emite eventos WebSocket** que o frontend
aplica ao cache do React Query, atualizando os "ticks" em tempo real.

**Para começar a mexer:** suba com Docker, leia o caminho da mensagem (seção 11.3 / Dia 2 do
onboarding) e, para o primeiro PR, escolha um item de baixo risco da seção 15.

**O que saber de cara (pegadinhas):** fila e timers são **em memória** (perdidos no restart);
**presença e `unreadCount`** são essencialmente fictícios hoje; **`GET /` está quebrado** (controller
não registrado); e há **lacunas de autorização** em `/clients` que devem ser tratadas antes de
qualquer uso real.
```

