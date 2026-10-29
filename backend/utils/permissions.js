// Standardized Enterprise Permissions Catalog for Collman Address Verification BGV Portal

const SYSTEM_PERMISSIONS = [
  {
    category: 'Dashboard & Analytics',
    module_key: 'dashboard',
    description: 'System-wide summary metrics, SLA turnaround rates, and case analytics',
    permissions: [
      { key: 'view_dashboard', label: 'View Dashboard Metrics', action: 'View', description: 'Access dashboard summary metrics, SLA trackers, and verification counts' },
      { key: 'export_dashboard', label: 'Export Analytics', action: 'Export', description: 'Export summary statistics and operational reports to Excel' }
    ]
  },
  {
    category: 'Employee Master',
    module_key: 'employees',
    description: 'Employee candidate registry, contact records, HR addresses, and onboarding roster',
    permissions: [
      { key: 'view_employees', label: 'View Employee Master', action: 'View', description: 'Browse employee list and verification history' },
      { key: 'create_employee', label: 'Register New Employees', action: 'Create', description: 'Add new candidate / employee records for address verification' },
      { key: 'edit_employee', label: 'Edit Employee Details', action: 'Edit', description: 'Update employee contact and HR address details' },
      { key: 'delete_employee', label: 'Delete Employees', action: 'Delete', description: 'Remove or archive employee records and associated verification data' },
      { key: 'upload_employees', label: 'Upload Bulk Candidate Rosters', action: 'Upload', description: 'Upload Excel/CSV batch candidate lists (Bulk Upload)' },
      { key: 'export_employees', label: 'Export Employee Directory', action: 'Export', description: 'Export filtered employee master roster to Excel' },
      { key: 'assign_employee', label: 'Assign Reviewer to Employee', action: 'Assign', description: 'Assign or reassign verification cases directly from Employee Master' }
    ]
  },
  {
    category: 'Verification Queue & Case Review',
    module_key: 'queue',
    description: 'Active candidate submissions, GPS geolocation matching, evidence inspection, and decisions',
    permissions: [
      { key: 'view_queue', label: 'View Verification Queue', action: 'View', description: 'Access and filter candidate verification queue and reverification cases' },
      { key: 'review_cases', label: 'Conduct Case Review', action: 'Review', description: 'Inspect photo evidence, GPS maps, and address proof documents' },
      { key: 'approve_cases', label: 'Approve BGV Cases', action: 'Approve', description: 'Render approval decisions and mark address verification as Verified' },
      { key: 'reject_cases', label: 'Reject / Fail BGV Cases', action: 'Reject', description: 'Render rejection decisions: Mark Verification Failed or Reverification Required' },
      { key: 'assign_reviewer', label: 'Assign Cases to Reviewers', action: 'Assign', description: 'Assign or reassign verification cases to team members' },
      { key: 'delete_cases', label: 'Delete Case Records', action: 'Delete', description: 'Remove verification cases from active queue' },
      { key: 'export_queue', label: 'Export Queue to Excel', action: 'Export', description: 'Export active verification queue records to Excel' },
      { key: 'download_case_report', label: 'Download Case PDF Certificate', action: 'Download', description: 'Generate and download official PDF verification certificate for a case' }
    ]
  },
  {
    category: 'Reports & Downloads Area',
    module_key: 'reports',
    description: 'Branch summaries, compliance reports, and permanent download vault for certificates',
    permissions: [
      { key: 'view_reports', label: 'View BGV Reports', action: 'View', description: 'Access reporting console and view custom branch/status report summaries' },
      { key: 'export_reports', label: 'Export Reports to Excel', action: 'Export', description: 'Export generated reports and audit summaries to Excel files' },
      { key: 'download_reports', label: 'Download Official PDF Reports', action: 'Download', description: 'Download official BGV Address Verification PDF certificates from Download Area' },
      { key: 'delete_reports', label: 'Delete Generated Reports', action: 'Delete', description: 'Remove archived PDF reports and exports from internal download area' }
    ]
  },
  {
    category: 'Masters & SLA Settings',
    module_key: 'masters',
    description: 'Company branches, departments, acceptable document proof types, and SLA turnaround parameters',
    permissions: [
      { key: 'view_masters', label: 'View Master Registry', action: 'View', description: 'Browse organizational branches, departments, doc types, and SLAs' },
      { key: 'create_masters', label: 'Create Master Entities', action: 'Create', description: 'Add new branches, departments, and acceptable document proof types' },
      { key: 'edit_masters', label: 'Edit Master Entities', action: 'Edit', description: 'Update names, codes, and states for branches, departments, and doc types' },
      { key: 'delete_masters', label: 'Delete Master Entities', action: 'Delete', description: 'Remove or archive master entities' },
      { key: 'manage_settings', label: 'Manage System Settings', action: 'Manage Settings', description: 'Configure SLA turnaround days, GPS thresholds, photo capture rules, and API keys' }
    ]
  },
  {
    category: 'User Management & Access Control',
    module_key: 'users',
    description: 'Internal admin / reviewer credentials, custom enterprise roles, and permission assignments',
    permissions: [
      { key: 'view_users', label: 'View User Accounts', action: 'View', description: 'Access user directory and credential listings' },
      { key: 'create_user', label: 'Create User Accounts', action: 'Create', description: 'Register new internal user accounts with credentials' },
      { key: 'edit_user', label: 'Edit User Accounts', action: 'Edit', description: 'Update user profile details, employee IDs, branch, and credentials' },
      { key: 'activate_user', label: 'Activate User Accounts', action: 'Activate', description: 'Reactivate suspended or deactivated user accounts' },
      { key: 'deactivate_user', label: 'Deactivate User Accounts', action: 'Deactivate', description: 'Suspend user accounts to prevent portal login' },
      { key: 'delete_user', label: 'Delete User Accounts', action: 'Delete', description: 'Permanently remove internal user accounts' },
      { key: 'manage_roles', label: 'Create & Manage Roles', action: 'Create', description: 'Create new custom enterprise roles and edit role metadata' },
      { key: 'manage_permissions', label: 'Manage Role Permissions', action: 'Manage Permissions', description: 'Grant or remove granular module permissions for each role' }
    ]
  },
  {
    category: 'Audit & Compliance',
    module_key: 'audit',
    description: 'Immutable security event history, tamper-evident action logs, and compliance exports',
    permissions: [
      { key: 'view_audit_logs', label: 'View Audit Trail', action: 'View Audit Logs', description: 'Inspect system tamper-evident security and activity logs' },
      { key: 'export_audit_logs', label: 'Export Audit Logs', action: 'Export', description: 'Export security audit records to Excel or CSV format' }
    ]
  }
];

// All flat keys in current catalog
const ALL_PERMISSION_KEYS = SYSTEM_PERMISSIONS.flatMap(c => c.permissions.map(p => p.key));

// Legacy compatibility keys
const LEGACY_PERMISSION_KEYS = ['make_decision', 'bulk_upload', 'manage_masters', 'manage_users'];
const FULL_PERMISSION_KEYS = Array.from(new Set([...ALL_PERMISSION_KEYS, ...LEGACY_PERMISSION_KEYS]));

// Default role permission assignments
const DEFAULT_ROLE_PERMISSIONS = {
  'Super Admin': FULL_PERMISSION_KEYS,
  'HR/Admin': [
    'view_dashboard',
    'export_dashboard',
    'view_queue',
    'assign_reviewer',
    'export_queue',
    'view_employees',
    'create_employee',
    'edit_employee',
    'delete_employee',
    'upload_employees',
    'bulk_upload',
    'export_employees',
    'assign_employee',
    'view_reports',
    'export_reports',
    'download_reports',
    'view_masters',
    'create_masters',
    'edit_masters',
    'delete_masters',
    'manage_masters',
    'manage_settings',
    'view_users',
    'create_user',
    'edit_user',
    'activate_user',
    'deactivate_user',
    'manage_users',
    'manage_roles',
    'manage_permissions',
    'view_audit_logs',
    'export_audit_logs'
  ],
  'BGV Reviewer': [
    'view_dashboard',
    'view_queue',
    'review_cases',
    'approve_cases',
    'reject_cases',
    'make_decision',
    'download_case_report',
    'view_employees',
    'view_reports',
    'download_reports'
  ],
  'Team Leader': [
    'view_dashboard',
    'export_dashboard',
    'view_queue',
    'review_cases',
    'approve_cases',
    'reject_cases',
    'make_decision',
    'download_case_report',
    'export_queue',
    'view_employees',
    'view_reports',
    'download_reports'
  ],
  'View Only': [
    'view_dashboard',
    'view_queue',
    'view_employees',
    'view_reports',
    'download_reports'
  ]
};

const DEFAULT_ROLES = [
  {
    role_name: 'Super Admin',
    role_code: 'SUPER_ADMIN',
    description: 'Full unconstrained administrative privileges across all system configurations, user credentials, and review workflows',
    badge_color: 'primary',
    is_system: 1
  },
  {
    role_name: 'HR/Admin',
    role_code: 'HR_ADMIN',
    description: 'Human Resources operations, candidate on-boarding, bulk roster uploads, master entity management, and verification reports',
    badge_color: 'info',
    is_system: 1
  },
  {
    role_name: 'BGV Reviewer',
    role_code: 'BGV_REVIEWER',
    description: 'Background verification specialist performing photo evidence auditing, GPS map evaluation, and rendering approval decisions',
    badge_color: 'warning',
    is_system: 1
  },
  {
    role_name: 'Team Leader',
    role_code: 'TEAM_LEADER',
    description: 'Operations Team Leader supervising verification workflows, reviewing assigned cases, and monitoring SLA metrics',
    badge_color: 'success',
    is_system: 0
  },
  {
    role_name: 'View Only',
    role_code: 'VIEW_ONLY',
    description: 'Auditor or stakeholder access to monitor verification statuses and download generated compliance certificates without edit rights',
    badge_color: 'secondary',
    is_system: 1
  }
];

module.exports = {
  SYSTEM_PERMISSIONS,
  ALL_PERMISSION_KEYS,
  FULL_PERMISSION_KEYS,
  DEFAULT_ROLES,
  DEFAULT_ROLE_PERMISSIONS
};
