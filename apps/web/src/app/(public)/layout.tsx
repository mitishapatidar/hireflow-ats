import React from 'react';
import Link from 'next/link';

export default function PublicRouteGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#F6F7FB] flex flex-col font-sans">
      <header className="h-16 bg-[#1E2A4A] text-white border-b border-white/10 px-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#5B49D6] flex items-center justify-center font-bold text-white shadow-md">
            H
          </div>
          <span className="font-extrabold text-base tracking-tight text-white">HireFlow ATS</span>
        </Link>
        <div className="flex items-center gap-4 text-xs font-semibold">
          <Link href="/dashboard" className="text-white/80 hover:text-white transition-colors">
            Agency App
          </Link>
          <Link href="/portal" className="text-white/80 hover:text-white transition-colors">
            Client Portal
          </Link>
          <Link href="/my-dashboard" className="text-white/80 hover:text-white transition-colors">
            Careers
          </Link>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
