'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Search,
  MapPin,
  Briefcase,
  Clock,
  ArrowRight,
  Filter,
  RotateCcw,
  Building2,
  Users,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import {
  getPublicJobsAction,
  getPublicCareersBrandingAction,
} from '@/actions/public-careers';
import {
  PublicJobCardDTO,
  CareersBrandingDTO,
  DEFAULT_CAREERS_BRANDING,
} from '@hireflow/shared';

export default function PublicCareersPage() {
  const [branding, setBranding] = useState<CareersBrandingDTO & { orgName: string }>({
    ...DEFAULT_CAREERS_BRANDING,
    orgName: 'Aureva Capital',
  });
  const [jobs, setJobs] = useState<PublicJobCardDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalJobs, setTotalJobs] = useState(0);

  // Fetch Branding & Initial Jobs
  useEffect(() => {
    async function loadBranding() {
      const res = await getPublicCareersBrandingAction();
      if (res.success && res.data) {
        setBranding(res.data);
      }
    }
    loadBranding();
  }, []);

  useEffect(() => {
    async function loadJobs() {
      setLoading(true);
      try {
        const res = await getPublicJobsAction({
          search: searchQuery || undefined,
          location: locationFilter || undefined,
          employmentType: typeFilter || undefined,
          page,
          limit: 10,
        });

        if (res.success) {
          setJobs(res.data);
          setTotalPages(res.pagination.totalPages);
          setTotalJobs(res.pagination.total);
        }
      } catch (err) {
        console.error('Failed to load careers jobs:', err);
      } finally {
        setLoading(false);
      }
    }

    const timer = setTimeout(() => {
      loadJobs();
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery, locationFilter, typeFilter, page]);

  // Unique locations from fetched jobs for filter dropdown
  const availableLocations = useMemo(() => {
    const set = new Set<string>();
    jobs.forEach((j) => {
      if (j.location) set.add(j.location);
    });
    return Array.from(set);
  }, [jobs]);

  const handleResetFilters = () => {
    setSearchQuery('');
    setLocationFilter('');
    setTypeFilter('');
    setPage(1);
  };

  const hasActiveFilters = Boolean(searchQuery || locationFilter || typeFilter);

  return (
    <div className="min-h-screen bg-[#F6F7FB]">
      {/* 1. Header Hero with Dynamic Branding */}
      <div className="bg-[#1E2A4A] text-white py-14 px-4 sm:px-6 lg:px-8 border-b border-white/10">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-bold bg-[#EEEBFB] text-[#5B49D6] mb-4 shadow-xs">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{branding.orgName} Careers Network</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-3">
            {branding.headline}
          </h1>
          <p className="text-sm sm:text-base text-[#E6E8F0] max-w-2xl mx-auto leading-relaxed">
            {branding.introductoryCopy}
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 2. Search & Filter Bar (Figma Frame 42) */}
        <div className="bg-white rounded-xl border border-[#E6E8F0] p-4 shadow-xs mb-8">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            {/* Search Input */}
            <div className="sm:col-span-5 relative">
              <Search className="w-4 h-4 text-[#6B7490] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Search by role, keyword or skill..."
                className="w-full pl-9 pr-3.5 py-2.5 text-xs text-[#1B2236] bg-[#F6F7FB] border border-[#E6E8F0] rounded-lg focus:outline-none focus:border-[#5B49D6] focus:bg-white transition-colors placeholder:text-[#6B7490]"
              />
            </div>

            {/* Location Filter */}
            <div className="sm:col-span-3">
              <select
                value={locationFilter}
                onChange={(e) => {
                  setLocationFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2.5 text-xs text-[#1B2236] bg-[#F6F7FB] border border-[#E6E8F0] rounded-lg focus:outline-none focus:border-[#5B49D6] focus:bg-white transition-colors"
              >
                <option value="">All Locations</option>
                <option value="Bengaluru">Bengaluru</option>
                <option value="Remote">Remote</option>
                <option value="Hyderabad">Hyderabad</option>
                <option value="Mumbai">Mumbai</option>
                <option value="Pune">Pune</option>
                {availableLocations
                  .filter((l) => !['Bengaluru', 'Remote', 'Hyderabad', 'Mumbai', 'Pune'].includes(l))
                  .map((loc) => (
                    <option key={loc} value={loc}>
                      {loc}
                    </option>
                  ))}
              </select>
            </div>

            {/* Employment Type Filter */}
            <div className="sm:col-span-3">
              <select
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2.5 text-xs text-[#1B2236] bg-[#F6F7FB] border border-[#E6E8F0] rounded-lg focus:outline-none focus:border-[#5B49D6] focus:bg-white transition-colors"
              >
                <option value="">All Employment Types</option>
                <option value="FULL_TIME">Full Time</option>
                <option value="CONTRACT">Contract</option>
                <option value="INTERNSHIP">Internship</option>
                <option value="PART_TIME">Part Time</option>
              </select>
            </div>

            {/* Reset Filters */}
            <div className="sm:col-span-1 flex items-center justify-end">
              <button
                type="button"
                onClick={handleResetFilters}
                disabled={!hasActiveFilters}
                title="Reset filters"
                className={`p-2.5 rounded-lg border text-xs flex items-center justify-center transition-colors ${
                  hasActiveFilters
                    ? 'border-[#E6E8F0] text-[#1B2236] hover:bg-[#EEEBFB] hover:text-[#5B49D6]'
                    : 'border-[#E6E8F0]/50 text-[#6B7490]/40 cursor-not-allowed'
                }`}
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Active Results Summary */}
          <div className="mt-3 pt-3 border-t border-[#E6E8F0] flex items-center justify-between text-xs text-[#6B7490]">
            <span>
              Showing <strong className="text-[#1B2236]">{jobs.length}</strong> of{' '}
              <strong className="text-[#1B2236]">{totalJobs}</strong> published positions
            </span>
            {hasActiveFilters && (
              <span className="text-[#5B49D6] font-medium">Filtered results</span>
            )}
          </div>
        </div>

        {/* 3. Job Cards Listing */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="bg-white rounded-xl border border-[#E6E8F0] p-6 shadow-xs animate-pulse space-y-3"
              >
                <div className="h-4 bg-gray-200 rounded w-1/3" />
                <div className="h-3 bg-gray-200 rounded w-1/4" />
                <div className="h-3 bg-gray-100 rounded w-3/4" />
              </div>
            ))}
          </div>
        ) : jobs.length === 0 ? (
          /* Empty State */
          <div className="bg-white rounded-xl border border-[#E6E8F0] p-12 text-center shadow-xs">
            <div className="w-12 h-12 rounded-full bg-[#EEEBFB] text-[#5B49D6] flex items-center justify-center mx-auto mb-3">
              <Briefcase className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-[#1B2236]">No open positions found</h3>
            <p className="text-xs text-[#6B7490] mt-1 max-w-sm mx-auto">
              {hasActiveFilters
                ? 'No published jobs match your selected search criteria. Try broadening your filters.'
                : 'There are currently no active public positions available. Please check back soon.'}
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="mt-4 px-4 py-2 bg-[#5B49D6] text-white rounded-lg text-xs font-semibold hover:bg-[#5B49D6]/90 transition-colors inline-flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Clear All Filters</span>
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {jobs.map((job) => (
              <div
                key={job.id}
                className="bg-white rounded-xl border border-[#E6E8F0] p-5 sm:p-6 shadow-xs hover:border-[#5B49D6]/50 hover:shadow-sm transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  {/* Left Column: Job Info */}
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base sm:text-lg font-bold text-[#1B2236] tracking-tight">
                        <Link
                          href={`/careers/${job.id}`}
                          className="hover:text-[#5B49D6] transition-colors"
                        >
                          {job.title}
                        </Link>
                      </h2>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#EEEBFB] text-[#5B49D6]">
                        {job.code}
                      </span>
                      {job.isClientConfidential && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                          Confidential client
                        </span>
                      )}
                    </div>

                    {/* Metadata Pills */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[#6B7490]">
                      <span className="flex items-center gap-1 font-medium text-[#1B2236]">
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

                      {(job.experienceMin != null || job.experienceMax != null) && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-[#6B7490]" />
                          <span>
                            {job.experienceMin != null && job.experienceMax != null
                              ? `${job.experienceMin}–${job.experienceMax} yrs exp`
                              : `${job.experienceMin || job.experienceMax}+ yrs exp`}
                          </span>
                        </span>
                      )}

                      {/* Salary (rendered ONLY when isSalaryPublic is true) */}
                      {job.isSalaryPublic && job.salaryMin != null && job.salaryMax != null && (
                        <span className="font-bold text-[#12B76A] bg-emerald-50 px-2 py-0.5 rounded text-[11px]">
                          ₹{(job.salaryMin / 100000).toFixed(0)}L – ₹{(job.salaryMax / 100000).toFixed(0)}L CTC
                        </span>
                      )}
                    </div>

                    {/* Short Description */}
                    <p className="text-xs text-[#6B7490] line-clamp-2 leading-relaxed pt-1">
                      {job.shortDescription}
                    </p>

                    {/* Required Skills Badges */}
                    {job.requiredSkills.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {job.requiredSkills.slice(0, 5).map((skill, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#F6F7FB] text-[#1B2236] border border-[#E6E8F0]"
                          >
                            {skill}
                          </span>
                        ))}
                        {job.requiredSkills.length > 5 && (
                          <span className="text-[10px] text-[#6B7490] self-center">
                            +{job.requiredSkills.length - 5} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Right Column: Actions */}
                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#E6E8F0]">
                    <Link
                      href={`/careers/${job.id}`}
                      className="px-3.5 py-2 text-xs font-semibold text-[#1B2236] hover:text-[#5B49D6] transition-colors"
                    >
                      View Details
                    </Link>
                    <Link
                      href={`/careers/${job.id}/apply`}
                      className="px-4 py-2 bg-[#5B49D6] text-white rounded-lg text-xs font-semibold hover:bg-[#5B49D6]/90 shadow-xs transition-all flex items-center gap-1.5"
                    >
                      <span>Apply Now</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-8 flex items-center justify-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 rounded-lg border border-[#E6E8F0] text-xs font-semibold text-[#1B2236] disabled:opacity-50 hover:bg-white transition-colors"
            >
              Previous
            </button>
            <span className="text-xs text-[#6B7490] px-3">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-1.5 rounded-lg border border-[#E6E8F0] text-xs font-semibold text-[#1B2236] disabled:opacity-50 hover:bg-white transition-colors"
            >
              Next
            </button>
          </div>
        )}

        {/* Footer info */}
        <div className="mt-12 pt-6 border-t border-[#E6E8F0] text-center text-xs text-[#6B7490]">
          <p>{branding.footerCopy}</p>
        </div>
      </div>
    </div>
  );
}
