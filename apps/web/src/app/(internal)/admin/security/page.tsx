'use client';

import React, { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
import {
  Shield,
  Key,
  Lock,
  Clock,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  RotateCw,
  LogOut,
  ChevronLeft,
  Laptop,
  Info,
} from 'lucide-react';
import {
  getSecurityPolicyAction,
  updateSecurityPolicyAction,
  SecurityPolicyActionResult,
} from '@/actions/admin-security';
import {
  reauthenticateAction,
  revokeSessionAction,
  revokeOtherSessionsAction,
} from '@/actions/auth';

type SecurityData = NonNullable<Awaited<ReturnType<typeof getSecurityPolicyAction>>>;
type SessionItem = SecurityData['activeSessions'][number];
type AuditLogItem = SecurityData['auditLogs'][number];

export default function AdminSecurityPage() {
  const [data, setData] = useState<SecurityData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'policies' | 'sessions' | 'audit'>('policies');
  const [result, setResult] = useState<SecurityPolicyActionResult | null>(null);
  const [isPending, startTransition] = useTransition();

  // Re-verification Modal state
  const [showReauthModal, setShowReauthModal] = useState(false);
  const [reauthPassword, setReauthPassword] = useState('');
  const [reauthError, setReauthError] = useState<string | null>(null);
  const [isReauthenticating, setIsReauthenticating] = useState(false);
  const [pendingFormData, setPendingFormData] = useState<FormData | null>(null);

  // Form Fields State
  const [authEmailPassword, setAuthEmailPassword] = useState(true);
  const [authGoogle, setAuthGoogle] = useState(true);
  const [allowedDomains, setAllowedDomains] = useState('');
  const [require2FA, setRequire2FA] = useState(true);
  const [otpExpiry, setOtpExpiry] = useState(300);
  const [otpCooldown, setOtpCooldown] = useState(30);
  const [otpMaxAttempts, setOtpMaxAttempts] = useState(3);
  const [maxSessions, setMaxSessions] = useState(2);
  const [inactivityTimeout, setInactivityTimeout] = useState(30);
  const [warningPeriod, setWarningPeriod] = useState(5);
  const [reverifyPeriod, setReverifyPeriod] = useState(15);
  const [changeReason, setChangeReason] = useState('');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const res = await getSecurityPolicyAction();
      setData(res);
      if (res?.policy) {
        const p = res.policy;
        setAuthEmailPassword(p.allowedAuthMethods?.includes('EMAIL_PASSWORD') ?? true);
        setAuthGoogle(p.allowedAuthMethods?.includes('GOOGLE') ?? true);
        setAllowedDomains(p.allowedEmailDomains?.join(', ') || 'hireflow.io, aurevacapital.com');
        setRequire2FA(p.requireTwoStepVerification ?? true);
        setOtpExpiry(p.otpExpirySeconds ?? 300);
        setOtpCooldown(p.otpResendCooldownSeconds ?? 30);
        setOtpMaxAttempts(p.otpMaxAttempts ?? 3);
        setMaxSessions(p.maxConcurrentSessions ?? 2);
        setInactivityTimeout(p.inactivityTimeoutMinutes ?? 30);
        setWarningPeriod(p.warningBeforeExpiryMinutes ?? 5);
        setReverifyPeriod(p.sensitiveActionReverificationMinutes ?? 15);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load security policies';
      setResult({ success: false, error: msg });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setResult(null);

    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await updateSecurityPolicyAction(result, formData);
      if (res.requiresReverification) {
        setPendingFormData(formData);
        setShowReauthModal(true);
      } else {
        setResult(res);
        if (res.success) {
          setChangeReason('');
          loadData();
        }
      }
    });
  };

  const handleReauthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsReauthenticating(true);
    setReauthError(null);

    const res = await reauthenticateAction(reauthPassword);
    if (!res.success) {
      setReauthError(res.error || 'Re-authentication failed');
      setIsReauthenticating(false);
      return;
    }

    setIsReauthenticating(false);
    setShowReauthModal(false);
    setReauthPassword('');

    // Re-trigger pending policy update
    if (pendingFormData) {
      startTransition(async () => {
        const updateRes = await updateSecurityPolicyAction(result, pendingFormData);
        setResult(updateRes);
        if (updateRes.success) {
          setChangeReason('');
          setPendingFormData(null);
          loadData();
        }
      });
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    if (!confirm('Are you sure you want to revoke this session?')) return;
    const res = await revokeSessionAction(sessionId);
    if (res.success) {
      loadData();
    }
  };

  const handleRevokeOtherSessions = async () => {
    if (!confirm('Revoke all other active sessions across devices?')) return;
    const res = await revokeOtherSessionsAction();
    if (res.success) {
      loadData();
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 max-w-6xl mx-auto flex items-center justify-center min-h-[50vh]">
        <div className="flex items-center gap-3 text-[#6B7490]">
          <RotateCw className="w-5 h-5 animate-spin text-[#5B49D6]" />
          <span>Loading security policies...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10 max-w-6xl mx-auto space-y-8 animate-in fade-in">
      {/* ------------------------------------------------------------- */}
      {/* HEADER & BREADCRUMB */}
      {/* ------------------------------------------------------------- */}
      <div>
        <div className="flex items-center gap-2 text-xs font-medium text-[#6B7490] mb-3">
          <Link href="/admin" className="hover:text-[#5B49D6] transition-colors flex items-center gap-1">
            <ChevronLeft className="w-3.5 h-3.5" />
            Admin Settings
          </Link>
          <span>/</span>
          <span className="text-[#1B2236] font-semibold">Security Policies</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#EEEBFB] border border-[#5B49D6]/20 flex items-center justify-center text-[#5B49D6]">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#1B2236] tracking-tight">
                Security Policies & Access Controls
              </h1>
              <p className="text-sm text-[#6B7490]">
                Configure two-step verification, concurrent session limits, and inactivity timeouts for Aureva Capital.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('policies')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'policies'
                  ? 'bg-[#5B49D6] text-white shadow-xs'
                  : 'bg-white text-[#6B7490] hover:text-[#1B2236] border border-[#E6E8F0]'
              }`}
            >
              Policies
            </button>
            <button
              onClick={() => setActiveTab('sessions')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'sessions'
                  ? 'bg-[#5B49D6] text-white shadow-xs'
                  : 'bg-white text-[#6B7490] hover:text-[#1B2236] border border-[#E6E8F0]'
              }`}
            >
              Active Sessions ({data?.activeSessions?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('audit')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'audit'
                  ? 'bg-[#5B49D6] text-white shadow-xs'
                  : 'bg-white text-[#6B7490] hover:text-[#1B2236] border border-[#E6E8F0]'
              }`}
            >
              Audit Trail
            </button>
          </div>
        </div>
      </div>

      {/* Result Alert */}
      {result?.error && (
        <div className="p-4 rounded-xl bg-[#E5484D]/10 border border-[#E5484D]/20 flex items-start gap-3 text-sm text-[#E5484D]">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold">Update Failed</div>
            <div>{result.error}</div>
          </div>
        </div>
      )}

      {result?.success && (
        <div className="p-4 rounded-xl bg-[#12B76A]/10 border border-[#12B76A]/20 flex items-start gap-3 text-sm text-[#12B76A]">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold">Policy Saved</div>
            <div>{result.message}</div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 1: SECURITY POLICIES FORM (FIGMA FRAME 31) */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'policies' && (
        <form onSubmit={handleFormSubmit} className="space-y-6">
          {/* Panel 1: Authentication Methods & Domain Allowlist */}
          <div className="bg-white border border-[#E6E8F0] rounded-2xl p-6 shadow-xs space-y-5">
            <div className="flex items-center gap-2 border-b border-[#E6E8F0] pb-4">
              <Key className="w-5 h-5 text-[#5B49D6]" />
              <h2 className="text-base font-bold text-[#1B2236]">1. Authentication Methods & Domain Allowlist</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="flex items-start gap-3 p-4 rounded-xl border border-[#E6E8F0] hover:border-[#5B49D6]/40 transition-colors cursor-pointer bg-[#F6F7FB]">
                <input
                  type="checkbox"
                  name="allowedAuthMethods"
                  value="EMAIL_PASSWORD"
                  checked={authEmailPassword}
                  onChange={(e) => setAuthEmailPassword(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded text-[#5B49D6] focus:ring-[#5B49D6]"
                />
                <div>
                  <div className="text-sm font-bold text-[#1B2236]">Work Email & Password</div>
                  <div className="text-xs text-[#6B7490] mt-0.5">Argon2id cryptographic hashing with rate-limited attempts.</div>
                </div>
              </label>

              <label className="flex items-start gap-3 p-4 rounded-xl border border-[#E6E8F0] hover:border-[#5B49D6]/40 transition-colors cursor-pointer bg-[#F6F7FB]">
                <input
                  type="checkbox"
                  name="allowedAuthMethods"
                  value="GOOGLE"
                  checked={authGoogle}
                  onChange={(e) => setAuthGoogle(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded text-[#5B49D6] focus:ring-[#5B49D6]"
                />
                <div>
                  <div className="text-sm font-bold text-[#1B2236]">Google Workspace SSO (OIDC)</div>
                  <div className="text-xs text-[#6B7490] mt-0.5">Google account authentication. 2FA is strictly enforced.</div>
                </div>
              </label>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#1B2236] uppercase tracking-wider mb-2">
                Authorized Email Domains (Comma-separated)
              </label>
              <input
                type="text"
                name="allowedEmailDomains"
                value={allowedDomains}
                onChange={(e) => setAllowedDomains(e.target.value)}
                placeholder="hireflow.io, aurevacapital.com"
                className="w-full px-4 py-2.5 rounded-xl border border-[#E6E8F0] text-sm text-[#1B2236] bg-white focus:outline-none focus:ring-2 focus:ring-[#5B49D6]"
              />
              <p className="text-xs text-[#6B7490] mt-1.5 flex items-center gap-1">
                <Info className="w-3.5 h-3.5" />
                Users must sign in with email addresses matching these corporate domains.
              </p>
            </div>
          </div>

          {/* Panel 2: Two-Step Verification (Email OTP) */}
          <div className="bg-white border border-[#E6E8F0] rounded-2xl p-6 shadow-xs space-y-5">
            <div className="flex items-center gap-2 border-b border-[#E6E8F0] pb-4">
              <Smartphone className="w-5 h-5 text-[#5B49D6]" />
              <h2 className="text-base font-bold text-[#1B2236]">2. Two-Step Verification (Email OTP)</h2>
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl bg-[#EEEBFB]/50 border border-[#5B49D6]/20">
              <div>
                <div className="text-sm font-bold text-[#1B2236]">Mandatory Two-Step Verification</div>
                <div className="text-xs text-[#6B7490] mt-0.5">
                  Require a 6-digit email OTP for all team members on sign in.
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  name="requireTwoStepVerification"
                  checked={require2FA}
                  onChange={(e) => setRequire2FA(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#5B49D6]"></div>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-[#1B2236] mb-1.5">
                  Code Expiration (Seconds)
                </label>
                <input
                  type="number"
                  name="otpExpirySeconds"
                  min={60}
                  max={1800}
                  value={otpExpiry}
                  onChange={(e) => setOtpExpiry(Number(e.target.value))}
                  className="w-full px-3.5 py-2 rounded-xl border border-[#E6E8F0] text-sm font-medium text-[#1B2236] focus:outline-none focus:ring-2 focus:ring-[#5B49D6]"
                />
                <span className="text-[11px] text-[#6B7490]">Default: 300s (5 minutes)</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1B2236] mb-1.5">
                  Resend Cooldown (Seconds)
                </label>
                <input
                  type="number"
                  name="otpResendCooldownSeconds"
                  min={10}
                  max={300}
                  value={otpCooldown}
                  onChange={(e) => setOtpCooldown(Number(e.target.value))}
                  className="w-full px-3.5 py-2 rounded-xl border border-[#E6E8F0] text-sm font-medium text-[#1B2236] focus:outline-none focus:ring-2 focus:ring-[#5B49D6]"
                />
                <span className="text-[11px] text-[#6B7490]">Default: 30 seconds</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1B2236] mb-1.5">
                  Max Incorrect Attempts
                </label>
                <input
                  type="number"
                  name="otpMaxAttempts"
                  min={1}
                  max={5}
                  value={otpMaxAttempts}
                  onChange={(e) => setOtpMaxAttempts(Number(e.target.value))}
                  className="w-full px-3.5 py-2 rounded-xl border border-[#E6E8F0] text-sm font-medium text-[#1B2236] focus:outline-none focus:ring-2 focus:ring-[#5B49D6]"
                />
                <span className="text-[11px] text-[#6B7490]">Lockout after 3 attempts</span>
              </div>
            </div>
          </div>

          {/* Panel 3: Session & Inactivity Policies */}
          <div className="bg-white border border-[#E6E8F0] rounded-2xl p-6 shadow-xs space-y-5">
            <div className="flex items-center gap-2 border-b border-[#E6E8F0] pb-4">
              <Clock className="w-5 h-5 text-[#5B49D6]" />
              <h2 className="text-base font-bold text-[#1B2236]">3. Session & Inactivity Policies</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#1B2236] mb-1.5">
                  Max Concurrent Sessions
                </label>
                <input
                  type="number"
                  name="maxConcurrentSessions"
                  min={1}
                  max={10}
                  value={maxSessions}
                  onChange={(e) => setMaxSessions(Number(e.target.value))}
                  className="w-full px-3.5 py-2 rounded-xl border border-[#E6E8F0] text-sm font-medium text-[#1B2236] focus:outline-none focus:ring-2 focus:ring-[#5B49D6]"
                />
                <span className="text-[11px] text-[#6B7490]">Default: 2 active sessions</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1B2236] mb-1.5">
                  Inactivity Timeout (Minutes)
                </label>
                <input
                  type="number"
                  name="inactivityTimeoutMinutes"
                  min={5}
                  max={1440}
                  value={inactivityTimeout}
                  onChange={(e) => setInactivityTimeout(Number(e.target.value))}
                  className="w-full px-3.5 py-2 rounded-xl border border-[#E6E8F0] text-sm font-medium text-[#1B2236] focus:outline-none focus:ring-2 focus:ring-[#5B49D6]"
                />
                <span className="text-[11px] text-[#6B7490]">Server auto-logout: 30 mins</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1B2236] mb-1.5">
                  Warning Period (Minutes)
                </label>
                <input
                  type="number"
                  name="warningBeforeExpiryMinutes"
                  min={1}
                  max={30}
                  value={warningPeriod}
                  onChange={(e) => setWarningPeriod(Number(e.target.value))}
                  className="w-full px-3.5 py-2 rounded-xl border border-[#E6E8F0] text-sm font-medium text-[#1B2236] focus:outline-none focus:ring-2 focus:ring-[#5B49D6]"
                />
                <span className="text-[11px] text-[#6B7490]">Prompt warning: 5 mins</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1B2236] mb-1.5">
                  Re-auth Window (Minutes)
                </label>
                <input
                  type="number"
                  name="sensitiveActionReverificationMinutes"
                  min={1}
                  max={120}
                  value={reverifyPeriod}
                  onChange={(e) => setReverifyPeriod(Number(e.target.value))}
                  className="w-full px-3.5 py-2 rounded-xl border border-[#E6E8F0] text-sm font-medium text-[#1B2236] focus:outline-none focus:ring-2 focus:ring-[#5B49D6]"
                />
                <span className="text-[11px] text-[#6B7490]">Sensitive actions: 15 mins</span>
              </div>
            </div>
          </div>

          {/* Panel 4: Change Reason & Commit */}
          <div className="bg-white border border-[#E6E8F0] rounded-2xl p-6 shadow-xs space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#1B2236] uppercase tracking-wider mb-2">
                Audit Log Change Reason <span className="text-[#E5484D]">*</span>
              </label>
              <input
                type="text"
                name="changeReason"
                required
                value={changeReason}
                onChange={(e) => setChangeReason(e.target.value)}
                placeholder="e.g. Enforcing 2FA and 30-min inactivity timeout for SOC-2 audit"
                className="w-full px-4 py-2.5 rounded-xl border border-[#E6E8F0] text-sm text-[#1B2236] focus:outline-none focus:ring-2 focus:ring-[#5B49D6]"
              />
              <p className="text-xs text-[#6B7490] mt-1.5">
                Every security policy modification is immutably logged with actor attribution.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="submit"
                disabled={isPending || !changeReason.trim()}
                className={`px-6 py-2.5 rounded-xl font-semibold text-white shadow-xs transition-all flex items-center gap-2 ${
                  isPending || !changeReason.trim()
                    ? 'bg-[#5B49D6]/60 cursor-not-allowed'
                    : 'bg-[#5B49D6] hover:bg-[#4d3db8] cursor-pointer'
                }`}
              >
                {isPending && <RotateCw className="w-4 h-4 animate-spin" />}
                <span>Save Security Policies</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 2: ACTIVE SESSIONS (FIGMA FRAME 31) */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'sessions' && (
        <div className="bg-white border border-[#E6E8F0] rounded-2xl p-6 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-[#E6E8F0] pb-4">
            <div>
              <h2 className="text-base font-bold text-[#1B2236]">Active User Sessions</h2>
              <p className="text-xs text-[#6B7490]">
                Concurrent active sessions authorized under your user credentials.
              </p>
            </div>
            <button
              onClick={handleRevokeOtherSessions}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg text-[#E5484D] hover:bg-[#E5484D]/10 border border-[#E5484D]/30 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Revoke All Other Sessions</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#F6F7FB] text-xs font-semibold text-[#6B7490] uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4 rounded-l-xl">Device / Browser</th>
                  <th className="py-3 px-4">IP Address</th>
                  <th className="py-3 px-4">Created Date</th>
                  <th className="py-3 px-4">Last Activity</th>
                  <th className="py-3 px-4 text-right rounded-r-xl">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6E8F0]">
                {data?.activeSessions?.map((session: SessionItem) => (
                  <tr key={session.id} className="hover:bg-[#F6F7FB]/50 transition-colors">
                    <td className="py-3.5 px-4 font-medium text-[#1B2236] flex items-center gap-2">
                      <Laptop className="w-4 h-4 text-[#5B49D6]" />
                      <span>{session.deviceInfo || 'Web Browser'}</span>
                    </td>
                    <td className="py-3.5 px-4 text-[#6B7490] font-mono text-xs">
                      {session.ipAddress || '127.0.0.1'}
                    </td>
                    <td className="py-3.5 px-4 text-[#6B7490] text-xs">
                      {new Date(session.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                    </td>
                    <td className="py-3.5 px-4 text-[#6B7490] text-xs">
                      {new Date(session.lastActivityAt || session.createdAt).toLocaleString('en-IN', {
                        timeZone: 'Asia/Kolkata',
                      })}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleRevokeSession(session.id)}
                        className="text-xs font-semibold text-[#E5484D] hover:underline cursor-pointer"
                      >
                        Revoke
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 3: AUDIT TRAIL */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'audit' && (
        <div className="bg-white border border-[#E6E8F0] rounded-2xl p-6 shadow-xs space-y-6">
          <div className="border-b border-[#E6E8F0] pb-4">
            <h2 className="text-base font-bold text-[#1B2236]">Security Policy Audit History</h2>
            <p className="text-xs text-[#6B7490]">
              Immutable log of policy modifications, two-factor enforcement, and threshold changes.
            </p>
          </div>

          <div className="space-y-4">
            {data?.auditLogs?.length === 0 ? (
              <p className="text-sm text-[#6B7490] text-center py-8">
                No policy modifications recorded yet.
              </p>
            ) : (
              data?.auditLogs?.map((log: AuditLogItem) => (
                <div key={log.id} className="p-4 rounded-xl border border-[#E6E8F0] bg-[#F6F7FB]/40 space-y-2">
                  <div className="flex items-center justify-between text-xs text-[#6B7490]">
                    <span className="font-semibold text-[#1B2236]">
                      {log.actor?.name || 'Administrator'} ({log.actor?.email})
                    </span>
                    <span>{new Date(log.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</span>
                  </div>
                  <div className="text-xs font-medium text-[#5B49D6]">
                    Action: {log.action}
                  </div>
                  {Boolean(log.after && typeof log.after === 'object' && 'changeReason' in (log.after as Record<string, unknown>)) && (
                    <div className="text-xs text-[#1B2236] bg-white p-2.5 rounded-lg border border-[#E6E8F0]">
                      <strong>Reason:</strong> {String((log.after as Record<string, unknown>).changeReason)}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* RE-AUTHENTICATION MODAL (FIGMA FRAME 31) */}
      {/* ------------------------------------------------------------- */}
      {showReauthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-white rounded-2xl border border-[#E6E8F0] shadow-xl p-6">
            <div className="w-12 h-12 rounded-xl bg-[#EEEBFB] border border-[#5B49D6]/20 flex items-center justify-center text-[#5B49D6] mb-4">
              <Lock className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-bold text-[#1B2236] mb-1">
              Confirm your password
            </h3>
            <p className="text-xs text-[#6B7490] leading-relaxed mb-4">
              Modifying workspace security policies requires recent authentication verification. Please confirm your password to proceed.
            </p>

            {reauthError && (
              <div className="mb-4 p-3 rounded-lg bg-[#E5484D]/10 border border-[#E5484D]/20 text-xs text-[#E5484D]">
                {reauthError}
              </div>
            )}

            <form onSubmit={handleReauthSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#1B2236] mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  required
                  autoFocus
                  value={reauthPassword}
                  onChange={(e) => setReauthPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6E8F0] text-sm text-[#1B2236] focus:outline-none focus:ring-2 focus:ring-[#5B49D6]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowReauthModal(false);
                    setReauthPassword('');
                    setPendingFormData(null);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[#6B7490] hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isReauthenticating || !reauthPassword}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[#5B49D6] hover:bg-[#4d3db8] transition-colors flex items-center gap-1.5"
                >
                  {isReauthenticating && <RotateCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Confirm & Save</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
