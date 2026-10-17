'use client';

import React, { useState } from 'react';
import { HardDrive, Upload, Trash2, CheckCircle2, FileText, Database } from 'lucide-react';
import { distributedStorageService, FileMetadata } from '@/services/storage/storageService';

export default function StorageExplorer() {
  const [files, setFiles] = useState<FileMetadata[]>(distributedStorageService.getAllFiles());
  const [newFileName, setNewFileName] = useState('');
  const [newFileContent, setNewFileContent] = useState('');
  const [uploading, setUploading] = useState(false);

  const handleUpload = async () => {
    if (!newFileName.trim()) return;
    setUploading(true);
    const meta = await distributedStorageService.uploadFile(
      newFileName,
      newFileContent || 'Sample career data payload',
      newFileName.endsWith('.pdf') ? 'application/pdf' : 'application/json',
      'current-student'
    );
    setFiles(distributedStorageService.getAllFiles());
    setNewFileName('');
    setNewFileContent('');
    setUploading(false);
  };

  const handleDelete = async (fileId: string) => {
    await distributedStorageService.deleteFile(fileId);
    setFiles(distributedStorageService.getAllFiles());
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-cyan-400" />
            Distributed File System (DFS) Storage Abstraction
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Replicated object and file storage abstraction across Supabase Storage and S3 clusters
          </p>
        </div>
      </div>

      {/* Upload Interface */}
      <div className="bg-slate-950/80 rounded-2xl border border-slate-800 p-5 space-y-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Upload className="w-4 h-4 text-cyan-400" /> Upload Artifact to Distributed Storage
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            type="text"
            placeholder="File name (e.g., student-roadmap-2026.pdf)"
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200"
          />

          <input
            type="text"
            placeholder="Artifact text content..."
            value={newFileContent}
            onChange={(e) => setNewFileContent(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200"
          />
        </div>

        <button
          onClick={handleUpload}
          disabled={uploading || !newFileName.trim()}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs transition shadow-lg shadow-cyan-500/20 disabled:opacity-50"
        >
          <Upload className="w-3.5 h-3.5" />
          Store Object (Replication Factor = 3)
        </button>
      </div>

      {/* Files List */}
      <div className="bg-slate-950/80 rounded-2xl border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400 font-mono text-[11px] uppercase tracking-wider">
                <th className="p-4">File Name</th>
                <th className="p-4">Storage Location (DFS URI)</th>
                <th className="p-4">Size</th>
                <th className="p-4">Replicas</th>
                <th className="p-4">Owner</th>
                <th className="p-4">Status</th>
                <th className="p-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {files.map((file) => (
                <tr key={file.fileId} className="hover:bg-slate-900/30 transition">
                  <td className="p-4 font-medium text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                    <span>{file.fileName}</span>
                  </td>
                  <td className="p-4 font-mono text-slate-400 text-[11px] truncate max-w-[220px]">
                    {file.storageLocation}
                  </td>
                  <td className="p-4 text-slate-300 font-mono">{(file.sizeBytes / 1024).toFixed(1)} KB</td>
                  <td className="p-4 text-purple-400 font-mono font-bold">x{file.replicationFactor}</td>
                  <td className="p-4 text-slate-400">{file.owner}</td>
                  <td className="p-4">
                    <span className="inline-flex items-center gap-1 text-emerald-400 text-xs">
                      <CheckCircle2 className="w-3 h-3" /> {file.status}
                    </span>
                  </td>
                  <td className="p-4">
                    <button
                      onClick={() => handleDelete(file.fileId)}
                      className="p-1.5 rounded hover:bg-rose-500/20 text-rose-400 transition"
                      title="Delete DFS object"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* DFS vs Local FS Comparative Guide */}
      <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-6 space-y-4 text-sm">
        <h3 className="font-bold text-white flex items-center gap-2">
          <Database className="w-4 h-4 text-cyan-400" />
          Distributed File Systems (DFS) vs. Local File Systems
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-400 leading-relaxed">
          <div className="p-4 bg-slate-950/70 rounded-xl border border-slate-800">
            <h4 className="font-semibold text-cyan-300 mb-1">Local File System (e.g. ext4, NTFS)</h4>
            <p>
              Tightly bound to single physical hard disk. Limited by local capacity. Single point of hardware failure. Direct POSIX read/write block operations.
            </p>
          </div>

          <div className="p-4 bg-slate-950/70 rounded-xl border border-slate-800">
            <h4 className="font-semibold text-emerald-300 mb-1">Distributed File System (HDFS, Ceph, S3)</h4>
            <p>
              Files partitioned into chunks and transparently replicated across multiple nodes (replication factor = 3). Offers high availability, fault tolerance, and global namespace.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
