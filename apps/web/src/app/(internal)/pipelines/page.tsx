'use client';

import React from 'react';
import { PageHeader } from '../../../components/layout/PageHeader';

export default function PipelinesPage() {
  const pipelineStages = [
    { name: 'Sourced', count: 54, conversion: '78%' },
    { name: 'Screening', count: 42, conversion: '64%' },
    { name: 'Interview', count: 27, conversion: '52%' },
    { name: 'Technical', count: 14, conversion: '50%' },
    { name: 'Client Review', count: 7, conversion: '71%' },
    { name: 'Offer', count: 5, conversion: '80%' },
    { name: 'Placed', count: 4, conversion: '100%' },
  ];

  return (
    <div>
      <PageHeader
        title="Cross-Agency Pipelines"
        subtitle="Monitor funnel stages, conversion bottlenecks, and candidate throughput."
        breadcrumbs={[{ label: 'Pipelines' }]}
      />

      <div className="bg-white rounded-xl border border-[#E6E8F0] p-6 shadow-xs mb-6">
        <h3 className="font-bold text-sm text-[#1B2236] mb-4">Master Funnel Throughput</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {pipelineStages.map((stage, idx) => (
            <div key={idx} className="p-3.5 bg-[#F6F7FB] border border-[#E6E8F0] rounded-xl text-center">
              <span className="text-[10px] uppercase font-bold text-[#6B7490] tracking-wider block">
                {stage.name}
              </span>
              <div className="text-xl font-extrabold text-[#1B2236] mt-1.5">{stage.count}</div>
              <div className="text-[10px] text-[#12B76A] font-semibold mt-1">
                {stage.conversion} conv.
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="p-4 bg-white rounded-xl border border-[#E6E8F0] text-center text-xs text-[#6B7490]">
        Interactive Kanban drag-and-drop & pipeline automations will be wired in Phase 1 (Prompt 8).
      </div>
    </div>
  );
}
