import { config } from './config.js';
import { criarApp } from './app.js';

const app = criarApp();
app
  .listen({ port: config.porta, host: '127.0.0.1' })
  .catch((erro) => {
    app.log.error(erro);
    process.exit(1);
  });
