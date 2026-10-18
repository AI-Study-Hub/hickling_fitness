// Creates/updates .env.local for the coach: asks for the OpenAI API key (hidden input), generates the
// token the app uses to talk to the coach server, and sets the default model. Re-run any time.
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const FILE = '.env.local';
const env = new Map();
if (existsSync(FILE)) {
  for (const line of readFileSync(FILE, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env.set(m[1], m[2]);
  }
}

function askHidden(question) {
  return new Promise((resolve) => {
    process.stdout.write(question);
    const stdin = process.stdin;
    let value = '';
    stdin.setRawMode?.(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n') {
          stdin.setRawMode?.(false);
          stdin.pause();
          stdin.off('data', onData);
          process.stdout.write('\n');
          return resolve(value.trim());
        }
        if (ch === '\u0003') process.exit(1); // Ctrl+C
        if (ch === '\u007f') value = value.slice(0, -1); // backspace
        else value += ch;
      }
    };
    stdin.on('data', onData);
  });
}

const existing = env.get('OPENAI_API_KEY');
const key = await askHidden(
  existing ? 'OpenAI API key (press Enter to keep the current one): ' : 'Paste your OpenAI API key (input is hidden): ',
);
if (key) env.set('OPENAI_API_KEY', key);
if (!env.get('OPENAI_API_KEY')) {
  console.error('No key entered. Create one at https://platform.openai.com/api-keys and run this again.');
  process.exit(1);
}
if (!env.get('EXPO_PUBLIC_COACH_TOKEN')) env.set('EXPO_PUBLIC_COACH_TOKEN', randomBytes(24).toString('hex'));
if (!env.get('COACH_MODEL')) env.set('COACH_MODEL', 'gpt-5.6-terra');

writeFileSync(FILE, [...env].map(([k, v]) => `${k}=${v}`).join('\n') + '\n', { mode: 0o600 });
console.log(`Saved ${FILE} (git-ignored). Model: ${env.get('COACH_MODEL')}.`);
console.log('Now run `npm run dev` — and restart it if it was already running.');
