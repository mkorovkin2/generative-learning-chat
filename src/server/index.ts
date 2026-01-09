import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import chatRoutes from './routes/chat.js';
import { config } from '../config/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createServer() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());

  // API routes
  app.use('/api', chatRoutes);

  // Serve static files in production
  const clientPath = path.join(__dirname, '../../dist/client');
  app.use(express.static(clientPath));

  // SPA fallback
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(clientPath, 'index.html'));
    }
  });

  return app;
}

export function startServer() {
  const app = createServer();

  app.listen(config.server.port, () => {
    console.log(`Server running at http://localhost:${config.server.port}`);
  });

  return app;
}
