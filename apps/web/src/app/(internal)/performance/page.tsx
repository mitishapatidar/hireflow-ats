'use client';

import React from 'react';
import { PageHeader } from '../../../components/layout/PageHeader';

export default function PerformancePage() {
  return (
    <div>
      <PageHeader
        title="Recruiter Performance & KPIs"
        subtitle="Track recruiter submittal ratios, placement targets, and monthly revenue contributions."
        breadcrumbs={[{ label: 'Performance' }]}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
        <div className="bg-white rounded-xl border border-[#E6E8F0] p-5 shadow-xs">
          <div className="text-xs text-[#6B7490] font-medium">Top Performer of Month</div>
          <div className="text-lg font-bold text-[#1B2236] mt-2">Sarah Jenkins</div>
          <div className="text-xs text-[#12B76A] mt-1 font-semibold">4 Placements closed (₹14.2L margin)</div>
        </div>
        <div className="bg-white rounded-xl border border-[#E6E8F0] p-5 shadow-xs">
          <div className="text-xs text-[#6B7490] font-medium">Team Target Achieved</div>
          <div className="text-lg font-bold text-[#1B2236] mt-2">84% of ₹45L Target</div>
          <div className="text-xs text-[#5B49D6] mt-1 font-semibold">12 days remaining in cycle</div>
        </div>
        <div className="bg-white rounded-xl border border-[#E6E8F0] p-5 shadow-xs">
          <div className="text-xs text-[#6B7490] font-medium">Avg Sourcing Speed</div>
          <div className="text-lg font-bold text-[#1B2236] mt-2">1.8 Days / Mandate</div>
          <div className="text-xs text-[#12B76A] mt-1 font-semibold">+15% improvement</div>
        </div>
      </div>

      <div className="p-4 bg-white rounded-xl border border-[#E6E8F0] text-center text-xs text-[#6B7490]">
        Recruiter MIS scorecards & monthly target tracking will be functional in Phase 2.
      </div>
    </div>
  );
}
