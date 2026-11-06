'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { X, ExternalLink, Loader2, AlertCircle } from 'lucide-react';
import { getApplicationDrawerAction, addApplicationNoteAction } from '@/actions/pipeline';

interface CandidateDrawerProps {
  applicationId: string;
  onClose: () => void;
  onReject: (applicationId: string) => void;
}

type Tab = 'summary' | 'notes' | 'activity';

export function CandidateDrawer({ applicationId, onClose, onReject }: CandidateDrawerProps) {
  const [data, setData] = useState<Awaited<ReturnType<typeof getApplicationDrawerAction>>['data']>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('summary');
  const [note, setNote] = useState('');
  const [isSaving, startSave] = useTransition();

  useEffect(() => {
    setLoading(true);
    getApplicationDrawerAction(applicationId).then((res) => {
      if (res.error) setError(res.error);
      else setData(res.data);
      setLoading(false);
    });
  }, [applicationId]);

  function handleAddNote() {
    if (!note.trim()) return;
    startSave(async () => {
      const res = await addApplicationNoteAction(applicationId, note.trim());
      if (res.success) {
        setNote('');
        const updated = await getApplicationDrawerAction(applicationId);
        if (updated.data) setData(updated.data);
      }
    });
  }

  return (
    <div className="fixed inset-0 z-40 flex" aria-modal="true" role="dialog">
      {/* Backdrop */}
      <div className="flex-1 bg-black/30" onClick={onClose} />

      {/* Drawer */}
      <div className="w-full max-w-md bg-white shadow-2xl flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">Candidate Details</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700" aria-label="Close drawer">
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          </div>
        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-red-600 px-6">
            <AlertCircle className="h-8 w-8" />
            <p className="text-sm">{error}</p>
          </div>
        ) : data ? (
          <>
            {/* Candidate Overview */}
            <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center flex-shrink-0">
                  {(data.candidateName || 'C').split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900">{data.candidateName}</p>
                  <p className="text-xs text-gray-500 font-mono">{data.candidateCode}</p>
                  {data.currentTitle && (
                    <p className="text-sm text-gray-600 truncate">
                      {data.currentTitle}{data.currentCompany ? ` @ ${data.currentCompany}` : ''}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-3 text-xs text-gray-600">
                <span>📧 {data.email}</span>
                {data.phone && <span>📞 {data.phone}</span>}
                {data.experienceYears != null && <span>🕒 {data.experienceYears}y experience</span>}
                {data.expectedSalary && <span>💰 {data.expectedSalary}</span>}
                {data.noticePeriod && <span>📅 {data.noticePeriod} notice</span>}
                <span className="col-span-2">
                  Stage: <strong>{data.stageName}</strong>
                </span>
              </div>

              {data.skills && data.skills.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {data.skills.map((s) => (
                    <span key={s} className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                      {s}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2 mt-3">
                <a
                  href={`/candidates/${data.candidateId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                >
                  <ExternalLink className="h-3 w-3" /> Full Profile
                </a>
                <button
                  onClick={() => onReject(applicationId)}
                  className="ml-auto text-xs text-red-600 hover:text-red-800 hover:underline"
                >
                  Reject Candidate
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 px-2">
              {(['summary', 'notes', 'activity'] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-4 py-2.5 text-xs font-medium capitalize transition ${
                    tab === t
                      ? 'border-b-2 border-blue-600 text-blue-600'
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  {t === 'summary' ? 'Summary' : t === 'notes' ? 'Notes' : 'Activity'}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {tab === 'summary' && (
                <div className="space-y-3 text-sm text-gray-700">
                  <p><strong>Applied:</strong> {new Date(data.appliedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                  <p><strong>Current Stage:</strong> {data.stageName}</p>
                  <p className="text-gray-500 italic">View full profile for resume and detailed documents.</p>
                </div>
              )}

              {tab === 'notes' && (
                <div className="space-y-4">
                  <div className="flex flex-col gap-2">
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Add an internal note (not visible to candidates)…"
                      rows={3}
                      className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    />
                    <button
                      onClick={handleAddNote}
                      disabled={isSaving || !note.trim()}
                      className="self-end flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition"
                    >
                      {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                      Add Note
                    </button>
                  </div>
                  <div className="space-y-3">
                    {data.notes.length === 0 ? (
                      <p className="text-xs text-gray-400 italic">No notes yet.</p>
                    ) : (
                      data.notes.map((n) => (
                        <div key={n.id} className="bg-gray-50 rounded-lg p-3">
                          <p className="text-sm text-gray-800">{n.content}</p>
                          <p className="text-xs text-gray-400 mt-1">
                            {new Date(n.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {tab === 'activity' && (
                <div className="relative">
                  <div className="absolute left-3 top-0 bottom-0 w-px bg-gray-200" />
                  <div className="space-y-4 pl-7">
                    {data.stageHistory.length === 0 ? (
                      <p className="text-xs text-gray-400 italic">No stage history yet.</p>
                    ) : (
                      data.stageHistory.map((h, i) => (
                        <div key={i} className="relative">
                          <div className="absolute -left-4 top-0.5 h-2 w-2 rounded-full bg-blue-500 ring-2 ring-white" />
                          <p className="text-sm font-medium text-gray-800">
                            Stage: <strong>{h.stage}</strong>
                          </p>
                          {h.comments && <p className="text-xs text-gray-500">{h.comments}</p>}
                          <p className="text-xs text-gray-400">
                            {new Date(h.changedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
