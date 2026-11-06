import React from 'react';
import { CandidateLayout } from '../../components/layout/CandidateLayout';

export default function CandidateRouteGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <CandidateLayout>{children}</CandidateLayout>;
}
