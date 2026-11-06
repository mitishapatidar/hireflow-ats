'use client';

import React from 'react';
import { PageHeader } from '../../../components/layout/PageHeader';
import { MapPin } from 'lucide-react';

export default function ClientPositionsPage() {
  const clientPositions = [
    { title: 'Senior Full Stack Engineer', location: 'Remote / Bengaluru', candidatesSubmitted: 6, interviewsActive: 2, status: 'Active' },
    { title: 'DevOps Architect (AWS/K8s)', location: 'Bengaluru', candidatesSubmitted: 4, interviewsActive: 1, status: 'Active' },
    { title: 'Principal Data Engineer', location: 'Remote', candidatesSubmitted: 3, interviewsActive: 0, status: 'Sourcing' },
  ];

  return (
    <div>
      <PageHeader
        title="Open Positions & Mandates"
        subtitle="Current hiring orders being serviced by HireFlow for your team."
        breadcrumbs={[{ label: 'Client Portal', href: '/portal' }, { label: 'Positions' }]}
      />

      <div className="space-y-4">
        {clientPositions.map((pos, i) => (
          <div
            key={i}
            className="bg-white rounded-xl border border-[#E6E8F0] p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-[#1B2236]">{pos.title}</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E3F6EC] text-[#12B76A]">
                  {pos.status}
                </span>
              </div>
              <div className="text-xs text-[#6B7490] flex items-center gap-1.5 mt-1">
                <MapPin className="w-3.5 h-3.5" />
                <span>{pos.location}</span>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs">
              <span className="text-[#6B7490]">
                <strong className="text-[#1B2236]">{pos.candidatesSubmitted}</strong> profiles submitted
              </span>
              <span className="text-[#6B7490]">
                <strong className="text-[#5B49D6]">{pos.interviewsActive}</strong> in interview
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 bg-white rounded-xl border border-[#E6E8F0] text-center text-xs text-[#6B7490]">
        Client position management & SLA tracking will be active in Phase 1 (Prompt 7).
      </div>
    </div>
  );
}
