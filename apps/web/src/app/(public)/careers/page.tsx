'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export default function PublicCareersPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="text-center mb-10">
        <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-[#EEEBFB] text-[#5B49D6] mb-3">
          HireFlow Careers Network
        </span>
        <h1 className="text-3xl font-extrabold text-[#1B2236] tracking-tight">
          Explore Open Technology Mandates
        </h1>
        <p className="text-sm text-[#6B7490] mt-2 max-w-lg mx-auto">
          HireFlow partners with fast-growing venture-backed startups and enterprises to source top engineering and product talent.
        </p>
      </div>

      <div className="space-y-4">
        {[
          { title: 'Staff Frontend Engineer', company: 'Acme Corp', location: 'Bengaluru / Hybrid', exp: '7-10 yrs' },
          { title: 'DevOps Architect', company: 'Starlight Tech', location: 'Remote', exp: '8-12 yrs' },
          { title: 'Principal Data Scientist', company: 'FinServe Global', location: 'Hyderabad', exp: '10+ yrs' },
        ].map((job, idx) => (
          <div
            key={idx}
            className="p-5 bg-white rounded-xl border border-[#E6E8F0] shadow-xs flex items-center justify-between hover:border-[#5B49D6]/50 transition-all"
          >
            <div>
              <h3 className="font-bold text-sm text-[#1B2236]">{job.title}</h3>
              <div className="text-xs text-[#6B7490] mt-1 space-x-3">
                <span>Company: <strong className="text-[#1B2236]">{job.company}</strong></span>
                <span>• Location: {job.location}</span>
                <span>• Exp: {job.exp}</span>
              </div>
            </div>
            <Link
              href="/my-dashboard"
              className="px-3.5 py-1.5 bg-[#5B49D6] text-white rounded-lg text-xs font-semibold hover:bg-[#5B49D6]/90 transition-colors flex items-center gap-1"
            >
              <span>Apply</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
