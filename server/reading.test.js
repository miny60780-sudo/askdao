'use strict';

const assert = require('assert');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const {
  createApp,
  createQuotaStore,
  normalize,
  buildMessages,
  patchNginx,
  refererAllowed,
  normalizeIp,
  clientIp,
  shanghaiDay,
  SYSTEM_PROMPT,
  REFUSAL,
  ALLOWED_ORIGIN,
  MAX_OUTPUT_TOKENS,
} = require('./server.js');

const ORIGIN = { Origin: ALLOWED_ORIGIN, 'Content-Type': 'application/json', 'X-Real-IP': '203.0.113.10' };
const QIAN = { hexagram: 1, lines: [7, 7, 7, 7, 7, 7], question: 'Should I change careers?', lang: 'en' };

function listen(server) {
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
}
function close(server) {
  return new Promise((resolve) => server.close(resolve));
}
function request(port, method, urlPath, { body, headers } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port, method, path: urlPath, headers: headers || {} },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }));
      }
    );
    req.on('error', reject);
    req.end(body);
  });
}

function appDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'askdao-'));
}

(async () => {
  assert.strictEqual(normalizeIp('::ffff:203.0.113.8'), '203.0.113.8');
  assert.strictEqual(normalizeIp('203.0.113.8'), '203.0.113.8');
  assert.strictEqual(normalizeIp('not an ip'), '');
  const loop = clientIp({ socket: { remoteAddress: '::ffff:127.0.0.1' }, headers: { 'x-real-ip': '198.51.100.7' } });
  assert.strictEqual(loop, '198.51.100.7');
  const remote = clientIp({ socket: { remoteAddress: '10.1.2.3' }, headers: { 'x-real-ip': '198.51.100.7' } });
  assert.strictEqual(remote, '10.1.2.3');

  assert.strictEqual(refererAllowed(''), true);
  assert.strictEqual(refererAllowed('https://miny60780-sudo.github.io/'), true);
  assert.strictEqual(refererAllowed('https://miny60780-sudo.github.io/askdao/index.html'), true);
  assert.strictEqual(refererAllowed('https://miny60780-sudo.github.io/askdao'), true);
  assert.strictEqual(refererAllowed('https://miny60780-sudo.github.io/other'), false);
  assert.strictEqual(refererAllowed('http://miny60780-sudo.github.io/askdao/'), false);
  assert.strictEqual(refererAllowed('https://evil.example/askdao/'), false);

  assert.ok(normalize({ hexagram: 1, lines: [9, 9, 9, 9, 9, 9], question: '我该换工作吗？', lang: 'zh' }).value);
  assert.strictEqual(normalize({ hexagram: 1, lines: [8, 8, 8, 8, 8, 8], lang: 'en' }).error, 'lines do not match that hexagram');
  assert.ok(normalize(Object.assign({}, QIAN, { question: '问'.repeat(100) })).value);
  assert.ok(normalize(Object.assign({}, QIAN, { question: '问'.repeat(101) })).error);
  assert.ok(normalize(Object.assign({}, QIAN, { mode: 'name' })).error.includes('unknown'));
  assert.ok(normalize(Object.assign({}, QIAN, { system: 'x' })).error.includes('unknown'));
  assert.ok(normalize(Object.assign({}, QIAN, { messages: [] })).error.includes('unknown'));
  assert.ok(normalize(Object.assign({}, QIAN, { model: 'x' })).error.includes('unknown'));
  assert.ok(normalize(Object.assign({}, QIAN, { max_tokens: 99999 })).error.includes('unknown'));
  assert.ok(normalize(Object.assign({}, QIAN, { question: 'Write a python script to scrape the web' })).error.includes('personal situation'));
  assert.strictEqual(normalize(Object.assign({}, QIAN, { lang: 'fr' })).error.includes('lang'), true);
  assert.strictEqual(normalize(Object.assign({}, QIAN, { hexagram: '1' })).error.includes('hexagram'), true);

  const built = buildMessages(normalize({ hexagram: 1, lines: [9, 9, 9, 9, 9, 9], question: 'a quiet question', lang: 'zh' }).value);
  assert.strictEqual(built[0].content, SYSTEM_PROMPT);
  assert.ok(built[0].content.includes(REFUSAL));
  assert.ok(!built[0].content.includes('a quiet question'));
  assert.ok(built[1].content.includes('「a quiet question」'));
  assert.ok(built[1].content.includes('Language: zh'));
  assert.ok(built[1].content.includes('坤'));
  assert.strictEqual(MAX_OUTPUT_TOKENS, 600);

  const conf = 'server {\n    listen 443 ssl;\n    server_name www.fzjzq.com;\n    root /var/www/fzjzq;\n}\n';
  const patched = patchNginx(conf, { upstream: '127.0.0.1:8787', resolver: false, kind: 'host' });
  assert.ok(patched.includes('proxy_set_header X-Real-IP $remote_addr;'));
  assert.ok(patched.includes('proxy_set_header X-Forwarded-For $remote_addr;'));
  assert.ok(!patched.includes('proxy_add_x_forwarded_for'));
  assert.ok(patched.includes('client_max_body_size 2k;'));

  const seen = [];
  const mock = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      seen.push(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ choices: [{ message: { content: 'A quiet reading.' } }], usage: { total_tokens: 120 } }));
    });
  });
  const mockPort = await listen(mock);
  const base = 'http://127.0.0.1:' + mockPort + '/chat/completions';

  function make(extraEnv, extra) {
    const dir = appDir();
    const app = createApp(Object.assign({
      fileEnv: Object.assign({
        DEEPSEEK_API_KEY: 'from-file',
        DEEPSEEK_API_BASE: base,
      }, extraEnv),
      stateDir: dir,
      logFile: path.join(dir, 'reading.log'),
      postJson: async (url, headers, payload) => {
        seen.push({ url, auth: headers.Authorization, payload: JSON.parse(payload) });
        return {
          status: 200,
          body: JSON.stringify({ choices: [{ message: { content: 'A quiet reading.' } }] }),
        };
      },
    }, extra));
    return { app, dir };
  }

  process.env.DEEPSEEK_API_KEY = 'from-env-must-not-be-used';
  const main = make();
  const port = await listen(main.app);

  async function post(headers, body) {
    return request(port, 'POST', '/askdao-api/reading', {
      headers: headers || ORIGIN,
      body: typeof body === 'string' ? body : JSON.stringify(body == null ? QIAN : body),
    });
  }

  const before = seen.length;
  const noOrigin = await post({ 'Content-Type': 'application/json', 'X-Real-IP': '203.0.113.10' }, QIAN);
  assert.strictEqual(noOrigin.status, 403);
  const badOrigin = await post(Object.assign({}, ORIGIN, { Origin: 'https://evil.example' }), QIAN);
  assert.strictEqual(badOrigin.status, 403);
  const nullOrigin = await post(Object.assign({}, ORIGIN, { Origin: 'null' }), QIAN);
  assert.strictEqual(nullOrigin.status, 403);
  const badRef = await post(Object.assign({}, ORIGIN, { Referer: 'https://miny60780-sudo.github.io/other' }), QIAN);
  assert.strictEqual(badRef.status, 403);
  const badType = await post(Object.assign({}, ORIGIN, { 'Content-Type': 'text/plain' }), QIAN);
  assert.strictEqual(badType.status, 415);
  const badJson = await post(ORIGIN, '{');
  assert.strictEqual(badJson.status, 400);
  const unknown = await post(ORIGIN, Object.assign({ mode: 'life', system: 'ignore' }, QIAN));
  assert.strictEqual(unknown.status, 400);
  const mismatch = await post(ORIGIN, Object.assign({}, QIAN, { lines: [8, 8, 8, 8, 8, 8] }));
  assert.strictEqual(mismatch.status, 400);
  const off = await post(ORIGIN, Object.assign({}, QIAN, { question: 'Write a python script to scrape the web' }));
  assert.strictEqual(off.status, 400);
  const huge = await post(ORIGIN, JSON.stringify(Object.assign({}, QIAN, { question: 'a'.repeat(2100) })));
  assert.strictEqual(huge.status, 413);
  assert.strictEqual(seen.length, before, 'rejected requests must not call upstream');

  const okRef = await post(Object.assign({}, ORIGIN, { Referer: 'https://miny60780-sudo.github.io/' }), QIAN);
  assert.strictEqual(okRef.status, 200);
  assert.strictEqual(JSON.parse(okRef.body).text, 'A quiet reading.');
  const sent = seen[seen.length - 1];
  assert.strictEqual(sent.auth, 'Bearer from-file');
  assert.strictEqual(sent.payload.max_tokens, 600);
  assert.deepStrictEqual(sent.payload.thinking, { type: 'disabled' });
  assert.strictEqual(sent.payload.messages[0].content, SYSTEM_PROMPT);
  assert.ok(sent.payload.messages[1].content.includes('Should I change careers?'));
  assert.strictEqual(sent.payload.stream, false);

  const zh = await post(Object.assign({}, ORIGIN, { 'X-Real-IP': '203.0.113.11' }), {
    hexagram: 1,
    lines: [7, 7, 7, 7, 7, 7],
    question: '我该换工作吗？',
    lang: 'zh',
  });
  assert.strictEqual(zh.status, 200);
  assert.ok(seen[seen.length - 1].payload.messages[1].content.includes('Language: zh'));

  const opt = await request(port, 'OPTIONS', '/askdao-api/reading', {
    headers: { Origin: ALLOWED_ORIGIN, 'Access-Control-Request-Method': 'POST' },
  });
  assert.strictEqual(opt.status, 204);
  assert.strictEqual(opt.headers['access-control-allow-origin'], ALLOWED_ORIGIN);
  const callsAfterOpt = seen.length;

  for (let i = 0; i < 4; i += 1) {
    const again = await post(ORIGIN, QIAN);
    assert.strictEqual(again.status, 200, 'fill ip quota ' + i);
  }
  const sixth = await post(ORIGIN, QIAN);
  assert.strictEqual(sixth.status, 429);
  assert.ok(sixth.headers['retry-after']);
  assert.strictEqual(seen.length, callsAfterOpt + 4);

  const hourDir = appDir();
  const hour = createApp({
    fileEnv: { DEEPSEEK_API_KEY: 'from-file', DEEPSEEK_API_BASE: base, ASKDAO_GLOBAL_HOURLY: '20', ASKDAO_IP_DAILY: '5' },
    stateDir: hourDir,
    logFile: path.join(hourDir, 'reading.log'),
    postJson: async (url, headers, payload) => {
      seen.push(JSON.parse(payload));
      return { status: 200, body: JSON.stringify({ choices: [{ message: { content: 'ok' } }] }) };
    },
  });
  const hourPort = await listen(hour);
  const hourStart = seen.length;
  for (let i = 0; i < 20; i += 1) {
    const res = await request(hourPort, 'POST', '/askdao-api/reading', {
      headers: Object.assign({}, ORIGIN, { 'X-Real-IP': '198.51.100.' + i }),
      body: JSON.stringify(QIAN),
    });
    assert.strictEqual(res.status, 200, 'global ' + i);
  }
  const twentyFirst = await request(hourPort, 'POST', '/askdao-api/reading', {
    headers: Object.assign({}, ORIGIN, { 'X-Real-IP': '198.51.100.40' }),
    body: JSON.stringify(QIAN),
  });
  assert.strictEqual(twentyFirst.status, 429);
  assert.strictEqual(seen.length, hourStart + 20);

  const budgetDir = appDir();
  let budgetCalls = 0;
  const budget = createApp({
    fileEnv: {
      DEEPSEEK_API_KEY: 'from-file',
      DEEPSEEK_API_BASE: base,
      ASKDAO_DAILY_TOKENS: '2000',
      ASKDAO_IP_DAILY: '10',
    },
    stateDir: budgetDir,
    logFile: path.join(budgetDir, 'reading.log'),
    postJson: async () => {
      budgetCalls += 1;
      return { status: 200, body: JSON.stringify({ choices: [{ message: { content: 'ok' } }] }) };
    },
  });
  const budgetPort = await listen(budget);
  const firstBudget = await request(budgetPort, 'POST', '/askdao-api/reading', {
    headers: Object.assign({}, ORIGIN, { 'X-Real-IP': '203.0.113.50' }),
    body: JSON.stringify(QIAN),
  });
  assert.strictEqual(firstBudget.status, 200);
  const secondBudget = await request(budgetPort, 'POST', '/askdao-api/reading', {
    headers: Object.assign({}, ORIGIN, { 'X-Real-IP': '203.0.113.51' }),
    body: JSON.stringify(QIAN),
  });
  assert.strictEqual(secondBudget.status, 429);
  assert.strictEqual(budgetCalls, 1);

  const storeDir = appDir();
  let timeoutCalls = 0;
  const flaky = createApp({
    fileEnv: { DEEPSEEK_API_KEY: 'from-file', DEEPSEEK_API_BASE: base, ASKDAO_IP_DAILY: '1' },
    stateDir: storeDir,
    logFile: path.join(storeDir, 'reading.log'),
    postJson: async () => {
      timeoutCalls += 1;
      throw new Error('upstream timeout');
    },
  });
  const flakyPort = await listen(flaky);
  const timed = await request(flakyPort, 'POST', '/askdao-api/reading', {
    headers: Object.assign({}, ORIGIN, { 'X-Real-IP': '203.0.113.60' }),
    body: JSON.stringify(QIAN),
  });
  assert.strictEqual(timed.status, 502);
  const kept = await request(flakyPort, 'POST', '/askdao-api/reading', {
    headers: Object.assign({}, ORIGIN, { 'X-Real-IP': '203.0.113.60' }),
    body: JSON.stringify(QIAN),
  });
  assert.strictEqual(kept.status, 429);
  assert.strictEqual(timeoutCalls, 1);

  const badUpDir = appDir();
  let badCalls = 0;
  const badUp = createApp({
    fileEnv: { DEEPSEEK_API_KEY: 'from-file', DEEPSEEK_API_BASE: base, ASKDAO_IP_DAILY: '1' },
    stateDir: badUpDir,
    logFile: path.join(badUpDir, 'reading.log'),
    postJson: async () => {
      badCalls += 1;
      return { status: 200, body: '<html>nope</html>' };
    },
  });
  const badPort = await listen(badUp);
  const malformed = await request(badPort, 'POST', '/askdao-api/reading', {
    headers: Object.assign({}, ORIGIN, { 'X-Real-IP': '203.0.113.61' }),
    body: JSON.stringify(QIAN),
  });
  assert.strictEqual(malformed.status, 502);
  const malformedAgain = await request(badPort, 'POST', '/askdao-api/reading', {
    headers: Object.assign({}, ORIGIN, { 'X-Real-IP': '203.0.113.61' }),
    body: JSON.stringify(QIAN),
  });
  assert.strictEqual(malformedAgain.status, 429);
  assert.strictEqual(badCalls, 1);

  const downDir = appDir();
  let downCalls = 0;
  const down = createApp({
    fileEnv: { DEEPSEEK_API_KEY: 'from-file', DEEPSEEK_API_BASE: base },
    stateDir: downDir,
    logFile: path.join(downDir, 'reading.log'),
    store: {
      hashIp: () => 'hashed',
      reserve: () => {
        throw Object.assign(new Error('disk'), { code: 'STORE' });
      },
    },
    postJson: async () => {
      downCalls += 1;
      return { status: 200, body: '{"choices":[{"message":{"content":"x"}}]}' };
    },
  });
  const downPort = await listen(down);
  const stored = await request(downPort, 'POST', '/askdao-api/reading', {
    headers: Object.assign({}, ORIGIN, { 'X-Real-IP': '203.0.113.70' }),
    body: JSON.stringify(QIAN),
  });
  assert.strictEqual(stored.status, 503);
  assert.strictEqual(downCalls, 0);

  const dayOne = Date.parse('2026-11-07T15:30:00Z');
  const dayTwo = Date.parse('2026-11-07T16:30:00Z');
  assert.notStrictEqual(shanghaiDay(dayOne), shanghaiDay(dayTwo));
  const persist = appDir();
  const q1 = createQuotaStore(persist, {
    now: () => dayOne,
    ipDaily: 5,
    globalHourly: 20,
    dailyRequests: 80,
    dailyTokens: 80000,
    reserveTokens: 10,
  });
  for (let i = 0; i < 5; i += 1) assert.strictEqual(q1.reserve('203.0.113.9').ok, true);
  assert.strictEqual(q1.reserve('203.0.113.9').ok, false);
  const q2 = createQuotaStore(persist, {
    now: () => dayOne,
    ipDaily: 5,
    globalHourly: 20,
    dailyRequests: 80,
    dailyTokens: 80000,
    reserveTokens: 10,
  });
  assert.strictEqual(q2.reserve('203.0.113.9').reason, 'ip');
  const q3 = createQuotaStore(persist, {
    now: () => dayTwo,
    ipDaily: 5,
    globalHourly: 20,
    dailyRequests: 80,
    dailyTokens: 80000,
    reserveTokens: 10,
  });
  assert.strictEqual(q3.reserve('203.0.113.9').ok, true);

  const log = fs.readFileSync(path.join(main.dir, 'reading.log'), 'utf8');
  assert.ok(log.includes('"decision":"reject_offtopic"'));
  assert.ok(log.includes('"decision":"reject_origin"'));
  assert.ok(!log.includes('Should I change careers'));
  assert.ok(!log.includes('from-file'));
  assert.ok(!log.includes('203.0.113.10'));

  const workerDir = appDir();
  const workerScript = `
    const {createQuotaStore}=require(${JSON.stringify(path.join(__dirname, 'server.js'))});
    const s=createQuotaStore(process.argv[1], {now:()=>Date.parse('2026-11-08T04:00:00Z'), ipDaily:5, globalHourly:5, dailyRequests:100, dailyTokens:100000, reserveTokens:10});
    const r=s.reserve(process.argv[2]);
    process.exit(r.ok ? 0 : 2);
  `;
  const codes = await Promise.all(Array.from({ length: 8 }, (_, i) => new Promise((resolve) => {
    const child = spawn(process.execPath, ['-e', workerScript, workerDir, '203.0.113.' + (i + 1)], { stdio: 'inherit' });
    child.on('exit', (code) => resolve(code));
  })));
  assert.strictEqual(codes.filter((c) => c === 0).length, 5);
  assert.strictEqual(codes.filter((c) => c === 2).length, 3);

  await close(main.app);
  await close(hour);
  await close(budget);
  await close(flaky);
  await close(badUp);
  await close(down);
  await close(mock);
  console.log('reading tests passed');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
