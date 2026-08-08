#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const args = process.argv.slice(2);
const expoHome = path.resolve(process.cwd(), '.expo');
const appRoot = path.resolve(process.cwd(), 'app');
const expoCliPath = require.resolve('expo/bin/cli');

fs.mkdirSync(expoHome, { recursive: true });

const normalizedArgs = args.filter((arg) => arg !== '--non-interactive');

const env = {
  ...process.env,
  EXPO_HOME: expoHome,
  EXPO_NO_TELEMETRY: '1',
  EXPO_ROUTER_APP_ROOT: appRoot,
  CI: process.env.CI || '1',
};

const child = spawn(process.execPath, [expoCliPath, ...normalizedArgs], {
  stdio: 'inherit',
  shell: false,
  env,
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});

child.on('error', (error) => {
  console.error(error.message);
  process.exit(1);
});
