import { describe, it, expect } from 'vitest';
import { UserRole, UserRoleSchema } from '../src/index';

describe('Shared Package - UserRole', () => {
  it('should include all five product roles', () => {
    expect(UserRole.RECRUITER).toBe('RECRUITER');
    expect(UserRole.MANAGER).toBe('MANAGER');
    expect(UserRole.ADMIN).toBe('ADMIN');
    expect(UserRole.CLIENT).toBe('CLIENT');
    expect(UserRole.CANDIDATE).toBe('CANDIDATE');
  });

  it('should validate roles with Zod schema', () => {
    expect(UserRoleSchema.parse('RECRUITER')).toBe('RECRUITER');
    expect(() => UserRoleSchema.parse('SUPERUSER')).toThrow();
  });
});
