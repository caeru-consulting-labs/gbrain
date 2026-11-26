import { describe, expect, test } from 'bun:test';
import { canAccessBrain } from '../src/brains/authorization';

describe('brain authorization', () => {
  test('requires both organization and brain membership', () => {
    expect(canAccessBrain(false, 'ADMIN', 'VIEWER')).toBe(false);
    expect(canAccessBrain(true, null, 'VIEWER')).toBe(false);
    expect(canAccessBrain(true, 'VIEWER', 'VIEWER')).toBe(true);
  });
  test('enforces brain role hierarchy', () => {
    expect(canAccessBrain(true, 'VIEWER', 'EDITOR')).toBe(false);
    expect(canAccessBrain(true, 'EDITOR', 'ADMIN')).toBe(false);
    expect(canAccessBrain(true, 'ADMIN', 'EDITOR')).toBe(true);
  });
});
