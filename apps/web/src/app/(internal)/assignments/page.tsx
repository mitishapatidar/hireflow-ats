'use client';

import React from 'react';
import { PageHeader } from '../../../components/layout/PageHeader';

export default function AssignmentsPage() {
  const teamWorkload = [
    { name: 'Sarah Jenkins', role: 'Senior Technical Recruiter', activeJobs: 6, pipelineCount: 42, capacity: '85%' },
    { name: 'Rohan Desai', role: 'Technical Recruiter', activeJobs: 4, pipelineCount: 28, capacity: '60%' },
    { name: 'Kavita Nair', role: 'Talent Sourcing Specialist', activeJobs: 5, pipelineCount: 35, capacity: '75%' },
  ];

  return (
    <div>
      <PageHeader
        title="Job Assignments & Team Workload"
        subtitle="Distribute client job mandates across recruiters and monitor workload capacity."
        breadcrumbs={[{ label: 'Assignments' }]}
      />

      <div className="bg-white rounded-xl border border-[#E6E8F0] shadow-xs overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#F6F7FB] text-[#6B7490] font-semibold uppercase tracking-wider border-b border-[#E6E8F0]">
            <tr>
              <th className="px-5 py-3">Recruiter</th>
              <th className="px-5 py-3">Active Mandates</th>
              <th className="px-5 py-3">Candidates in Pipeline</th>
              <th className="px-5 py-3">Capacity</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E6E8F0] text-[#1B2236]">
            {teamWorkload.map((member, i) => (
              <tr key={i} className="hover:bg-[#F6F7FB]/70 transition-colors">
                <td className="px-5 py-4">
                  <div className="font-bold text-[#1B2236]">{member.name}</div>
                  <div className="text-[11px] text-[#6B7490]">{member.role}</div>
                </td>
                <td className="px-5 py-4 font-semibold text-[#1B2236]">{member.activeJobs} jobs</td>
                <td className="px-5 py-4 text-[#6B7490]">{member.pipelineCount} candidates</td>
                <td className="px-5 py-4">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#E5F0FF] text-[#3B82F6]">
                    {member.capacity} capacity
                  </span>
                </td>
                <td className="px-5 py-4 text-right">
                  <button
                    onClick={() => alert('Reassigning job orders arrives in Phase 1 (Prompt 7).')}
                    className="text-xs text-[#5B49D6] hover:underline font-semibold"
                  >
                    Assign Mandate
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-5 py-3 bg-[#F6F7FB] border-t border-[#E6E8F0] text-center text-xs text-[#6B7490]">
          Recruiter assignment & capacity balancing will be functional in Phase 1 (Prompt 7).
        </div>
      </div>
    </div>
  );
}
