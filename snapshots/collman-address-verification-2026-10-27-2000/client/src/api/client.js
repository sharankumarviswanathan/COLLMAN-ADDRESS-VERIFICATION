// Centralized API client for Collman Services Address Verification

const API_BASE = '/api';

function getAdminHeaders() {
  const token = localStorage.getItem('collman_admin_token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

function getEmployeeHeaders() {
  const sessionToken = sessionStorage.getItem('collman_emp_session');
  const headers = { 'Content-Type': 'application/json' };
  if (sessionToken) {
    headers['x-employee-session'] = sessionToken;
  }
  return headers;
}

async function request(url, options = {}) {
  try {
    const res = await fetch(`${API_BASE}${url}`, options);
    const contentType = res.headers.get('content-type');
    let data;
    if (contentType && contentType.includes('application/json')) {
      data = await res.json();
    } else {
      data = await res.text();
    }

    if (!res.ok) {
      const errorMsg = data && data.error ? data.error : (typeof data === 'string' ? data : 'An error occurred.');
      const err = new Error(errorMsg);
      err.status = res.status;
      err.data = data;
      throw err;
    }

    return data;
  } catch (err) {
    throw err;
  }
}

export const api = {
  // --- Employee Common Link Verification ---
  verify: {
    validateTl: (tlId) =>
      request('/verify/validate-tl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tlId })
      }),

    validateId: (payload) => {
      const body = typeof payload === 'object' && payload !== null
        ? payload
        : { employeeId: payload };
      return request('/verify/validate-id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
    },

    getProgress: () =>
      request('/verify/progress', {
        method: 'GET',
        headers: getEmployeeHeaders()
      }),

    saveDetails: (confirmed, correctionRemark) =>
      request('/verify/save-details', {
        method: 'POST',
        headers: getEmployeeHeaders(),
        body: JSON.stringify({ confirmed, correctionRemark })
      }),

    saveAddress: (isSame, differenceReason, newAddress) =>
      request('/verify/save-address', {
        method: 'POST',
        headers: getEmployeeHeaders(),
        body: JSON.stringify({ isSame, differenceReason, newAddress })
      }),

    saveResidence: (residenceType, stayingSinceMonth, stayingSinceYear) =>
      request('/verify/save-residence', {
        method: 'POST',
        headers: getEmployeeHeaders(),
        body: JSON.stringify({ residenceType, stayingSinceMonth, stayingSinceYear })
      }),

    saveLocation: (latitude, longitude, accuracy) =>
      request('/verify/save-location', {
        method: 'POST',
        headers: getEmployeeHeaders(),
        body: JSON.stringify({ latitude, longitude, accuracy })
      }),

    searchAddress: (query) =>
      request(`/verify/search-address?query=${encodeURIComponent(query)}`, {
        method: 'GET',
        headers: getEmployeeHeaders()
      }),

    uploadSelfie: (imageBase64, meta = {}) =>
      request('/verify/upload-selfie', {
        method: 'POST',
        headers: getEmployeeHeaders(),
        body: JSON.stringify(typeof imageBase64 === 'object' ? imageBase64 : { imageBase64, ...meta })
      }),

    uploadHousePhoto: (imageBase64, meta = {}) =>
      request('/verify/upload-house-photo', {
        method: 'POST',
        headers: getEmployeeHeaders(),
        body: JSON.stringify(typeof imageBase64 === 'object' ? imageBase64 : { imageBase64, ...meta })
      }),

    uploadStreetPhoto: (imageBase64, meta = {}) =>
      request('/verify/upload-street-photo', {
        method: 'POST',
        headers: getEmployeeHeaders(),
        body: JSON.stringify(typeof imageBase64 === 'object' ? imageBase64 : { imageBase64, ...meta })
      }),

    uploadLandmarkPhoto: (imageBase64, meta = {}) =>
      request('/verify/upload-landmark-photo', {
        method: 'POST',
        headers: getEmployeeHeaders(),
        body: JSON.stringify(typeof imageBase64 === 'object' ? imageBase64 : { imageBase64, ...meta })
      }),

    uploadDoorPhoto: (imageBase64, meta = {}) =>
      request('/verify/upload-door-photo', {
        method: 'POST',
        headers: getEmployeeHeaders(),
        body: JSON.stringify(typeof imageBase64 === 'object' ? imageBase64 : { imageBase64, ...meta })
      }),

    uploadJointSelfie: (imageBase64, meta = {}) =>
      request('/verify/upload-joint-selfie', {
        method: 'POST',
        headers: getEmployeeHeaders(),
        body: JSON.stringify(typeof imageBase64 === 'object' ? imageBase64 : { imageBase64, ...meta })
      }),

    getTlList: () =>
      request('/verify/tl-list', {
        method: 'GET',
        headers: getEmployeeHeaders()
      }),

    validateImage: (imageBase64, photoType, hrAddress = '', clientMetrics = {}) =>
      request('/verify/validate-image', {
        method: 'POST',
        headers: getEmployeeHeaders(),
        body: JSON.stringify({ imageBase64, photoType, hrAddress, clientMetrics })
      }),

    validateAddressProof: async (payload) => {
      const formData = new FormData();
      if (payload.documentType) formData.append('documentType', payload.documentType);
      if (payload.side) formData.append('side', payload.side);
      if (payload.frontFile) formData.append('front', payload.frontFile);
      if (payload.backFile) formData.append('back', payload.backFile);
      if (payload.frontBase64) formData.append('frontBase64', payload.frontBase64);
      if (payload.backBase64) formData.append('backBase64', payload.backBase64);
      if (payload.frontMetrics) formData.append('frontMetrics', JSON.stringify(payload.frontMetrics));
      if (payload.backMetrics) formData.append('backMetrics', JSON.stringify(payload.backMetrics));

      const sessionToken = sessionStorage.getItem('collman_emp_session');
      const headers = {};
      if (sessionToken) headers['x-employee-session'] = sessionToken;

      const res = await fetch(`${API_BASE}/verify/validate-address-proof`, {
        method: 'POST',
        headers,
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Address proof validation failed');
      return data;
    },

    uploadDocument: async (docDataOrType, maybeFile) => {
      const formData = new FormData();
      if (typeof docDataOrType === 'string') {
        formData.append('documentType', docDataOrType);
        if (maybeFile) formData.append('document', maybeFile);
      } else if (docDataOrType instanceof FormData) {
        for (const [k, v] of docDataOrType.entries()) {
          formData.append(k, v);
        }
      } else if (typeof docDataOrType === 'object') {
        if (docDataOrType.documentType) formData.append('documentType', docDataOrType.documentType);
        if (docDataOrType.frontFile) formData.append('front', docDataOrType.frontFile);
        if (docDataOrType.backFile) formData.append('back', docDataOrType.backFile);
        if (docDataOrType.frontBase64) formData.append('frontBase64', docDataOrType.frontBase64);
        if (docDataOrType.backBase64) formData.append('backBase64', docDataOrType.backBase64);
        if (docDataOrType.document) formData.append('document', docDataOrType.document);
      }

      const sessionToken = sessionStorage.getItem('collman_emp_session');
      const headers = {};
      if (sessionToken) headers['x-employee-session'] = sessionToken;

      const res = await fetch(`${API_BASE}/verify/upload-document`, {
        method: 'POST',
        headers,
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to upload document');
      return data;
    },

    saveDeclaration: (accepted) =>
      request('/verify/save-declaration', {
        method: 'POST',
        headers: getEmployeeHeaders(),
        body: JSON.stringify({ accepted })
      }),

    submit: () =>
      request('/verify/submit', {
        method: 'POST',
        headers: getEmployeeHeaders()
      })
  },

  // --- HR / Admin Auth ---
  auth: {
    login: (username, password) =>
      request('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      }),

    me: () =>
      request('/auth/me', {
        method: 'GET',
        headers: getAdminHeaders()
      }),

    changePassword: (currentPassword, newPassword) =>
      request('/auth/change-password', {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({ currentPassword, newPassword })
      })
  },

  // --- Employee Master & Bulk Upload ---
  employees: {
    list: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return request(`/employees?${query}`, {
        headers: getAdminHeaders()
      });
    },

    get: (id) =>
      request(`/employees/${id}`, {
        headers: getAdminHeaders()
      }),

    create: (data) =>
      request('/employees', {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify(data)
      }),

    update: (id, data) =>
      request(`/employees/${id}`, {
        method: 'PUT',
        headers: getAdminHeaders(),
        body: JSON.stringify(data)
      }),

    parseBulkFile: async (file) => {
      const formData = new FormData();
      formData.append('file', file);
      const token = localStorage.getItem('collman_admin_token');
      const res = await fetch(`${API_BASE}/employees/parse-bulk-file`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to parse file');
      return data;
    },

    processBulkUpload: (filePath, columnMapping) =>
      request('/employees/process-bulk-upload', {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({ filePath, columnMapping })
      }),

    downloadSampleTemplate: async (format = 'xlsx') => {
      const token = localStorage.getItem('collman_admin_token');
      const res = await fetch(`${API_BASE}/employees/sample-template?format=${format}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (!res.ok) throw new Error('Failed to download employee sample file.');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Collman_Employee_Bulk_Upload_Sample.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    },

    delete: (id) =>
      request(`/employees/${id}`, {
        method: 'DELETE',
        headers: getAdminHeaders()
      })
  },

  // --- BGV Queue ---
  queue: {
    list: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return request(`/queue?${query}`, {
        headers: getAdminHeaders()
      });
    },

    assign: (caseReferences, employeeIds, reviewerId) =>
      request('/queue/assign', {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({ caseReferences, employeeIds, reviewerId })
      }),

    delete: (caseRefOrEmpId, deleteEmployee = false) =>
      request(`/queue/${caseRefOrEmpId}${deleteEmployee ? '?deleteEmployee=true' : ''}`, {
        method: 'DELETE',
        headers: getAdminHeaders()
      })
  },

  // --- Case Review Workspace ---
  review: {
    getCase: (caseRefOrEmpId) =>
      request(`/review/${caseRefOrEmpId}`, {
        headers: getAdminHeaders()
      }),

    submitDecision: (caseRefOrEmpId, decision, remarks, failureReason) =>
      request(`/review/${caseRefOrEmpId}/decision`, {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({ decision, remarks, failureReason })
      }),

    generateReport: (caseRefOrEmpId) =>
      request(`/review/${caseRefOrEmpId}/generate-report`, {
        method: 'POST',
        headers: getAdminHeaders()
      }),

    geocodeHr: (caseRefOrEmpId) =>
      request(`/review/${caseRefOrEmpId}/geocode-hr`, {
        method: 'POST',
        headers: getAdminHeaders()
      }),

    matchDocumentAddress: (caseRefOrEmpId) =>
      request(`/review/${caseRefOrEmpId}/match-document-address`, {
        method: 'POST',
        headers: getAdminHeaders()
      }),

    updateHrLocation: (caseRefOrEmpId, latitude, longitude, reason) =>
      request(`/review/${caseRefOrEmpId}/update-hr-location`, {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({ latitude, longitude, reason })
      })
  },

  // --- Internal Download Area ---
  downloads: {
    list: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return request(`/downloads?${query}`, {
        headers: getAdminHeaders()
      });
    },

    getFileUrl: (id) => {
      const token = localStorage.getItem('collman_admin_token');
      return `/api/downloads/${id}/file${token ? `?token=${encodeURIComponent(token)}` : ''}`;
    },

    delete: (id) =>
      request(`/downloads/${id}`, {
        method: 'DELETE',
        headers: getAdminHeaders()
      })
  },

  // --- Masters & Settings ---
  masters: {
    getStats: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return request(`/masters/dashboard-stats?${query}`, {
        headers: getAdminHeaders()
      });
    },

    getAll: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return request(`/masters/all${query ? `?${query}` : ''}`, {
        headers: getAdminHeaders()
      });
    },

    lookupLocation: (query) =>
      request(`/masters/lookup-location?query=${encodeURIComponent(query)}`, {
        headers: getAdminHeaders()
      }),

    getTeamLeadersByManager: (managerId) =>
      request(`/masters/team-leaders?managerId=${encodeURIComponent(managerId)}`, {
        headers: getAdminHeaders()
      }),

    createBranch: (data) =>
      request('/masters/branches', {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify(data)
      }),

    updateBranch: (id, data) =>
      request(`/masters/branches/${id}`, {
        method: 'PUT',
        headers: getAdminHeaders(),
        body: JSON.stringify(data)
      }),

    deleteBranch: (id) =>
      request(`/masters/branches/${id}`, {
        method: 'DELETE',
        headers: getAdminHeaders()
      }),

    getBranchLocations: (branchId, params = {}) => {
      const query = new URLSearchParams(params).toString();
      return request(`/masters/branches/${branchId}/locations${query ? `?${query}` : ''}`, {
        headers: getAdminHeaders()
      });
    },

    getLocations: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return request(`/masters/locations${query ? `?${query}` : ''}`, {
        headers: getAdminHeaders()
      });
    },

    createLocation: (data) =>
      request('/masters/locations', {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify(data)
      }),

    updateLocation: (id, data) =>
      request(`/masters/locations/${id}`, {
        method: 'PUT',
        headers: getAdminHeaders(),
        body: JSON.stringify(data)
      }),

    deleteLocation: (id) =>
      request(`/masters/locations/${id}`, {
        method: 'DELETE',
        headers: getAdminHeaders()
      }),

    createDepartment: (data) =>
      request('/masters/departments', {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify(data)
      }),

    updateDepartment: (id, data) =>
      request(`/masters/departments/${id}`, {
        method: 'PUT',
        headers: getAdminHeaders(),
        body: JSON.stringify(data)
      }),

    deleteDepartment: (id) =>
      request(`/masters/departments/${id}`, {
        method: 'DELETE',
        headers: getAdminHeaders()
      }),

    createDesignation: (data) =>
      request('/masters/designations', {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify(data)
      }),

    updateDesignation: (id, data) =>
      request(`/masters/designations/${id}`, {
        method: 'PUT',
        headers: getAdminHeaders(),
        body: JSON.stringify(data)
      }),

    deleteDesignation: (id) =>
      request(`/masters/designations/${id}`, {
        method: 'DELETE',
        headers: getAdminHeaders()
      }),

    updateSettings: (settings) =>
      request('/masters/settings', {
        method: 'PUT',
        headers: getAdminHeaders(),
        body: JSON.stringify({ settings })
      })
  },

  // --- Reports ---
  reports: {
    generate: (payload) =>
      request('/reports/generate', {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify(payload)
      })
  },

  // --- Audit Logs ---
  audit: {
    list: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return request(`/audit?${query}`, {
        headers: getAdminHeaders()
      });
    },

    export: () =>
      request('/audit/export', {
        method: 'POST',
        headers: getAdminHeaders()
      })
  },

  // --- User Management ---
  users: {
    list: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return request(`/users${query ? `?${query}` : ''}`, {
        headers: getAdminHeaders()
      });
    },

    create: (data) =>
      request('/users', {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify(data)
      }),

    update: (id, data) =>
      request(`/users/${id}`, {
        method: 'PUT',
        headers: getAdminHeaders(),
        body: JSON.stringify(data)
      }),

    delete: (id) =>
      request(`/users/${id}`, {
        method: 'DELETE',
        headers: getAdminHeaders()
      }),

    exportUsers: async (format = 'xlsx', params = {}) => {
      const token = localStorage.getItem('collman_admin_token');
      const queryParams = new URLSearchParams({ format, ...params }).toString();
      const res = await fetch(`${API_BASE}/users/export?${queryParams}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to export user list.');
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const dateStr = new Date().toISOString().split('T')[0];
      a.download = `Collman_Users_Directory_${dateStr}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    },

    downloadSampleTemplate: async (format = 'xlsx') => {
      const token = localStorage.getItem('collman_admin_token');
      const res = await fetch(`${API_BASE}/users/sample-template?format=${format}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (!res.ok) throw new Error('Failed to download sample file.');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Collman_User_Bulk_Upload_Sample.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    },

    parseBulkFile: async (file) => {
      const formData = new FormData();
      formData.append('file', file);
      const token = localStorage.getItem('collman_admin_token');
      const res = await fetch(`${API_BASE}/users/parse-bulk-file`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to parse file');
      return data;
    },

    processBulkUpload: (filePath, columnMapping) =>
      request('/users/process-bulk-upload', {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({ filePath, columnMapping })
      })
  },

  // --- Roles & Permissions ---
  roles: {
    list: () =>
      request('/roles', {
        headers: getAdminHeaders()
      }),

    getPermissionsCatalog: () =>
      request('/roles/permissions-catalog', {
        headers: getAdminHeaders()
      }),

    create: (data) =>
      request('/roles', {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify(data)
      }),

    update: (id, data) =>
      request(`/roles/${id}`, {
        method: 'PUT',
        headers: getAdminHeaders(),
        body: JSON.stringify(data)
      }),

    delete: (id, options = {}) => {
      const queryParams = new URLSearchParams();
      if (options.reassign_to) queryParams.set('reassign_to', options.reassign_to);
      if (options.force) queryParams.set('force', options.force);
      if (options.action) queryParams.set('action', options.action);
      const qs = queryParams.toString();
      return request(`/roles/${id}${qs ? `?${qs}` : ''}`, {
        method: 'DELETE',
        headers: getAdminHeaders(),
        body: JSON.stringify(options)
      });
    }
  }
};
