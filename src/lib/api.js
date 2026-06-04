const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
export const AUTH_STORAGE_KEY = 'glucose-h5-auth';

let activeAuth = null;

export function getStoredAuthSession() {
  try {
    const rawValue = window.localStorage.getItem(AUTH_STORAGE_KEY);
    return rawValue ? JSON.parse(rawValue) : null;
  } catch {
    return null;
  }
}

export function setAuthSession(auth) {
  activeAuth = auth;
  try {
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
  } catch {
    // Some embedded webviews can block localStorage. The in-memory token still works until reload.
  }
}

export function clearAuthSession() {
  activeAuth = null;
  try {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {
    // Ignore storage cleanup failures.
  }
}

export function getAuthSession() {
  if (activeAuth) return activeAuth;
  activeAuth = getStoredAuthSession();
  return activeAuth;
}

async function requestJson(path, options = {}) {
  const auth = getAuthSession();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(auth?.token ? { Authorization: `Bearer ${auth.token}` } : {}),
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    let body = null;
    try {
      body = await response.json();
    } catch {
      body = { error: response.statusText };
    }
    const error = new Error(body?.error || 'API_REQUEST_FAILED');
    error.status = response.status;
    error.body = body;
    throw error;
  }

  if (response.status === 204) return null;
  return response.json();
}

async function requestForm(path, formData, options = {}) {
  const auth = getAuthSession();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(auth?.token ? { Authorization: `Bearer ${auth.token}` } : {}),
      ...(options.headers || {})
    },
    body: formData
  });

  if (!response.ok) {
    let body = null;
    try {
      body = await response.json();
    } catch {
      body = { error: response.statusText };
    }
    const error = new Error(body?.error || 'API_REQUEST_FAILED');
    error.status = response.status;
    error.body = body;
    throw error;
  }

  if (response.status === 204) return null;
  return response.json();
}

async function requestBlob(path) {
  const auth = getAuthSession();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      ...(auth?.token ? { Authorization: `Bearer ${auth.token}` } : {})
    }
  });

  if (!response.ok) {
    const error = new Error(response.statusText || 'API_REQUEST_FAILED');
    error.status = response.status;
    throw error;
  }

  return response.blob();
}

export async function registerAccount(payload) {
  return requestJson('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function loginAccount(payload) {
  return requestJson('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function getCaptchaChallenge() {
  return requestJson('/auth/captcha');
}

export async function getCurrentUser() {
  const result = await requestJson('/auth/me');
  return result.user;
}

export async function updateCurrentUserProfile(payload) {
  return requestJson('/auth/me', {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export async function listRecords() {
  const result = await requestJson('/records');
  return result.records;
}

export async function createRecordOnServer(record) {
  return requestJson('/records', {
    method: 'POST',
    body: JSON.stringify(record)
  });
}

export async function updateRecordOnServer(id, record) {
  return requestJson(`/records/${id}`, {
    method: 'PUT',
    body: JSON.stringify(record)
  });
}

export async function deleteRecordOnServer(id) {
  return requestJson(`/records/${id}`, {
    method: 'DELETE'
  });
}

export async function clearRecordsOnServer() {
  return requestJson('/records', {
    method: 'DELETE'
  });
}

export async function listBloodPressureRecords() {
  const result = await requestJson('/blood-pressure-records');
  return result.records;
}

export async function createBloodPressureRecordOnServer(record) {
  return requestJson('/blood-pressure-records', {
    method: 'POST',
    body: JSON.stringify(record)
  });
}

export async function updateBloodPressureRecordOnServer(id, record) {
  return requestJson(`/blood-pressure-records/${id}`, {
    method: 'PUT',
    body: JSON.stringify(record)
  });
}

export async function deleteBloodPressureRecordOnServer(id) {
  return requestJson(`/blood-pressure-records/${id}`, {
    method: 'DELETE'
  });
}

export async function clearBloodPressureRecordsOnServer() {
  return requestJson('/blood-pressure-records', {
    method: 'DELETE'
  });
}

export async function listFoodRecords() {
  const result = await requestJson('/food-records');
  return result.records;
}

export async function createFoodRecordOnServer(formData) {
  return requestForm('/food-records', formData, {
    method: 'POST'
  });
}

export async function updateFoodRecordOnServer(id, formData) {
  return requestForm(`/food-records/${id}`, formData, {
    method: 'PUT'
  });
}

export async function deleteFoodRecordOnServer(id) {
  return requestJson(`/food-records/${id}`, {
    method: 'DELETE'
  });
}

export async function clearFoodRecordsOnServer() {
  return requestJson('/food-records', {
    method: 'DELETE'
  });
}

export async function fetchFoodImageBlob(key) {
  return requestBlob(`/food-images/${key}`);
}
