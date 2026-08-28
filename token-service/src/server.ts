import { config } from './config.js';
import { criarApp } from './app.js';
import { iniciarColeta } from './usage/coletor.js';

const app = criarApp();

iniciarColeta((m) => app.log.warn(m))
  .then(() =>
    app.listen({ port: config.porta, host: '127.0.0.1' }),
  )
  .catch((erro) => {
    app.log.error(erro);
    process.exit(1);
  });
