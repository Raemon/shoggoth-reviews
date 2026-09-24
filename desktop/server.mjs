import { createServer } from 'node:http';
import next from 'next';

export const SECRET_HEADER = 'x-reposcope-desktop';

// Any page in the user's browser can reach a loopback port, so every request must carry
// the secret that only this app's windows attach (see signRequests in main.mjs).
export async function startServer({ dir, dev, secret }) {
  process.env.REPOSCOPE_DESKTOP = '1';
  const server = createServer();
  const port = await listen(server);
  const app = next({ dev, dir, hostname: '127.0.0.1', port, httpServer: server });
  await app.prepare();
  const handle = app.getRequestHandler();
  server.on('request', (request, response) => {
    if (request.headers[SECRET_HEADER] === secret) void handle(request, response);
    else refuse(response);
  });
  return `http://127.0.0.1:${port}`;
}

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}

function refuse(response) {
  response.writeHead(403, { 'Content-Type': 'text/plain' });
  response.end('reposcope desktop only answers its own windows\n');
}
