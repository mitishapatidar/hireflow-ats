/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from 'zod';
import { UserRole } from './roles';
import { sanitizeForCsv, generateCsvString } from './data-governance';

// ==========================================
// 1. REPORT ENTITIES & COLUMN CATALOG
// ==========================================

export type ReportEntityType =
  | 'CANDIDATES'
  | 'JOBS'
  | 'APPLICATIONS'
  | 'INTERVIEWS'
  | 'SUBMISSIONS'
  | 'CLIENTS'
  | 'PLACEMENTS';

export interface ReportColumnMetadata {
  key: string;
  label: string;
  entity: ReportEntityType;
  dataType: 'string' | 'number' | 'date' | 'badge';
  description: string;
  relatedEntity?: string;
  isDefault: boolean;
  isSensitive?: boolean;
  exportEligible: boolean;
}

export const REPORT_COLUMN_CATALOG: Record<ReportEntityType, ReportColumnMetadata[]> = {
  CANDIDATES: [
    { key: 'code', label: 'Candidate Code', entity: 'CANDIDATES', dataType: 'string', description: 'Unique candidate tracking identifier', isDefault: true, exportEligible: true },
    { key: 'name', label: 'Full Name', entity: 'CANDIDATES', dataType: 'string', description: 'Candidate name', isDefault: true, exportEligible: true },
    { key: 'email', label: 'Email Address', entity: 'CANDIDATES', dataType: 'string', description: 'Primary contact email', isDefault: true, exportEligible: true },
    { key: 'phone', label: 'Phone Number', entity: 'CANDIDATES', dataType: 'string', description: 'Candidate contact phone', isDefault: true, exportEligible: true },
    { key: 'currentTitle', label: 'Current Title', entity: 'CANDIDATES', dataType: 'string', description: 'Current professional title', isDefault: true, exportEligible: true },
    { key: 'currentCompany', label: 'Current Company', entity: 'CANDIDATES', dataType: 'string', description: 'Current employer', isDefault: true, exportEligible: true },
    { key: 'experienceYears', label: 'Experience (Years)', entity: 'CANDIDATES', dataType: 'number', description: 'Total verified years of work experience', isDefault: true, exportEligible: true },
    { key: 'location', label: 'Location', entity: 'CANDIDATES', dataType: 'string', description: 'Candidate location / city', isDefault: true, exportEligible: true },
    { key: 'status', label: 'Status', entity: 'CANDIDATES', dataType: 'badge', description: 'Sourcing/pipeline status', isDefault: true, exportEligible: true },
    { key: 'createdAt', label: 'Profile Created Date', entity: 'CANDIDATES', dataType: 'date', description: 'Date talent profile was added', isDefault: true, exportEligible: true },
    // Sensitive salary columns (ADMIN only)
    { key: 'currentSalary', label: 'Current Salary (INR)', entity: 'CANDIDATES', dataType: 'number', description: 'Candidate current compensation', isDefault: false, isSensitive: true, exportEligible: true },
    { key: 'expectedSalary', label: 'Expected Salary (INR)', entity: 'CANDIDATES', dataType: 'number', description: 'Candidate expected compensation', isDefault: false, isSensitive: true, exportEligible: true },
  ],
  JOBS: [
    { key: 'code', label: 'Job Code', entity: 'JOBS', dataType: 'string', description: 'Unique job mandate code', isDefault: true, exportEligible: true },
    { key: 'title', label: 'Job Title', entity: 'JOBS', dataType: 'string', description: 'Official requisition title', isDefault: true, exportEligible: true },
    { key: 'clientName', label: 'Client Company', entity: 'JOBS', dataType: 'string', description: 'Hiring corporate client', isDefault: true, exportEligible: true },
    { key: 'employmentType', label: 'Employment Type', entity: 'JOBS', dataType: 'badge', description: 'Full-time, Contract, C2H', isDefault: true, exportEligible: true },
    { key: 'openings', label: 'Openings', entity: 'JOBS', dataType: 'number', description: 'Total required positions', isDefault: true, exportEligible: true },
    { key: 'location', label: 'Location', entity: 'JOBS', dataType: 'string', description: 'Job location or Remote', isDefault: true, exportEligible: true },
    { key: 'status', label: 'Status', entity: 'JOBS', dataType: 'badge', description: 'Mandate lifecycle status', isDefault: true, exportEligible: true },
    { key: 'ownerName', label: 'Recruiter Owner', entity: 'JOBS', dataType: 'string', description: 'Assigned recruitment lead', isDefault: true, exportEligible: true },
    { key: 'createdAt', label: 'Opened Date', entity: 'JOBS', dataType: 'date', description: 'Date mandate was initiated', isDefault: true, exportEligible: true },
    // Sensitive salary band (ADMIN only)
    { key: 'salaryMin', label: 'Minimum Budget Band', entity: 'JOBS', dataType: 'number', description: 'Minimum budget range', isDefault: false, isSensitive: true, exportEligible: true },
    { key: 'salaryMax', label: 'Maximum Budget Band', entity: 'JOBS', dataType: 'number', description: 'Maximum budget range', isDefault: false, isSensitive: true, exportEligible: true },
  ],
  APPLICATIONS: [
    { key: 'candidateName', label: 'Candidate Name', entity: 'APPLICATIONS', dataType: 'string', description: 'Applicant full name', isDefault: true, exportEligible: true },
    { key: 'candidateEmail', label: 'Candidate Email', entity: 'APPLICATIONS', dataType: 'string', description: 'Applicant contact email', isDefault: true, exportEligible: true },
    { key: 'jobTitle', label: 'Job Title', entity: 'APPLICATIONS', dataType: 'string', description: 'Job mandate applied for', isDefault: true, exportEligible: true },
    { key: 'jobCode', label: 'Job Code', entity: 'APPLICATIONS', dataType: 'string', description: 'Mandate tracking code', isDefault: true, exportEligible: true },
    { key: 'clientName', label: 'Client Company', entity: 'APPLICATIONS', dataType: 'string', description: 'Hiring client organization', isDefault: true, exportEligible: true },
    { key: 'stageName', label: 'Current Stage', entity: 'APPLICATIONS', dataType: 'badge', description: 'Pipeline stage milestone', isDefault: true, exportEligible: true },
    { key: 'status', label: 'Status', entity: 'APPLICATIONS', dataType: 'badge', description: 'Application status', isDefault: true, exportEligible: true },
    { key: 'createdAt', label: 'Application Date', entity: 'APPLICATIONS', dataType: 'date', description: 'Date application entered pipeline', isDefault: true, exportEligible: true },
  ],
  INTERVIEWS: [
    { key: 'candidateName', label: 'Candidate Name', entity: 'INTERVIEWS', dataType: 'string', description: 'Interviewee full name', isDefault: true, exportEligible: true },
    { key: 'jobTitle', label: 'Job Mandate', entity: 'INTERVIEWS', dataType: 'string', description: 'Job title being evaluated', isDefault: true, exportEligible: true },
    { key: 'roundName', label: 'Interview Round', entity: 'INTERVIEWS', dataType: 'string', description: 'Round stage (e.g. Technical Round 1)', isDefault: true, exportEligible: true },
    { key: 'scheduledAt', label: 'Scheduled Time', entity: 'INTERVIEWS', dataType: 'date', description: 'Interview date and time', isDefault: true, exportEligible: true },
    { key: 'meetingType', label: 'Meeting Provider', entity: 'INTERVIEWS', dataType: 'badge', description: 'Google Meet, Zoom, Teams, In-Person', isDefault: true, exportEligible: true },
    { key: 'status', label: 'Interview Status', entity: 'INTERVIEWS', dataType: 'badge', description: 'SCHEDULED, COMPLETED, CANCELLED', isDefault: true, exportEligible: true },
    { key: 'interviewerName', label: 'Interviewer', entity: 'INTERVIEWS', dataType: 'string', description: 'Assigned interview lead / recruiter', isDefault: true, exportEligible: true },
  ],
  SUBMISSIONS: [
    { key: 'candidateName', label: 'Candidate Name', entity: 'SUBMISSIONS', dataType: 'string', description: 'Submitted talent full name', isDefault: true, exportEligible: true },
    { key: 'jobTitle', label: 'Job Mandate', entity: 'SUBMISSIONS', dataType: 'string', description: 'Mandate submitted against', isDefault: true, exportEligible: true },
    { key: 'clientName', label: 'Client Company', entity: 'SUBMISSIONS', dataType: 'string', description: 'Client company receiving profile', isDefault: true, exportEligible: true },
    { key: 'status', label: 'Submission Status', entity: 'SUBMISSIONS', dataType: 'badge', description: 'SUBMITTED, CLIENT_REVIEW, ACCEPTED, REJECTED', isDefault: true, exportEligible: true },
    { key: 'submittedAt', label: 'Submission Date', entity: 'SUBMISSIONS', dataType: 'date', description: 'Date profile was dispatched to client', isDefault: true, exportEligible: true },
  ],
  CLIENTS: [
    { key: 'code', label: 'Client Code', entity: 'CLIENTS', dataType: 'string', description: 'Unique client account code', isDefault: true, exportEligible: true },
    { key: 'legalName', label: 'Company Name', entity: 'CLIENTS', dataType: 'string', description: 'Client corporate name', isDefault: true, exportEligible: true },
    { key: 'industry', label: 'Industry', entity: 'CLIENTS', dataType: 'string', description: 'Business domain', isDefault: true, exportEligible: true },
    { key: 'location', label: 'Location', entity: 'CLIENTS', dataType: 'string', description: 'Client headquarters / office', isDefault: true, exportEligible: true },
    { key: 'status', label: 'Account Status', entity: 'CLIENTS', dataType: 'badge', description: 'ACTIVE, PROSPECT, INACTIVE', isDefault: true, exportEligible: true },
    { key: 'ownerName', label: 'Account Manager', entity: 'CLIENTS', dataType: 'string', description: 'Internal relationship manager', isDefault: true, exportEligible: true },
    { key: 'createdAt', label: 'Onboarded Date', entity: 'CLIENTS', dataType: 'date', description: 'Account creation date', isDefault: true, exportEligible: true },
  ],
  PLACEMENTS: [
    { key: 'candidateName', label: 'Placed Candidate', entity: 'PLACEMENTS', dataType: 'string', description: 'Candidate placed into role', isDefault: true, exportEligible: true },
    { key: 'jobTitle', label: 'Job Mandate', entity: 'PLACEMENTS', dataType: 'string', description: 'Hired position title', isDefault: true, exportEligible: true },
    { key: 'clientName', label: 'Client Company', entity: 'PLACEMENTS', dataType: 'string', description: 'Hiring corporate client', isDefault: true, exportEligible: true },
    { key: 'joiningDate', label: 'Joining Date', entity: 'PLACEMENTS', dataType: 'date', description: 'Official start date', isDefault: true, exportEligible: true },
    { key: 'status', label: 'Placement Status', entity: 'PLACEMENTS', dataType: 'badge', description: 'CONFIRMED, JOINED, ATTRITED', isDefault: true, exportEligible: true },
    { key: 'createdAt', label: 'Placement Date', entity: 'PLACEMENTS', dataType: 'date', description: 'Date offer acceptance was finalized', isDefault: true, exportEligible: true },
  ],
};

// Allowed Linked Entities for each primary entity
export const ALLOWED_LINKED_ENTITIES: Record<ReportEntityType, ReportEntityType[]> = {
  CANDIDATES: ['APPLICATIONS', 'SUBMISSIONS'],
  JOBS: ['CLIENTS', 'APPLICATIONS', 'SUBMISSIONS'],
  APPLICATIONS: ['CANDIDATES', 'JOBS', 'INTERVIEWS', 'SUBMISSIONS'],
  INTERVIEWS: ['APPLICATIONS', 'JOBS', 'CANDIDATES'],
  SUBMISSIONS: ['JOBS', 'CLIENTS', 'CANDIDATES'],
  CLIENTS: ['JOBS', 'SUBMISSIONS'],
  PLACEMENTS: ['CANDIDATES', 'JOBS', 'CLIENTS'],
};

// ==========================================
// 2. FORBIDDEN FIELDS & SECURITY GUARDS
// ==========================================

export const FORBIDDEN_REPORT_FIELDS = new Set([
  'notes',
  'internalNotes',
  'feePercentage',
  'commercialTerms',
  'recruiterMargin',
  'passwordHash',
  'tokenHash',
  'storageKey',
  'fileUrl',
  'otpHashed',
  'challengeHash',
  'scorecard',
  'technicalScore',
  'privatePanelNotes',
]);

/**
 * Validates selected report columns against forbidden sets and user role.
 */
export function validateReportColumns(
  primaryEntity: ReportEntityType,
  selectedColumns: string[],
  userRole: UserRole
): { valid: boolean; error?: string; safeColumns: string[] } {
  if (!selectedColumns || selectedColumns.length === 0) {
    return { valid: false, error: 'At least one column must be selected.', safeColumns: [] };
  }

  const catalog = REPORT_COLUMN_CATALOG[primaryEntity];
  if (!catalog) {
    return { valid: false, error: `Invalid primary entity: ${primaryEntity}`, safeColumns: [] };
  }

  const catalogMap = new Map(catalog.map((c) => [c.key, c]));
  const safeColumns: string[] = [];

  for (const col of selectedColumns) {
    // Check forbidden list
    const colLower = col.toLowerCase();
    if (FORBIDDEN_REPORT_FIELDS.has(col) || FORBIDDEN_REPORT_FIELDS.has(colLower)) {
      return {
        valid: false,
        error: `Access Denied: Column '${col}' contains confidential internal information and cannot be queried or exported.`,
        safeColumns: [],
      };
    }

    const meta = catalogMap.get(col);
    if (!meta) {
      // Check if it's a linked field formatted like 'job.title' or 'client.legalName'
      // Allowed if it matches safe linked keys
      if (col.includes('.')) {
        const [, subField] = col.split('.');
        if (FORBIDDEN_REPORT_FIELDS.has(subField.toLowerCase())) {
          return { valid: false, error: `Access Denied: Linked column '${col}' is forbidden.`, safeColumns: [] };
        }
        safeColumns.push(col);
        continue;
      }
      return {
        valid: false,
        error: `Column '${col}' is not part of the approved column catalog for entity ${primaryEntity}.`,
        safeColumns: [],
      };
    }

    // Sensitive field authorization
    if (meta.isSensitive && userRole !== UserRole.ADMIN) {
      return {
        valid: false,
        error: `Access Denied: Column '${meta.label}' is restricted to Administrator roles.`,
        safeColumns: [],
      };
    }

    safeColumns.push(col);
  }

  return { valid: true, safeColumns };
}

// ==========================================
// 3. GROUP BY & SORT DIMENSIONS
// ==========================================

export const SUPPORTED_GROUP_BY_DIMENSIONS: Record<string, { label: string; field: string }> = {
  client: { label: 'Client Company', field: 'clientName' },
  recruiter: { label: 'Recruiter Owner', field: 'ownerName' },
  status: { label: 'Lifecycle Status', field: 'status' },
  location: { label: 'Location', field: 'location' },
  stage: { label: 'Pipeline Stage', field: 'stageName' },
};

// ==========================================
// 4. CLIENT SCHEDULE CONFIG & ALLOW-LISTS
// ==========================================

export const CLIENT_REPORT_SECTIONS = [
  'JOB_PROGRESS',
  'SUBMITTED_PROFILES',
  'NEXT_STEPS',
] as const;

export type ClientReportSection = (typeof CLIENT_REPORT_SECTIONS)[number];

export const CLIENT_REPORT_FREQUENCIES = ['DAILY', 'WEEKLY', 'MONTHLY'] as const;
export type ClientReportFrequency = (typeof CLIENT_REPORT_FREQUENCIES)[number];

export const CLIENT_REPORT_PERIODS = ['LAST_7_DAYS', 'LAST_30_DAYS', 'MONTH_TO_DATE'] as const;
export type ClientReportPeriod = (typeof CLIENT_REPORT_PERIODS)[number];

// Client report candidate data allow-list (Strict Data Leak Prevention)
export interface ClientSafeJobProgress {
  jobCode: string;
  jobTitle: string;
  openings: number;
  status: string;
  totalSubmissions: number;
  activeInterviews: number;
  offersExtended: number;
}

export interface ClientSafeSubmissionProfile {
  candidateCode: string;
  candidateName: string;
  currentTitle: string;
  experienceYears: number;
  submittedAt: string;
  clientStatus: string;
}

export interface ClientSafeNextStep {
  candidateCode: string;
  candidateName: string;
  jobTitle: string;
  roundName: string;
  scheduledAt: string;
  actionRequired: string;
}

export interface ClientReportDataBundle {
  clientName: string;
  reportingPeriod: string;
  generatedAt: string;
  jobProgress: ClientSafeJobProgress[];
  submittedProfiles: ClientSafeSubmissionProfile[];
  nextSteps: ClientSafeNextStep[];
}

// ==========================================
// 5. ZOD SCHEMAS
// ==========================================

export const ReportQuerySchema = z.object({
  primaryEntity: z.enum([
    'CANDIDATES',
    'JOBS',
    'APPLICATIONS',
    'INTERVIEWS',
    'SUBMISSIONS',
    'CLIENTS',
    'PLACEMENTS',
  ]),
  linkedEntities: z.array(z.string()).default([]),
  selectedColumns: z.array(z.string()).min(1, 'Select at least one column'),
  groupBy: z.string().optional(),
  sortBy: z.string().optional(),
  sortDirection: z.enum(['asc', 'desc']).default('desc'),
  filters: z
    .object({
      period: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      clientId: z.string().optional(),
      recruiterId: z.string().optional(),
      stageId: z.string().optional(),
      status: z.string().optional(),
    })
    .optional(),
  limit: z.number().int().positive().max(10000).default(5),
  page: z.number().int().positive().default(1),
});

export type ReportQueryInput = z.input<typeof ReportQuerySchema>;
export type ReportQueryOutput = z.infer<typeof ReportQuerySchema>;

export const SaveReportViewSchema = z.object({
  name: z.string().min(2, 'Report name must be at least 2 characters').max(100),
  description: z.string().max(500).optional(),
  primaryEntity: z.enum([
    'CANDIDATES',
    'JOBS',
    'APPLICATIONS',
    'INTERVIEWS',
    'SUBMISSIONS',
    'CLIENTS',
    'PLACEMENTS',
  ]),
  linkedEntities: z.array(z.string()).default([]),
  selectedColumns: z.array(z.string()).min(1),
  groupBy: z.string().optional(),
  sortBy: z.string().optional(),
  sortDirection: z.enum(['asc', 'desc']).default('desc'),
  filters: z.record(z.any()).optional(),
  isShared: z.boolean().default(false),
  sharedWithUserIds: z.array(z.string()).default([]),
});

export type SaveReportViewInput = z.infer<typeof SaveReportViewSchema>;

export const CreateClientReportScheduleSchema = z.object({
  clientId: z.string().uuid('Valid client ID is required'),
  name: z.string().min(2, 'Schedule name required').max(100),
  frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']),
  deliveryDay: z.string().optional(),
  deliveryTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Delivery time must be HH:mm (24h)'),
  timezone: z.string().default('Asia/Kolkata'),
  period: z.enum(['LAST_7_DAYS', 'LAST_30_DAYS', 'MONTH_TO_DATE']).default('LAST_7_DAYS'),
  recipientIds: z.array(z.string().uuid()).min(1, 'Select at least one verified client contact'),
  includeSections: z.array(z.enum(['JOB_PROGRESS', 'SUBMITTED_PROFILES', 'NEXT_STEPS'])).min(1, 'Select at least one section'),
});

export type CreateClientReportScheduleInput = z.infer<typeof CreateClientReportScheduleSchema>;

export const UpdateClientReportScheduleSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']).optional(),
  deliveryDay: z.string().optional(),
  deliveryTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
  timezone: z.string().optional(),
  period: z.enum(['LAST_7_DAYS', 'LAST_30_DAYS', 'MONTH_TO_DATE']).optional(),
  recipientIds: z.array(z.string().uuid()).min(1).optional(),
  includeSections: z.array(z.enum(['JOB_PROGRESS', 'SUBMITTED_PROFILES', 'NEXT_STEPS'])).min(1).optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED']).optional(),
  changeNotes: z.string().max(250).optional(),
});

export type UpdateClientReportScheduleInput = z.infer<typeof UpdateClientReportScheduleSchema>;

// ==========================================
// 6. EXCEL / SPREADSHEETML EXPORT ENGINE
// ==========================================

/**
 * Escapes characters for XML string literals in SpreadsheetML.
 */
function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generates an official Microsoft SpreadsheetML XML document (compatible with Excel, LibreOffice, Google Sheets).
 * Includes styling, headers, and formula-injection defenses.
 */
export function generateSpreadsheetML(
  headers: { key: string; label: string }[],
  rows: Record<string, any>[],
  sheetName = 'HireFlow ATS Report'
): string {
  const safeSheetName = escapeXml(sheetName.substring(0, 31));

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Borders/>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#1B2236"/>
   <Interior/>
   <NumberFormat/>
   <Protection/>
  </Style>
  <Style ss:ID="HeaderStyle">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#5B49D6"/>
   </Borders>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#FFFFFF" ss:Bold="1"/>
   <Interior ss:Color="#5B49D6" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="DateStyle">
   <NumberFormat ss:Format="yyyy-mm-dd\\ hh:mm"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="${safeSheetName}">
  <Table ss:DefaultRowHeight="20">
`;

  // Define Columns
  headers.forEach(() => {
    xml += `   <Column ss:AutoFitWidth="1" ss:Width="120"/>\n`;
  });

  // Header Row
  xml += `   <Row ss:Height="24">\n`;
  headers.forEach((h) => {
    xml += `    <Cell ss:StyleID="HeaderStyle"><Data ss:Type="String">${escapeXml(h.label)}</Data></Cell>\n`;
  });
  xml += `   </Row>\n`;

  // Data Rows
  rows.forEach((row) => {
    xml += `   <Row ss:Height="20">\n`;
    headers.forEach((h) => {
      const rawVal = row[h.key];
      if (rawVal === null || rawVal === undefined) {
        xml += `    <Cell><Data ss:Type="String"></Data></Cell>\n`;
      } else if (typeof rawVal === 'number') {
        xml += `    <Cell><Data ss:Type="Number">${rawVal}</Data></Cell>\n`;
      } else if (rawVal instanceof Date) {
        xml += `    <Cell ss:StyleID="DateStyle"><Data ss:Type="String">${rawVal.toISOString().replace('T', ' ').substring(0, 19)}</Data></Cell>\n`;
      } else {
        // Prevent formula injection
        const clean = sanitizeForCsv(String(rawVal)).replace(/^"/, '').replace(/"$/, '');
        xml += `    <Cell><Data ss:Type="String">${escapeXml(clean)}</Data></Cell>\n`;
      }
    });
    xml += `   </Row>\n`;
  });

  xml += `  </Table>
 </Worksheet>
</Workbook>`;

  return xml;
}

/**
 * Universal export generator supporting both CSV and Excel XML formats.
 */
export function generateReportExport(
  format: 'CSV' | 'XLSX',
  headers: { key: string; label: string }[],
  rows: Record<string, any>[],
  reportTitle = 'HireFlow Custom Report'
): { content: string; mimeType: string; extension: string } {
  if (format === 'XLSX') {
    return {
      content: generateSpreadsheetML(headers, rows, reportTitle),
      mimeType: 'application/vnd.ms-excel',
      extension: 'xml', // Opens seamlessly in Microsoft Excel as a formatted workbook
    };
  }

  return {
    content: generateCsvString(headers, rows),
    mimeType: 'text/csv; charset=utf-8',
    extension: 'csv',
  };
}
