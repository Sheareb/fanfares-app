#!/usr/bin/env node
const path = require('path');
const { spawn } = require('child_process');

const args = process.argv.slice(2);
const expoHome = path.resolve(process.cwd(), '.expo');
const appRoot = path.resolve(process.cwd(), 'app');
const expoCliPath = require.resolve('expo/bin/cli');

const env = {
  ...process.env,
  EXPO_HOME: expoHome,
  EXPO_NO_TELEMETRY: '1',
  EXPO_ROUTER_APP_ROOT: appRoot,
};

const child = spawn(process.execPath, [expoCliPath, ...args], {
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
