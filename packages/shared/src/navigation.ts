import { UserRole } from './roles';

export interface NavigationItem {
  id: string;
  label: string;
  path: string;
  icon: string;
  allowedRoles: UserRole[];
  exactMatch?: boolean;
  section?: 'WORKSPACE' | 'MANAGEMENT' | 'SYSTEM' | 'PORTAL';
  badge?: string | number;
  description?: string;
  children?: Array<{
    id: string;
    label: string;
    path: string;
    allowedRoles: UserRole[];
  }>;
}

// Internal Navigation Items (Recruiter, Manager, Admin)
export const INTERNAL_NAVIGATION_ITEMS: NavigationItem[] = [
  {
    id: 'dashboard',
    label: 'Overview',
    path: '/dashboard',
    icon: 'LayoutDashboard',
    allowedRoles: [UserRole.RECRUITER, UserRole.MANAGER, UserRole.ADMIN],
    exactMatch: true,
    section: 'WORKSPACE',
    description: 'Recruitment pipeline summary and daily activity',
  },
  {
    id: 'activity',
    label: 'Daily Activity',
    path: '/activity',
    icon: 'CheckSquare',
    allowedRoles: [UserRole.RECRUITER, UserRole.MANAGER, UserRole.ADMIN],
    section: 'WORKSPACE',
    description: 'Recruiter daily KPI tracking, calls, and performance targets',
  },
  {
    id: 'candidates',
    label: 'Candidates',
    path: '/candidates',
    icon: 'Users',
    allowedRoles: [UserRole.RECRUITER, UserRole.ADMIN],
    section: 'WORKSPACE',
    description: 'Candidate talent pool, sourcing, and resumes',
  },
  {
    id: 'jobs',
    label: 'Jobs',
    path: '/jobs',
    icon: 'Briefcase',
    allowedRoles: [UserRole.RECRUITER, UserRole.ADMIN],
    section: 'WORKSPACE',
    description: 'Active job openings, requirements, and hiring pipelines',
  },
  {
    id: 'interviews',
    label: 'Interviews',
    path: '/interviews',
    icon: 'Calendar',
    allowedRoles: [UserRole.RECRUITER, UserRole.ADMIN],
    section: 'WORKSPACE',
    description: 'Scheduled candidate interviews and calendar sync',
  },
  {
    id: 'communications',
    label: 'Communications',
    path: '/communications',
    icon: 'MessageSquare',
    allowedRoles: [UserRole.RECRUITER, UserRole.MANAGER, UserRole.ADMIN],
    section: 'WORKSPACE',
    description: 'Candidate inbox, WhatsApp messaging, and templates',
  },
  {
    id: 'submissions',
    label: 'Submissions',
    path: '/submissions',
    icon: 'Send',
    allowedRoles: [UserRole.RECRUITER, UserRole.ADMIN],
    section: 'WORKSPACE',
    description: 'Client submissions, feedback, and shortlists',
  },
  {
    id: 'offers',
    label: 'Offers & Placements',
    path: '/offers',
    icon: 'Award',
    allowedRoles: [UserRole.RECRUITER, UserRole.ADMIN],
    section: 'WORKSPACE',
    description: 'Pending offers, accepted contracts, and billings',
  },
  {
    id: 'clients',
    label: 'Clients CRM',
    path: '/clients',
    icon: 'Building2',
    allowedRoles: [UserRole.RECRUITER, UserRole.ADMIN],
    section: 'WORKSPACE',
    description: 'Client companies, contacts, and account management',
  },
  {
    id: 'sales',
    label: 'Sales CRM',
    path: '/sales',
    icon: 'TrendingUp',
    allowedRoles: [UserRole.RECRUITER, UserRole.MANAGER, UserRole.ADMIN],
    section: 'WORKSPACE',
    description: 'Prospective clients, sales opportunities, and client meetings',
  },
  {
    id: 'reports',
    label: 'Reports',
    path: '/reports',
    icon: 'BarChart3',
    allowedRoles: [UserRole.RECRUITER, UserRole.ADMIN],
    section: 'WORKSPACE',
    description: 'Agency analytics, recruiter metrics, and placement rates',
  },
  // Manager & Admin specific sections
  {
    id: 'manager',
    label: 'Manager Overview',
    path: '/manager',
    icon: 'LayoutDashboard',
    allowedRoles: [UserRole.MANAGER, UserRole.ADMIN],
    section: 'MANAGEMENT',
    description: 'Manager overview dashboard, pending approvals queue, and team performance',
  },
  {
    id: 'approvals',
    label: 'Approvals',
    path: '/approvals',
    icon: 'CheckSquare',
    allowedRoles: [UserRole.MANAGER, UserRole.ADMIN],
    section: 'MANAGEMENT',
    description: 'Pending job openings, salary offers, and submission sign-offs',
  },
  {
    id: 'assignments',
    label: 'Assignments',
    path: '/assignments',
    icon: 'UserCheck',
    allowedRoles: [UserRole.MANAGER, UserRole.ADMIN],
    section: 'MANAGEMENT',
    description: 'Job distribution, recruiter allocations, and workloads',
  },
  {
    id: 'pipelines',
    label: 'Pipelines',
    path: '/pipelines',
    icon: 'GitPullRequest',
    allowedRoles: [UserRole.MANAGER, UserRole.ADMIN],
    section: 'MANAGEMENT',
    description: 'Cross-agency pipeline stages, conversion rates, and bottlenecks',
  },
  {
    id: 'performance',
    label: 'Performance',
    path: '/performance',
    icon: 'TrendingUp',
    allowedRoles: [UserRole.MANAGER, UserRole.ADMIN],
    section: 'MANAGEMENT',
    description: 'Recruiter KPIs, submission velocity, and placement targets',
  },
  {
    id: 'admin',
    label: 'Admin & Settings',
    path: '/admin',
    icon: 'Settings',
    allowedRoles: [UserRole.MANAGER, UserRole.ADMIN],
    section: 'SYSTEM',
    description: 'System configurations, permissions, team setup, and audit logs',
  },
  {
    id: 'integrations',
    label: 'Integrations',
    path: '/integrations',
    icon: 'Shield',
    allowedRoles: [UserRole.MANAGER, UserRole.ADMIN, UserRole.RECRUITER],
    section: 'SYSTEM',
    description: 'Gmail, Outlook, WhatsApp, and SMS provider integrations',
  },
];

// Client Portal Navigation Items
export const CLIENT_NAVIGATION_ITEMS: NavigationItem[] = [
  {
    id: 'client-overview',
    label: 'Overview',
    path: '/portal',
    icon: 'LayoutDashboard',
    allowedRoles: [UserRole.CLIENT, UserRole.ADMIN],
    exactMatch: true,
    section: 'PORTAL',
    description: 'Active engagements, hiring velocity, and summary metrics',
  },
  {
    id: 'client-positions',
    label: 'Open Positions',
    path: '/positions',
    icon: 'Briefcase',
    allowedRoles: [UserRole.CLIENT, UserRole.ADMIN],
    section: 'PORTAL',
    description: 'Your open job mandates and active hiring pipelines',
  },
  {
    id: 'client-submissions',
    label: 'Submitted Profiles',
    path: '/submitted-profiles',
    icon: 'Users',
    allowedRoles: [UserRole.CLIENT, UserRole.ADMIN],
    section: 'PORTAL',
    description: 'Candidates presented by HireFlow for your review and feedback',
  },
  {
    id: 'client-interviews',
    label: 'Interviews',
    path: '/portal/interviews',
    icon: 'Calendar',
    allowedRoles: [UserRole.CLIENT, UserRole.ADMIN],
    section: 'PORTAL',
    description: 'Upcoming client interview rounds and feedback submissions',
  },
  {
    id: 'client-reports',
    label: 'Progress Reports',
    path: '/portal/reports',
    icon: 'LineChart',
    allowedRoles: [UserRole.CLIENT, UserRole.ADMIN],
    section: 'PORTAL',
    description: 'Hiring funnel analytics, time-to-hire, and submission ratios',
  },
];

// Candidate Portal Navigation Items
export const CANDIDATE_NAVIGATION_ITEMS: NavigationItem[] = [
  {
    id: 'candidate-dashboard',
    label: 'My Dashboard',
    path: '/my-dashboard',
    icon: 'LayoutDashboard',
    allowedRoles: [UserRole.CANDIDATE, UserRole.ADMIN],
    exactMatch: true,
    section: 'PORTAL',
    description: 'Application statuses, next steps, and recruiter messages',
  },
  {
    id: 'candidate-applications',
    label: 'My Applications',
    path: '/applications',
    icon: 'Briefcase',
    allowedRoles: [UserRole.CANDIDATE, UserRole.ADMIN],
    section: 'PORTAL',
    description: 'All jobs you have applied to or been shortlisted for',
  },
  {
    id: 'candidate-interviews',
    label: 'Interviews',
    path: '/my-interviews',
    icon: 'Calendar',
    allowedRoles: [UserRole.CANDIDATE, UserRole.ADMIN],
    section: 'PORTAL',
    description: 'Upcoming interview rounds, video links, and slot scheduling',
  },
  {
    id: 'candidate-profile',
    label: 'My Profile',
    path: '/profile',
    icon: 'User',
    allowedRoles: [UserRole.CANDIDATE, UserRole.ADMIN],
    section: 'PORTAL',
    description: 'Your resume, skills, contact info, and preferences',
  },
];

/**
 * Filter navigation items accessible to a given role
 */
export function getNavigationForRole(role: UserRole): NavigationItem[] {
  switch (role) {
    case UserRole.RECRUITER:
    case UserRole.MANAGER:
    case UserRole.ADMIN:
      return INTERNAL_NAVIGATION_ITEMS.filter((item) =>
        item.allowedRoles.includes(role)
      );
    case UserRole.CLIENT:
      return CLIENT_NAVIGATION_ITEMS.filter((item) =>
        item.allowedRoles.includes(role)
      );
    case UserRole.CANDIDATE:
      return CANDIDATE_NAVIGATION_ITEMS.filter((item) =>
        item.allowedRoles.includes(role)
      );
    default:
      return [];
  }
}

/**
 * Get default home route for a role
 */
export function getDefaultRouteForRole(role: UserRole): string {
  switch (role) {
    case UserRole.RECRUITER:
    case UserRole.MANAGER:
    case UserRole.ADMIN:
      return '/dashboard';
    case UserRole.CLIENT:
      return '/portal';
    case UserRole.CANDIDATE:
      return '/my-dashboard';
    default:
      return '/';
  }
}

/**
 * All protected routes registry with allowed roles
 */
export const ROUTE_PERMISSIONS: Record<string, UserRole[]> = {
  '/dashboard': [UserRole.RECRUITER, UserRole.MANAGER, UserRole.ADMIN],
  '/candidates': [UserRole.RECRUITER, UserRole.ADMIN],
  '/jobs': [UserRole.RECRUITER, UserRole.ADMIN],
  '/interviews': [UserRole.RECRUITER, UserRole.ADMIN],
  '/submissions': [UserRole.RECRUITER, UserRole.ADMIN],
  '/offers': [UserRole.RECRUITER, UserRole.ADMIN],
  '/clients': [UserRole.RECRUITER, UserRole.ADMIN],
  '/reports': [UserRole.RECRUITER, UserRole.ADMIN],
  '/manager': [UserRole.MANAGER, UserRole.ADMIN],
  '/approvals': [UserRole.MANAGER, UserRole.ADMIN],
  '/assignments': [UserRole.MANAGER, UserRole.ADMIN],
  '/pipelines': [UserRole.MANAGER, UserRole.ADMIN],
  '/performance': [UserRole.MANAGER, UserRole.ADMIN],
  '/admin': [UserRole.MANAGER, UserRole.ADMIN],
  '/portal': [UserRole.CLIENT, UserRole.ADMIN],
  '/positions': [UserRole.CLIENT, UserRole.ADMIN],
  '/submitted-profiles': [UserRole.CLIENT, UserRole.ADMIN],
  '/portal/interviews': [UserRole.CLIENT, UserRole.ADMIN],
  '/portal/reports': [UserRole.CLIENT, UserRole.ADMIN],
  '/my-dashboard': [UserRole.CANDIDATE, UserRole.ADMIN],
  '/applications': [UserRole.CANDIDATE, UserRole.ADMIN],
  '/my-interviews': [UserRole.CANDIDATE, UserRole.ADMIN],
  '/profile': [UserRole.CANDIDATE, UserRole.ADMIN],
};

/**
 * Check if a role can access a target path
 */
export function canAccessRoute(role: UserRole, targetPath: string): boolean {
  // Normalize path by stripping trailing slashes and query params
  const cleanPath = targetPath.split('?')[0].replace(/\/+$/, '') || '/';

  // Public / development showcase routes are open
  if (cleanPath === '/' || cleanPath === '/design' || cleanPath === '/no-permission') {
    return true;
  }

  // Exact match in route permissions
  if (ROUTE_PERMISSIONS[cleanPath]) {
    return ROUTE_PERMISSIONS[cleanPath].includes(role);
  }

  // Sub-path prefix match (e.g. /candidates/123 -> matches /candidates)
  for (const [routePattern, allowedRoles] of Object.entries(ROUTE_PERMISSIONS)) {
    if (cleanPath.startsWith(routePattern + '/')) {
      return allowedRoles.includes(role);
    }
  }

  // Unknown route
  return false;
}
