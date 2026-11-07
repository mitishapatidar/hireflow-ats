'use client';

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import React, { useState, useTransition, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowLeft,
  X,
  Loader2,
  Trash2,
  Sparkles,
  Building2,
  Briefcase,
  Search,
  ExternalLink,
} from 'lucide-react';
import {
  createImportBatchAction,
  getImportBatchAction,
  reviewImportItemAction,
  createCandidateFromImportAction,
} from '@/actions/sourcing';

interface ImportBatch {
  id: string;
  batchCode: string;
  batchName: string;
  status: string;
  totalRecords: number;
  processedRecords: number;
  parsedRecords: number;
  duplicateRecords: number;
  pendingReviewCount: number;
  createdAt: string | Date;
}

interface ImportItem {
  id: string;
  fileName: string;
  status: string;
  recordData: any;
  parserConfidence: number;
  duplicateStatus: string;
  duplicateScore: number;
  duplicateReasons: string[];
  createdCandidateId?: string | null;
}

interface BulkImportClientViewProps {
  initialBatches: ImportBatch[];
  availableJobs: Array<{ id: string; title: string; code: string; department: string }>;
  currentUser: {
    id: string;
    name: string;
    role: string;
  };
}

export function BulkImportClientView({
  initialBatches,
  availableJobs,
  currentUser,
}: BulkImportClientViewProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();

  // Upload Staging State
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [batchName, setBatchName] = useState('');
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Active Batch Inspection Drawer
  const [selectedBatch, setSelectedBatch] = useState<ImportBatch | null>(null);
  const [batchItems, setBatchItems] = useState<ImportItem[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);

  // Review & Approve Single Item Modal
  const [activeItem, setActiveItem] = useState<ImportItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editCompany, setEditCompany] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editExp, setEditExp] = useState<string | number>('');
  const [editJobId, setEditJobId] = useState('');
  const [editNotes, setEditNotes] = useState('');

  // Handle Drag & Drop
  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setErrorMessage(null);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMessage(null);
    if (e.target.files && e.target.files.length > 0) {
      addFiles(Array.from(e.target.files));
    }
  };

  const addFiles = (files: File[]) => {
    const validExtensions = ['.pdf', '.doc', '.docx'];
    const maxFileSize = 10 * 1024 * 1024; // 10MB
    const validFiles: File[] = [];

    for (const f of files) {
      const ext = f.name.substring(f.name.lastIndexOf('.')).toLowerCase();
      if (!validExtensions.includes(ext)) {
        setErrorMessage(`File "${f.name}" has an invalid extension. Only PDF, DOC, and DOCX are allowed.`);
        return;
      }
      if (f.size > maxFileSize) {
        setErrorMessage(`File "${f.name}" exceeds the maximum allowed size of 10MB.`);
        return;
      }
      validFiles.push(f);
    }

    if (stagedFiles.length + validFiles.length > 50) {
      setErrorMessage('A maximum of 50 files can be uploaded in a single batch.');
      return;
    }

    setStagedFiles((prev) => [...prev, ...validFiles]);
  };

  const removeFile = (index: number) => {
    setStagedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Submit Bulk Batch
  const handleSubmitBatch = () => {
    if (stagedFiles.length === 0) {
      setErrorMessage('Please add at least one resume file.');
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setUploadProgress(10);

    startTransition(async () => {
      try {
        // Read text or prepare file metadata
        const items = await Promise.all(
          stagedFiles.map(async (file, idx) => {
            const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
            const mimeType =
              ext === '.pdf'
                ? 'application/pdf'
                : ext === '.docx'
                ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                : 'application/msword';

            // Extract plain text mock or file representation
            let rawText = '';
            try {
              rawText = await file.text();
            } catch {
              rawText = `Resume file: ${file.name}`;
            }

            return {
              fileName: file.name,
              fileKey: `resumes/bulk/${Date.now()}-${idx}-${file.name.replace(/\s+/g, '_')}`,
              mimeType,
              fileSize: file.size,
              fileChecksum: `chk_${Date.now()}_${idx}`,
              rawText: rawText.substring(0, 5000),
            };
          })
        );

        setUploadProgress(60);

        const res = await createImportBatchAction({
          fileName: batchName.trim() || `Bulk Import ${new Date().toLocaleDateString()}`,
          files: items,
        });

        setUploadProgress(100);

        if (res.success && res.data) {
          setSuccessMessage(`Successfully created batch ${res.data.batchCode}! Processed ${items.length} resumes.`);
          setStagedFiles([]);
          setBatchName('');
          setTimeout(() => {
            setUploadProgress(null);
            router.refresh();
          }, 1500);
        } else {
          setErrorMessage(res.error || 'Failed to process bulk upload batch');
          setUploadProgress(null);
        }
      } catch (err: any) {
        setErrorMessage(err.message || 'An unexpected error occurred during batch upload.');
        setUploadProgress(null);
      }
    });
  };

  // Inspect Batch Items
  const handleOpenBatch = async (batch: ImportBatch) => {
    setSelectedBatch(batch);
    setIsLoadingItems(true);
    const res = await getImportBatchAction(batch.id);
    setIsLoadingItems(false);
    if (res.success && res.data) {
      setBatchItems(res.data.items as any);
    }
  };

  // Open Edit/Approval modal for an item
  const handleOpenItemReview = (item: ImportItem) => {
    setActiveItem(item);
    const d = item.recordData || {};
    setEditName(d.name || d.fullName || item.fileName.replace(/\.[^/.]+$/, ''));
    setEditEmail(d.email || '');
    setEditPhone(d.phone || '');
    setEditCompany(d.currentCompany || '');
    setEditTitle(d.currentTitle || '');
    setEditExp(d.experienceYears ?? '');
    setEditJobId('');
    setEditNotes('');
  };

  // Approve Item to Candidate
  const handleApproveItem = () => {
    if (!activeItem) return;
    startTransition(async () => {
      // 1. Update parsed record data
      await reviewImportItemAction(activeItem.id, {
        name: editName,
        email: editEmail,
        phone: editPhone,
        currentCompany: editCompany,
        currentTitle: editTitle,
        experienceYears: editExp !== '' ? Number(editExp) : undefined,
      });

      // 2. Explicitly create candidate
      const res = await createCandidateFromImportAction(activeItem.id, {
        jobId: editJobId || undefined,
        recruiterNotes: editNotes || undefined,
      });

      if (res.success) {
        alert(`Candidate ${editName} created successfully!`);
        setActiveItem(null);
        if (selectedBatch) {
          handleOpenBatch(selectedBatch);
        }
        router.refresh();
      } else {
        alert(res.error || 'Failed to create candidate');
      }
    });
  };

  return (
    <div className="space-y-6 p-6">
      {/* Breadcrumb Header */}
      <div>
        <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
          <Link href="/sourcing" className="hover:text-slate-800 flex items-center gap-1">
            <ArrowLeft className="h-3 w-3" />
            Sourcing Workspace
          </Link>
          <span>/</span>
          <span className="font-medium text-slate-700">Bulk Resume Import</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#1E2A4A]">Bulk Resume Import</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Figma Frame 18: Upload and parse resume batches with automatic duplicate checking and human review.
            </p>
          </div>
          <Link
            href="/sourcing"
            className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            View Sourcing Queue
          </Link>
        </div>
      </div>

      {/* Drag & Drop Upload Zone */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-base font-semibold text-[#1E2A4A] flex items-center gap-2">
            <UploadCloud className="h-5 w-5 text-[#5B49D6]" />
            Upload New Batch (Up to 50 Resumes)
          </h2>
          <span className="text-xs text-slate-400">Supported: PDF, DOC, DOCX • Max 10MB per file</span>
        </div>

        {/* Drop Target */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleFileDrop}
          onClick={() => fileInputRef.current?.click()}
          className="group cursor-pointer rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/70 p-8 text-center transition hover:border-[#5B49D6] hover:bg-indigo-50/20"
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileInputChange}
            multiple
            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
          />
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm group-hover:scale-105 transition">
            <UploadCloud className="h-6 w-6 text-[#5B49D6]" />
          </div>
          <h3 className="mt-3 text-sm font-semibold text-slate-800">
            Drag and drop resume files here, or <span className="text-[#5B49D6] underline">browse files</span>
          </h3>
          <p className="mt-1 text-xs text-slate-400">
            Files will be scanned for viruses, parsed into structured profile entities, and cross-referenced for duplicates.
          </p>
        </div>

        {/* Staged Files List */}
        {stagedFiles.length > 0 && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">
                Staged Resumes ({stagedFiles.length} files selected)
              </span>
              <button
                onClick={() => setStagedFiles([])}
                className="text-xs text-rose-600 hover:text-rose-700 font-medium"
              >
                Clear All
              </button>
            </div>

            <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 rounded-lg border border-slate-200 bg-slate-50/50">
              {stagedFiles.map((file, idx) => (
                <div key={idx} className="flex items-center justify-between px-3.5 py-2 text-xs">
                  <div className="flex items-center gap-2 truncate">
                    <FileText className="h-4 w-4 text-slate-400 shrink-0" />
                    <span className="font-medium text-slate-800 truncate">{file.name}</span>
                    <span className="text-slate-400">({(file.size / 1024).toFixed(0)} KB)</span>
                  </div>
                  <button
                    onClick={() => removeFile(idx)}
                    className="p-1 text-slate-400 hover:text-rose-600"
                    title="Remove file"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-2">
              <input
                type="text"
                placeholder="Optional Batch Name (e.g. Q4 Senior Java Engineers)..."
                value={batchName}
                onChange={(e) => setBatchName(e.target.value)}
                className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:border-[#5B49D6] focus:outline-none"
              />
              <button
                onClick={handleSubmitBatch}
                disabled={isPending || uploadProgress !== null}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#5B49D6] px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#4C3EC2] disabled:opacity-50 transition"
              >
                {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Start Batch Upload & Parse
              </button>
            </div>
          </div>
        )}

        {/* Progress Bar */}
        {uploadProgress !== null && (
          <div className="space-y-1.5 pt-2">
            <div className="flex justify-between text-xs font-medium text-slate-600">
              <span>Processing batch resumes & scanning duplicates...</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full bg-[#5B49D6] transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Error / Success Banners */}
        {errorMessage && (
          <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs font-semibold text-rose-800 flex items-center justify-between">
            <span>{errorMessage}</span>
            <button onClick={() => setErrorMessage(null)}>
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {successMessage && (
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs font-semibold text-emerald-800 flex items-center justify-between">
            <span>{successMessage}</span>
            <button onClick={() => setSuccessMessage(null)}>
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Batches History Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
          <h2 className="text-base font-semibold text-[#1E2A4A]">Import Batches History</h2>
          <p className="text-xs text-slate-500">
            Batches are held in Awaiting Review until individual candidates are approved.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="border-b border-slate-200 bg-slate-50/50 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-6 py-3.5">Batch Details</th>
                <th className="px-6 py-3.5">Created Date</th>
                <th className="px-6 py-3.5">Progress & Counts</th>
                <th className="px-6 py-3.5">Duplicates Flagged</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {initialBatches.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-400 text-xs">
                    No bulk resume batches uploaded yet.
                  </td>
                </tr>
              ) : (
                initialBatches.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/70 transition">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-[#1E2A4A]">{b.batchName}</div>
                      <div className="text-xs font-mono text-slate-400 mt-0.5">{b.batchCode}</div>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500">
                      {new Date(b.createdAt).toLocaleDateString()} at{' '}
                      {new Date(b.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs font-medium text-slate-700">
                        {b.processedRecords} / {b.totalRecords} files processed
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {b.pendingReviewCount} awaiting review
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {b.duplicateRecords > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700 border border-rose-200">
                          <AlertTriangle className="h-3 w-3" />
                          {b.duplicateRecords} Flagged
                        </span>
                      ) : (
                        <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          0 Duplicates
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          b.status === 'COMPLETED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : b.status === 'CANCELLED'
                            ? 'bg-slate-100 text-slate-600'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {b.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleOpenBatch(b)}
                        className="inline-flex items-center gap-1 rounded-md bg-[#5B49D6]/10 px-3 py-1.5 text-xs font-semibold text-[#5B49D6] hover:bg-[#5B49D6]/20 transition"
                      >
                        Inspect Batch Items
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Batch Items Inspection Drawer */}
      {selectedBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-4xl rounded-xl border border-slate-200 bg-white shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50">
              <div>
                <h3 className="text-base font-bold text-[#1E2A4A]">{selectedBatch.batchName}</h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">{selectedBatch.batchCode}</p>
              </div>
              <button
                onClick={() => setSelectedBatch(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {isLoadingItems ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-[#5B49D6]" />
                </div>
              ) : batchItems.length === 0 ? (
                <p className="text-center text-xs text-slate-400 py-8">No items in this batch.</p>
              ) : (
                <div className="overflow-hidden rounded-lg border border-slate-200">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="border-b border-slate-200 bg-slate-50 font-semibold uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-4 py-3">File / Parsed Candidate</th>
                        <th className="px-4 py-3">Contact</th>
                        <th className="px-4 py-3">Parser Confidence</th>
                        <th className="px-4 py-3">Duplicate Check</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Review</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {batchItems.map((item) => {
                        const d = item.recordData || {};
                        return (
                          <tr key={item.id} className="hover:bg-slate-50">
                            <td className="px-4 py-3">
                              <div className="font-semibold text-[#1E2A4A]">
                                {d.name || d.fullName || item.fileName}
                              </div>
                              <div className="text-[11px] text-slate-400 flex items-center gap-1">
                                <FileText className="h-3 w-3" />
                                {item.fileName}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                              <div>{d.email || 'No email found'}</div>
                              <div className="text-slate-400">{d.phone || ''}</div>
                            </td>
                            <td className="px-4 py-3 font-semibold text-slate-700">
                              {Math.round(item.parserConfidence * 100)}%
                            </td>
                            <td className="px-4 py-3">
                              {item.duplicateStatus === 'DUPLICATE_FOUND' ? (
                                <span className="inline-flex items-center gap-1 rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-700 border border-rose-200">
                                  <AlertTriangle className="h-2.5 w-2.5" />
                                  {item.duplicateScore}% Match
                                </span>
                              ) : (
                                <span className="text-emerald-600 font-medium">Unique</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                                  item.status === 'APPROVED'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {item.status.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              {item.status !== 'APPROVED' ? (
                                <button
                                  onClick={() => handleOpenItemReview(item)}
                                  className="rounded bg-[#5B49D6] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#4C3EC2]"
                                >
                                  Review
                                </button>
                              ) : (
                                <span className="text-[11px] text-emerald-600 font-semibold">Approved ✓</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="flex justify-end border-t border-slate-200 px-6 py-3 bg-slate-50">
              <button
                onClick={() => setSelectedBatch(null)}
                className="rounded-lg border border-slate-200 bg-white px-4 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Individual Candidate Review & Job Mapping Dialog */}
      {activeItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50">
              <h3 className="text-base font-bold text-[#1E2A4A]">Explicit Human Review & Approval</h3>
              <button
                onClick={() => setActiveItem(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Candidate Name *</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full rounded border border-slate-200 px-2.5 py-1.5 text-xs text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full rounded border border-slate-200 px-2.5 py-1.5 text-xs text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Phone</label>
                  <input
                    type="text"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full rounded border border-slate-200 px-2.5 py-1.5 text-xs text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Current Company</label>
                  <input
                    type="text"
                    value={editCompany}
                    onChange={(e) => setEditCompany(e.target.value)}
                    className="w-full rounded border border-slate-200 px-2.5 py-1.5 text-xs text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Current Title</label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full rounded border border-slate-200 px-2.5 py-1.5 text-xs text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Map to Active Job</label>
                  <select
                    value={editJobId}
                    onChange={(e) => setEditJobId(e.target.value)}
                    className="w-full rounded border border-slate-200 px-2.5 py-1.5 text-xs text-slate-800"
                  >
                    <option value="">No Mapping (General Pool)</option>
                    {availableJobs.map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Recruiter Notes</label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Notes from resume parsing review..."
                  rows={2}
                  className="w-full rounded border border-slate-200 px-2.5 py-1.5 text-xs text-slate-800"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-3 bg-slate-50">
              <button
                onClick={() => setActiveItem(null)}
                className="rounded border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleApproveItem}
                disabled={isPending || !editName.trim()}
                className="inline-flex items-center gap-1.5 rounded bg-[#5B49D6] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#4C3EC2]"
              >
                {isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                Confirm & Create Candidate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
