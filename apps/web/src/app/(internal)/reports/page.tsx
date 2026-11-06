'use client';

import React from 'react';
import { PageHeader } from '../../../components/layout/PageHeader';
import { BarChart3, TrendingUp, Users, Download } from 'lucide-react';

export default function ReportsPage() {
  return (
    <div>
      <PageHeader
        title="Agency Reports & Analytics"
        subtitle="Performance analytics, time-to-hire metrics, and submission-to-offer funnel velocity."
        breadcrumbs={[{ label: 'Reports' }]}
        actions={
          <button
            onClick={() => alert('Exporting report CSV arrives in Phase 2.')}
            className="px-3.5 py-2 bg-white border border-[#E6E8F0] hover:bg-[#F6F7FB] text-[#1B2236] rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-[#6B7490]" />
            <span>Export CSV</span>
          </button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
        <div className="bg-white rounded-xl border border-[#E6E8F0] p-5 shadow-xs">
          <div className="text-xs text-[#6B7490] font-medium">Avg Time to Submit</div>
          <div className="text-2xl font-bold text-[#1B2236] mt-2">2.4 Days</div>
          <div className="text-xs text-[#12B76A] mt-1 font-semibold flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            <span>-18% faster than agency target</span>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-[#E6E8F0] p-5 shadow-xs">
          <div className="text-xs text-[#6B7490] font-medium">Interview-to-Offer Ratio</div>
          <div className="text-2xl font-bold text-[#1B2236] mt-2">32.5%</div>
          <div className="text-xs text-[#12B76A] mt-1 font-semibold flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            <span>+4.2% month-on-month</span>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-[#E6E8F0] p-5 shadow-xs">
          <div className="text-xs text-[#6B7490] font-medium">Active Candidate Pool</div>
          <div className="text-2xl font-bold text-[#1B2236] mt-2">142</div>
          <div className="text-xs text-[#5B49D6] mt-1 font-semibold flex items-center gap-1">
            <Users className="w-3 h-3" />
            <span>92 vetted for technical rounds</span>
          </div>
        </div>
      </div>

      <div className="p-8 bg-white rounded-xl border border-[#E6E8F0] text-center shadow-xs">
        <div className="w-12 h-12 rounded-xl bg-[#EEEBFB] text-[#5B49D6] flex items-center justify-center mx-auto mb-3">
          <BarChart3 className="w-6 h-6" />
        </div>
        <h3 className="font-bold text-base text-[#1B2236]">Custom Report Builder</h3>
        <p className="text-xs text-[#6B7490] max-w-md mx-auto mt-1">
          Interactive funnel charts, client SLA tracking, and recruiter activity heatmaps will be available in Phase 2 & 3.
        </p>
      </div>
    </div>
  );
}
