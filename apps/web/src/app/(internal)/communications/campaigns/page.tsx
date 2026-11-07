import React from 'react';
import Link from 'next/link';
import { requireAuth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { UserRole } from '@hireflow/shared';
import { getCampaignsAction } from '@/actions/campaigns';
import {
  Send,
  Mail,
  MessageSquare,
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  FileText,
  Users,
  ChevronRight,
} from 'lucide-react';
import { CampaignsDirectoryClient } from './CampaignsDirectoryClient';

export const metadata = {
  title: 'Bulk Email & SMS Campaigns | HireFlow ATS',
  description: 'Manage omnichannel marketing and engagement campaigns adhering to TRAI DLT compliance and candidate consent rules.',
};

export default async function CampaignsPage({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const user = await requireAuth();

  if (user.role === UserRole.CLIENT || user.role === UserRole.CANDIDATE) {
    redirect('/unauthorized');
  }

  const resolvedParams = searchParams || {};
  const channel = typeof resolvedParams.channel === 'string' ? resolvedParams.channel : undefined;
  const status = typeof resolvedParams.status === 'string' ? resolvedParams.status : undefined;
  const search = typeof resolvedParams.search === 'string' ? resolvedParams.search : undefined;
  const page = typeof resolvedParams.page === 'string' ? parseInt(resolvedParams.page, 10) : 1;

  const res = await getCampaignsAction({ channel, status, search, page });
  const campaigns = res.success && res.data ? res.data : [];
  const meta = res.meta || { total: 0, page: 1, limit: 20, totalPages: 1, totalDelivered: 0, activeCount: 0 };

  return (
    <div className="flex flex-col min-h-screen bg-[#F6F7FB]">
      {/* Top Header */}
      <header className="bg-white border-b border-[#E6E8F0] px-8 py-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 max-w-7xl mx-auto">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-[#6B7490] mb-1">
              <Link href="/communications" className="hover:text-[#5B49D6]">
                Communications
              </Link>
              <span>/</span>
              <span className="text-[#5B49D6]">Bulk Campaigns</span>
            </div>
            <h1 className="text-2xl font-bold text-[#1B2236] tracking-tight">Email & SMS Campaigns</h1>
            <p className="text-xs text-[#6B7490] mt-0.5">
              Audience-targeted outreach with explicit consent validation, India TRAI DLT governance, and delivery tracking.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/communications/templates"
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-[#1B2236] bg-[#F4F5FA] hover:bg-[#EBECEF] rounded-xl border border-[#E6E8F0] transition-colors"
            >
              <FileText className="w-3.5 h-3.5 text-[#5B49D6]" />
              <span>Templates</span>
            </Link>

            <Link
              href="/communications/campaigns/new"
              className="flex items-center gap-2 px-4 py-2 bg-[#5B49D6] hover:bg-[#4D3DC2] text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Create Campaign</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-8 py-6 space-y-6">
        {/* KPI Metrics Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-[#E6E8F0] shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#6B7490] uppercase tracking-wider">Total Campaigns</span>
              <div className="w-8 h-8 rounded-lg bg-[#EEEBFB] flex items-center justify-center text-[#5B49D6]">
                <Send className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-[#1B2236] mt-2">{meta.total}</div>
            <p className="text-[11px] text-[#6B7490] mt-1">Across Email and SMS channels</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-[#E6E8F0] shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#6B7490] uppercase tracking-wider">Delivered Messages</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-[#1B2236] mt-2">{meta.totalDelivered}</div>
            <p className="text-[11px] text-emerald-600 font-semibold mt-1">Direct mock & verified dispatch</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-[#E6E8F0] shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#6B7490] uppercase tracking-wider">Active & Scheduled</span>
              <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-[#1B2236] mt-2">{meta.activeCount}</div>
            <p className="text-[11px] text-[#6B7490] mt-1">Scheduled or currently executing</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-[#E6E8F0] shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#6B7490] uppercase tracking-wider">Consent Isolation</span>
              <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="text-base font-bold text-[#1B2236] mt-2">TRAI DLT & Opt-In</div>
            <p className="text-[11px] text-[#6B7490] mt-1">Strict channel segregation active</p>
          </div>
        </div>

        {/* Client Interactive Filter & Table View */}
        <CampaignsDirectoryClient
          initialCampaigns={campaigns}
          meta={meta}
          currentChannel={channel || 'ALL'}
          currentStatus={status || 'ALL'}
          currentSearch={search || ''}
        />
      </main>
    </div>
  );
}
