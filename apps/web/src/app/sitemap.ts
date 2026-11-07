import { MetadataRoute } from 'next';
import { prisma } from '@hireflow/db';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.APP_BASE_URL || 'https://hireflow.aurevacapital.com';

  try {
    const publishedJobs = await prisma.job.findMany({
      where: {
        status: 'ACTIVE',
        isPublished: true,
        isArchived: false,
        organization: { status: 'ACTIVE' },
        OR: [{ deadline: null }, { deadline: { gte: new Date() } }],
      },
      select: {
        id: true,
        updatedAt: true,
      },
    });

    const jobEntries: MetadataRoute.Sitemap = publishedJobs.map((job) => ({
      url: `${baseUrl}/careers/${job.id}`,
      lastModified: job.updatedAt,
      changeFrequency: 'weekly',
      priority: 0.8,
    }));

    return [
      {
        url: `${baseUrl}/careers`,
        lastModified: new Date(),
        changeFrequency: 'daily',
        priority: 1.0,
      },
      ...jobEntries,
    ];
  } catch (err) {
    console.error('[sitemap] Failed to generate sitemap:', err);
    return [
      {
        url: `${baseUrl}/careers`,
        lastModified: new Date(),
        changeFrequency: 'daily',
        priority: 1.0,
      },
    ];
  }
}
