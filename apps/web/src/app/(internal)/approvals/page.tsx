'use client';

import React from 'react';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Check, X, Clock } from 'lucide-react';

export default function ApprovalsPage() {
  const pendingApprovals = [
    { id: 'app-1', type: 'Job Opening Sign-off', title: 'Senior AI Engineer ($180k)', requester: 'Sarah Jenkins', client: 'Acme Corp', requestedAt: '2h ago' },
    { id: 'app-2', type: 'Client Submission Approval', title: 'Aarav Shah for Staff Frontend', requester: 'Sarah Jenkins', client: 'Acme Corp', requestedAt: '4h ago' },
  ];

  return (
    <div>
      <PageHeader
        title="Manager Approvals"
        subtitle="Review and sign off on new job mandates, salary offer bands, and client candidate submissions."
        breadcrumbs={[{ label: 'Approvals' }]}
      />

      <div className="space-y-4">
        {pendingApprovals.map((app) => (
          <div
            key={app.id}
            className="bg-white rounded-xl border border-[#E6E8F0] p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4"
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FEF3DC] text-[#F59E0B]">
                  {app.type}
                </span>
                <span className="text-xs text-[#6B7490] flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>{app.requestedAt}</span>
                </span>
              </div>
              <h3 className="font-bold text-sm text-[#1B2236] mt-1.5">{app.title}</h3>
              <div className="text-xs text-[#6B7490] flex items-center gap-3 mt-1">
                <span>Requested by: <strong className="text-[#1B2236]">{app.requester}</strong></span>
                <span>• Client: <strong className="text-[#1B2236]">{app.client}</strong></span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => alert('Approval action will be wired to backend in Phase 2.')}
                className="px-3.5 py-2 bg-[#12B76A] hover:bg-[#12B76A]/90 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Approve</span>
              </button>
              <button
                onClick={() => alert('Reject action will be wired to backend in Phase 2.')}
                className="px-3.5 py-2 bg-[#FDECEC] hover:bg-[#FDECEC]/80 text-[#E5484D] rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Reject</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 bg-white rounded-xl border border-[#E6E8F0] text-center text-xs text-[#6B7490]">
        Manager approval workflows & notification escalation will be functional in Phase 2.
      </div>
    </div>
  );
}
