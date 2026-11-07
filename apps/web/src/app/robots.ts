import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.APP_BASE_URL || 'https://hireflow.aurevacapital.com';

  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/careers', '/careers/*'],
        disallow: [
          '/api/',
          '/admin/',
          '/dashboard/',
          '/portal/',
          '/candidates/',
          '/jobs/',
          '/interviews/',
          '/placements/',
          '/handover/',
          '/offers/',
          '/sales/',
          '/submissions/',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
