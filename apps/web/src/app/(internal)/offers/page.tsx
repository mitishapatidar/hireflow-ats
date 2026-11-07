'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { PageHeader } from '../../../components/layout/PageHeader';
import {
  CheckCircle2,
  Clock,
  TrendingUp,
  FileCheck2,
  Award,
  Search,
  Filter,
  Plus,
  ArrowRight,
  X,
  AlertCircle,
  Building,
  Briefcase,
  User,
  Calendar,
  IndianRupee,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import {
  getOffersDashboardStatsAction,
  getOffersAction,
  createOfferAction,
  releaseOfferAction,
  acceptOfferAction,
  declineOfferAction,
  confirmJoiningAction,
} from '../../../actions/offers';

export default function OffersPage() {
  const [stats, setStats] = useState<{
    releasedMtd: { count: number; momDeltaPercent: number };
    acceptedMtd: { count: number; acceptanceRatePercent: number };
    pendingResponse: { count: number };
    confirmedPlacements: { count: number; totalFeeSum?: number };
  } | null>(null);

  const [offers, setOffers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedOffer, setSelectedOffer] = useState<any | null>(null);

  // Modal States
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDeclineModalOpen, setIsDeclineModalOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Form States
  const [confirmForm, setConfirmForm] = useState({
    joiningDate: new Date().toISOString().split('T')[0],
    feeAmount: '',
    paymentTerms: 'NET_30',
  });

  const [declineReason, setDeclineReason] = useState('Counter-offer accepted at existing firm');

  const [createForm, setCreateForm] = useState({
    applicationId: '',
    clientId: '',
    offeredSalary: '2800000',
    joiningDate: '',
    expiryDate: '',
    notes: 'Standard 30-day notice period buy-out agreed.',
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsRes, offersRes] = await Promise.all([
        getOffersDashboardStatsAction(),
        getOffersAction({
          status: statusFilter === 'ALL' ? undefined : statusFilter,
          query: searchQuery || undefined,
        }),
      ]);
      setStats(statsRes);
      setOffers(offersRes.offers || []);
    } catch (err: any) {
      console.error('Failed to load offers data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const handleRelease = (offer: any) => {
    setActionError(null);
    startTransition(async () => {
      try {
        await releaseOfferAction(offer.id);
        await loadData();
        if (selectedOffer?.id === offer.id) setSelectedOffer(null);
      } catch (err: any) {
        setActionError(err.message || 'Failed to release offer');
      }
    });
  };

  const handleAccept = (offer: any) => {
    setActionError(null);
    startTransition(async () => {
      try {
        await acceptOfferAction(offer.id);
        await loadData();
        if (selectedOffer?.id === offer.id) setSelectedOffer(null);
      } catch (err: any) {
        setActionError(err.message || 'Failed to accept offer');
      }
    });
  };

  const handleDeclineSubmit = () => {
    if (!selectedOffer) return;
    setActionError(null);
    startTransition(async () => {
      try {
        await declineOfferAction(selectedOffer.id, { declineReason });
        setIsDeclineModalOpen(false);
        await loadData();
        setSelectedOffer(null);
      } catch (err: any) {
        setActionError(err.message || 'Failed to decline offer');
      }
    });
  };

  const handleConfirmJoiningSubmit = () => {
    if (!selectedOffer) return;
    setActionError(null);
    startTransition(async () => {
      try {
        const fee = confirmForm.feeAmount ? Number(confirmForm.feeAmount) : (selectedOffer.agencyMarginAmount || 10000);
        await confirmJoiningAction(selectedOffer.id, {
          joinedAt: confirmForm.joiningDate,
          feeBasis: 'PERCENTAGE',
          feeAmount: fee,
          paymentTerms: confirmForm.paymentTerms,
        });
        setIsConfirmModalOpen(false);
        await loadData();
        setSelectedOffer(null);
      } catch (err: any) {
        setActionError(err.message || 'Failed to confirm joining');
      }
    });
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    startTransition(async () => {
      try {
        await createOfferAction({
          applicationId: createForm.applicationId,
          clientId: createForm.clientId,
          offeredSalary: Number(createForm.offeredSalary),
          joiningDate: createForm.joiningDate || undefined,
          expiryDate: createForm.expiryDate || undefined,
          notes: createForm.notes,
        });
        setIsCreateModalOpen(false);
        await loadData();
      } catch (err: any) {
        setActionError(err.message || 'Failed to create offer');
      }
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#F0F1F5] text-[#6B7490] border border-[#E6E8F0]">Draft</span>;
      case 'RELEASED':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#FEF3DC] text-[#D97706] border border-[#FDE68A]">Released</span>;
      case 'ACCEPTED':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#E0F2FE] text-[#0284C7] border border-[#BAE6FD]">Accepted</span>;
      case 'JOINED':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#E3F6EC] text-[#12B76A] border border-[#A6F4C5]">Placement Closed</span>;
      case 'DECLINED':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#FEE4E2] text-[#D92D20] border border-[#FECDCA]">Declined</span>;
      case 'EXPIRED':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#F3F4F6] text-[#6B7280] border border-[#E5E7EB]">Expired</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-700">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Offers & Placements"
        subtitle="Manage end-to-end offer lifecycle, candidate responses, and transactional placement fee sign-offs."
        breadcrumbs={[{ label: 'Offers & Placements' }]}
        actions={
          <button
            onClick={() => {
              setActionError(null);
              setIsCreateModalOpen(true);
            }}
            className="px-3.5 py-2 bg-[#5B49D6] hover:bg-[#4a39b8] text-white rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Generate Offer</span>
          </button>
        }
      />

      {actionError && (
        <div className="p-3.5 rounded-lg bg-[#FEE4E2] border border-[#FECDCA] text-[#D92D20] text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="text-[#D92D20] hover:opacity-75">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 4 LIVE KPI CARDS (FRAME 08) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Released MTD */}
        <div className="bg-white rounded-xl border border-[#E6E8F0] p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#6B7490] font-medium">Offers Released (MTD)</span>
            <div className="w-8 h-8 rounded-lg bg-[#EEEBFB] text-[#5B49D6] flex items-center justify-center">
              <FileCheck2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-[#1B2236] mt-2">
            {stats?.releasedMtd.count ?? 0}
          </div>
          <div className="text-[11px] mt-1 font-medium flex items-center gap-1 text-[#12B76A]">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>{stats?.releasedMtd.momDeltaPercent ?? 0}% vs last month</span>
          </div>
        </div>

        {/* KPI 2: Accepted MTD */}
        <div className="bg-white rounded-xl border border-[#E6E8F0] p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#6B7490] font-medium">Offers Accepted</span>
            <div className="w-8 h-8 rounded-lg bg-[#E0F2FE] text-[#0284C7] flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-[#1B2236] mt-2">
            {stats?.acceptedMtd.count ?? 0}
          </div>
          <div className="text-[11px] mt-1 font-medium text-[#0284C7] flex items-center gap-1">
            <span>{stats?.acceptedMtd.acceptanceRatePercent ?? 0}% conversion rate</span>
          </div>
        </div>

        {/* KPI 3: Pending Response */}
        <div className="bg-white rounded-xl border border-[#E6E8F0] p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#6B7490] font-medium">Awaiting Signature</span>
            <div className="w-8 h-8 rounded-lg bg-[#FEF3DC] text-[#D97706] flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-[#1B2236] mt-2">
            {stats?.pendingResponse.count ?? 0}
          </div>
          <div className="text-[11px] mt-1 font-medium text-[#D97706]">
            Active candidate review
          </div>
        </div>

        {/* KPI 4: Confirmed Placements */}
        <div className="bg-white rounded-xl border border-[#E6E8F0] p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#6B7490] font-medium">Closed Placements</span>
            <div className="w-8 h-8 rounded-lg bg-[#E3F6EC] text-[#12B76A] flex items-center justify-center">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-[#1B2236] mt-2">
            {stats?.confirmedPlacements.count ?? 0}
          </div>
          <div className="text-[11px] mt-1 font-semibold text-[#12B76A]">
            {stats?.confirmedPlacements.totalFeeSum !== undefined
              ? `₹${stats.confirmedPlacements.totalFeeSum.toLocaleString('en-IN')} Fee Booked`
              : 'Placement Milestone'}
          </div>
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="bg-white rounded-xl border border-[#E6E8F0] p-3.5 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 flex-1 min-w-[280px]">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7490]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search candidate, role, or client..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#F6F7FB] border border-[#E6E8F0] rounded-lg text-[#1B2236] placeholder-[#6B7490] focus:outline-none focus:border-[#5B49D6]"
            />
          </div>
          <button
            type="submit"
            className="px-3 py-1.5 bg-[#F6F7FB] hover:bg-[#E6E8F0] text-[#1B2236] rounded-lg text-xs font-medium cursor-pointer border border-[#E6E8F0]"
          >
            Search
          </button>
        </form>

        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-[#6B7490]" />
          <div className="flex items-center gap-1 bg-[#F6F7FB] p-0.5 rounded-lg border border-[#E6E8F0] text-xs">
            {['ALL', 'RELEASED', 'ACCEPTED', 'JOINED', 'DRAFT', 'DECLINED'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                  statusFilter === st
                    ? 'bg-white text-[#5B49D6] shadow-xs font-semibold'
                    : 'text-[#6B7490] hover:text-[#1B2236]'
                }`}
              >
                {st === 'ALL' ? 'All Offers' : st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* OFFERS TABLE */}
      <div className="bg-white rounded-xl border border-[#E6E8F0] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F6F7FB] text-[#6B7490] font-semibold uppercase tracking-wider border-b border-[#E6E8F0]">
              <tr>
                <th className="px-5 py-3">Candidate & Role</th>
                <th className="px-5 py-3">Client</th>
                <th className="px-5 py-3">Offered CTC</th>
                <th className="px-5 py-3">Agency Fee (Margin)</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6E8F0] text-[#1B2236]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-[#6B7490]">
                    Loading offers data...
                  </td>
                </tr>
              ) : offers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-[#6B7490]">
                    No offers matching criteria.
                  </td>
                </tr>
              ) : (
                offers.map((offer) => (
                  <tr
                    key={offer.id}
                    className="hover:bg-[#F6F7FB]/70 transition-colors cursor-pointer"
                    onClick={() => setSelectedOffer(offer)}
                  >
                    <td className="px-5 py-4">
                      <div className="font-bold text-[#1B2236]">{offer.candidate?.name || 'Candidate'}</div>
                      <div className="text-[11px] text-[#6B7490]">
                        {offer.job?.title} • <span className="font-mono">{offer.job?.code}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-medium text-[#1B2236]">{offer.client?.name}</div>
                      <div className="text-[11px] text-[#6B7490]">{offer.job?.recruiterName}</div>
                    </td>
                    <td className="px-5 py-4 font-semibold text-[#1B2236]">
                      ₹{offer.offeredSalary?.toLocaleString('en-IN')} / yr
                    </td>
                    <td className="px-5 py-4">
                      {offer.agencyMarginAmount ? (
                        <div className="font-semibold text-[#12B76A]">
                          ₹{offer.agencyMarginAmount.toLocaleString('en-IN')}
                          <span className="text-[10px] text-[#6B7490] block">
                            ({offer.agencyMarginPercent}%)
                          </span>
                        </div>
                      ) : (
                        <span className="text-[#6B7490]">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {getStatusBadge(offer.status)}
                    </td>
                    <td className="px-5 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        {offer.status === 'DRAFT' && (
                          <button
                            onClick={() => handleRelease(offer)}
                            disabled={isPending}
                            className="px-2.5 py-1 bg-[#5B49D6] hover:bg-[#4a39b8] text-white rounded text-[11px] font-semibold transition-colors shadow-xs"
                          >
                            Release
                          </button>
                        )}
                        {offer.status === 'RELEASED' && (
                          <>
                            <button
                              onClick={() => handleAccept(offer)}
                              disabled={isPending}
                              className="px-2 py-1 bg-[#12B76A] hover:bg-[#0e9f5d] text-white rounded text-[11px] font-semibold transition-colors"
                            >
                              Accept
                            </button>
                            <button
                              onClick={() => {
                                setSelectedOffer(offer);
                                setIsDeclineModalOpen(true);
                              }}
                              disabled={isPending}
                              className="px-2 py-1 bg-white hover:bg-gray-100 text-[#D92D20] border border-[#FECDCA] rounded text-[11px] font-semibold transition-colors"
                            >
                              Decline
                            </button>
                          </>
                        )}
                        {offer.status === 'ACCEPTED' && (
                          <button
                            onClick={() => {
                              setSelectedOffer(offer);
                              setConfirmForm({
                                joiningDate: new Date().toISOString().split('T')[0],
                                feeAmount: offer.agencyMarginAmount ? String(offer.agencyMarginAmount) : '',
                                paymentTerms: 'NET_30',
                              });
                              setIsConfirmModalOpen(true);
                            }}
                            disabled={isPending}
                            className="px-2.5 py-1 bg-[#12B76A] hover:bg-[#0e9f5d] text-white rounded text-[11px] font-semibold transition-colors flex items-center gap-1 shadow-xs"
                          >
                            <Award className="w-3 h-3" />
                            <span>Confirm Joining</span>
                          </button>
                        )}
                        {offer.status === 'JOINED' && (
                          <span className="text-[11px] text-[#12B76A] font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Placed
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DETAIL DRAWER */}
      {selectedOffer && !isConfirmModalOpen && !isDeclineModalOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white h-full shadow-2xl p-6 overflow-y-auto space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-[#E6E8F0]">
              <div>
                <h3 className="font-bold text-base text-[#1B2236]">Offer Overview</h3>
                <p className="text-xs text-[#6B7490]">{selectedOffer.job?.code}</p>
              </div>
              <button
                onClick={() => setSelectedOffer(null)}
                className="p-1 rounded-md text-[#6B7490] hover:text-[#1B2236] hover:bg-[#F6F7FB]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-4 rounded-xl bg-[#F6F7FB] border border-[#E6E8F0] space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[#6B7490]">Status</span>
                  {getStatusBadge(selectedOffer.status)}
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[#6B7490]">Offered CTC</span>
                  <span className="font-bold text-sm text-[#1B2236]">
                    ₹{selectedOffer.offeredSalary?.toLocaleString('en-IN')} / yr
                  </span>
                </div>
                {selectedOffer.agencyMarginAmount && (
                  <div className="flex justify-between items-center text-[#12B76A]">
                    <span>Agency Fee</span>
                    <span className="font-bold">
                      ₹{selectedOffer.agencyMarginAmount.toLocaleString('en-IN')} ({selectedOffer.agencyMarginPercent}%)
                    </span>
                  </div>
                )}
              </div>

              <div>
                <h4 className="font-semibold text-[#1B2236] uppercase text-[10px] tracking-wider mb-2">Candidate Details</h4>
                <div className="border border-[#E6E8F0] rounded-xl p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-[#5B49D6]" />
                    <span className="font-bold text-[#1B2236]">{selectedOffer.candidate?.name}</span>
                  </div>
                  <div className="text-[#6B7490] text-[11px] pl-6">{selectedOffer.candidate?.email}</div>
                  {selectedOffer.candidate?.phone && (
                    <div className="text-[#6B7490] text-[11px] pl-6">{selectedOffer.candidate.phone}</div>
                  )}
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-[#1B2236] uppercase text-[10px] tracking-wider mb-2">Job & Client</h4>
                <div className="border border-[#E6E8F0] rounded-xl p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-[#5B49D6]" />
                    <span className="font-semibold text-[#1B2236]">{selectedOffer.job?.title}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Building className="w-4 h-4 text-[#6B7490]" />
                    <span className="text-[#1B2236]">{selectedOffer.client?.name}</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-[#1B2236] uppercase text-[10px] tracking-wider mb-2">Timeline Milestones</h4>
                <div className="border border-[#E6E8F0] rounded-xl p-3 space-y-2">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-[#6B7490]">Released Date:</span>
                    <span className="font-medium text-[#1B2236]">{selectedOffer.releaseDate ? new Date(selectedOffer.releaseDate).toLocaleDateString('en-IN') : '—'}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-[#6B7490]">Accepted Date:</span>
                    <span className="font-medium text-[#1B2236]">{selectedOffer.acceptedAt ? new Date(selectedOffer.acceptedAt).toLocaleDateString('en-IN') : '—'}</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-[#6B7490]">Target Joining:</span>
                    <span className="font-medium text-[#1B2236]">{selectedOffer.joiningDate ? new Date(selectedOffer.joiningDate).toLocaleDateString('en-IN') : '—'}</span>
                  </div>
                  {selectedOffer.declinedAt && (
                    <div className="flex justify-between text-[11px] text-[#D92D20]">
                      <span>Declined Date:</span>
                      <span className="font-medium">{new Date(selectedOffer.declinedAt).toLocaleDateString('en-IN')}</span>
                    </div>
                  )}
                  {selectedOffer.declineReason && (
                    <div className="text-[11px] text-[#D92D20] bg-[#FEE4E2] p-2 rounded-lg">
                      <strong>Reason:</strong> {selectedOffer.declineReason}
                    </div>
                  )}
                </div>
              </div>

              {selectedOffer.notes && (
                <div>
                  <h4 className="font-semibold text-[#1B2236] uppercase text-[10px] tracking-wider mb-1">Notes</h4>
                  <p className="p-3 bg-[#F6F7FB] border border-[#E6E8F0] rounded-xl text-[11px] text-[#6B7490]">
                    {selectedOffer.notes}
                  </p>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-[#E6E8F0] flex gap-2">
              {selectedOffer.status === 'DRAFT' && (
                <button
                  onClick={() => handleRelease(selectedOffer)}
                  disabled={isPending}
                  className="w-full py-2 bg-[#5B49D6] hover:bg-[#4a39b8] text-white rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Release to Candidate
                </button>
              )}
              {selectedOffer.status === 'RELEASED' && (
                <>
                  <button
                    onClick={() => handleAccept(selectedOffer)}
                    disabled={isPending}
                    className="flex-1 py-2 bg-[#12B76A] hover:bg-[#0e9f5d] text-white rounded-lg text-xs font-semibold cursor-pointer"
                  >
                    Accept Offer
                  </button>
                  <button
                    onClick={() => setIsDeclineModalOpen(true)}
                    disabled={isPending}
                    className="flex-1 py-2 bg-[#FEE4E2] hover:bg-[#FECDCA] text-[#D92D20] rounded-lg text-xs font-semibold cursor-pointer"
                  >
                    Decline
                  </button>
                </>
              )}
              {selectedOffer.status === 'ACCEPTED' && (
                <button
                  onClick={() => {
                    setConfirmForm({
                      joiningDate: new Date().toISOString().split('T')[0],
                      feeAmount: selectedOffer.agencyMarginAmount ? String(selectedOffer.agencyMarginAmount) : '',
                      paymentTerms: 'NET_30',
                    });
                    setIsConfirmModalOpen(true);
                  }}
                  disabled={isPending}
                  className="w-full py-2 bg-[#12B76A] hover:bg-[#0e9f5d] text-white rounded-lg text-xs font-semibold cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Award className="w-4 h-4" />
                  <span>Confirm Joining & Create Placement</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM JOINING MODAL */}
      {isConfirmModalOpen && selectedOffer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#E6E8F0] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E6E8F0]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#E3F6EC] text-[#12B76A] flex items-center justify-center">
                  <Award className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[#1B2236]">Confirm Candidate Joining</h3>
                  <p className="text-xs text-[#6B7490]">Placement transaction execution</p>
                </div>
              </div>
              <button onClick={() => setIsConfirmModalOpen(false)}>
                <X className="w-5 h-5 text-[#6B7490]" />
              </button>
            </div>

            <p className="text-xs text-[#6B7490] leading-relaxed">
              Confirming candidate joining will move the application status to <strong>PLACED</strong> and lock in the commercial placement fee record in the agency books.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[#1B2236] font-semibold mb-1">Actual Joining Date</label>
                <input
                  type="date"
                  value={confirmForm.joiningDate}
                  onChange={(e) => setConfirmForm({ ...confirmForm, joiningDate: e.target.value })}
                  className="w-full px-3 py-2 border border-[#E6E8F0] rounded-lg text-xs text-[#1B2236] focus:outline-none focus:border-[#5B49D6]"
                />
              </div>

              <div>
                <label className="block text-[#1B2236] font-semibold mb-1">Confirmed Agency Fee (INR)</label>
                <input
                  type="number"
                  value={confirmForm.feeAmount}
                  onChange={(e) => setConfirmForm({ ...confirmForm, feeAmount: e.target.value })}
                  placeholder="Auto-calculated from margin percentage"
                  className="w-full px-3 py-2 border border-[#E6E8F0] rounded-lg text-xs text-[#1B2236] focus:outline-none focus:border-[#5B49D6]"
                />
              </div>

              <div>
                <label className="block text-[#1B2236] font-semibold mb-1">Invoice Payment Terms</label>
                <select
                  value={confirmForm.paymentTerms}
                  onChange={(e) => setConfirmForm({ ...confirmForm, paymentTerms: e.target.value })}
                  className="w-full px-3 py-2 border border-[#E6E8F0] rounded-lg text-xs text-[#1B2236] focus:outline-none focus:border-[#5B49D6]"
                >
                  <option value="NET_15">NET 15 Days</option>
                  <option value="NET_30">NET 30 Days (Standard)</option>
                  <option value="NET_45">NET 45 Days</option>
                  <option value="NET_60">NET 60 Days</option>
                </select>
              </div>
            </div>

            <div className="pt-3 border-t border-[#E6E8F0] flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsConfirmModalOpen(false)}
                className="px-4 py-2 border border-[#E6E8F0] rounded-lg text-xs font-semibold text-[#6B7490] hover:bg-[#F6F7FB]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmJoiningSubmit}
                disabled={isPending}
                className="px-4 py-2 bg-[#12B76A] hover:bg-[#0e9f5d] text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Confirm Placement</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DECLINE OFFER MODAL */}
      {isDeclineModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#E6E8F0] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E6E8F0]">
              <h3 className="font-bold text-sm text-[#1B2236]">Decline Offer</h3>
              <button onClick={() => setIsDeclineModalOpen(false)}>
                <X className="w-5 h-5 text-[#6B7490]" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <label className="block text-[#1B2236] font-semibold">Reason for Decline</label>
              <textarea
                rows={3}
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                className="w-full px-3 py-2 border border-[#E6E8F0] rounded-lg text-xs text-[#1B2236] focus:outline-none focus:border-[#D92D20]"
              />
            </div>

            <div className="pt-3 border-t border-[#E6E8F0] flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsDeclineModalOpen(false)}
                className="px-4 py-2 border border-[#E6E8F0] rounded-lg text-xs font-semibold text-[#6B7490] hover:bg-[#F6F7FB]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeclineSubmit}
                disabled={isPending}
                className="px-4 py-2 bg-[#D92D20] hover:bg-[#b91c1c] text-white rounded-lg text-xs font-semibold"
              >
                Confirm Decline
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
