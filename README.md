# Cheri-share

Sala web privada para compartilhamento de tela entre amigos, uma de cada vez. LiveKit SFU auto-hospedado em VPS Linux + serviço de token Fastify, sem banco de dados, sem login.

## Arquitetura

```
Cliente Web (navegador)
    ↓ wss://share.seudominio.com.br/rtc (proxy nginx)
Nginx (443 SSL)
    ↓ ws://127.0.0.1:7880 (upgrade WebSocket)
LiveKit SFU (7880 signalling)
    ↓ UDP 50000–50100 (media)
Internet pública
```

## Puertos

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
   - Em "Server URL": `wss://share.seudominio.com.br/rtc`
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

## Métricas

LiveKit expõe Prometheus em `http://127.0.0.1:6789/metrics`. Use para monitorar:

- `livekit_rooms_total`: número total de salas
- `livekit_participants`: participantes conectados
- `livekit_node_bytes_out`: bytes enviados (consumo de banda)

## Desenvolvimento local

(Futuro: como rodar web/ e token-service/ em localhost com LiveKit)

## Licença

Privado.
