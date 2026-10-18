// Starts the coach server and Expo together. Expo keeps the terminal (QR code, keyboard shortcuts);
// coach output is printed above it, prefixed with [coach].
import { spawn } from 'node:child_process';

const coach = spawn('npx', ['tsx', 'watch', '--clear-screen=false', 'server/index.ts'], {
  stdio: ['ignore', 'pipe', 'pipe'],
});
const prefix = (stream, out) =>
  stream.on('data', (buf) => {
    for (const line of buf.toString().split('\n')) if (line.trim()) out.write(line.startsWith('[coach]') ? `${line}\n` : `[coach] ${line}\n`);
  });
prefix(coach.stdout, process.stdout);
prefix(coach.stderr, process.stderr);

const expo = spawn('npx', ['expo', 'start', ...process.argv.slice(2)], { stdio: 'inherit' });

const stop = () => {
  coach.kill('SIGTERM');
  expo.kill('SIGTERM');
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
expo.on('exit', (code) => {
  coach.kill('SIGTERM');
  process.exit(code ?? 0);
});
