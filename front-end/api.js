// front-end/api.js
// Centralized RESTful API Client for Personnel Evaluation System
// Handles JWT Bearer token management, file uploads, and CRUD operations

const API_BASE_URL = 'http://localhost:2000/api';

// Core request wrapper supporting JWT authentication
export async function apiFetch(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  // If payload is FormData (file upload), let browser handle boundary
  if (options.body instanceof FormData) {
    delete headers['Content-Type'];
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers
  });

  const json = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = json.message || `Request failed with HTTP status ${response.status}`;
    const err = new Error(errorMsg);
    err.status = response.status;
    err.response = { data: json, status: response.status };
    throw err;
  }

  return json;
}

export const api = {
  // Authentication services
  auth: {
    login: (citizenId, password) => apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ citizenId, password })
    }),
    register: (userData) => apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData)
    }),
    getProfile: () => apiFetch('/auth/me')
  },

  // User management services (Admin & HR)
  users: {
    getAll: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return apiFetch(`/users${query ? `?${query}` : ''}`);
    },
    getByCitizenId: (citizenId) => apiFetch(`/users/${citizenId}`),
    create: (userData) => apiFetch('/users', {
      method: 'POST',
      body: JSON.stringify(userData)
    }),
    update: (citizenId, userData) => apiFetch(`/users/${citizenId}`, {
      method: 'PUT',
      body: JSON.stringify(userData)
    }),
    delete: (citizenId) => apiFetch(`/users/${citizenId}`, {
      method: 'DELETE'
    })
  },

  // HR & period management services
  hr: {
    getPeriod: () => apiFetch('/hr/period'),
    updatePeriod: (id, data) => apiFetch(`/hr/period/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
    getMetrics: (periodId = 1) => apiFetch(`/hr/metrics?periodId=${periodId}`),
    createMetric: (data) => apiFetch('/hr/metrics', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    deleteMetric: (id) => apiFetch(`/hr/metrics/${id}`, {
      method: 'DELETE'
    }),
    getAssignments: (periodId = 1) => apiFetch(`/hr/assignments?periodId=${periodId}`),
    createAssignment: (data) => apiFetch('/hr/assignments', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
    getStatistics: (periodId = 1) => apiFetch(`/hr/statistics?periodId=${periodId}`)
  },

  // Evaluatee (Candidate) self-service
  evaluatee: {
    getSheet: (periodId = 1) => apiFetch(`/evaluatee/sheet?periodId=${periodId}`),
    submitSelf: (periodId, scores) => apiFetch('/evaluatee/self-submit', {
      method: 'POST',
      body: JSON.stringify({ periodId, scores })
    }),
    updateProfile: (profileData) => apiFetch('/evaluatee/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData)
    })
  },

  // Evaluator (Judge) grading services
  judge: {
    getAssigned: (periodId = 1) => apiFetch(`/judge/assigned?periodId=${periodId}`),
    getGradingDetails: (assignmentId) => apiFetch(`/judge/grading/${assignmentId}`),
    submitScore: (assignmentId, payload) => apiFetch(`/judge/submit/${assignmentId}`, {
      method: 'POST',
      body: JSON.stringify(payload)
    })
  },

  // File upload service (PDFs & Images)
  upload: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiFetch('/upload', {
      method: 'POST',
      body: formData
    });
  }
};

export default api;

