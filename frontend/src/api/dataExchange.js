import { apiClient } from '../config/axios';

const EXPORT_URL = '/data-exchange/export/';
const SESSIONS_URL = '/data-exchange/sessions/';

async function ensureZipBlob(response) {
  const blob = response.data;
  const contentType = String(response.headers?.['content-type'] || blob?.type || '');
  if (contentType.includes('application/zip') || contentType.includes('application/octet-stream')
      || (blob instanceof Blob && (blob.type === 'application/zip' || !blob.type))) {
    // JSON errors also come as blob — peek if small and looks like JSON
    if (blob instanceof Blob && blob.size < 4096) {
      try {
        const text = await blob.slice(0, 200).text();
        if (text.trim().startsWith('{')) {
          const parsed = JSON.parse(await blob.text());
          throw new Error(parsed?.detail || 'Ошибка экспорта');
        }
      } catch (err) {
        if (err instanceof Error && err.message && !err.message.startsWith('Unexpected')) throw err;
      }
    }
    return blob;
  }
  try {
    const text = await blob.text();
    const parsed = JSON.parse(text);
    throw new Error(parsed?.detail || text || 'Ошибка экспорта');
  } catch (err) {
    if (err instanceof Error && err.message && !err.message.startsWith('Unexpected')) throw err;
    throw new Error('Ошибка экспорта');
  }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function exportCountries(countryIds) {
  const response = await apiClient.post(
    EXPORT_URL,
    { country_ids: countryIds },
    { responseType: 'blob', validateStatus: () => true },
  );
  if (response.status >= 400) {
    await ensureZipBlob(response);
  }
  const blob = await ensureZipBlob(response);
  const disposition = response.headers?.['content-disposition'] || '';
  const match = /filename="?([^"]+)"?/.exec(disposition);
  const filename = match?.[1] || 'infolake_export.zip';
  downloadBlob(blob, filename);
  return blob;
}

export async function createImportSession(file) {
  const form = new FormData();
  form.append('file', file);
  const { data } = await apiClient.post(SESSIONS_URL, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function getImportSession(id) {
  const { data } = await apiClient.get(`${SESSIONS_URL}${id}/`);
  return data;
}

export async function resolveImportSession(id, decisions = {}) {
  const { data } = await apiClient.post(`${SESSIONS_URL}${id}/resolve/`, { decisions });
  return data;
}

export async function cancelImportSession(id) {
  await apiClient.delete(`${SESSIONS_URL}${id}/`);
}
