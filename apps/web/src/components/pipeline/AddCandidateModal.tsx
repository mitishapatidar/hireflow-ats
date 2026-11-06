'use client';

import React, { useState, useTransition } from 'react';
import { X, Search, Loader2, AlertCircle, CheckCircle, ExternalLink } from 'lucide-react';
import { searchAvailableCandidatesAction, addCandidateToJobAction } from '@/actions/pipeline';

interface AddCandidateModalProps {
  jobId: string;
  onClose: () => void;
  onAdded: () => void;
}

type SearchResult = {
  id: string;
  code: string;
  name: string;
  currentTitle: string | null;
  currentCompany: string | null;
  alreadyApplied: boolean;
};

export function AddCandidateModal({ jobId, onClose, onAdded }: AddCandidateModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleSearch() {
    if (query.trim().length < 2) return;
    setSearching(true);
    setError(null);
    try {
      const res = await searchAvailableCandidatesAction(jobId, query.trim());
      setResults(res.candidates);
      if (res.candidates.length === 0) setError('No candidates found matching your search.');
    } catch {
      setError('Search failed. Please try again.');
    } finally {
      setSearching(false);
    }
  }

  function handleAdd(candidateId: string) {
    setAdding(candidateId);
    setAddError(null);
    startTransition(async () => {
      const result = await addCandidateToJobAction(jobId, candidateId);
      if (result.success) {
        onAdded();
      } else if (result.code === 'DUPLICATE_APPLICATION') {
        setAddError('This candidate has already been added to this job.');
        setAdding(null);
      } else {
        setAddError(result.error ?? 'Failed to add candidate');
        setAdding(null);
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" aria-modal="true" role="dialog">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">Add Candidate to Pipeline</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Search */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
                placeholder="Search by name, email, or code…"
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={searching || query.trim().length < 2}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition"
            >
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Search
            </button>
          </div>

          {addError && (
            <div className="flex items-center gap-2 text-red-600 text-sm">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {addError}
            </div>
          )}

          {/* Results */}
          {results.length > 0 && (
            <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-72 overflow-y-auto">
              {results.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium text-gray-900">{c.name}</p>
                      <span className="text-xs font-mono text-gray-400">{c.code}</span>
                      {c.alreadyApplied && (
                        <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full">Already applied</span>
                      )}
                    </div>
                    {c.currentTitle && (
                      <p className="text-xs text-gray-500 truncate">
                        {c.currentTitle}{c.currentCompany ? ` @ ${c.currentCompany}` : ''}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <a
                      href={`/candidates/${c.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-400 hover:text-blue-600"
                      title="Open profile"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                    {c.alreadyApplied ? (
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <CheckCircle className="h-3.5 w-3.5 text-green-500" /> Added
                      </span>
                    ) : (
                      <button
                        onClick={() => handleAdd(c.id)}
                        disabled={isPending && adding === c.id}
                        className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline disabled:opacity-50"
                      >
                        {adding === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Add'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {error && (
            <p className="text-sm text-gray-500 italic">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <a
            href="/candidates/new"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 hover:underline flex items-center gap-1"
          >
            <ExternalLink className="h-3 w-3" /> Create new candidate
          </a>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
