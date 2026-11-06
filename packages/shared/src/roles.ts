import { z } from 'zod';

// Product User Roles
export const UserRole = {
  RECRUITER: 'RECRUITER',
  MANAGER: 'MANAGER',
  ADMIN: 'ADMIN',
  CLIENT: 'CLIENT',
  CANDIDATE: 'CANDIDATE',
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const UserRoleSchema = z.nativeEnum(UserRole);
