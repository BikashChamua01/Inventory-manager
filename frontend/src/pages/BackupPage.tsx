
import { useCallback, useEffect, useState } from 'react'
import {
     AlertCircle,
     CheckCircle2,
     Database,
     FileClock,
     HardDrive,
     LoaderCircle,
     RefreshCw,
     ShieldCheck,
     Trash2,
     X,
} from 'lucide-react'
import { apiRequest } from '../lib/api'
import './BackupPage.css'

type BackupFile = {
     fileName: string
     sizeBytes: number
     createdAt: string
}

type BackupStatus = {
     directory: string
     backups: BackupFile[]
     latest: BackupFile | null
}

type ApiResponse<T> = {
     success: boolean
     message?: string
     data: T
}

type RestoreResponse = {
     fileName: string
     safetyBackup: string
     status: string
}

function formatBytes(bytes: number): string {
     if (bytes < 1024) return `${bytes} B`
     if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
     return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function formatDate(value: string): string {
     const date = new Date(value)

     if (Number.isNaN(date.getTime())) return value

     return date.toLocaleString(undefined, {
          dateStyle: 'medium',
          timeStyle: 'short',
     })
}

export default function BackupPage() {
     const [status, setStatus] = useState<BackupStatus | null>(null)
     const [loading, setLoading] = useState(true)
     const [creating, setCreating] = useState(false)
     const [restoring, setRestoring] = useState(false)
     const [confirmOpen, setConfirmOpen] = useState(false)
     const [selectedBackup, setSelectedBackup] = useState<BackupFile | null>(null)
     const [error, setError] = useState('')
     const [success, setSuccess] = useState('')
     const [deletingBackup, setDeletingBackup] = useState<string | null>(null)

     const loadStatus = useCallback(async (showLoading = true) => {
          if (showLoading) setLoading(true)
          setError('')

          try {
               const response = await apiRequest<ApiResponse<BackupStatus>>(
                    '/backup/status',
               )

               if (!response.success) {
                    throw new Error('Could not load backup history.')
               }

               setStatus(response.data)
          } catch (err) {
               setError(
                    err instanceof Error
                         ? err.message
                         : 'Could not load backup history.',
               )
          } finally {
               if (showLoading) setLoading(false)
          }
     }, [])

     useEffect(() => {
          void loadStatus()
     }, [loadStatus])

     async function handleCreateBackup() {
          if (creating || restoring) return

          setCreating(true)
          setError('')
          setSuccess('')

          try {
               const response = await apiRequest<ApiResponse<BackupFile>>(
                    '/backup',
                    { method: 'POST' },
               )

               if (!response.success) {
                    throw new Error(response.message || 'Could not create the backup.')
               }

               setSuccess(`Backup created successfully: ${response.data.fileName}`)
               setConfirmOpen(false)
               await loadStatus(false)
          } catch (err) {
               setError(
                    err instanceof Error
                         ? err.message
                         : 'Could not create the backup.',
               )
          } finally {
               setCreating(false)
          }
     }

     async function handleRestoreBackup() {
          if (!selectedBackup || restoring || creating) return

          const backupToRestore = selectedBackup

          setRestoring(true)
          setError('')
          setSuccess('')

          try {
               const response = await apiRequest<ApiResponse<RestoreResponse>>(
                    '/backup/restore',
                    {
                         method: 'POST',
                         headers: {
                              'Content-Type': 'application/json',
                         },
                         body: JSON.stringify({
                              fileName: backupToRestore.fileName,
                         }),
                    },
               )

               if (!response.success) {
                    throw new Error(
                         response.message || 'Could not prepare the database restore.',
                    )
               }

               setSelectedBackup(null)
               setSuccess(
                    `Restore request accepted for ${response.data.fileName}. ` +
                    'The application should restart to complete restoration. ' +
                    `Safety backup: ${response.data.safetyBackup}`,
               )
          } catch (err) {
               setError(
                    err instanceof Error
                         ? err.message
                         : 'Could not prepare the database restore.',
               )
          } finally {
               setRestoring(false)
          }
     }

     function openConfirmation() {
          setError('')
          setSuccess('')
          setConfirmOpen(true)
     }

     function closeConfirmation() {
          if (!creating) setConfirmOpen(false)
     }

     function openRestoreConfirmation(backup: BackupFile) {
          setError('')
          setSuccess('')
          setSelectedBackup(backup)
     }

     function closeRestoreConfirmation() {
          if (!restoring) setSelectedBackup(null)
     }

     async function handleDeleteBackup(backup: BackupFile) {
          if (creating || restoring || deletingBackup) return

          const confirmed = window.confirm(
               `Permanently delete this backup?\n\n${backup.fileName}\n\nThis cannot be undone.`,
          )

          if (!confirmed) return

          setDeletingBackup(backup.fileName)
          setError('')
          setSuccess('')

          try {
               const response = await apiRequest<
                    ApiResponse<{ fileName: string }>
               >('/backup', {
                    method: 'DELETE',
                    headers: {
                         'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                         fileName: backup.fileName,
                    }),
               })

               if (!response.success) {
                    throw new Error(response.message || 'Could not delete backup.')
               }

               setSuccess(`Backup deleted: ${response.data.fileName}`)
               await loadStatus(false)
          } catch (err) {
               setError(
                    err instanceof Error
                         ? err.message
                         : 'Could not delete backup.',
               )
          } finally {
               setDeletingBackup(null)
          }
     }


     return (
          <div className="page-content backup-page">
               <div className="backup-page-heading">
                    <div>
                         <span className="backup-eyebrow">DATA PROTECTION</span>
                         <h1>Backup &amp; Restore</h1>
                         <p>
                              Create local copies of your inventory database and review your
                              backup history.
                         </p>
                    </div>

                    <button
                         type="button"
                         className="button button-secondary"
                         onClick={() => void loadStatus()}
                         disabled={loading || creating || restoring}
                    >
                         {loading ? (
                              <LoaderCircle size={17} className="backup-spin" />
                         ) : (
                              <RefreshCw size={17} />
                         )}
                         Refresh
                    </button>
               </div>

               {error && (
                    <div className="backup-alert backup-alert-error" role="alert">
                         <AlertCircle size={19} />
                         <span>{error}</span>
                    </div>
               )}

               {success && (
                    <div className="backup-alert backup-alert-success" role="status">
                         <CheckCircle2 size={19} />
                         <span>{success}</span>
                    </div>
               )}

               <section className="backup-summary-grid">
                    <article className="backup-card">
                         <div className="backup-card-icon">
                              <Database size={22} />
                         </div>

                         <div>
                              <p className="backup-card-label">Saved backups</p>
                              <h2>
                                   {loading && !status ? '—' : status?.backups.length ?? 0}
                              </h2>
                              <p className="backup-muted">Available local database copies</p>
                         </div>
                    </article>

                    <article className="backup-card">
                         <div className="backup-card-icon">
                              <FileClock size={22} />
                         </div>

                         <div>
                              <p className="backup-card-label">Latest backup</p>
                              <h2 className="backup-latest-value">
                                   {status?.latest
                                        ? formatDate(status.latest.createdAt)
                                        : 'None yet'}
                              </h2>
                              <p className="backup-muted">
                                   {status?.latest
                                        ? formatBytes(status.latest.sizeBytes)
                                        : 'Create a backup to protect your data'}
                              </p>
                         </div>
                    </article>
               </section>

               <section className="backup-panel">
                    <div className="backup-panel-heading">
                         <div>
                              <h2>Create a database backup</h2>
                              <p>
                                   Save a timestamped copy of your current inventory database.
                              </p>
                         </div>

                         <button
                              type="button"
                              className="button button-primary"
                              onClick={openConfirmation}
                              disabled={creating || restoring || loading}
                         >
                              <HardDrive size={17} />
                              Create Backup
                         </button>
                    </div>

                    <div className="backup-safety-note">
                         <ShieldCheck size={19} />
                         <div>
                              <strong>Your inventory data stays local</strong>
                              <p>
                                   Backups are stored on this computer. Creating a backup does not
                                   replace or reset your current database.
                              </p>
                         </div>
                    </div>

                    <div className="backup-location">
                         <span>Backup location</span>
                         <code>{status?.directory ?? 'Loading backup location…'}</code>
                    </div>
               </section>

               <section className="backup-panel">
                    <div className="backup-history-heading">
                         <div>
                              <h2>Backup history</h2>
                              <p>All database backups currently found in the backup folder.</p>
                         </div>

                         <span className="backup-count">
                              {status?.backups.length ?? 0}{' '}
                              {(status?.backups.length ?? 0) === 1 ? 'backup' : 'backups'}
                         </span>
                    </div>

                    {loading && !status ? (
                         <div className="backup-empty-state">
                              <LoaderCircle size={25} className="backup-spin" />
                              <p>Loading backup history…</p>
                         </div>
                    ) : status?.backups.length ? (
                         <div className="backup-table-wrap">
                              <table className="backup-table">
                                   <thead>
                                        <tr>
                                             <th>Backup file</th>
                                             <th>Date created</th>
                                             <th>Size</th>
                                             <th>Status</th>
                                             <th>Action</th>
                                        </tr>
                                   </thead>

                                   <tbody>
                                        {status.backups.map((backup) => (
                                             <tr key={backup.fileName}>
                                                  <td>
                                                       <div className="backup-file-cell">
                                                            <Database size={18} />
                                                            <span title={backup.fileName}>
                                                                 {backup.fileName}
                                                            </span>
                                                       </div>
                                                  </td>

                                                  <td>{formatDate(backup.createdAt)}</td>
                                                  <td>{formatBytes(backup.sizeBytes)}</td>

                                                  <td>
                                                       {backup.fileName === status.latest?.fileName ? (
                                                            <span className="backup-status-pill">Latest</span>
                                                       ) : (
                                                            <span className="backup-history-label">Saved</span>
                                                       )}
                                                  </td>


                                                  <td>
                                                       <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <button
                                                                 type="button"
                                                                 className="button button-secondary"
                                                                 disabled={restoring || creating || deletingBackup !== null}
                                                                 onClick={() => openRestoreConfirmation(backup)}
                                                            >
                                                                 Restore
                                                            </button>

                                                            <button
                                                                 type="button"
                                                                 className="button button-secondary"
                                                                 title={`Delete ${backup.fileName}`}
                                                                 aria-label={`Delete backup ${backup.fileName}`}
                                                                 disabled={restoring || creating || deletingBackup !== null}
                                                                 onClick={() => void handleDeleteBackup(backup)}
                                                                 style={{ color: '#dc2626', padding: '8px 10px' }}
                                                            >
                                                                 {deletingBackup === backup.fileName ? (
                                                                      <LoaderCircle size={17} className="backup-spin" />
                                                                 ) : (
                                                                      <Trash2 size={17} />
                                                                 )}
                                                            </button>
                                                       </div>
                                                  </td>

                                             </tr>
                                        ))}
                                   </tbody>
                              </table>
                         </div>
                    ) : (
                         <div className="backup-empty-state">
                              <Database size={30} />
                              <h3>No backups found</h3>
                              <p>Create your first backup to see it listed here.</p>
                         </div>
                    )}
               </section>

               <section className="backup-restore-note">
                    <AlertCircle size={19} />
                    <div>
                         <strong>Important: restoring replaces current inventory data</strong>
                         <p>
                              Before restoration, the application prepares a safety backup of
                              the current database. Restoration requires the application to
                              restart. Do not close the application during this process, and
                              keep your backup files safe.
                         </p>
                    </div>
               </section>

               {confirmOpen && (
                    <div
                         className="backup-modal-overlay"
                         onMouseDown={(event) => {
                              if (event.target === event.currentTarget) {
                                   closeConfirmation()
                              }
                         }}
                    >
                         <section
                              className="backup-modal"
                              role="dialog"
                              aria-modal="true"
                              aria-labelledby="backup-modal-title"
                              aria-describedby="backup-modal-description"
                         >
                              <button
                                   type="button"
                                   className="backup-modal-close"
                                   aria-label="Close confirmation"
                                   disabled={creating}
                                   onClick={closeConfirmation}
                              >
                                   <X size={20} />
                              </button>

                              <div className="backup-modal-icon">
                                   <Database size={27} />
                              </div>

                              <span className="backup-modal-eyebrow">
                                   DATABASE PROTECTION
                              </span>

                              <h2 id="backup-modal-title">Create database backup?</h2>

                              <p
                                   id="backup-modal-description"
                                   className="backup-modal-description"
                              >
                                   You're about to create a new copy of your inventory database.
                                   This operation may take some time and will use additional disk
                                   space.
                              </p>

                              <div className="backup-modal-info">
                                   <div className="backup-modal-info-row">
                                        <HardDrive size={19} />
                                        <div>
                                             <strong>Additional storage required</strong>
                                             <p>
                                                  A new backup file will be saved locally. Existing backups
                                                  will not be overwritten.
                                             </p>
                                        </div>
                                   </div>

                                   <div className="backup-modal-info-row">
                                        <ShieldCheck size={19} />
                                        <div>
                                             <strong>Your current inventory stays intact</strong>
                                             <p>
                                                  Creating a backup does not replace your active database.
                                             </p>
                                        </div>
                                   </div>
                              </div>

                              <div className="backup-modal-actions">
                                   <button
                                        type="button"
                                        className="button button-secondary"
                                        disabled={creating}
                                        onClick={closeConfirmation}
                                   >
                                        Cancel
                                   </button>

                                   <button
                                        type="button"
                                        className="button button-primary"
                                        disabled={creating}
                                        onClick={() => void handleCreateBackup()}
                                   >
                                        {creating ? (
                                             <LoaderCircle size={17} className="backup-spin" />
                                        ) : (
                                             <Database size={17} />
                                        )}
                                        {creating ? 'Creating backup…' : 'Confirm Backup'}
                                   </button>
                              </div>
                         </section>
                    </div>
               )}

               {selectedBackup && (
                    <div
                         className="backup-modal-overlay"
                         onMouseDown={(event) => {
                              if (event.target === event.currentTarget) {
                                   closeRestoreConfirmation()
                              }
                         }}
                    >
                         <section
                              className="backup-modal"
                              role="dialog"
                              aria-modal="true"
                              aria-labelledby="restore-modal-title"
                              aria-describedby="restore-modal-description"
                         >
                              <button
                                   type="button"
                                   className="backup-modal-close"
                                   aria-label="Close restore confirmation"
                                   disabled={restoring}
                                   onClick={closeRestoreConfirmation}
                              >
                                   <X size={20} />
                              </button>

                              <div className="backup-modal-icon">
                                   <AlertCircle size={27} />
                              </div>

                              <span className="backup-modal-eyebrow">DATABASE RESTORE</span>

                              <h2 id="restore-modal-title">Restore this backup?</h2>

                              <p
                                   id="restore-modal-description"
                                   className="backup-modal-description"
                              >
                                   This operation replaces the current inventory database with
                                   the selected backup. Recent changes made after that backup may
                                   be lost. The application should restart to complete restoration.
                              </p>

                              <div className="backup-modal-info">
                                   <div className="backup-modal-info-row">
                                        <Database size={19} />
                                        <div>
                                             <strong>Selected backup</strong>
                                             <p>{selectedBackup.fileName}</p>
                                        </div>
                                   </div>

                                   <div className="backup-modal-info-row">
                                        <ShieldCheck size={19} />
                                        <div>
                                             <strong>Safety backup</strong>
                                             <p>
                                                  A copy of the current database is prepared before
                                                  restoration begins.
                                             </p>
                                        </div>
                                   </div>
                              </div>

                              <div className="backup-modal-actions">
                                   <button
                                        type="button"
                                        className="button button-secondary"
                                        disabled={restoring}
                                        onClick={closeRestoreConfirmation}
                                   >
                                        Cancel
                                   </button>

                                   <button
                                        type="button"
                                        className="button button-primary"
                                        disabled={restoring}
                                        onClick={() => void handleRestoreBackup()}
                                   >
                                        {restoring ? (
                                             <LoaderCircle size={17} className="backup-spin" />
                                        ) : (
                                             <Database size={17} />
                                        )}
                                        {restoring ? 'Preparing restore…' : 'Confirm Restore'}
                                   </button>
                              </div>
                         </section>
                    </div>
               )}
          </div>
     )
}
