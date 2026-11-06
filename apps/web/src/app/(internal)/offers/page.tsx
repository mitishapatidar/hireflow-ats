'use client';

import React from 'react';
import { PageHeader } from '../../../components/layout/PageHeader';
import { CheckCircle2, Clock } from 'lucide-react';

export default function OffersPage() {
  const mockOffers = [
    { id: '1', candidate: 'Rohan Mehta', job: 'DevOps Architect', client: 'Acme Corp', ctc: '₹38,00,000 / yr', margin: '₹3,20,000 (8.4%)', status: 'Offer Released', statusColor: 'bg-[#FEF3DC] text-[#F59E0B]' },
    { id: '2', candidate: 'Neha Kulkarni', job: 'Senior Product Manager', client: 'Starlight Tech', ctc: '₹42,00,000 / yr', margin: '₹3,50,000 (8.3%)', status: 'Placement Closed', statusColor: 'bg-[#E3F6EC] text-[#12B76A]' },
  ];

  return (
    <div>
      <PageHeader
        title="Offers & Placements"
        subtitle="Track candidate offer letters, client fee margins, and placement milestones."
        breadcrumbs={[{ label: 'Offers & Placements' }]}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
        <div className="bg-white rounded-xl border border-[#E6E8F0] p-5 shadow-xs">
          <div className="text-xs text-[#6B7490] font-medium">Offers Pending Sign-Off</div>
          <div className="text-2xl font-bold text-[#1B2236] mt-2">1</div>
          <div className="text-xs text-[#F59E0B] mt-1 font-medium flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            <span>Awaiting candidate signature</span>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-[#E6E8F0] p-5 shadow-xs">
          <div className="text-xs text-[#6B7490] font-medium">Closed Placements (MTD)</div>
          <div className="text-2xl font-bold text-[#1B2236] mt-2">₹6,70,000</div>
          <div className="text-xs text-[#12B76A] mt-1 font-medium flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>2 Successful Placements</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#E6E8F0] shadow-xs overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#F6F7FB] text-[#6B7490] font-semibold uppercase tracking-wider border-b border-[#E6E8F0]">
            <tr>
              <th className="px-5 py-3">Candidate & Role</th>
              <th className="px-5 py-3">Client</th>
              <th className="px-5 py-3">Offered CTC</th>
              <th className="px-5 py-3">Agency Margin</th>
              <th className="px-5 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E6E8F0] text-[#1B2236]">
            {mockOffers.map((o) => (
              <tr key={o.id} className="hover:bg-[#F6F7FB]/70 transition-colors">
                <td className="px-5 py-4">
                  <div className="font-bold text-[#1B2236]">{o.candidate}</div>
                  <div className="text-[11px] text-[#6B7490]">{o.job}</div>
                </td>
                <td className="px-5 py-4 font-medium text-[#1B2236]">{o.client}</td>
                <td className="px-5 py-4 font-semibold text-[#1B2236]">{o.ctc}</td>
                <td className="px-5 py-4 text-[#12B76A] font-bold">{o.margin}</td>
                <td className="px-5 py-4">
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${o.statusColor}`}>
                    {o.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-5 py-3 bg-[#F6F7FB] border-t border-[#E6E8F0] text-center text-xs text-[#6B7490]">
          Offer management & fee calculation rules will be implemented in Phase 2 & 3.
        </div>
      </div>
    </div>
  );
}
