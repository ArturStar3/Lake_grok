import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { canDeleteModule, canWriteModule } from '../../utils/permissions';
import { API_URL } from '../../config/api';
import {
  createReportTemplate,
  deleteReportTemplate,
  downloadFileBlob,
  generateAdhocReport,
  generatePresetReport,
  generateReport,
  getReportSectionTypes,
  getReportTemplate,
  listReportTemplates,
  previewPdfBlob,
  updateReportTemplate,
} from '../../api/reports';
import ReportTemplateList from './ReportTemplateList';
import ReportTemplateEditor from './ReportTemplateEditor';
import ReportPresetPanel from './ReportPresetPanel';
import { fromApiTemplate, toApiPayload } from './reportTemplateUtils';
import './ReportBuilderModal.css';

const EMPTY_FORM = {
  id: null,
  name: '',
  description: '',
  sections: [],
};

function exportExtension(format) {
  return format === 'docx' ? 'docx' : 'pdf';
}

export default function ReportBuilderModal({ isOpen, onClose }) {
  const { user } = useAuth();
  const canWrite = canWriteModule(user, 'reports');
  const canDelete = canDeleteModule(user, 'reports');

  const [tab, setTab] = useState('quick'); // quick | templates
  const [mode, setMode] = useState('list'); // list | edit (within templates)
  const [templates, setTemplates] = useState([]);
  const [sectionTypes, setSectionTypes] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [exportFormat, setExportFormat] = useState('pdf');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');
  const [presetError, setPresetError] = useState('');
  const [editorError, setEditorError] = useState('');
  const [reference, setReference] = useState({
    countries: [],
    eventTypes: [],
    actionTypes: [],
    targetTypes: [],
    equipmentCategories: [],
    targets: [],
  });

  const loadList = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [list, types] = await Promise.all([
        listReportTemplates(),
        getReportSectionTypes(),
      ]);
      setTemplates(list);
      setSectionTypes(types);
    } catch (err) {
      console.error(err);
      setError('Не удалось загрузить шаблоны отчётов');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadReference = useCallback(async () => {
    try {
      const [
        countriesRes,
        eventTypesRes,
        actionTypesRes,
        targetTypesRes,
        categoriesRes,
        targetsRes,
      ] = await Promise.all([
        axios.get(`${API_URL}/api/v1/countries/`),
        axios.get(`${API_URL}/api/v1/event-types/`),
        axios.get(`${API_URL}/api/v1/action-types/`),
        axios.get(`${API_URL}/api/v1/target-types/`),
        axios.get(`${API_URL}/api/v1/equipment-categories/`),
        axios.get(`${API_URL}/api/v1/targets/`),
      ]);
      setReference({
        countries: Array.isArray(countriesRes.data) ? countriesRes.data : [],
        eventTypes: Array.isArray(eventTypesRes.data) ? eventTypesRes.data : [],
        actionTypes: Array.isArray(actionTypesRes.data) ? actionTypesRes.data : [],
        targetTypes: Array.isArray(targetTypesRes.data) ? targetTypesRes.data : [],
        equipmentCategories: Array.isArray(categoriesRes.data) ? categoriesRes.data : [],
        targets: Array.isArray(targetsRes.data) ? targetsRes.data : (targetsRes.data?.results || []),
      });
    } catch (err) {
      console.error('Не удалось загрузить справочники для отчётов', err);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setTab('quick');
    setMode('list');
    setForm(EMPTY_FORM);
    setExportFormat('pdf');
    setEditorError('');
    setPresetError('');
    loadList();
    loadReference();
  }, [isOpen, loadList, loadReference]);

  if (!isOpen) return null;

  const handleCreate = () => {
    setForm({ ...EMPTY_FORM });
    setEditorError('');
    setMode('edit');
  };

  const handleEdit = async (tpl) => {
    setBusy(true);
    setEditorError('');
    try {
      const full = await getReportTemplate(tpl.id);
      setForm(fromApiTemplate(full));
      setMode('edit');
    } catch (err) {
      console.error(err);
      setError('Не удалось открыть шаблон');
    } finally {
      setBusy(false);
    }
  };

  const handleGenerate = async (tpl) => {
    setBusyId(tpl.id);
    const ext = exportExtension(exportFormat);
    try {
      const blob = await generateReport(tpl.id, [], exportFormat);
      downloadFileBlob(blob, `${tpl.name || 'report'}.${ext}`);
    } catch (err) {
      console.error(err);
      setError(err?.message || `Не удалось сформировать ${ext.toUpperCase()}`);
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (tpl) => {
    if (!window.confirm(`Удалить шаблон «${tpl.name}»?`)) return;
    setBusyId(tpl.id);
    try {
      await deleteReportTemplate(tpl.id);
      setTemplates((prev) => prev.filter((item) => item.id !== tpl.id));
    } catch (err) {
      console.error(err);
      setError('Не удалось удалить шаблон');
    } finally {
      setBusyId(null);
    }
  };

  const handlePresetGenerate = async (payload) => {
    setBusy(true);
    setPresetError('');
    const format = payload.format || exportFormat || 'pdf';
    const ext = exportExtension(format);
    try {
      const blob = await generatePresetReport({ ...payload, format });
      downloadFileBlob(blob, `${payload.name || 'report'}.${ext}`);
    } catch (err) {
      console.error(err);
      setPresetError(err?.message || `Не удалось сформировать ${ext.toUpperCase()}`);
    } finally {
      setBusy(false);
    }
  };

  const handlePreview = async () => {
    setBusy(true);
    setEditorError('');
    try {
      const blob = await generateAdhocReport(toApiPayload(form), 'pdf');
      previewPdfBlob(blob);
    } catch (err) {
      console.error(err);
      setEditorError(err?.message || 'Не удалось сформировать предпросмотр PDF');
    } finally {
      setBusy(false);
    }
  };

  const persistTemplate = async () => {
    const payload = toApiPayload(form);
    if (form.id) {
      return updateReportTemplate(form.id, payload);
    }
    return createReportTemplate(payload);
  };

  const handleSave = async () => {
    setBusy(true);
    setEditorError('');
    try {
      const saved = await persistTemplate();
      setForm(fromApiTemplate(saved));
      await loadList();
    } catch (err) {
      console.error(err);
      setEditorError('Не удалось сохранить шаблон');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveAndGenerate = async () => {
    setBusy(true);
    setEditorError('');
    const ext = exportExtension(exportFormat);
    try {
      const saved = await persistTemplate();
      setForm(fromApiTemplate(saved));
      await loadList();
      const blob = await generateReport(saved.id, [], exportFormat);
      downloadFileBlob(blob, `${saved.name || 'report'}.${ext}`);
    } catch (err) {
      console.error(err);
      setEditorError(err?.message || `Не удалось сохранить или сформировать ${ext.toUpperCase()}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="report-modal__overlay" onClick={onClose}>
      <div
        className="report-modal__content"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-modal-title"
      >
        <header className="report-modal__header">
          <div>
            <h2 id="report-modal-title">Отчёты</h2>
            <p className="report-modal__subtitle">
              Полные отчёты по странам и объектам, конструктор шаблонов (PDF / DOCX)
            </p>
          </div>
          <button type="button" className="report-modal__close" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </header>

        {mode === 'list' && (
          <div className="report-modal__tabs">
            <button
              type="button"
              className={`report-modal__tab${tab === 'quick' ? ' report-modal__tab--active' : ''}`}
              onClick={() => setTab('quick')}
            >
              Быстрый отчёт
            </button>
            <button
              type="button"
              className={`report-modal__tab${tab === 'templates' ? ' report-modal__tab--active' : ''}`}
              onClick={() => setTab('templates')}
            >
              Свои шаблоны
            </button>
          </div>
        )}

        <div className="report-modal__body">
          {mode === 'edit' ? (
            <ReportTemplateEditor
              form={form}
              onChange={setForm}
              sectionTypes={sectionTypes}
              reference={reference}
              canWrite={canWrite}
              busy={busy}
              error={editorError}
              exportFormat={exportFormat}
              onExportFormatChange={setExportFormat}
              onBack={() => {
                setMode('list');
                setTab('templates');
                setEditorError('');
                loadList();
              }}
              onPreview={handlePreview}
              onSave={handleSave}
              onSaveAndGenerate={handleSaveAndGenerate}
            />
          ) : tab === 'quick' ? (
            <ReportPresetPanel
              countries={reference.countries}
              targets={reference.targets}
              busy={busy}
              error={presetError}
              exportFormat={exportFormat}
              onExportFormatChange={setExportFormat}
              onGenerate={handlePresetGenerate}
            />
          ) : (
            <ReportTemplateList
              templates={templates}
              loading={loading}
              error={error}
              canWrite={canWrite}
              canDelete={canDelete}
              onCreate={handleCreate}
              onEdit={handleEdit}
              onGenerate={handleGenerate}
              onDelete={handleDelete}
              busyId={busyId}
              exportFormat={exportFormat}
              onExportFormatChange={setExportFormat}
            />
          )}
        </div>
      </div>
    </div>
  );
}
