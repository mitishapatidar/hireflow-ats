'use client';

import React from 'react';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Plus, Filter, Upload, Search, Mail } from 'lucide-react';

export default function CandidatesPage() {
  const mockCandidates = [
    { id: '1', name: 'Aarav Shah', role: 'Staff Frontend Engineer', exp: '8 yrs', location: 'Bengaluru', status: 'Client Review', statusColor: 'bg-[#EEEBFB] text-[#5B49D6]', email: 'aarav.shah@example.com' },
    { id: '2', name: 'Priya Sharma', role: 'Engineering Manager', exp: '12 yrs', location: 'Mumbai', status: 'Interview', statusColor: 'bg-[#E5F0FF] text-[#3B82F6]', email: 'priya.s@example.com' },
    { id: '3', name: 'Rohan Mehta', role: 'DevOps Architect', exp: '10 yrs', location: 'Pune', status: 'Offer', statusColor: 'bg-[#FEF3DC] text-[#F59E0B]', email: 'rohan.m@example.com' },
    { id: '4', name: 'Ananya Verma', role: 'Product Designer', exp: '5 yrs', location: 'Delhi NCR', status: 'Screening', statusColor: 'bg-[#E3F6EC] text-[#12B76A]', email: 'ananya.v@example.com' },
  ];

  return (
    <div>
      <PageHeader
        title="Candidate Talent Pool"
        subtitle="Manage prospective applicants, sourced candidates, and parse resumes."
        breadcrumbs={[{ label: 'Candidates' }]}
        actions={
          <div className="flex gap-2">
            <button
              onClick={() => alert('Resume bulk parser arrives in Phase 1 (Prompt 6).')}
              className="px-3.5 py-2 bg-white border border-[#E6E8F0] hover:bg-[#F6F7FB] text-[#1B2236] rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-[#6B7490]" />
              <span>Import Resumes</span>
            </button>
            <button
              onClick={() => alert('New candidate creation modal arrives in Phase 1 (Prompt 6).')}
              className="px-3.5 py-2 bg-[#5B49D6] text-white rounded-lg text-xs font-semibold hover:bg-[#5B49D6]/90 transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Candidate</span>
            </button>
          </div>
        }
      />

      {/* Filter / Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-[#E6E8F0] shadow-xs mb-6 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-[#6B7490] absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Filter candidates by name, skill, location..."
            className="w-full pl-9 pr-3 py-2 text-xs border border-[#E6E8F0] rounded-lg outline-none focus:border-[#5B49D6] focus:ring-1 focus:ring-[#5B49D6] transition-all"
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button className="px-3 py-2 bg-[#F6F7FB] border border-[#E6E8F0] hover:bg-[#EEEBFB] text-xs font-semibold text-[#1B2236] rounded-lg flex items-center gap-1.5 transition-colors">
            <Filter className="w-3.5 h-3.5 text-[#6B7490]" />
            <span>Filter</span>
          </button>
          <span className="text-xs text-[#6B7490]">Showing 4 of 142 candidates</span>
        </div>
      </div>

      {/* Candidates Table */}
      <div className="bg-white rounded-xl border border-[#E6E8F0] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F6F7FB] text-[#6B7490] font-semibold uppercase tracking-wider border-b border-[#E6E8F0]">
              <tr>
                <th className="px-5 py-3">Candidate</th>
                <th className="px-5 py-3">Role & Experience</th>
                <th className="px-5 py-3">Location</th>
                <th className="px-5 py-3">Stage</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6E8F0] text-[#1B2236]">
              {mockCandidates.map((c) => (
                <tr key={c.id} className="hover:bg-[#F6F7FB]/70 transition-colors">
                  <td className="px-5 py-4 font-medium">
                    <div className="font-bold text-[#1B2236]">{c.name}</div>
                    <div className="text-[11px] text-[#6B7490] flex items-center gap-1 mt-0.5">
                      <Mail className="w-3 h-3" />
                      <span>{c.email}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="font-semibold text-[#1B2236]">{c.role}</div>
                    <div className="text-[11px] text-[#6B7490]">{c.exp}</div>
                  </td>
                  <td className="px-5 py-4 text-[#6B7490]">{c.location}</td>
                  <td className="px-5 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${c.statusColor}`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <button
                      onClick={() => alert(`Viewing full profile for ${c.name}. Profile details arrive in Phase 1 (Prompt 6).`)}
                      className="text-xs text-[#5B49D6] hover:underline font-semibold"
                    >
                      View Profile
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 bg-[#F6F7FB] border-t border-[#E6E8F0] text-center text-xs text-[#6B7490]">
          Candidate profile management & resume auto-parsing will be active in Phase 1 (Prompt 6).
        </div>
      </div>
    </div>
  );
}
