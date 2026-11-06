'use client';

import React from 'react';
import { DevUserProvider } from '../../context/DevUserContext';
import { DevRoleSwitcher } from './DevRoleSwitcher';

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <DevUserProvider>
      {children}
      <DevRoleSwitcher />
    </DevUserProvider>
  );
}
