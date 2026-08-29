# Cheri-share

Sala web privada para compartilhamento de tela entre amigos, uma de cada vez. LiveKit SFU auto-hospedado em VPS Linux + serviço de token Fastify, sem banco de dados, sem login.

## Arquitetura

```
Cliente Web (navegador)
    ↓ wss://share.seudominio.com.br (bare origin, cliente anexa /rtc)
Nginx (443 SSL)
    ↓ location /rtc → ws://127.0.0.1:7880 (upgrade WebSocket)
LiveKit SFU (7880 signalling)
    ↓ UDP 50000–50100 (media)
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
- `PUBLIC_HOST`: domínio público (sem protocolo), ex: `share.seudominio.com.br`
- `PORT`: porta do token-service (padrão 3000)
- `USAGE_METRIC` / `USAGE_FILE`: métrica Prometheus e arquivo de consumo

## Configuração

Edite os arquivos de configuração de exemplo:

- `nginx/cheri-share.conf.example` → `/etc/nginx/sites-available/cheri-share`
  - Substitua `share.seudominio.com.br` pelo seu domínio
  - Substitua `/caminho/para/cheri-share/web/dist` pelo caminho real
  - Configure `ssl_certificate` e `ssl_certificate_key` com seus certificados Certbot

## Ciclo de vida do SFU

### 1. Gerar chaves LiveKit

Numa máquina com Docker, execute:

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
sudo cp nginx/cheri-share.conf.example /etc/nginx/sites-available/cheri-share
sudo ln -s /etc/nginx/sites-available/cheri-share /etc/nginx/sites-enabled/
sudo nginx -t  # validar sintaxe
sudo systemctl restart nginx
```

## Prova de mídia

Valide que vídeo atravessa a VPS antes de prosseguir com as próximas tarefas.

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

Exemplo de saída:

```
eyJhbGc...Zm9v
```

### Teste em duas máquinas

1. Abra navegador Firefox ou Chrome em **máquina A** (rede A):
   - Acesse https://meet.livekit.io/?tab=custom
   - Em "Server URL": `wss://share.seudominio.com.br` (o cliente LiveKit anexa `/rtc` sozinho)
   - Em "Token": cole o token gerado acima
   - Clique "Join"
   - Ative câmera: esperado vídeo local no painel esquerdo

2. Repita numa **máquina B** em rede **diferente** (use 4G, outro ISP, ou VPN de localização diferente):
   - Mesmo URL de servidor
   - **Token diferente**: rode `livekit-cli token create` de novo com **as mesmas
     chaves** (`--api-key` / `--api-secret` idênticos aos do `.env`) e só troque
     `--identity`. Gerar chaves novas com `generate-keys` produziria um par que o
     SFU não reconhece.
   - Mesmo name de sala (`teste`)
   - Identidade diferente (ex: `--identity tu` em vez de `eu`)
   - Clique "Join"

3. Confirme:
   - Vídeo de A aparece em B (painel direito)
   - Vídeo de B aparece em A (painel direito)
   - Áudio bidirecional fluindo

**Se falhar:**
- Verifique `docker compose logs livekit` na VPS
- Confirme firewall: `sudo ufw status` deve mostrar `50000:50100/udp open`
- Teste conectividade TCP: `nc -zv share.seudominio.com.br 7881`
- Teste resolução DNS: `nslookup share.seudominio.com.br`
- Confirme nginx: `sudo nginx -t` e `sudo systemctl status nginx`

**Este é o portão da fase 1.** Se mídia não fluir, não prossiga com as próximas tarefas.

## Deploy em produção

Pré-requisito: `.env` configurado e chaves de API do LiveKit definidas (ver seção "Ciclo de vida do SFU" acima).

### Construir o front e deploy

Na VPS, execute:

```bash
git pull
docker compose run --rm web-build
docker compose up -d --build
sudo nginx -t && sudo systemctl reload nginx
```

### Configuração do nginx

O nginx deve servir o front-end estático em `root /caminho/para/cheri-share/web/dist;` e fazer proxy para o token-service e LiveKit.

**Importante:** O navegador conecta em `wss://PUBLIC_HOST` (sem `/rtc`). O `livekit-client` tenta `/rtc/v1` e cai para `/rtc` num 404; o bloco do nginx precisa ser `location /rtc` (**prefixo**, pega `/rtc` e `/rtc/v1`) e encaminhar para `ws://127.0.0.1:7880`. `location = /rtc` (match exato) quebra a conexão.

Configuração:

- Substitua `/caminho/para/cheri-share/web/dist` pelo caminho real do repositório
- Configure `ssl_certificate` e `ssl_certificate_key` com seus certificados Certbot

Exemplo:

```bash
sudo cp nginx/cheri-share.conf.example /etc/nginx/sites-available/cheri-share
sudo sed -i 's|/caminho/para/cheri-share|/home/app/cheri-share|g' /etc/nginx/sites-available/cheri-share
sudo ln -s /etc/nginx/sites-available/cheri-share /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Variáveis de ambiente

O arquivo `.env` na raiz do repositório **nunca deve ser commitado**. Na VPS:

1. Copie `.env.example` para `.env`
2. Preencha as chaves de API e URL pública
3. Verifique `.gitignore` contém `.env`

## Verificação em produção

Após deploy, é **essencial** validar que o sistema funciona em condições reais de NAT traversal. Testes locais não cobrem isso.

O app tem um só fluxo: **uma tela por vez, com áudio de tela, e pedido de
takeover**. Não há câmera, microfone nem chat (spec §1). O roteiro de verificação
segue esse fluxo.

### Step 1: Fluxo completo com dois usuários em redes diferentes

Precisa de **Chrome ou Edge** nas duas pontas (só eles capturam áudio de tela) e
de duas redes **diferentes** (uma em 4G/5G, a outra em WiFi de outro ISP ou VPN).

1. Na home, usuário A clica em **Criar sala** e copia o link.
2. A entra na sala (informa o apelido na primeira vez).
3. B abre o mesmo link em outra rede e entra com outro apelido.
4. A clica em **Compartilhar minha tela**, escolhe o perfil (**Tela** ou
   **Vídeo**), marca a caixa de áudio de tela no seletor do navegador e confirma.
5. Confirme:
   - [ ] B vê a tela de A (o texto "Ninguém está compartilhando agora" some)
   - [ ] O áudio da tela de A chega em B
   - [ ] A lista de participantes mostra os dois apelidos nas duas pontas
6. B clica em **Compartilhar minha tela** → A vê "B quer compartilhar a tela.".
7. A clica em **Ceder**. Confirme:
   - [ ] A publicação troca de dono: B passa a ver "Parar de compartilhar",
         A volta a ver o seletor de perfil
   - [ ] B agora enxerga a própria tela publicada e A vê a tela de B
8. Repita o passo 6 e, desta vez, **A não responde**. Após ~30s:
   - [ ] A vez passa sozinha para B ("silêncio cede a vez", spec §6.2)
   - [ ] B começa a transmitir sem clique extra

**Se falhar:**
- Verifique `docker compose logs livekit` na VPS
- Confirme firewall: `sudo ufw status verbose` mostra `50000:50100/udp` e
  `7881/tcp` liberados e `Default: deny (incoming)`
- Teste TCP fallback: `nc -zv share.seudominio.com.br 7881`

### Step 2: Teste contingência TCP (fallback UDP)

Bloqueie temporariamente UDP para confirmar que a mídia cai para TCP:

```bash
# Na VPS
sudo ufw deny 50000:50100/udp
sudo ufw reload
```

Recarregue o navegador, tente reconectar e confirme:
- [ ] A tela compartilhada ainda passa (via fallback TCP na porta 7881)
- [ ] O áudio de tela ainda funciona (a latência pode subir um pouco)

Reabra UDP:

```bash
sudo ufw allow 50000:50100/udp
sudo ufw reload
```

**Nota:** Este teste prova que o sistema é resiliente a problemas de conectividade UDP e não depende exclusivamente de UDP para funcionar.

## Métricas

LiveKit expõe Prometheus em `http://127.0.0.1:6789/metrics`. Use para monitorar:

- `livekit_rooms_total`: número total de salas
- `livekit_participants`: participantes conectados
- `livekit_node_bytes_out`: bytes enviados (consumo de banda)

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
ponta. Captura de tela exige contexto seguro: `localhost` conta como seguro nos
navegadores baseados em Chromium.

Testes: `npm test` em cada pacote. E2E (exige a pilha completa no ar):
`cd web && npm run e2e`.

## Licença

Privado.
