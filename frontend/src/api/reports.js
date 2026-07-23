import { apiClient } from '../config/axios';

const BASE = '/report-templates/';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

async function ensureFileBlob(response, expectedContentType = 'application/pdf') {
  const blob = response.data;
  const contentType = String(response.headers?.['content-type'] || blob?.type || '');
  const expected = String(expectedContentType || 'application/pdf');
  const matchesExpected = contentType.includes(expected)
    || (blob instanceof Blob && blob.type && blob.type.includes(expected.split(';')[0]));
  if (matchesExpected) {
    return blob;
  }
  // Axios with responseType:blob turns JSON errors into Blob too.
  try {
    const text = await blob.text();
    const parsed = JSON.parse(text);
    const detail = parsed?.detail || text || 'Ошибка формирования файла';
    throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
  } catch (err) {
    if (err instanceof Error && err.message && !err.message.startsWith('Unexpected')) {
      throw err;
    }
    throw new Error('Ошибка формирования файла');
  }
}

function contentTypeForFormat(format = 'pdf') {
  return format === 'docx' ? DOCX_MIME : 'application/pdf';
}

function openFileBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || 'report.pdf';
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Keep object URL briefly so the browser can start download, then revoke.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return url;
}

export async function listReportTemplates() {
  const { data } = await apiClient.get(BASE);
  return Array.isArray(data) ? data : (data?.results || []);
}

export async function getReportTemplate(id) {
  const { data } = await apiClient.get(`${BASE}${id}/`);
  return data;
}

export async function createReportTemplate(payload) {
  const { data } = await apiClient.post(BASE, payload);
  return data;
}

export async function updateReportTemplate(id, payload) {
  const { data } = await apiClient.put(`${BASE}${id}/`, payload);
  return data;
}

export async function deleteReportTemplate(id) {
  await apiClient.delete(`${BASE}${id}/`);
}

export async function getReportSectionTypes() {
  const { data } = await apiClient.get(`${BASE}section-types/`);
  return Array.isArray(data) ? data : [];
}

export async function generateReport(id, overrides = [], format = 'pdf') {
  const expected = contentTypeForFormat(format);
  const response = await apiClient.post(
    `${BASE}${id}/generate/`,
    { overrides, format },
    { responseType: 'blob', validateStatus: () => true },
  );
  if (response.status >= 400) {
    await ensureFileBlob(response, expected); // throws with server detail
  }
  return ensureFileBlob(response, expected);
}

export async function generateAdhocReport(payload, format = 'pdf') {
  const expected = contentTypeForFormat(format);
  const response = await apiClient.post(
    `${BASE}generate-adhoc/`,
    { ...payload, format },
    { responseType: 'blob', validateStatus: () => true },
  );
  if (response.status >= 400) {
    await ensureFileBlob(response, expected);
  }
  return ensureFileBlob(response, expected);
}

export async function generatePresetReport({
  kind,
  country_ids = [],
  target_ids = [],
  name = '',
  format = 'pdf',
}) {
  const expected = contentTypeForFormat(format);
  const response = await apiClient.post(
    `${BASE}generate-preset/`,
    { kind, country_ids, target_ids, name, format },
    { responseType: 'blob', validateStatus: () => true },
  );
  if (response.status >= 400) {
    await ensureFileBlob(response, expected);
  }
  return ensureFileBlob(response, expected);
}

export function downloadFileBlob(blob, filename = 'report.pdf') {
  openFileBlob(blob, filename);
}

/** @deprecated use downloadFileBlob */
export function downloadPdfBlob(blob, filename = 'report.pdf') {
  openFileBlob(blob, filename);
}

export function previewPdfBlob(blob) {
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener,noreferrer');
  setTimeout(() => URL.revokeObjectURL(url), 120_000);
  return url;
}
