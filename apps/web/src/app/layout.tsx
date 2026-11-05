import type { Metadata } from 'next';
import './globals.css';

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
      <body className="min-h-screen bg-page-bg text-text antialiased">{children}</body>
    </html>
  );
}
