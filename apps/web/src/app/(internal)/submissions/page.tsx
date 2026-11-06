'use client';

import React from 'react';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Send, Building2 } from 'lucide-react';

export default function SubmissionsPage() {
  const mockSubmissions = [
    {
      id: 'sub-1',
      candidate: 'Aarav Shah',
      job: 'Senior Full Stack Engineer',
      client: 'Acme Corp',
      submittedBy: 'Sarah Jenkins',
      submittedAt: 'Today, 10:15 AM',
      status: 'Submitted to Client',
      statusColor: 'bg-[#EEEBFB] text-[#5B49D6]',
    },
    {
      id: 'sub-2',
      candidate: 'Priya Sharma',
      job: 'Engineering Manager',
      client: 'Starlight Tech',
      submittedBy: 'Sarah Jenkins',
      submittedAt: 'Yesterday, 4:30 PM',
      status: 'Shortlisted by Client',
      statusColor: 'bg-[#E3F6EC] text-[#12B76A]',
    },
  ];

  return (
    <div>
      <PageHeader
        title="Candidate Submissions"
        subtitle="Manage candidate profiles presented to clients for shortlisting and interview decisions."
        breadcrumbs={[{ label: 'Submissions' }]}
        actions={
          <button
            onClick={() => alert('Client submission flow arrives in Phase 1 (Prompt 8).')}
            className="px-3.5 py-2 bg-[#5B49D6] text-white rounded-lg text-xs font-semibold hover:bg-[#5B49D6]/90 transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Present to Client</span>
          </button>
        }
      />

      <div className="bg-white rounded-xl border border-[#E6E8F0] shadow-xs overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#F6F7FB] text-[#6B7490] font-semibold uppercase tracking-wider border-b border-[#E6E8F0]">
            <tr>
              <th className="px-5 py-3">Candidate</th>
              <th className="px-5 py-3">Target Job & Client</th>
              <th className="px-5 py-3">Submitted By</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E6E8F0] text-[#1B2236]">
            {mockSubmissions.map((s) => (
              <tr key={s.id} className="hover:bg-[#F6F7FB]/70 transition-colors">
                <td className="px-5 py-4 font-bold text-[#1B2236]">{s.candidate}</td>
                <td className="px-5 py-4">
                  <div className="font-semibold text-[#1B2236]">{s.job}</div>
                  <div className="text-[11px] text-[#6B7490] flex items-center gap-1 mt-0.5">
                    <Building2 className="w-3 h-3 text-[#5B49D6]" />
                    <span>{s.client}</span>
                  </div>
                </td>
                <td className="px-5 py-4 text-[#6B7490]">
                  <div>{s.submittedBy}</div>
                  <div className="text-[10px] text-[#6B7490]/70">{s.submittedAt}</div>
                </td>
                <td className="px-5 py-4">
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${s.statusColor}`}>
                    {s.status}
                  </span>
                </td>
                <td className="px-5 py-4 text-right">
                  <button
                    onClick={() => alert('Standardized candidate profile preview arrives in Phase 1 (Prompt 8).')}
                    className="text-xs text-[#5B49D6] hover:underline font-semibold"
                  >
                    View Submission
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-5 py-3 bg-[#F6F7FB] border-t border-[#E6E8F0] text-center text-xs text-[#6B7490]">
          Standardized profile sharing & client feedback integration will be active in Phase 1 (Prompt 8).
        </div>
      </div>
    </div>
  );
}
