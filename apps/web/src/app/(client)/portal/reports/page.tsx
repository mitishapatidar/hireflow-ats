'use client';

import React from 'react';
import { PageHeader } from '../../../../components/layout/PageHeader';
import { LineChart } from 'lucide-react';

export default function ClientReportsPage() {
  return (
    <div>
      <PageHeader
        title="Client Hiring Progress Reports"
        subtitle="Hiring funnel analytics, candidate pass rates, and time-to-hire velocity."
        breadcrumbs={[{ label: 'Client Portal', href: '/portal' }, { label: 'Progress Reports' }]}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-6">
        <div className="bg-white rounded-xl border border-[#E6E8F0] p-5 shadow-xs">
          <div className="text-xs text-[#6B7490] font-medium">Profiles Submitted (All Time)</div>
          <div className="text-2xl font-bold text-[#1B2236] mt-2">24 Candidates</div>
          <div className="text-xs text-[#12B76A] mt-1 font-semibold">18 Shortlisted for interview (75%)</div>
        </div>
        <div className="bg-white rounded-xl border border-[#E6E8F0] p-5 shadow-xs">
          <div className="text-xs text-[#6B7490] font-medium">Avg Time to Fill</div>
          <div className="text-2xl font-bold text-[#1B2236] mt-2">16 Days</div>
          <div className="text-xs text-[#5B49D6] mt-1 font-semibold">6 days faster than industry avg</div>
        </div>
        <div className="bg-white rounded-xl border border-[#E6E8F0] p-5 shadow-xs">
          <div className="text-xs text-[#6B7490] font-medium">Successful Hires</div>
          <div className="text-2xl font-bold text-[#1B2236] mt-2">5 Placed</div>
          <div className="text-xs text-[#12B76A] mt-1 font-semibold">100% probation pass rate</div>
        </div>
      </div>

      <div className="p-8 bg-white rounded-xl border border-[#E6E8F0] text-center shadow-xs">
        <div className="w-12 h-12 rounded-xl bg-[#EEEBFB] text-[#5B49D6] flex items-center justify-center mx-auto mb-3">
          <LineChart className="w-6 h-6" />
        </div>
        <h3 className="font-bold text-base text-[#1B2236]">Custom Progress Reports</h3>
        <p className="text-xs text-[#6B7490] max-w-md mx-auto mt-1">
          Automated weekly status digests and monthly hiring velocity reports will be generated in Phase 3.
        </p>
      </div>
    </div>
  );
}
