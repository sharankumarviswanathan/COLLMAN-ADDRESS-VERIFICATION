import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { Download, Trash2, Search, FileText, FileSpreadsheet, RefreshCw, ChevronLeft, ChevronRight, HardDrive } from 'lucide-react';

export function DownloadArea() {
  const [files, setFiles] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, limit: 15, totalPages: 1 });
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [fileTypeFilter, setFileTypeFilter] = useState('ALL');

  useEffect(() => {
    loadFiles();
  }, [pagination.page, categoryFilter, fileTypeFilter]);

  async function loadFiles() {
    setLoading(true);
    try {
      const params = {
        page: pagination.page,
        limit: pagination.limit
      };
      if (search.trim()) params.search = search.trim();
      if (categoryFilter !== 'ALL') params.category = categoryFilter;
      if (fileTypeFilter !== 'ALL') params.fileType = fileTypeFilter;

      const data = await api.downloads.list(params);
      setFiles(data.files || []);
      setPagination(data.pagination);
    } catch (err) {
      console.error('Download area load error:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleSearchSubmit(e) {
    if (e) e.preventDefault();
    setPagination((prev) => ({ ...prev, page: 1 }));
    loadFiles();
  }

  async function handleDownload(file) {
    try {
      const token = localStorage.getItem('collman_admin_token');
      const url = `/api/downloads/${file.id}/file${token ? `?token=${encodeURIComponent(token)}` : ''}`;

      const response = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });

      if (!response.ok) {
        throw new Error(`Download failed with status ${response.status}`);
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = file.file_name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      setTimeout(loadFiles, 800);
    } catch (err) {
      console.error('Download error:', err);
      window.location.href = api.downloads.getFileUrl(file.id);
    }
  }

  async function handleDelete(fileId, fileName) {
    if (!window.confirm(`Are you sure you want to delete ${fileName} from the Download Area?`)) {
      return;
    }

    try {
      await api.downloads.delete(fileId);
      loadFiles();
    } catch (err) {
      console.error('Delete error:', err);
      alert('Failed to delete file.');
    }
  }

  function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  return (
    <div className="admin-content">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '22px', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)', letterSpacing: '-0.02em', margin: 0 }}>
              Internal Download Area
            </h1>
            <span style={{ fontSize: '0.72rem', fontWeight: 600, backgroundColor: 'var(--primary-light)', color: 'var(--primary)', padding: '2px 8px', borderRadius: 'var(--radius-full)', border: '1px solid var(--primary-subtle)' }}>
              {pagination.total} Files
            </span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '3px' }}>
            Permanent audit vault for generated Address Verification PDF certificates, Excel exports, and audit summaries
          </p>
        </div>

        <button
          className="btn btn-secondary btn-sm"
          onClick={loadFiles}
          disabled={loading}
          style={{ boxShadow: 'var(--shadow-xs)', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>Refresh Files</span>
        </button>
      </div>

      {/* Filter / Search Bar */}
      <div className="table-container" style={{ marginBottom: '20px', padding: '14px 18px', boxShadow: 'var(--shadow-xs)' }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 260px' }}>
            <Search size={15} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              className="form-control"
              placeholder="Search by File Name, Reference, Emp ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: '36px', height: 38, fontSize: '0.86rem' }}
            />
          </div>

          <div style={{ minWidth: '180px' }}>
            <select
              className="form-control form-select"
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
              style={{ height: 38, fontSize: '0.86rem' }}
            >
              <option value="ALL">All Categories</option>
              <option value="Verification Report">Verification Report (PDF)</option>
              <option value="Bulk Upload Failures">Bulk Upload Failures</option>
              <option value="Analytics Report">Analytics Report</option>
              <option value="Audit Export">Audit Export</option>
            </select>
          </div>

          <div style={{ minWidth: '130px' }}>
            <select
              className="form-control form-select"
              value={fileTypeFilter}
              onChange={(e) => {
                setFileTypeFilter(e.target.value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
              style={{ height: 38, fontSize: '0.86rem' }}
            >
              <option value="ALL">All File Types</option>
              <option value="PDF">PDF Documents</option>
              <option value="Excel">Excel Sheets</option>
            </select>
          </div>

          <button type="submit" className="btn btn-primary btn-sm" style={{ height: 38, padding: '0 16px' }}>
            <Search size={14} />
            <span>Search</span>
          </button>
        </form>
      </div>

      {/* Files Table */}
      <div className="table-container">
        <div style={{ overflowX: 'auto' }}>
          <table className="custom-table">
            <thead>
              <tr>
                <th>Document / Artifact</th>
                <th>Category</th>
                <th>Format</th>
                <th>File Size</th>
                <th>Generated By</th>
                <th>Created At</th>
                <th>Downloads</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                      <RefreshCw size={22} className="animate-spin" color="var(--accent)" />
                      <span>Loading Download Area vault...</span>
                    </div>
                  </td>
                </tr>
              ) : files.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    <HardDrive size={36} color="var(--text-light)" style={{ margin: '0 auto 8px auto', display: 'block' }} />
                    <p style={{ fontWeight: 600 }}>No generated reports or export files found.</p>
                    <p style={{ fontSize: '0.8rem', marginTop: '4px' }}>Reports generated from the Reports tab or verified cases will appear here.</p>
                  </td>
                </tr>
              ) : (
                files.map((file) => (
                  <tr key={file.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: 34,
                          height: 34,
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: file.file_type === 'PDF' ? 'var(--danger-light)' : 'var(--success-light)',
                          color: file.file_type === 'PDF' ? 'var(--danger)' : 'var(--success)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          {file.file_type === 'PDF' ? <FileText size={18} /> : <FileSpreadsheet size={18} />}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.86rem' }}>{file.file_name}</div>
                          {file.reference_no && (
                            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: '2px' }}>
                              Ref: {file.reference_no} {file.employee_id ? `(${file.employee_id})` : ''}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-secondary" style={{ fontSize: '0.74rem' }}>{file.category}</span>
                    </td>
                    <td>
                      <span className={`badge ${file.file_type === 'PDF' ? 'badge-danger' : 'badge-success'}`} style={{ fontSize: '0.72rem' }}>
                        {file.file_type}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.84rem', fontVariantNumeric: 'tabular-nums' }}>{formatBytes(file.file_size)}</td>
                    <td style={{ fontSize: '0.84rem' }}>{file.generated_by || 'System'}</td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{file.created_at?.substring(0, 16)}</td>
                    <td style={{ fontSize: '0.84rem', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                      <span style={{ backgroundColor: 'var(--bg-subtle)', padding: '2px 7px', borderRadius: '4px' }}>
                        {file.download_count || 0}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => handleDownload(file)}
                          title="Download File to Computer"
                          style={{ padding: '5px 11px', fontSize: '0.78rem' }}
                        >
                          <Download size={13} />
                          <span>Download</span>
                        </button>

                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ color: 'var(--danger)', borderColor: 'var(--danger-border)', padding: '5px 9px', fontSize: '0.78rem' }}
                          onClick={() => handleDelete(file.id, file.file_name)}
                          title="Delete File Permanently"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div style={{
          padding: '12px 18px',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.85rem',
          color: 'var(--text-secondary)'
        }}>
          <div>
            Showing Page <strong>{pagination.page}</strong> of <strong>{pagination.totalPages || 1}</strong>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="btn btn-secondary btn-sm"
              disabled={pagination.page <= 1}
              onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
            >
              <ChevronLeft size={14} />
              <span>Previous</span>
            </button>

            <button
              className="btn btn-secondary btn-sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
            >
              <span>Next</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
