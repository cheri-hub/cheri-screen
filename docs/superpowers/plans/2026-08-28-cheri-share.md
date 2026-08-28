# cheri-share Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sala web privada onde um grupo de amigos compartilha e assiste tela ao vivo (com áudio), uma tela por vez, com pedido de takeover — hospedada em VPS própria, sem login.

**Architecture:** SFU LiveKit self-hosted recebe um stream e distribui para até 9 espectadores. Um token-service mínimo em Fastify é o único componente que conhece o segredo do LiveKit: assina os JWTs de entrada (com `canPublish: false`) e arbitra quem tem a vez de compartilhar, ligando a permissão de publicação via API. O estado da vez vive na metadata da sala do LiveKit, que é replicada automaticamente a todos os participantes — não há banco de dados.

**Tech Stack:** LiveKit Server (Docker) · Node 22 + Fastify 5 + TypeScript + `livekit-server-sdk` v2 · React 18 + Vite 5 + TypeScript + Tailwind 3 + `livekit-client` v2 · Vitest · Playwright · Docker Compose · nginx (já existente na VPS)

**Spec:** [`docs/superpowers/specs/2026-08-28-cheri-share-design.md`](../specs/2026-08-28-cheri-share-design.md)

## Global Constraints

- **Idioma da interface e das mensagens de erro:** português do Brasil, sem jargão técnico.
- **Nomes de domínio no código em português** (`vez`, `sharer`, `pedido`, `perfil`), seguindo o vocabulário da spec.
- **Imutabilidade:** nunca mutar objetos existentes; toda transformação retorna cópia nova.
- **Arquivos focados:** 200–400 linhas típicas, 800 máximo. Funções < 50 linhas.
- **Nenhum segredo em código.** `LIVEKIT_API_KEY` e `LIVEKIT_API_SECRET` só via ambiente.
- **Perfis de captura (seção 8.1 da spec):** `tela` = 1280×720 / 15fps / `contentHint: 'detail'` / ~500 kbps (padrão); `video` = 1280×720 / 30fps / `contentHint: 'motion'` / ~800 kbps. Opção de 1080p dobra resolução e bitrate.
- **Codec:** VP9 padrão, AV1 opcional, **simulcast desligado** em todas as publicações.
- **Room options obrigatórias:** `adaptiveStream: true`, `dynacast: true`.
- **Token de entrada sempre nasce com `canPublish: false`.** A permissão só é ligada pelo token-service para quem detém a vez.
- **`empty_timeout` da sala:** 300 segundos.
- **Espera por resposta de takeover:** 30 segundos; silêncio **cede** a vez.
- **Máximo de participantes por sala:** 10.
- **Portas:** 7880/TCP localhost (sinalização), 7881/TCP pública (contingência), 50000–50100/UDP pública (mídia), 6789/TCP localhost (métricas). TURN embutido **desabilitado**.
- **Alvo de navegador:** Chrome/Edge. Firefox e Safari devem funcionar para assistir e exibir aviso ao compartilhar.

---

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `docker-compose.yml` | Orquestra livekit + token-service + builder do front |
| `.env.example` | Contrato de configuração; `.env` real fica fora do git |
| `livekit/livekit.yaml` | Config do SFU: portas, faixa UDP, TURN off, métricas |
| `nginx/cheri-share.conf.example` | Bloco `server` de referência para o nginx da VPS |
| `token-service/src/config.ts` | Lê e valida ambiente; falha na subida se faltar segredo |
| `token-service/src/livekit.ts` | Instância única de `LiveKitAPI` |
| `token-service/src/serie.ts` | Serializa operações por sala (evita corrida de leitura-escrita) |
| `token-service/src/floor/types.ts` | Tipos do estado da vez |
| `token-service/src/floor/decide.ts` | **Função pura** com toda a regra de negócio da vez |
| `token-service/src/floor/aplicar.ts` | Traduz decisão em efeitos no LiveKit |
| `token-service/src/usage/acumular.ts` | **Função pura** do contador mensal |
| `token-service/src/usage/metricas.ts` | Lê e parseia o endpoint Prometheus |
| `token-service/src/usage/store.ts` | Persistência do contador em JSON |
| `token-service/src/usage/coletor.ts` | Coleta periódica e estado do consumo em memória |
| `token-service/src/routes/*.ts` | Um arquivo por grupo de rotas |
| `token-service/src/app.ts` | Fábrica do Fastify (testável sem subir porta) |
| `web/src/lib/identidade.ts` | UUID do navegador em `localStorage` |
| `web/src/lib/perfis.ts` | Perfis de captura e seleção de codec |
| `web/src/lib/api.ts` | Cliente HTTP do token-service |
| `web/src/hooks/useSala.ts` | Ciclo de vida da conexão LiveKit |
| `web/src/hooks/useVez.ts` | Estado da vez derivado da metadata |
| `web/src/pages/*.tsx` | Uma página por rota |
| `web/src/components/*.tsx` | Um componente por elemento de UI |

---

## Task 1: Fundação e prova de mídia

Esta é a tarefa de maior risco do projeto: se a VPS bloquear UDP ou o nginx não fizer o upgrade WebSocket, é aqui que se descobre. Nada mais é construído até vídeo atravessar a VPS.

**Files:**
- Create: `.gitignore`, `.env.example`, `docker-compose.yml`, `livekit/livekit.yaml`, `nginx/cheri-share.conf.example`, `README.md`

**Interfaces:**
- Consumes: nada (primeira tarefa)
- Produces: LiveKit acessível em `ws://127.0.0.1:7880` e métricas em `http://127.0.0.1:6789/metrics`; variáveis `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_URL`, `PUBLIC_HOST`

- [ ] **Step 1: Inicializar o repositório**

```bash
cd /caminho/para/cheri-share
git init
git checkout -b feat/fundacao
```

- [ ] **Step 2: Criar `.gitignore`**

```gitignore
node_modules/
dist/
.env
*.log
web/dist/
token-service/dist/
dados/
```

- [ ] **Step 3: Criar `.env.example`**

```bash
# Chaves do LiveKit. Gere com: docker run --rm livekit/livekit-server generate-keys
LIVEKIT_API_KEY=troque-me
LIVEKIT_API_SECRET=troque-me-por-um-segredo-longo

# URL interna do SFU, usada pelo token-service
LIVEKIT_URL=http://127.0.0.1:7880

# Host público (sem protocolo), usado pelo front para montar a URL do WebSocket
PUBLIC_HOST=share.seudominio.com.br

# Porta local do token-service
PORT=3000

# Consumo: nome da métrica Prometheus de bytes enviados (confirmado na Task 10)
USAGE_METRIC=livekit_node_bytes_out
USAGE_FILE=/dados/consumo.json
```

- [ ] **Step 4: Criar `livekit/livekit.yaml`**

Sem segredos: as chaves entram por `LIVEKIT_KEYS` no compose.

```yaml
port: 7880
rtc:
  tcp_port: 7881
  port_range_start: 50000
  port_range_end: 50100
  use_external_ip: true
turn:
  enabled: false
prometheus_port: 6789
room:
  empty_timeout: 300
  max_participants: 10
logging:
  level: info
```

- [ ] **Step 5: Criar `docker-compose.yml`**

`network_mode: host` evita mapear 100 portas UDP uma a uma e é a configuração recomendada para SFU em VPS Linux.

```yaml
services:
  livekit:
    image: livekit/livekit-server:v1.8
    restart: unless-stopped
    network_mode: host
    command: --config /etc/livekit.yaml
    volumes:
      - ./livekit/livekit.yaml:/etc/livekit.yaml:ro
    environment:
      LIVEKIT_KEYS: "${LIVEKIT_API_KEY}: ${LIVEKIT_API_SECRET}"
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://127.0.0.1:7880"]
      interval: 30s
      timeout: 5s
      retries: 3
```

- [ ] **Step 6: Criar `nginx/cheri-share.conf.example`**

O `proxy_read_timeout` alto é obrigatório: WebSocket cortado por timeout é a falha mais comum nesse setup.

```nginx
server {
    listen 443 ssl http2;
    server_name share.seudominio.com.br;

    # ssl_certificate / ssl_certificate_key: reaproveite os do seu Certbot

    root /caminho/para/cheri-share/web/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3000/;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location /rtc {
        proxy_pass http://127.0.0.1:7880;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }
}
```

- [ ] **Step 7: Gerar chaves e subir o SFU**

```bash
docker run --rm livekit/livekit-server generate-keys
```

Copie o par para o `.env` (criado a partir do `.env.example`), depois:

```bash
docker compose up -d livekit
docker compose logs livekit
```

Esperado: log `starting LiveKit server` sem erro de configuração.

- [ ] **Step 8: Abrir o firewall**

```bash
sudo ufw allow 7881/tcp && sudo ufw allow 50000:50100/udp && sudo ufw reload
```

- [ ] **Step 9: Provar que mídia atravessa a VPS**

Instale o CLI e gere um token de teste:

```bash
docker run --rm -e LIVEKIT_URL=ws://SEU_HOST:7880 livekit/livekit-cli token create --api-key CHAVE --api-secret SEGREDO --join --room teste --identity eu --valid-for 1h
```

Abra `https://meet.livekit.io/?tab=custom` em **duas máquinas em redes diferentes**, cole a URL `wss://share.seudominio.com.br/rtc` e os tokens, e confirme que o vídeo de uma aparece na outra.

Esperado: vídeo fluindo. Se falhar, o problema é firewall ou nginx — resolva **antes** de seguir. Este é o portão da fase 1.

- [ ] **Step 10: Commit**

```bash
git add .gitignore .env.example docker-compose.yml livekit/ nginx/ README.md
git commit -m "feat: fundação com LiveKit self-hosted e prova de mídia"
```

---

## Task 2: Esqueleto do token-service

**Files:**
- Create: `token-service/package.json`, `token-service/tsconfig.json`, `token-service/vitest.config.ts`, `token-service/Dockerfile`, `token-service/src/config.ts`, `token-service/src/livekit.ts`, `token-service/src/app.ts`, `token-service/src/server.ts`
- Test: `token-service/src/config.test.ts`

**Interfaces:**
- Consumes: variáveis de ambiente da Task 1
- Produces: `criarApp(): FastifyInstance`, `config: Config`, `api: LiveKitAPI`

- [ ] **Step 1: Inicializar o pacote**

```bash
mkdir -p token-service/src && cd token-service
npm init -y
npm i fastify livekit-server-sdk
npm i -D typescript tsx vitest @types/node
```

- [ ] **Step 2: Escrever o teste que falha**

`token-service/src/config.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { lerConfig } from './config.js';

describe('lerConfig', () => {
  it('falha quando o segredo do LiveKit está ausente', () => {
    expect(() => lerConfig({ LIVEKIT_API_KEY: 'k' })).toThrow(
      /LIVEKIT_API_SECRET/,
    );
  });

  it('aplica os padrões de porta e URL do SFU', () => {
    const c = lerConfig({
      LIVEKIT_API_KEY: 'k',
      LIVEKIT_API_SECRET: 's',
      PUBLIC_HOST: 'share.exemplo.com',
    });
    expect(c.porta).toBe(3000);
    expect(c.livekitUrl).toBe('http://127.0.0.1:7880');
    expect(c.publicHost).toBe('share.exemplo.com');
  });
});
```

- [ ] **Step 3: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/config.test.ts`
Expected: FAIL — `Cannot find module './config.js'`

- [ ] **Step 4: Implementar `src/config.ts`**

```ts
export type Config = {
  apiKey: string;
  apiSecret: string;
  livekitUrl: string;
  publicHost: string;
  porta: number;
  metricaConsumo: string;
  arquivoConsumo: string;
};

function obrigatorio(env: NodeJS.ProcessEnv, chave: string): string {
  const valor = env[chave];
  if (!valor) throw new Error(`Variável de ambiente ausente: ${chave}`);
  return valor;
}

export function lerConfig(env: NodeJS.ProcessEnv): Config {
  return {
    apiKey: obrigatorio(env, 'LIVEKIT_API_KEY'),
    apiSecret: obrigatorio(env, 'LIVEKIT_API_SECRET'),
    livekitUrl: env.LIVEKIT_URL ?? 'http://127.0.0.1:7880',
    publicHost: obrigatorio(env, 'PUBLIC_HOST'),
    porta: Number(env.PORT ?? 3000),
    metricaConsumo: env.USAGE_METRIC ?? 'livekit_node_bytes_out',
    arquivoConsumo: env.USAGE_FILE ?? '/dados/consumo.json',
  };
}

export const config = lerConfig(process.env);
```

- [ ] **Step 5: Rodar o teste e confirmar que passa**

Run: `npx vitest run src/config.test.ts`
Expected: PASS (2 testes)

- [ ] **Step 6: Criar `src/livekit.ts`, `src/app.ts` e `src/server.ts`**

```ts
// src/livekit.ts
import { LiveKitAPI } from 'livekit-server-sdk';
import { config } from './config.js';

export const api = new LiveKitAPI({
  host: config.livekitUrl,
  apiKey: config.apiKey,
  secret: config.apiSecret,
});
```

```ts
// src/app.ts
import Fastify, { type FastifyInstance } from 'fastify';

export function criarApp(): FastifyInstance {
  const app = Fastify({ logger: true });
  app.get('/health', async () => ({ ok: true }));
  return app;
}
```

```ts
// src/server.ts
import { config } from './config.js';
import { criarApp } from './app.js';

const app = criarApp();
app
  .listen({ port: config.porta, host: '127.0.0.1' })
  .catch((erro) => {
    app.log.error(erro);
    process.exit(1);
  });
```

- [ ] **Step 7: Configurar TypeScript, scripts e Vitest**

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "outDir": "dist",
    "rootDir": "src",
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

Adicione ao `package.json`: `"type": "module"` e os scripts `"dev": "tsx watch src/server.ts"`, `"build": "tsc"`, `"start": "node dist/server.js"`, `"test": "vitest run"`.

- [ ] **Step 8: Criar `token-service/Dockerfile`**

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build
CMD ["node", "dist/server.js"]
```

- [ ] **Step 9: Verificar que a suíte roda e o servidor sobe**

Run: `npm test` — Expected: PASS
Run: `LIVEKIT_API_KEY=k LIVEKIT_API_SECRET=s npm run dev` e em outro terminal `curl localhost:3000/health` — Expected: `{"ok":true}`

- [ ] **Step 10: Commit**

```bash
git add token-service/
git commit -m "feat: esqueleto do token-service com config validada"
```

---

## Task 3: Criar sala e emitir token

**Files:**
- Create: `token-service/src/routes/salas.ts`, `token-service/src/routes/salas.test.ts`
- Modify: `token-service/src/app.ts`
- Modify: `docker-compose.yml`

**Interfaces:**
- Consumes: `api` (Task 2), `config` (Task 2)
- Produces: `POST /rooms → { id: string }`; `POST /rooms/:id/token → { token: string, wsUrl: string }`; 404 com `{ erro: 'sala-inexistente' }`

- [ ] **Step 1: Escrever os testes que falham**

`token-service/src/routes/salas.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockRoom = {
  createRoom: vi.fn(),
  listRooms: vi.fn(),
};
vi.mock('../livekit.js', () => ({ api: { room: mockRoom } }));

const { criarApp } = await import('../app.js');

describe('rotas de sala', () => {
  beforeEach(() => {
    mockRoom.createRoom.mockReset();
    mockRoom.listRooms.mockReset();
  });

  it('cria a sala com empty_timeout de 300s e devolve o id', async () => {
    mockRoom.createRoom.mockResolvedValue({});
    const app = criarApp();

    const r = await app.inject({ method: 'POST', url: '/rooms' });

    expect(r.statusCode).toBe(200);
    const { id } = r.json();
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(mockRoom.createRoom).toHaveBeenCalledWith(
      expect.objectContaining({ name: id, emptyTimeout: 300, maxParticipants: 10 }),
    );
  });

  it('responde 404 quando a sala não existe', async () => {
    mockRoom.listRooms.mockResolvedValue([]);
    const app = criarApp();

    const r = await app.inject({
      method: 'POST',
      url: '/rooms/00000000-0000-4000-8000-000000000000/token',
      payload: { identity: 'i1', apelido: 'Ana' },
    });

    expect(r.statusCode).toBe(404);
    expect(r.json()).toEqual({ erro: 'sala-inexistente' });
  });

  it('emite token sem permissão de publicar', async () => {
    const sala = '00000000-0000-4000-8000-000000000000';
    mockRoom.listRooms.mockResolvedValue([{ name: sala }]);
    const app = criarApp();

    const r = await app.inject({
      method: 'POST',
      url: `/rooms/${sala}/token`,
      payload: { identity: 'i1', apelido: 'Ana' },
    });

    expect(r.statusCode).toBe(200);
    const { token } = r.json();
    const grant = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64').toString(),
    );
    expect(grant.video.canPublish).toBe(false);
    expect(grant.video.canSubscribe).toBe(true);
    expect(grant.video.room).toBe(sala);
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npx vitest run src/routes/salas.test.ts`
Expected: FAIL — as rotas não existem (404 do Fastify em `/rooms`)

- [ ] **Step 3: Implementar `src/routes/salas.ts`**

```ts
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { AccessToken } from 'livekit-server-sdk';
import { api } from '../livekit.js';
import { config } from '../config.js';

const EMPTY_TIMEOUT = 300;
const MAX_PARTICIPANTES = 10;

export async function salaExiste(id: string): Promise<boolean> {
  const salas = await api.room.listRooms([id]);
  return salas.length > 0;
}

export function registrarRotasDeSala(app: FastifyInstance): void {
  app.post('/rooms', async () => {
    const id = randomUUID();
    await api.room.createRoom({
      name: id,
      emptyTimeout: EMPTY_TIMEOUT,
      maxParticipants: MAX_PARTICIPANTES,
    });
    return { id };
  });

  app.post<{
    Params: { id: string };
    Body: { identity: string; apelido: string };
  }>('/rooms/:id/token', async (req, reply) => {
    const { id } = req.params;
    const { identity, apelido } = req.body ?? {};

    if (!identity || !apelido) {
      return reply.code(400).send({ erro: 'dados-incompletos' });
    }
    if (!(await salaExiste(id))) {
      return reply.code(404).send({ erro: 'sala-inexistente' });
    }

    const at = new AccessToken(config.apiKey, config.apiSecret, {
      identity,
      name: apelido,
      ttl: '4h',
    });
    at.addGrant({
      roomJoin: true,
      room: id,
      canSubscribe: true,
      canPublish: false,
      canPublishData: true,
    });

    return { token: await at.toJwt(), wsUrl: `wss://${config.publicHost}/rtc` };
  });
}
```

- [ ] **Step 4: Registrar as rotas em `src/app.ts`**

```ts
import Fastify, { type FastifyInstance } from 'fastify';
import { registrarRotasDeSala } from './routes/salas.js';

export function criarApp(): FastifyInstance {
  const app = Fastify({ logger: true });
  app.get('/health', async () => ({ ok: true }));
  registrarRotasDeSala(app);
  return app;
}
```

- [ ] **Step 5: Rodar os testes e confirmar que passam**

Run: `npx vitest run`
Expected: PASS (5 testes)

- [ ] **Step 6: Adicionar o token-service ao compose**

Acrescente ao `docker-compose.yml`:

```yaml
  token-service:
    build: ./token-service
    restart: unless-stopped
    network_mode: host
    env_file: .env
    volumes:
      - dados:/dados
    depends_on:
      - livekit

volumes:
  dados:
```

- [ ] **Step 7: Commit**

```bash
git add token-service/ docker-compose.yml
git commit -m "feat: criação de sala e emissão de token sem permissão de publicar"
```

---

## Task 4: Esqueleto do front e página inicial

**Files:**
- Create: `web/` (scaffold Vite), `web/src/lib/identidade.ts`, `web/src/lib/api.ts`, `web/src/pages/Home.tsx`, `web/src/App.tsx`, `web/src/main.tsx`
- Test: `web/src/lib/identidade.test.ts`

**Interfaces:**
- Consumes: `POST /rooms` (Task 3)
- Produces: `obterIdentidade(): string`, `obterApelido()/salvarApelido()`, `criarSala(): Promise<string>`, `pedirToken(salaId, identity, apelido)`

- [ ] **Step 1: Criar o projeto**

```bash
npm create vite@latest web -- --template react-ts
cd web && npm i react-router-dom livekit-client
npm i -D tailwindcss postcss autoprefixer vitest jsdom @testing-library/react
npx tailwindcss init -p
```

Configure `tailwind.config.js` com `content: ['./index.html', './src/**/*.{ts,tsx}']` e importe as diretivas do Tailwind em `src/index.css`.

- [ ] **Step 2: Escrever o teste que falha**

`web/src/lib/identidade.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { obterIdentidade } from './identidade';

describe('obterIdentidade', () => {
  beforeEach(() => localStorage.clear());

  it('gera um UUID na primeira chamada e o reaproveita depois', () => {
    const primeira = obterIdentidade();
    expect(primeira).toMatch(/^[0-9a-f-]{36}$/);
    expect(obterIdentidade()).toBe(primeira);
  });
});
```

Configure `vitest.config.ts` com `environment: 'jsdom'`.

- [ ] **Step 3: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/lib/identidade.test.ts`
Expected: FAIL — módulo inexistente

- [ ] **Step 4: Implementar `src/lib/identidade.ts`**

```ts
const CHAVE_ID = 'cheri-share:identidade';
const CHAVE_APELIDO = 'cheri-share:apelido';

export function obterIdentidade(): string {
  const existente = localStorage.getItem(CHAVE_ID);
  if (existente) return existente;
  const nova = crypto.randomUUID();
  localStorage.setItem(CHAVE_ID, nova);
  return nova;
}

export function obterApelido(): string | null {
  return localStorage.getItem(CHAVE_APELIDO);
}

export function salvarApelido(apelido: string): void {
  localStorage.setItem(CHAVE_APELIDO, apelido);
}
```

- [ ] **Step 5: Rodar o teste e confirmar que passa**

Run: `npx vitest run src/lib/identidade.test.ts`
Expected: PASS

- [ ] **Step 6: Implementar `src/lib/api.ts`**

```ts
export type TokenResposta = { token: string; wsUrl: string };

async function post<T>(caminho: string, corpo?: unknown): Promise<T> {
  const r = await fetch(`/api${caminho}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  if (!r.ok) throw Object.assign(new Error('falha'), { status: r.status });
  return r.json() as Promise<T>;
}

export const criarSala = () => post<{ id: string }>('/rooms').then((r) => r.id);

export const pedirToken = (sala: string, identity: string, apelido: string) =>
  post<TokenResposta>(`/rooms/${sala}/token`, { identity, apelido });
```

- [ ] **Step 7: Implementar `src/pages/Home.tsx` e as rotas**

```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { criarSala } from '../lib/api';

export function Home() {
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const navegar = useNavigate();

  async function aoCriar() {
    setCriando(true);
    setErro(null);
    try {
      navegar(`/sala/${await criarSala()}`);
    } catch {
      setErro('Não foi possível criar a sala. Tente de novo em instantes.');
      setCriando(false);
    }
  }

  return (
    <main className="min-h-screen grid place-items-center bg-neutral-950 text-neutral-100 p-6">
      <div className="w-full max-w-sm space-y-6 text-center">
        <h1 className="text-3xl font-semibold">cheri share</h1>
        <p className="text-neutral-400">
          Crie uma sala e mande o link pra galera assistir sua tela.
        </p>
        <button
          onClick={aoCriar}
          disabled={criando}
          className="w-full rounded-lg bg-emerald-500 py-3 font-medium text-neutral-950 disabled:opacity-50"
        >
          {criando ? 'Criando…' : 'Criar sala'}
        </button>
        {erro && <p className="text-red-400 text-sm">{erro}</p>}
      </div>
    </main>
  );
}
```

Em `App.tsx`, monte `BrowserRouter` com `/` → `Home` e `/sala/:id` → placeholder temporário.

- [ ] **Step 8: Verificar no navegador**

Run: `npm run dev`
Expected: a home carrega; clicar em "Criar sala" (com o token-service rodando e proxy `/api` configurado no `vite.config.ts`) redireciona para `/sala/<uuid>`.

- [ ] **Step 9: Commit**

```bash
git add web/
git commit -m "feat: front com identidade por navegador e criação de sala"
```

---

## Task 5: Entrar na sala

**Files:**
- Create: `web/src/hooks/useSala.ts`, `web/src/pages/Sala.tsx`, `web/src/pages/SalaExpirada.tsx`, `web/src/components/ModalApelido.tsx`, `web/src/components/Participantes.tsx`
- Modify: `web/src/App.tsx`

**Interfaces:**
- Consumes: `pedirToken` (Task 4), `obterIdentidade`/`obterApelido`/`salvarApelido` (Task 4)
- Produces: `useSala(salaId, apelido) → { room, estado, participantes, erro }` onde `estado: 'conectando' | 'conectado' | 'expirada' | 'erro'`

- [ ] **Step 1: Implementar `src/hooks/useSala.ts`**

`adaptiveStream` e `dynacast` entram aqui porque são decisões de consumo de banda, não de polimento (spec §2).

```ts
import { useEffect, useState } from 'react';
import { Room, RoomEvent, type RemoteParticipant } from 'livekit-client';
import { pedirToken } from '../lib/api';
import { obterIdentidade } from '../lib/identidade';

export type EstadoConexao = 'conectando' | 'conectado' | 'expirada' | 'erro';

export function useSala(salaId: string, apelido: string | null) {
  const [room, setRoom] = useState<Room | null>(null);
  const [estado, setEstado] = useState<EstadoConexao>('conectando');
  const [participantes, setParticipantes] = useState<string[]>([]);

  useEffect(() => {
    if (!apelido) return;
    let cancelado = false;
    const sala = new Room({
      adaptiveStream: true,
      dynacast: true,
    });

    function atualizarParticipantes() {
      const remotos = [...sala.remoteParticipants.values()] as RemoteParticipant[];
      setParticipantes([
        sala.localParticipant.name ?? 'você',
        ...remotos.map((p) => p.name ?? p.identity),
      ]);
    }

    sala
      .on(RoomEvent.ParticipantConnected, atualizarParticipantes)
      .on(RoomEvent.ParticipantDisconnected, atualizarParticipantes)
      .on(RoomEvent.Connected, atualizarParticipantes);

    (async () => {
      try {
        const { token, wsUrl } = await pedirToken(salaId, obterIdentidade(), apelido);
        await sala.connect(wsUrl, token);
        if (cancelado) return;
        setRoom(sala);
        setEstado('conectado');
      } catch (e) {
        if (cancelado) return;
        setEstado((e as { status?: number }).status === 404 ? 'expirada' : 'erro');
      }
    })();

    return () => {
      cancelado = true;
      sala.disconnect();
    };
  }, [salaId, apelido]);

  return { room, estado, participantes };
}
```

- [ ] **Step 2: Implementar `ModalApelido.tsx`**

```tsx
import { useState } from 'react';

export function ModalApelido({ aoConfirmar }: { aoConfirmar: (a: string) => void }) {
  const [valor, setValor] = useState('');
  return (
    <div className="fixed inset-0 grid place-items-center bg-neutral-950/90 p-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (valor.trim()) aoConfirmar(valor.trim());
        }}
        className="w-full max-w-sm space-y-4 rounded-xl bg-neutral-900 p-6"
      >
        <h2 className="text-lg font-medium text-neutral-100">Como te chamamos?</h2>
        <input
          autoFocus
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          maxLength={24}
          placeholder="Seu apelido"
          className="w-full rounded-lg bg-neutral-800 px-3 py-2 text-neutral-100"
        />
        <button className="w-full rounded-lg bg-emerald-500 py-2 font-medium text-neutral-950">
          Entrar
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Implementar `Sala.tsx` e `SalaExpirada.tsx`**

```tsx
// src/pages/Sala.tsx
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useSala } from '../hooks/useSala';
import { obterApelido, salvarApelido } from '../lib/identidade';
import { ModalApelido } from '../components/ModalApelido';
import { Participantes } from '../components/Participantes';
import { SalaExpirada } from './SalaExpirada';

export function Sala() {
  const { id = '' } = useParams();
  const [apelido, setApelido] = useState(obterApelido);
  const { estado, participantes } = useSala(id, apelido);

  if (!apelido) {
    return (
      <ModalApelido
        aoConfirmar={(a) => {
          salvarApelido(a);
          setApelido(a);
        }}
      />
    );
  }

  if (estado === 'expirada') return <SalaExpirada />;

  return (
    <main className="min-h-screen bg-neutral-950 p-6 text-neutral-100">
      {estado === 'conectando' && <p className="text-neutral-400">Conectando…</p>}
      {estado === 'erro' && (
        <p className="text-red-400">
          Serviço indisponível. Tenta de novo em instantes.
        </p>
      )}
      {estado === 'conectado' && (
        <div className="mx-auto max-w-5xl space-y-4">
          <button
            onClick={() => navigator.clipboard.writeText(window.location.href)}
            className="rounded-lg bg-neutral-800 px-3 py-2 text-sm"
          >
            Copiar link da sala
          </button>
          <Participantes nomes={participantes} />
        </div>
      )}
    </main>
  );
}
```

```tsx
// src/pages/SalaExpirada.tsx
import { Link } from 'react-router-dom';

export function SalaExpirada() {
  return (
    <main className="grid min-h-screen place-items-center bg-neutral-950 p-6 text-center text-neutral-100">
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Essa sala não existe mais</h1>
        <p className="text-neutral-400">
          As salas somem sozinhas alguns minutos depois que todo mundo sai.
        </p>
        <Link to="/" className="inline-block rounded-lg bg-emerald-500 px-4 py-2 font-medium text-neutral-950">
          Criar uma nova
        </Link>
      </div>
    </main>
  );
}
```

`Participantes.tsx` é uma lista simples: `<ul>` com um `<li>` por nome recebido em `nomes: string[]`.

- [ ] **Step 4: Verificar entrada em duas abas**

Run: `npm run dev`
Expected: criar sala numa aba, colar o link em outra (aba anônima, para forçar identidade diferente), informar apelido, e as duas verem os dois nomes na lista.

- [ ] **Step 5: Verificar a sala expirada**

Acesse `/sala/00000000-0000-4000-8000-000000000000`.
Expected: tela "Essa sala não existe mais".

- [ ] **Step 6: Commit**

```bash
git add web/
git commit -m "feat: entrada na sala com apelido e lista de participantes"
```

---

## Task 6: A regra da vez (função pura)

O coração do sistema. Fica isolado de rede, relógio e LiveKit para ser testável de verdade — todas as decisões, inclusive as da Task 9, são implementadas e testadas aqui de uma vez, para que a máquina de estados não nasça inconsistente.

**Files:**
- Create: `token-service/src/floor/types.ts`, `token-service/src/floor/decide.ts`
- Test: `token-service/src/floor/decide.test.ts`

**Interfaces:**
- Consumes: nada (função pura)
- Produces: `decide(estado: EstadoDaVez, presentes: readonly string[], agora: number, evento: Evento): Resultado`; tipos `EstadoDaVez`, `Evento`, `Decisao`; constante `ESPERA_MS = 30_000`; `ESTADO_VAZIO`

- [ ] **Step 1: Definir os tipos em `src/floor/types.ts`**

```ts
export const ESPERA_MS = 30_000;

export type Vez = { identity: string; nome: string; desde: number };
export type Pedido = { identity: string; nome: string; expiraEm: number };

export type EstadoDaVez = { sharer: Vez | null; pending: Pedido | null };

export const ESTADO_VAZIO: EstadoDaVez = { sharer: null, pending: null };

export type Evento =
  | { tipo: 'pedir'; identity: string; nome: string }
  | { tipo: 'responder'; identity: string; aceita: boolean }
  | { tipo: 'liberar'; identity: string };

export type Decisao =
  | { resultado: 'concedido'; para: string; revogarDe: string | null }
  | { resultado: 'aguardando'; dono: string }
  | { resultado: 'ocupado' }
  | { resultado: 'recusado' }
  | { resultado: 'liberado'; revogarDe: string }
  | { resultado: 'ignorado'; motivo: string };

export type Resultado = { estado: EstadoDaVez; decisao: Decisao };
```

- [ ] **Step 2: Escrever os testes que falham**

`token-service/src/floor/decide.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { decide } from './decide.js';
import { ESPERA_MS, ESTADO_VAZIO, type EstadoDaVez } from './types.js';

const AGORA = 1_000_000;
const ana: EstadoDaVez = {
  sharer: { identity: 'ana', nome: 'Ana', desde: 0 },
  pending: null,
};
const pedir = { tipo: 'pedir', identity: 'pedro', nome: 'Pedro' } as const;

describe('decide — pedir', () => {
  it('concede na hora quando a sala está livre', () => {
    const r = decide(ESTADO_VAZIO, ['pedro'], AGORA, pedir);
    expect(r.decisao).toEqual({ resultado: 'concedido', para: 'pedro', revogarDe: null });
    expect(r.estado.sharer?.identity).toBe('pedro');
  });

  it('concede quando quem tinha a vez não está mais na sala', () => {
    const r = decide(ana, ['pedro'], AGORA, pedir);
    expect(r.decisao).toEqual({ resultado: 'concedido', para: 'pedro', revogarDe: null });
  });

  it('abre pedido quando a sala está ocupada', () => {
    const r = decide(ana, ['ana', 'pedro'], AGORA, pedir);
    expect(r.decisao).toEqual({ resultado: 'aguardando', dono: 'ana' });
    expect(r.estado.pending).toEqual({
      identity: 'pedro', nome: 'Pedro', expiraEm: AGORA + ESPERA_MS,
    });
    expect(r.estado.sharer?.identity).toBe('ana');
  });

  it('recusa um segundo pedido enquanto outro está ativo', () => {
    const comPedido: EstadoDaVez = {
      ...ana,
      pending: { identity: 'joao', nome: 'João', expiraEm: AGORA + 1 },
    };
    const r = decide(comPedido, ['ana', 'joao', 'pedro'], AGORA, pedir);
    expect(r.decisao).toEqual({ resultado: 'ocupado' });
    expect(r.estado).toEqual(comPedido);
  });

  it('cede a vez quando o próprio pedido expirou sem resposta', () => {
    const expirado: EstadoDaVez = {
      ...ana,
      pending: { identity: 'pedro', nome: 'Pedro', expiraEm: AGORA - 1 },
    };
    const r = decide(expirado, ['ana', 'pedro'], AGORA, pedir);
    expect(r.decisao).toEqual({ resultado: 'concedido', para: 'pedro', revogarDe: 'ana' });
    expect(r.estado.pending).toBeNull();
  });

  it('ignora pedido de quem já detém a vez', () => {
    const r = decide(ana, ['ana'], AGORA, {
      tipo: 'pedir', identity: 'ana', nome: 'Ana',
    });
    expect(r.decisao.resultado).toBe('ignorado');
  });
});

describe('decide — responder', () => {
  const comPedido: EstadoDaVez = {
    ...ana,
    pending: { identity: 'pedro', nome: 'Pedro', expiraEm: AGORA + ESPERA_MS },
  };

  it('transfere a vez quando aceito', () => {
    const r = decide(comPedido, ['ana', 'pedro'], AGORA, {
      tipo: 'responder', identity: 'ana', aceita: true,
    });
    expect(r.decisao).toEqual({ resultado: 'concedido', para: 'pedro', revogarDe: 'ana' });
    expect(r.estado.sharer?.identity).toBe('pedro');
    expect(r.estado.pending).toBeNull();
  });

  it('mantém a vez quando recusado', () => {
    const r = decide(comPedido, ['ana', 'pedro'], AGORA, {
      tipo: 'responder', identity: 'ana', aceita: false,
    });
    expect(r.decisao).toEqual({ resultado: 'recusado' });
    expect(r.estado.sharer?.identity).toBe('ana');
    expect(r.estado.pending).toBeNull();
  });

  it('ignora resposta de quem não detém a vez', () => {
    const r = decide(comPedido, ['ana', 'pedro'], AGORA, {
      tipo: 'responder', identity: 'pedro', aceita: true,
    });
    expect(r.decisao).toEqual({ resultado: 'ignorado', motivo: 'nao-e-o-dono' });
  });
});

describe('decide — liberar', () => {
  it('libera a vez de quem a detém', () => {
    const r = decide(ana, ['ana'], AGORA, { tipo: 'liberar', identity: 'ana' });
    expect(r.decisao).toEqual({ resultado: 'liberado', revogarDe: 'ana' });
    expect(r.estado.sharer).toBeNull();
  });

  it('ignora liberação de quem não detém a vez', () => {
    const r = decide(ana, ['ana', 'pedro'], AGORA, { tipo: 'liberar', identity: 'pedro' });
    expect(r.decisao).toEqual({ resultado: 'ignorado', motivo: 'nao-e-o-dono' });
  });
});
```

- [ ] **Step 3: Rodar os testes e confirmar que falham**

Run: `npx vitest run src/floor/decide.test.ts`
Expected: FAIL — `decide` não existe

- [ ] **Step 4: Implementar `src/floor/decide.ts`**

```ts
import {
  ESPERA_MS,
  type Decisao,
  type EstadoDaVez,
  type Evento,
  type Resultado,
} from './types.js';

/** Descarta dono e pedido de quem não está mais na sala. */
function normalizar(estado: EstadoDaVez, presentes: readonly string[]): EstadoDaVez {
  return {
    sharer:
      estado.sharer && presentes.includes(estado.sharer.identity)
        ? estado.sharer
        : null,
    pending:
      estado.pending && presentes.includes(estado.pending.identity)
        ? estado.pending
        : null,
  };
}

function conceder(
  estado: EstadoDaVez,
  identity: string,
  nome: string,
  agora: number,
): Resultado {
  const revogarDe = estado.sharer?.identity ?? null;
  return {
    estado: { sharer: { identity, nome, desde: agora }, pending: null },
    decisao: { resultado: 'concedido', para: identity, revogarDe },
  };
}

function ignorar(estado: EstadoDaVez, motivo: string): Resultado {
  return { estado, decisao: { resultado: 'ignorado', motivo } as Decisao };
}

function pedir(
  estado: EstadoDaVez,
  agora: number,
  ev: Extract<Evento, { tipo: 'pedir' }>,
): Resultado {
  if (!estado.sharer) return conceder(estado, ev.identity, ev.nome, agora);
  if (estado.sharer.identity === ev.identity) return ignorar(estado, 'ja-e-o-dono');

  const pend = estado.pending;

  if (pend?.identity === ev.identity) {
    // Silêncio cede a vez: o pedido do próprio solicitante venceu sem resposta.
    return pend.expiraEm <= agora
      ? conceder(estado, ev.identity, ev.nome, agora)
      : { estado, decisao: { resultado: 'aguardando', dono: estado.sharer.identity } };
  }

  if (pend && pend.expiraEm > agora) {
    return { estado, decisao: { resultado: 'ocupado' } };
  }

  return {
    estado: {
      ...estado,
      pending: { identity: ev.identity, nome: ev.nome, expiraEm: agora + ESPERA_MS },
    },
    decisao: { resultado: 'aguardando', dono: estado.sharer.identity },
  };
}

function responder(
  estado: EstadoDaVez,
  agora: number,
  ev: Extract<Evento, { tipo: 'responder' }>,
): Resultado {
  if (estado.sharer?.identity !== ev.identity) return ignorar(estado, 'nao-e-o-dono');
  if (!estado.pending) return ignorar(estado, 'sem-pedido');
  if (estado.pending.expiraEm <= agora) {
    return {
      estado: { ...estado, pending: null },
      decisao: { resultado: 'ignorado', motivo: 'pedido-expirado' },
    };
  }
  if (!ev.aceita) {
    return { estado: { ...estado, pending: null }, decisao: { resultado: 'recusado' } };
  }
  return conceder(estado, estado.pending.identity, estado.pending.nome, agora);
}

function liberar(
  estado: EstadoDaVez,
  ev: Extract<Evento, { tipo: 'liberar' }>,
): Resultado {
  if (estado.sharer?.identity !== ev.identity) return ignorar(estado, 'nao-e-o-dono');
  return {
    estado: { sharer: null, pending: null },
    decisao: { resultado: 'liberado', revogarDe: ev.identity },
  };
}

export function decide(
  estado: EstadoDaVez,
  presentes: readonly string[],
  agora: number,
  evento: Evento,
): Resultado {
  const base = normalizar(estado, presentes);
  switch (evento.tipo) {
    case 'pedir':
      return pedir(base, agora, evento);
    case 'responder':
      return responder(base, agora, evento);
    case 'liberar':
      return liberar(base, evento);
  }
}
```

- [ ] **Step 5: Rodar os testes e confirmar que passam**

Run: `npx vitest run src/floor/decide.test.ts`
Expected: PASS (11 testes)

- [ ] **Step 6: Commit**

```bash
git add token-service/src/floor/
git commit -m "feat: regra da vez como função pura testada"
```

---

## Task 7: Rotas da vez e aplicação no LiveKit

**Files:**
- Create: `token-service/src/serie.ts`, `token-service/src/floor/aplicar.ts`, `token-service/src/routes/vez.ts`
- Test: `token-service/src/floor/aplicar.test.ts`
- Modify: `token-service/src/app.ts`

**Interfaces:**
- Consumes: `decide` (Task 6), `api` (Task 2), `salaExiste` (Task 3)
- Produces: `POST /rooms/:id/floor/request`, `/answer`, `/release` → `{ decisao: Decisao }` ou 404; `emSerie(chave, fn)`

- [ ] **Step 1: Implementar `src/serie.ts`**

O token-service roda em instância única (spec §3); esta fila em memória impede que dois pedidos simultâneos leiam a mesma metadata antes de qualquer um escrever.

```ts
const filas = new Map<string, Promise<unknown>>();

/** Executa `fn` em série por chave, mesmo que a anterior tenha falhado. */
export function emSerie<T>(chave: string, fn: () => Promise<T>): Promise<T> {
  const anterior = filas.get(chave) ?? Promise.resolve();
  const proximo = anterior.then(fn, fn);
  filas.set(
    chave,
    proximo.catch(() => undefined),
  );
  return proximo;
}
```

- [ ] **Step 2: Escrever o teste que falha**

`token-service/src/floor/aplicar.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockRoom = {
  listRooms: vi.fn(),
  listParticipants: vi.fn(),
  updateParticipant: vi.fn(),
  updateRoomMetadata: vi.fn(),
};
vi.mock('../livekit.js', () => ({ api: { room: mockRoom } }));

const { aplicar } = await import('./aplicar.js');

const SALA = 'sala-1';

describe('aplicar', () => {
  beforeEach(() => {
    Object.values(mockRoom).forEach((m) => m.mockReset());
    mockRoom.updateParticipant.mockResolvedValue({});
    mockRoom.updateRoomMetadata.mockResolvedValue({});
  });

  it('devolve null quando a sala não existe', async () => {
    mockRoom.listRooms.mockResolvedValue([]);
    const r = await aplicar(SALA, { tipo: 'pedir', identity: 'ana', nome: 'Ana' });
    expect(r).toBeNull();
  });

  it('liga canPublish para quem recebe a vez e grava a metadata', async () => {
    mockRoom.listRooms.mockResolvedValue([{ name: SALA, metadata: '' }]);
    mockRoom.listParticipants.mockResolvedValue([{ identity: 'ana' }]);

    const decisao = await aplicar(SALA, {
      tipo: 'pedir', identity: 'ana', nome: 'Ana',
    });

    expect(decisao).toEqual({ resultado: 'concedido', para: 'ana', revogarDe: null });
    expect(mockRoom.updateParticipant).toHaveBeenCalledWith(
      SALA,
      'ana',
      { permission: { canSubscribe: true, canPublish: true, canPublishData: true } },
    );
    const [, metadata] = mockRoom.updateRoomMetadata.mock.calls[0];
    expect(JSON.parse(metadata).sharer.identity).toBe('ana');
  });

  it('revoga canPublish de quem perdeu a vez', async () => {
    const estado = {
      sharer: { identity: 'ana', nome: 'Ana', desde: 0 },
      pending: { identity: 'pedro', nome: 'Pedro', expiraEm: Date.now() + 10_000 },
    };
    mockRoom.listRooms.mockResolvedValue([
      { name: SALA, metadata: JSON.stringify(estado) },
    ]);
    mockRoom.listParticipants.mockResolvedValue([
      { identity: 'ana' }, { identity: 'pedro' },
    ]);

    await aplicar(SALA, { tipo: 'responder', identity: 'ana', aceita: true });

    expect(mockRoom.updateParticipant).toHaveBeenCalledWith(
      SALA,
      'ana',
      { permission: { canSubscribe: true, canPublish: false, canPublishData: true } },
    );
  });

  it('trata metadata corrompida como estado vazio', async () => {
    mockRoom.listRooms.mockResolvedValue([{ name: SALA, metadata: 'não é json' }]);
    mockRoom.listParticipants.mockResolvedValue([{ identity: 'ana' }]);

    const decisao = await aplicar(SALA, {
      tipo: 'pedir', identity: 'ana', nome: 'Ana',
    });

    expect(decisao?.resultado).toBe('concedido');
  });
});
```

- [ ] **Step 3: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/floor/aplicar.test.ts`
Expected: FAIL — `./aplicar.js` não existe

- [ ] **Step 4: Implementar `src/floor/aplicar.ts`**

```ts
import { api } from '../livekit.js';
import { emSerie } from '../serie.js';
import { decide } from './decide.js';
import { ESTADO_VAZIO, type Decisao, type EstadoDaVez, type Evento } from './types.js';

function permissao(canPublish: boolean) {
  return { permission: { canSubscribe: true, canPublish, canPublishData: true } };
}

function lerEstado(metadata: string | undefined): EstadoDaVez {
  if (!metadata) return ESTADO_VAZIO;
  try {
    const bruto = JSON.parse(metadata) as Partial<EstadoDaVez>;
    return { sharer: bruto.sharer ?? null, pending: bruto.pending ?? null };
  } catch {
    return ESTADO_VAZIO;
  }
}

/** Resolve o evento e aplica os efeitos. `null` quando a sala não existe. */
export function aplicar(salaId: string, evento: Evento): Promise<Decisao | null> {
  return emSerie(salaId, async () => {
    const [sala] = await api.room.listRooms([salaId]);
    if (!sala) return null;

    const participantes = await api.room.listParticipants(salaId);
    const presentes = participantes.map((p) => p.identity);

    const { estado, decisao } = decide(
      lerEstado(sala.metadata),
      presentes,
      Date.now(),
      evento,
    );

    if (decisao.resultado === 'concedido') {
      if (decisao.revogarDe) {
        await api.room.updateParticipant(salaId, decisao.revogarDe, permissao(false));
      }
      await api.room.updateParticipant(salaId, decisao.para, permissao(true));
    } else if (decisao.resultado === 'liberado') {
      await api.room.updateParticipant(salaId, decisao.revogarDe, permissao(false));
    }

    await api.room.updateRoomMetadata(salaId, JSON.stringify(estado));
    return decisao;
  });
}
```

- [ ] **Step 5: Rodar o teste e confirmar que passa**

Run: `npx vitest run src/floor/aplicar.test.ts`
Expected: PASS (4 testes)

- [ ] **Step 6: Implementar `src/routes/vez.ts` e registrar em `app.ts`**

```ts
import type { FastifyInstance, FastifyReply } from 'fastify';
import { aplicar } from '../floor/aplicar.js';
import type { Evento } from '../floor/types.js';

type Params = { id: string };

export function registrarRotasDaVez(app: FastifyInstance): void {
  async function resolver(salaId: string, evento: Evento, reply: FastifyReply) {
    const decisao = await aplicar(salaId, evento);
    if (!decisao) return reply.code(404).send({ erro: 'sala-inexistente' });
    // Spec §6.4: responder ou liberar sem deter a vez é 403, não sucesso silencioso.
    if (decisao.resultado === 'ignorado' && decisao.motivo === 'nao-e-o-dono') {
      return reply.code(403).send({ erro: 'nao-e-o-dono' });
    }
    return { decisao };
  }

  app.post<{ Params: Params; Body: { identity: string; nome: string } }>(
    '/rooms/:id/floor/request',
    (req, reply) =>
      resolver(
        req.params.id,
        { tipo: 'pedir', identity: req.body.identity, nome: req.body.nome },
        reply,
      ),
  );

  app.post<{ Params: Params; Body: { identity: string; aceita: boolean } }>(
    '/rooms/:id/floor/answer',
    (req, reply) =>
      resolver(
        req.params.id,
        { tipo: 'responder', identity: req.body.identity, aceita: req.body.aceita },
        reply,
      ),
  );

  app.post<{ Params: Params; Body: { identity: string } }>(
    '/rooms/:id/floor/release',
    (req, reply) =>
      resolver(req.params.id, { tipo: 'liberar', identity: req.body.identity }, reply),
  );
}
```

Registre em `app.ts` com `registrarRotasDaVez(app)`, ao lado de `registrarRotasDeSala(app)`.

- [ ] **Step 6b: Cobrir o 403 com teste**

Acrescente a `src/floor/aplicar.test.ts` um teste de rota que prova o contrato da spec:

```ts
it('responde 403 quando quem responde não detém a vez', async () => {
  const estado = {
    sharer: { identity: 'ana', nome: 'Ana', desde: 0 },
    pending: { identity: 'pedro', nome: 'Pedro', expiraEm: Date.now() + 10_000 },
  };
  mockRoom.listRooms.mockResolvedValue([
    { name: SALA, metadata: JSON.stringify(estado) },
  ]);
  mockRoom.listParticipants.mockResolvedValue([
    { identity: 'ana' }, { identity: 'pedro' },
  ]);

  const { criarApp } = await import('../app.js');
  const app = criarApp();
  const r = await app.inject({
    method: 'POST',
    url: `/rooms/${SALA}/floor/answer`,
    payload: { identity: 'pedro', aceita: true },
  });

  expect(r.statusCode).toBe(403);
  expect(r.json()).toEqual({ erro: 'nao-e-o-dono' });
});
```

- [ ] **Step 7: Rodar a suíte inteira**

Run: `npm test`
Expected: PASS (todos os testes das Tasks 2, 3, 6 e 7)

- [ ] **Step 8: Commit**

```bash
git add token-service/
git commit -m "feat: rotas da vez com permissão de publicar aplicada pelo SFU"
```

---

## Task 8: Compartilhar e assistir

**Files:**
- Create: `web/src/lib/perfis.ts`, `web/src/hooks/useVez.ts`, `web/src/components/Player.tsx`, `web/src/components/SeletorPerfil.tsx`
- Test: `web/src/lib/perfis.test.ts`
- Modify: `web/src/pages/Sala.tsx`, `web/src/lib/api.ts`

**Interfaces:**
- Consumes: `useSala` (Task 5), rotas da vez (Task 7)
- Produces: `PERFIS`, `escolherCodec(preferirAv1)`, `opcoesDeCaptura(perfil, alta, codec) → { captura, publicacao }`, `useVez(room, salaId) → { estado, souDono, pedemMinhaVez, pedir, responder, liberar }`, `pedirVez`/`responderVez`/`liberarVez` em `lib/api.ts`

- [ ] **Step 1: Escrever o teste que falha**

`web/src/lib/perfis.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { PERFIS, opcoesDeCaptura } from './perfis';

describe('opcoesDeCaptura', () => {
  it('usa 720p e 15fps com hint de detalhe no perfil tela', () => {
    const { captura, publicacao } = opcoesDeCaptura(PERFIS.tela, false, 'vp9');
    expect(captura.resolution).toEqual({ width: 1280, height: 720, frameRate: 15 });
    expect(captura.contentHint).toBe('detail');
    expect(captura.audio).toBe(true);
    expect(publicacao.simulcast).toBe(false);
    expect(publicacao.videoCodec).toBe('vp9');
  });

  it('usa 30fps com hint de movimento no perfil vídeo', () => {
    const { captura } = opcoesDeCaptura(PERFIS.video, false, 'vp9');
    expect(captura.resolution?.frameRate).toBe(30);
    expect(captura.contentHint).toBe('motion');
  });

  it('dobra resolução e bitrate na opção de alta qualidade', () => {
    const padrao = opcoesDeCaptura(PERFIS.video, false, 'vp9');
    const alta = opcoesDeCaptura(PERFIS.video, true, 'vp9');
    expect(alta.captura.resolution).toEqual({ width: 1920, height: 1080, frameRate: 30 });
    expect(alta.publicacao.videoEncoding!.maxBitrate).toBe(
      padrao.publicacao.videoEncoding!.maxBitrate * 2,
    );
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/lib/perfis.test.ts`
Expected: FAIL — módulo inexistente

- [ ] **Step 3: Implementar `src/lib/perfis.ts`**

```ts
import {
  supportsAV1,
  supportsVP9,
  type ScreenShareCaptureOptions,
  type TrackPublishOptions,
  type VideoCodec,
} from 'livekit-client';

export type Perfil = {
  id: 'tela' | 'video';
  rotulo: string;
  descricao: string;
  fps: number;
  bitrate: number;
  hint: 'detail' | 'motion';
};

export const PERFIS: Record<Perfil['id'], Perfil> = {
  tela: {
    id: 'tela',
    rotulo: 'Tela',
    descricao: 'Código, navegar, mostrar algo. Mais nítido, menos fluido.',
    fps: 15,
    bitrate: 500_000,
    hint: 'detail',
  },
  video: {
    id: 'video',
    rotulo: 'Vídeo',
    descricao: 'Filme, jogo, qualquer coisa em movimento.',
    fps: 30,
    bitrate: 800_000,
    hint: 'motion',
  },
};

/** VP9 é o padrão; AV1 só quando o navegador suporta e o usuário pede. */
export function escolherCodec(preferirAv1: boolean): VideoCodec {
  if (preferirAv1 && supportsAV1()) return 'av1';
  if (supportsVP9()) return 'vp9';
  return 'h264';
}

export function opcoesDeCaptura(
  perfil: Perfil,
  alta: boolean,
  codec: VideoCodec,
): { captura: ScreenShareCaptureOptions; publicacao: TrackPublishOptions } {
  const fator = alta ? 2 : 1;
  return {
    captura: {
      audio: true,
      contentHint: perfil.hint,
      resolution: {
        width: alta ? 1920 : 1280,
        height: alta ? 1080 : 720,
        frameRate: perfil.fps,
      },
    },
    publicacao: {
      videoCodec: codec,
      simulcast: false,
      videoEncoding: {
        maxBitrate: perfil.bitrate * fator,
        maxFramerate: perfil.fps,
      },
      degradationPreference:
        perfil.hint === 'detail' ? 'maintain-resolution' : 'maintain-framerate',
    },
  };
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run src/lib/perfis.test.ts`
Expected: PASS (3 testes)

- [ ] **Step 5: Acrescentar as chamadas da vez em `src/lib/api.ts`**

```ts
export type Decisao =
  | { resultado: 'concedido'; para: string; revogarDe: string | null }
  | { resultado: 'aguardando'; dono: string }
  | { resultado: 'ocupado' }
  | { resultado: 'recusado' }
  | { resultado: 'liberado'; revogarDe: string }
  | { resultado: 'ignorado'; motivo: string };

export const pedirVez = (sala: string, identity: string, nome: string) =>
  post<{ decisao: Decisao }>(`/rooms/${sala}/floor/request`, { identity, nome });

export const responderVez = (sala: string, identity: string, aceita: boolean) =>
  post<{ decisao: Decisao }>(`/rooms/${sala}/floor/answer`, { identity, aceita });

export const liberarVez = (sala: string, identity: string) =>
  post<{ decisao: Decisao }>(`/rooms/${sala}/floor/release`, { identity });
```

- [ ] **Step 6: Implementar `src/hooks/useVez.ts`**

```ts
import { useCallback, useEffect, useState } from 'react';
import { Room, RoomEvent } from 'livekit-client';
import { liberarVez, pedirVez, responderVez, type Decisao } from '../lib/api';
import { obterIdentidade } from '../lib/identidade';

export type EstadoDaVez = {
  sharer: { identity: string; nome: string; desde: number } | null;
  pending: { identity: string; nome: string; expiraEm: number } | null;
};

const VAZIO: EstadoDaVez = { sharer: null, pending: null };

function ler(metadata: string | undefined): EstadoDaVez {
  if (!metadata) return VAZIO;
  try {
    const bruto = JSON.parse(metadata) as Partial<EstadoDaVez>;
    return { sharer: bruto.sharer ?? null, pending: bruto.pending ?? null };
  } catch {
    return VAZIO;
  }
}

export function useVez(room: Room | null, salaId: string) {
  const [estado, setEstado] = useState<EstadoDaVez>(VAZIO);
  const eu = obterIdentidade();

  useEffect(() => {
    if (!room) return;
    setEstado(ler(room.metadata));
    const aoMudar = (metadata: string) => setEstado(ler(metadata));
    room.on(RoomEvent.RoomMetadataChanged, aoMudar);
    return () => {
      room.off(RoomEvent.RoomMetadataChanged, aoMudar);
    };
  }, [room]);

  const pedir = useCallback(
    (nome: string): Promise<Decisao> =>
      pedirVez(salaId, eu, nome).then((r) => r.decisao),
    [salaId, eu],
  );

  const responder = useCallback(
    (aceita: boolean) => responderVez(salaId, eu, aceita),
    [salaId, eu],
  );

  const liberar = useCallback(() => liberarVez(salaId, eu), [salaId, eu]);

  return {
    estado,
    souDono: estado.sharer?.identity === eu,
    pedemMinhaVez: estado.sharer?.identity === eu ? estado.pending : null,
    pedir,
    responder,
    liberar,
  };
}
```

- [ ] **Step 7: Verificar que a metadata realmente propaga**

Esta é a única premissa da arquitetura ainda não provada: o estado da vez só funciona se `RoomMetadataChanged` chegar aos participantes.

Com duas abas conectadas na mesma sala, rode no console de uma delas e observe a outra:

```js
await fetch('/api/rooms/<UUID-DA-SALA>/floor/request', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ identity: '<sua-identidade>', nome: 'Teste' }),
}).then(r => r.json());
```

Expected: a segunda aba loga o evento com o novo `sharer`. Se não chegar, pare e resolva antes de seguir — o resto da Task 9 depende disso.

- [ ] **Step 8: Implementar `Player.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react';
import { Room, RoomEvent, Track, type RemoteTrack } from 'livekit-client';

export function Player({ room }: { room: Room }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [temVideo, setTemVideo] = useState(false);

  useEffect(() => {
    function aoAssinar(track: RemoteTrack) {
      if (track.source !== Track.Source.ScreenShare &&
          track.source !== Track.Source.ScreenShareAudio) return;
      if (ref.current) track.attach(ref.current);
      setTemVideo(true);
    }
    function aoDesassinar(track: RemoteTrack) {
      track.detach();
      setTemVideo(false);
    }
    room.on(RoomEvent.TrackSubscribed, aoAssinar);
    room.on(RoomEvent.TrackUnsubscribed, aoDesassinar);
    return () => {
      room.off(RoomEvent.TrackSubscribed, aoAssinar);
      room.off(RoomEvent.TrackUnsubscribed, aoDesassinar);
    };
  }, [room]);

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
      <video ref={ref} autoPlay playsInline className="h-full w-full object-contain" />
      {!temVideo && (
        <p className="absolute inset-0 grid place-items-center text-neutral-500">
          Ninguém está compartilhando agora
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 9: Ligar o botão de compartilhar em `Sala.tsx`**

```ts
async function aoCompartilhar(perfil: Perfil, alta: boolean, preferirAv1: boolean) {
  const { decisao } = { decisao: await pedir(apelido) };
  if (decisao.resultado !== 'concedido') return decisao; // a UI da Task 9 trata o resto

  const codec = escolherCodec(preferirAv1);
  const { captura, publicacao } = opcoesDeCaptura(perfil, alta, codec);
  await room.localParticipant.setScreenShareEnabled(true, captura, publicacao);
  return decisao;
}
```

Parar tem dois gatilhos — o botão próprio e a barra nativa do Chrome. Cubra os dois com um caminho só:

```ts
useEffect(() => {
  if (!room) return;
  const aoDespublicar = () => void liberar();
  room.on(RoomEvent.LocalTrackUnpublished, aoDespublicar);
  return () => {
    room.off(RoomEvent.LocalTrackUnpublished, aoDespublicar);
  };
}, [room, liberar]);
```

- [ ] **Step 10: Verificar de ponta a ponta**

Run: `npm run dev`, duas abas na mesma sala.
Expected: compartilhar numa aba faz o vídeo (com áudio) aparecer na outra; parar remove o vídeo e libera a vez.

- [ ] **Step 11: Commit**

```bash
git add web/
git commit -m "feat: compartilhar e assistir tela com perfis de captura e VP9"
```

---

## Task 9: Fluxo de takeover

**Files:**
- Create: `web/src/components/PedidoDeVez.tsx`, `web/src/components/AguardandoResposta.tsx`
- Modify: `web/src/pages/Sala.tsx`, `web/src/hooks/useVez.ts`

**Interfaces:**
- Consumes: `useVez` (Task 8), `ESPERA_MS` = 30 000 ms
- Produces: UI completa de disputa da vez

- [ ] **Step 1: Implementar `PedidoDeVez.tsx`**

Modal que aparece para quem detém a vez quando `pedemMinhaVez` não é nulo.

```tsx
export function PedidoDeVez({
  nome,
  aoResponder,
}: {
  nome: string;
  aoResponder: (aceita: boolean) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-neutral-950/90 p-6">
      <div className="w-full max-w-sm space-y-4 rounded-xl bg-neutral-900 p-6">
        <p className="text-neutral-100">
          <strong>{nome}</strong> quer compartilhar a tela.
        </p>
        <p className="text-sm text-neutral-400">
          Se você não responder em 30 segundos, a vez passa automaticamente.
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => aoResponder(true)}
            className="flex-1 rounded-lg bg-emerald-500 py-2 font-medium text-neutral-950"
          >
            Ceder
          </button>
          <button
            onClick={() => aoResponder(false)}
            className="flex-1 rounded-lg bg-neutral-700 py-2 font-medium text-neutral-100"
          >
            Recusar
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Implementar `AguardandoResposta.tsx`**

Faixa mostrada a quem pediu, com contagem regressiva derivada de `pending.expiraEm - Date.now()`. Ao chegar a zero, chama `pedir()` de novo — o servidor concede porque o pedido venceu (regra "silêncio cede a vez" da Task 6).

```tsx
import { useEffect, useState } from 'react';

export function AguardandoResposta({
  dono,
  expiraEm,
  aoExpirar,
}: {
  dono: string;
  expiraEm: number;
  aoExpirar: () => void;
}) {
  const [restante, setRestante] = useState(() =>
    Math.max(0, Math.ceil((expiraEm - Date.now()) / 1000)),
  );

  useEffect(() => {
    const t = setInterval(() => {
      const s = Math.max(0, Math.ceil((expiraEm - Date.now()) / 1000));
      setRestante(s);
      if (s === 0) {
        clearInterval(t);
        aoExpirar();
      }
    }, 1000);
    return () => clearInterval(t);
  }, [expiraEm, aoExpirar]);

  return (
    <div className="rounded-lg bg-amber-500/15 px-4 py-2 text-sm text-amber-200">
      Aguardando <strong>{dono}</strong> responder… {restante}s
    </div>
  );
}
```

- [ ] **Step 3: Ligar tudo em `Sala.tsx`**

Todas as ramificações derivam de `useVez` — não há estado de disputa duplicado no componente:

```tsx
const { estado, souDono, pedemMinhaVez, pedir, responder } = useVez(room, id);
const eu = obterIdentidade();
const meuPedido = estado.pending?.identity === eu ? estado.pending : null;
const [aviso, setAviso] = useState<string | null>(null);

async function aoPedir() {
  const decisao = await pedir(apelido);
  if (decisao.resultado === 'ocupado') {
    setAviso('Já tem alguém na fila, tenta em instantes.');
  } else if (decisao.resultado === 'concedido') {
    await comecarACompartilhar(); // helper da Task 8
  }
}

// A vez ficou livre enquanto eu aguardava: pede de novo na hora, sem esperar os 30s.
useEffect(() => {
  if (meuPedido && !estado.sharer) void aoPedir();
}, [meuPedido, estado.sharer]);

// Quem tinha a vez recusou: o pedido some sem virar sharer.
useEffect(() => {
  if (!meuPedido && !souDono && aviso === null && estado.sharer) {
    setAviso(`${estado.sharer.nome} preferiu continuar.`);
  }
}, [meuPedido]);
```

Renderização:

```tsx
{pedemMinhaVez && (
  <PedidoDeVez nome={pedemMinhaVez.nome} aoResponder={responder} />
)}
{meuPedido && estado.sharer && (
  <AguardandoResposta
    dono={estado.sharer.nome}
    expiraEm={meuPedido.expiraEm}
    aoExpirar={aoPedir}
  />
)}
{estado.pending && !meuPedido && !souDono && (
  <p className="text-sm text-neutral-400">
    {estado.pending.nome} pediu a vez de compartilhar.
  </p>
)}
{aviso && <p className="text-sm text-amber-300">{aviso}</p>}
```

- [ ] **Step 4: Parar de publicar ao perder a vez**

Em `Sala.tsx`, reaja à mudança de `souDono`:

```ts
useEffect(() => {
  if (!room) return;
  if (!souDono && room.localParticipant.isScreenShareEnabled) {
    void room.localParticipant.setScreenShareEnabled(false);
  }
}, [souDono, room]);
```

- [ ] **Step 5: Verificar o fluxo completo com três abas**

Expected, em sequência: Ana compartilha → Pedro pede e vê a contagem → Ana vê o modal → Ana cede → a tela do Pedro substitui a da Ana para todos → João pede enquanto o pedido do Pedro está ativo e recebe "já tem alguém na fila".

- [ ] **Step 6: Verificar o silêncio cedendo a vez**

Ana compartilha, Pedro pede, ninguém toca no modal da Ana.
Expected: após 30s, a vez passa ao Pedro sozinha.

- [ ] **Step 7: Commit**

```bash
git add web/
git commit -m "feat: fluxo de takeover com pedido, resposta e silêncio cedendo a vez"
```

---

## Task 10: Medidor de consumo

**Files:**
- Create: `token-service/src/usage/acumular.ts`, `token-service/src/usage/metricas.ts`, `token-service/src/usage/store.ts`, `token-service/src/usage/coletor.ts`, `token-service/src/routes/consumo.ts`, `web/src/components/Medidor.tsx`
- Test: `token-service/src/usage/acumular.test.ts`, `token-service/src/usage/metricas.test.ts`
- Modify: `token-service/src/app.ts`, `token-service/src/server.ts`, `web/src/pages/Sala.tsx`

**Interfaces:**
- Consumes: endpoint `http://127.0.0.1:6789/metrics`, `config` (Task 2)
- Produces: `acumular(contador, bytes, agora)`, `lerMetrica(texto, nome)`, `GET /usage → { mes: string, bytes: number }`

- [ ] **Step 1: Descobrir o nome real da métrica**

O nome varia entre versões do LiveKit, então é confirmado na máquina, não presumido:

```bash
curl -s http://127.0.0.1:6789/metrics | grep -i bytes
```

Anote o contador cumulativo de bytes enviados e coloque-o em `USAGE_METRIC` no `.env`. Se nenhum existir com esse nome, use o que representar bytes transmitidos pelo nó.

- [ ] **Step 2: Escrever os testes que falham**

`token-service/src/usage/acumular.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { acumular, type Contador } from './acumular.js';

const marco = new Date('2026-03-10T12:00:00Z');
const base: Contador = { mes: '2026-03', bytes: 100, ultimaLeitura: 1000 };

describe('acumular', () => {
  it('registra a primeira leitura sem somar nada', () => {
    const r = acumular({ mes: '2026-03', bytes: 0, ultimaLeitura: null }, 500, marco);
    expect(r).toEqual({ mes: '2026-03', bytes: 0, ultimaLeitura: 500 });
  });

  it('soma apenas o delta entre leituras', () => {
    expect(acumular(base, 1300, marco)).toEqual({
      mes: '2026-03', bytes: 400, ultimaLeitura: 1300,
    });
  });

  it('zera o acumulado na virada do mês', () => {
    const r = acumular(base, 1300, new Date('2026-04-01T00:00:00Z'));
    expect(r).toEqual({ mes: '2026-04', bytes: 0, ultimaLeitura: 1300 });
  });

  it('não soma salto quando o LiveKit reinicia e o contador zera', () => {
    expect(acumular(base, 5, marco)).toEqual({
      mes: '2026-03', bytes: 100, ultimaLeitura: 5,
    });
  });
});
```

`token-service/src/usage/metricas.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { lerMetrica } from './metricas.js';

const TEXTO = `# HELP livekit_node_bytes_out bytes
# TYPE livekit_node_bytes_out counter
livekit_node_bytes_out{node_id="a",direction="out"} 1200
livekit_node_bytes_out{node_id="b",direction="out"} 300
outra_metrica 999
`;

describe('lerMetrica', () => {
  it('soma todas as séries da métrica', () => {
    expect(lerMetrica(TEXTO, 'livekit_node_bytes_out')).toBe(1500);
  });

  it('devolve null quando a métrica não existe', () => {
    expect(lerMetrica(TEXTO, 'inexistente')).toBeNull();
  });
});
```

- [ ] **Step 3: Rodar os testes e confirmar que falham**

Run: `npx vitest run src/usage/`
Expected: FAIL — módulos inexistentes

- [ ] **Step 4: Implementar `acumular.ts` e `metricas.ts`**

```ts
// src/usage/acumular.ts
export type Contador = { mes: string; bytes: number; ultimaLeitura: number | null };

export const CONTADOR_VAZIO: Contador = { mes: '', bytes: 0, ultimaLeitura: null };

export function acumular(atual: Contador, leitura: number, agora: Date): Contador {
  const mes = agora.toISOString().slice(0, 7);
  if (atual.mes !== mes) return { mes, bytes: 0, ultimaLeitura: leitura };
  if (atual.ultimaLeitura === null) return { ...atual, ultimaLeitura: leitura };

  const delta = leitura - atual.ultimaLeitura;
  // Contador Prometheus zerou (LiveKit reiniciou): reancora sem somar o salto.
  if (delta < 0) return { ...atual, ultimaLeitura: leitura };

  return { mes, bytes: atual.bytes + delta, ultimaLeitura: leitura };
}
```

```ts
// src/usage/metricas.ts
export function lerMetrica(texto: string, nome: string): number | null {
  const linhas = texto
    .split('\n')
    .filter((l) => l.startsWith(nome) && !l.startsWith('#'));
  if (linhas.length === 0) return null;

  return linhas.reduce((total, linha) => {
    const valor = Number(linha.trim().split(/\s+/).at(-1));
    return Number.isFinite(valor) ? total + valor : total;
  }, 0);
}

export async function buscarMetricas(url: string): Promise<string> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`métricas indisponíveis: ${r.status}`);
  return r.text();
}
```

- [ ] **Step 5: Rodar os testes e confirmar que passam**

Run: `npx vitest run src/usage/`
Expected: PASS (6 testes)

- [ ] **Step 6: Implementar `store.ts`, a coleta periódica e `GET /usage`**

```ts
// src/usage/store.ts
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { CONTADOR_VAZIO, type Contador } from './acumular.js';

export async function carregar(caminho: string): Promise<Contador> {
  try {
    return JSON.parse(await readFile(caminho, 'utf8')) as Contador;
  } catch {
    return CONTADOR_VAZIO;
  }
}

export async function salvar(caminho: string, contador: Contador): Promise<void> {
  await mkdir(dirname(caminho), { recursive: true });
  await writeFile(caminho, JSON.stringify(contador), 'utf8');
}
```

```ts
// src/usage/coletor.ts
import { config } from '../config.js';
import { acumular, CONTADOR_VAZIO, type Contador } from './acumular.js';
import { buscarMetricas, lerMetrica } from './metricas.js';
import { carregar, salvar } from './store.js';

let contador: Contador = CONTADOR_VAZIO;

export const consumoAtual = (): Contador => contador;

/** Coleta a cada 60s. Falha de leitura é logada e ignorada: o medidor nunca derruba o serviço. */
export async function iniciarColeta(
  log: (msg: string) => void,
): Promise<NodeJS.Timeout> {
  contador = await carregar(config.arquivoConsumo);

  return setInterval(async () => {
    try {
      const texto = await buscarMetricas('http://127.0.0.1:6789/metrics');
      const bytes = lerMetrica(texto, config.metricaConsumo);
      if (bytes === null) {
        log(`métrica ${config.metricaConsumo} não encontrada`);
        return;
      }
      contador = acumular(contador, bytes, new Date());
      await salvar(config.arquivoConsumo, contador);
    } catch (erro) {
      log(`falha ao coletar consumo: ${String(erro)}`);
    }
  }, 60_000);
}
```

```ts
// src/routes/consumo.ts
import type { FastifyInstance } from 'fastify';
import { consumoAtual } from '../usage/coletor.js';

export function registrarRotaDeConsumo(app: FastifyInstance): void {
  app.get('/usage', async () => {
    const { mes, bytes } = consumoAtual();
    return { mes, bytes };
  });
}
```

Em `server.ts`, chame `await iniciarColeta((m) => app.log.warn(m))` antes do `listen`, e registre a rota em `app.ts`.

- [ ] **Step 7: Implementar `Medidor.tsx` e colocá-lo no rodapé da sala**

```tsx
import { useEffect, useState } from 'react';

const GB = 1024 ** 3;

const emGb = (b: number) => (b / GB).toFixed(1).replace('.', ',');

export function Medidor() {
  const [bytes, setBytes] = useState<number | null>(null);
  const [inicial, setInicial] = useState<number | null>(null);

  useEffect(() => {
    const buscar = () =>
      fetch('/api/usage')
        .then((r) => r.json() as Promise<{ bytes: number }>)
        .then((d) => {
          setBytes(d.bytes);
          setInicial((antes) => antes ?? d.bytes);
        })
        .catch(() => undefined);

    void buscar();
    const t = setInterval(buscar, 30_000);
    return () => clearInterval(t);
  }, []);

  if (bytes === null || inicial === null) return null;

  return (
    <p className="text-xs text-neutral-500">
      essa sessão: {emGb(bytes - inicial)} GB · mês: {emGb(bytes)} GB
    </p>
  );
}
```

"Essa sessão" é o delta do contador do servidor desde que a página abriu. Com uma sala ativa por vez — o caso real de uso — isso equivale ao consumo da sessão. Se duas salas rodarem em paralelo, o número da sessão inclui as duas; é uma imprecisão aceita para não introduzir contabilidade por sala.

- [ ] **Step 8: Verificar**

Run: `npm test` (token-service) — Expected: PASS
Com uma transmissão ativa por alguns minutos, recarregue a sala.
Expected: o número no rodapé cresce.

- [ ] **Step 9: Commit**

```bash
git add token-service/ web/
git commit -m "feat: medidor de consumo mensal a partir das métricas do LiveKit"
```

---

## Task 11: Acabamento

**Files:**
- Create: `web/src/lib/navegador.ts`, `web/src/components/AvisoNavegador.tsx`
- Test: `web/src/lib/navegador.test.ts`
- Modify: `web/src/pages/Sala.tsx`, `web/src/components/SeletorPerfil.tsx`

**Interfaces:**
- Consumes: `escolherCodec` (Task 8)
- Produces: `capturaDeAudioSuportada(): boolean`, avisos e opções de qualidade

- [ ] **Step 1: Escrever o teste que falha**

`web/src/lib/navegador.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { capturaDeAudioSuportada } from './navegador';

function comUserAgent(ua: string) {
  vi.stubGlobal('navigator', { userAgent: ua });
}

describe('capturaDeAudioSuportada', () => {
  it('aceita Chrome', () => {
    comUserAgent('Mozilla/5.0 Chrome/130.0 Safari/537.36');
    expect(capturaDeAudioSuportada()).toBe(true);
  });

  it('rejeita Safari', () => {
    comUserAgent('Mozilla/5.0 Version/17.0 Safari/605.1.15');
    expect(capturaDeAudioSuportada()).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/lib/navegador.test.ts`
Expected: FAIL — módulo inexistente

- [ ] **Step 3: Implementar `src/lib/navegador.ts`**

```ts
/** Só Chrome/Edge capturam áudio da tela; Firefox só de aba, Safari nenhum. */
export function capturaDeAudioSuportada(): boolean {
  const ua = navigator.userAgent;
  const ehChromium = /Chrome\/|Edg\//.test(ua);
  return ehChromium && !/OPR\//.test(ua);
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run src/lib/navegador.test.ts`
Expected: PASS (2 testes)

- [ ] **Step 5: Mostrar o aviso antes de compartilhar**

No `SeletorPerfil`, quando `capturaDeAudioSuportada()` for falso:

> "Seu navegador não captura o áudio da tela — a galera vai ver a imagem sem som. Chrome ou Edge resolvem."

- [ ] **Step 6: Acrescentar as opções de qualidade ao seletor**

Duas caixas: "Alta definição (1080p)" com a nota "dobra o consumo de banda", e "Usar AV1" com "economiza banda, mas exige mais do seu computador" — desabilitada quando `supportsAV1()` for falso.

- [ ] **Step 7: Cobrir os erros restantes em `Sala.tsx`**

- Permissão de tela negada (`getDisplayMedia` rejeita) → "Você não autorizou o compartilhamento" e chamada a `liberar()` para devolver a vez.
- `RoomEvent.Reconnecting` → faixa "Reconectando…"; `Reconnected` → some.
- Falha de rede no token-service → "Serviço indisponível. Tenta de novo em instantes."

- [ ] **Step 8: Verificar cada erro na mão**

Expected: negar a permissão de tela devolve a vez e mostra o aviso; desligar o token-service mostra a mensagem de serviço indisponível; abrir no Firefox mostra o aviso de áudio.

- [ ] **Step 9: Commit**

```bash
git add web/
git commit -m "feat: avisos de navegador, opções de qualidade e telas de erro"
```

---

## Task 12: E2E do fluxo de takeover

**Files:**
- Create: `web/playwright.config.ts`, `web/e2e/takeover.spec.ts`
- Modify: `web/package.json`

**Interfaces:**
- Consumes: aplicação completa (Tasks 1–11)
- Produces: `npm run e2e`

- [ ] **Step 1: Instalar e configurar o Playwright**

```bash
cd web && npm i -D @playwright/test && npx playwright install chromium
```

`playwright.config.ts` — as flags substituem a captura de tela real por uma fonte falsa, que é o que torna o fluxo automatizável:

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  use: {
    baseURL: 'http://localhost:5173',
    launchOptions: {
      args: [
        '--auto-select-desktop-capture-source=Entire screen',
        '--use-fake-ui-for-media-stream',
        '--allow-running-insecure-content',
      ],
    },
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
  },
});
```

- [ ] **Step 2: Escrever o teste que falha**

`web/e2e/takeover.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

test('a vez passa de Ana para Pedro quando Ana cede', async ({ browser }) => {
  const ctxAna = await browser.newContext();
  const ctxPedro = await browser.newContext();
  const ana = await ctxAna.newPage();
  const pedro = await ctxPedro.newPage();

  await ana.goto('/');
  await ana.getByRole('button', { name: 'Criar sala' }).click();
  await ana.getByPlaceholder('Seu apelido').fill('Ana');
  await ana.getByRole('button', { name: 'Entrar' }).click();

  const urlSala = ana.url();
  await pedro.goto(urlSala);
  await pedro.getByPlaceholder('Seu apelido').fill('Pedro');
  await pedro.getByRole('button', { name: 'Entrar' }).click();

  await ana.getByRole('button', { name: 'Compartilhar' }).click();
  await ana.getByRole('button', { name: 'Vídeo' }).click();
  await expect(pedro.locator('video')).toBeVisible({ timeout: 20_000 });

  await pedro.getByRole('button', { name: 'Compartilhar' }).click();
  await expect(ana.getByText('Pedro quer compartilhar a tela.')).toBeVisible();

  await ana.getByRole('button', { name: 'Ceder' }).click();
  await expect(ana.locator('video')).toBeVisible({ timeout: 20_000 });
  await expect(pedro.getByRole('button', { name: 'Parar de compartilhar' })).toBeVisible();
});
```

- [ ] **Step 3: Rodar o teste**

Run: `npx playwright test`
Expected: PASS. Se falhar por texto de botão, ajuste o **teste** para o texto real da UI — não mude a UI para servir ao teste.

- [ ] **Step 4: Adicionar o script e commitar**

```bash
git add web/
git commit -m "test: e2e do fluxo de takeover no Chrome"
```

---

## Task 13: Deploy e verificação em produção

**Files:**
- Modify: `README.md`, `docker-compose.yml`

**Interfaces:**
- Consumes: tudo
- Produces: aplicação rodando no subdomínio da VPS

- [ ] **Step 1: Adicionar o builder do front ao compose**

```yaml
  web-build:
    image: node:22-alpine
    working_dir: /app
    profiles: ["build"]
    volumes:
      - ./web:/app
    command: sh -c "npm ci && npm run build"
```

- [ ] **Step 2: Documentar o deploy no README**

```bash
git pull
docker compose run --rm web-build
docker compose up -d --build
sudo nginx -t && sudo systemctl reload nginx
```

- [ ] **Step 3: Verificar em produção**

Com duas pessoas em redes diferentes (uma em 4G): criar sala, entrar pelo link, compartilhar com áudio, pedir a vez, ceder. Nenhum teste local cobre a travessia de NAT real — esta é a verificação que importa.

- [ ] **Step 4: Confirmar que a contingência TCP funciona**

Bloqueie temporariamente a faixa UDP (`sudo ufw deny 50000:50100/udp`), recarregue e confirme que o vídeo ainda passa pela 7881. Reabra depois.

- [ ] **Step 5: Commit**

```bash
git add README.md docker-compose.yml
git commit -m "docs: procedimento de deploy e verificação em produção"
```
