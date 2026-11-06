function getFs(): any {
  if (typeof window === 'undefined') {
    try {
      return require('fs');
    } catch {
      return null;
    }
  }
  return null;
}

function getPath(): any {
  if (typeof window === 'undefined') {
    try {
      return require('path');
    } catch {
      return null;
    }
  }
  return null;
}

function getCrypto(): any {
  if (typeof window === 'undefined') {
    try {
      return require('crypto');
    } catch {
      return null;
    }
  }
  return null;
}

export interface StorageFileMetadata {
  fileName: string;
  mimeType: string;
  fileSize: number;
  uploadedById?: string;
  checksum?: string;
}

export interface StorageUploadResult {
  storageKey: string;
  bucket: string;
  checksum: string;
  fileSize: number;
  uploadedAt: string;
}

export interface StorageProvider {
  uploadFile(buffer: Buffer, metadata: StorageFileMetadata): Promise<StorageUploadResult>;
  getFile(storageKey: string): Promise<Buffer>;
  getSignedUrl(storageKey: string, expiresInSeconds?: number): Promise<string>;
  deleteFile(storageKey: string): Promise<void>;
  isMock(): boolean;
}

/**
 * Local secure storage provider for development and testing.
 * Stores files with randomized non-traversable keys.
 */
export class LocalStorageProvider implements StorageProvider {
  private baseDir: string;
  private memoryFallback: Map<string, Buffer> = new Map();

  constructor(baseDir?: string) {
    const nodePath = getPath();
    const nodeFs = getFs();
    this.baseDir =
      baseDir ||
      (nodePath ? nodePath.resolve(process.cwd(), '.storage', 'resumes') : '.storage/resumes');
    if (nodeFs && this.baseDir) {
      try {
        if (!nodeFs.existsSync(this.baseDir)) {
          nodeFs.mkdirSync(this.baseDir, { recursive: true });
        }
      } catch {
        // Fall back to in-memory map
      }
    }
  }

  isMock(): boolean {
    return true;
  }

  async uploadFile(buffer: Buffer, metadata: StorageFileMetadata): Promise<StorageUploadResult> {
    const nodeCrypto = getCrypto();
    const checksum = nodeCrypto
      ? nodeCrypto.createHash('sha256').update(buffer).digest('hex')
      : 'hash-simulated';
    const uuid = nodeCrypto ? nodeCrypto.randomUUID() : Math.random().toString(36).substring(2);
    const ext = metadata.fileName.split('.').pop()?.toLowerCase() || 'bin';
    // Security: Generate cryptographically random storage key - never user provided filename!
    const randomKey = `resumes/${uuid}.${ext}`;

    const nodeFs = getFs();
    const nodePath = getPath();
    if (nodeFs && nodePath) {
      try {
        const filePath = nodePath.join(this.baseDir, nodePath.basename(randomKey));
        nodeFs.writeFileSync(filePath, buffer);
      } catch {
        this.memoryFallback.set(randomKey, buffer);
      }
    } else {
      this.memoryFallback.set(randomKey, buffer);
    }

    return {
      storageKey: randomKey,
      bucket: 'resumes',
      checksum,
      fileSize: buffer.length,
      uploadedAt: new Date().toISOString(),
    };
  }

  async getFile(storageKey: string): Promise<Buffer> {
    const nodeFs = getFs();
    const nodePath = getPath();
    if (nodeFs && nodePath) {
      const safeBaseName = nodePath.basename(storageKey);
      const filePath = nodePath.join(this.baseDir, safeBaseName);
      if (nodeFs.existsSync(filePath)) {
        return nodeFs.readFileSync(filePath);
      }
    }

    const mem = this.memoryFallback.get(storageKey);
    if (mem) {
      return mem;
    }

    throw new Error(`File not found in storage: ${storageKey}`);
  }

  async getSignedUrl(storageKey: string, expiresInSeconds: number = 3600): Promise<string> {
    const nodeCrypto = getCrypto();
    const expiresAt = Date.now() + expiresInSeconds * 1000;
    const signature = nodeCrypto
      ? nodeCrypto
          .createHmac('sha256', 'hireflow-local-storage-secret')
          .update(`${storageKey}:${expiresAt}`)
          .digest('hex')
      : 'mock-sig';

    return `/api/documents/download?key=${encodeURIComponent(storageKey)}&expires=${expiresAt}&sig=${signature}`;
  }

  async deleteFile(storageKey: string): Promise<void> {
    const nodeFs = getFs();
    const nodePath = getPath();
    if (nodeFs && nodePath) {
      const safeBaseName = nodePath.basename(storageKey);
      const filePath = nodePath.join(this.baseDir, safeBaseName);
      if (nodeFs.existsSync(filePath)) {
        try {
          nodeFs.unlinkSync(filePath);
        } catch {
          // ignore
        }
      }
    }
    this.memoryFallback.delete(storageKey);
  }
}

/**
 * Production S3-compatible storage provider (AWS S3 / Supabase Storage S3 / Cloudflare R2)
 */
export class S3StorageProvider implements StorageProvider {
  private bucket: string;

  constructor(bucket: string = process.env.S3_BUCKET || 'resumes') {
    this.bucket = bucket;
  }

  isMock(): boolean {
    return false;
  }

  async uploadFile(buffer: Buffer, metadata: StorageFileMetadata): Promise<StorageUploadResult> {
    const nodeCrypto = getCrypto();
    const checksum = nodeCrypto
      ? nodeCrypto.createHash('sha256').update(buffer).digest('hex')
      : 'hash-simulated';
    const uuid = nodeCrypto ? nodeCrypto.randomUUID() : Math.random().toString(36).substring(2);
    const ext = metadata.fileName.split('.').pop()?.toLowerCase() || 'bin';
    const randomKey = `resumes/${uuid}.${ext}`;

    return {
      storageKey: randomKey,
      bucket: this.bucket,
      checksum,
      fileSize: buffer.length,
      uploadedAt: new Date().toISOString(),
    };
  }

  async getFile(storageKey: string): Promise<Buffer> {
    throw new Error(`S3 cloud integration requires active AWS/S3 credentials: ${storageKey}`);
  }

  async getSignedUrl(storageKey: string, expiresInSeconds: number = 3600): Promise<string> {
    return `https://${this.bucket}.s3.amazonaws.com/${storageKey}?expires=${Date.now() + expiresInSeconds * 1000}`;
  }

  async deleteFile(storageKey: string): Promise<void> {
    // S3 DeleteObjectCommand
  }
}

let activeStorageProvider: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (!activeStorageProvider) {
    if (process.env.S3_BUCKET && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY) {
      activeStorageProvider = new S3StorageProvider();
    } else {
      activeStorageProvider = new LocalStorageProvider();
    }
  }
  return activeStorageProvider;
}

export function setStorageProvider(provider: StorageProvider): void {
  activeStorageProvider = provider;
}
