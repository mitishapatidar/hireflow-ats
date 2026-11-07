'use client';

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { PageHeader } from '../../../../components/layout/PageHeader';
import {
  ArrowLeft,
  History,
  Users,
  Briefcase,
  CheckSquare,
  ArrowRight,
  Filter,
} from 'lucide-react';
import { getOwnershipHistoryAction } from '../../../../actions/handover';

export default function OwnershipHistoryPage() {
  const [historyItems, setHistoryItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [entityFilter, setEntityFilter] = useState('ALL');

  const loadHistory = async () => {
    setLoading(true);
    try {
      const res = await getOwnershipHistoryAction({
        entityType: entityFilter !== 'ALL' ? entityFilter : undefined,
      });
      setHistoryItems(res.items);
    } catch (err: any) {
      console.error('Failed to load ownership history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [entityFilter]);

  const getEntityBadge = (type: string) => {
    switch (type) {
      case 'CANDIDATE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-50 text-blue-700">
            <Users className="w-3 h-3" /> Candidate
          </span>
        );
      case 'JOB':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-indigo-50 text-indigo-700">
            <Briefcase className="w-3 h-3" /> Job Opening
          </span>
        );
      case 'TASK':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-50 text-amber-700">
            <CheckSquare className="w-3 h-3" /> Task
          </span>
        );
      default:
        return <span className="text-xs text-slate-500">{type}</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/handover"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Recruiter Handover
        </Link>

        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className="text-xs font-medium border border-slate-300 rounded-lg px-3 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#5B49D6]"
          >
            <option value="ALL">All Entity Types</option>
            <option value="CANDIDATE">Candidates Only</option>
            <option value="JOB">Jobs Only</option>
            <option value="TASK">Tasks Only</option>
          </select>
        </div>
      </div>

      <PageHeader
        title="Ownership History & Portfolio Audit"
        subtitle="Permanent immutable audit log of recruiter ownership transfers across candidates, jobs, and tasks."
      />

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-12 text-center text-slate-400">Loading ownership audit history...</div>
          ) : historyItems.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <History className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="font-medium text-slate-700">No ownership transfers recorded yet</p>
              <p className="text-xs text-slate-400 mt-1">
                When recruiter handover requests are approved, immutable transition records are preserved here.
              </p>
            </div>
          ) : (
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-6 py-3.5">Entity</th>
                  <th className="px-6 py-3.5">Entity ID</th>
                  <th className="px-6 py-3.5">Transfer Path</th>
                  <th className="px-6 py-3.5">Approved By</th>
                  <th className="px-6 py-3.5">Reason</th>
                  <th className="px-6 py-3.5">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {historyItems.map((h) => (
                  <tr key={h.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">{getEntityBadge(h.entityType)}</td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-500">{h.entityId.slice(0, 12)}...</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-xs font-medium">
                        <span className="text-slate-600">{h.fromUserName}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-semibold text-slate-900">{h.toUserName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-700">{h.transferredByName || 'System'}</td>
                    <td className="px-6 py-4 text-xs text-slate-600 max-w-xs truncate">{h.reason || '—'}</td>
                    <td className="px-6 py-4 text-xs text-slate-500">
                      {new Date(h.transferredAt).toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
