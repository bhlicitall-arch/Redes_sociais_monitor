/**
 * Entrypoint para produção — inicia o servidor Express.
 * Usado pelo Render no comando `npm start`.
 */

import { startServer } from './api/server';

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
