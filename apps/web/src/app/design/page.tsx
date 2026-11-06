'use client';

import React, { useState } from 'react';
import {
  tokens,
  Button,
  Badge,
  Input,
  Select,
  Textarea,
  Checkbox,
  Radio,
  Switch,
  FormField,
  OTPInput,
  StatCard,
  SectionCard,
  CandidateCard,
  Tabs,
  Breadcrumbs,
  DataTable,
  Avatar,
  KanbanColumn,
  KanbanCard,
  Modal,
  Drawer,
  Banner,
  Toast,
  Stepper,
  Skeleton,
  EmptyState,
  Timeline,
  WeekCalendar,
} from '@hireflow/ui';
import {
  Users,
  Briefcase,
  Calendar,
  Award,
  Search,
  Mail,
  Filter,
  Eye,
  FileText,
  ExternalLink,
} from 'lucide-react';

export default function DesignSystemPage() {
  // Interactive state
  const [activeTab, setActiveTab] = useState('overview');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [otpValue, setOtpValue] = useState('5492');
  const [switchChecked, setSwitchChecked] = useState(true);
  const [checkboxChecked, setCheckboxChecked] = useState(true);
  const [radioSelected, setRadioSelected] = useState('full-time');
  const [tablePage, setTablePage] = useState(1);
  const [currentStep, setCurrentStep] = useState(1);

  // Sample Table Data
  const candidatesData = [
    {
      id: 'C-0001',
      name: 'Aarav Shah',
      role: 'Senior Full Stack Engineer',
      client: 'Acme Technologies',
      experience: '5 yrs',
      location: 'Mumbai, India',
      salary: '₹28,00,000',
      stage: 'Technical' as const,
    },
    {
      id: 'C-0002',
      name: 'Riya Desai',
      role: 'Product Designer',
      client: 'Bright Labs',
      experience: '4 yrs',
      location: 'Bengaluru, India',
      salary: '₹22,00,000',
      stage: 'Client Review' as const,
    },
    {
      id: 'C-0003',
      name: 'Priya Kapoor',
      role: 'Backend Architect',
      client: 'Northstar Analytics',
      experience: '7 yrs',
      location: 'Pune, India',
      salary: '₹34,00,000',
      stage: 'Offer' as const,
    },
    {
      id: 'C-0004',
      name: 'Rahul Sharma',
      role: 'DevOps & Cloud Engineer',
      client: 'Vertex Systems',
      experience: '3 yrs',
      location: 'Remote, India',
      salary: '₹18,00,000',
      stage: 'Screening' as const,
    },
  ];

  const tableColumns = [
    {
      key: 'name',
      header: 'Candidate',
      sortable: true,
      render: (row: (typeof candidatesData)[0]) => (
        <div className="flex items-center gap-2.5">
          <Avatar name={row.name} size="sm" />
          <div>
            <p className="font-bold text-navy text-xs">{row.name}</p>
            <p className="text-[11px] text-muted">{row.role}</p>
          </div>
        </div>
      ),
    },
    { key: 'client', header: 'Client', sortable: true },
    { key: 'experience', header: 'Experience' },
    { key: 'salary', header: 'Expected CTC' },
    {
      key: 'stage',
      header: 'Stage',
      render: (row: (typeof candidatesData)[0]) => <Badge stage={row.stage} dot size="sm" />,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right' as const,
      render: () => (
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="sm" leftIcon={<Eye className="w-3.5 h-3.5" />}>
            View
          </Button>
        </div>
      ),
    },
  ];

  // Calendar Events
  const calendarEvents = [
    {
      id: 'evt-1',
      candidateName: 'Aarav Shah',
      jobTitle: 'Senior Full Stack Engineer',
      roundName: 'Round 2: Technical Interview',
      startTime: '10:00 AM',
      endTime: '11:00 AM',
      dayIndex: 0,
      status: 'scheduled' as const,
    },
    {
      id: 'evt-2',
      candidateName: 'Riya Desai',
      jobTitle: 'Product Designer',
      roundName: 'Round 3: Client Portfolio Review',
      startTime: '02:30 PM',
      endTime: '03:30 PM',
      dayIndex: 2,
      status: 'rescheduled' as const,
    },
    {
      id: 'evt-3',
      candidateName: 'Vikram Mehta',
      jobTitle: 'Data Engineer',
      roundName: 'Round 1: Screening Call',
      startTime: '11:30 AM',
      endTime: '12:00 PM',
      dayIndex: 3,
      status: 'no-show' as const,
    },
  ];

  return (
    <div className="min-h-screen bg-page-bg py-10 px-6 sm:px-12 max-w-7xl mx-auto space-y-12">
      {/* Page Header */}
      <div className="border-b border-border pb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Breadcrumbs
            items={[
              { label: 'HireFlow ATS', href: '/' },
              { label: 'Design System', isCurrent: true },
            ]}
          />
          <h1 className="text-3xl font-extrabold text-navy mt-2 tracking-tight">
            HireFlow Design System
          </h1>
          <p className="text-sm text-muted mt-1">
            Official UI tokens & component library verified against Figma Frames 00–48.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" size="sm" onClick={() => setIsModalOpen(true)}>
            Open Test Modal
          </Button>
          <Button variant="primary" size="sm" onClick={() => setIsDrawerOpen(true)}>
            Open Candidate Drawer
          </Button>
        </div>
      </div>

      {/* TABS COMPONENT SHOWCASE */}
      <section className="space-y-4">
        <Tabs
          activeTab={activeTab}
          onChange={setActiveTab}
          tabs={[
            { id: 'overview', label: 'All Components', count: 13 },
            { id: 'forms', label: 'Forms & Inputs' },
            { id: 'candidates', label: 'Candidate & Pipeline', count: 4 },
          ]}
        />
      </section>

      {/* 1. COLOR PALETTE */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-navy flex items-center gap-2">
          <span>1. Brand Color Palette (Single Source of Truth)</span>
          <span className="text-xs font-normal text-muted px-2 py-0.5 rounded bg-primary-soft text-primary">
            Strict Tokens
          </span>
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-3">
          {[
            { name: 'Primary', hex: tokens.colors.primary, bg: 'bg-[#5B49D6]', text: 'text-white' },
            { name: 'Primary Soft', hex: tokens.colors.primarySoft, bg: 'bg-[#EEEBFB]', text: 'text-navy' },
            { name: 'Dark Navy', hex: tokens.colors.navy, bg: 'bg-[#1E2A4A]', text: 'text-white' },
            { name: 'Page BG', hex: tokens.colors.pageBg, bg: 'bg-[#F6F7FB]', text: 'text-navy', border: true },
            { name: 'Card', hex: tokens.colors.card, bg: 'bg-[#FFFFFF]', text: 'text-navy', border: true },
            { name: 'Border', hex: tokens.colors.border, bg: 'bg-[#E6E8F0]', text: 'text-navy' },
            { name: 'Main Text', hex: tokens.colors.text, bg: 'bg-[#1B2236]', text: 'text-white' },
            { name: 'Muted Text', hex: tokens.colors.muted, bg: 'bg-[#6B7490]', text: 'text-white' },
          ].map((c) => (
            <div
              key={c.name}
              className={`rounded-card p-3 flex flex-col justify-between h-24 shadow-xs ${c.bg} ${c.text} ${
                c.border ? 'border border-border' : ''
              }`}
            >
              <span className="text-xs font-bold leading-tight">{c.name}</span>
              <span className="text-[11px] font-mono tracking-wider opacity-90">{c.hex}</span>
            </div>
          ))}
        </div>

        {/* Semantic Colors */}
        <h3 className="text-xs font-bold text-muted uppercase tracking-wider mt-4">Semantic Tokens</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-card bg-success-soft border border-success/30 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-[#0E7A47]">Success</p>
              <p className="text-[10px] text-muted">#12B76A / #E3F6EC</p>
            </div>
            <span className="h-4 w-4 rounded-full bg-success" />
          </div>
          <div className="p-3 rounded-card bg-warning-soft border border-warning/30 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-[#B45309]">Warning</p>
              <p className="text-[10px] text-muted">#F59E0B / #FEF3DC</p>
            </div>
            <span className="h-4 w-4 rounded-full bg-warning" />
          </div>
          <div className="p-3 rounded-card bg-danger-soft border border-danger/30 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-[#B91C1C]">Danger</p>
              <p className="text-[10px] text-muted">#E5484D / #FDECEC</p>
            </div>
            <span className="h-4 w-4 rounded-full bg-danger" />
          </div>
          <div className="p-3 rounded-card bg-info-soft border border-info/30 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-[#1D4ED8]">Info</p>
              <p className="text-[10px] text-muted">#3B82F6 / #E5F0FF</p>
            </div>
            <span className="h-4 w-4 rounded-full bg-info" />
          </div>
        </div>
      </section>

      {/* 2. TYPOGRAPHY */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-navy">2. Typography Hierarchy (Inter font)</h2>
        <div className="rounded-card border border-border bg-card p-6 space-y-4">
          <div className="flex items-baseline justify-between border-b border-border pb-3">
            <span className="text-3xl font-extrabold text-navy">Display Heading (32px Bold)</span>
            <span className="text-xs text-muted font-mono">text-3xl font-extrabold</span>
          </div>
          <div className="flex items-baseline justify-between border-b border-border pb-3">
            <span className="text-2xl font-bold text-navy">Section Title (24px Bold)</span>
            <span className="text-xs text-muted font-mono">text-2xl font-bold</span>
          </div>
          <div className="flex items-baseline justify-between border-b border-border pb-3">
            <span className="text-base font-semibold text-text">Card Header / Modal Title (16px Semibold)</span>
            <span className="text-xs text-muted font-mono">text-base font-semibold</span>
          </div>
          <div className="flex items-baseline justify-between border-b border-border pb-3">
            <span className="text-sm font-normal text-text leading-relaxed">
              Body Text (14px Regular) — Clean, readable data display for applicant details and candidate resumes.
            </span>
            <span className="text-xs text-muted font-mono">text-sm text-text</span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-medium text-muted">
              Helper Label / Caption (12px Muted) — WCAG AA verified contrast ratio.
            </span>
            <span className="text-xs text-muted font-mono">text-xs text-muted</span>
          </div>
        </div>
      </section>

      {/* 3. BUTTONS */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-navy">3. Buttons</h2>
        <div className="rounded-card border border-border bg-card p-6 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary">Primary Action</Button>
            <Button variant="secondary">Secondary Action</Button>
            <Button variant="outline">Outline Button</Button>
            <Button variant="ghost">Ghost Button</Button>
            <Button variant="danger">Delete / Reject</Button>
            <Button variant="primary" disabled>Disabled State</Button>
            <Button variant="primary" isLoading>Loading State</Button>
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-border">
            <Button variant="primary" size="sm" leftIcon={<Search className="w-3.5 h-3.5" />}>
              Search CVs
            </Button>
            <Button variant="outline" size="sm" leftIcon={<Filter className="w-3.5 h-3.5" />}>
              Filter
            </Button>
            <Button variant="secondary" size="sm" rightIcon={<ExternalLink className="w-3.5 h-3.5" />}>
              Client Portal
            </Button>
          </div>
        </div>
      </section>

      {/* 4. FORM CONTROLS */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-navy">4. Form Controls</h2>
        <div className="rounded-card border border-border bg-card p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField label="Full Name" required helperText="As mentioned on candidate's official ID">
            <Input placeholder="e.g. Aarav Shah" />
          </FormField>

          <FormField label="Candidate Email" required error="Please provide a valid corporate email">
            <Input
              type="email"
              defaultValue="invalid-email"
              error
              leftIcon={<Mail className="w-4 h-4" />}
            />
          </FormField>

          <FormField label="Current Job Title">
            <Select defaultValue="fullstack">
              <option value="fullstack">Senior Full Stack Engineer</option>
              <option value="backend">Backend Architect</option>
              <option value="design">Lead Product Designer</option>
            </Select>
          </FormField>

          <FormField label="Notice Period & Notes">
            <Textarea placeholder="Current notice period, expected joining date, or recruiter comments..." />
          </FormField>

          <div className="space-y-3">
            <label className="text-xs font-semibold text-text block">Two-Step Verification Code (OTP)</label>
            <OTPInput value={otpValue} onChange={setOtpValue} />
            <p className="text-xs text-muted">Auto-focuses next digit, supports paste from clipboard.</p>
          </div>

          <div className="space-y-4">
            <label className="text-xs font-semibold text-text block">Selection Toggles</label>
            <div className="space-y-2">
              <Checkbox
                label="Candidate gave explicit consent for profile submission"
                checked={checkboxChecked}
                onChange={(e) => setCheckboxChecked(e.target.checked)}
              />
              <div className="flex items-center gap-4 pt-1">
                <Radio
                  name="employment"
                  label="Full-time"
                  checked={radioSelected === 'full-time'}
                  onChange={() => setRadioSelected('full-time')}
                />
                <Radio
                  name="employment"
                  label="Contract"
                  checked={radioSelected === 'contract'}
                  onChange={() => setRadioSelected('contract')}
                />
              </div>
              <div className="pt-2">
                <Switch
                  label="Active in Recruiter Pipeline"
                  checked={switchChecked}
                  onChange={setSwitchChecked}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. STATUS BADGES */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-navy">5. Status Badges & Stage Variants</h2>
        <div className="rounded-card border border-border bg-card p-6 space-y-4">
          <div>
            <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">
              Recruitment Stage Variants
            </h4>
            <div className="flex flex-wrap items-center gap-2.5">
              <Badge stage="Sourced" dot />
              <Badge stage="Screening" dot />
              <Badge stage="Interview" dot />
              <Badge stage="Technical" dot />
              <Badge stage="Client Review" dot />
              <Badge stage="Offer" dot />
              <Badge stage="Placed" dot />
              <Badge stage="Rejected" dot />
            </div>
          </div>

          <div className="pt-3 border-t border-border">
            <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">
              Semantic Indicators
            </h4>
            <div className="flex flex-wrap items-center gap-2.5">
              <Badge variant="primary">New Application</Badge>
              <Badge variant="success">Active</Badge>
              <Badge variant="warning">Awaiting Approval</Badge>
              <Badge variant="danger">Action Required</Badge>
              <Badge variant="info">Scheduled</Badge>
            </div>
          </div>
        </div>
      </section>

      {/* 6. STAT CARDS */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-navy">6. Stat Cards (Dashboard Frame 01)</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Active Job Openings"
            value="24"
            change="+12.5%"
            trend="up"
            icon={<Briefcase className="w-4 h-4" />}
          />
          <StatCard
            title="Total Candidates"
            value="1,420"
            change="+8.3%"
            trend="up"
            icon={<Users className="w-4 h-4" />}
          />
          <StatCard
            title="Interviews This Week"
            value="38"
            change="-4.2%"
            trend="down"
            icon={<Calendar className="w-4 h-4" />}
          />
          <StatCard
            title="Placements This Month"
            value="14"
            change="+22.0%"
            trend="up"
            icon={<Award className="w-4 h-4" />}
          />
        </div>
      </section>

      {/* 7. SECTION CARD & STEPPER */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-navy">7. Section Cards & Candidate Stepper</h2>
        <SectionCard
          title="Candidate Recruitment Progression"
          subtitle="Overall pipeline workflow from initial sourcing to client placement"
          headerAction={
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentStep((prev) => (prev >= 3 ? 0 : prev + 1))}
            >
              Advance Step
            </Button>
          }
        >
          <Stepper
            currentStep={currentStep}
            steps={[
              { label: 'Sourced', description: 'Resume parsed' },
              { label: 'Internal Review', description: 'Screening passed' },
              { label: 'Client Submission', description: 'Submitted to Acme' },
              { label: 'Offer & Placed', description: 'Offer accepted' },
            ]}
          />
        </SectionCard>
      </section>

      {/* 8. DATA TABLES */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-navy">8. Data Table (Sortable, Sticky, Paginated)</h2>
        <DataTable
          columns={tableColumns}
          data={candidatesData}
          keyExtractor={(row) => row.id}
          sortColumn="name"
          sortDirection="asc"
          currentPage={tablePage}
          totalPages={3}
          onPageChange={setTablePage}
        />
      </section>

      {/* 9. CANDIDATE COMPONENTS */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-navy">9. Candidate Components & Profile Cards</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <CandidateCard
            name="Aarav Shah"
            currentRole="Senior Full Stack Engineer"
            company="Acme Technologies"
            experience="5 yrs"
            location="Mumbai, India"
            expectedSalary="₹28 LPA"
            stage="Technical"
            matchScore={94}
            tags={['React', 'Node.js', 'PostgreSQL', 'AWS']}
            onAction={() => setIsDrawerOpen(true)}
          />
          <CandidateCard
            name="Riya Desai"
            currentRole="Product Designer"
            company="Bright Labs"
            experience="4 yrs"
            location="Bengaluru, India"
            expectedSalary="₹22 LPA"
            stage="Client Review"
            matchScore={88}
            tags={['Figma', 'Design Systems', 'UX Research']}
            onAction={() => setIsDrawerOpen(true)}
          />
          <CandidateCard
            name="Priya Kapoor"
            currentRole="Backend Architect"
            company="Northstar Analytics"
            experience="7 yrs"
            location="Pune, India"
            expectedSalary="₹34 LPA"
            stage="Offer"
            matchScore={96}
            tags={['Go', 'Kafka', 'Microservices']}
            onAction={() => setIsDrawerOpen(true)}
          />
        </div>
      </section>

      {/* 10. KANBAN PIPELINE */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-navy">10. Kanban Pipeline Components (Frame 05)</h2>
        <div className="flex gap-4 overflow-x-auto pb-4">
          <KanbanColumn
            id="col-sourced"
            title="Sourced"
            stage="Sourced"
            count={2}
            onAddCandidate={() => {}}
          >
            <KanbanCard
              candidate={{
                id: 'c1',
                name: 'Karan Mehra',
                role: 'Frontend Engineer',
                experience: '3 yrs',
                expectedSalary: '₹16 LPA',
                matchScore: 82,
                stage: 'Sourced',
              }}
              onClick={() => setIsDrawerOpen(true)}
            />
            <KanbanCard
              candidate={{
                id: 'c2',
                name: 'Neha Verma',
                role: 'UI Designer',
                experience: '2.5 yrs',
                expectedSalary: '₹14 LPA',
                matchScore: 78,
                stage: 'Sourced',
              }}
              onClick={() => setIsDrawerOpen(true)}
            />
          </KanbanColumn>

          <KanbanColumn
            id="col-technical"
            title="Technical Interview"
            stage="Technical"
            count={1}
            onAddCandidate={() => {}}
          >
            <KanbanCard
              candidate={{
                id: 'c3',
                name: 'Aarav Shah',
                role: 'Senior Full Stack Engineer',
                experience: '5 yrs',
                expectedSalary: '₹28 LPA',
                matchScore: 94,
                stage: 'Technical',
              }}
              onClick={() => setIsDrawerOpen(true)}
            />
          </KanbanColumn>

          <KanbanColumn
            id="col-review"
            title="Client Review"
            stage="Client Review"
            count={1}
            onAddCandidate={() => {}}
          >
            <KanbanCard
              candidate={{
                id: 'c4',
                name: 'Riya Desai',
                role: 'Product Designer',
                experience: '4 yrs',
                expectedSalary: '₹22 LPA',
                matchScore: 88,
                stage: 'Client Review',
              }}
              onClick={() => setIsDrawerOpen(true)}
            />
          </KanbanColumn>
        </div>
      </section>

      {/* 11. BANNERS & NOTIFICATIONS */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-navy">11. Banners & Notification Toasts</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <Banner variant="info" title="Candidate Parsing Finished">
              Resume auto-fill extracted 14 fields with 96% confidence. Please review before saving.
            </Banner>
            <Banner variant="warning" title="Manager Approval Required">
              This job order is in draft mode. Submissions remain paused until a manager signs off.
            </Banner>
            <Banner variant="danger" title="Possible Duplicate Detected">
              A candidate with email <strong>aarav@example.com</strong> already exists in database.
            </Banner>
            <Banner variant="success" title="Profile Submitted to Client">
              Standardized CV package sent to Acme Technologies hiring manager.
            </Banner>
          </div>

          <div className="space-y-3 flex flex-col justify-center">
            <Toast
              type="success"
              title="Interview Confirmed"
              message="Round 2 calendar invite dispatched to Aarav Shah."
            />
            <Toast
              type="error"
              title="Upload Failed"
              message="CV file exceeds 10MB limit. Please upload a smaller file."
            />
          </div>
        </div>
      </section>

      {/* 12. CALENDAR & TIMELINE */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-navy">12. Calendar & Activity Timeline (Frames 03 & 06)</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <WeekCalendar events={calendarEvents} />
          </div>
          <div className="rounded-card border border-border bg-card p-5">
            <h4 className="text-xs font-bold text-navy uppercase tracking-wider mb-4">
              Recent Candidate Activity
            </h4>
            <Timeline
              items={[
                {
                  id: 't1',
                  title: 'Interview Completed',
                  timestamp: '10:30 AM Today',
                  description: 'Technical Round 1 conducted by Rahul Sharma. Recommended for Round 2.',
                  author: 'Rahul Sharma',
                },
                {
                  id: 't2',
                  title: 'Resume Auto-Parsed',
                  timestamp: 'Yesterday',
                  description: 'CV parsed from LinkedIn PDF attachment.',
                  author: 'System',
                },
                {
                  id: 't3',
                  title: 'Profile Sourced',
                  timestamp: '2 days ago',
                  description: 'Added from Foundit portal.',
                  author: 'Mitisha Patidar',
                },
              ]}
            />
          </div>
        </div>
      </section>

      {/* 13. LOADING & EMPTY STATES */}
      <section className="space-y-4">
        <h2 className="text-lg font-bold text-navy">13. Loading Skeletons & Empty States</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-card border border-border bg-card p-6 space-y-3">
            <h4 className="text-xs font-bold text-muted uppercase">Skeleton Placeholders</h4>
            <div className="flex items-center gap-3">
              <Skeleton variant="circular" width={40} height={40} />
              <div className="space-y-2 flex-1">
                <Skeleton variant="text" width="60%" />
                <Skeleton variant="text" width="40%" />
              </div>
            </div>
            <Skeleton variant="rectangular" height={80} />
          </div>

          <EmptyState
            icon={<FileText className="w-6 h-6" />}
            title="No Candidates Found"
            description="There are currently no applicants in this pipeline stage. Source new candidates or adjust your filters."
            actionText="Add New Candidate"
            onAction={() => {}}
          />
        </div>
      </section>

      {/* SAMPLE MODAL COMPONENT */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Schedule Client Interview"
        description="Select interview round and allocate panel members."
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={() => setIsModalOpen(false)}>
              Send Invitation
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <FormField label="Interview Round">
            <Select defaultValue="r2">
              <option value="r1">Round 1: Initial Screening</option>
              <option value="r2">Round 2: Technical Deep Dive</option>
              <option value="r3">Round 3: Client Fit</option>
            </Select>
          </FormField>
          <FormField label="Meeting Platform">
            <Select defaultValue="meet">
              <option value="meet">Google Meet (Auto-generated link)</option>
              <option value="teams">Microsoft Teams</option>
              <option value="zoom">Zoom Video</option>
            </Select>
          </FormField>
        </div>
      </Modal>

      {/* SAMPLE DRAWER COMPONENT */}
      <Drawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title="Candidate Profile Summary"
        subtitle="Candidate Code: C-0001 • Acme Technologies"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setIsDrawerOpen(false)}>
              Close
            </Button>
            <Button variant="primary" size="sm">
              Schedule Interview
            </Button>
          </>
        }
      >
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Avatar name="Aarav Shah" size="lg" status="online" />
            <div>
              <h3 className="text-base font-bold text-navy">Aarav Shah</h3>
              <p className="text-xs text-muted">Senior Full Stack Engineer</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge stage="Technical" dot size="sm" />
                <span className="text-xs font-semibold text-primary">94% Match</span>
              </div>
            </div>
          </div>

          <div className="rounded-input border border-border p-3.5 bg-page-bg/50 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-muted">Current CTC:</span>
              <span className="font-semibold text-text">₹24,00,000</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Expected CTC:</span>
              <span className="font-semibold text-text">₹28,00,000</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Notice Period:</span>
              <span className="font-semibold text-text">30 Days (Negotiable)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Location:</span>
              <span className="font-semibold text-text">Mumbai (Prefers Hybrid)</span>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-bold text-navy uppercase tracking-wider mb-2">
              Verified Skills
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {['React', 'Next.js', 'Node.js', 'TypeScript', 'PostgreSQL', 'Docker', 'AWS'].map(
                (skill) => (
                  <span
                    key={skill}
                    className="text-xs px-2.5 py-1 rounded-pill bg-primary-soft text-primary font-medium"
                  >
                    {skill}
                  </span>
                )
              )}
            </div>
          </div>

          <div>
            <h4 className="text-xs font-bold text-navy uppercase tracking-wider mb-2">
              Recruiter Activity Log
            </h4>
            <Timeline
              items={[
                {
                  id: 'act-1',
                  title: 'Shortlisted by Recruiter',
                  timestamp: 'Today at 09:15 AM',
                  description: 'Profile matched with Acme Technologies job order J-204.',
                  author: 'Mitisha Patidar',
                },
              ]}
            />
          </div>
        </div>
      </Drawer>
    </div>
  );
}
