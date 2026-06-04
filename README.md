# Big Chat Brasil (BCB) — Fullstack

Plataforma de chat entre empresas e clientes finais, com fila de mensagens
priorizada, cobrança por mensagem (pré/pós-pago) e atualizações em tempo real.

## Stack
- **Backend:** NestJS + Prisma + PostgreSQL + WebSocket (socket.io)
- **Frontend:** React + Vite + React Query + Zustand
- **Orquestração:** Docker Compose

## Como rodar (Docker)
```bash
git clone <seu-repo>
cd bcb-fullstack
cp .env.example .env
docker compose up --build
```

| Serviço  | URL                          |
|----------|------------------------------|
| Frontend | http://localhost:8080        |
| Backend  | http://localhost:3000        |
| Swagger  | http://localhost:3000/docs   |
| Postgres | localhost:5432               |

## Desenvolvimento local (sem Docker)
```bash
# terminal 1 — banco
docker compose up db

# terminal 2 — backend
cd backend && npm install
npx prisma migrate dev        # cria/aplica migrations
npm run start:dev

# terminal 3 — frontend
cd frontend && npm install
npm run dev
```

## Premissas assumidas
- O "outro lado" da conversa (cliente final) é simulado: as mensagens percorrem
  o ciclo `queued → processing → sent → delivered → read` via worker + timers.
- _(complete com as suas decisões)_

## Funcionalidades implementadas
- [ ] Autenticação (CPF/CNPJ → token)
- [ ] Listagem de conversas / histórico
- [ ] Envio de mensagens
- [ ] Fila com prioridade (normal/urgente)
- [ ] Validação financeira (pré/pós-pago)
- [ ] Status de mensagem em tempo real (enviada/entregue/lida)
- [ ] Indicador de digitação / presença

## Trabalho futuro
- _(o que ficou de fora e por quê)_
