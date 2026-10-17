import { randomUUID } from 'crypto';

export interface FileMetadata {
  fileId: string;
  fileName: string;
  storageLocation: string;
  sizeBytes: number;
  mimeType: string;
  owner: string;
  createdAt: string;
  status: 'AVAILABLE' | 'REPLICATING' | 'DELETED';
  replicationFactor: number;
  hashMd5: string;
}

export class DistributedStorageService {
  private files: Map<string, FileMetadata> = new Map();
  private fileData: Map<string, string> = new Map(); // fileId -> content

  constructor() {
    this.seedDefaultFiles();
  }

  private seedDefaultFiles() {
    const defaults: FileMetadata[] = [
      {
        fileId: 'file-rm-001',
        fileName: 'fullstack-roadmap-30days.pdf',
        storageLocation: 'dfs://us-east-1.s3.supabase.co/roadmaps/user-981/roadmap.pdf',
        sizeBytes: 245800,
        mimeType: 'application/pdf',
        owner: 'user_2841b',
        createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
        status: 'AVAILABLE',
        replicationFactor: 3,
        hashMd5: 'a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3',
      },
      {
        fileId: 'file-report-002',
        fileName: 'job-fraud-audit-analysis.json',
        storageLocation: 'dfs://eu-central-1.s3.supabase.co/audits/job-982-audit.json',
        sizeBytes: 14200,
        mimeType: 'application/json',
        owner: 'system_auditor',
        createdAt: new Date(Date.now() - 3600000 * 6).toISOString(),
        status: 'AVAILABLE',
        replicationFactor: 3,
        hashMd5: '9f8e7d6c5b4a3a2b1c0d9e8f7a6b5c4d',
      },
      {
        fileId: 'file-curriculum-003',
        fileName: 'ai-skill-benchmarks-2026.csv',
        storageLocation: 'dfs://ap-south-1.s3.supabase.co/benchmarks/skills_v2.csv',
        sizeBytes: 89400,
        mimeType: 'text/csv',
        owner: 'admin',
        createdAt: new Date(Date.now() - 3600000 * 48).toISOString(),
        status: 'AVAILABLE',
        replicationFactor: 3,
        hashMd5: '1234567890abcdef1234567890abcdef',
      },
    ];

    defaults.forEach((f) => {
      this.files.set(f.fileId, f);
      this.fileData.set(f.fileId, `Dummy payload content for ${f.fileName}`);
    });
  }

  public async uploadFile(
    fileName: string,
    content: string,
    mimeType: string,
    owner = 'student-user'
  ): Promise<FileMetadata> {
    const fileId = `file-${randomUUID().slice(0, 8)}`;
    const sizeBytes = Buffer.byteLength(content, 'utf8');

    const meta: FileMetadata = {
      fileId,
      fileName,
      storageLocation: `dfs://distributed-cluster.dreamcanvas.net/storage/${fileId}/${fileName}`,
      sizeBytes,
      mimeType,
      owner,
      createdAt: new Date().toISOString(),
      status: 'AVAILABLE',
      replicationFactor: 3,
      hashMd5: Buffer.from(fileId).toString('hex').slice(0, 32),
    };

    this.files.set(fileId, meta);
    this.fileData.set(fileId, content);
    return meta;
  }

  public async downloadFile(fileId: string): Promise<{ metadata: FileMetadata; content: string } | null> {
    const meta = this.files.get(fileId);
    if (!meta || meta.status === 'DELETED') return null;
    const content = this.fileData.get(fileId) || '';
    return { metadata: meta, content };
  }

  public async deleteFile(fileId: string): Promise<boolean> {
    const meta = this.files.get(fileId);
    if (!meta) return false;
    meta.status = 'DELETED';
    this.fileData.delete(fileId);
    return true;
  }

  public async getFileMetadata(fileId: string): Promise<FileMetadata | null> {
    return this.files.get(fileId) || null;
  }

  public getAllFiles(): FileMetadata[] {
    return Array.from(this.files.values()).filter((f) => f.status !== 'DELETED');
  }
}

export const distributedStorageService = new DistributedStorageService();
