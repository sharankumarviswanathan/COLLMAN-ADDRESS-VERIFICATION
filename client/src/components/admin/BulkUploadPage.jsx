import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BulkUploadModal } from './BulkUploadModal';
import { UploadCloud, FileSpreadsheet, ArrowRight } from 'lucide-react';

export function BulkUploadPage() {
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(true);

  return (
    <div className="admin-content">
      <div style={{ width: '100%', maxWidth: '600px', margin: '40px auto', textAlign: 'center', backgroundColor: 'var(--bg-card)', padding: 'clamp(24px, 4vw, 40px)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)', boxSizing: 'border-box' }}>
        <UploadCloud size={60} color="var(--primary)" style={{ margin: '0 auto 16px auto' }} />
        <h2 style={{ fontSize: '1.4rem', color: 'var(--primary)', marginBottom: '8px' }}>
          Bulk Employee Upload
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', marginBottom: '24px' }}>
          Upload Excel or CSV files with custom column mapping. Duplicate IDs are automatically checked against the Employee Master.
        </p>

        <button
          className="btn btn-primary btn-large"
          onClick={() => setIsModalOpen(true)}
        >
          <span>Launch Bulk Upload Wizard</span>
          <ArrowRight size={18} />
        </button>
      </div>

      <BulkUploadModal
        isOpen={isModalOpen}
        onClose={() => navigate('/admin/employees')}
        onUploadSuccess={() => navigate('/admin/employees')}
      />
    </div>
  );
}
