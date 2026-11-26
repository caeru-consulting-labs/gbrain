export type BrainRole = 'ADMIN' | 'EDITOR' | 'VIEWER';
const rank: Record<BrainRole, number> = { VIEWER: 0, EDITOR: 1, ADMIN: 2 };
export function canAccessBrain(organizationMember: boolean, role: BrainRole | null, required: BrainRole): boolean {
  return organizationMember && role !== null && rank[role] >= rank[required];
}
