import { afterAll, expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { auth, prisma } from '../src/auth';

const email = `${randomUUID()}@example.invalid`;
const password = 'a-long-test-password-123';
const request = (path: string, body: object) => auth.handler(new Request(`http://localhost:3001/api/auth/${path}`, { method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost:5173' }, body: JSON.stringify(body) }));

test('registers and signs in with email and rejects a wrong password', async () => {
  const signup = await request('sign-up/email', { name: 'Test User', email, password });
  expect(signup.status).toBe(200);
  const wrong = await request('sign-in/email', { email, password: 'wrong-password' });
  expect(wrong.ok).toBe(false);
  const login = await request('sign-in/email', { email, password });
  expect(login.status).toBe(200);
  expect(login.headers.get('set-cookie')).toContain('session_token');
});
afterAll(async () => {
  await prisma.user.deleteMany({ where: { email } });
  await prisma.$disconnect();
});
