'use client';

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */

import React, { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
import { PageHeader } from '../../../components/layout/PageHeader';
import {
  CheckCircle2,
  Clock,
  TrendingUp,
  Award,
  Search,
  Filter,
  ArrowRight,
  X,
  AlertCircle,
  Building2,
  Briefcase,
  User,
  Calendar,
  IndianRupee,
  FileCheck,
  ChevronRight,
  DollarSign,
  ShieldCheck,
  CreditCard,
} from 'lucide-react';
import {
  getPlacementStatsAction,
  getPlacementsAction,
  getUpcomingJoiningOffersAction,
} from '../../../actions/placements';
import { confirmJoiningAction } from '../../../actions/offers';
import { useDevUser } from '../../../context/DevUserContext';
import { UserRole } from '@hireflow/shared';

export default function PlacementsDashboardPage() {
  const { currentRole } = useDevUser();
  const isLeadership = currentRole === UserRole.ADMIN || currentRole === UserRole.MANAGER;

  const [activeTab, setActiveTab] = useState<'PLACEMENTS' | 'UPCOMING'>('PLACEMENTS');
  const [stats, setStats] = useState<{
    totalConfirmedPlacements: number;
    placementsMtd: number;
    upcomingJoiningDates: number;
    pendingFeePayments: number;
    totalFeeBookedMtd: number | null;
  } | null>(null);

  const [placements, setPlacements] = useState<any[]>([]);
  const [upcomingOffers, setUpcomingOffers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('ALL');

  // Modal State for Confirming Joining & Evidence
  const [selectedOfferForJoining, setSelectedOfferForJoining] = useState<any | null>(null);
  const [confirmForm, setConfirmForm] = useState({
    joinedAt: new Date().toISOString().split('T')[0],
    source: 'CLIENT_EMAIL',
    confirmedBy: '',
    documentUrl: '',
    paymentTerms: 'NET_30',
    adjustmentAmount: '0',
    adjustmentReason: '',
    notes: '',
  });
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsRes, placementsRes, upcomingRes] = await Promise.all([
        getPlacementStatsAction(),
        getPlacementsAction({
          paymentStatus: paymentStatusFilter !== 'ALL' ? paymentStatusFilter : undefined,
          search: searchQuery.trim() || undefined,
        }),
        getUpcomingJoiningOffersAction(),
      ]);

      setStats(statsRes);
      setPlacements(placementsRes.items);
      setUpcomingOffers(upcomingRes);
    } catch (err: any) {
      console.error('Failed to load placements data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [paymentStatusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const openConfirmModal = (offer: any) => {
    setSelectedOfferForJoining(offer);
    setConfirmForm({
      joinedAt: offer.joiningDate
        ? new Date(offer.joiningDate).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0],
      source: 'CLIENT_EMAIL',
      confirmedBy: '',
      documentUrl: '',
      paymentTerms: 'NET_30',
      adjustmentAmount: '0',
      adjustmentReason: '',
      notes: '',
    });
    setConfirmError(null);
  };

  const handleConfirmJoiningSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOfferForJoining) return;

    if (!confirmForm.confirmedBy.trim()) {
      setConfirmError('Please specify the person or department confirming candidate joining.');
      return;
    }

    setConfirmError(null);
    startTransition(async () => {
      try {
        await confirmJoiningAction(selectedOfferForJoining.id, {
          joinedAt: confirmForm.joinedAt,
          paymentTerms: confirmForm.paymentTerms,
          adjustmentAmount: parseFloat(confirmForm.adjustmentAmount) || 0,
          adjustmentReason: confirmForm.adjustmentReason.trim() || undefined,
          joiningEvidence: {
            source: confirmForm.source as any,
            confirmedBy: confirmForm.confirmedBy.trim(),
            confirmedAt: new Date(confirmForm.joinedAt).toISOString(),
            documentUrl: confirmForm.documentUrl.trim() || undefined,
            notes: confirmForm.notes.trim() || undefined,
          },
        } as any);

        setSelectedOfferForJoining(null);
        await loadData();
      } catch (err: any) {
        setConfirmError(err.message || 'Failed to confirm candidate joining');
      }
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PAID':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">Paid in Full</span>;
      case 'PARTIALLY_PAID':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">Partially Paid</span>;
      case 'INVOICED':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">Invoiced</span>;
      case 'OVERDUE':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">Overdue</span>;
      case 'WAIVED':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">Waived</span>;
      case 'PENDING':
      default:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-800">Pending Invoice</span>;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Placements & Commercial Records"
        subtitle="Figma Frame 40: Confirmed placements, candidate joining verification, commercial fee billing, and payment settlements."
      />

      {/* 5 KPI Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* KPI 1: Total Confirmed */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wider text-slate-500 uppercase">Total Confirmed</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">{stats?.totalConfirmedPlacements ?? '—'}</div>
            <p className="text-xs text-slate-500 mt-0.5">All-time confirmed placements</p>
          </div>
        </div>

        {/* KPI 2: Placements MTD */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wider text-slate-500 uppercase">Placements MTD</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">{stats?.placementsMtd ?? '—'}</div>
            <p className="text-xs text-slate-500 mt-0.5">Joined in current month</p>
          </div>
        </div>

        {/* KPI 3: Upcoming Joining Dates */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wider text-slate-500 uppercase">Upcoming Joinees</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">{stats?.upcomingJoiningDates ?? '—'}</div>
            <p className="text-xs text-slate-500 mt-0.5">Offers accepted awaiting joining</p>
          </div>
        </div>

        {/* KPI 4: Pending Fee Payments */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wider text-slate-500 uppercase">Pending Payments</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">{stats?.pendingFeePayments ?? '—'}</div>
            <p className="text-xs text-slate-500 mt-0.5">Placements with pending balance</p>
          </div>
        </div>

        {/* KPI 5: Total Fee Booked MTD */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wider text-slate-500 uppercase">Fee Booked MTD</span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <IndianRupee className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">
              {stats?.totalFeeBookedMtd !== null && stats?.totalFeeBookedMtd !== undefined
                ? `₹${stats.totalFeeBookedMtd.toLocaleString('en-IN')}`
                : isLeadership
                ? '₹0'
                : 'Restricted'}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {isLeadership ? 'Agency gross receivables booked' : 'Leadership authorization required'}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs & Search Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 px-6 pt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex space-x-6">
            <button
              onClick={() => setActiveTab('PLACEMENTS')}
              className={`pb-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
                activeTab === 'PLACEMENTS'
                  ? 'border-[#5B49D6] text-[#5B49D6]'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Award className="w-4 h-4" />
              Confirmed Placements ({placements.length})
            </button>
            <button
              onClick={() => setActiveTab('UPCOMING')}
              className={`pb-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
                activeTab === 'UPCOMING'
                  ? 'border-[#5B49D6] text-[#5B49D6]'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Clock className="w-4 h-4" />
              Upcoming Joining Dates ({upcomingOffers.length})
            </button>
          </div>

          {activeTab === 'PLACEMENTS' && (
            <div className="pb-3 flex items-center gap-3">
              <select
                value={paymentStatusFilter}
                onChange={(e) => setPaymentStatusFilter(e.target.value)}
                className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 bg-slate-50 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-[#5B49D6]"
              >
                <option value="ALL">All Payment Statuses</option>
                <option value="PENDING">Pending</option>
                <option value="INVOICED">Invoiced</option>
                <option value="PARTIALLY_PAID">Partially Paid</option>
                <option value="PAID">Paid in Full</option>
                <option value="OVERDUE">Overdue</option>
                <option value="WAIVED">Waived</option>
              </select>

              <form onSubmit={handleSearchSubmit} className="relative">
                <input
                  type="text"
                  placeholder="Search candidate, client, invoice..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="text-xs pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#5B49D6] w-64"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
              </form>
            </div>
          )}
        </div>

        {/* Tab 1: Confirmed Placements Table */}
        {activeTab === 'PLACEMENTS' && (
          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-12 text-center text-slate-400">Loading placement records...</div>
            ) : placements.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                <Award className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="font-medium text-slate-700">No confirmed placements found</p>
                <p className="text-xs text-slate-400 mt-1">
                  Accepted offers can be confirmed when candidates formally join in the Upcoming Joinees tab.
                </p>
              </div>
            ) : (
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="px-6 py-3.5">Candidate</th>
                    <th className="px-6 py-3.5">Job Requirement</th>
                    <th className="px-6 py-3.5">Client</th>
                    <th className="px-6 py-3.5">Joining Date</th>
                    <th className="px-6 py-3.5">Commercial Fee</th>
                    <th className="px-6 py-3.5">Payment Terms & Due</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {placements.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900">{p.candidateName}</div>
                        {p.candidateEmail && (
                          <div className="text-xs text-slate-400">{p.candidateEmail}</div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-800">{p.jobTitle}</div>
                        <div className="text-xs text-slate-400 font-mono">{p.jobCode}</div>
                      </td>
                      <td className="px-6 py-4 text-slate-800 font-medium">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          {p.clientName}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {p.joiningDate ? new Date(p.joiningDate).toLocaleDateString('en-IN') : '—'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {p.commercials ? (
                          <div>
                            <div className="font-semibold text-slate-900">
                              ₹{p.commercials.feeAmount?.toLocaleString('en-IN')}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              CTC: ₹{(p.commercials.ctcSnapshot / 100000).toFixed(1)}L
                              {p.commercials.feePercentage ? ` @ ${p.commercials.feePercentage}%` : ''}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Confidential</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-xs font-medium text-slate-800">{p.paymentTerms || 'NET_30'}</div>
                        <div className="text-[11px] text-slate-400">
                          Due: {p.dueDate ? new Date(p.dueDate).toLocaleDateString('en-IN') : '—'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {getStatusBadge(p.paymentStatus)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/placements/${p.id}`}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-[#5B49D6] hover:text-[#4338ca] hover:underline"
                        >
                          Details <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Tab 2: Upcoming Joining Dates (Accepted Offers) */}
        {activeTab === 'UPCOMING' && (
          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-12 text-center text-slate-400">Loading upcoming joinees...</div>
            ) : upcomingOffers.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                <Clock className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="font-medium text-slate-700">No accepted offers pending joining</p>
                <p className="text-xs text-slate-400 mt-1">
                  When candidates accept released offers in the Offers module, they appear here awaiting onboarding confirmation.
                </p>
              </div>
            ) : (
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="px-6 py-3.5">Candidate</th>
                    <th className="px-6 py-3.5">Job Requirement</th>
                    <th className="px-6 py-3.5">Client Company</th>
                    <th className="px-6 py-3.5">Offered Annual CTC</th>
                    <th className="px-6 py-3.5">Expected Joining</th>
                    <th className="px-6 py-3.5">Agreed Fee %</th>
                    <th className="px-6 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {upcomingOffers.map((o) => (
                    <tr key={o.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900">{o.candidateName}</div>
                        <div className="text-xs text-slate-400">{o.candidateEmail}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-800">{o.jobTitle}</div>
                        <div className="text-xs text-slate-400 font-mono">{o.jobCode}</div>
                      </td>
                      <td className="px-6 py-4 text-slate-800 font-medium">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          {o.clientName}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-900">
                        ₹{(o.offeredSalary / 100000).toFixed(2)} Lakhs
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-blue-700 font-semibold bg-blue-50 px-2.5 py-1 rounded-md w-fit">
                          <Calendar className="w-3.5 h-3.5 text-blue-500" />
                          {o.joiningDate ? new Date(o.joiningDate).toLocaleDateString('en-IN') : 'Pending date'}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-700">
                        {o.clientFeePercentage ? `${o.clientFeePercentage}%` : 'Standard terms'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => openConfirmModal(o)}
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#5B49D6] text-white hover:bg-[#4338ca] shadow-sm transition-all"
                        >
                          Confirm Joining & Book Fee
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* MODAL: Confirm Joining & Verify Evidence */}
      {selectedOfferForJoining && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#5B49D6]" />
                <h3 className="text-lg font-bold text-slate-900">Confirm Candidate Joining</h3>
              </div>
              <button
                onClick={() => setSelectedOfferForJoining(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmJoiningSubmit} className="mt-4 space-y-4">
              {confirmError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {confirmError}
                </div>
              )}

              {/* Readonly Candidate & Job Info */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1">
                <div><span className="font-semibold text-slate-700">Candidate:</span> {selectedOfferForJoining.candidateName}</div>
                <div><span className="font-semibold text-slate-700">Job:</span> {selectedOfferForJoining.jobTitle} ({selectedOfferForJoining.jobCode})</div>
                <div><span className="font-semibold text-slate-700">Client:</span> {selectedOfferForJoining.clientName}</div>
                <div><span className="font-semibold text-slate-700">Offered Salary:</span> ₹{selectedOfferForJoining.offeredSalary?.toLocaleString('en-IN')}</div>
              </div>

              {/* Joining Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Actual Joining Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={confirmForm.joinedAt}
                  onChange={(e) => setConfirmForm({ ...confirmForm, joinedAt: e.target.value })}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B49D6]"
                />
              </div>

              {/* Verification Evidence Source */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Verification Source <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={confirmForm.source}
                    onChange={(e) => setConfirmForm({ ...confirmForm, source: e.target.value })}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B49D6]"
                  >
                    <option value="CLIENT_EMAIL">Client HR / Hiring Email</option>
                    <option value="HR_CONFIRMATION">Formal HR Onboarding Mail</option>
                    <option value="CLIENT_FINANCE">Finance Accounts Confirmation</option>
                    <option value="RECRUITER_VERIFIED">Recruiter Day 1 Check-in</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Confirmed By (Contact) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rahul Sharma (HR Head)"
                    value={confirmForm.confirmedBy}
                    onChange={(e) => setConfirmForm({ ...confirmForm, confirmedBy: e.target.value })}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B49D6]"
                  />
                </div>
              </div>

              {/* Verification Document URL */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Evidence Document / Screenshot URL (Optional)
                </label>
                <input
                  type="url"
                  placeholder="https://drive.google.com/... or https://storage..."
                  value={confirmForm.documentUrl}
                  onChange={(e) => setConfirmForm({ ...confirmForm, documentUrl: e.target.value })}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B49D6]"
                />
              </div>

              {/* Payment Terms & Commercial Adjustment */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Terms</label>
                  <select
                    value={confirmForm.paymentTerms}
                    onChange={(e) => setConfirmForm({ ...confirmForm, paymentTerms: e.target.value })}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B49D6]"
                  >
                    <option value="NET_15">Net 15 Days</option>
                    <option value="NET_30">Net 30 Days (Standard)</option>
                    <option value="NET_45">Net 45 Days</option>
                    <option value="NET_60">Net 60 Days</option>
                    <option value="IMMEDIATE">Immediate / Due on Receipt</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Fee Adjustment (₹)</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="e.g. 0 or -5000"
                    value={confirmForm.adjustmentAmount}
                    onChange={(e) => setConfirmForm({ ...confirmForm, adjustmentAmount: e.target.value })}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B49D6]"
                  />
                </div>
              </div>

              {/* Verification Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Verification Notes</label>
                <textarea
                  rows={2}
                  placeholder="Notes on Day 1 check-in, orientation, or commercial remarks..."
                  value={confirmForm.notes}
                  onChange={(e) => setConfirmForm({ ...confirmForm, notes: e.target.value })}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B49D6]"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedOfferForJoining(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 text-xs font-semibold rounded-lg bg-[#5B49D6] text-white hover:bg-[#4338ca] shadow-sm disabled:opacity-50"
                >
                  {isPending ? 'Verifying & Booking Fee...' : 'Confirm Joining & Book Placement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
