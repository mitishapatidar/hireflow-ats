'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  UserPlus,
  Building,
  Check,
  AlertCircle,
  AlertTriangle,
  RotateCcw,
  Trash2,
  Edit2,
  UserCheck,
  UserX,
  X,
  ShieldAlert,
} from 'lucide-react';
import {
  UserRole,
  wouldCreateReportingCycleSync,
} from '@hireflow/shared';
import {
  getAdminTeamDataAction,
  inviteTeamMemberAction,
  updateReportingLineAction,
  updateTeamAssignmentAction,
  toggleUserStatusAction,
  inviteClientUserAction,
  resendInvitationAction,
  revokeInvitationAction,
  updatePermissionGrantAction,
} from '@/actions/admin';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: string;
  manager: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
  } | null;
  team: {
    id: string;
    name: string;
  } | null;
}

interface TeamData {
  members: TeamMember[];
  teams: Array<{ id: string; name: string }>;
  eligibleManagers: Array<{ id: string; name: string; email: string; role: UserRole }>;
  clients: Array<{ id: string; name: string; domain: string | null }>;
  jobs: Array<{ id: string; title: string; clientId: string; clientName: string }>;
  clientAccesses: Array<{
    id: string;
    userId: string;
    userName: string;
    userEmail: string;
    clientId: string;
    clientName: string;
    authorizedJobIds: string[];
    downloadLimit: number;
    status: string;
    updatedAt: string;
  }>;
  invitations: Array<{
    id: string;
    email: string;
    role: UserRole;
    status: string;
    expiresAt: string;
    createdAt: string;
    invitedByName: string;
    teamName: string | null;
  }>;
  permissionGrants: Record<string, boolean>;
  currentUserRole: UserRole;
  currentUserId: string;
}

export default function TeamAndPermissionsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const tabParam = searchParams.get('tab') || 'team';
  const [activeTab, setActiveTab] = useState<'team' | 'permissions' | 'client' | 'invitations'>(
    tabParam === 'permissions'
      ? 'permissions'
      : tabParam === 'client'
      ? 'client'
      : tabParam === 'invitations'
      ? 'invitations'
      : 'team'
  );

  const [data, setData] = useState<TeamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modals state
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isReportingModalOpen, setIsReportingModalOpen] = useState(false);
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);

  // Form states
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'RECRUITER' | 'MANAGER' | 'ADMIN'>('RECRUITER');
  const [inviteTeamId, setInviteTeamId] = useState('');
  const [inviteManagerId, setInviteManagerId] = useState('');

  // Reporting Form state
  const [newManagerId, setNewManagerId] = useState('');

  // Team Form state
  const [newTeamId, setNewTeamId] = useState('');

  // Quick Client Invite Form state
  const [clientInviteName, setClientInviteName] = useState('');
  const [clientInviteEmail, setClientInviteEmail] = useState('');
  const [clientInviteClientId, setClientInviteClientId] = useState('');
  const [clientInviteJobIds, setClientInviteJobIds] = useState<string[]>([]);
  const [clientInviteDownloadLimit, setClientInviteDownloadLimit] = useState(10);

  const loadData = async () => {
    try {
      const res = await getAdminTeamDataAction();
      if (res.success && res.data) {
        setData(res.data);
      } else {
        setActionFeedback({ type: 'error', message: res.error || 'Failed to load team data.' });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error connecting to database.';
      setActionFeedback({ type: 'error', message: msg });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleTabChange = (newTab: 'team' | 'permissions' | 'client' | 'invitations') => {
    setActiveTab(newTab);
    router.replace(`/admin/team?tab=${newTab}`, { scroll: false });
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case UserRole.ADMIN:
        return 'bg-[#EEEBFB] text-[#5B49D6] border-[#5B49D6]/30';
      case UserRole.MANAGER:
        return 'bg-[#E5F0FF] text-[#3B82F6] border-[#3B82F6]/30';
      case UserRole.RECRUITER:
        return 'bg-[#E3F6EC] text-[#12B76A] border-[#12B76A]/30';
      case UserRole.CLIENT:
        return 'bg-[#FEF3DC] text-[#F59E0B] border-[#F59E0B]/30';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  // Helper for reporting cycle check
  const checkCycle = (proposedManagerId: string) => {
    if (!selectedMember || !data) return false;
    const getManagerOf = (id: string): string | null => {
      const m = data.members.find((u) => u.id === id);
      return m?.manager?.id || null;
    };
    return wouldCreateReportingCycleSync(selectedMember.id, proposedManagerId, getManagerOf);
  };

  // Action handlers
  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setActionFeedback(null);
    startTransition(async () => {
      const res = await inviteTeamMemberAction({
        name: inviteName,
        email: inviteEmail,
        role: inviteRole,
        teamId: inviteTeamId || undefined,
        managerId: inviteManagerId || undefined,
      });

      if (res.success) {
        setActionFeedback({ type: 'success', message: res.message || 'Invitation sent.' });
        setIsInviteModalOpen(false);
        setInviteName('');
        setInviteEmail('');
        loadData();
      } else {
        setActionFeedback({ type: 'error', message: res.error || 'Failed to send invite.' });
      }
    });
  };

  const handleReportingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember) return;
    setActionFeedback(null);
    startTransition(async () => {
      const res = await updateReportingLineAction({
        userId: selectedMember.id,
        managerId: newManagerId || null,
      });

      if (res.success) {
        setActionFeedback({ type: 'success', message: res.message || 'Reporting line updated.' });
        setIsReportingModalOpen(false);
        loadData();
      } else {
        setActionFeedback({ type: 'error', message: res.error || 'Update failed.' });
      }
    });
  };

  const handleTeamSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember) return;
    setActionFeedback(null);
    startTransition(async () => {
      const res = await updateTeamAssignmentAction({
        userId: selectedMember.id,
        teamId: newTeamId || null,
      });

      if (res.success) {
        setActionFeedback({ type: 'success', message: res.message || 'Team assignment updated.' });
        setIsTeamModalOpen(false);
        loadData();
      } else {
        setActionFeedback({ type: 'error', message: res.error || 'Update failed.' });
      }
    });
  };

  const handleToggleStatus = () => {
    if (!selectedMember) return;
    const targetStatus = selectedMember.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
    setActionFeedback(null);
    startTransition(async () => {
      const res = await toggleUserStatusAction({
        userId: selectedMember.id,
        status: targetStatus,
      });

      if (res.success) {
        setActionFeedback({ type: 'success', message: res.message || 'Status updated.' });
        setIsStatusModalOpen(false);
        loadData();
      } else {
        setActionFeedback({ type: 'error', message: res.error || 'Status change failed.' });
      }
    });
  };

  const handleQuickClientInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientInviteClientId) {
      setActionFeedback({ type: 'error', message: 'Please select an authorized client.' });
      return;
    }
    setActionFeedback(null);
    startTransition(async () => {
      const res = await inviteClientUserAction({
        name: clientInviteName,
        email: clientInviteEmail,
        clientId: clientInviteClientId,
        authorizedJobIds: clientInviteJobIds,
        downloadLimit: clientInviteDownloadLimit,
      });

      if (res.success) {
        setActionFeedback({ type: 'success', message: res.message || 'Client user invited.' });
        setClientInviteName('');
        setClientInviteEmail('');
        setClientInviteJobIds([]);
        loadData();
      } else {
        setActionFeedback({ type: 'error', message: res.error || 'Client invite failed.' });
      }
    });
  };

  const handleToggleGrant = (
    grantKey: 'recruiterViewInternalFees' | 'adminApproveJob' | 'managerExportReports',
    currentValue: boolean
  ) => {
    setActionFeedback(null);
    startTransition(async () => {
      const res = await updatePermissionGrantAction({
        grantKey,
        enabled: !currentValue,
      });
      if (res.success) {
        setActionFeedback({ type: 'success', message: res.message || 'Grant updated.' });
        loadData();
      } else {
        setActionFeedback({ type: 'error', message: res.error || 'Failed to update grant.' });
      }
    });
  };

  const handleResendInvite = (invitationId: string) => {
    setActionFeedback(null);
    startTransition(async () => {
      const res = await resendInvitationAction({ invitationId });
      if (res.success) {
        setActionFeedback({ type: 'success', message: res.message || 'Invitation refreshed.' });
        loadData();
      } else {
        setActionFeedback({ type: 'error', message: res.error || 'Resend failed.' });
      }
    });
  };

  const handleRevokeInvite = (invitationId: string) => {
    setActionFeedback(null);
    startTransition(async () => {
      const res = await revokeInvitationAction({ invitationId });
      if (res.success) {
        setActionFeedback({ type: 'success', message: res.message || 'Invitation revoked.' });
        loadData();
      } else {
        setActionFeedback({ type: 'error', message: res.error || 'Revocation failed.' });
      }
    });
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-xs text-[#6B7490] flex flex-col items-center gap-3">
        <div className="w-6 h-6 border-2 border-[#5B49D6] border-t-transparent rounded-full animate-spin" />
        <span>Loading team structure, reporting lines & role permissions...</span>
      </div>
    );
  }

  const members = data?.members || [];
  const teams = data?.teams || [];
  const eligibleManagers = data?.eligibleManagers || [];
  const clients = data?.clients || [];
  const jobs = data?.jobs || [];
  const clientAccesses = data?.clientAccesses || [];
  const invitations = data?.invitations || [];
  const permissionGrants = data?.permissionGrants || {};

  return (
    <div className="space-y-6">
      {/* Top Banner / Breadcrumb Matching Figma Frame 30 */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[11px] font-bold text-[#5B49D6] tracking-wider uppercase">
            PHASE 1 + 2 · ACCESS / 30
          </span>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#1B2236] tracking-tight">
              Team, reporting & permissions
            </h1>
            <p className="text-xs text-[#6B7490] mt-0.5">
              Manage reporting lines, role permissions and explicit client access.
            </p>
          </div>

          <button
            onClick={() => {
              setInviteRole('RECRUITER');
              setIsInviteModalOpen(true);
            }}
            className="px-4 py-2 bg-[#5B49D6] hover:bg-[#5B49D6]/90 text-white rounded-lg text-xs font-semibold transition-all shadow-sm flex items-center gap-2 cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>+ Invite member</span>
          </button>
        </div>
      </div>

      {/* Tabs Bar Matching Figma Frame 30 */}
      <div className="border-b border-[#E6E8F0] flex gap-6 text-xs font-semibold">
        <button
          onClick={() => handleTabChange('team')}
          className={`pb-3 transition-colors relative ${
            activeTab === 'team'
              ? 'text-[#5B49D6] border-b-2 border-[#5B49D6]'
              : 'text-[#6B7490] hover:text-[#1B2236]'
          }`}
        >
          Team & reporting
        </button>
        <button
          onClick={() => handleTabChange('permissions')}
          className={`pb-3 transition-colors relative ${
            activeTab === 'permissions'
              ? 'text-[#5B49D6] border-b-2 border-[#5B49D6]'
              : 'text-[#6B7490] hover:text-[#1B2236]'
          }`}
        >
          Role permissions
        </button>
        <button
          onClick={() => handleTabChange('client')}
          className={`pb-3 transition-colors relative ${
            activeTab === 'client'
              ? 'text-[#5B49D6] border-b-2 border-[#5B49D6]'
              : 'text-[#6B7490] hover:text-[#1B2236]'
          }`}
        >
          Client access
        </button>
        <button
          onClick={() => handleTabChange('invitations')}
          className={`pb-3 transition-colors relative ${
            activeTab === 'invitations'
              ? 'text-[#5B49D6] border-b-2 border-[#5B49D6]'
              : 'text-[#6B7490] hover:text-[#1B2236]'
          }`}
        >
          Invitations
          {invitations.filter((i) => i.status === 'PENDING').length > 0 && (
            <span className="ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] bg-[#EEEBFB] text-[#5B49D6]">
              {invitations.filter((i) => i.status === 'PENDING').length}
            </span>
          )}
        </button>
      </div>

      {/* Action Feedback Alert */}
      {actionFeedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between ${
            actionFeedback.type === 'success'
              ? 'bg-[#E3F6EC] text-[#12B76A] border-[#12B76A]/30'
              : 'bg-[#FDECEC] text-[#E5484D] border-[#E5484D]/30'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionFeedback.type === 'success' ? (
              <Check className="w-4 h-4" />
            ) : (
              <AlertCircle className="w-4 h-4" />
            )}
            <span>{actionFeedback.message}</span>
          </div>
          <button
            onClick={() => setActionFeedback(null)}
            className="text-current hover:opacity-75"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 1: TEAM & REPORTING (Matching Figma Frame 30)        */}
      {/* ======================================================== */}
      {activeTab === 'team' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Main Column (2 spans): Team Roster Table + Permission Matrix */}
          <div className="lg:col-span-2 space-y-6">
            {/* Card 1: Recruitment team · reporting lines Table */}
            <div className="bg-white rounded-xl border border-[#E6E8F0] shadow-xs overflow-hidden">
              <div className="p-4 border-b border-[#E6E8F0] flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-[#1B2236]">
                    Recruitment team · reporting lines
                  </h2>
                  <p className="text-[11px] text-[#6B7490]">
                    Direct hierarchical manager links. A user can only report to an Admin or Manager.
                  </p>
                </div>
                <span className="text-xs text-[#6B7490]">
                  {members.length} members
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-[#F6F7FB] text-[#6B7490] font-semibold uppercase text-[10px] tracking-wider border-b border-[#E6E8F0]">
                      <th className="py-3 px-4">Member</th>
                      <th className="py-3 px-3">Role</th>
                      <th className="py-3 px-3">Reports to</th>
                      <th className="py-3 px-3">Access / Team</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E6E8F0]">
                    {members.map((member) => {
                      const isClient = member.role === UserRole.CLIENT;
                      return (
                        <tr
                          key={member.id}
                          className={`hover:bg-[#F6F7FB]/50 transition-colors ${
                            member.status !== 'ACTIVE' ? 'opacity-50' : ''
                          }`}
                        >
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-[#1E2A4A] text-white flex items-center justify-center font-bold text-[11px] shrink-0">
                                {getInitials(member.name)}
                              </div>
                              <div>
                                <div className="font-semibold text-[#1B2236] flex items-center gap-1.5">
                                  <span>{member.name}</span>
                                  {member.status !== 'ACTIVE' && (
                                    <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-[#FDECEC] text-[#E5484D]">
                                      DISABLED
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-[#6B7490]">{member.email}</div>
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-3">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold border ${getRoleBadge(
                                member.role
                              )}`}
                            >
                              {member.role}
                            </span>
                          </td>

                          <td className="py-3 px-3">
                            {member.manager ? (
                              <div className="text-[#1B2236] font-medium flex items-center gap-1">
                                <span>{member.manager.name}</span>
                                <span className="text-[10px] text-[#6B7490]">
                                  · {member.manager.role}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[#6B7490] italic">
                                {member.role === UserRole.ADMIN ? 'Top Level' : 'Unassigned'}
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-3">
                            {isClient ? (
                              <span className="text-[#F59E0B] font-medium">Acme only</span>
                            ) : member.team ? (
                              <span className="text-[#1B2236] font-medium">
                                {member.team.name}
                              </span>
                            ) : (
                              <span className="text-[#6B7490]">Assigned jobs</span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {!isClient && (
                                <>
                                  <button
                                    onClick={() => {
                                      setSelectedMember(member);
                                      setNewManagerId(member.manager?.id || '');
                                      setIsReportingModalOpen(true);
                                    }}
                                    className="p-1 rounded-md text-[#6B7490] hover:text-[#5B49D6] hover:bg-[#EEEBFB] transition-colors"
                                    title="Change Reporting Line"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>

                                  <button
                                    onClick={() => {
                                      setSelectedMember(member);
                                      setNewTeamId(member.team?.id || '');
                                      setIsTeamModalOpen(true);
                                    }}
                                    className="p-1 rounded-md text-[#6B7490] hover:text-[#5B49D6] hover:bg-[#EEEBFB] transition-colors"
                                    title="Assign Team"
                                  >
                                    <Building className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}

                              <button
                                onClick={() => {
                                  setSelectedMember(member);
                                  setIsStatusModalOpen(true);
                                }}
                                className={`p-1 rounded-md transition-colors ${
                                  member.status === 'ACTIVE'
                                    ? 'text-[#6B7490] hover:text-[#E5484D] hover:bg-[#FDECEC]'
                                    : 'text-[#12B76A] hover:bg-[#E3F6EC]'
                                }`}
                                title={member.status === 'ACTIVE' ? 'Deactivate User' : 'Reactivate User'}
                              >
                                {member.status === 'ACTIVE' ? (
                                  <UserX className="w-3.5 h-3.5" />
                                ) : (
                                  <UserCheck className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Card 2: Role permission matrix Matching Figma Frame 30 */}
            <div className="bg-white rounded-xl border border-[#E6E8F0] shadow-xs p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-bold text-[#1B2236]">Role permission matrix</h3>
                  <p className="text-[11px] text-[#6B7490]">
                    Scope is enforced per-record, not just by hiding navigation.
                  </p>
                </div>
                <span className="text-[11px] font-medium text-[#5B49D6] bg-[#EEEBFB] px-2 py-0.5 rounded">
                  Server-side Enforced
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#E6E8F0] text-[#6B7490] font-semibold text-[10px] uppercase">
                      <th className="py-2.5">Capability</th>
                      <th className="py-2.5">Recruiter</th>
                      <th className="py-2.5">Manager</th>
                      <th className="py-2.5">Admin</th>
                      <th className="py-2.5">Client</th>
                      <th className="py-2.5">Candidate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E6E8F0] text-[11px]">
                    <tr>
                      <td className="py-2.5 font-medium text-[#1B2236]">Candidate records</td>
                      <td className="py-2.5 text-[#6B7490]">Assigned</td>
                      <td className="py-2.5 text-[#6B7490]">Team</td>
                      <td className="py-2.5 text-[#5B49D6] font-semibold">Policy scope</td>
                      <td className="py-2.5 text-[#6B7490]">Shared only</td>
                      <td className="py-2.5 text-[#6B7490]">Own only</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 font-medium text-[#1B2236]">Job assignment</td>
                      <td className="py-2.5 text-[#6B7490]">Request</td>
                      <td className="py-2.5 text-[#6B7490]">Manage</td>
                      <td className="py-2.5 text-[#5B49D6] font-semibold">Configure</td>
                      <td className="py-2.5 text-[#E5484D]">No</td>
                      <td className="py-2.5 text-[#E5484D]">No</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 font-medium text-[#1B2236]">Approve job / send</td>
                      <td className="py-2.5 text-[#E5484D]">No</td>
                      <td className="py-2.5 text-[#12B76A] font-semibold">Yes</td>
                      <td className="py-2.5 text-[#5B49D6] font-semibold">By grant</td>
                      <td className="py-2.5 text-[#E5484D]">No</td>
                      <td className="py-2.5 text-[#E5484D]">No</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 font-medium text-[#1B2236]">Internal fees & margins</td>
                      <td className="py-2.5">
                        <button
                          onClick={() =>
                            handleToggleGrant(
                              'recruiterViewInternalFees',
                              !!permissionGrants.recruiterViewInternalFees
                            )
                          }
                          className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                            permissionGrants.recruiterViewInternalFees
                              ? 'bg-[#E3F6EC] text-[#12B76A] hover:bg-[#12B76A] hover:text-white'
                              : 'bg-[#F6F7FB] text-[#6B7490] hover:bg-[#EEEBFB] hover:text-[#5B49D6]'
                          }`}
                          title="Click to toggle Recruiter Internal Fee grant"
                        >
                          {permissionGrants.recruiterViewInternalFees ? 'Granted (Yes)' : 'By grant (No)'}
                        </button>
                      </td>
                      <td className="py-2.5 text-[#6B7490]">Team</td>
                      <td className="py-2.5 text-[#12B76A] font-semibold">Yes</td>
                      <td className="py-2.5 text-[#E5484D]">No (Zero leak)</td>
                      <td className="py-2.5 text-[#E5484D]">No</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 font-medium text-[#1B2236]">Team / security</td>
                      <td className="py-2.5 text-[#E5484D]">No</td>
                      <td className="py-2.5 text-[#E5484D]">No</td>
                      <td className="py-2.5 text-[#12B76A] font-semibold">Yes</td>
                      <td className="py-2.5 text-[#E5484D]">No</td>
                      <td className="py-2.5 text-[#E5484D]">No</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 font-medium text-[#1B2236]">Portal feedback</td>
                      <td className="py-2.5 text-[#E5484D]">No</td>
                      <td className="py-2.5 text-[#6B7490]">Review</td>
                      <td className="py-2.5 text-[#5B49D6] font-semibold">Configure</td>
                      <td className="py-2.5 text-[#12B76A] font-semibold">Own client</td>
                      <td className="py-2.5 text-[#E5484D]">No</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 font-medium text-[#1B2236]">Book interview</td>
                      <td className="py-2.5 text-[#6B7490]">Coordinate</td>
                      <td className="py-2.5 text-[#6B7490]">Review</td>
                      <td className="py-2.5 text-[#5B49D6] font-semibold">Configure</td>
                      <td className="py-2.5 text-[#6B7490]">Own jobs</td>
                      <td className="py-2.5 text-[#6B7490]">Own slots</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right Rail (1 span): Quick Client Invite + Active Client Access Cards */}
          <div className="space-y-6">
            {/* Card 1: Invite client user matching Figma Frame 30 */}
            <div className="bg-white rounded-xl border border-[#E6E8F0] shadow-xs p-5">
              <h3 className="text-sm font-bold text-[#1B2236]">Invite client user</h3>
              <p className="text-[11px] text-[#6B7490] mt-0.5">
                Provision a client reviewer for client portal review.
              </p>

              <form onSubmit={handleQuickClientInvite} className="mt-4 space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-[#1B2236] mb-1">Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Tara Desai"
                    value={clientInviteName}
                    onChange={(e) => setClientInviteName(e.target.value)}
                    className="w-full px-3 py-2 border border-[#E6E8F0] rounded-lg text-xs outline-none focus:border-[#5B49D6]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#1B2236] mb-1">Role</label>
                  <div className="px-3 py-2 rounded-lg bg-[#F6F7FB] border border-[#E6E8F0] text-[11px] text-[#6B7490] font-medium">
                    Client · fixed portal scope
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-[#1B2236] mb-1">Email</label>
                  <input
                    type="email"
                    required
                    placeholder="tara@acme.example"
                    value={clientInviteEmail}
                    onChange={(e) => setClientInviteEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-[#E6E8F0] rounded-lg text-xs outline-none focus:border-[#5B49D6]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#1B2236] mb-1">
                    Authorized client
                  </label>
                  <select
                    value={clientInviteClientId}
                    onChange={(e) => setClientInviteClientId(e.target.value)}
                    className="w-full px-3 py-2 border border-[#E6E8F0] rounded-lg text-xs outline-none focus:border-[#5B49D6]"
                  >
                    <option value="">Select Client Account...</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[#1B2236] mb-1">
                    Authorized jobs
                  </label>
                  <div className="max-h-28 overflow-y-auto border border-[#E6E8F0] rounded-lg p-2 space-y-1.5 bg-[#F6F7FB]">
                    {jobs.length === 0 ? (
                      <span className="text-[11px] text-[#6B7490]">No active jobs found</span>
                    ) : (
                      jobs.map((j) => (
                        <label key={j.id} className="flex items-center gap-2 cursor-pointer text-[11px]">
                          <input
                            type="checkbox"
                            checked={clientInviteJobIds.includes(j.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setClientInviteJobIds([...clientInviteJobIds, j.id]);
                              } else {
                                setClientInviteJobIds(clientInviteJobIds.filter((id) => id !== j.id));
                              }
                            }}
                            className="rounded border-[#E6E8F0] text-[#5B49D6] focus:ring-0"
                          />
                          <span className="truncate">{j.title}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-[#1B2236] mb-1">
                    Daily Watermarked CV Limit
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={clientInviteDownloadLimit}
                    onChange={(e) => setClientInviteDownloadLimit(Number(e.target.value) || 10)}
                    className="w-full px-3 py-2 border border-[#E6E8F0] rounded-lg text-xs outline-none focus:border-[#5B49D6]"
                  />
                </div>

                {/* Disclaimer Note */}
                <div className="p-3 rounded-lg bg-[#EEEBFB]/50 border border-[#5B49D6]/20 text-[10px] text-[#5B49D6] leading-relaxed">
                  <span className="font-bold">Least-privilege boundary:</span> client users cannot grant access, switch to another client or view internal records. Additional jobs require admin approval.
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setClientInviteName('');
                      setClientInviteEmail('');
                      setClientInviteJobIds([]);
                    }}
                    className="px-3 py-1.5 rounded-lg border border-[#E6E8F0] text-[#6B7490] hover:bg-[#F6F7FB]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="px-3.5 py-1.5 bg-[#5B49D6] text-white rounded-lg font-semibold hover:bg-[#5B49D6]/90 transition-all shadow-xs cursor-pointer"
                  >
                    {isPending ? 'Sending...' : 'Review invitation'}
                  </button>
                </div>
              </form>
            </div>

            {/* Card 2: Active access card matching Figma Frame 30 */}
            <div className="bg-white rounded-xl border border-[#E6E8F0] shadow-xs p-5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#1B2236]">Active access · Priya Gupta</h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#E5F0FF] text-[#3B82F6]">
                  Acme scoped
                </span>
              </div>

              <div className="mt-4 space-y-2.5 text-xs text-[#1B2236]">
                <div>
                  <span className="text-[#6B7490] block text-[11px]">Submitted profiles:</span>
                  <span className="font-medium">Aarav Shah, Arjun Mehta, Dev Malhotra.</span>
                </div>
                <div>
                  <span className="text-[#6B7490] block text-[11px]">Progress:</span>
                  <span className="font-medium">authorized Acme jobs only.</span>
                </div>
                <div>
                  <span className="text-[#6B7490] block text-[11px]">Downloads:</span>
                  <span className="font-medium">watermarked CV · 10 per day.</span>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-[#E6E8F0] text-[10px] text-[#6B7490]">
                Active member · Last reviewed by Anika Rao · 5 Nov, 09:00 IST
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: ROLE PERMISSIONS (Full Matrix View)               */}
      {/* ======================================================== */}
      {activeTab === 'permissions' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-[#E6E8F0] shadow-xs p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E6E8F0]">
              <div>
                <h2 className="text-base font-bold text-[#1B2236]">Enterprise Role Capabilities</h2>
                <p className="text-xs text-[#6B7490] mt-0.5">
                  HireFlow RBAC guarantees strict zero-leak boundaries across 5 specialized roles.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#6B7490]">Admin Fee Visibility Grant:</span>
                <button
                  onClick={() =>
                    handleToggleGrant(
                      'recruiterViewInternalFees',
                      !!permissionGrants.recruiterViewInternalFees
                    )
                  }
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    permissionGrants.recruiterViewInternalFees
                      ? 'bg-[#12B76A] text-white shadow-xs'
                      : 'bg-[#EEEBFB] text-[#5B49D6] border border-[#5B49D6]/30'
                  }`}
                >
                  {permissionGrants.recruiterViewInternalFees ? 'Enabled' : 'Disabled'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 my-6">
              {[
                {
                  role: UserRole.RECRUITER,
                  title: 'Recruiter',
                  desc: 'Owns candidate talent pool, coordinates interviews, submits profiles.',
                  scope: 'Assigned Candidates & Jobs Only',
                  badge: 'bg-[#E3F6EC] text-[#12B76A]',
                },
                {
                  role: UserRole.MANAGER,
                  title: 'Manager',
                  desc: 'Oversees direct reporting recruiters, approves job submissions, workload.',
                  scope: 'Reporting Team Scope',
                  badge: 'bg-[#E5F0FF] text-[#3B82F6]',
                },
                {
                  role: UserRole.ADMIN,
                  title: 'Admin',
                  desc: 'Full workspace authority, user management, audit trails, tenant settings.',
                  scope: 'Tenant Boundary (Aureva Capital)',
                  badge: 'bg-[#EEEBFB] text-[#5B49D6]',
                },
                {
                  role: UserRole.CLIENT,
                  title: 'Client',
                  desc: 'Reviews presented candidate profiles, provides interview feedback.',
                  scope: 'Authorized Jobs & Profiles Only',
                  badge: 'bg-[#FEF3DC] text-[#F59E0B]',
                },
                {
                  role: UserRole.CANDIDATE,
                  title: 'Candidate',
                  desc: 'Submits job applications, views interview schedules, updates profile.',
                  scope: 'Own Profile & Applications',
                  badge: 'bg-[#FDECEC] text-[#E5484D]',
                },
              ].map((card, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl border border-[#E6E8F0] bg-[#F6F7FB]/50 flex flex-col justify-between"
                >
                  <div>
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${card.badge} mb-2`}>
                      {card.title}
                    </span>
                    <p className="text-xs text-[#1B2236] leading-relaxed">{card.desc}</p>
                  </div>
                  <div className="mt-4 pt-2 border-t border-[#E6E8F0] text-[10px] font-semibold text-[#6B7490]">
                    Scope: {card.scope}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 rounded-xl bg-[#EEEBFB]/50 border border-[#5B49D6]/20 flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-[#5B49D6] shrink-0 mt-0.5" />
              <div className="text-xs text-[#1B2236] leading-relaxed">
                <strong className="text-[#5B49D6]">SaaS Security Commandments Enforced:</strong> Client portal accounts never receive candidate internal notes, recruiter commission margins, or placement fee agreements in server responses. Any authorization modification is permanently committed to the immutable PostgreSQL audit trail.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: CLIENT ACCESS                                     */}
      {/* ======================================================== */}
      {activeTab === 'client' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-[#E6E8F0] shadow-xs overflow-hidden">
            <div className="p-4 border-b border-[#E6E8F0] flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-[#1B2236]">Active Client User Access</h2>
                <p className="text-[11px] text-[#6B7490]">
                  Client contacts with secure access to view submitted profiles and submit feedback.
                </p>
              </div>
              <span className="text-xs text-[#6B7490]">
                {clientAccesses.length} active client reviewer accounts
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-[#F6F7FB] text-[#6B7490] font-semibold uppercase text-[10px] tracking-wider border-b border-[#E6E8F0]">
                    <th className="py-3 px-4">Client User</th>
                    <th className="py-3 px-3">Client Account</th>
                    <th className="py-3 px-3">Authorized Job Mandates</th>
                    <th className="py-3 px-3">Daily Download Limit</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6E8F0]">
                  {clientAccesses.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-[#6B7490]">
                        No client reviewers provisioned yet. Use the Invite Client User form to add one.
                      </td>
                    </tr>
                  ) : (
                    clientAccesses.map((ca) => (
                      <tr key={ca.id} className="hover:bg-[#F6F7FB]/50 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-[#1B2236]">{ca.userName}</div>
                          <div className="text-[11px] text-[#6B7490]">{ca.userEmail}</div>
                        </td>
                        <td className="py-3 px-3 font-medium text-[#1B2236]">
                          {ca.clientName}
                        </td>
                        <td className="py-3 px-3">
                          {ca.authorizedJobIds.length === 0 ? (
                            <span className="text-[#6B7490] italic">All jobs of client</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {ca.authorizedJobIds.map((jid) => {
                                const job = jobs.find((j) => j.id === jid);
                                return (
                                  <span
                                    key={jid}
                                    className="px-1.5 py-0.5 rounded text-[10px] bg-[#EEEBFB] text-[#5B49D6]"
                                  >
                                    {job?.title || 'Authorized Job'}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 text-[#1B2236]">
                          {ca.downloadLimit} CVs / day
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#E3F6EC] text-[#12B76A]">
                            {ca.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => {
                              setActionFeedback({
                                type: 'success',
                                message: `Client access verified for ${ca.userName}.`,
                              });
                            }}
                            className="px-2 py-1 text-xs text-[#5B49D6] hover:bg-[#EEEBFB] rounded transition-colors"
                          >
                            Edit Scopes
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 4: INVITATIONS                                       */}
      {/* ======================================================== */}
      {activeTab === 'invitations' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-[#E6E8F0] shadow-xs overflow-hidden">
            <div className="p-4 border-b border-[#E6E8F0] flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-[#1B2236]">Pending & Sent Invitations</h2>
                <p className="text-[11px] text-[#6B7490]">
                  Invitations include a 7-day cryptographically secure token sent via corporate email.
                </p>
              </div>
              <button
                onClick={() => setIsInviteModalOpen(true)}
                className="px-3 py-1.5 bg-[#5B49D6] text-white rounded-lg text-xs font-semibold hover:bg-[#5B49D6]/90 transition-all flex items-center gap-1.5"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>+ Invite Member</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-[#F6F7FB] text-[#6B7490] font-semibold uppercase text-[10px] tracking-wider border-b border-[#E6E8F0]">
                    <th className="py-3 px-4">Invited Email</th>
                    <th className="py-3 px-3">Role</th>
                    <th className="py-3 px-3">Invited By</th>
                    <th className="py-3 px-3">Expires At</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6E8F0]">
                  {invitations.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-[#6B7490]">
                        No invitations sent yet. Click "+ Invite Member" to send one.
                      </td>
                    </tr>
                  ) : (
                    invitations.map((inv) => (
                      <tr key={inv.id} className="hover:bg-[#F6F7FB]/50 transition-colors">
                        <td className="py-3 px-4 font-semibold text-[#1B2236]">
                          {inv.email}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold border ${getRoleBadge(
                              inv.role
                            )}`}
                          >
                            {inv.role}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-[#6B7490]">
                          {inv.invitedByName}
                        </td>
                        <td className="py-3 px-3 font-mono text-[11px] text-[#6B7490]">
                          {new Date(inv.expiresAt).toLocaleDateString('en-IN', {
                            dateStyle: 'medium',
                          })}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              inv.status === 'PENDING'
                                ? 'bg-[#FEF3DC] text-[#F59E0B]'
                                : inv.status === 'ACCEPTED'
                                ? 'bg-[#E3F6EC] text-[#12B76A]'
                                : 'bg-[#FDECEC] text-[#E5484D]'
                            }`}
                          >
                            {inv.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {inv.status === 'PENDING' && (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleResendInvite(inv.id)}
                                disabled={isPending}
                                className="px-2.5 py-1 text-xs text-[#5B49D6] hover:bg-[#EEEBFB] rounded font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                                title="Resend token and extend expiry by 7 days"
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span>Resend</span>
                              </button>
                              <button
                                onClick={() => handleRevokeInvite(inv.id)}
                                disabled={isPending}
                                className="px-2.5 py-1 text-xs text-[#E5484D] hover:bg-[#FDECEC] rounded font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                                title="Revoke invitation token immediately"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Revoke</span>
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 1: INVITE MEMBER MODAL                             */}
      {/* ======================================================== */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-[#E6E8F0] shadow-2xl max-w-lg w-full p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-[#E6E8F0]">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-[#EEEBFB] text-[#5B49D6]">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[#1B2236]">Invite Team Member</h3>
                  <p className="text-[11px] text-[#6B7490]">
                    Send a verified invitation token with reporting hierarchy.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsInviteModalOpen(false)}
                className="p-1 rounded-md text-[#6B7490] hover:text-[#1B2236]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleInviteSubmit} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-[#1B2236] mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Vikram Malhotra"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E6E8F0] rounded-lg text-xs outline-none focus:border-[#5B49D6]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#1B2236] mb-1">
                  Work Email (@aurevacapital.com or @hireflow.io)
                </label>
                <input
                  type="email"
                  required
                  placeholder="vikram.m@hireflow.io"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E6E8F0] rounded-lg text-xs outline-none focus:border-[#5B49D6]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#1B2236] mb-1">Role</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as 'RECRUITER' | 'MANAGER' | 'ADMIN')}
                    className="w-full px-3 py-2 border border-[#E6E8F0] rounded-lg text-xs outline-none focus:border-[#5B49D6]"
                  >
                    <option value={UserRole.RECRUITER}>Recruiter</option>
                    <option value={UserRole.MANAGER}>Manager</option>
                    <option value={UserRole.ADMIN}>Admin</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[#1B2236] mb-1">Assigned Team</label>
                  <select
                    value={inviteTeamId}
                    onChange={(e) => setInviteTeamId(e.target.value)}
                    className="w-full px-3 py-2 border border-[#E6E8F0] rounded-lg text-xs outline-none focus:border-[#5B49D6]"
                  >
                    <option value="">No Team Assigned</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#1B2236] mb-1">
                  Reports To (Direct Manager)
                </label>
                <select
                  value={inviteManagerId}
                  onChange={(e) => setInviteManagerId(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E6E8F0] rounded-lg text-xs outline-none focus:border-[#5B49D6]"
                >
                  <option value="">Top Level (No Manager)</option>
                  {eligibleManagers.map((mgr) => (
                    <option key={mgr.id} value={mgr.id}>
                      {mgr.name} ({mgr.role})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-3 border-t border-[#E6E8F0] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsInviteModalOpen(false)}
                  className="px-4 py-2 border border-[#E6E8F0] hover:bg-[#F6F7FB] text-[#1B2236] rounded-lg text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 bg-[#5B49D6] text-white rounded-lg text-xs font-semibold hover:bg-[#5B49D6]/90 transition-all shadow-sm cursor-pointer"
                >
                  {isPending ? 'Sending...' : 'Send Invitation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: CHANGE REPORTING LINE MODAL                     */}
      {/* ======================================================== */}
      {isReportingModalOpen && selectedMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-[#E6E8F0] shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-[#E6E8F0]">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-[#EEEBFB] text-[#5B49D6]">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[#1B2236]">Change Reporting Line</h3>
                  <p className="text-[11px] text-[#6B7490]">
                    Update manager for <strong>{selectedMember.name}</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsReportingModalOpen(false)}
                className="p-1 rounded-md text-[#6B7490] hover:text-[#1B2236]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleReportingSubmit} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-[#1B2236] mb-1">
                  Select New Reporting Manager
                </label>
                <select
                  value={newManagerId}
                  onChange={(e) => setNewManagerId(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E6E8F0] rounded-lg text-xs outline-none focus:border-[#5B49D6]"
                >
                  <option value="">No Manager (Top Level)</option>
                  {eligibleManagers.map((mgr) => {
                    const isCycle = checkCycle(mgr.id);
                    return (
                      <option
                        key={mgr.id}
                        value={mgr.id}
                        disabled={isCycle}
                      >
                        {mgr.name} ({mgr.role}) {isCycle ? '⚠️ (Causes Cycle)' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              {newManagerId && checkCycle(newManagerId) && (
                <div className="p-3 rounded-lg bg-[#FDECEC] border border-[#E5484D]/30 text-xs text-[#E5484D] flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>
                    Circular reporting line detected! A user cannot report to their own subordinate.
                  </span>
                </div>
              )}

              <div className="pt-2 border-t border-[#E6E8F0] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsReportingModalOpen(false)}
                  className="px-4 py-2 border border-[#E6E8F0] hover:bg-[#F6F7FB] text-[#1B2236] rounded-lg text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending || (!!newManagerId && checkCycle(newManagerId))}
                  className="px-4 py-2 bg-[#5B49D6] disabled:opacity-50 text-white rounded-lg text-xs font-semibold hover:bg-[#5B49D6]/90 transition-all cursor-pointer"
                >
                  {isPending ? 'Updating...' : 'Save Reporting Line'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 3: ASSIGN TEAM MODAL                               */}
      {/* ======================================================== */}
      {isTeamModalOpen && selectedMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-[#E6E8F0] shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-[#E6E8F0]">
              <div className="flex items-center gap-2">
                <Building className="w-5 h-5 text-[#5B49D6]" />
                <h3 className="font-bold text-sm text-[#1B2236]">Assign Team Desk</h3>
              </div>
              <button
                onClick={() => setIsTeamModalOpen(false)}
                className="p-1 rounded-md text-[#6B7490] hover:text-[#1B2236]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleTeamSubmit} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-[#1B2236] mb-1">
                  Team for {selectedMember.name}
                </label>
                <select
                  value={newTeamId}
                  onChange={(e) => setNewTeamId(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E6E8F0] rounded-lg text-xs outline-none focus:border-[#5B49D6]"
                >
                  <option value="">No Team (Cross-functional)</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2 border-t border-[#E6E8F0] flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsTeamModalOpen(false)}
                  className="px-4 py-2 border border-[#E6E8F0] hover:bg-[#F6F7FB] text-[#1B2236] rounded-lg text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 bg-[#5B49D6] text-white rounded-lg text-xs font-semibold hover:bg-[#5B49D6]/90 transition-all cursor-pointer"
                >
                  {isPending ? 'Updating...' : 'Assign Team'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 4: TOGGLE USER STATUS (DEACTIVATE / REACTIVATE)     */}
      {/* ======================================================== */}
      {isStatusModalOpen && selectedMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-[#E6E8F0] shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 pb-3 border-b border-[#E6E8F0]">
              <div
                className={`p-2 rounded-xl ${
                  selectedMember.status === 'ACTIVE'
                    ? 'bg-[#FDECEC] text-[#E5484D]'
                    : 'bg-[#E3F6EC] text-[#12B76A]'
                }`}
              >
                {selectedMember.status === 'ACTIVE' ? (
                  <UserX className="w-5 h-5" />
                ) : (
                  <UserCheck className="w-5 h-5" />
                )}
              </div>
              <div>
                <h3 className="font-bold text-sm text-[#1B2236]">
                  {selectedMember.status === 'ACTIVE'
                    ? `Deactivate ${selectedMember.name}?`
                    : `Reactivate ${selectedMember.name}?`}
                </h3>
                <span className="text-[11px] text-[#6B7490]">{selectedMember.email}</span>
              </div>
            </div>

            <div className="py-4 text-xs text-[#6B7490] space-y-2 leading-relaxed">
              {selectedMember.status === 'ACTIVE' ? (
                <>
                  <p>
                    Deactivating this member will <strong>immediately revoke all active login sessions</strong> and prevent future access.
                  </p>
                  <p className="p-2.5 rounded-lg bg-[#F6F7FB] border border-[#E6E8F0] text-[#1B2236]">
                    <strong>Enterprise Data Preservation:</strong> Sourced candidates, assigned job records, and client submissions owned by this member will <strong>remain intact</strong> and will not be orphaned or deleted.
                  </p>
                </>
              ) : (
                <p>
                  Reactivating this account will allow the member to log back in using corporate Google SSO or email credentials.
                </p>
              )}
            </div>

            <div className="pt-2 border-t border-[#E6E8F0] flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsStatusModalOpen(false)}
                className="px-4 py-2 border border-[#E6E8F0] hover:bg-[#F6F7FB] text-[#1B2236] rounded-lg text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleToggleStatus}
                disabled={isPending}
                className={`px-4 py-2 rounded-lg text-xs font-semibold text-white transition-all cursor-pointer ${
                  selectedMember.status === 'ACTIVE'
                    ? 'bg-[#E5484D] hover:bg-[#E5484D]/90'
                    : 'bg-[#12B76A] hover:bg-[#12B76A]/90'
                }`}
              >
                {isPending
                  ? 'Updating...'
                  : selectedMember.status === 'ACTIVE'
                  ? 'Confirm Deactivation'
                  : 'Confirm Reactivation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
