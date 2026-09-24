#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const electron = createRequire(import.meta.url)('electron');
const appDir = fileURLToPath(new URL('..', import.meta.url));
const given = process.argv.slice(2);
const dev = given[0] === '--dev';
const { ELECTRON_RUN_AS_NODE: _runAsNode, ...env } = process.env;

// `npm run` moves to the package root; INIT_CWD is where the user actually was.
const child = spawn(electron, [appDir, '--', ...(dev ? given.slice(1) : given)], {
  cwd: process.env.INIT_CWD ?? process.cwd(),
  env: dev ? { ...env, REPOSCOPE_DEV: '1' } : env,
  stdio: dev ? 'inherit' : 'ignore',
  detached: !dev,
});
if (!dev) child.unref();
