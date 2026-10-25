const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

export class ApiError extends Error {
  constructor(status, code, message, fields = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}/api/v1${path}`, {
      ...options,
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Không thể kết nối máy chủ.');
  }

  if (response.status === 204) return null;

  let body;
  try {
    body = await response.json();
  } catch {
    throw new ApiError(response.status, 'INVALID_RESPONSE', 'Máy chủ trả dữ liệu không hợp lệ.');
  }

  if (!response.ok) {
    const error = body?.error;
    if (response.status === 401 && !path.startsWith('/auth/login')) {
      window.dispatchEvent(new Event('stocksense:unauthorized'));
    }
    throw new ApiError(
      response.status,
      error?.code ?? 'REQUEST_FAILED',
      error?.message ?? 'Yêu cầu không thành công.',
      error?.fields ?? null,
    );
  }

  return body?.data ?? body;
}

export async function download(path, filename, accept = 'application/pdf') {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}/api/v1${path}`, { credentials: 'include', headers: { Accept: accept } });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Không thể kết nối máy chủ.');
  }
  if (!response.ok) {
    let body;
    try { body = await response.json(); } catch { body = null; }
    if (response.status === 401) window.dispatchEvent(new Event('stocksense:unauthorized'));
    throw new ApiError(response.status, body?.error?.code ?? 'REQUEST_FAILED', body?.error?.message ?? 'Không tải được báo cáo.');
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename; anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
