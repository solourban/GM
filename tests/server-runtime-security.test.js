const assert = require('assert');
const { spawn } = require('child_process');

const port = 32_000 + (process.pid % 10_000);
const baseUrl = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, ['src/server.js'], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    PORT: String(port),
    RATE_LIMIT_MAX: '5',
    DATE_RATE_LIMIT_MAX: '5',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let childOutput = '';
child.stdout.on('data', (chunk) => { childOutput += chunk; });
child.stderr.on('data', (chunk) => { childOutput += chunk; });

async function waitUntilReady() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`server exited early:\n${childOutput}`);
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
    } catch (_) {
      // The child process may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`server did not become ready:\n${childOutput}`);
}

async function request(path, options = {}) {
  return fetch(`${baseUrl}${path}`, options);
}

async function run() {
  try {
    await waitUntilReady();

    const home = await request('/');
    assert.equal(home.status, 200);
    assert.equal(home.headers.get('x-powered-by'), null, 'Express signature header must be disabled');
    assert.equal(home.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(home.headers.get('x-frame-options'), 'DENY');

    const oversizedRequestId = 'a'.repeat(200);
    const requestIdResponse = await request('/api/courts', {
      headers: { 'X-Request-Id': oversizedRequestId },
    });
    const safeId = requestIdResponse.headers.get('x-request-id');
    assert.notEqual(safeId, oversizedRequestId, 'oversized request id must not be reflected');
    assert.match(safeId, /^req_[a-z0-9]+_[a-z0-9]+$/);

    const invalidFetch = await request('/api/fetch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jiwonNm: [], saYear: {}, saSer: [] }),
    });
    assert.equal(invalidFetch.status, 400);
    assert.equal((await invalidFetch.json()).ok, false);

    const statuses = [];
    for (let index = 0; index < 6; index += 1) {
      const response = await request('/api/courts', {
        headers: {
          // The left-most address is attacker-controlled. The right-most value
          // represents the address appended by Railway's one trusted proxy hop.
          'X-Forwarded-For': `198.51.100.${index + 1}, 203.0.113.50`,
        },
      });
      statuses.push(response.status);
    }
    assert.deepEqual(statuses, [200, 200, 200, 200, 200, 429]);

    console.log('Server runtime security regression passed.');
  } finally {
    child.kill('SIGTERM');
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
