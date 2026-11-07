import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'HireFlow ATS & Recruitment CRM',
    short_name: 'HireFlow',
    description: 'Enterprise Applicant Tracking System and Recruitment CRM for high-growth agencies',
    start_url: '/mobile/today',
    display: 'standalone',
    background_color: '#FFFFFF',
    theme_color: '#5B49D6',
    orientation: 'portrait',
    icons: [
      {
        src: '/icons/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/icons/icon-maskable-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
