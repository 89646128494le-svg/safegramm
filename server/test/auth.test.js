import { test, after } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'safegram-test-'));
process.env.DATA_DIR = tmpDir;
process.env.UPLOADS_DIR = path.join(tmpDir, 'uploads');

const { app } = await import('../src/index.js');

after(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('register and login returns token', async () => {
  const register = await request(app).post('/api/auth/register').send({ username: 'alice', password: 'Password1' });
  assert.strictEqual(register.status, 200);
  const login = await request(app).post('/api/auth/login').send({ username: 'alice', password: 'Password1' });
  assert.strictEqual(login.status, 200);
  assert.ok(login.body.token);
});

test('create DM chat with second user', async () => {
  const regA = await request(app).post('/api/auth/register').send({ username: 'bob', password: 'Password1' });
  const regB = await request(app).post('/api/auth/register').send({ username: 'carol', password: 'Password1' });
  const tokenA = regA.body.token;
  const carolId = regB.body.user.id;

  const createChat = await request(app)
    .post('/api/chats')
    .set('Authorization', 'Bearer ' + tokenA)
    .send({ type: 'dm', memberIds: [carolId] });
  assert.strictEqual(createChat.status, 200);
  const chatId = createChat.body.chat.id;
  assert.ok(chatId);

  const getChats = await request(app)
    .get('/api/chats')
    .set('Authorization', 'Bearer ' + tokenA);
  assert.strictEqual(getChats.status, 200);
  assert.ok((getChats.body.chats||[]).find(c=>c.id===chatId));
});
