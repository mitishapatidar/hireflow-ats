'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserRole, getDefaultRouteForRole } from '@hireflow/shared';
import { useRouter } from 'next/navigation';

export interface DevUserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  roleTitle: string;
  initials: string;
  workspace: string;
  avatarColor: string;
}

export const SEEDED_PROFILES: Record<UserRole, DevUserProfile> = {
  [UserRole.RECRUITER]: {
    id: 'user-recruiter-1',
    name: 'Sarah Jenkins',
    email: 'sarah.j@hireflow.io',
    role: UserRole.RECRUITER,
    roleTitle: 'Senior Technical Recruiter',
    initials: 'SJ',
    workspace: 'HireFlow Agency • US-East',
    avatarColor: 'bg-[#5B49D6]',
  },
  [UserRole.MANAGER]: {
    id: 'user-manager-1',
    name: 'Marcus Vance',
    email: 'marcus.v@hireflow.io',
    role: UserRole.MANAGER,
    roleTitle: 'Talent Delivery Manager',
    initials: 'MV',
    workspace: 'HireFlow Agency • Operations',
    avatarColor: 'bg-[#1E2A4A]',
  },
  [UserRole.ADMIN]: {
    id: 'user-admin-1',
    name: 'Elena Rostova',
    email: 'elena.r@hireflow.io',
    role: UserRole.ADMIN,
    roleTitle: 'Managing Partner & Admin',
    initials: 'ER',
    workspace: 'HireFlow Agency • Enterprise',
    avatarColor: 'bg-[#12B76A]',
  },
  [UserRole.CLIENT]: {
    id: 'user-client-1',
    name: 'David Sterling',
    email: 'david.s@acmecorp.com',
    role: UserRole.CLIENT,
    roleTitle: 'VP of Engineering (Client)',
    initials: 'DS',
    workspace: 'Acme Corp • Client Portal',
    avatarColor: 'bg-[#3B82F6]',
  },
  [UserRole.CANDIDATE]: {
    id: 'user-candidate-1',
    name: 'Alex Chen',
    email: 'alex.chen@gmail.com',
    role: UserRole.CANDIDATE,
    roleTitle: 'Applicant (Full-Stack Engineer)',
    initials: 'AC',
    workspace: 'HireFlow Candidate Portal',
    avatarColor: 'bg-[#F59E0B]',
  },
};

interface DevUserContextType {
  currentUser: DevUserProfile;
  currentRole: UserRole;
  setRole: (role: UserRole, shouldNavigate?: boolean) => void;
  availableRoles: UserRole[];
  isDevMode: boolean;
}

const DevUserContext = createContext<DevUserContextType | undefined>(undefined);

const STORAGE_KEY = 'hireflow_dev_role';

export function DevUserProvider({ children }: { children: React.ReactNode }) {
  const [currentRole, setCurrentRoleState] = useState<UserRole>(UserRole.RECRUITER);
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedRole = localStorage.getItem(STORAGE_KEY) as UserRole | null;
      if (storedRole && SEEDED_PROFILES[storedRole]) {
        setCurrentRoleState(storedRole);
        document.cookie = `hireflow_dev_role=${storedRole}; path=/; max-age=86400`;
      }
    }
  }, []);

  const setRole = (role: UserRole, shouldNavigate: boolean = true) => {
    setCurrentRoleState(role);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, role);
      document.cookie = `hireflow_dev_role=${role}; path=/; max-age=86400`;
    }
    if (shouldNavigate) {
      const defaultRoute = getDefaultRouteForRole(role);
      router.push(defaultRoute);
    }
  };

  const currentUser = SEEDED_PROFILES[currentRole];
  const availableRoles = [
    UserRole.RECRUITER,
    UserRole.MANAGER,
    UserRole.ADMIN,
    UserRole.CLIENT,
    UserRole.CANDIDATE,
  ];

  return (
    <DevUserContext.Provider
      value={{
        currentUser,
        currentRole,
        setRole,
        availableRoles,
        isDevMode: true,
      }}
    >
      {children}
    </DevUserContext.Provider>
  );
}

export function useDevUser(): DevUserContextType {
  const context = useContext(DevUserContext);
  if (!context) {
    // Graceful fallback for SSR or outside provider
    return {
      currentUser: SEEDED_PROFILES[UserRole.RECRUITER],
      currentRole: UserRole.RECRUITER,
      setRole: () => {},
      availableRoles: [
        UserRole.RECRUITER,
        UserRole.MANAGER,
        UserRole.ADMIN,
        UserRole.CLIENT,
        UserRole.CANDIDATE,
      ],
      isDevMode: true,
    };
  }
  return context;
}
