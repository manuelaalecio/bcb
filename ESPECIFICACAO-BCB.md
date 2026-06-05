# BCB — Big Chat Brasil · Especificação Técnica

> **Como usar este documento:** ele é a fonte de verdade do projeto. No Claude Code, salve-o em `docs/ESPECIFICACAO.md` e referencie-o nas tarefas ("siga `docs/ESPECIFICACAO.md`"). Opcionalmente, crie um `CLAUDE.md` curto na raiz apontando para cá. Sempre que uma decisão de implementação for ambígua, este arquivo decide.

---

## 1. Visão geral

O **BCB (Big Chat Brasil)** é uma plataforma de chat entre **empresas (clientes da plataforma)** e seus **clientes finais (destinatários)**. A empresa se autentica, vê suas conversas, e envia mensagens — cada mensagem tem **custo** e passa por uma **fila** antes de ser entregue.

Este projeto é um **desafio fullstack**. O foco da avaliação é: Backend (40%), Frontend (40%), Integração (20%).

**Escopo implementado (além do mínimo):**

- Parte 1 completa (auth + conversas + mensagens + integração).
- Parte 2 — backend: **fila com prioridade** + **validação financeira (pré/pós-pago)**.
- Parte 2 — frontend: **status de mensagem (enviada/entregue/lida)** + **digitação/presença**.
- Parte 3: **Docker** (docker-compose orquestrando tudo).

---

## 2. Stack e decisões técnicas

| Camada         | Escolha                                                          | Motivo                                                                                                                                                                           |
| -------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend        | **NestJS** (TypeScript)                                          | Estrutura modular, DI nativa, integra bem com Prisma e WebSocket.                                                                                                                |
| ORM            | **Prisma 6** (`prisma-client-js`, import de `@prisma/client`)    | Prisma 7 exige ESM + driver adapter, o que conflita com o CommonJS padrão do NestJS. O 6 tem zero atrito e documentação madura. Ganho do 7 (edge/serverless) é irrelevante aqui. |
| Banco          | **PostgreSQL 16** (via Docker)                                   | Mesmo banco em dev e em produção. Necessário para a validação financeira ser crível (saldo, transações).                                                                         |
| Tempo real     | **WebSocket** (socket.io via `@nestjs/websockets`)               | Necessário para status de mensagem e digitação/presença.                                                                                                                         |
| Frontend       | **React + Vite + TypeScript**                                    | —                                                                                                                                                                                |
| Estado (front) | **React Query** (estado de servidor) + **Zustand** (auth/socket) | React Query resolve cache/loading/error/refetch sem o peso do Redux.                                                                                                             |
| HTTP (front)   | **axios** com interceptor de Bearer token                        | —                                                                                                                                                                                |
| Auth           | **JWT** (`@nestjs/jwt`) + Guard                                  | O desafio pede "token simples"; JWT atende e é padrão.                                                                                                                           |
| Orquestração   | **Docker Compose**                                               | `docker compose up` sobe db + backend + frontend.                                                                                                                                |

**Regra de ouro do projeto:** priorizar entregar o **fluxo completo funcionando** antes de sofisticar. Uma fatia vertical pronta > várias partes complexas desconectadas.

---

## 3. Regras de negócio

### 3.1 Clientes e planos

- Cliente é **PF (CPF)** ou **PJ (CNPJ)**.
- Cada cliente tem **um plano**: `prepaid` (pré-pago) ou `postpaid` (pós-pago), e um status `active`.

### 3.2 Custo das mensagens

- **Normal:** R$ 0,25
- **Urgente:** R$ 0,50
- Valores monetários **sempre** como `Decimal` — nunca `Float` (erro de arredondamento em dinheiro).

### 3.3 Ciclo de vida da mensagem

`queued → processing → sent → delivered → read` (ou `failed`).
O sistema registra data/hora, status e o cliente solicitante.

### 3.4 Validação de pagamento (no envio)

**Pré-pago:**

1. Verifica se `balance >= custo`. Se não, **rejeita** o envio (HTTP 402/422).
2. Debita: `balance -= custo`.
3. Registra `Transaction` (type `debit`, `balanceAfter`).
4. Enfileira a mensagem.

**Pós-pago:**

1. Verifica se `monthlyUsage + custo <= monthlyLimit`. Se não, **rejeita**.
2. Contabiliza: `monthlyUsage += custo`.
3. Registra `Transaction` (type `usage`).
4. Enfileira a mensagem.

> O `monthlyUsage` zera no início de cada mês. Para o desafio, pode-se assumir reset manual/seed; documentar como premissa.

### 3.5 Priorização

- **Normal:** processada em ordem **FIFO**.
- **Urgente:** processada **prioritariamente** (à frente das normais), e FIFO entre urgentes.

---

## 4. Modelo de dados (Prisma 6)

`backend/prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum DocumentType {
  CPF
  CNPJ
}

enum PlanType {
  prepaid
  postpaid
}

enum Priority {
  normal
  urgent
}

enum SenderType {
  client
  user
}

enum MessageStatus {
  queued
  processing
  sent
  delivered
  read
  failed
}

model Client {
  id           String       @id @default(uuid())
  name         String
  documentId   String       @unique
  documentType DocumentType
  planType     PlanType
  balance      Decimal      @default(0) @db.Decimal(10, 2) // pré-pago
  monthlyLimit Decimal      @default(0) @db.Decimal(10, 2) // pós-pago
  monthlyUsage Decimal      @default(0) @db.Decimal(10, 2) // pós-pago
  active       Boolean      @default(true)
  createdAt    DateTime     @default(now())

  conversations Conversation[]
  transactions  Transaction[]
}

model Conversation {
  id                 String    @id @default(uuid())
  client             Client    @relation(fields: [clientId], references: [id])
  clientId           String
  recipientId        String
  recipientName      String
  lastMessageContent String?
  lastMessageTime    DateTime?
  unreadCount        Int       @default(0)
  createdAt          DateTime  @default(now())

  messages Message[]

  @@index([clientId])
}

model Message {
  id             String        @id @default(uuid())
  conversation   Conversation  @relation(fields: [conversationId], references: [id])
  conversationId String
  content        String
  senderId       String
  senderType     SenderType
  priority       Priority      @default(normal)
  status         MessageStatus @default(queued)
  cost           Decimal       @default(0) @db.Decimal(10, 2)
  createdAt      DateTime      @default(now())

  transaction Transaction?

  @@index([conversationId])
}

model Transaction {
  id           String   @id @default(uuid())
  client       Client   @relation(fields: [clientId], references: [id])
  clientId     String
  message      Message? @relation(fields: [messageId], references: [id])
  messageId    String?  @unique
  amount       Decimal  @db.Decimal(10, 2)
  type         String   // "debit" (pré) | "usage" (pós)
  balanceAfter Decimal  @db.Decimal(10, 2)
  createdAt    DateTime @default(now())

  @@index([clientId])
}
```

**Importante ao manipular Decimal:** o Prisma retorna `Decimal` (objeto `Prisma.Decimal`), não `number`. Faça contas com os métodos do Decimal (`.add`, `.sub`, `.gte`) e converta para número só na borda da API (resposta JSON).

---

## 5. Arquitetura do backend (módulos NestJS)

Implementar em **fatias verticais** (do banco ao endpoint, uma feature por vez).

```
backend/src/
├── main.ts                  # CORS, ValidationPipe global, Swagger, listen(0.0.0.0)
├── app.module.ts            # importa PrismaModule + módulos de feature
│
├── prisma/
│   ├── prisma.module.ts     # @Global
│   └── prisma.service.ts    # extends PrismaClient, $connect no onModuleInit
│
├── common/
│   ├── guards/auth.guard.ts            # valida JWT, injeta client no request
│   ├── decorators/current-client.ts    # @CurrentClient() param decorator
│   └── filters/http-exception.filter.ts
│
├── auth/                    # POST /auth
│   ├── auth.module.ts
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   └── dto/auth-request.dto.ts
│
├── clients/                 # CRUD + admin (créditos/limite)
│   ├── clients.module.ts
│   ├── clients.controller.ts
│   ├── clients.service.ts
│   └── dto/
│
├── billing/                 # validação financeira (Parte 2)
│   ├── billing.module.ts
│   ├── billing.service.ts   # valida → debita/contabiliza → grava Transaction
│   └── strategies/
│       ├── billing-strategy.interface.ts
│       ├── prepaid.strategy.ts
│       └── postpaid.strategy.ts
│
├── conversations/           # GET /conversations, GET /:id/messages
│   ├── conversations.module.ts
│   ├── conversations.controller.ts
│   └── conversations.service.ts
│
├── messages/                # POST /messages
│   ├── messages.module.ts
│   ├── messages.controller.ts
│   ├── messages.service.ts  # orquestra billing.validate() → queue.enqueue()
│   └── dto/send-message.dto.ts
│
├── queue/                   # fila com prioridade (Parte 2)
│   ├── queue.module.ts
│   ├── priority-queue.ts    # estrutura de dados pura
│   ├── message-queue.service.ts
│   └── message.worker.ts    # consome a fila, avança status, emite via WS
│
└── realtime/                # WebSocket (Parte 2)
    ├── realtime.module.ts
    └── chat.gateway.ts      # message:status, typing, presence
```

---

## 6. Contrato da API

Todos os endpoints (exceto `POST /auth`) exigem header `Authorization: Bearer <token>`.

| Método  | Rota                          | Body / Params                  | Resposta                 |
| ------- | ----------------------------- | ------------------------------ | ------------------------ |
| `POST`  | `/auth`                       | `{ documentId, documentType }` | `{ token, client }`      |
| `GET`   | `/conversations`              | —                              | `ConversationResponse[]` |
| `GET`   | `/conversations/:id/messages` | —                              | `MessageResponse[]`      |
| `POST`  | `/messages`                   | `SendMessageRequest`           | `SendMessageResponse`    |
| `POST`  | `/clients`                    | dados do cliente               | `Client`                 |
| `PATCH` | `/clients/:id/credit`         | `{ amount }`                   | `Client`                 |

### DTOs (espelho do front e do back)

```typescript
// Autenticação
interface AuthRequest {
  documentId: string;
  documentType: "CPF" | "CNPJ";
}
interface AuthResponse {
  token: string;
  client: {
    id: string;
    name: string;
    documentId: string;
    documentType: "CPF" | "CNPJ";
    balance?: number;
    limit?: number;
    planType: "prepaid" | "postpaid";
    active: boolean;
  };
}

// Conversa
interface ConversationResponse {
  id: string;
  recipientId: string;
  recipientName: string;
  lastMessageContent: string;
  lastMessageTime: string;
  unreadCount: number;
}

// Enviar mensagem
interface SendMessageRequest {
  conversationId: string;
  recipientId?: string; // para iniciar nova conversa
  content: string;
  priority: "normal" | "urgent";
}
interface SendMessageResponse {
  id: string;
  status: "queued";
  timestamp: string;
  estimatedDelivery: string;
  cost: number;
  currentBalance?: number; // apenas pré-pago
}

// Mensagem (histórico)
interface MessageResponse {
  id: string;
  conversationId: string;
  content: string;
  sentBy: { id: string; type: "client" | "user" };
  timestamp: string;
  priority: "normal" | "urgent";
  status: "queued" | "processing" | "sent" | "delivered" | "read" | "failed";
  cost: number;
}
```

### Padrão de erro

```json
{
  "statusCode": 422,
  "error": "InsufficientBalance",
  "message": "Saldo insuficiente para enviar a mensagem."
}
```

Validação financeira que falha → **422** (ou 402). Token inválido → **401**. Recurso inexistente → **404**.

---

## 7. Fila com prioridade

**Decisão:** estrutura **própria em memória** (não BullMQ/Redis). É o item de maior peso do backend (15%) e o desafio pede "fila simples / array ordenado" — implementar à mão demonstra a habilidade avaliada.

`priority-queue.ts` — estrutura de dados pura:

- `enqueue(item)`: urgentes vão para a frente das normais; FIFO dentro de cada prioridade.
- `dequeue()`: retorna o item de maior prioridade mais antigo.
- `size()`, `isEmpty()`.

`message-queue.service.ts`: encapsula a instância da fila; expõe `enqueue(message)`.

`message.worker.ts`: um loop (ex.: `setInterval` a cada ~1s) que:

1. `dequeue()` a próxima mensagem.
2. Atualiza status no banco para `processing` → emite `message:status` via WS.
3. Após pequeno delay, `sent` → emite WS.
4. (Simulação) timers marcam `delivered` e depois `read` → emite WS.
5. Em erro, marca `failed`.

> O "outro lado" (cliente final) é **simulado**: a progressão sent→delivered→read vem de timers no worker, não de um usuário real. Documentar como premissa.

---

## 8. Cobrança (billing)

**Padrão Strategy** — uma estratégia por tipo de plano, selecionada em runtime:

```typescript
interface BillingStrategy {
  // valida e aplica o débito/consumo; lança exceção se não puder cobrar
  charge(client: Client, cost: Decimal): Promise<{ balanceAfter: Decimal }>;
}
```

- `PrepaidStrategy`: exige `balance >= cost`, debita, grava `Transaction(debit)`.
- `PostpaidStrategy`: exige `monthlyUsage + cost <= monthlyLimit`, soma usage, grava `Transaction(usage)`.

`BillingService.charge(client, priority)`:

1. Calcula `cost` (normal R$0,25 / urgente R$0,50).
2. Seleciona a strategy por `client.planType`.
3. Executa **dentro de uma transação do Prisma** (`prisma.$transaction`) para que débito + registro + criação da mensagem sejam atômicos.

`MessagesService.send()` orquestra: `billing.charge()` → cria `Message(queued)` → `queue.enqueue()` → responde.

---

## 9. Tempo real (WebSocket)

`chat.gateway.ts` (namespace `/chat`). Eventos:

| Evento           | Direção         | Payload                                 |
| ---------------- | --------------- | --------------------------------------- |
| `message:status` | server → client | `{ messageId, conversationId, status }` |
| `typing`         | bidirecional    | `{ conversationId, isTyping }`          |
| `presence`       | server → client | `{ recipientId, online }`               |

O front conecta após o login (com o token), entra na "sala" da conversa aberta, e atualiza a UI ao receber `message:status` (os ticks) e `typing`/`presence`.

---

## 10. Frontend (estrutura + estado)

```
frontend/src/
├── main.tsx                 # QueryClientProvider + Router
├── lib/
│   ├── api.ts               # axios + interceptor (Bearer)
│   └── socket.ts            # socket.io-client singleton
├── types/index.ts           # interfaces espelhando os DTOs do back
├── store/auth.store.ts       # Zustand: token + client logado (persistido)
├── hooks/
│   ├── useConversations.ts  # useQuery
│   ├── useMessages.ts       # useQuery(conversationId)
│   ├── useSendMessage.ts    # useMutation + update otimista
│   └── useChatSocket.ts     # ouve message:status / typing / presence
├── features/
│   ├── auth/LoginPage.tsx           # CPF/CNPJ + tipo
│   ├── conversations/
│   │   ├── ConversationList.tsx
│   │   └── ConversationItem.tsx     # último texto, hora, unreadCount
│   └── chat/
│       ├── ChatPage.tsx
│       ├── MessageList.tsx
│       ├── MessageBubble.tsx        # ticks de status (✓ / ✓✓ / ✓✓ azul)
│       ├── MessageComposer.tsx      # toggle normal/urgente + custo estimado
│       ├── TypingIndicator.tsx
│       └── PresenceBadge.tsx
└── components/              # UI genérica: Button, Input, Spinner, Avatar, Toast
```

**Estado:**

- **Servidor** (conversas, mensagens) → React Query. Loading/error/empty saem prontos dos estados da query.
- **Auth/socket** → Zustand. Token guardado e injetado no axios e no socket.
- **Envio** → `useMutation` com **atualização otimista**: a mensagem aparece como `queued` na hora; o WS confirma `sent/delivered/read` depois e o React Query atualiza o cache.

**Erro de saldo:** quando `POST /messages` retorna 422, mostrar toast e bloquear o reenvio até haver saldo/limite.

---

## 11. Convenções de código

- **TypeScript estrito.** Sem `any` (use tipos dos DTOs).
- **Dinheiro = `Decimal`** no back; converter para `number` só na resposta JSON.
- **DTOs com `class-validator`** (`@IsString`, `@IsEnum`, `@IsNotEmpty`); `ValidationPipe` global com `whitelist: true`.
- **Validação de CPF/CNPJ** no DTO de auth (validar formato/dígitos).
- **Exceptions do Nest** (`BadRequestException`, `UnprocessableEntityException`, etc.) + `HttpExceptionFilter` global para padronizar o corpo de erro.
- **Services não acessam `req`**; recebem dados já resolvidos. O `client` autenticado chega via `@CurrentClient()`.
- **Nada de lógica de negócio em controller** — controller só recebe/responde; regra vive no service.
- **Commits pequenos e por fatia** (ex.: `feat(auth): login via documentId`).
- **Migrations versionadas** em `prisma/migrations/` (commitar sempre).

---

## 12. Roadmap de implementação (ordem)

Construir nesta ordem garante um sistema integrado em cada etapa.

1. **PrismaModule/PrismaService** + migration aplicada. ✅ (feito)
2. **Seed** — 2-3 clientes (1 pré-pago com saldo, 1 pós-pago com limite), 1 conversa com destinatário e algumas mensagens.
3. **Auth** — DTO + validação CPF/CNPJ → `AuthService` (busca client, assina JWT) → `{ token, client }` → `AuthGuard` + `@CurrentClient()`.
4. **Conversas (leitura)** — `GET /conversations` e `GET /:id/messages`.
5. **Frontend base** — login → guarda token → lista conversas → abre chat e renderiza histórico. **Aqui o fluxo já está integrado ponta a ponta.**
6. **Envio síncrono** — `POST /messages` retornando `sent` direto (sem fila ainda), aparecendo no chat.
7. **Billing** — validação pré/pós-pago + `Transaction`, bloqueando sem saldo/limite.
8. **Fila + worker** — passa a `queued`, worker avança status.
9. **WebSocket** — push de `message:status` (ticks) + `typing`/`presence`.
10. **Polimento** — responsivo, estados de loading/error/empty, update otimista.
11. **Fechamento** — `docker compose up` funcionando, README, Swagger (`/docs`), alguns testes (billing e fila são os melhores alvos).

---

## 13. Como rodar

**Dev local:**

```bash
docker compose up db          # terminal 1 — só o banco

cd backend && npm install
npx prisma migrate dev        # aplica migrations
npm run start:dev             # terminal 2 — API em :3000

cd frontend && npm install
npm run dev                   # terminal 3 — UI no Vite
```

**Tudo via Docker:**

```bash
cp .env.example .env
docker compose up --build
```

Frontend `:8080` · Backend `:3000` · Swagger `:3000/docs` · Postgres `:5432`.

**Atenção a hosts:** dev local usa `localhost:5432` no `backend/.env`; dentro do Docker, o compose injeta `db:5432`. Vite "assa" `VITE_API_URL` no build (build arg), apontando para `localhost:3000` (o navegador roda no host, não enxerga o hostname `backend`).

---

## Apêndice — Premissas a documentar no README

- Cliente final (destinatário) é **simulado**; o ciclo sent→delivered→read vem de timers do worker.
- `monthlyUsage` do pós-pago: reset mensal assumido (manual/seed) no escopo do desafio.
- **Prisma 6** escolhido deliberadamente sobre o 7 (conflito ESM com NestJS, versão recém-lançada, ganho nulo para o escopo) — decisão técnica consciente.
