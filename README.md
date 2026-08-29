# Cheri Screen

**tela ao vivo · uma por vez**

Abre a sala, joga o link no grupo, mostra tua tela pra galera — jogo, filme, o
que for. Um de cada vez, e quem quiser a vez, pede. Simples assim, cheri.

Sem conta, sem login, sem banco de dados. O link é a chave e a sala some sozinha
quando esvazia. LiveKit SFU auto-hospedado numa VPS Linux + um serviço de token
em Fastify, e um front em React.

## Como funciona

- **Uma tela por vez.** Quem está no comando aparece pra todo mundo; os outros
  assistem. Tem áudio de tela junto (Chrome ou Edge — Firefox e Safari mostram só
  a imagem).
- **Pedir a vez.** Clicou em compartilhar enquanto tem outra pessoa no ar? Vira um
  pedido. Quem está no comando **cede** ou **recusa**. Silêncio de 30 segundos
  cede a vez sozinho.
- **Tela cheia.** Botão no canto do player joga a tela compartilhada em fullscreen.
- **A moldura conta a história.** Ela muda de cor conforme a vez: magenta é você,
  ciano são os outros, lima é "no ar", e um arco âmbar corre os 30s de um pedido.

O estado da vez vive no `metadata` da sala do LiveKit, que replica pra todos os
participantes sozinho — não tem servidor de estado próprio. A permissão de
publicar sempre entra em `false`; só o token-service liga ela, e só pra quem
ganhou a vez.

## Arquitetura

```
Cliente Web (navegador)
    ↓ wss://cheri-screen.seudominio.com.br  (origin puro; o cliente anexa /rtc/v1)
Nginx (443 SSL)
    ├─ location /            → web/dist (estático, SPA)
    ├─ location /api/        → 127.0.0.1:3010  (token-service, tira o prefixo)
    └─ location /rtc         → 127.0.0.1:7880  (upgrade WebSocket, pega /rtc e /rtc/v1)
LiveKit SFU (7880 signalling)
    ↓ UDP 50000–50100 (mídia)  ·  TCP 7881 (contingência)
Internet pública
```

## Portas

- **7880/TCP** localhost: signalling WebSocket do LiveKit
- **7881/TCP** público: fallback TCP para mídia
- **50000–50100/UDP** público: mídia em tempo real
- **6789/TCP** localhost: métricas Prometheus
- **443/TCP** público: nginx (SSL)

## Variáveis de ambiente

Copie `.env.example` para `.env` e preencha:

```bash
cp .env.example .env
```

- `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET`: par de chaves gerado pelo LiveKit
- `LIVEKIT_URL`: URL interna do SFU (`http://127.0.0.1:7880`)
- `PUBLIC_HOST`: domínio público (sem protocolo), ex: `cheri-screen.seudominio.com.br`
- `PORT`: porta do token-service (padrão `3000`; troque se já estiver em uso na VPS)
- `NODE_IP`: IP público anunciado nos candidatos ICE. Vazio = LiveKit detecta
  sozinho (funciona com `use_external_ip: true`).
- `USAGE_METRIC` / `USAGE_URL` / `USAGE_FILE`: métrica Prometheus dos bytes de
  mídia enviados, endpoint do coletor, e o arquivo JSON de consumo

## Configuração

Edite os arquivos de exemplo:

- `nginx/cheri-share.conf.example` → `/etc/nginx/sites-available/cheri-screen.seudominio.com.br`
  - Substitua o domínio de exemplo pelo seu
  - Substitua `/caminho/para/cheri-share/web/dist` pelo caminho real
  - Configure `ssl_certificate` e `ssl_certificate_key` com seus certificados Certbot

## Ciclo de vida do SFU

### 1. Gerar chaves LiveKit

Numa máquina com Docker:

```bash
docker run --rm livekit/livekit-server generate-keys
```

Exemplo de saída:

```
API Key: AYZ...5MB
Secret:  sB0...r2A
```

Copie o par para `.env`:

```bash
LIVEKIT_API_KEY=AYZ...5MB
LIVEKIT_API_SECRET=sB0...r2A
```

### 2. Subir o SFU na VPS

O `docker-compose.yml` fixa `livekit/livekit-server:v1.13` — o `livekit-client`
do front (2.x) fala o protocolo novo (`/rtc/v1`, `LocalTrackSubscribed`), que
servidores 1.8.x ainda não têm. Não desça a imagem sem descer o cliente junto.

Na VPS, com `.env` já configurado:

```bash
docker compose up -d livekit
docker compose logs -f livekit
```

Esperado no log:

```
starting LiveKit server
listening on ws://127.0.0.1:7880
```

Se ver erro de configuração YAML, verifique `livekit/livekit.yaml`.

### 3. Abrir o firewall

**Todo o desenho de portas assume firewall em `default deny incoming`.** Com
`network_mode: host`, o LiveKit liga `7880` (HTTP/WS) e `6789` (métricas
Prometheus) em `0.0.0.0`; sem default-deny, o endpoint de métricas (contagem de
salas/participantes, banda) e a porta de sinalização ficam servidos para a
internet. Numa VPS com ufw inativo — padrão comum — isso fica exposto.

Na VPS, configure UFW do zero:

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH            # ou: sudo ufw allow 22/tcp
sudo ufw allow 443/tcp           # nginx
sudo ufw allow 7881/tcp          # contingência TCP de mídia
sudo ufw allow 50000:50100/udp   # mídia em tempo real
sudo ufw enable
```

Confirme:

```bash
sudo ufw status verbose
```

Esperado: `Default: deny (incoming)` e regras só para SSH, `443/tcp`,
`7881/tcp` e `50000:50100/udp`. `7880` e `6789` **não** aparecem — só o nginx
(local) e o token-service (local) falam com elas.

### 4. Configurar nginx

Na VPS, adapte `nginx/cheri-share.conf.example` e habilite:

```bash
sudo cp nginx/cheri-share.conf.example /etc/nginx/sites-available/cheri-screen.seudominio.com.br
sudo ln -s /etc/nginx/sites-available/cheri-screen.seudominio.com.br /etc/nginx/sites-enabled/
sudo nginx -t  # validar sintaxe
sudo systemctl restart nginx
```

## Prova de mídia

Valide que vídeo atravessa a VPS antes de prosseguir.

### Gerar token de teste

Na VPS ou máquina local com Docker:

```bash
docker run --rm \
  -e LIVEKIT_URL=ws://SEU_HOST:7880 \
  livekit/livekit-cli token create \
  --api-key CHAVE \
  --api-secret SEGREDO \
  --join \
  --room teste \
  --identity eu \
  --valid-for 1h
```

Substitua `CHAVE` e `SEGREDO` pelos valores de `.env`.

### Teste em duas máquinas

1. Abra Chrome ou Edge em **máquina A** (rede A):
   - Acesse https://meet.livekit.io/?tab=custom
   - Em "Server URL": `wss://cheri-screen.seudominio.com.br` (o cliente anexa `/rtc/v1` sozinho)
   - Em "Token": cole o token gerado acima
   - Clique "Join"
   - Ative câmera: esperado vídeo local no painel esquerdo

2. Repita numa **máquina B** em rede **diferente** (use 4G, outro ISP, ou VPN de outra localização):
   - Mesmo Server URL
   - **Token diferente**: rode `livekit-cli token create` de novo com **as mesmas
     chaves** (`--api-key` / `--api-secret` idênticos aos do `.env`) e só troque
     `--identity`. Gerar chaves novas com `generate-keys` produziria um par que o
     SFU não reconhece.
   - Mesmo name de sala (`teste`), identidade diferente (ex: `--identity tu`)
   - Clique "Join"

3. Confirme:
   - Vídeo de A aparece em B (painel direito)
   - Vídeo de B aparece em A (painel direito)
   - Áudio bidirecional fluindo

**Se falhar:**
- `docker compose logs livekit` na VPS
- Firewall: `sudo ufw status` deve mostrar `50000:50100/udp` liberado
- TCP: `nc -zv cheri-screen.seudominio.com.br 7881`
- DNS: `nslookup cheri-screen.seudominio.com.br`
- nginx: `sudo nginx -t` e `sudo systemctl status nginx`

No log do LiveKit, `participant active` deve trazer um candidato selecionado com
o **IP público** (não `172.x` de bridge docker) e `connectionType: udp`.

**Este é o portão da fase 1.** Se mídia não fluir, não prossiga.

## Deploy em produção

Pré-requisito: `.env` configurado com as chaves do LiveKit.

O repositório na VPS **não tem remote git** — o código é transferido por
`tar | ssh` da máquina local:

```bash
# da máquina local, na raiz do repo
tar czf - --exclude=node_modules --exclude=dist web docker-compose.yml \
  | ssh SEU_VPS 'cd /opt/cheri-share && tar xzf -'
```

Na VPS, reconstrua o front e suba os containers:

```bash
cd /opt/cheri-share/web && npm ci && npm run build   # gera web/dist, servido direto pelo nginx
cd /opt/cheri-share && docker compose up -d           # livekit + token-service
sudo nginx -t && sudo systemctl reload nginx
```

`web/dist` é servido estático pelo nginx — rebuildou, já está no ar, sem restart.

### Nginx

O navegador conecta em `wss://PUBLIC_HOST` (sem `/rtc`). O `livekit-client` pede
`/rtc/v1`; o bloco precisa ser `location /rtc` (**prefixo** — pega `/rtc` e
`/rtc/v1`) encaminhando para `127.0.0.1:7880`. `location = /rtc` (match exato)
quebra a conexão.

- Substitua `/caminho/para/cheri-share/web/dist` pelo caminho real
- Configure `ssl_certificate` / `ssl_certificate_key` com os certificados Certbot

### `.env`

O `.env` na raiz **nunca é commitado** (`.gitignore` cobre). Na VPS: copie
`.env.example`, preencha as chaves e o `PUBLIC_HOST`.

## Verificação em produção

Testes locais não cobrem NAT traversal. O app tem um só fluxo — **uma tela por
vez, com áudio de tela, e pedido de takeover**. Sem câmera, microfone ou chat.

### Fluxo completo, dois usuários, redes diferentes

Precisa de **Chrome ou Edge** nas duas pontas e de duas redes **diferentes**
(uma em 4G/5G, a outra em WiFi de outro ISP ou VPN).

1. Na home, A clica em **Criar sala** e copia o link.
2. A entra na sala (informa o apelido na primeira vez).
3. B abre o mesmo link em outra rede e entra com outro apelido.
4. A clica em **Compartilhar minha tela**, escolhe o perfil (**Tela** ou
   **Vídeo**), marca a caixa de áudio de tela no seletor do navegador e confirma.
5. Confirme:
   - [ ] B vê a tela de A ("Ninguém está compartilhando agora" some)
   - [ ] O áudio da tela de A chega em B
   - [ ] A lista de participantes mostra os dois apelidos nas duas pontas
   - [ ] O botão **Tela cheia** no player leva a imagem a fullscreen
6. B clica em **Compartilhar minha tela** → A vê "B quer compartilhar a tela.".
7. A clica em **Ceder**. Confirme:
   - [ ] A vez troca de dono: B passa a ver "Parar de compartilhar", A volta ao
         seletor de perfil
   - [ ] B enxerga a própria tela publicada e A vê a tela de B
8. Repita o passo 6 e, desta vez, **A não responde**. Após ~30s:
   - [ ] A vez passa sozinha para B ("silêncio cede a vez")
   - [ ] B começa a transmitir sem clique extra

**Se falhar:**
- `docker compose logs livekit` na VPS
- `sudo ufw status verbose` mostra `50000:50100/udp` e `7881/tcp` liberados e
  `Default: deny (incoming)`
- TCP fallback: `nc -zv cheri-screen.seudominio.com.br 7881`
- No console do navegador, `negotiation timed out` em loop + `v1 RTC path not
  found` = servidor LiveKit velho demais pro cliente. Suba a imagem (ver §2).

### Contingência TCP (fallback UDP)

Bloqueie UDP temporariamente e confirme que a mídia cai para TCP:

```bash
# na VPS
sudo ufw deny 50000:50100/udp && sudo ufw reload
```

Recarregue o navegador, reconecte e confirme:
- [ ] A tela compartilhada ainda passa (via TCP na 7881)
- [ ] O áudio de tela ainda funciona (latência pode subir um pouco)

Reabra:

```bash
sudo ufw allow 50000:50100/udp && sudo ufw reload
```

## Métricas

LiveKit expõe Prometheus em `http://127.0.0.1:6789/metrics`. Confirme os nomes
na sua versão: `curl -s 127.0.0.1:6789/metrics | grep -iE 'room|participant|bytes'`.

- `livekit_packet_bytes{direction="outgoing"}` — bytes de mídia enviados
  (consumo de banda; `livekit_node_bytes_out` **não** existe nas versões 1.8–1.13)
- séries de salas e participantes (o nome varia por versão — o `grep` acima mostra
  quais existem)

O coletor de consumo lê essa métrica de 60 em 60s, soma por prefixo, e grava
`consumo.json` no volume `dados`. O front mostra o total do mês e da sessão no
rodapé.

## Desenvolvimento local

Precisa de um LiveKit acessível em `ws://127.0.0.1:7880`. O mais rápido:

```bash
docker compose up -d livekit   # usa as chaves do seu .env
```

Em dois terminais, com o `.env` da raiz preenchido:

```bash
# terminal 1 — token-service (porta 3000)
cd token-service && npm install && npm run dev

# terminal 2 — front (porta 5173)
cd web && npm install && npm run dev
```

O `vite.config.ts` já faz proxy de `/api` para `http://127.0.0.1:3000`, então
abra `http://localhost:5173` e o fluxo de criar/entrar na sala funciona ponta a
ponta. Captura de tela exige contexto seguro — `localhost` conta como seguro nos
navegadores baseados em Chromium.

Testes: `npm test` em cada pacote. E2E (exige a pilha completa no ar):
`cd web && npm run e2e`.

## Stack

| Camada | O quê |
|---|---|
| SFU | `livekit/livekit-server:v1.13`, Docker, `network_mode: host` |
| Token-service | Node 22, Fastify 5, TypeScript ESM, `livekit-server-sdk` |
| Front | React 18, Vite 5, Tailwind 3, react-router-dom 7, `livekit-client` |
| Testes | Vitest (+ jsdom no front), Playwright, oxlint |

## Licença

Privado.
