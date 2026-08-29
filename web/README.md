# web — front do cheri-share

SPA em React + Vite + TypeScript + Tailwind. Serve a home (criar/entrar em sala)
e a sala em si: player da tela transmitida, lista de participantes, seletor de
perfil de captura, disputa da vez (pedir / ceder / silêncio cede em 30s) e o
medidor de consumo no rodapé. Conversa com o `token-service` via `/api` (proxy
do Vite em dev, nginx em produção) e com o SFU LiveKit via `livekit-client`.

- `npm run dev` — dev server na 5173 (proxy `/api` → `127.0.0.1:3000`)
- `npm test` — Vitest
- `npm run build` — checagem de tipos + build estático em `dist/`
- `npm run e2e` — Playwright (exige a pilha completa no ar)

Detalhes de arquitetura e deploy: `../README.md` e
`../docs/superpowers/specs/2026-08-28-cheri-share-design.md`.
