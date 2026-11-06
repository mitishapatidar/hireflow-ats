import type { Metadata } from 'next';
import './globals.css';
import { ClientProviders } from '../components/layout/ClientProviders';

export const metadata: Metadata = {
  title: 'HireFlow — ATS & Recruitment CRM',
  description: 'Enterprise Applicant Tracking System & Recruitment CRM for Aureva Capital',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#F6F7FB] text-[#1B2236] antialiased">
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
