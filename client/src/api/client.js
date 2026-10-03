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
    validateId: (employeeId) =>
      request('/verify/validate-id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId })
      }),

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

    getAll: () =>
      request('/masters/all', {
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
    list: () =>
      request('/users', {
        headers: getAdminHeaders()
      }),

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
      })
  }
};
