import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import {
  MapPin,
  Briefcase,
  Clock,
  ArrowLeft,
  ArrowRight,
  Building2,
  Users,
  Calendar,
  CheckCircle2,
  Share2,
} from 'lucide-react';
import { getPublicJobDetailsAction } from '@/actions/public-careers';

interface PageProps {
  params: {
    slugOrId: string;
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const res = await getPublicJobDetailsAction(params.slugOrId);
  if (!res.success || !res.data) {
    return {
      title: 'Job Not Found | HireFlow Careers',
      description: 'The requested position is no longer accepting applications.',
    };
  }

  const job = res.data;
  const title = `${job.title} at ${job.companyName} | HireFlow Careers`;
  const description = job.shortDescription;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      url: `/careers/${job.id}`,
    },
    alternates: {
      canonical: `/careers/${job.id}`,
    },
  };
}

export default async function PublicJobDetailPage({ params }: PageProps) {
  const res = await getPublicJobDetailsAction(params.slugOrId);

  if (!res.success || !res.data) {
    notFound();
  }

  const job = res.data;

  // Generate Schema.org JobPosting JSON-LD
  const jsonLd: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: job.title,
    description: job.description || job.shortDescription,
    datePosted: job.publishedAt,
    employmentType: job.employmentType,
    hiringOrganization: {
      '@type': 'Organization',
      name: job.companyName,
    },
  };

  if (job.deadline) {
    jsonLd.validThrough = job.deadline;
  }

  if (job.location) {
    jsonLd.jobLocation = {
      '@type': 'Place',
      address: job.location,
    };
  }

  if (job.isSalaryPublic && job.salaryMin != null && job.salaryMax != null) {
    jsonLd.baseSalary = {
      '@type': 'MonetaryAmount',
      currency: 'INR',
      value: {
        '@type': 'QuantitativeValue',
        minValue: job.salaryMin,
        maxValue: job.salaryMax,
        unitText: 'YEAR',
      },
    };
  }

  return (
    <div className="min-h-screen bg-[#F6F7FB] py-8 px-4 sm:px-6 lg:px-8">
      {/* JSON-LD Script for Search Engines */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="max-w-4xl mx-auto space-y-6">
        {/* Back Link */}
        <div>
          <Link
            href="/careers"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#6B7490] hover:text-[#5B49D6] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to All Openings</span>
          </Link>
        </div>

        {/* Top Header Card */}
        <div className="bg-white rounded-xl border border-[#E6E8F0] p-6 sm:p-8 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[#EEEBFB] text-[#5B49D6]">
                  {job.code}
                </span>
                {job.isClientConfidential && (
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                    Confidential client
                  </span>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1B2236] tracking-tight">
                {job.title}
              </h1>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs sm:text-sm text-[#6B7490] pt-1">
                <span className="flex items-center gap-1.5 font-medium text-[#1B2236]">
                  <Building2 className="w-4 h-4 text-[#6B7490]" />
                  <span>{job.companyName}</span>
                </span>
                {job.location && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-[#6B7490]" />
                    <span>{job.location}</span>
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <Briefcase className="w-4 h-4 text-[#6B7490]" />
                  <span>
                    {job.employmentType === 'FULL_TIME'
                      ? 'Full Time'
                      : job.employmentType === 'CONTRACT'
                      ? 'Contract'
                      : job.employmentType === 'INTERNSHIP'
                      ? 'Internship'
                      : 'Part Time'}
                  </span>
                </span>
              </div>
            </div>

            {/* Apply CTA Header Button */}
            <div className="pt-2 sm:pt-0">
              <Link
                href={`/careers/${job.id}/apply`}
                className="w-full sm:w-auto px-6 py-2.5 bg-[#5B49D6] text-white rounded-lg text-xs font-bold hover:bg-[#5B49D6]/90 shadow-xs transition-all inline-flex items-center justify-center gap-2"
              >
                <span>Apply for this Role</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* Quick Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-[#E6E8F0]">
            <div className="p-3 bg-[#F6F7FB] rounded-lg border border-[#E6E8F0]">
              <span className="text-[11px] font-medium text-[#6B7490] block">Experience</span>
              <span className="text-xs sm:text-sm font-bold text-[#1B2236] mt-0.5 block">
                {job.experienceMin != null && job.experienceMax != null
                  ? `${job.experienceMin}–${job.experienceMax} years`
                  : `${job.experienceMin || job.experienceMax || 1}+ years`}
              </span>
            </div>

            <div className="p-3 bg-[#F6F7FB] rounded-lg border border-[#E6E8F0]">
              <span className="text-[11px] font-medium text-[#6B7490] block">Openings</span>
              <span className="text-xs sm:text-sm font-bold text-[#1B2236] mt-0.5 block">
                {job.openings} {job.openings === 1 ? 'position' : 'positions'}
              </span>
            </div>

            <div className="p-3 bg-[#F6F7FB] rounded-lg border border-[#E6E8F0]">
              <span className="text-[11px] font-medium text-[#6B7490] block">Compensation</span>
              <span className="text-xs sm:text-sm font-bold text-[#12B76A] mt-0.5 block">
                {job.isSalaryPublic && job.salaryMin != null && job.salaryMax != null
                  ? `₹${(job.salaryMin / 100000).toFixed(0)}L – ₹${(job.salaryMax / 100000).toFixed(0)}L`
                  : 'Competitive CTC'}
              </span>
            </div>

            <div className="p-3 bg-[#F6F7FB] rounded-lg border border-[#E6E8F0]">
              <span className="text-[11px] font-medium text-[#6B7490] block">Published Date</span>
              <span className="text-xs sm:text-sm font-bold text-[#1B2236] mt-0.5 block">
                {job.publishedAt
                  ? new Date(job.publishedAt).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })
                  : 'Recently'}
              </span>
            </div>
          </div>
        </div>

        {/* 2-Column Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Details (8 cols) */}
          <div className="lg:col-span-8 space-y-6">
            {/* Description Section */}
            {job.description && (
              <div className="bg-white rounded-xl border border-[#E6E8F0] p-6 shadow-xs space-y-3">
                <h2 className="text-base font-bold text-[#1B2236]">Role Overview</h2>
                <div className="text-xs sm:text-sm text-[#1B2236] leading-relaxed whitespace-pre-line">
                  {job.description}
                </div>
              </div>
            )}

            {/* Requirements Section */}
            {job.requirements && (
              <div className="bg-white rounded-xl border border-[#E6E8F0] p-6 shadow-xs space-y-3">
                <h2 className="text-base font-bold text-[#1B2236]">What We Are Looking For</h2>
                <div className="text-xs sm:text-sm text-[#1B2236] leading-relaxed whitespace-pre-line">
                  {job.requirements}
                </div>
              </div>
            )}

            {/* Required Skills Chips */}
            {job.requiredSkills.length > 0 && (
              <div className="bg-white rounded-xl border border-[#E6E8F0] p-6 shadow-xs space-y-3">
                <h2 className="text-base font-bold text-[#1B2236]">Key Skills & Technologies</h2>
                <div className="flex flex-wrap gap-2">
                  {job.requiredSkills.map((skill, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 rounded-lg text-xs font-semibold bg-[#EEEBFB] text-[#5B49D6]"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column Summary (4 cols) */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white rounded-xl border border-[#E6E8F0] p-6 shadow-xs space-y-5 sticky top-6">
              <h3 className="text-sm font-bold text-[#1B2236]">Ready to apply?</h3>
              <p className="text-xs text-[#6B7490] leading-relaxed">
                Submit your profile in under 2 minutes. No prior account creation or password required.
              </p>

              <Link
                href={`/careers/${job.id}/apply`}
                className="w-full py-2.5 bg-[#5B49D6] text-white rounded-lg text-xs font-bold hover:bg-[#5B49D6]/90 shadow-xs transition-all flex items-center justify-center gap-2"
              >
                <span>Start Application</span>
                <ArrowRight className="w-4 h-4" />
              </Link>

              <div className="pt-4 border-t border-[#E6E8F0] space-y-2.5 text-xs text-[#6B7490]">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#12B76A]" />
                  <span>Resume PDF/DOCX accepted</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#12B76A]" />
                  <span>Save draft available anytime</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#12B76A]" />
                  <span>Direct recruiter review</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
