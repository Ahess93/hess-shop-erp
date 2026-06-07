const BASE = '/api';

export type FileKind = 'BLUEPRINT' | 'SETUP_PHOTO' | 'JOB_PHOTO';

export interface FileAttachment {
  id: string;
  fileName: string;
  kind: FileKind;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  uploadedByUser: { id: string; name: string };
}

export const FILE_KIND_LABELS: Record<FileKind, string> = {
  BLUEPRINT: 'Blueprint',
  SETUP_PHOTO: 'Setup Photo',
  JOB_PHOTO: 'Job Photo',
};

export const filesApi = {
  list: async (jobId: string): Promise<FileAttachment[]> => {
    const res = await fetch(`${BASE}/jobs/${jobId}/files`, { credentials: 'include' });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      throw new Error(body.message ?? res.statusText);
    }
    return res.json() as Promise<FileAttachment[]>;
  },

  upload: async (jobId: string, file: File, kind: FileKind): Promise<FileAttachment> => {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${BASE}/jobs/${jobId}/files?kind=${kind}`, {
      method: 'POST',
      credentials: 'include',
      body: form,
      // Don't set Content-Type — browser sets it with boundary for multipart
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      throw new Error(body.message ?? res.statusText);
    }
    return res.json() as Promise<FileAttachment>;
  },

  downloadUrl: (jobId: string, fileId: string) => `${BASE}/jobs/${jobId}/files/${fileId}/download`,

  remove: async (jobId: string, fileId: string): Promise<void> => {
    const res = await fetch(`${BASE}/jobs/${jobId}/files/${fileId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      throw new Error(body.message ?? res.statusText);
    }
  },
};
