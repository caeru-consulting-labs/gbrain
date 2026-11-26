import { Body, Controller, Delete, ForbiddenException, Get, NotFoundException, Param, Patch, Post, Query, BadRequestException } from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../auth';
import { canAccessBrain, type BrainRole } from './authorization';

const fields = { name: z.string().trim().min(1).max(100), description: z.string().trim().max(2000).optional() };
const createSchema = z.object({ ...fields, organizationId: z.string().min(1) }).strict();
const updateSchema = z.object(fields).strict();
const memberSchema = z.object({ userId: z.string().min(1), role: z.enum(['ADMIN', 'EDITOR', 'VIEWER']) }).strict();
const view = { id: true, name: true, description: true, organizationId: true, createdAt: true, instance: { select: { status: true } } } as const;
function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new BadRequestException('Dados inválidos');
  return result.data;
}
@Controller('brains')
export class BrainsController {
  private async access(id: string, userId: string, required: BrainRole) {
    const brain = await prisma.brain.findUnique({ where: { id }, include: { members: { where: { userId } }, instance: true } });
    if (!brain) throw new NotFoundException();
    const orgMember = await prisma.member.findFirst({ where: { organizationId: brain.organizationId, userId } });
    if (!canAccessBrain(!!orgMember, brain.members[0]?.role ?? null, required)) throw new ForbiddenException();
    return brain;
  }
  @Get()
  async list(@Session() session: UserSession, @Query('organizationId') organizationId: string) {
    if (!organizationId) throw new BadRequestException('organizationId obrigatório');
    const membership = await prisma.member.findFirst({ where: { organizationId, userId: session.user.id } });
    if (!membership) throw new ForbiddenException();
    const brains = await prisma.brain.findMany({ where: { organizationId, members: { some: { userId: session.user.id } } }, select: { ...view, members: { where: { userId: session.user.id }, select: { role: true } } }, orderBy: { createdAt: 'asc' } });
    return brains.map(({ members, ...brain }) => ({ ...brain, role: members[0].role }));
  }
  @Post()
  async create(@Session() session: UserSession, @Body() body: unknown) {
    const data = parse(createSchema, body);
    const membership = await prisma.member.findFirst({ where: { organizationId: data.organizationId, userId: session.user.id } });
    if (!membership || !membership.role.split(',').some(role => ['owner', 'admin'].includes(role))) throw new ForbiddenException();
    return prisma.brain.create({ data: { ...data, members: { create: { userId: session.user.id, role: 'ADMIN' } }, instance: { create: {} } }, select: view });
  }
  @Get(':id')
  async get(@Session() session: UserSession, @Param('id') id: string) {
    const brain = await this.access(id, session.user.id, 'VIEWER');
    return { id: brain.id, name: brain.name, description: brain.description, organizationId: brain.organizationId, instance: brain.instance && { status: brain.instance.status }, role: brain.members[0].role };
  }
  @Patch(':id')
  async update(@Session() session: UserSession, @Param('id') id: string, @Body() body: unknown) {
    await this.access(id, session.user.id, 'ADMIN');
    return prisma.brain.update({ where: { id }, data: parse(updateSchema, body), select: view });
  }
  @Get(':id/members')
  async members(@Session() session: UserSession, @Param('id') id: string) {
    const brain = await this.access(id, session.user.id, 'ADMIN');
    return prisma.brainMember.findMany({ where: { brainId: id, user: { members: { some: { organizationId: brain.organizationId } } } }, select: { userId: true, role: true, user: { select: { name: true, email: true } } }, orderBy: { user: { name: 'asc' } } });
  }
  @Post(':id/members')
  async setMember(@Session() session: UserSession, @Param('id') id: string, @Body() body: unknown) {
    const brain = await this.access(id, session.user.id, 'ADMIN');
    const data = parse(memberSchema, body);
    return prisma.$transaction(async tx => {
      const actor = await tx.brainMember.findUnique({ where: { brainId_userId: { brainId: id, userId: session.user.id } } });
      const actorOrg = await tx.member.findFirst({ where: { organizationId: brain.organizationId, userId: session.user.id } });
      if (!actorOrg || actor?.role !== 'ADMIN') throw new ForbiddenException();
      const orgMember = await tx.member.findFirst({ where: { organizationId: brain.organizationId, userId: data.userId } });
      if (!orgMember) throw new ForbiddenException();
      const existing = await tx.brainMember.findUnique({ where: { brainId_userId: { brainId: id, userId: data.userId } } });
      if (existing?.role === 'ADMIN' && data.role !== 'ADMIN' && await tx.brainMember.count({ where: { brainId: id, role: 'ADMIN', user: { members: { some: { organizationId: brain.organizationId } } } } }) <= 1) throw new ForbiddenException('O Brain precisa de pelo menos um administrador.');
      return tx.brainMember.upsert({ where: { brainId_userId: { brainId: id, userId: data.userId } }, create: { brainId: id, ...data }, update: { role: data.role } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
  @Delete(':id/members/:userId')
  async removeMember(@Session() session: UserSession, @Param('id') id: string, @Param('userId') userId: string) {
    const brain = await this.access(id, session.user.id, 'ADMIN');
    return prisma.$transaction(async tx => {
      const actor = await tx.brainMember.findUnique({ where: { brainId_userId: { brainId: id, userId: session.user.id } } });
      const actorOrg = await tx.member.findFirst({ where: { organizationId: brain.organizationId, userId: session.user.id } });
      if (!actorOrg || actor?.role !== 'ADMIN') throw new ForbiddenException();
      const existing = await tx.brainMember.findUnique({ where: { brainId_userId: { brainId: id, userId } } });
      if (!existing) throw new NotFoundException();
      if (existing.role === 'ADMIN' && await tx.brainMember.count({ where: { brainId: id, role: 'ADMIN', user: { members: { some: { organizationId: brain.organizationId } } } } }) <= 1) throw new ForbiddenException('O Brain precisa de pelo menos um administrador.');
      await tx.brainMember.delete({ where: { brainId_userId: { brainId: id, userId } } });
      return { deleted: true };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
  @Delete(':id')
  async remove(@Session() session: UserSession, @Param('id') id: string) {
    await this.access(id, session.user.id, 'ADMIN');
    const result = await prisma.brain.deleteMany({ where: { id, instance: { is: { status: 'PENDING' } } } });
    if (result.count !== 1) throw new ForbiddenException('A instância precisa ser removida antes da exclusão');
    return { deleted: true };
  }
}
