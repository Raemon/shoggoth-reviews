#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const electronBinary = createRequire(import.meta.url)('electron');
const appDir = fileURLToPath(new URL('..', import.meta.url));
const given = process.argv.slice(2);
const dev = given[0] === '--dev';
const gitArgs = dev ? given.slice(1) : given;
const env = { ...process.env, ...(dev ? { REPOSCOPE_DEV: '1' } : {}) };
delete env.ELECTRON_RUN_AS_NODE;
const output = dev ? { stdio: 'inherit' } : { stdio: 'ignore', detached: true };

// `npm run` moves to the package root; INIT_CWD is where the user actually was.
const cwd = process.env.INIT_CWD ?? process.cwd();
const child = spawn(electronBinary, [appDir, '--', ...gitArgs], { cwd, env, ...output });
if (!dev) child.unref();
