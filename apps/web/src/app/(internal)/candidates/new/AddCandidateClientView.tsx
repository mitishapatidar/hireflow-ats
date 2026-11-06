'use client';

import React, { useState, useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  UploadCloud,
  FileText,
  AlertTriangle,
  CheckCircle,
  X,
  ExternalLink,
  Lock,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import {
  AuthUser,
  ParsedResumeReview,
  DuplicateCandidateMatch,
  formatINR,
} from '@hireflow/shared';
import {
  parseResumeAction,
  checkCandidateDuplicateAction,
  createCandidateAction,
} from '@/actions/candidates';

interface ActiveRecruiter {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface AddCandidateClientViewProps {
  currentUser: AuthUser | null;
  activeRecruiters: ActiveRecruiter[];
}

export function AddCandidateClientView({
  currentUser,
  activeRecruiters,
}: AddCandidateClientViewProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();

  // Mode: Upload or Manual Entry
  const [isManualEntry, setIsManualEntry] = useState(false);
  const [activeTab, setActiveTab] = useState<'resume' | 'contact' | 'ownership'>('resume');

  // Drag and drop state
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [extractionTimeMs, setExtractionTimeMs] = useState<number | null>(null);

  // Resume Document Metadata
  const [uploadedResume, setUploadedResume] = useState<ParsedResumeReview['fileMetadata'] | null>(
    null
  );
  const [sourcePreview, setSourcePreview] = useState<{
    rawSummary: string;
    sourceSnippets: string[];
    fieldsCount: number;
  } | null>(null);

  // Candidate Form Fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [currentTitle, setCurrentTitle] = useState('');
  const [currentCompany, setCurrentCompany] = useState('');
  const [experienceYears, setExperienceYears] = useState<string>('');
  const [currentSalary, setCurrentSalary] = useState<string>('');
  const [expectedSalary, setExpectedSalary] = useState<string>('');
  const [location, setLocation] = useState('');
  const [noticePeriod, setNoticePeriod] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState('');

  // Ownership & Notes
  const [ownerId, setOwnerId] = useState<string>(currentUser?.id || activeRecruiters[0]?.id || '');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [notes, setNotes] = useState('');

  // Confidence Tracking per Field
  const [confidenceMap, setConfidenceMap] = useState<Record<string, number>>({});

  // Duplicate Detection State
  const [duplicateMatches, setDuplicateMatches] = useState<DuplicateCandidateMatch[]>([]);

  // Success / Error banner
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // --------------------------------------------------------------------------
  // File Upload & Parsing Handler
  // --------------------------------------------------------------------------
  async function handleFileUpload(file: File) {
    setUploadError(null);
    setStatusMessage(null);
    setDuplicateMatches([]);

    // Basic extension check
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !['pdf', 'docx', 'doc'].includes(ext)) {
      setUploadError('Only PDF, DOC, and DOCX files are supported.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setUploadError('File size exceeds the 10 MB maximum limit.');
      return;
    }

    setIsParsing(true);
    const formData = new FormData();
    formData.append('file', file);

    startTransition(async () => {
      try {
        const res = await parseResumeAction(formData);

        if (!res.success || !res.parsed) {
          setUploadError(res.error || 'Failed to extract text from resume.');
          setIsParsing(false);
          return;
        }

        const parsed = res.parsed;
        setUploadedResume(parsed.fileMetadata);
        setExtractionTimeMs(res.extractionTimeMs || null);

        // Populate Form Fields from parsed extraction
        setName(parsed.name.value || '');
        setEmail(parsed.email.value || '');
        setPhone(parsed.phone.value || '');
        setCurrentTitle(parsed.currentTitle.value || '');
        setCurrentCompany(parsed.currentCompany.value || '');
        setExperienceYears(
          parsed.experienceYears.value !== null && parsed.experienceYears.value !== undefined
            ? String(parsed.experienceYears.value)
            : ''
        );
        setCurrentSalary(
          parsed.currentSalary.value !== null && parsed.currentSalary.value !== undefined
            ? String(parsed.currentSalary.value)
            : ''
        );
        setExpectedSalary(
          parsed.expectedSalary.value !== null && parsed.expectedSalary.value !== undefined
            ? String(parsed.expectedSalary.value)
            : ''
        );
        setLocation(parsed.location.value || '');
        setNoticePeriod(parsed.noticePeriod.value || '');
        setSkills(parsed.skills.value || []);

        // Confidence map
        setConfidenceMap({
          name: parsed.name.confidence,
          email: parsed.email.confidence,
          phone: parsed.phone.confidence,
          currentTitle: parsed.currentTitle.confidence,
          currentCompany: parsed.currentCompany.confidence,
          experienceYears: parsed.experienceYears.confidence,
          currentSalary: parsed.currentSalary.confidence,
          expectedSalary: parsed.expectedSalary.confidence,
          location: parsed.location.confidence,
          noticePeriod: parsed.noticePeriod.confidence,
          skills: parsed.skills.confidence,
        });

        // Set source preview data
        setSourcePreview({
          rawSummary: parsed.rawSummary,
          sourceSnippets: parsed.sourceSnippets,
          fieldsCount: parsed.extractedFieldsCount,
        });

        // Duplicate Check from parser result
        if (res.duplicateCheck?.isDuplicate) {
          setDuplicateMatches(res.duplicateCheck.matches);
        }

        setIsManualEntry(false);
      } catch (err: unknown) {
        setUploadError(
          err instanceof Error
            ? err.message
            : 'An unexpected error occurred during resume parsing.'
        );
      } finally {
        setIsParsing(false);
      }
    });
  }

  // --------------------------------------------------------------------------
  // Email / Phone Manual Blur Check for Duplicates
  // --------------------------------------------------------------------------
  async function checkDuplicates(overrideEmail?: string, overridePhone?: string) {
    const eVal = (overrideEmail !== undefined ? overrideEmail : email).trim();
    const pVal = (overridePhone !== undefined ? overridePhone : phone).trim();
    if (!eVal && !pVal) return;

    try {
      const res = await checkCandidateDuplicateAction(eVal, pVal);
      if (res.success && res.isDuplicate && res.matches) {
        setDuplicateMatches(res.matches);
      } else {
        setDuplicateMatches([]);
      }
    } catch {
      // Silently proceed
    }
  }

  // --------------------------------------------------------------------------
  // Skills & Tags Helpers
  // --------------------------------------------------------------------------
  function handleAddSkill() {
    if (skillInput.trim() && !skills.includes(skillInput.trim())) {
      setSkills([...skills, skillInput.trim()]);
      setSkillInput('');
    }
  }

  function handleRemoveSkill(skillToRemove: string) {
    setSkills(skills.filter((s) => s !== skillToRemove));
  }

  function handleAddTag() {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  }

  function handleRemoveTag(tagToRemove: string) {
    setTags(tags.filter((t) => t !== tagToRemove));
  }

  // --------------------------------------------------------------------------
  // Save Candidate Handler (Explicit Confirmation)
  // --------------------------------------------------------------------------
  async function handleSaveCandidate() {
    if (!name.trim()) {
      setStatusMessage({ type: 'error', text: 'Candidate name is required.' });
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setStatusMessage({ type: 'error', text: 'A valid candidate email address is required.' });
      return;
    }

    if (duplicateMatches.length > 0) {
      setStatusMessage({
        type: 'error',
        text: 'Duplicate candidate detected! Candidate creation is strictly blocked. Please review the existing candidate profile.',
      });
      return;
    }

    setStatusMessage(null);

    startTransition(async () => {
      const res = await createCandidateAction({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        currentTitle: currentTitle.trim() || null,
        currentCompany: currentCompany.trim() || null,
        experienceYears: experienceYears ? parseFloat(experienceYears) : null,
        currentSalary: currentSalary ? parseFloat(currentSalary) : null,
        expectedSalary: expectedSalary ? parseFloat(expectedSalary) : null,
        location: location.trim() || null,
        noticePeriod: noticePeriod.trim() || null,
        skills,
        source: isManualEntry ? 'Manual Entry' : 'Resume Upload',
        ownerId: ownerId || null,
        tags,
        notes: notes.trim() || null,
        resumeDocument: uploadedResume
          ? {
              fileName: uploadedResume.fileName,
              storageKey: uploadedResume.storageKey,
              fileSize: uploadedResume.fileSize,
              mimeType: uploadedResume.mimeType,
              fileChecksum: uploadedResume.fileChecksum,
              documentType: 'RESUME',
            }
          : null,
      });

      if (!res.success || !res.candidate) {
        setStatusMessage({
          type: 'error',
          text: res.error || 'Failed to create candidate.',
        });
        return;
      }

      setStatusMessage({
        type: 'success',
        text: `Candidate ${res.candidate.name} (${res.candidate.code}) created successfully! Redirecting...`,
      });

      // Navigate to candidate profile from Prompt 7
      setTimeout(() => {
        router.push(`/candidates/${res.candidate!.id}`);
      }, 1000);
    });
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* 1. Header & Navigation (Matching Figma Frame 17) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#E6E8F0] pb-4">
        <div>
          <span className="text-[11px] font-bold text-[#5B49D6] tracking-wider uppercase mb-1 block">
            PHASE 1 · CORE ATS / 17
          </span>
          <h1 className="text-2xl font-bold text-[#1B2236] tracking-tight">
            Add candidate & parse review
          </h1>
          <p className="text-xs text-[#6B7490] mt-1">
            Review extracted details before creating a candidate record.
          </p>
        </div>

        {/* Enter manually / Upload resume toggle */}
        <div className="flex items-center gap-2">
          {isManualEntry ? (
            <button
              onClick={() => {
                setIsManualEntry(false);
                setUploadedResume(null);
                setSourcePreview(null);
              }}
              className="px-4 py-2 bg-white border border-[#E6E8F0] hover:bg-[#F6F7FB] text-[#1B2236] rounded-lg text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5"
            >
              <UploadCloud className="w-3.5 h-3.5 text-[#5B49D6]" />
              <span>Upload resume</span>
            </button>
          ) : (
            <button
              onClick={() => {
                setIsManualEntry(true);
                setUploadedResume(null);
                setSourcePreview(null);
                setConfidenceMap({});
              }}
              className="px-4 py-2 bg-[#5B49D6] hover:bg-[#5B49D6]/90 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors flex items-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Enter manually</span>
            </button>
          )}
        </div>
      </div>

      {/* Sub-Navigation Tabs (Matching Figma Frame 17) */}
      <div className="flex items-center gap-6 border-b border-[#E6E8F0] text-xs font-semibold">
        <button
          onClick={() => setActiveTab('resume')}
          className={`pb-2.5 transition-colors border-b-2 flex items-center gap-1.5 ${
            activeTab === 'resume'
              ? 'border-[#5B49D6] text-[#5B49D6]'
              : 'border-transparent text-[#6B7490] hover:text-[#1B2236]'
          }`}
        >
          <span>Resume & review</span>
          {uploadedResume && (
            <span className="w-2 h-2 rounded-full bg-[#12B76A]" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('contact')}
          className={`pb-2.5 transition-colors border-b-2 ${
            activeTab === 'contact'
              ? 'border-[#5B49D6] text-[#5B49D6]'
              : 'border-transparent text-[#6B7490] hover:text-[#1B2236]'
          }`}
        >
          Contact & experience
        </button>
        <button
          onClick={() => setActiveTab('ownership')}
          className={`pb-2.5 transition-colors border-b-2 ${
            activeTab === 'ownership'
              ? 'border-[#5B49D6] text-[#5B49D6]'
              : 'border-transparent text-[#6B7490] hover:text-[#1B2236]'
          }`}
        >
          Ownership & notes
        </button>
      </div>

      {/* Global Status Message Banner */}
      {statusMessage && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-xs font-medium ${
            statusMessage.type === 'success'
              ? 'bg-[#E3F6EC] border-[#12B76A]/30 text-[#12B76A]'
              : 'bg-[#FDECEC] border-[#E5484D]/30 text-[#E5484D]'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === 'success' ? (
              <CheckCircle className="w-4 h-4 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button onClick={() => setStatusMessage(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Duplicate Warning Banner (Matching Figma Frame 17) */}
      {duplicateMatches.length > 0 && (
        <div className="p-4 rounded-xl bg-[#FEF6EE] border border-[#F59E0B]/30 space-y-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-[#F59E0B] shrink-0 mt-0.5" />
            <div className="space-y-1 flex-1">
              <h4 className="text-xs font-bold text-[#B54708]">
                Possible duplicate candidate detected — Creation blocked
              </h4>
              <p className="text-xs text-[#B54708]">
                Possible duplicate:{' '}
                <strong>{duplicateMatches[0].name}</strong> · same{' '}
                {duplicateMatches[0].matchingField} found in record{' '}
                <strong>{duplicateMatches[0].code}</strong>.{' '}
                {duplicateMatches[0].isArchived ? '(Archived profile) ' : ''}
                Candidate creation is blocked to prevent duplicate records. Please review or update the existing candidate profile.
              </p>
              <div className="flex items-center gap-3 pt-1">
                <Link
                  href={`/candidates/${duplicateMatches[0].candidateId}`}
                  target="_blank"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#5B49D6] hover:underline"
                >
                  <span>View existing candidate ({duplicateMatches[0].code})</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Empty / Upload State (Dropzone) */}
      {!uploadedResume && !isManualEntry && (
        <div className="bg-white rounded-xl border border-[#E6E8F0] shadow-xs p-8 text-center space-y-4">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const files = e.dataTransfer.files;
              if (files && files.length > 0) {
                handleFileUpload(files[0]);
              }
            }}
            className={`border-2 border-dashed rounded-xl p-10 transition-colors cursor-pointer flex flex-col items-center justify-center gap-3 ${
              isDragging
                ? 'border-[#5B49D6] bg-[#EEEBFB]/30'
                : 'border-[#E6E8F0] hover:border-[#5B49D6]/50 bg-[#F6F7FB]'
            }`}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              type="file"
              ref={fileInputRef}
              accept=".pdf,.doc,.docx"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleFileUpload(e.target.files[0]);
                }
              }}
            />

            {isParsing ? (
              <div className="space-y-3 py-4">
                <RefreshCw className="w-10 h-10 text-[#5B49D6] animate-spin mx-auto" />
                <h3 className="text-sm font-bold text-[#1B2236]">
                  Extracting candidate profile...
                </h3>
                <p className="text-xs text-[#6B7490]">
                  Scanning document with security validation and parsing skills & history.
                </p>
              </div>
            ) : (
              <>
                <div className="w-14 h-14 rounded-full bg-[#EEEBFB] flex items-center justify-center text-[#5B49D6]">
                  <UploadCloud className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#1B2236]">
                    Drag and drop resume here, or{' '}
                    <span className="text-[#5B49D6] underline">browse files</span>
                  </h3>
                  <p className="text-xs text-[#6B7490] mt-1">
                    Supported formats: PDF, DOC, DOCX · Up to 10 MB.
                  </p>
                </div>
                <span className="text-[11px] font-medium text-[#6B7490] bg-white border border-[#E6E8F0] px-3 py-1 rounded-full">
                  Parsed candidate information is never saved automatically.
                </span>
              </>
            )}
          </div>

          {uploadError && (
            <div className="p-3 bg-[#FDECEC] border border-[#E5484D]/30 rounded-lg text-xs text-[#E5484D] font-medium text-left flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{uploadError}</span>
            </div>
          )}

          <div className="pt-2 text-xs text-[#6B7490]">
            Prefer entering details manually?{' '}
            <button
              onClick={() => setIsManualEntry(true)}
              className="text-[#5B49D6] font-semibold hover:underline"
            >
              Switch to manual entry
            </button>
          </div>
        </div>
      )}

      {/* 3. Review Workspace (Matching Figma Frame 17) */}
      {(uploadedResume || isManualEntry) && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT COLUMN: Resume Card & Source Preview (4 cols) */}
          <div className="lg:col-span-4 space-y-6">
            {uploadedResume ? (
              <>
                {/* Resume Uploaded Card */}
                <div className="bg-white rounded-xl border border-[#E6E8F0] shadow-xs p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-[#1B2236] uppercase tracking-wider">
                      Resume uploaded
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#FEF6EE] text-[#B54708] border border-[#F59E0B]/30">
                      Review required
                    </span>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-[#F6F7FB] border border-[#E6E8F0] rounded-lg">
                    <FileText className="w-5 h-5 text-[#5B49D6] shrink-0 mt-0.5" />
                    <div className="space-y-0.5 min-w-0">
                      <p className="text-xs font-bold text-[#1B2236] truncate">
                        {uploadedResume.fileName}
                      </p>
                      <p className="text-[11px] text-[#6B7490]">
                        {(uploadedResume.fileSize / 1024).toFixed(0)} KB · Uploaded just now
                        {extractionTimeMs ? ` · ${extractionTimeMs} ms` : ''}
                      </p>
                    </div>
                  </div>

                  <p className="text-[11px] text-[#6B7490] leading-relaxed">
                    PDF, DOC or DOCX · Up to 10 MB. Parsed details are not saved automatically.
                  </p>

                  <div className="pt-1 flex items-center justify-between">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs font-semibold text-[#5B49D6] hover:underline flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Replace file</span>
                    </button>
                    <button
                      onClick={() => {
                        setUploadedResume(null);
                        setSourcePreview(null);
                        setIsManualEntry(true);
                      }}
                      className="text-xs text-[#6B7490] hover:text-[#E5484D]"
                    >
                      Remove file
                    </button>
                  </div>
                </div>

                {/* Source Preview Card */}
                {sourcePreview && (
                  <div className="bg-white rounded-xl border border-[#E6E8F0] shadow-xs p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-[#1B2236] uppercase tracking-wider">
                        Source preview
                      </h3>
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#E3F6EC] text-[#12B76A]">
                        {sourcePreview.fieldsCount} fields extracted
                      </span>
                    </div>

                    <div className="p-3 bg-[#F6F7FB] rounded-lg border border-[#E6E8F0] space-y-2 text-xs">
                      <div>
                        <h4 className="font-bold text-[#1B2236]">{name || 'Extracted candidate'}</h4>
                        <p className="text-[#6B7490]">
                          {currentTitle || 'Professional'} {currentCompany ? `· ${currentCompany}` : ''}
                        </p>
                      </div>

                      <p className="text-[11px] text-[#6B7490] italic leading-relaxed border-t border-[#E6E8F0] pt-2">
                        {sourcePreview.sourceSnippets[0] || sourcePreview.rawSummary}
                      </p>

                      {skills.length > 0 && (
                        <div className="border-t border-[#E6E8F0] pt-2">
                          <span className="text-[10px] text-[#6B7490] font-semibold block mb-1">
                            Skills Detected:
                          </span>
                          <p className="text-[11px] text-[#1B2236] font-medium truncate">
                            {skills.slice(0, 8).join(' · ')}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            ) : (
              /* Manual Entry Helper Card */
              <div className="bg-white rounded-xl border border-[#E6E8F0] shadow-xs p-5 space-y-3">
                <h3 className="text-xs font-bold text-[#1B2236] uppercase tracking-wider">
                  Manual Entry Active
                </h3>
                <p className="text-xs text-[#6B7490] leading-relaxed">
                  You are entering candidate information manually without uploading a resume. You can
                  attach a resume document at any time later from the candidate profile.
                </p>
                <button
                  onClick={() => setIsManualEntry(false)}
                  className="text-xs text-[#5B49D6] font-semibold hover:underline flex items-center gap-1"
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>Upload a resume instead</span>
                </button>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: Candidate Details Form (8 cols) */}
          <div className="lg:col-span-8 space-y-6">
            {/* Candidate Details Card */}
            <div className="bg-white rounded-xl border border-[#E6E8F0] shadow-xs p-6 space-y-6">
              <div>
                <h2 className="text-base font-bold text-[#1B2236]">Candidate details</h2>
                <p className="text-xs text-[#6B7490] mt-0.5">
                  Extracted fields remain editable. Required contact fields are validated on save.
                </p>
              </div>

              {/* 2-Column Form Grid (Matching Frame 17) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* Full Name */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-[#1B2236]">Full name *</label>
                    {confidenceMap.name ? (
                      <span className="text-[10px] font-semibold text-[#12B76A] bg-[#E3F6EC] px-1.5 py-0.5 rounded">
                        {(confidenceMap.name * 100).toFixed(0)}% Match
                      </span>
                    ) : null}
                  </div>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Aarav Shah"
                    className="w-full px-3 py-2 border border-[#E6E8F0] rounded-lg outline-none focus:border-[#5B49D6]"
                  />
                </div>

                {/* Email Address */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-[#1B2236]">Email *</label>
                    {confidenceMap.email ? (
                      <span className="text-[10px] font-semibold text-[#12B76A] bg-[#E3F6EC] px-1.5 py-0.5 rounded">
                        {(confidenceMap.email * 100).toFixed(0)}% Match
                      </span>
                    ) : null}
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEmail(val);
                      if (val.includes('@') && val.length > 5) {
                        checkDuplicates(val, phone);
                      }
                    }}
                    onBlur={(e) => checkDuplicates(e.target.value, phone)}
                    placeholder="e.g. aarav.shah@example.com"
                    className="w-full px-3 py-2 border border-[#E6E8F0] rounded-lg outline-none focus:border-[#5B49D6]"
                  />
                </div>

                {/* Phone */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-[#1B2236]">Phone</label>
                    {confidenceMap.phone ? (
                      <span className="text-[10px] font-semibold text-[#12B76A] bg-[#E3F6EC] px-1.5 py-0.5 rounded">
                        {(confidenceMap.phone * 100).toFixed(0)}% Match
                      </span>
                    ) : null}
                  </div>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPhone(val);
                      if (val.replace(/\D/g, '').length >= 10) {
                        checkDuplicates(email, val);
                      }
                    }}
                    onBlur={(e) => checkDuplicates(email, e.target.value)}
                    placeholder="e.g. +91 98765 43210"
                    className="w-full px-3 py-2 border border-[#E6E8F0] rounded-lg outline-none focus:border-[#5B49D6]"
                  />
                </div>

                {/* Current Title */}
                <div>
                  <label className="font-semibold text-[#1B2236] block mb-1">Current title</label>
                  <input
                    type="text"
                    value={currentTitle}
                    onChange={(e) => setCurrentTitle(e.target.value)}
                    placeholder="e.g. Frontend Engineer"
                    className="w-full px-3 py-2 border border-[#E6E8F0] rounded-lg outline-none focus:border-[#5B49D6]"
                  />
                </div>

                {/* Experience */}
                <div>
                  <label className="font-semibold text-[#1B2236] block mb-1">Experience</label>
                  <input
                    type="text"
                    value={experienceYears}
                    onChange={(e) => setExperienceYears(e.target.value)}
                    placeholder="e.g. 3 or 3.5 years"
                    className="w-full px-3 py-2 border border-[#E6E8F0] rounded-lg outline-none focus:border-[#5B49D6]"
                  />
                </div>

                {/* Current Company */}
                <div>
                  <label className="font-semibold text-[#1B2236] block mb-1">Current company</label>
                  <input
                    type="text"
                    value={currentCompany}
                    onChange={(e) => setCurrentCompany(e.target.value)}
                    placeholder="e.g. TechNova"
                    className="w-full px-3 py-2 border border-[#E6E8F0] rounded-lg outline-none focus:border-[#5B49D6]"
                  />
                </div>

                {/* Current Salary */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-[#1B2236]">Current salary (INR)</label>
                    {currentSalary && (
                      <span className="text-[11px] font-semibold text-[#5B49D6]">
                        {formatINR(parseFloat(currentSalary))}
                      </span>
                    )}
                  </div>
                  <input
                    type="number"
                    value={currentSalary}
                    onChange={(e) => setCurrentSalary(e.target.value)}
                    placeholder="e.g. 850000"
                    className="w-full px-3 py-2 border border-[#E6E8F0] rounded-lg outline-none focus:border-[#5B49D6]"
                  />
                </div>

                {/* Expected Salary */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-[#1B2236]">Expected salary (INR)</label>
                    {expectedSalary && (
                      <span className="text-[11px] font-semibold text-[#5B49D6]">
                        {formatINR(parseFloat(expectedSalary))}
                      </span>
                    )}
                  </div>
                  <input
                    type="number"
                    value={expectedSalary}
                    onChange={(e) => setExpectedSalary(e.target.value)}
                    placeholder="e.g. 1200000"
                    className="w-full px-3 py-2 border border-[#E6E8F0] rounded-lg outline-none focus:border-[#5B49D6]"
                  />
                </div>

                {/* Location */}
                <div>
                  <label className="font-semibold text-[#1B2236] block mb-1">Location</label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. Mumbai"
                    className="w-full px-3 py-2 border border-[#E6E8F0] rounded-lg outline-none focus:border-[#5B49D6]"
                  />
                </div>

                {/* Notice Period */}
                <div>
                  <label className="font-semibold text-[#1B2236] block mb-1">Notice period</label>
                  <input
                    type="text"
                    value={noticePeriod}
                    onChange={(e) => setNoticePeriod(e.target.value)}
                    placeholder="e.g. 30 days"
                    className="w-full px-3 py-2 border border-[#E6E8F0] rounded-lg outline-none focus:border-[#5B49D6]"
                  />
                </div>
              </div>

              {/* Skills Tag Section (Full Width) */}
              <div className="space-y-2 pt-2 border-t border-[#E6E8F0]">
                <label className="font-semibold text-xs text-[#1B2236] block">Skills</label>
                <div className="flex flex-wrap gap-1.5 p-2.5 bg-[#F6F7FB] border border-[#E6E8F0] rounded-lg min-h-[46px] items-center">
                  {skills.map((skill) => (
                    <span
                      key={skill}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-[#E6E8F0] rounded-lg text-xs font-medium text-[#1B2236]"
                    >
                      <span>{skill}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveSkill(skill)}
                        className="text-[#6B7490] hover:text-[#E5484D] ml-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  <div className="flex items-center gap-1.5 ml-1">
                    <input
                      type="text"
                      value={skillInput}
                      onChange={(e) => setSkillInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddSkill();
                        }
                      }}
                      placeholder="+ Add skill..."
                      className="bg-transparent text-xs outline-none text-[#1B2236] w-28"
                    />
                    {skillInput.trim() && (
                      <button
                        type="button"
                        onClick={handleAddSkill}
                        className="text-xs font-semibold text-[#5B49D6]"
                      >
                        Add
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Ownership & Internal Notes Card (Matching Frame 17) */}
            <div className="bg-white rounded-xl border border-[#E6E8F0] shadow-xs p-6 space-y-5">
              <div>
                <h3 className="text-base font-bold text-[#1B2236]">Ownership & internal notes</h3>
                <p className="text-xs text-[#6B7490] mt-0.5">
                  Internal notes and recruiter tags are never exposed to clients or candidates.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* Candidate Owner */}
                <div>
                  <label className="font-semibold text-[#1B2236] block mb-1">Owner *</label>
                  <select
                    value={ownerId}
                    onChange={(e) => setOwnerId(e.target.value)}
                    className="w-full px-3 py-2 border border-[#E6E8F0] rounded-lg outline-none focus:border-[#5B49D6] bg-white"
                  >
                    {activeRecruiters.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.role})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Candidate Tags */}
                <div>
                  <label className="font-semibold text-[#1B2236] block mb-1">Tags</label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddTag();
                        }
                      }}
                      placeholder="e.g. Portfolio, Remote..."
                      className="flex-1 px-3 py-2 border border-[#E6E8F0] rounded-lg outline-none focus:border-[#5B49D6]"
                    />
                    <button
                      type="button"
                      onClick={handleAddTag}
                      className="px-3 py-2 bg-[#F6F7FB] border border-[#E6E8F0] hover:bg-[#E6E8F0] rounded-lg text-xs font-semibold text-[#1B2236]"
                    >
                      Add
                    </button>
                  </div>
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {tags.map((t) => (
                        <span
                          key={t}
                          className="px-2 py-0.5 bg-[#EEEBFB] text-[#5B49D6] rounded text-[11px] font-semibold flex items-center gap-1"
                        >
                          <span>{t}</span>
                          <button type="button" onClick={() => handleRemoveTag(t)}>
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Internal Notes Textarea */}
              <div>
                <label className="font-semibold text-xs text-[#1B2236] flex items-center gap-1 mb-1">
                  <Lock className="w-3 h-3 text-[#5B49D6]" />
                  <span>Notes - internal only</span>
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Record confidential recruiter observations, salary expectations, interview availability, and candidate preferences..."
                  className="w-full px-3 py-2 text-xs border border-[#E6E8F0] rounded-lg outline-none focus:border-[#5B49D6]"
                />
              </div>

              {/* Purple Regulatory Box (Matching Frame 17) */}
              <div className="p-3 bg-[#EEEBFB] border border-[#5B49D6]/30 rounded-xl text-xs text-[#5B49D6] flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  Resolve the duplicate warning or confirm this is a different person before creating
                  the record. Parsed fields are saved only after explicit review.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-wrap items-center justify-end gap-3 border-t border-[#E6E8F0]">
                <button
                  type="button"
                  onClick={() => router.push('/candidates')}
                  className="px-4 py-2 border border-[#E6E8F0] hover:bg-[#F6F7FB] text-[#1B2236] rounded-lg text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>

                {duplicateMatches.length > 0 && (
                  <Link
                    href={`/candidates/${duplicateMatches[0].candidateId}`}
                    target="_blank"
                    className="px-4 py-2 bg-white border border-[#5B49D6] text-[#5B49D6] hover:bg-[#EEEBFB] rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Review duplicate</span>
                  </Link>
                )}

                <button
                  type="button"
                  onClick={handleSaveCandidate}
                  disabled={isPending || duplicateMatches.length > 0}
                  className={`px-5 py-2.5 rounded-lg text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 ${
                    duplicateMatches.length > 0
                      ? 'bg-[#E5484D] text-white opacity-70 cursor-not-allowed'
                      : 'bg-[#5B49D6] hover:bg-[#5B49D6]/90 disabled:opacity-50 text-white cursor-pointer'
                  }`}
                  title={duplicateMatches.length > 0 ? 'Candidate creation is blocked due to duplicate candidate record' : undefined}
                >
                  {isPending ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving candidate...</span>
                    </>
                  ) : duplicateMatches.length > 0 ? (
                    <span>Duplicate Detected — Creation Blocked</span>
                  ) : (
                    <span>Review & Save Candidate</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
