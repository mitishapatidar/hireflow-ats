'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Mail,
  MessageSquare,
  Users,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  RotateCcw,
  Ban,
  ArrowLeft,
  Search,
  Filter,
  Check,
  Calendar,
  Eye,
  Loader2,
  ChevronRight,
  ShieldCheck,
  Send,
} from 'lucide-react';
import { cancelCampaignAction, retryFailedRecipientsAction } from '@/actions/campaigns';

interface CampaignDetailClientProps {
  campaign: any;
  initialRecipients: any[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  currentStatus: string;
  currentSearch: string;
}

export function CampaignDetailClient({
  campaign,
  initialRecipients,
  meta,
  currentStatus,
  currentSearch,
}: CampaignDetailClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [searchTerm, setSearchTerm] = useState(currentSearch);
  const [statusFilter, setStatusFilter] = useState(currentStatus);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const applyFilters = (newStatus?: string, newSearch?: string) => {
    const st = newStatus !== undefined ? newStatus : statusFilter;
    const sr = newSearch !== undefined ? newSearch : searchTerm;

    const params = new URLSearchParams();
    if (st && st !== 'ALL') params.set('status', st);
    if (sr && sr.trim()) params.set('search', sr.trim());
    params.set('page', '1');

    startTransition(() => {
      router.push(`/communications/campaigns/${campaign.id}?${params.toString()}`);
    });
  };

  const handleRetryFailed = async () => {
    setIsRetrying(true);
    setActionError(null);
    try {
      const res = await retryFailedRecipientsAction(campaign.id);
      if (!res.success) {
        setActionError(res.error || 'Failed to retry failed recipients');
      } else {
        router.refresh();
      }
    } catch (err: any) {
      setActionError(err.message || 'Error retrying campaign');
    } finally {
      setIsRetrying(false);
    }
  };

  const handleCancel = async () => {
    if (!window.confirm('Are you sure you want to cancel this campaign?')) return;
    setIsCancelling(true);
    setActionError(null);
    try {
      const res = await cancelCampaignAction(campaign.id);
      if (!res.success) {
        setActionError(res.error || 'Failed to cancel campaign');
      } else {
        router.refresh();
      }
    } catch (err: any) {
      setActionError(err.message || 'Error cancelling campaign');
    } finally {
      setIsCancelling(false);
    }
  };

  // Helper formatting IST
  const formatIST = (dateStr: string | null) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return (
        d.toLocaleString('en-IN', {
          timeZone: 'Asia/Kolkata',
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        }) + ' IST'
      );
    } catch {
      return '—';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200">
            <Clock className="w-3 h-3" />
            Draft
          </span>
        );
      case 'SCHEDULED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Calendar className="w-3 h-3" />
            Scheduled
          </span>
        );
      case 'PROCESSING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <Loader2 className="w-3 h-3 animate-spin" />
            Sending...
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" />
            Completed
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertCircle className="w-3 h-3" />
            Failed
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
            <XCircle className="w-3 h-3" />
            Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
            {status}
          </span>
        );
    }
  };

  const getRecipientStatusBadge = (status: string) => {
    switch (status) {
      case 'DELIVERED':
      case 'SENT':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Check className="w-3 h-3" />
            Delivered
          </span>
        );
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3 h-3" />
            Pending
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertCircle className="w-3 h-3" />
            Failed
          </span>
        );
      case 'BOUNCED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-800 border border-rose-300">
            <AlertCircle className="w-3 h-3" />
            Bounced
          </span>
        );
      case 'EXCLUDED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-600 border border-gray-200">
            <Ban className="w-3 h-3" />
            Excluded
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-700">
            {status}
          </span>
        );
    }
  };

  const totalRecipients = campaign.totalRecipients || 0;
  const deliveredCount = campaign.deliveredCount || 0;
  const failedCount = campaign.failedCount || 0;
  const deliveryPct = totalRecipients > 0 ? Math.round((deliveredCount / totalRecipients) * 100) : 0;

  return (
    <div className="min-h-screen bg-[#F6F7FB] pb-16">
      {/* Top Header */}
      <header className="bg-white border-b border-[#E6E8F0] px-8 py-5">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-[#6B7490] mb-1">
              <Link href="/communications/campaigns" className="hover:text-[#5B49D6]">
                Bulk Campaigns
              </Link>
              <span>/</span>
              <span className="text-[#5B49D6]">{campaign.name}</span>
            </div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-[#1B2236] tracking-tight">{campaign.name}</h1>
              {getStatusBadge(campaign.status)}
            </div>
            <p className="text-xs text-[#6B7490] mt-0.5">
              Created by {campaign.createdBy?.name || 'Recruiter'} · {formatIST(campaign.createdAt)}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {failedCount > 0 && campaign.status !== 'PROCESSING' && (
              <button
                type="button"
                onClick={handleRetryFailed}
                disabled={isRetrying}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl transition-colors disabled:opacity-50"
              >
                {isRetrying ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="w-3.5 h-3.5" />
                )}
                <span>Retry Failed ({failedCount})</span>
              </button>
            )}

            {(campaign.status === 'SCHEDULED' || campaign.status === 'PROCESSING') && (
              <button
                type="button"
                onClick={handleCancel}
                disabled={isCancelling}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-colors disabled:opacity-50"
              >
                {isCancelling ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Ban className="w-3.5 h-3.5" />
                )}
                <span>Cancel Campaign</span>
              </button>
            )}

            <Link
              href="/communications/campaigns"
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-[#1B2236] bg-[#F4F5FA] hover:bg-[#EBECEF] rounded-xl border border-[#E6E8F0] transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Campaigns</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-8 pt-8 space-y-6">
        {actionError && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{actionError}</span>
            </div>
            <button
              onClick={() => setActionError(null)}
              className="text-rose-600 hover:text-rose-800 font-bold ml-2"
            >
              ×
            </button>
          </div>
        )}

        {/* Live KPI Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-[#E6E8F0] shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#6B7490] uppercase tracking-wider">
                Total Audience
              </span>
              <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-[#5B49D6]">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-[#1B2236] mt-2">{totalRecipients}</div>
            <p className="text-[11px] text-[#6B7490] mt-1">Verified opt-in candidates</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-[#E6E8F0] shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#6B7490] uppercase tracking-wider">
                Delivered
              </span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-emerald-700 mt-2">{deliveredCount}</div>
            <p className="text-[11px] text-emerald-700 font-semibold mt-1">{deliveryPct}% delivery rate</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-[#E6E8F0] shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#6B7490] uppercase tracking-wider">
                Failed / Bounced
              </span>
              <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center text-rose-600">
                <AlertCircle className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-rose-700 mt-2">{failedCount}</div>
            <p className="text-[11px] text-rose-600 font-semibold mt-1">
              {failedCount > 0 ? 'Action required (Retry available)' : 'Zero failures detected'}
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-[#E6E8F0] shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#6B7490] uppercase tracking-wider">
                Channel & DLT
              </span>
              <div className="w-8 h-8 rounded-lg bg-[#EEEBFB] flex items-center justify-center text-[#5B49D6]">
                {campaign.channel === 'EMAIL' ? (
                  <Mail className="w-4 h-4" />
                ) : (
                  <MessageSquare className="w-4 h-4" />
                )}
              </div>
            </div>
            <div className="text-sm font-bold text-[#1B2236] mt-2">
              {campaign.channel === 'EMAIL' ? 'Email Blast' : `SMS (${campaign.dltSenderId || 'AURCAP'})`}
            </div>
            <p className="text-[11px] text-[#6B7490] mt-1">
              {campaign.channel === 'EMAIL' ? 'RFC-8058 1-click unsubscribe' : `TID: ${campaign.dltTemplateId || '—'}`}
            </p>
          </div>
        </div>

        {/* Campaign Configuration & Message Card */}
        <div className="bg-white p-6 rounded-2xl border border-[#E6E8F0] shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-[#1B2236] flex items-center gap-2">
            <Eye className="w-4 h-4 text-[#5B49D6]" />
            Campaign Message Details & Configuration
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="text-xs">
                <span className="text-[#6B7490] block text-[11px] font-bold uppercase tracking-wider">
                  Sender Identity
                </span>
                <span className="font-semibold text-[#1B2236]">
                  {campaign.senderIdentity || 'HireFlow Talent Team'}
                </span>
              </div>

              {campaign.channel === 'EMAIL' && (
                <div className="text-xs">
                  <span className="text-[#6B7490] block text-[11px] font-bold uppercase tracking-wider">
                    Subject Line
                  </span>
                  <span className="font-semibold text-[#1B2236]">
                    {campaign.subject || 'No subject'}
                  </span>
                </div>
              )}

              {campaign.channel === 'SMS' && (
                <div className="flex items-center gap-4 text-xs">
                  <div>
                    <span className="text-[#6B7490] block text-[11px] font-bold uppercase tracking-wider">
                      TRAI Header
                    </span>
                    <span className="font-mono font-bold text-emerald-800">
                      {campaign.dltSenderId || 'AURCAP'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#6B7490] block text-[11px] font-bold uppercase tracking-wider">
                      Template ID
                    </span>
                    <span className="font-mono text-[#1B2236]">
                      {campaign.dltTemplateId || '—'}
                    </span>
                  </div>
                </div>
              )}

              <div className="text-xs">
                <span className="text-[#6B7490] block text-[11px] font-bold uppercase tracking-wider">
                  Timing & Execution
                </span>
                <span className="text-[#1B2236]">
                  {campaign.sentAt ? `Dispatched on ${formatIST(campaign.sentAt)}` : `Created ${formatIST(campaign.createdAt)}`}
                </span>
              </div>
            </div>

            {/* Message Body Render */}
            <div className="p-4 rounded-xl bg-[#F8F9FC] border border-[#E6E8F0]">
              <span className="text-[11px] font-bold text-[#6B7490] uppercase tracking-wider block mb-1.5">
                Template Body
              </span>
              <div className="text-xs text-gray-800 font-mono whitespace-pre-wrap max-h-40 overflow-y-auto">
                {campaign.body}
              </div>
            </div>
          </div>
        </div>

        {/* Recipient Delivery Logs Table */}
        <div className="bg-white rounded-2xl border border-[#E6E8F0] shadow-xs overflow-hidden">
          {/* Header & Filter Bar */}
          <div className="p-4 border-b border-[#E6E8F0] flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-[#1B2236]">Recipient Delivery Logs</h3>
              <p className="text-xs text-[#6B7490] mt-0.5">
                Individual message dispatch status, provider confirmation tokens, and error traces.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center gap-2">
                <Filter className="w-3.5 h-3.5 text-[#6B7490]" />
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    applyFilters(e.target.value, undefined);
                  }}
                  className="text-xs bg-[#F8F9FC] border border-[#E6E8F0] rounded-xl px-3 py-1.5 text-[#1B2236] focus:outline-none focus:border-[#5B49D6]"
                >
                  <option value="ALL">All Delivery Statuses</option>
                  <option value="DELIVERED">Delivered</option>
                  <option value="PENDING">Pending</option>
                  <option value="FAILED">Failed</option>
                  <option value="EXCLUDED">Excluded</option>
                </select>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  applyFilters(undefined, searchTerm);
                }}
                className="relative"
              >
                <Search className="w-3.5 h-3.5 text-[#6B7490] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search recipient..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full sm:w-56 pl-9 pr-3 py-1.5 text-xs bg-[#F8F9FC] border border-[#E6E8F0] rounded-xl text-[#1B2236] placeholder-[#8F97B0] focus:outline-none focus:border-[#5B49D6]"
                />
              </form>
            </div>
          </div>

          {/* Logs Table */}
          {initialRecipients.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#6B7490]">
              No recipient records match the selected filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#E6E8F0] bg-[#FAFBFD] text-[11px] font-bold text-[#6B7490] uppercase tracking-wider">
                    <th className="py-3 px-5">Candidate Name</th>
                    <th className="py-3 px-4">Destination</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Provider Message ID</th>
                    <th className="py-3 px-4">Delivered At (IST)</th>
                    <th className="py-3 px-4">Error / Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6E8F0] text-xs">
                  {initialRecipients.map((r: any) => (
                    <tr key={r.id} className="hover:bg-[#FAFBFD] transition-colors">
                      <td className="py-3 px-5 font-semibold text-[#1B2236]">
                        {r.candidate?.name || 'Candidate'}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-gray-700">
                        {r.recipient || r.destination}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {getRecipientStatusBadge(r.status)}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-gray-500">
                        {r.providerMessageId || '—'}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-[11px] text-[#6B7490]">
                        {formatIST(r.deliveredAt || r.sentAt)}
                      </td>
                      <td className="py-3 px-4 text-[11px] text-rose-600 max-w-xs truncate">
                        {r.errorMessage || r.exclusionReason || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {meta.totalPages > 1 && (
            <div className="p-4 border-t border-[#E6E8F0] flex items-center justify-between text-xs text-[#6B7490]">
              <div>
                Showing page {meta.page} of {meta.totalPages} ({meta.total} recipients)
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={meta.page <= 1 || isPending}
                  onClick={() => {
                    const params = new URLSearchParams(window.location.search);
                    params.set('page', String(meta.page - 1));
                    router.push(`/communications/campaigns/${campaign.id}?${params.toString()}`);
                  }}
                  className="px-3 py-1.5 rounded-lg border border-[#E6E8F0] bg-white text-[#1B2236] hover:bg-gray-50 disabled:opacity-50 font-medium"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={meta.page >= meta.totalPages || isPending}
                  onClick={() => {
                    const params = new URLSearchParams(window.location.search);
                    params.set('page', String(meta.page + 1));
                    router.push(`/communications/campaigns/${campaign.id}?${params.toString()}`);
                  }}
                  className="px-3 py-1.5 rounded-lg border border-[#E6E8F0] bg-white text-[#1B2236] hover:bg-gray-50 disabled:opacity-50 font-medium"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
