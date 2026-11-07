'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Mail,
  MessageSquare,
  Search,
  Filter,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  ChevronRight,
  RotateCcw,
  Ban,
  Send,
  Calendar,
  Eye,
  Loader2,
  FileEdit,
} from 'lucide-react';
import { cancelCampaignAction, retryFailedRecipientsAction } from '@/actions/campaigns';

interface CampaignsDirectoryClientProps {
  initialCampaigns: any[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    totalDelivered: number;
    activeCount: number;
  };
  currentChannel: string;
  currentStatus: string;
  currentSearch: string;
}

export function CampaignsDirectoryClient({
  initialCampaigns,
  meta,
  currentChannel,
  currentStatus,
  currentSearch,
}: CampaignsDirectoryClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [searchTerm, setSearchTerm] = useState(currentSearch);
  const [selectedChannel, setSelectedChannel] = useState(currentChannel);
  const [selectedStatus, setSelectedStatus] = useState(currentStatus);
  const [actionError, setActionError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const applyFilters = (newChannel?: string, newStatus?: string, newSearch?: string) => {
    const ch = newChannel !== undefined ? newChannel : selectedChannel;
    const st = newStatus !== undefined ? newStatus : selectedStatus;
    const sr = newSearch !== undefined ? newSearch : searchTerm;

    const params = new URLSearchParams();
    if (ch && ch !== 'ALL') params.set('channel', ch);
    if (st && st !== 'ALL') params.set('status', st);
    if (sr && sr.trim()) params.set('search', sr.trim());
    params.set('page', '1');

    startTransition(() => {
      router.push(`/communications/campaigns?${params.toString()}`);
    });
  };

  const handleChannelSelect = (channel: string) => {
    setSelectedChannel(channel);
    applyFilters(channel, undefined, undefined);
  };

  const handleStatusSelect = (status: string) => {
    setSelectedStatus(status);
    applyFilters(undefined, status, undefined);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    applyFilters(undefined, undefined, searchTerm);
  };

  const handleCancelCampaign = async (campaignId: string) => {
    if (!window.confirm('Are you sure you want to cancel this scheduled/in-progress campaign?')) {
      return;
    }
    setProcessingId(campaignId);
    setActionError(null);
    try {
      const res = await cancelCampaignAction(campaignId);
      if (!res.success) {
        setActionError(res.error || 'Failed to cancel campaign');
      } else {
        router.refresh();
      }
    } catch (err: any) {
      setActionError(err.message || 'Error cancelling campaign');
    } finally {
      setProcessingId(null);
    }
  };

  const handleRetryFailed = async (campaignId: string) => {
    setProcessingId(campaignId);
    setActionError(null);
    try {
      const res = await retryFailedRecipientsAction(campaignId);
      if (!res.success) {
        setActionError(res.error || 'Failed to retry failed recipients');
      } else {
        router.refresh();
      }
    } catch (err: any) {
      setActionError(err.message || 'Error retrying campaign');
    } finally {
      setProcessingId(null);
    }
  };

  // Helper formatting IST time
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

  return (
    <div className="space-y-4">
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

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-[#E6E8F0] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Channel Filter Pills */}
        <div className="flex items-center gap-1.5 p-1 bg-[#F4F5FA] rounded-xl self-start">
          <button
            type="button"
            onClick={() => handleChannelSelect('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              selectedChannel === 'ALL'
                ? 'bg-white text-[#1B2236] font-bold shadow-xs'
                : 'text-[#6B7490] hover:text-[#1B2236]'
            }`}
          >
            All Channels
          </button>
          <button
            type="button"
            onClick={() => handleChannelSelect('EMAIL')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              selectedChannel === 'EMAIL'
                ? 'bg-white text-[#5B49D6] font-bold shadow-xs'
                : 'text-[#6B7490] hover:text-[#1B2236]'
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            Email
          </button>
          <button
            type="button"
            onClick={() => handleChannelSelect('SMS')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              selectedChannel === 'SMS'
                ? 'bg-white text-emerald-700 font-bold shadow-xs'
                : 'text-[#6B7490] hover:text-[#1B2236]'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            SMS (DLT)
          </button>
        </div>

        {/* Status Select and Search Form */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-[#6B7490]" />
            <select
              value={selectedStatus}
              onChange={(e) => handleStatusSelect(e.target.value)}
              className="text-xs bg-[#F8F9FC] border border-[#E6E8F0] rounded-xl px-3 py-2 text-[#1B2236] focus:outline-none focus:border-[#5B49D6]"
            >
              <option value="ALL">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="SCHEDULED">Scheduled</option>
              <option value="PROCESSING">Sending</option>
              <option value="COMPLETED">Completed</option>
              <option value="FAILED">Failed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          <form onSubmit={handleSearchSubmit} className="relative">
            <Search className="w-3.5 h-3.5 text-[#6B7490] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search campaigns..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-64 pl-9 pr-3 py-2 text-xs bg-[#F8F9FC] border border-[#E6E8F0] rounded-xl text-[#1B2236] placeholder-[#8F97B0] focus:outline-none focus:border-[#5B49D6]"
            />
          </form>
        </div>
      </div>

      {/* Campaigns Table */}
      <div className="bg-white rounded-2xl border border-[#E6E8F0] shadow-xs overflow-hidden">
        {initialCampaigns.length === 0 ? (
          <div className="py-16 px-4 text-center">
            <div className="w-12 h-12 rounded-full bg-[#EEEBFB] text-[#5B49D6] flex items-center justify-center mx-auto mb-3">
              <Send className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-[#1B2236]">No campaigns found</h3>
            <p className="text-xs text-[#6B7490] mt-1 max-w-sm mx-auto">
              Create a targeted candidate outreach campaign with verified opt-in consent and India TRAI DLT compliance.
            </p>
            <Link
              href="/communications/campaigns/new"
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-[#5B49D6] hover:bg-[#4D3DC2] text-white rounded-xl text-xs font-semibold transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Launch First Campaign</span>
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E6E8F0] bg-[#FAFBFD] text-[11px] font-bold text-[#6B7490] uppercase tracking-wider">
                  <th className="py-3 px-5">Campaign Name & Channel</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Delivery & Audience</th>
                  <th className="py-3 px-4">Timing (IST)</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6E8F0] text-xs">
                {initialCampaigns.map((c: any) => {
                  const deliveryPct =
                    c.totalRecipients > 0
                      ? Math.round((c.deliveredCount / c.totalRecipients) * 100)
                      : 0;

                  return (
                    <tr
                      key={c.id}
                      className="hover:bg-[#FAFBFD] transition-colors group"
                    >
                      <td className="py-4 px-5">
                        <div className="flex items-start gap-3">
                          <div
                            className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                              c.channel === 'EMAIL'
                                ? 'bg-indigo-50 text-[#5B49D6]'
                                : 'bg-emerald-50 text-emerald-600'
                            }`}
                          >
                            {c.channel === 'EMAIL' ? (
                              <Mail className="w-4 h-4" />
                            ) : (
                              <MessageSquare className="w-4 h-4" />
                            )}
                          </div>
                          <div>
                            <Link
                              href={`/communications/campaigns/${c.id}`}
                              className="font-bold text-[#1B2236] hover:text-[#5B49D6] transition-colors line-clamp-1"
                            >
                              {c.name}
                            </Link>
                            <p className="text-[11px] text-[#6B7490] line-clamp-1 mt-0.5">
                              {c.channel === 'EMAIL' ? c.subject || 'No subject' : c.body}
                            </p>
                            {c.channel === 'SMS' && c.dltSenderId && (
                              <div className="flex items-center gap-2 mt-1">
                                <span className="inline-block text-[10px] font-mono font-medium px-1.5 py-0.5 bg-gray-100 rounded text-gray-700">
                                  DLT Header: {c.dltSenderId}
                                </span>
                                {c.dltTemplateId && (
                                  <span className="inline-block text-[10px] font-mono font-medium px-1.5 py-0.5 bg-gray-100 rounded text-gray-700">
                                    TID: {c.dltTemplateId}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-4 whitespace-nowrap">
                        {getStatusBadge(c.status)}
                      </td>

                      <td className="py-4 px-4 min-w-[200px]">
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-semibold text-[#1B2236]">
                              {c.deliveredCount} / {c.totalRecipients || 0} Delivered
                            </span>
                            <span className="text-[#6B7490] font-medium">{deliveryPct}%</span>
                          </div>
                          <div className="w-full bg-[#E6E8F0] h-1.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                c.status === 'FAILED'
                                  ? 'bg-rose-500'
                                  : c.status === 'COMPLETED'
                                  ? 'bg-emerald-500'
                                  : 'bg-[#5B49D6]'
                              }`}
                              style={{ width: `${deliveryPct}%` }}
                            />
                          </div>
                          {c.failedCount > 0 && (
                            <span className="inline-block text-[10px] font-semibold text-rose-600">
                              {c.failedCount} failed
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-4 px-4 whitespace-nowrap text-[11px] text-[#6B7490]">
                        {c.status === 'SCHEDULED' ? (
                          <div>
                            <span className="font-semibold text-amber-700 block">
                              Scheduled for:
                            </span>
                            <span>{formatIST(c.scheduledAt)}</span>
                          </div>
                        ) : c.sentAt ? (
                          <div>
                            <span className="font-semibold text-[#1B2236] block">
                              Sent on:
                            </span>
                            <span>{formatIST(c.sentAt)}</span>
                          </div>
                        ) : (
                          <div>
                            <span className="text-[#6B7490] block">Created:</span>
                            <span>{formatIST(c.createdAt)}</span>
                          </div>
                        )}
                      </td>

                      <td className="py-4 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {c.status === 'DRAFT' && (
                            <Link
                              href={`/communications/campaigns/new?draftId=${c.id}`}
                              className="px-2.5 py-1 text-xs font-semibold text-[#5B49D6] hover:bg-[#EEEBFB] rounded-lg transition-colors flex items-center gap-1"
                            >
                              <FileEdit className="w-3.5 h-3.5" />
                              <span>Resume</span>
                            </Link>
                          )}

                          {(c.status === 'SCHEDULED' || c.status === 'PROCESSING') && (
                            <button
                              type="button"
                              onClick={() => handleCancelCampaign(c.id)}
                              disabled={processingId === c.id}
                              className="px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg transition-colors flex items-center gap-1"
                            >
                              {processingId === c.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Ban className="w-3.5 h-3.5" />
                              )}
                              <span>Cancel</span>
                            </button>
                          )}

                          {c.failedCount > 0 && c.status !== 'PROCESSING' && (
                            <button
                              type="button"
                              onClick={() => handleRetryFailed(c.id)}
                              disabled={processingId === c.id}
                              className="px-2.5 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-50 rounded-lg transition-colors flex items-center gap-1"
                              title="Retry failed recipients"
                            >
                              {processingId === c.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <RotateCcw className="w-3.5 h-3.5" />
                              )}
                              <span>Retry</span>
                            </button>
                          )}

                          <Link
                            href={`/communications/campaigns/${c.id}`}
                            className="p-1.5 text-[#6B7490] hover:text-[#1B2236] hover:bg-[#F4F5FA] rounded-lg transition-colors"
                            title="View Campaign Details & Logs"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination controls */}
        {meta.totalPages > 1 && (
          <div className="p-4 border-t border-[#E6E8F0] flex items-center justify-between text-xs text-[#6B7490]">
            <div>
              Showing page {meta.page} of {meta.totalPages} ({meta.total} total campaigns)
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={meta.page <= 1 || isPending}
                onClick={() => {
                  const params = new URLSearchParams(window.location.search);
                  params.set('page', String(meta.page - 1));
                  router.push(`/communications/campaigns?${params.toString()}`);
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
                  router.push(`/communications/campaigns?${params.toString()}`);
                }}
                className="px-3 py-1.5 rounded-lg border border-[#E6E8F0] bg-white text-[#1B2236] hover:bg-gray-50 disabled:opacity-50 font-medium"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
