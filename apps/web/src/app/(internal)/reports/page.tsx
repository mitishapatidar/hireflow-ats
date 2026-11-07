'use client';

import React from 'react';
import Link from 'next/link';
import { PageHeader } from '../../../components/layout/PageHeader';
import {
  TrendingUp,
  Users,
  FileSpreadsheet,
  CalendarClock,
  ArrowRight,
  Shield,
  Layers,
} from 'lucide-react';

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Agency Reports & Analytics"
        subtitle="Performance analytics, custom cross-entity reporting, and automated client status schedules."
        breadcrumbs={[{ label: 'Reports' }]}
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/reports/builder"
              className="px-3.5 py-2 bg-[#5B49D6] hover:bg-[#4a39b8] text-white rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-white" />
              <span>Report Builder</span>
            </Link>
          </div>
        }
      />

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
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

      {/* Modules Feature Cards (Frame 37 & Frame 38) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Module A: Custom Report Builder */}
        <div className="bg-white rounded-xl border border-[#E6E8F0] p-6 shadow-xs flex flex-col justify-between hover:border-[#5B49D6]/40 transition-colors">
          <div>
            <div className="w-10 h-10 rounded-xl bg-[#EEEBFB] text-[#5B49D6] flex items-center justify-center mb-3">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-[#1B2236]">Custom Report Builder</h3>
            <p className="text-xs text-[#6B7490] mt-1.5 leading-relaxed">
              Design tailored cross-entity datasets across Candidates, Jobs, Submissions, Interviews, and Placements.
              Filter by date and stage, inspect 5-row live previews with IST timestamps, and export directly to CSV or Excel SpreadsheetML.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-[#6B7490]">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#F6F7FB] border border-[#E6E8F0]">
                <Layers className="w-3 h-3 text-[#5B49D6]" /> Cross-Entity Joins
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#F6F7FB] border border-[#E6E8F0]">
                <Shield className="w-3 h-3 text-[#12B76A]" /> Zero Data Leak
              </span>
            </div>
          </div>
          <div className="pt-6 border-t border-[#E6E8F0] mt-6">
            <Link
              href="/reports/builder"
              className="text-xs font-bold text-[#5B49D6] hover:text-[#4a39b8] flex items-center gap-1.5 group"
            >
              <span>Launch Report Builder</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>

        {/* Module B: Scheduled Client Reports */}
        <div className="bg-white rounded-xl border border-[#E6E8F0] p-6 shadow-xs flex flex-col justify-between hover:border-[#5B49D6]/40 transition-colors">
          <div>
            <div className="w-10 h-10 rounded-xl bg-[#EEEBFB] text-[#5B49D6] flex items-center justify-center mb-3">
              <CalendarClock className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-base text-[#1B2236]">Scheduled Client Reports</h3>
            <p className="text-xs text-[#6B7490] mt-1.5 leading-relaxed">
              Set up automated Daily, Weekly, or Monthly recruitment status emails for verified client contacts.
              Features 13-point delivery-time authorization rechecks, content allow-lists, real-time email previews, and BullMQ idempotent scheduling.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-[#6B7490]">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#F6F7FB] border border-[#E6E8F0]">
                <Users className="w-3 h-3 text-[#5B49D6]" /> Verified Contacts Only
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#F6F7FB] border border-[#E6E8F0]">
                <CalendarClock className="w-3 h-3 text-[#5B49D6]" /> Repeatable Delivery
              </span>
            </div>
          </div>
          <div className="pt-6 border-t border-[#E6E8F0] mt-6">
            <Link
              href="/reports/client-schedules"
              className="text-xs font-bold text-[#5B49D6] hover:text-[#4a39b8] flex items-center gap-1.5 group"
            >
              <span>Manage Client Schedules</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
