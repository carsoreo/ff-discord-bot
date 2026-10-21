// One-time Yahoo sign-in: prints a link, then trades the code Yahoo gives you for a refresh token saved in .env.
import fs from 'node:fs';
import readline from 'node:readline/promises';
import { REDIRECT_URI, TOKEN_URL, basicAuth } from '../src/yahoo.js';

if (!process.env.YAHOO_CLIENT_ID || !process.env.YAHOO_CLIENT_SECRET) {
  throw new Error('Set YAHOO_CLIENT_ID and YAHOO_CLIENT_SECRET in .env first');
}
const link = `https://api.login.yahoo.com/oauth2/request_auth?${new URLSearchParams({
  client_id: process.env.YAHOO_CLIENT_ID, redirect_uri: REDIRECT_URI, response_type: 'code', scope: 'fspt-r', // Fantasy Sports read
})}`;
console.log(`1. Open this link and click Agree:\n\n${link}\n`);
console.log("2. You'll land on a localhost page that doesn't load. That's expected: copy its whole address.\n");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const answer = (await rl.question('3. Paste the address (or just the code) here: ')).trim();
rl.close();
const code = answer.includes('code=') ? new URL(answer).searchParams.get('code') : answer;

const res = await fetch(TOKEN_URL, {
  method: 'POST',
  headers: { Authorization: basicAuth(), 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URI }),
});
if (!res.ok) throw new Error(`Yahoo said HTTP ${res.status}: ${await res.text()}`);
const { refresh_token } = await res.json();

const env = fs.readFileSync('.env', 'utf8').replace(/^YAHOO_REFRESH_TOKEN=.*\r?\n?/m, '');
fs.writeFileSync('.env', `${env.trimEnd()}\nYAHOO_REFRESH_TOKEN=${refresh_token}\n`);
console.log('\nSaved YAHOO_REFRESH_TOKEN to .env. The bot can read your Yahoo league now.');
