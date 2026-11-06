import React from 'react';
import { InternalLayout } from '../../components/layout/InternalLayout';

export default function InternalRouteGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <InternalLayout>{children}</InternalLayout>;
}
