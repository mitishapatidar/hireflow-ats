'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, LogOut, CheckCircle2 } from 'lucide-react';
import { logoutAction } from '@/actions/auth';

interface InactivityWarningProps {
  timeoutMinutes?: number;
  warningMinutes?: number;
}

export function InactivityWarning({
  timeoutMinutes = 30,
  warningMinutes = 5,
}: InactivityWarningProps) {
  const router = useRouter();
  const [showWarning, setShowWarning] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(warningMinutes * 60);

  const totalTimeoutSeconds = timeoutMinutes * 60;
  const warningThresholdSeconds = (timeoutMinutes - warningMinutes) * 60;

  const [lastActivity, setLastActivity] = useState<number>(Date.now());

  const resetActivity = useCallback(() => {
    setLastActivity(Date.now());
    if (showWarning) {
      setShowWarning(false);
      setRemainingSeconds(warningMinutes * 60);
      // Ping API to update server lastActivityAt
      fetch('/api/auth/me').catch(() => {});
    }
  }, [showWarning, warningMinutes]);

  useEffect(() => {
    const handleUserActivity = () => {
      if (!showWarning) {
        setLastActivity(Date.now());
      }
    };

    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach((ev) => window.addEventListener(ev, handleUserActivity, { passive: true }));

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, handleUserActivity));
    };
  }, [showWarning]);

  useEffect(() => {
    const interval = setInterval(() => {
      const idleSeconds = Math.floor((Date.now() - lastActivity) / 1000);

      if (idleSeconds >= totalTimeoutSeconds) {
        // Expired!
        setShowWarning(false);
        router.push('/session-expired');
      } else if (idleSeconds >= warningThresholdSeconds) {
        // Within warning window
        setShowWarning(true);
        setRemainingSeconds(Math.max(0, totalTimeoutSeconds - idleSeconds));
      } else {
        setShowWarning(false);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [lastActivity, totalTimeoutSeconds, warningThresholdSeconds, router]);

  if (!showWarning) return null;

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const timeFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white rounded-2xl border border-[#E6E8F0] shadow-xl p-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-[#F59E0B]/10 border border-[#F59E0B]/20 flex items-center justify-center mx-auto mb-4 text-[#F59E0B]">
          <Clock className="w-7 h-7" />
        </div>

        <h3 className="text-xl font-bold text-[#1B2236] mb-2">
          Inactivity Warning
        </h3>
        <p className="text-sm text-[#6B7490] leading-relaxed mb-6">
          You have been inactive for {timeoutMinutes - warningMinutes} minutes. For security compliance, your session will automatically terminate in:
        </p>

        {/* Big Countdown */}
        <div className="py-3 px-6 rounded-xl bg-[#F6F7FB] border border-[#E6E8F0] inline-block mb-6">
          <span className="text-3xl font-extrabold text-[#1B2236] font-mono tracking-wider">
            {timeFormatted}
          </span>
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={resetActivity}
            className="flex-1 py-2.5 px-4 rounded-xl font-semibold text-white bg-[#5B49D6] hover:bg-[#4d3db8] shadow-sm transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Stay Signed In</span>
          </button>
          <button
            type="button"
            onClick={async () => {
              await logoutAction();
              router.push('/login');
            }}
            className="py-2.5 px-4 rounded-xl font-semibold text-[#6B7490] hover:text-[#E5484D] hover:bg-[#E5484D]/10 border border-[#E6E8F0] transition-all cursor-pointer flex items-center gap-1.5"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
}
