'use client';

import React from 'react';
import { PageHeader } from '../../../components/layout/PageHeader';
import { useDevUser } from '../../../context/DevUserContext';
import { FileText, Upload } from 'lucide-react';

export default function CandidateProfilePage() {
  const { currentUser } = useDevUser();

  return (
    <div>
      <PageHeader
        title="My Candidate Profile"
        subtitle="Manage your personal resume details, contact coordinates, and job preferences."
        breadcrumbs={[{ label: 'Candidate Portal', href: '/my-dashboard' }, { label: 'My Profile' }]}
        actions={
          <button
            onClick={() => alert('Resume update will be functional in Phase 1 (Prompt 6).')}
            className="px-3.5 py-2 bg-[#5B49D6] text-white rounded-lg text-xs font-semibold hover:bg-[#5B49D6]/90 transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Update Resume</span>
          </button>
        }
      />

      <div className="bg-white rounded-xl border border-[#E6E8F0] p-6 shadow-xs max-w-3xl">
        <div className="flex items-center gap-4 pb-6 border-b border-[#E6E8F0]">
          <div
            className={`w-16 h-16 rounded-2xl flex items-center justify-center text-white text-xl font-bold ${currentUser.avatarColor}`}
          >
            {currentUser.initials}
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#1B2236]">{currentUser.name}</h2>
            <p className="text-xs text-[#5B49D6] font-semibold">{currentUser.roleTitle}</p>
            <p className="text-xs text-[#6B7490] mt-0.5">{currentUser.email}</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-3 bg-[#F6F7FB] border border-[#E6E8F0] rounded-lg">
            <span className="text-[#6B7490] block text-[11px]">Primary Skills</span>
            <span className="font-semibold text-[#1B2236] mt-0.5 block">React, Next.js, TypeScript, Node.js, PostgreSQL</span>
          </div>
          <div className="p-3 bg-[#F6F7FB] border border-[#E6E8F0] rounded-lg">
            <span className="text-[#6B7490] block text-[11px]">Years of Experience</span>
            <span className="font-semibold text-[#1B2236] mt-0.5 block">7.5 Years</span>
          </div>
          <div className="p-3 bg-[#F6F7FB] border border-[#E6E8F0] rounded-lg">
            <span className="text-[#6B7490] block text-[11px]">Preferred Locations</span>
            <span className="font-semibold text-[#1B2236] mt-0.5 block">Bengaluru, Remote, Hybrid</span>
          </div>
          <div className="p-3 bg-[#F6F7FB] border border-[#E6E8F0] rounded-lg">
            <span className="text-[#6B7490] block text-[11px]">Notice Period</span>
            <span className="font-semibold text-[#1B2236] mt-0.5 block">30 Days (Negotiable)</span>
          </div>
        </div>

        <div className="mt-6 pt-5 border-t border-[#E6E8F0] flex items-center justify-between text-xs text-[#6B7490]">
          <span className="flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-[#5B49D6]" />
            <span>alex_chen_fullstack_cv.pdf</span>
          </span>
          <span className="text-[11px] text-[#12B76A] font-semibold">Active Profile</span>
        </div>
      </div>
    </div>
  );
}
