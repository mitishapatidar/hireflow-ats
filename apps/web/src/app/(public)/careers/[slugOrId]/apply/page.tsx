'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  Upload,
  CheckCircle2,
  AlertCircle,
  FileText,
  Trash2,
  Bookmark,
  Building2,
  MapPin,
  Briefcase,
  Sparkles,
  ShieldCheck,
  Check,
  Copy,
} from 'lucide-react';
import {
  getPublicJobDetailsAction,
  uploadPublicResumeAction,
  saveApplicationDraftAction,
  getApplicationDraftAction,
  submitPublicApplicationAction,
} from '@/actions/public-careers';
import { PublicJobDetailDTO } from '@hireflow/shared';

interface ApplyPageProps {
  params: {
    slugOrId: string;
  };
}

export default function PublicApplyPage({ params }: ApplyPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const draftTokenFromUrl = searchParams.get('draft');

  const [job, setJob] = useState<PublicJobDetailDTO | null>(null);
  const [loadingJob, setLoadingJob] = useState(true);
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Form State
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [currentLocation, setCurrentLocation] = useState('');
  const [experienceYears, setExperienceYears] = useState<number | ''>('');
  const [portfolioUrl, setPortfolioUrl] = useState('');
  const [additionalNote, setAdditionalNote] = useState('');
  const [consentGiven, setConsentGiven] = useState(false);

  // Resume Upload State
  const [uploadedResume, setUploadedResume] = useState<{
    storageKey: string;
    fileName: string;
    fileSize: number;
  } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Honeypot & CAPTCHA (Bot Protection)
  const [websiteUrlHp, setWebsiteUrlHp] = useState('');
  const [captchaToken, setCaptchaToken] = useState('mock-captcha-token');

  // Draft & Submission State
  const [draftToken, setDraftToken] = useState<string | null>(draftTokenFromUrl);
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftSavedMsg, setDraftSavedMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submissionResult, setSubmissionResult] = useState<{
    referenceNumber: string;
    appliedAt: string;
  } | null>(null);

  const [copiedRef, setCopiedRef] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // 1. Fetch Job Details
  useEffect(() => {
    async function loadJob() {
      setLoadingJob(true);
      const res = await getPublicJobDetailsAction(params.slugOrId);
      if (res.success && res.data) {
        setJob(res.data);
      }
      setLoadingJob(false);
    }
    loadJob();
  }, [params.slugOrId]);

  // 2. Resume Draft from Token (if query param provided)
  useEffect(() => {
    async function resumeDraft(token: string) {
      const res = await getApplicationDraftAction(token);
      if (res.success && res.data) {
        const d = res.data;
        const f = (d.formData as any) || {};
        if (f.fullName) setFullName(f.fullName);
        if (f.email) setEmail(f.email);
        if (f.phone) setPhone(f.phone);
        if (f.currentLocation) setCurrentLocation(f.currentLocation);
        if (f.experienceYears != null) setExperienceYears(f.experienceYears);
        if (f.portfolioUrl) setPortfolioUrl(f.portfolioUrl);
        if (f.additionalNote) setAdditionalNote(f.additionalNote);
        if (f.consentGiven) setConsentGiven(f.consentGiven);

        if (d.resumeKey && f.resumeFileName) {
          setUploadedResume({
            storageKey: d.resumeKey,
            fileName: f.resumeFileName,
            fileSize: f.resumeFileSize || 1024 * 100,
          });
        }
        setDraftToken(token);
        setDraftSavedMsg('Draft resumed from secure link.');
      }
    }

    if (draftTokenFromUrl && draftTokenFromUrl.length === 64) {
      resumeDraft(draftTokenFromUrl);
    }
  }, [draftTokenFromUrl]);

  // Step Navigation Validation
  const validateStep2 = (): boolean => {
    const errs: Record<string, string> = {};
    if (!fullName.trim() || fullName.trim().length < 2) {
      errs.fullName = 'Full name must be at least 2 characters.';
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errs.email = 'Please provide a valid email address.';
    }
    if (!phone.trim() || phone.trim().length < 7) {
      errs.phone = 'Please provide a valid phone number (min 7 digits).';
    }
    if (!currentLocation.trim()) {
      errs.currentLocation = 'Current location is required.';
    }
    if (experienceYears === '' || experienceYears < 0) {
      errs.experienceYears = 'Please enter valid years of experience.';
    }

    setValidationErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateStep3 = (): boolean => {
    if (!uploadedResume) {
      setUploadError('Please upload your resume (PDF or DOCX format).');
      return false;
    }
    setUploadError(null);
    return true;
  };

  // Handle Resume File Upload
  const handleFileUpload = async (file: File) => {
    setUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await uploadPublicResumeAction(formData);

      if (!res.success || !res.data) {
        setUploadError(res.error || 'Failed to upload resume');
      } else {
        setUploadedResume({
          storageKey: res.data.storageKey,
          fileName: res.data.fileName,
          fileSize: res.data.fileSize,
        });
      }
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  // Handle Save Draft
  const handleSaveDraft = async () => {
    if (!job) return;
    setSavingDraft(true);
    setDraftSavedMsg(null);

    try {
      const res = await saveApplicationDraftAction({
        jobId: job.id,
        draftToken: draftToken || undefined,
        formData: {
          fullName,
          email,
          phone,
          currentLocation,
          experienceYears: experienceYears === '' ? null : Number(experienceYears),
          portfolioUrl,
          additionalNote,
          consentGiven,
          resumeFileName: uploadedResume?.fileName || null,
          resumeFileSize: uploadedResume?.fileSize || null,
        },
        resumeKey: uploadedResume?.storageKey || null,
      });

      if (res.success && res.data) {
        setDraftToken(res.data.draftToken);
        setDraftSavedMsg('Draft saved successfully! You can return anytime.');
      } else {
        setDraftSavedMsg('Could not save draft. Please check your network.');
      }
    } catch (err) {
      setDraftSavedMsg('Draft save failed.');
    } finally {
      setSavingDraft(false);
    }
  };

  // Handle Final Submission
  const handleSubmitApplication = async () => {
    if (!job) return;

    if (!consentGiven) {
      setSubmitError('You must consent to data processing to submit.');
      return;
    }

    if (!uploadedResume) {
      setSubmitError('Resume upload is missing.');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await submitPublicApplicationAction({
        jobId: job.id,
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        currentLocation: currentLocation.trim(),
        experienceYears: Number(experienceYears),
        portfolioUrl: portfolioUrl.trim() || undefined,
        resumeKey: uploadedResume.storageKey,
        resumeFileName: uploadedResume.fileName,
        resumeFileSize: uploadedResume.fileSize,
        additionalNote: additionalNote.trim() || undefined,
        consentGiven: true,
        captchaToken,
        website_url_hp: websiteUrlHp,
        draftToken: draftToken || undefined,
      });

      if (!res.success || !res.data) {
        setSubmitError(res.error || 'Failed to submit application.');
      } else {
        setSubmissionResult({
          referenceNumber: res.data.referenceNumber,
          appliedAt: res.data.appliedAt,
        });
        setCurrentStep(5); // Confirmation Screen
      }
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const copyReferenceToClipboard = () => {
    if (!submissionResult?.referenceNumber) return;
    navigator.clipboard.writeText(submissionResult.referenceNumber);
    setCopiedRef(true);
    setTimeout(() => setCopiedRef(false), 2000);
  };

  if (loadingJob) {
    return (
      <div className="min-h-screen bg-[#F6F7FB] flex items-center justify-center p-4">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-[#5B49D6] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-[#6B7490]">Loading role details...</p>
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-[#F6F7FB] flex items-center justify-center p-4">
        <div className="bg-white rounded-xl border border-[#E6E8F0] p-8 max-w-md text-center shadow-xs">
          <AlertCircle className="w-8 h-8 text-[#E5484D] mx-auto mb-2" />
          <h2 className="text-base font-bold text-[#1B2236]">Position Unavailable</h2>
          <p className="text-xs text-[#6B7490] mt-1 mb-4">
            This position is no longer accepting public applications.
          </p>
          <Link
            href="/careers"
            className="px-4 py-2 bg-[#5B49D6] text-white rounded-lg text-xs font-semibold"
          >
            Browse Other Positions
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F6F7FB] py-8 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Navigation & Header */}
        <div className="flex items-center justify-between">
          <Link
            href={`/careers/${job.id}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#6B7490] hover:text-[#5B49D6] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Job Details</span>
          </Link>

          {currentStep > 1 && currentStep < 5 && (
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={savingDraft}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#5B49D6] hover:bg-[#EEEBFB] px-3 py-1.5 rounded-lg border border-[#EEEBFB] transition-colors"
            >
              <Bookmark className="w-3.5 h-3.5" />
              <span>{savingDraft ? 'Saving...' : 'Save Draft'}</span>
            </button>
          )}
        </div>

        {/* Draft Notification Banner */}
        {draftSavedMsg && (
          <div className="p-3 bg-[#EEEBFB] text-[#5B49D6] rounded-lg text-xs flex items-center justify-between font-medium">
            <span>{draftSavedMsg}</span>
            <button
              type="button"
              onClick={() => setDraftSavedMsg(null)}
              className="text-[#5B49D6] hover:opacity-75 font-bold"
            >
              ×
            </button>
          </div>
        )}

        {/* Step Progress Bar (Frame 43) */}
        {currentStep < 5 && (
          <div className="bg-white rounded-xl border border-[#E6E8F0] p-4 shadow-xs">
            <div className="flex items-center justify-between text-xs font-semibold mb-2">
              <span className="text-[#5B49D6]">
                Step {currentStep} of 4:{' '}
                {currentStep === 1
                  ? 'Role Summary'
                  : currentStep === 2
                  ? 'Candidate Info'
                  : currentStep === 3
                  ? 'Resume Upload'
                  : 'Review & Submit'}
              </span>
              <span className="text-[#6B7490]">{Math.round((currentStep / 4) * 100)}%</span>
            </div>
            <div className="w-full bg-[#F6F7FB] h-2 rounded-full overflow-hidden">
              <div
                className="bg-[#5B49D6] h-full transition-all duration-300 rounded-full"
                style={{ width: `${(currentStep / 4) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* STEP 1: JOB SUMMARY */}
        {/* ======================================================== */}
        {currentStep === 1 && (
          <div className="bg-white rounded-xl border border-[#E6E8F0] p-6 sm:p-8 shadow-xs space-y-6">
            <div className="space-y-2">
              <div className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#EEEBFB] text-[#5B49D6]">
                {job.code}
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-[#1B2236]">{job.title}</h2>
              <div className="flex flex-wrap items-center gap-3 text-xs text-[#6B7490]">
                <span className="flex items-center gap-1 text-[#1B2236] font-medium">
                  <Building2 className="w-3.5 h-3.5 text-[#6B7490]" />
                  <span>{job.companyName}</span>
                </span>
                {job.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-[#6B7490]" />
                    <span>{job.location}</span>
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Briefcase className="w-3.5 h-3.5 text-[#6B7490]" />
                  <span>{job.employmentType}</span>
                </span>
              </div>
            </div>

            <div className="p-4 bg-[#F6F7FB] rounded-lg border border-[#E6E8F0] space-y-2 text-xs text-[#1B2236]">
              <h4 className="font-bold text-[#5B49D6] uppercase tracking-wider text-[11px]">
                Application Requirements
              </h4>
              <ul className="space-y-1.5 text-[#6B7490]">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#12B76A]" />
                  <span>Updated Resume (PDF or DOCX format under 10 MB)</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#12B76A]" />
                  <span>Basic contact information & experience details</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#12B76A]" />
                  <span>Instant confirmation reference provided upon submit</span>
                </li>
              </ul>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="px-6 py-2.5 bg-[#5B49D6] text-white rounded-lg text-xs font-bold hover:bg-[#5B49D6]/90 transition-all inline-flex items-center gap-2"
              >
                <span>Continue to Personal Details</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* STEP 2: PERSONAL INFORMATION FORM */}
        {/* ======================================================== */}
        {currentStep === 2 && (
          <div className="bg-white rounded-xl border border-[#E6E8F0] p-6 sm:p-8 shadow-xs space-y-5">
            <div>
              <h2 className="text-lg font-bold text-[#1B2236]">Candidate Information</h2>
              <p className="text-xs text-[#6B7490] mt-0.5">
                Please enter your accurate contact details for interview coordination.
              </p>
            </div>

            <div className="space-y-4">
              {/* Full Name */}
              <div>
                <label className="block text-xs font-bold text-[#1B2236] mb-1">
                  Full Name <span className="text-[#E5484D]">*</span>
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Aarav Sharma"
                  className="w-full px-3.5 py-2 text-xs text-[#1B2236] bg-[#F6F7FB] border border-[#E6E8F0] rounded-lg focus:outline-none focus:border-[#5B49D6] focus:bg-white"
                />
                {validationErrors.fullName && (
                  <p className="text-[11px] text-[#E5484D] mt-1">{validationErrors.fullName}</p>
                )}
              </div>

              {/* Email & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#1B2236] mb-1">
                    Email Address <span className="text-[#E5484D]">*</span>
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="aarav@example.com"
                    className="w-full px-3.5 py-2 text-xs text-[#1B2236] bg-[#F6F7FB] border border-[#E6E8F0] rounded-lg focus:outline-none focus:border-[#5B49D6] focus:bg-white"
                  />
                  {validationErrors.email && (
                    <p className="text-[11px] text-[#E5484D] mt-1">{validationErrors.email}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1B2236] mb-1">
                    Phone Number <span className="text-[#E5484D]">*</span>
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full px-3.5 py-2 text-xs text-[#1B2236] bg-[#F6F7FB] border border-[#E6E8F0] rounded-lg focus:outline-none focus:border-[#5B49D6] focus:bg-white"
                  />
                  {validationErrors.phone && (
                    <p className="text-[11px] text-[#E5484D] mt-1">{validationErrors.phone}</p>
                  )}
                </div>
              </div>

              {/* Location & Experience */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#1B2236] mb-1">
                    Current Location <span className="text-[#E5484D]">*</span>
                  </label>
                  <input
                    type="text"
                    value={currentLocation}
                    onChange={(e) => setCurrentLocation(e.target.value)}
                    placeholder="e.g. Bengaluru, India"
                    className="w-full px-3.5 py-2 text-xs text-[#1B2236] bg-[#F6F7FB] border border-[#E6E8F0] rounded-lg focus:outline-none focus:border-[#5B49D6] focus:bg-white"
                  />
                  {validationErrors.currentLocation && (
                    <p className="text-[11px] text-[#E5484D] mt-1">
                      {validationErrors.currentLocation}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#1B2236] mb-1">
                    Years of Experience <span className="text-[#E5484D]">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="50"
                    value={experienceYears}
                    onChange={(e) =>
                      setExperienceYears(e.target.value === '' ? '' : parseFloat(e.target.value))
                    }
                    placeholder="e.g. 6.5"
                    className="w-full px-3.5 py-2 text-xs text-[#1B2236] bg-[#F6F7FB] border border-[#E6E8F0] rounded-lg focus:outline-none focus:border-[#5B49D6] focus:bg-white"
                  />
                  {validationErrors.experienceYears && (
                    <p className="text-[11px] text-[#E5484D] mt-1">
                      {validationErrors.experienceYears}
                    </p>
                  )}
                </div>
              </div>

              {/* Portfolio / LinkedIn */}
              <div>
                <label className="block text-xs font-bold text-[#1B2236] mb-1">
                  Portfolio / GitHub / LinkedIn URL{' '}
                  <span className="text-[#6B7490] font-normal">(Optional)</span>
                </label>
                <input
                  type="url"
                  value={portfolioUrl}
                  onChange={(e) => setPortfolioUrl(e.target.value)}
                  placeholder="https://github.com/..."
                  className="w-full px-3.5 py-2 text-xs text-[#1B2236] bg-[#F6F7FB] border border-[#E6E8F0] rounded-lg focus:outline-none focus:border-[#5B49D6] focus:bg-white"
                />
              </div>

              {/* Additional Note */}
              <div>
                <label className="block text-xs font-bold text-[#1B2236] mb-1">
                  Additional Note / Message to Recruiter{' '}
                  <span className="text-[#6B7490] font-normal">(Optional)</span>
                </label>
                <textarea
                  rows={3}
                  value={additionalNote}
                  onChange={(e) => setAdditionalNote(e.target.value)}
                  placeholder="Briefly highlight your relevant experience or availability..."
                  className="w-full px-3.5 py-2 text-xs text-[#1B2236] bg-[#F6F7FB] border border-[#E6E8F0] rounded-lg focus:outline-none focus:border-[#5B49D6] focus:bg-white resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-[#E6E8F0]">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="px-4 py-2 border border-[#E6E8F0] text-[#1B2236] rounded-lg text-xs font-semibold hover:bg-gray-50"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => {
                  if (validateStep2()) {
                    setCurrentStep(3);
                  }
                }}
                className="px-6 py-2.5 bg-[#5B49D6] text-white rounded-lg text-xs font-bold hover:bg-[#5B49D6]/90 transition-all inline-flex items-center gap-1.5"
              >
                <span>Continue to Resume Upload</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* STEP 3: RESUME UPLOAD */}
        {/* ======================================================== */}
        {currentStep === 3 && (
          <div className="bg-white rounded-xl border border-[#E6E8F0] p-6 sm:p-8 shadow-xs space-y-6">
            <div>
              <h2 className="text-lg font-bold text-[#1B2236]">Upload Your Resume</h2>
              <p className="text-xs text-[#6B7490] mt-0.5">
                Attach your resume in PDF or DOCX format (maximum 10 MB).
              </p>
            </div>

            {/* Upload Box / Drag & Drop */}
            {!uploadedResume ? (
              <label className="block border-2 border-dashed border-[#E6E8F0] hover:border-[#5B49D6] rounded-xl p-8 text-center cursor-pointer bg-[#F6F7FB] transition-colors">
                <input
                  type="file"
                  accept=".pdf,.docx,.doc"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileUpload(f);
                  }}
                  disabled={uploading}
                />
                <div className="w-12 h-12 rounded-full bg-[#EEEBFB] text-[#5B49D6] flex items-center justify-center mx-auto mb-3">
                  <Upload className="w-6 h-6" />
                </div>
                <p className="text-xs font-bold text-[#1B2236]">
                  {uploading ? 'Scanning and verifying file...' : 'Click to upload or drag & drop'}
                </p>
                <p className="text-[11px] text-[#6B7490] mt-1">
                  Supported formats: PDF, DOCX, DOC (up to 10 MB)
                </p>
                {uploading && (
                  <div className="w-32 bg-gray-200 h-1.5 rounded-full mx-auto mt-3 overflow-hidden">
                    <div className="bg-[#5B49D6] h-full w-2/3 animate-pulse rounded-full" />
                  </div>
                )}
              </label>
            ) : (
              /* Attached Resume Pill */
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-100 text-[#12B76A] flex items-center justify-center font-bold">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#1B2236]">{uploadedResume.fileName}</p>
                    <p className="text-[11px] text-[#6B7490]">
                      {(uploadedResume.fileSize / 1024).toFixed(1)} KB • Verified Clean
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setUploadedResume(null)}
                  title="Remove uploaded resume"
                  className="p-2 text-[#E5484D] hover:bg-red-100 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}

            {uploadError && (
              <div className="p-3 bg-red-50 text-[#E5484D] rounded-lg text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            <div className="flex items-center justify-between pt-4 border-t border-[#E6E8F0]">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="px-4 py-2 border border-[#E6E8F0] text-[#1B2236] rounded-lg text-xs font-semibold hover:bg-gray-50"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => {
                  if (validateStep3()) {
                    setCurrentStep(4);
                  }
                }}
                disabled={!uploadedResume || uploading}
                className="px-6 py-2.5 bg-[#5B49D6] text-white rounded-lg text-xs font-bold hover:bg-[#5B49D6]/90 disabled:opacity-50 transition-all inline-flex items-center gap-1.5"
              >
                <span>Review Application</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* STEP 4: REVIEW & SUBMIT */}
        {/* ======================================================== */}
        {currentStep === 4 && (
          <div className="bg-white rounded-xl border border-[#E6E8F0] p-6 sm:p-8 shadow-xs space-y-6">
            <div>
              <h2 className="text-lg font-bold text-[#1B2236]">Review Your Application</h2>
              <p className="text-xs text-[#6B7490] mt-0.5">
                Verify your details below before final submission.
              </p>
            </div>

            {/* Summary Details */}
            <div className="p-4 bg-[#F6F7FB] rounded-xl border border-[#E6E8F0] space-y-4 text-xs">
              <div className="flex items-center justify-between pb-3 border-b border-[#E6E8F0]">
                <div>
                  <span className="text-[11px] text-[#6B7490] block">Applying for:</span>
                  <span className="font-bold text-[#1B2236] text-sm">{job.title}</span>
                </div>
                <span className="font-semibold text-[#5B49D6]">{job.companyName}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-[#6B7490] block">Candidate Name:</span>
                  <span className="font-bold text-[#1B2236]">{fullName}</span>
                </div>
                <div>
                  <span className="text-[#6B7490] block">Email Address:</span>
                  <span className="font-bold text-[#1B2236]">{email}</span>
                </div>
                <div>
                  <span className="text-[#6B7490] block">Phone:</span>
                  <span className="font-bold text-[#1B2236]">{phone}</span>
                </div>
                <div>
                  <span className="text-[#6B7490] block">Current Location:</span>
                  <span className="font-bold text-[#1B2236]">{currentLocation}</span>
                </div>
                <div>
                  <span className="text-[#6B7490] block">Experience:</span>
                  <span className="font-bold text-[#1B2236]">{experienceYears} years</span>
                </div>
                {portfolioUrl && (
                  <div>
                    <span className="text-[#6B7490] block">Portfolio:</span>
                    <a
                      href={portfolioUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-bold text-[#5B49D6] hover:underline truncate block"
                    >
                      {portfolioUrl}
                    </a>
                  </div>
                )}
              </div>

              {/* Resume Attached */}
              <div className="pt-3 border-t border-[#E6E8F0] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#5B49D6]" />
                  <span className="font-bold text-[#1B2236]">{uploadedResume?.fileName}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  className="text-xs font-semibold text-[#5B49D6] hover:underline"
                >
                  Change
                </button>
              </div>
            </div>

            {/* Hidden Honeypot Field (Spam Bot Trap) */}
            <div style={{ display: 'none' }} aria-hidden="true">
              <label htmlFor="website_url_hp">Leave this empty</label>
              <input
                id="website_url_hp"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={websiteUrlHp}
                onChange={(e) => setWebsiteUrlHp(e.target.value)}
              />
            </div>

            {/* Mandatory Consent Checkbox */}
            <div className="p-3 bg-white rounded-lg border border-[#E6E8F0]">
              <label className="flex items-start gap-2.5 cursor-pointer text-xs text-[#1B2236]">
                <input
                  type="checkbox"
                  checked={consentGiven}
                  onChange={(e) => setConsentGiven(e.target.checked)}
                  className="mt-0.5 rounded text-[#5B49D6] focus:ring-[#5B49D6]"
                />
                <span className="leading-relaxed">
                  I consent to the collection, processing, and retention of my submitted personal and
                  professional details for recruitment purposes in accordance with the privacy policy.{' '}
                  <span className="text-[#E5484D]">*</span>
                </span>
              </label>
            </div>

            {submitError && (
              <div className="p-3 bg-red-50 text-[#E5484D] rounded-lg text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            <div className="flex items-center justify-between pt-4 border-t border-[#E6E8F0]">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="px-4 py-2 border border-[#E6E8F0] text-[#1B2236] rounded-lg text-xs font-semibold hover:bg-gray-50"
              >
                Back to Edit
              </button>
              <button
                type="button"
                onClick={handleSubmitApplication}
                disabled={submitting || !consentGiven}
                className="px-8 py-2.5 bg-[#5B49D6] text-white rounded-lg text-xs font-bold hover:bg-[#5B49D6]/90 disabled:opacity-50 transition-all inline-flex items-center gap-2 shadow-xs"
              >
                <span>{submitting ? 'Submitting Application...' : 'Submit Application'}</span>
                {!submitting && <CheckCircle2 className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* STEP 5: SUBMISSION CONFIRMATION (Frame 43) */}
        {/* ======================================================== */}
        {currentStep === 5 && submissionResult && (
          <div className="bg-white rounded-xl border border-[#E6E8F0] p-8 text-center shadow-xs space-y-6">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-[#12B76A] flex items-center justify-center mx-auto shadow-xs">
              <Check className="w-8 h-8 stroke-[3]" />
            </div>

            <div className="space-y-1">
              <h2 className="text-2xl font-extrabold text-[#1B2236]">Application Submitted!</h2>
              <p className="text-xs text-[#6B7490] max-w-md mx-auto">
                Thank you for applying to the <strong>{job.title}</strong> role at{' '}
                <strong>{job.companyName}</strong>.
              </p>
            </div>

            {/* Highlighted Reference Box */}
            <div className="p-5 bg-[#EEEBFB] border border-[#5B49D6]/20 rounded-xl max-w-sm mx-auto space-y-2">
              <span className="text-xs font-bold text-[#5B49D6] uppercase tracking-wider block">
                Application Reference Number
              </span>
              <div className="flex items-center justify-center gap-2">
                <span className="text-lg sm:text-xl font-extrabold text-[#1B2236] tracking-wider font-mono">
                  {submissionResult.referenceNumber}
                </span>
                <button
                  type="button"
                  onClick={copyReferenceToClipboard}
                  title="Copy reference code"
                  className="p-1.5 text-[#5B49D6] hover:bg-white rounded transition-colors"
                >
                  {copiedRef ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-[#6B7490]">
                Keep this reference number for all future inquiries regarding this application.
              </p>
            </div>

            <div className="text-xs text-[#6B7490] max-w-sm mx-auto space-y-1">
              <p>
                A confirmation email has been dispatched to <strong>{email}</strong>.
              </p>
              <p>Our recruitment agency team will review your application and reach out shortly.</p>
            </div>

            <div className="pt-4 border-t border-[#E6E8F0]">
              <Link
                href="/careers"
                className="px-6 py-2.5 bg-[#5B49D6] text-white rounded-lg text-xs font-bold hover:bg-[#5B49D6]/90 transition-all inline-flex items-center gap-2"
              >
                <span>Return to Careers Home</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
