'use client';

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */

import React, { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { PageHeader } from '../../../../components/layout/PageHeader';
import {
  ArrowLeft,
  Award,
  Building2,
  Briefcase,
  User,
  Calendar,
  CreditCard,
  IndianRupee,
  FileCheck,
  ShieldCheck,
  AlertCircle,
  Clock,
  History,
  CheckCircle2,
  Plus,
  X,
  ExternalLink,
} from 'lucide-react';
import {
  getPlacementDetailsAction,
  recordPlacementPaymentAction,
  updatePlacementPaymentStatusAction,
} from '../../../../actions/placements';
import { useDevUser } from '../../../../context/DevUserContext';
import { UserRole } from '@hireflow/shared';

export default function PlacementDetailPage() {
  const { id } = useParams() as { id: string };
  const { currentRole } = useDevUser();
  const isLeadership = currentRole === UserRole.ADMIN || currentRole === UserRole.MANAGER;

  const [placement, setPlacement] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMethod: 'BANK_TRANSFER',
    referenceNumber: '',
    notes: '',
  });
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const loadPlacement = async () => {
    setLoading(true);
    try {
      const data = await getPlacementDetailsAction(id);
      setPlacement(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load placement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlacement();
  }, [id]);

  const handleRecordPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(paymentForm.amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setPaymentError('Payment amount must be greater than zero.');
      return;
    }

    if (!paymentForm.referenceNumber.trim()) {
      setPaymentError('Transaction reference / UTR number is required.');
      return;
    }

    setPaymentError(null);
    startTransition(async () => {
      try {
        await recordPlacementPaymentAction(id, {
          amount: amountNum,
          paymentDate: paymentForm.paymentDate,
          paymentMethod: paymentForm.paymentMethod as any,
          referenceNumber: paymentForm.referenceNumber.trim(),
          notes: paymentForm.notes.trim() || undefined,
        });

        setIsPaymentModalOpen(false);
        setPaymentForm({
          amount: '',
          paymentDate: new Date().toISOString().split('T')[0],
          paymentMethod: 'BANK_TRANSFER',
          referenceNumber: '',
          notes: '',
        });
        await loadPlacement();
      } catch (err: any) {
        setPaymentError(err.message || 'Failed to record payment');
      }
    });
  };

  const handleStatusChange = async (newStatus: string) => {
    startTransition(async () => {
      try {
        await updatePlacementPaymentStatusAction(id, {
          paymentStatus: newStatus as any,
        });
        await loadPlacement();
      } catch (err: any) {
        alert(err.message || 'Failed to update payment status');
      }
    });
  };

  if (loading) {
    return <div className="p-12 text-center text-slate-400">Loading placement details...</div>;
  }

  if (error || !placement) {
    return (
      <div className="p-8 max-w-xl mx-auto text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-xl font-bold text-slate-800">Placement Record Not Found</h2>
        <p className="text-slate-500 text-sm">{error || 'This placement does not exist or has been archived.'}</p>
        <Link
          href="/placements"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#5B49D6] hover:underline"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Placements
        </Link>
      </div>
    );
  }

  const { commercials, joiningConfirmation } = placement;

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Actions */}
      <div className="flex items-center justify-between">
        <Link
          href="/placements"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Placements Dashboard
        </Link>

        {isLeadership && (
          <div className="flex items-center gap-3">
            <select
              value={placement.paymentStatus}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="text-xs font-semibold border border-slate-300 rounded-lg px-3 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#5B49D6]"
            >
              <option value="PENDING">Status: Pending</option>
              <option value="INVOICED">Status: Invoiced</option>
              <option value="PARTIALLY_PAID">Status: Partially Paid</option>
              <option value="PAID">Status: Paid in Full</option>
              <option value="OVERDUE">Status: Overdue</option>
              <option value="WAIVED">Status: Waived</option>
            </select>

            <button
              onClick={() => setIsPaymentModalOpen(true)}
              className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-[#5B49D6] text-white hover:bg-[#4338ca] shadow-sm flex items-center gap-1.5 transition-all"
            >
              <Plus className="w-3.5 h-3.5" /> Record Payment
            </button>
          </div>
        )}
      </div>

      <PageHeader
        title={`Placement #${placement.id.slice(0, 8)}: ${placement.candidateName}`}
        subtitle={`Confirmed joining at ${placement.clientName} for ${placement.jobTitle} (${placement.jobCode}).`}
      />

      {/* Grid: 3 Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Candidate Overview */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-slate-800 font-bold border-b border-slate-100 pb-2">
            <User className="w-4 h-4 text-[#5B49D6]" /> Candidate Profile
          </div>
          <div className="text-sm space-y-1.5">
            <div><span className="text-slate-500">Name:</span> <strong className="text-slate-900">{placement.candidateName}</strong></div>
            {placement.candidateEmail && (
              <div><span className="text-slate-500">Email:</span> <span className="text-slate-700">{placement.candidateEmail}</span></div>
            )}
            <div>
              <span className="text-slate-500">Joining Date:</span>{' '}
              <strong className="text-emerald-700 font-semibold">
                {placement.joiningDate ? new Date(placement.joiningDate).toLocaleDateString('en-IN') : '—'}
              </strong>
            </div>
          </div>
        </div>

        {/* Card 2: Job Overview */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-slate-800 font-bold border-b border-slate-100 pb-2">
            <Briefcase className="w-4 h-4 text-[#5B49D6]" /> Job Requirement
          </div>
          <div className="text-sm space-y-1.5">
            <div><span className="text-slate-500">Title:</span> <strong className="text-slate-900">{placement.jobTitle}</strong></div>
            <div><span className="text-slate-500">Job Code:</span> <span className="font-mono text-slate-700">{placement.jobCode}</span></div>
            <div><span className="text-slate-500">Client:</span> <span className="text-slate-900 font-semibold">{placement.clientName}</span></div>
          </div>
        </div>

        {/* Card 3: Commercial Snapshot */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-2 text-slate-800 font-bold border-b border-slate-100 pb-2">
            <CreditCard className="w-4 h-4 text-[#5B49D6]" /> Billing & Settlement
          </div>
          <div className="text-sm space-y-1.5">
            <div><span className="text-slate-500">Terms:</span> <strong className="text-slate-900">{placement.paymentTerms}</strong></div>
            <div>
              <span className="text-slate-500">Due Date:</span>{' '}
              <span className="text-slate-700">
                {placement.dueDate ? new Date(placement.dueDate).toLocaleDateString('en-IN') : '—'}
              </span>
            </div>
            <div>
              <span className="text-slate-500">Payment Status:</span>{' '}
              <span className="font-semibold text-slate-900">{placement.paymentStatus}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Commercial Fee Receivables Breakdown (Leadership Protected) */}
      {commercials ? (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <IndianRupee className="w-5 h-5 text-purple-600" />
              <h3 className="text-base font-bold text-slate-900">Commercial Fee Breakdown & Receivables</h3>
            </div>
            <span className="text-xs bg-purple-50 text-purple-700 font-semibold px-2.5 py-1 rounded-md">
              Agency Commercial Contract
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            <div className="p-3 bg-slate-50 rounded-lg">
              <div className="text-xs text-slate-500">Annual CTC Snapshot</div>
              <div className="text-lg font-bold text-slate-900 mt-1">
                ₹{commercials.ctcSnapshot?.toLocaleString('en-IN')}
              </div>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg">
              <div className="text-xs text-slate-500">Agreed Fee %</div>
              <div className="text-lg font-bold text-slate-900 mt-1">
                {commercials.feePercentage ? `${commercials.feePercentage}%` : 'Fixed / Custom'}
              </div>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg">
              <div className="text-xs text-slate-500">Total Placement Fee</div>
              <div className="text-lg font-bold text-indigo-700 mt-1">
                ₹{commercials.feeAmount?.toLocaleString('en-IN')}
              </div>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg">
              <div className="text-xs text-slate-500">Balance Outstanding</div>
              <div className={`text-lg font-bold mt-1 ${commercials.balanceDue > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                ₹{commercials.balanceDue?.toLocaleString('en-IN')}
              </div>
            </div>
          </div>

          {commercials.adjustmentAmount !== 0 && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
              <strong>Fee Adjustment:</strong> ₹{commercials.adjustmentAmount.toLocaleString('en-IN')}{' '}
              {commercials.adjustmentReason && `(${commercials.adjustmentReason})`}
            </div>
          )}
        </div>
      ) : (
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500 italic">
          Commercial fee figures and agency margin details are restricted to leadership roles.
        </div>
      )}

      {/* Joining Evidence Card */}
      {joiningConfirmation && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <h3 className="text-base font-bold text-slate-900">Joining Verification Evidence</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <span className="text-slate-500">Verification Source:</span>
              <div className="font-semibold text-slate-800 mt-0.5">{joiningConfirmation.source}</div>
            </div>
            <div>
              <span className="text-slate-500">Confirmed By Contact:</span>
              <div className="font-semibold text-slate-800 mt-0.5">{joiningConfirmation.confirmedBy}</div>
            </div>
            <div>
              <span className="text-slate-500">Confirmation Date:</span>
              <div className="font-semibold text-slate-800 mt-0.5">
                {new Date(joiningConfirmation.confirmedAt).toLocaleDateString('en-IN')}
              </div>
            </div>
          </div>

          {joiningConfirmation.documentUrl && (
            <div className="pt-2">
              <a
                href={joiningConfirmation.documentUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#5B49D6] hover:underline"
              >
                <ExternalLink className="w-3.5 h-3.5" /> View Verification Document / Attachment
              </a>
            </div>
          )}

          {joiningConfirmation.notes && (
            <div className="p-3 bg-slate-50 rounded-lg text-xs text-slate-700 border border-slate-200">
              <span className="font-semibold text-slate-900">Verification Notes: </span>
              {joiningConfirmation.notes}
            </div>
          )}
        </div>
      )}

      {/* Payment Installments History */}
      {commercials && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-indigo-600" />
              <h3 className="text-base font-bold text-slate-900">Payment Installments Received</h3>
            </div>
            <span className="text-xs text-slate-500">
              Total Received: <strong className="text-emerald-700">₹{commercials.amountReceived?.toLocaleString('en-IN')}</strong>
            </span>
          </div>

          {commercials.payments && commercials.payments.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-slate-500 uppercase font-semibold">
                  <tr>
                    <th className="px-4 py-2.5">Date</th>
                    <th className="px-4 py-2.5">Amount</th>
                    <th className="px-4 py-2.5">Payment Method</th>
                    <th className="px-4 py-2.5">Ref / UTR Number</th>
                    <th className="px-4 py-2.5">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {commercials.payments.map((pm: any) => (
                    <tr key={pm.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-900 font-medium">
                        {new Date(pm.paymentDate).toLocaleDateString('en-IN')}
                      </td>
                      <td className="px-4 py-3 font-bold text-emerald-700">
                        ₹{pm.amount.toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800">{pm.paymentMethod}</td>
                      <td className="px-4 py-3 font-mono text-slate-500">{pm.referenceNumber || '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{pm.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-6 text-xs text-slate-400">
              No payments recorded yet. Click "Record Payment" to log an incoming installment.
            </div>
          )}
        </div>
      )}

      {/* MODAL: Record Payment */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Record Fee Payment</h3>
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRecordPaymentSubmit} className="mt-4 space-y-4">
              {paymentError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {paymentError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Payment Amount (₹) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder={`Outstanding: ₹${commercials?.balanceDue?.toLocaleString('en-IN')}`}
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B49D6]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Date</label>
                  <input
                    type="date"
                    required
                    value={paymentForm.paymentDate}
                    onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B49D6]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Method</label>
                  <select
                    value={paymentForm.paymentMethod}
                    onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B49D6]"
                  >
                    <option value="BANK_TRANSFER">Bank Wire / NEFT</option>
                    <option value="CHEQUE">Cheque</option>
                    <option value="UPI">UPI Transfer</option>
                    <option value="CREDIT">Credit Settlement</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reference / UTR / Cheque Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. UTR182991823"
                  value={paymentForm.referenceNumber}
                  onChange={(e) => setPaymentForm({ ...paymentForm, referenceNumber: e.target.value })}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B49D6]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Remarks</label>
                <textarea
                  rows={2}
                  placeholder="Additional settlement remarks..."
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5B49D6]"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 text-xs font-semibold rounded-lg bg-[#5B49D6] text-white hover:bg-[#4338ca] shadow-sm disabled:opacity-50"
                >
                  {isPending ? 'Recording...' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
