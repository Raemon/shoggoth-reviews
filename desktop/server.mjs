import { createServer } from 'node:http';
import next from 'next';

export const SECRET_HEADER = 'x-reposcope-desktop';
// localStorage belongs to the origin, so a new port each launch would forget sign-in.
const PREFERRED_PORT = 47211;

// Browser pages can reach loopback ports; only this app's windows attach the secret.
export async function startServer({ dir, dev, secret }) {
  process.env.REPOSCOPE_DESKTOP = '1';
  const server = createServer();
  const port = await listen(server);
  const app = next({ dev, dir, hostname: '127.0.0.1', port });
  await app.prepare();
  const handle = app.getRequestHandler();
  server.on('request', (request, response) => {
    if (request.headers[SECRET_HEADER] === secret) void handle(request, response);
    else refuse(response);
  });
  return `http://127.0.0.1:${port}`;
}

async function listen(server) {
  return listenOn(server, PREFERRED_PORT).catch(() => listenOn(server, 0));
}

function listenOn(server, port) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      server.off('error', reject);
      resolve(server.address().port);
    });
  });
}

function refuse(response) {
  response.writeHead(403, { 'Content-Type': 'text/plain' });
  response.end('reposcope desktop only answers its own windows\n');
}
