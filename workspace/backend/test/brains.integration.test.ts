import { afterAll, describe, expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { prisma } from '../src/auth';
import { BrainsController } from '../src/brains/brains.controller';
import type { UserSession } from '@thallesp/nestjs-better-auth';
const suffix = randomUUID();
const users = [`a-${suffix}`, `b-${suffix}`];
const orgs = [`a-${suffix}`, `b-${suffix}`];
const session = (id: string) => ({ user: { id } }) as UserSession;
const controller = new BrainsController();
describe('organization isolation against PostgreSQL', () => {
  test('enforces organization and brain membership on reads and writes', async () => {
    for (let i = 0; i < 2; i++) {
      await prisma.user.create({ data: { id: users[i], name: 'Test', email: `${users[i]}@example.invalid` } });
      await prisma.organization.create({ data: { id: orgs[i], name: 'Test', slug: orgs[i], createdAt: new Date(), members: { create: { id: `m-${users[i]}`, userId: users[i], role: 'owner', createdAt: new Date() } } } });
    }
    const brain = await controller.create(session(users[0]), { name: 'Brain', description: 'Contexto inicial', organizationId: orgs[0] });
    expect((await controller.list(session(users[0]), orgs[0])).map(b => b.id)).toContain(brain.id);
    await expect(controller.list(session(users[1]), orgs[0])).rejects.toThrow();
    await expect(controller.get(session(users[1]), brain.id)).rejects.toThrow();
    await expect(controller.update(session(users[1]), brain.id, { name: 'intrusion' })).rejects.toThrow();
    await expect(controller.setMember(session(users[0]), brain.id, { userId: users[1], role: 'VIEWER' })).rejects.toThrow();
    expect((await controller.get(session(users[0]), brain.id)).description).toBe('Contexto inicial');
    await controller.update(session(users[0]), brain.id, { name: 'Renomeado', description: 'Contexto atualizado' });
    expect((await controller.get(session(users[0]), brain.id)).description).toBe('Contexto atualizado');
    await expect(controller.setMember(session(users[0]), brain.id, { userId: users[0], role: 'VIEWER' })).rejects.toThrow();
    await expect(controller.removeMember(session(users[0]), brain.id, users[0])).rejects.toThrow();
    await prisma.member.create({ data: { id: `extra-${suffix}`, userId: users[1], organizationId: orgs[0], role: 'member', createdAt: new Date() } });
    await controller.setMember(session(users[0]), brain.id, { userId: users[1], role: 'VIEWER' });
    expect((await controller.list(session(users[1]), orgs[0])).map(b => b.id)).toContain(brain.id);
    expect((await controller.members(session(users[0]), brain.id)).some(m => m.userId === users[1])).toBe(true);
    await expect(controller.members(session(users[1]), brain.id)).rejects.toThrow();
    await expect(controller.removeMember(session(users[1]), brain.id, users[0])).rejects.toThrow();
    await controller.removeMember(session(users[0]), brain.id, users[1]);
    await expect(controller.get(session(users[1]), brain.id)).rejects.toThrow();
    await controller.setMember(session(users[0]), brain.id, { userId: users[1], role: 'VIEWER' });
    await expect(controller.update(session(users[1]), brain.id, { name: 'intrusion' })).rejects.toThrow();
    await prisma.member.delete({ where: { id: `extra-${suffix}` } });
    await expect(controller.get(session(users[1]), brain.id)).rejects.toThrow();
    await controller.remove(session(users[0]), brain.id);
    await expect(controller.get(session(users[0]), brain.id)).rejects.toThrow();
  });
});
afterAll(async () => {
  await prisma.organization.deleteMany({ where: { id: { in: orgs } } });
  await prisma.user.deleteMany({ where: { id: { in: users } } });
  await prisma.$disconnect();
});
