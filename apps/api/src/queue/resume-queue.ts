/**
 * BullMQ Resume Parsing Queue Architecture
 *
 * Implements asynchronous background processing of resume parsing jobs.
 * Enforces job deduplication via file checksums, retry policies with exponential backoff,
 * job status polling, and graceful synchronous fallback when Redis is unavailable.
 */

import { Queue, Worker, Job } from 'bullmq';
import {
  ParsedResumeReview,
  DuplicateCheckResult,
  getStorageProvider,
  getTextExtractor,
  getResumeParser,
} from '@hireflow/shared';

export interface ResumeParseJobData {
  storageKey: string;
  fileName: string;
  fileChecksum: string;
  organizationId: string;
  userId: string;
}

export interface ResumeParseJobResult {
  parsed: ParsedResumeReview;
  duplicateCheck: DuplicateCheckResult;
  extractionTimeMs: number;
}

export const RESUME_QUEUE_NAME = 'resume-parsing';

export interface QueueStatusReport {
  isRedisAvailable: boolean;
  queueName: string;
  redisUrl: string;
  activeJobsCount?: number;
  waitingJobsCount?: number;
  failedJobsCount?: number;
}

export class ResumeParsingQueueManager {
  private queue: Queue<ResumeParseJobData, ResumeParseJobResult> | null = null;
  private worker: Worker<ResumeParseJobData, ResumeParseJobResult> | null = null;
  private redisUrl: string;
  private isConnected = false;
  private inMemoryJobStore = new Map<
    string,
    { status: 'waiting' | 'active' | 'completed' | 'failed'; progress: number; result?: ResumeParseJobResult; error?: string }
  >();

  constructor(redisUrl?: string) {
    this.redisUrl = redisUrl || process.env.REDIS_URL || 'redis://127.0.0.1:6379';
    this.initQueue();
  }

  private initQueue() {
    try {
      const parsedUrl = new URL(this.redisUrl);
      const connection = {
        host: parsedUrl.hostname,
        port: parseInt(parsedUrl.port || '6379', 10),
        maxRetriesPerRequest: null,
        enableOfflineQueue: false,
        connectTimeout: 500,
        retryStrategy: () => null, // Fail fast if Redis server is down
      };

      this.queue = new Queue(RESUME_QUEUE_NAME, {
        connection,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
          removeOnComplete: {
            age: 3600, // keep for 1 hour
            count: 500,
          },
          removeOnFail: {
            age: 86400, // keep for 24 hours
            count: 1000,
          },
        },
      });

      // Track connection health
      this.queue.on('error', () => {
        this.isConnected = false;
      });
    } catch {
      this.isConnected = false;
    }
  }

  public async getQueueStatus(): Promise<QueueStatusReport> {
    let waiting = 0;
    let active = 0;
    let failed = 0;
    let available = false;

    if (this.queue) {
      try {
        const client = await this.queue.client;
        if (client && client.status === 'ready') {
          const counts = await Promise.race([
            this.queue.getJobCounts('waiting', 'active', 'failed'),
            new Promise<null>((_, reject) => setTimeout(() => reject(new Error('timeout')), 300)),
          ]);
          if (counts) {
            waiting = counts.waiting;
            active = counts.active;
            failed = counts.failed;
            available = true;
          }
        }
      } catch {
        available = false;
      }
    }

    return {
      isRedisAvailable: available,
      queueName: RESUME_QUEUE_NAME,
      redisUrl: this.redisUrl,
      activeJobsCount: active,
      waitingJobsCount: waiting,
      failedJobsCount: failed,
    };
  }

  /**
   * Enqueues a resume parsing job.
   * If Redis is available, schedules job in BullMQ with deduplication key (checksum).
   * If Redis is unavailable, executes synchronously and stores result in memory store.
   */
  public async enqueueJob(
    data: ResumeParseJobData,
    buffer?: Buffer
  ): Promise<{ jobId: string; status: 'queued' | 'completed'; result?: ResumeParseJobResult }> {
    const jobId = `parse-${data.fileChecksum}`;

    // Fast check if real Redis queue is responsive
    if (this.queue) {
      try {
        const client = await this.queue.client;
        if (client && client.status === 'ready') {
          const job = await Promise.race([
            this.queue.add('parse-resume-file', data, { jobId }),
            new Promise<null>((_, reject) => setTimeout(() => reject(new Error('timeout')), 500)),
          ]);
          if (job) {
            return { jobId: job.id || jobId, status: 'queued' };
          }
        }
      } catch {
        // Fallback to synchronous execution when Redis is unreachable
      }
    }

    // Synchronous execution fallback for environments without active Redis
    const executionResult = await this.processJobDirectly(data, buffer);
    this.inMemoryJobStore.set(jobId, {
      status: 'completed',
      progress: 100,
      result: executionResult,
    });

    return {
      jobId,
      status: 'completed',
      result: executionResult,
    };
  }

  /**
   * Direct processor function used by both Worker and synchronous fallback.
   */
  public async processJobDirectly(
    data: ResumeParseJobData,
    providedBuffer?: Buffer
  ): Promise<ResumeParseJobResult> {
    const storage = getStorageProvider();
    const buffer = providedBuffer || (await storage.getFile(data.storageKey));
    if (!buffer) {
      throw new Error(`Resume document not found at storage key ${data.storageKey}`);
    }

    // 1. Text Extraction (with OCR fallback)
    const extractor = getTextExtractor();
    const extracted = await extractor.extractText(buffer, data.fileName);

    // 2. Structured Parsing
    const parser = getResumeParser();
    const parsed = await parser.parseResume(extracted.rawText, {
      fileName: data.fileName,
      storageKey: data.storageKey,
      fileSize: buffer.length,
      checksum: data.fileChecksum,
    });

    // 3. Return structured payload
    return {
      parsed,
      duplicateCheck: { isDuplicate: false, matches: [] },
      extractionTimeMs: extracted.extractionTimeMs,
    };
  }

  /**
   * Retrieves status and result of a parsing job.
   */
  public async getJob(jobId: string): Promise<{
    status: 'waiting' | 'active' | 'completed' | 'failed' | 'unknown';
    progress: number;
    result?: ResumeParseJobResult;
    error?: string;
  }> {
    // Check in-memory store first
    if (this.inMemoryJobStore.has(jobId)) {
      return this.inMemoryJobStore.get(jobId)!;
    }

    if (this.queue) {
      try {
        const job = await this.queue.getJob(jobId);
        if (job) {
          const state = await job.getState();
          return {
            status: state as any,
            progress: typeof job.progress === 'number' ? job.progress : 0,
            result: job.returnvalue || undefined,
            error: job.failedReason || undefined,
          };
        }
      } catch {
        // Redis lookup failure
      }
    }

    return { status: 'unknown', progress: 0 };
  }

  public async close(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }
    if (this.queue) {
      await this.queue.close();
      this.queue = null;
    }
  }
}

// Singleton Queue Manager
let globalQueueManager: ResumeParsingQueueManager | null = null;

export function getResumeQueueManager(): ResumeParsingQueueManager {
  if (!globalQueueManager) {
    globalQueueManager = new ResumeParsingQueueManager();
  }
  return globalQueueManager;
}
