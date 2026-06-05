# BCB — Big Chat Brasil

Plataforma de chat fullstack para **empresas enviarem mensagens aos seus clientes finais**. As
empresas autenticam por **CPF/CNPJ**, enviam mensagens com uma **fila de prioridade** (normal/urgente)
e são **cobradas por mensagem** (plano pré-pago debita saldo; pós-pago consome limite mensal). O
status da mensagem (`enviada → entregue → lida`) é atualizado em **tempo real** via WebSocket, no
estilo WhatsApp.

> O destinatário final é **simulado**: não há app do lado do cliente final — um worker no backend
> avança o ciclo de vida da mensagem por timers.

---

## Sumário

- [Tecnologias](#tecnologias)
- [Pré-requisitos](#pré-requisitos)
- [Começando (Docker — recomendado)](#começando-docker--recomendado)
- [Desenvolvimento local (sem Docker)](#desenvolvimento-local-sem-docker)
- [Seeds (dados de exemplo)](#seeds-dados-de-exemplo)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Scripts úteis](#scripts-úteis)
- [Estrutura do projeto](#estrutura-do-projeto)
- [API](#api)

---

## Tecnologias

### Backend (`backend/`)

| Tecnologia                              | Uso                                                                      |
| --------------------------------------- | ------------------------------------------------------------------------ |
| **NestJS 11**                           | Framework Node com injeção de dependência, organizado em vertical slices |
| **Prisma 6** (`@prisma/client`)         | ORM com schema declarativo, migrations e `Prisma.Decimal` para dinheiro  |
| **PostgreSQL 16**                       | Banco relacional (`DECIMAL(10,2)` para valores monetários)               |
| **socket.io 4**                         | WebSocket com rooms por conversa (status, typing, presença)              |
| **@nestjs/jwt**                         | Autenticação stateless via JWT (expira em 7 dias)                        |
| **class-validator / class-transformer** | Validação declarativa de DTOs (`ValidationPipe` global)                  |
| **@nestjs/swagger**                     | Documentação OpenAPI em `/docs`                                          |
| **TypeScript 5**                        | Tipagem estática, modo strict                                            |

> **Prisma fixado no 6** propositalmente — o Prisma 7 tem conflito ESM/CommonJS com o NestJS.

### Frontend (`frontend/`)

| Tecnologia                  | Uso                                                           |
| --------------------------- | ------------------------------------------------------------- |
| **React 19 + Vite 8**       | UI + bundler com HMR rápido                                   |
| **TypeScript**              | Tipagem estática e contrato de tipos compartilhado            |
| **@tanstack/react-query 5** | Estado de servidor: cache, optimistic updates, invalidação    |
| **Zustand 5** (+persist)    | Estado de auth (token + cliente) persistido em `localStorage` |
| **react-router-dom 7**      | Roteamento da SPA                                             |
| **react-hook-form + zod**   | Formulários e validação (CPF/CNPJ, valores)                   |
| **axios**                   | HTTP client com interceptor de Bearer token                   |
| **socket.io-client**        | Eventos em tempo real (status, typing, presença)              |

### Infra

- **Docker / Docker Compose** orquestra `db`, `backend` e `frontend`.
- **nginx** serve a SPA em produção com fallback para `index.html`.

---

## Pré-requisitos

- **Docker** e **Docker Compose** (caminho recomendado), **ou**
- **Node.js 20+** e **npm**, mais um **PostgreSQL 16** (pode ser via `docker compose up db`).

---

## Começando (Docker — recomendado)

Com **Docker** instalado, **um único comando sobe tudo** (banco + backend + frontend):

```bash
git clone <url-do-repositorio>
cd bcb-fullstack
docker compose up --build
```

Pronto — abra **http://localhost:8080** e faça login com um [cliente de exemplo](#como-entrar-com-um-cliente-de-seed).

Não é preciso criar `.env`, instalar dependências nem rodar migrations à mão:

- O [docker-compose.yml](docker-compose.yml) já define **valores padrão** para todas as variáveis
  (usuário/senha/banco do Postgres e `JWT_SECRET`) — sem `.env`, ele usa esses defaults.
- O container do backend **aplica as migrations e roda o seed automaticamente** na subida
  (`prisma migrate deploy && npm run seed`), então o banco já vem populado com clientes de exemplo.

Serviços disponíveis:

| Serviço        | URL                        |
| -------------- | -------------------------- |
| Frontend       | http://localhost:8080      |
| Backend (API)  | http://localhost:3000      |
| Swagger (docs) | http://localhost:3000/docs |
| PostgreSQL     | localhost:5432             |

> **Quer customizar?** Copie `cp .env.example .env` e ajuste as credenciais **antes** de subir. Em
> produção, defina sempre um `JWT_SECRET` próprio — o padrão `dev-secret-change-me` é só para
> desenvolvimento.

Comandos úteis:

- Parar: `Ctrl+C`.
- Subir em segundo plano: `docker compose up --build -d`.
- Zerar o banco (remove volumes): `docker compose down -v`.
- Garantir portas livres: `3000` (API), `8080` (frontend) e `5432` (Postgres).

---

## Desenvolvimento local (sem Docker)

```bash
# Terminal 1 — apenas o banco via Docker
docker compose up db

# Terminal 2 — backend
cd backend
npm install
cp .env.example .env            # ajuste DATABASE_URL e JWT_SECRET se necessário
npx prisma migrate dev          # aplica as migrations no banco local
npm run seed                    # popula clientes de exemplo
npm run start:dev               # API com watch em http://localhost:3000

# Terminal 3 — frontend
cd frontend
npm install
npm run dev                     # Vite (porta varia, ex.: http://localhost:5173)
```

> O backend precisa de um `backend/.env` com `DATABASE_URL` e `JWT_SECRET`. Exemplo de
> `DATABASE_URL`: `postgresql://bcb:bcb@localhost:5432/bcb?schema=public`.

---

## Seeds (dados de exemplo)

O seed fica em [backend/prisma/seed.ts](backend/prisma/seed.ts) e é **idempotente** (usa `upsert`),
ou seja, pode ser rodado várias vezes sem duplicar dados.

```bash
cd backend
npm run seed
```

> No Docker, o seed roda **automaticamente** na inicialização do backend — você não precisa
> executá-lo manualmente.

O que ele cria:

| Cliente                        | Documento        | Tipo | Plano    | Detalhes                                                                            |
| ------------------------------ | ---------------- | ---- | -------- | ----------------------------------------------------------------------------------- |
| **Loja do Zé (Pré-pago)**      | `52998224725`    | CPF  | Pré-pago | Saldo de **R$ 50,00** + 1 conversa de exemplo (João Silva) com 3 mensagens já lidas |
| **Mercado Central (Pós-pago)** | `11222333000181` | CNPJ | Pós-pago | Limite mensal de **R$ 100,00**                                                      |

### Como entrar com um cliente de seed

No frontend (`/`) ou no Swagger, faça login com:

```json
{ "documentId": "52998224725", "documentType": "CPF" }
```

O backend valida o documento, confirma que o cliente está ativo e devolve um **JWT** + os dados do
cliente. A partir daí você já consegue listar conversas e enviar mensagens (cada mensagem normal
custa R$ 0,25 e urgente R$ 0,50, debitadas do saldo/limite).

---

## Variáveis de ambiente

### Raiz `.env` (usado pelo Docker Compose) — [.env.example](.env.example)

| Nome                | Finalidade                   | Default       |
| ------------------- | ---------------------------- | ------------- |
| `POSTGRES_USER`     | Usuário do Postgres          | `bcb`         |
| `POSTGRES_PASSWORD` | Senha do Postgres            | `bcb`         |
| `POSTGRES_DB`       | Nome do banco                | `bcb`         |
| `JWT_SECRET`        | Segredo de assinatura do JWT | — (defina um) |

### Backend `backend/.env`

| Nome           | Finalidade                | Exemplo                                                 |
| -------------- | ------------------------- | ------------------------------------------------------- |
| `DATABASE_URL` | Conexão Prisma ↔ Postgres | `postgresql://bcb:bcb@localhost:5432/bcb?schema=public` |
| `JWT_SECRET`   | Segredo do JWT            | `troque-este-segredo`                                   |
| `PORT`         | Porta da API (opcional)   | `3000`                                                  |

### Frontend `frontend/.env`

| Nome           | Finalidade                   | Default                 |
| -------------- | ---------------------------- | ----------------------- |
| `VITE_API_URL` | Base da API REST + WebSocket | `http://localhost:3000` |

> No Docker, `VITE_API_URL` é injetada como `ARG` durante o build do frontend — alterá-la exige
> rebuild da imagem.

---

## Scripts úteis

### Backend (`cd backend`)

```bash
npm run start:dev       # dev server com watch em :3000
npm run build           # compila TypeScript para dist/
npm run seed            # popula dados de exemplo
npm run lint            # ESLint --fix
npm run format          # Prettier
npx prisma migrate dev  # cria/aplica migrations (dev)
npx prisma studio       # navega o banco no browser
```

### Frontend (`cd frontend`)

```bash
npm run dev       # Vite dev server
npm run build     # tsc -b && vite build
npm run lint      # ESLint
npm run format    # Prettier
npm run preview   # serve o build localmente
```

---

## Estrutura do projeto

```
bcb-fullstack/
├── docker-compose.yml      # orquestra db + backend + frontend
├── .env.example            # variáveis do compose
├── backend/                # API NestJS
│   ├── prisma/             # schema, migrations e seed
│   └── src/                # vertical slices (um módulo por feature)
│       ├── auth/           # login por CPF/CNPJ → JWT
│       ├── clients/        # CRUD de cliente + crédito/limite
│       ├── billing/        # cobrança (Strategy: pré-pago / pós-pago)
│       ├── conversations/  # listagem de conversas e histórico
│       ├── messages/       # envio de mensagem (cobrança + fila)
│       ├── queue/          # fila de prioridade em memória + worker
│       ├── realtime/       # gateway WebSocket (socket.io)
│       └── common/         # AuthGuard, decorators, filters
└── frontend/               # SPA React + Vite
    ├── nginx.conf          # serve a SPA em produção
    └── src/
        ├── lib/            # axios, socket, tipos, helpers
        ├── store/          # Zustand (auth)
        ├── hooks/          # React Query + socket
        ├── components/     # UI genérica
        └── features/       # telas por domínio (auth, chat)
```

---

## API

Base local: `http://localhost:3000`. Todos os endpoints, **exceto `POST /auth` e `POST /clients`**,
exigem o header `Authorization: Bearer <token>`. Documentação interativa em `/docs`.

| Método  | Rota                          | Descrição                                                  |
| ------- | ----------------------------- | ---------------------------------------------------------- |
| `POST`  | `/auth`                       | Login com `{ documentId, documentType }` → JWT + cliente   |
| `POST`  | `/clients`                    | Criar cliente (empresa)                                    |
| `PATCH` | `/clients/:id/credit`         | Adicionar crédito (pré-pago) ou aumentar limite (pós-pago) |
| `GET`   | `/conversations`              | Listar conversas do cliente autenticado                    |
| `GET`   | `/conversations/:id/messages` | Histórico de mensagens de uma conversa                     |
| `POST`  | `/messages`                   | Enviar mensagem (dispara cobrança + fila)                  |

Erros seguem o formato `{ statusCode, error, message }`. Falha de cobrança (saldo/limite) → **422**;
não autenticado → **401**.
