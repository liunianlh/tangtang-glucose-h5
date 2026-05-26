const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
const ACTIVE_USER_ID = 'wife-user';

async function requestJson(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': ACTIVE_USER_ID,
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
