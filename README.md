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

Na VPS, configure UFW para aceitar tráfego:

```bash
sudo ufw allow 7881/tcp
sudo ufw allow 50000:50100/udp
sudo ufw reload
```

Confirme:

```bash
sudo ufw status
```

Esperado: regras para `7881/tcp` e `50000:50100/udp`.

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
   - **Token diferente** (rode `docker run ... generate-keys` e `token create` de novo)
   - Mesmo name de sala (`teste`)
   - Identidade diferente (ex: `tu` em vez de `eu`)
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

**Importante:** O navegador conecta em `wss://PUBLIC_HOST` (sem `/rtc`). O `livekit-client` acrescenta automaticamente o caminho `/rtc` na requisição; o bloco `location /rtc` do nginx intercepta isso e encaminha para `ws://127.0.0.1:7880`.

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

### Step 1: Teste com dois usuários em redes diferentes

Com duas pessoas em redes **diferentes** (uma em 4G/5G, outra em WiFi de ISP diferente ou VPN):

1. Usuário A entra na sala e ativa câmera/áudio
2. Usuário B entra na mesma sala
3. Confirme:
   - [ ] Vídeo de A aparece em B
   - [ ] Vídeo de B aparece em A
   - [ ] Áudio bidirecional fluindo
   - [ ] Compartilhamento de tela funciona
   - [ ] Permissões (pedir fala, ceder) funcionam

**Se falhar:**
- Verifique `docker compose logs livekit` na VPS
- Confirme firewall: `sudo ufw status` mostra `50000:50100/udp open` e `7881/tcp open`
- Teste TCP fallback: `nc -zv share.seudominio.com.br 7881`

### Step 2: Teste contingência TCP (fallback UDP)

Bloqueie temporariamente UDP para confirmar que média cai para TCP:

```bash
# Na VPS
sudo ufw deny 50000:50100/udp
sudo ufw reload
```

Recarregue o navegador, tente reconectar e confirme:
- [ ] Vídeo ainda passa (via TCP fallback na porta 7881)
- [ ] Áudio ainda funciona (pode estar um pouco mais latent)

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

(Futuro: como rodar web/ e token-service/ em localhost com LiveKit)

## Licença

Privado.
