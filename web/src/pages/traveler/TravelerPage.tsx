import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { travelerApi } from '../../api/traveler';
import type { UpdateTravelerDto } from '../../api/traveler';
import { filesApi } from '../../api/files';
import type { FileKind } from '../../api/files';
import { FILE_KIND_LABELS } from '../../api/files';
import { jobsApi } from '../../api/jobs';
import { useAuthStore } from '../../store/auth';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function TravelerPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const qc = useQueryClient();

  const isOperator = user?.role === 'OPERATOR';
  const canEditAll = !isOperator;

  // Form state
  const [operatorNotes, setOperatorNotes] = useState('');
  const [notesEditing, setNotesEditing] = useState(false);
  const [newTool, setNewTool] = useState('');
  const [uploadKind, setUploadKind] = useState<FileKind>('BLUEPRINT');
  const [uploadError, setUploadError] = useState('');

  const { data: job } = useQuery({
    queryKey: ['jobs', jobId],
    queryFn: () => jobsApi.get(jobId!),
    enabled: !!jobId,
  });

  const { data: traveler, isLoading: travelerLoading } = useQuery({
    queryKey: ['traveler', jobId],
    queryFn: () => travelerApi.get(jobId!),
    enabled: !!jobId,
  });

  // Sync operator notes when traveler loads (only if not currently editing)
  useEffect(() => {
    if (traveler && !notesEditing) {
      setOperatorNotes(traveler.operatorNotes ?? '');
    }
  }, [traveler?.operatorNotes]); // notesEditing intentionally excluded

  const { data: files, isLoading: filesLoading } = useQuery({
    queryKey: ['files', jobId],
    queryFn: () => filesApi.list(jobId!),
    enabled: !!jobId,
  });

  const updateMutation = useMutation({
    mutationFn: (dto: UpdateTravelerDto) => travelerApi.update(jobId!, dto),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['traveler', jobId] });
      setNotesEditing(false);
    },
  });

  const addToolMutation = useMutation({
    mutationFn: (description: string) => travelerApi.addTool(jobId!, description),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['traveler', jobId] });
      setNewTool('');
    },
  });

  const removeToolMutation = useMutation({
    mutationFn: (toolId: string) => travelerApi.removeTool(jobId!, toolId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['traveler', jobId] });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: ({ file, kind }: { file: File; kind: FileKind }) =>
      filesApi.upload(jobId!, file, kind),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['files', jobId] });
      setUploadError('');
    },
    onError: (err: Error) => setUploadError(err.message),
  });

  const deleteFileMutation = useMutation({
    mutationFn: (fileId: string) => filesApi.remove(jobId!, fileId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['files', jobId] });
    },
  });

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadMutation.mutate({ file, kind: uploadKind });
    e.target.value = '';
  }

  if (travelerLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => void navigate('/jobs')}
          className="text-[var(--text-muted)] hover:text-[var(--text)] text-sm"
        >
          ← Jobs
        </button>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[var(--gold)] font-bold">{job?.jobNumber}</span>
            <h1 className="text-xl font-bold text-[var(--text)]">{job?.partName}</h1>
          </div>
          <p className="text-sm text-[var(--text-muted)]">Job Traveler / Routing Sheet</p>
        </div>
      </div>

      {traveler && (
        <>
          {/* Admin fields (not shown to OPERATOR) */}
          {canEditAll && (
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5">
              <h2 className="font-semibold text-[var(--text)] mb-4">Job Details</h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-[var(--text-muted)]">Run Time / Piece (hrs)</label>
                  <input
                    type="number"
                    step="0.01"
                    defaultValue={traveler.runTimePerPiece ?? ''}
                    onBlur={(e) =>
                      updateMutation.mutate({
                        runTimePerPiece: e.target.value ? parseFloat(e.target.value) : undefined,
                      })
                    }
                    className="px-3 py-2 rounded-md bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] text-sm outline-none focus:border-[var(--gold)]"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-[var(--text-muted)]">Labor Time (hrs)</label>
                  <input
                    type="number"
                    step="0.01"
                    defaultValue={traveler.laborTime ?? ''}
                    onBlur={(e) =>
                      updateMutation.mutate({
                        laborTime: e.target.value ? parseFloat(e.target.value) : undefined,
                      })
                    }
                    className="px-3 py-2 rounded-md bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] text-sm outline-none focus:border-[var(--gold)]"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-[var(--text-muted)]">Parts Scrapped</label>
                  <input
                    type="number"
                    min={0}
                    defaultValue={traveler.partsScrapped}
                    onBlur={(e) =>
                      updateMutation.mutate({ partsScrapped: parseInt(e.target.value) || 0 })
                    }
                    className="px-3 py-2 rounded-md bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] text-sm outline-none focus:border-[var(--gold)]"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-[var(--text-muted)]">Shop Location</label>
                  <input
                    type="text"
                    defaultValue={traveler.shopLocation ?? ''}
                    onBlur={(e) =>
                      updateMutation.mutate({ shopLocation: e.target.value || undefined })
                    }
                    placeholder="e.g. Rack A-3"
                    className="px-3 py-2 rounded-md bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] text-sm outline-none focus:border-[var(--gold)]"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-[var(--text-muted)]">Shipping Method</label>
                  <input
                    type="text"
                    defaultValue={traveler.shippingMethod ?? ''}
                    onBlur={(e) =>
                      updateMutation.mutate({ shippingMethod: e.target.value || undefined })
                    }
                    placeholder="e.g. UPS Ground"
                    className="px-3 py-2 rounded-md bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] text-sm outline-none focus:border-[var(--gold)]"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-[var(--text-muted)]">Job Cost ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    defaultValue={traveler.jobCost ?? ''}
                    onBlur={(e) =>
                      updateMutation.mutate({
                        jobCost: e.target.value ? parseFloat(e.target.value) : undefined,
                      })
                    }
                    className="px-3 py-2 rounded-md bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] text-sm outline-none focus:border-[var(--gold)]"
                  />
                </div>
                <div className="flex items-center gap-2 pt-5">
                  <input
                    type="checkbox"
                    id="matCert"
                    defaultChecked={traveler.materialCertRequired}
                    onChange={(e) =>
                      updateMutation.mutate({ materialCertRequired: e.target.checked })
                    }
                    className="w-4 h-4 accent-[var(--gold)]"
                  />
                  <label htmlFor="matCert" className="text-sm text-[var(--text)]">
                    Material Cert Required
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Tools list */}
          {canEditAll && (
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5">
              <h2 className="font-semibold text-[var(--text)] mb-4">Tools / Operations</h2>
              <div className="space-y-2 mb-4">
                {traveler.tools.map((tool) => (
                  <div
                    key={tool.id}
                    className="flex items-center justify-between bg-[var(--surface-2)] rounded-lg px-3 py-2"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-[var(--text-muted)] font-mono w-5">
                        {tool.position}
                      </span>
                      <span className="text-sm text-[var(--text)]">{tool.description}</span>
                    </div>
                    <button
                      onClick={() => removeToolMutation.mutate(tool.id)}
                      className="text-[var(--text-muted)] hover:text-[var(--danger)] text-sm transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {traveler.tools.length === 0 && (
                  <p className="text-sm text-[var(--text-muted)] py-2">
                    No tools/operations added yet.
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Add tool or operation…"
                  value={newTool}
                  onChange={(e) => setNewTool(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newTool.trim()) {
                      addToolMutation.mutate(newTool.trim());
                    }
                  }}
                  className="flex-1"
                />
                <Button
                  onClick={() => newTool.trim() && addToolMutation.mutate(newTool.trim())}
                  loading={addToolMutation.isPending}
                  disabled={!newTool.trim()}
                >
                  Add
                </Button>
              </div>
            </div>
          )}

          {/* Operator Notes */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-[var(--text)]">Operator Notes</h2>
              {!notesEditing && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setOperatorNotes(traveler.operatorNotes ?? '');
                    setNotesEditing(true);
                  }}
                >
                  Edit
                </Button>
              )}
            </div>
            {notesEditing ? (
              <div className="space-y-3">
                <textarea
                  value={operatorNotes}
                  onChange={(e) => setOperatorNotes(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 rounded-md bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] text-sm outline-none focus:border-[var(--gold)] resize-none"
                  placeholder="Notes from the shop floor…"
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setNotesEditing(false)}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    loading={updateMutation.isPending}
                    onClick={() => updateMutation.mutate({ operatorNotes })}
                  >
                    Save Notes
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-[var(--text)] whitespace-pre-wrap">
                {traveler.operatorNotes || (
                  <span className="text-[var(--text-muted)]">No notes yet.</span>
                )}
              </p>
            )}
          </div>

          {/* Files */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5">
            <h2 className="font-semibold text-[var(--text)] mb-4">Attachments</h2>

            {/* Upload */}
            <div className="flex items-center gap-3 mb-4">
              <select
                value={uploadKind}
                onChange={(e) => setUploadKind(e.target.value as FileKind)}
                className="px-3 py-2 rounded-md bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] text-sm outline-none focus:border-[var(--gold)]"
              >
                {(Object.keys(FILE_KIND_LABELS) as FileKind[]).map((k) => (
                  <option key={k} value={k}>
                    {FILE_KIND_LABELS[k]}
                  </option>
                ))}
              </select>
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={handleFileInput}
                  className="hidden"
                />
                <span className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm rounded-md bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)] hover:bg-[var(--surface-3)] transition-colors cursor-pointer">
                  {uploadMutation.isPending ? (
                    <>
                      <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      Uploading…
                    </>
                  ) : (
                    '+ Upload File'
                  )}
                </span>
              </label>
              {uploadError && <p className="text-xs text-[var(--danger)]">{uploadError}</p>}
            </div>

            {/* File list */}
            {filesLoading ? (
              <Spinner size="sm" />
            ) : (
              <div className="space-y-2">
                {(files ?? []).map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center justify-between bg-[var(--surface-2)] rounded-lg px-3 py-2"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-lg">
                        {f.mimeType === 'application/pdf' ? '📄' : '🖼️'}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm text-[var(--text)] truncate">{f.fileName}</p>
                        <p className="text-xs text-[var(--text-muted)]">
                          <Badge variant="gray">
                            <span className="text-[10px]">{FILE_KIND_LABELS[f.kind]}</span>
                          </Badge>{' '}
                          {formatBytes(f.sizeBytes)} · {f.uploadedByUser.name}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <a
                        href={filesApi.downloadUrl(jobId!, f.id)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-[var(--gold)] hover:text-[var(--gold-dark)]"
                      >
                        Download
                      </a>
                      {canEditAll && (
                        <button
                          onClick={() => deleteFileMutation.mutate(f.id)}
                          className="text-[var(--text-muted)] hover:text-[var(--danger)] text-sm transition-colors"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {(files ?? []).length === 0 && !filesLoading && (
                  <p className="text-sm text-[var(--text-muted)]">No files attached yet.</p>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
