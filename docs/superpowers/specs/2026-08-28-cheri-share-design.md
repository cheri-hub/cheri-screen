# cheri-share — Design

**Data:** 2026-08-28
**Status:** Aprovado para planejamento
**Escopo:** Sala web privada para um grupo de amigos compartilhar e assistir tela ao vivo, hospedada em VPS própria.

---

## 1. Objetivo

Uma página onde uma pessoa cria uma sala, manda o link para os amigos, e compartilha a tela (com áudio) ao vivo. Uma tela por vez; quem quiser assumir pede a vez a quem está transmitindo.

**Não faz parte do escopo:** voz por microfone, câmera, chat de texto, gravação, login/contas, histórico de sessões.

## 2. Decisões tomadas e por quê

| Decisão | Motivo |
|---|---|
| **SFU (LiveKit) em vez de P2P** | No mesh, quem compartilha envia uma cópia para cada espectador: com 9 pessoas e o perfil de vídeo da seção 8, seriam ~7 Mbps de upload doméstico contínuo, e o custo cresce a cada pessoa que entra. O SFU fixa esse número em ~800 kbps independente da audiência, migrando o custo para a banda da VPS — que é onde há banda sobrando. Vale registrar que, com o perfil 720p adotado, a margem é menor do que seria em 1080p: em fibra o mesh até funcionaria, mas saturaria links mais fracos e degradaria a cada participante novo. |
| **Sem autenticação** | Decisão explícita do usuário. O UUID da sala é a única credencial. |
| **Sem banco de dados** | O LiveKit já mantém salas, participantes e metadata. Adicionar um banco traria migrations e backup sem resolver nenhum problema atual. |
| **Uma tela por vez, aplicada pelo SFU** | Tokens nascem com `canPublish: false`; a permissão é ligada só para quem tem a vez. Torna a regra um invariante real, não uma convenção da UI. |
| **LiveKit em vez de Jitsi** | O comportamento pedido (uma tela por vez + pedido de takeover) não existe no Jitsi; customizar o front dele custa mais que escrever o próprio. Jitsi também é pesado para 2 vCPU/4GB. |
| **Contingência TCP na 7881, sem TURN/TLS na 443** | O LiveKit aceita mídia por TCP na 7881 quando o UDP está bloqueado, o que cobre a maioria das redes restritivas sem disputar a 443 com o nginx que já funciona na VPS. O TURN embutido fica desabilitado. |
| **VP9 como codec padrão, AV1 opcional** | ~35% menos banda que VP8/H264 na mesma qualidade. O SFU não recodifica, então o custo de encoding recai na máquina de quem compartilha, não na VPS — é redução de tráfego sem contrapartida no servidor. AV1 economiza mais ~25%, mas pode pesar em máquina antiga; fica como opção ligável. |
| **720p como padrão, não 1080p** | Resolução é o maior fator isolado no consumo mensal: 720p corta pela metade, com perda perceptual pequena em laptop. A franquia mensal da VPS é a restrição real do projeto. |
| **Sem simulcast; SVC quando disponível** | A recomendação padrão do LiveKit não se aplica aqui: simulcast faz o transmissor subir 2–3 versões simultâneas (~40% mais uplink) e só compensa quando os espectadores assistem em tamanhos diferentes. Neste app **todos assistem em tela cheia**, então seria custo sem benefício. O VP9/AV1 já oferecem camadas temporais via SVC com uma codificação só. |
| **`adaptiveStream` e `dynacast` ligados** | Reduzem ou pausam o envio para quem está com a aba em segundo plano e param camadas que ninguém consome. Numa sessão de amigos, onde as pessoas alternam de janela o tempo todo, isso corta cerca de um terço do tráfego real. Custo: duas flags. |

## 3. Restrições conhecidas

- **Áudio de tela só no Chrome/Edge.** Firefox captura apenas áudio de aba; Safari não captura áudio nenhum em `getDisplayMedia`. Usuários de Safari veem imagem sem som. Sem contorno possível — a UI avisa antes de compartilhar.
- **HTTPS obrigatório.** Sem contexto seguro o navegador não oferece captura de tela. Já resolvido: a VPS tem domínio e HTTPS.
- **Franquia mensal de tráfego é a restrição dimensionante do projeto.** VPS de referência: ~1 TB/mês, dos quais assumimos ~800 GB disponíveis (a VPS hospeda outros serviços). Todo o perfil de captura da seção 8 foi escolhido em função disso.
- **Consumo esperado.** Ver seção 8: ~1,9 GB/h no modo tela e ~2,3 GB/h no modo vídeo com 9 espectadores, o que dá **110–130 sessões de 3h por mês** dentro da franquia. Números são estimativas: tela parada consome muito menos, filme em movimento constante fica perto do teto.
- **Uma instância do token-service.** O estado da vez é manipulado em memória durante a requisição; o desenho não escala horizontalmente. Adequado à VPS; documentado para não virar armadilha.
- **Reinício do LiveKit derruba salas ativas.** Consequência aceita de não ter banco.
- **VPS de referência:** 2 vCPU / 4 GB.

## 4. Arquitetura

```
Navegador ──HTTPS──> nginx (já existe)
                       ├── /       → web/ (estáticos)
                       ├── /api/   → token-service :3000
                       └── /rtc    → livekit-server :7880 (WebSocket)

Navegador ──UDP 50000-50100──> livekit-server   (mídia)
Navegador ──TCP 7881─────────> livekit-server   (contingência)
```

### 4.1 Componentes

**`web/` — React + Vite + TypeScript + Tailwind.** Mesma stack de `cheri-hub-home`. Build estático servido pelo nginx.

Telas:
- **Capa** — criar sala, ou entrar por link.
- **Sala** — player principal, lista de participantes, botão de compartilhar/parar, modais de pedido de vez, rodapé com o medidor de consumo.
- **Seletor de perfil** — aparece ao clicar em compartilhar: "tela" ou "vídeo", com 1080p como opção (seção 8.1).
- **Modal de apelido** — na primeira entrada; persistido em `localStorage`.
- **Sala expirada** — estado terminal com botão de criar nova.

**`token-service/` — Fastify + TypeScript.** Único componente que conhece o segredo do LiveKit.

| Rota | Responsabilidade |
|---|---|
| `POST /rooms` | Cria a sala no LiveKit (`empty_timeout: 300s`), devolve o UUID v4 |
| `POST /rooms/:id/token` | Verifica existência da sala; assina JWT com `canSubscribe: true`, `canPublish: false` |
| `POST /rooms/:id/floor/request` | Pede a vez de compartilhar |
| `POST /rooms/:id/floor/answer` | Resposta de quem detém a vez |
| `POST /rooms/:id/floor/release` | Libera a vez (parou de compartilhar) |
| `GET /usage` | Consumo da sessão e acumulado do mês (seção 8.4) |

**`livekit-server`** — imagem oficial. SFU, sem código próprio. Traz TURN embutido, que fica **desabilitado**: a contingência para redes que bloqueiam UDP é o ICE sobre TCP na 7881.

**nginx** — o que já existe na VPS, com um `server` novo para o subdomínio.

### 4.2 Sem banco de dados

Nenhum estado de domínio é persistido. A única exceção é o contador de consumo da seção 8.4 — um arquivo JSON com dois inteiros, descartável sem consequência.

Fonte da verdade = estado do LiveKit:
- **Salas existentes** → `RoomService.listRooms()`
- **Quem está online** → `RoomService.listParticipants()`
- **Quem tem a vez** → metadata da sala (replicada automaticamente a todos os participantes)
- **Expiração** → `empty_timeout` de 5 minutos após esvaziar

## 5. Fluxo de sala

**Criar:** clique em "Criar sala" → `POST /rooms` → redireciona para `/sala/<uuid>` com botão de copiar link.

**Entrar:** abre o link → pede apelido (só na primeira vez; `localStorage`) → `POST /rooms/:id/token` → 404 leva à tela de sala expirada; sucesso conecta ao LiveKit.

**Identidade.** Sem login, cada navegador gera um UUID próprio na primeira visita e o guarda em `localStorage`. Esse UUID é o `identity` do participante no LiveKit e é a chave usada por todo o controle de vez — o apelido, por ser editável e não único, nunca serve como identificador. Consequência: limpar os dados do navegador cria uma identidade nova, e a mesma pessoa em dois dispositivos conta como dois participantes.

O apelido é cosmético: serve à lista de participantes e ao texto do pedido de vez. Não há identidade real, coerente com a ausência de login.

## 6. Controle de vez

### 6.1 Estado

Guardado na metadata da sala, propagado pelo LiveKit a todos os participantes:

```ts
type EstadoDaVez = {
  sharer: { identity: string; nome: string; desde: number } | null;
  pending: { solicitante: string; nome: string; expiraEm: number } | null;
};
```

Como a metadata chega sozinha em todos os navegadores, a UI de todos reage no mesmo instante e quem entra no meio já vê o estado correto — sem código de sincronização adicional.

### 6.2 Fluxo

1. Pedro clica em "Compartilhar" → `POST /floor/request`.
2. **Sala livre** (ou quem tinha a vez não está mais entre os participantes) → concede imediatamente.
3. **Sala ocupada por Ana** → grava `pending` (expira em 30s) e responde `aguardando`. A metadata propaga: Ana vê modal "Ceder / Recusar", Pedro vê "aguardando Ana", os demais veem aviso discreto.
4. Ana responde via `POST /floor/answer`:
   - **aceita** → a vez passa a Pedro; o navegador da Ana para de publicar, o de Pedro chama `getDisplayMedia`;
   - **recusa** → `pending` some, Pedro é avisado.
5. **Sem resposta em 30s** → a vez passa a Pedro automaticamente.

**Política do passo 5 — "silêncio cede a vez".** A falha mais provável é a pessoa ter se ausentado com a tela congelada; "silêncio recusa" travaria a sala sem ninguém para destravar. O pedido é visível a todos, então o custo social regula o abuso. É uma constante no código — reversível.

**Pedidos simultâneos:** havendo `pending` ativo, o segundo pedido recebe `ocupado` ("tem alguém na fila"). Sem fila, sem locks distribuídos.

**Expiração preguiçosa:** o servidor não mantém timers. `pending` vencido é avaliado na próxima requisição. O front do solicitante mantém timer local de 30s e reenvia o pedido ao estourar.

### 6.3 Aplicação da regra pelo SFU

O token de entrada nasce com `canPublish: false` para todos. Ao conceder a vez, o servidor chama `updateParticipant` ligando `canPublish` para o novo dono e desligando para o anterior. "Uma tela por vez" passa a ser aplicado pelo SFU, não pela interface — nem o DevTools contorna.

### 6.4 Casos de borda

| Situação | Comportamento |
|---|---|
| Quem compartilha fecha a aba ou cai | O front deriva "ninguém compartilhando" pela ausência na lista de participantes; a vez é liberada na próxima requisição |
| Para pela barra nativa do Chrome | Front detecta fim da track → `POST /floor/release` |
| Todos saem | Sala expira em 5 min; o link morre |
| Reconexão de rede | LiveKit reconecta; a UI se refaz a partir da metadata |
| Alguém entra no meio | Já vê a transmissão em andamento |
| Resposta vinda de quem não tem a vez | 403 |

## 7. Erros visíveis ao usuário

Em português, sem jargão, cada um com tratamento próprio:

- **Sala expirada / inexistente** — tela dedicada com botão de criar nova sala.
- **Permissão de tela negada** — mensagem clara; a vez volta a ficar livre.
- **Navegador sem áudio de tela** — aviso *antes* de compartilhar, não depois.
- **Conexão instável** — faixa de "reconectando" sem derrubar a sessão.
- **Serviço indisponível** — token-service ou LiveKit fora do ar.

## 8. Qualidade de vídeo e consumo de banda

Esta seção existe porque a franquia mensal da VPS é a restrição dimensionante do projeto (seção 3).

### 8.1 Dois perfis de captura

"Assistir filme junto" e "olhar a tela de alguém" são problemas de compressão opostos. Detecção automática de tipo de conteúdo não é confiável, então **a escolha é manual**: antes de compartilhar, a pessoa seleciona o perfil.

| Perfil | Resolução / FPS | `contentHint` | Bitrate alvo |
|---|---|---|---|
| **Tela** (código, navegar) — padrão | 720p / 15fps | `detail` | ~500 kbps |
| **Vídeo** (filme, jogo) | 720p / 30fps | `motion` | ~800 kbps |

O `contentHint` não é detalhe cosmético: ele diz ao encoder se deve preservar nitidez de texto ou fluidez de movimento. Errado, produz texto borrado ou vídeo aos trancos.

**1080p fica disponível num botão** para quando a nitidez importar de verdade, ao custo de dobrar o consumo. Todos os valores são configuráveis por variável de ambiente.

### 8.2 Codec

**VP9 como padrão**, com SVC (camadas temporais numa codificação só). **AV1 como opção ligável** por quem tem máquina recente — economiza mais ~25%, mas o encoding pesa no computador de quem compartilha. **Simulcast desligado** (justificativa na seção 2).

### 8.3 Estimativas com 9 espectadores

| Configuração | GB/hora | Sessão de 3h | Sessões/mês em 800 GB |
|---|---|---|---|
| Modo tela (720p15, VP9) | ~1,9 GB | ~6 GB | ~130 |
| Modo vídeo (720p30, VP9) | ~2,3 GB | ~7 GB | ~110 |
| Modo vídeo em 1080p30 | ~4,4 GB | ~14 GB | ~57 |

Já incluem o desconto de ~30% do `adaptiveStream`. São estimativas de conteúdo em movimento contínuo: tela parada consome uma fração disso.

### 8.4 Medidor de consumo

O LiveKit expõe métricas Prometheus com bytes transmitidos. O token-service as lê periodicamente e mantém um total mensal num **arquivo JSON** em volume Docker. A página mostra no rodapé: `essa sessão: 3,2 GB · mês: 180 GB`.

A justificativa é comportamental antes de técnica: ver o número muda como o grupo usa a ferramenta mais do que qualquer limite automático faria.

**Isto contraria parcialmente a decisão "sem persistência" da seção 4.2** e a contradição é deliberada. O que se está guardando é um contador — dois inteiros e um mês de referência — não um modelo de dados. Perder o arquivo custa o histórico do mês corrente e nada mais; não há migration, backup nem integridade referencial envolvidos. Se o arquivo sumir, o contador recomeça do zero e o sistema segue funcionando.

**Não incluído deliberadamente:** guarda de sessão esquecida (avisar e encerrar transmissão após 2h contínuas). É o cenário que mais desperdiça franquia — alguém compartilha e sai, queimando GB sem audiência — mas ficou de fora a pedido, na avaliação de que a margem do perfil 720p é suficiente. Se um mês vier com consumo inexplicado, este é o primeiro suspeito.

## 9. Deploy

### 9.1 Estrutura

```
cheri-share/
├── web/
├── token-service/
├── livekit/livekit.yaml
├── nginx/cheri-share.conf.example
├── docker-compose.yml
├── .env.example
└── docs/superpowers/specs/
```

### 9.2 Portas

| Porta | Protocolo | Exposição | Finalidade |
|---|---|---|---|
| 7880 | TCP | localhost | Sinalização WebSocket (proxy do nginx) |
| 7881 | TCP | pública | Contingência quando UDP está bloqueado |
| 50000–50100 | UDP | pública | Mídia |
| 6789 | TCP | localhost | Métricas Prometheus do LiveKit, lidas pelo token-service (seção 8.4) |

### 9.3 nginx

Um `server` novo para o subdomínio: `/` serve os estáticos, `/api/` faz proxy para o token-service, `/rtc` faz upgrade WebSocket para o LiveKit com `proxy_read_timeout` alto (WebSocket cortado por timeout é a falha clássica).

### 9.4 Segredos e operação

`LIVEKIT_API_KEY` e `LIVEKIT_API_SECRET` em `.env` fora do git; apenas `.env.example` versionado. Containers com `restart: unless-stopped` e healthcheck. Deploy: `git pull && docker compose up -d --build`.

O contador de consumo vive num **volume Docker nomeado** montado no token-service — é o único dado que sobrevive a um `docker compose down`. Perdê-lo custa apenas o histórico do mês corrente.

Variáveis de ambiente que controlam qualidade e consumo: resolução e FPS de cada perfil, bitrate alvo, codec padrão (`vp9` | `av1`) e o teto opcional de 1080p.

## 10. Testes

Mídia real não é automatizável. A estratégia isola a lógica que tem regra de negócio e verifica o resto manualmente.

**Unitários (Vitest) — o núcleo.** O controle de vez é uma **função pura**: `decidir(estado, participantes, agora, evento) → { novoEstado, decisão }`. Sem rede, sem relógio, sem LiveKit. Casos: sala livre; sala ocupada; `pending` ativo; `pending` expirado; dono da vez ausente da sala; resposta de quem não detém a vez; release por quem não detém a vez.

**Unitários — o acumulador de consumo.** Também função pura: `acumular(contadorAtual, leituraDeMétricas, agora) → novoContador`. Casos: primeira leitura; leitura crescente; **virada de mês** (zera o acumulado); **reinício do LiveKit** (contador Prometheus volta a zero e não pode ser lido como consumo negativo nem como salto gigante); arquivo ausente ou corrompido.

**Integração.** Rotas do Fastify com o cliente LiveKit mockado: sala inexistente → 404; token assinado com `canPublish: false`; concessão da vez chama `updateParticipant` para ambos os lados; `GET /usage` responde mesmo sem arquivo de contador.

**E2E (Playwright).** Duas abas Chrome com captura falsa (`--auto-select-desktop-capture-source`): Ana compartilha → Pedro pede → Ana cede → a publicação troca de dono. Apenas Chrome, que é o alvo real.

**Manual, uma vez.** Duas pessoas em redes distintas (uma em 4G), provando a travessia de NAT — nenhum teste local cobre isso.

## 11. Ordem de construção

1. **Infra** — LiveKit + nginx + página que só conecta. Prova que vídeo atravessa a VPS. *Fase de maior risco, deliberadamente primeiro.*
2. **Salas** — token-service, criar/entrar, tela de sala expirada.
3. **Transmissão** — compartilhar e assistir, um transmissor, sem disputa. Já com os perfis, VP9, `adaptiveStream` e `dynacast` — são configuração de publicação, não polimento, e refazer depois significaria revalidar qualidade e consumo do zero.
4. **Controle de vez** — fluxo de takeover completo.
5. **Acabamento** — telas de erro, avisos de navegador, medidor de consumo, opção de AV1 e de 1080p.

Se a fase 1 falhar (por exemplo, o provedor bloqueando UDP), o problema aparece no primeiro dia e não depois de duas semanas de front pronto.

## 12. Pontos de extensão previstos

- **Autenticação**, se um dia for desejada: o único ponto a mexer é `POST /rooms/:id/token`.
- **Voz, câmera ou chat**: o LiveKit já suporta; exigiria rever o layout e as permissões de publicação.
- **Vários transmissores simultâneos**: exigiria substituir o controle de vez por um layout em grade e revisar a conta de banda.
- **Guarda de sessão esquecida** (seção 8.4): deliberadamente fora do escopo inicial. Se o medidor apontar um mês com consumo inexplicado, é a primeira coisa a acrescentar.
- **Alerta de teto mensal**: o medidor já traz os dados; faltaria só o limiar e o aviso na página.
