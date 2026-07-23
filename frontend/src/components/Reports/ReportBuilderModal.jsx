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
  generateReport,
  getReportSectionTypes,
  getReportTemplate,
  listReportTemplates,
  previewPdfBlob,
  updateReportTemplate,
} from '../../api/reports';
import ReportSidebar from './ReportSidebar';
import ReportComposer from './ReportComposer';
import {
  extractGlobalCountryIds,
  fromApiTemplate,
  toApiPayload,
} from './reportTemplateUtils';
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

  const [templates, setTemplates] = useState([]);
  const [sectionTypes, setSectionTypes] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [templateSearch, setTemplateSearch] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [globalCountryIds, setGlobalCountryIds] = useState([]);
  const [exportFormat, setExportFormat] = useState('pdf');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [listError, setListError] = useState('');
  const [composerError, setComposerError] = useState('');
  const [countries, setCountries] = useState([]);

  const loadList = useCallback(async () => {
    setLoading(true);
    setListError('');
    try {
      const [list, types] = await Promise.all([
        listReportTemplates(),
        getReportSectionTypes(),
      ]);
      setTemplates(list);
      setSectionTypes(types);
      return list;
    } catch (err) {
      console.error(err);
      setListError('Не удалось загрузить шаблоны отчётов');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCountries = useCallback(async () => {
    try {
      const countriesRes = await axios.get(`${API_URL}/api/v1/countries/`);
      setCountries(Array.isArray(countriesRes.data) ? countriesRes.data : []);
    } catch (err) {
      console.error('Не удалось загрузить страны для отчётов', err);
    }
  }, []);

  const openTemplate = useCallback(async (tpl) => {
    if (!tpl?.id) return;
    setBusy(true);
    setComposerError('');
    try {
      const full = await getReportTemplate(tpl.id);
      const nextForm = fromApiTemplate(full);
      setForm(nextForm);
      setGlobalCountryIds(extractGlobalCountryIds(nextForm.sections));
      setSelectedId(full.id);
    } catch (err) {
      console.error(err);
      setComposerError('Не удалось открыть шаблон');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;
    let cancelled = false;
    setTemplateSearch('');
    setExportFormat('pdf');
    setComposerError('');
    setForm({ ...EMPTY_FORM });
    setSelectedId(null);
    setGlobalCountryIds([]);
    loadCountries();
    (async () => {
      const list = await loadList();
      if (cancelled) return;
      if (list.length > 0) {
        await openTemplate(list[0]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, loadList, loadCountries, openTemplate]);

  if (!isOpen) return null;

  const handleCreate = () => {
    setSelectedId(null);
    setForm({ ...EMPTY_FORM, name: 'Новый отчёт' });
    setGlobalCountryIds([]);
    setComposerError('');
  };

  const handleDelete = async (tpl) => {
    if (!window.confirm(`Удалить шаблон «${tpl.name}»?`)) return;
    setBusyId(tpl.id);
    try {
      await deleteReportTemplate(tpl.id);
      const nextList = templates.filter((item) => item.id !== tpl.id);
      setTemplates(nextList);
      if (selectedId === tpl.id) {
        if (nextList[0]) {
          await openTemplate(nextList[0]);
        } else {
          handleCreate();
        }
      }
    } catch (err) {
      console.error(err);
      setListError('Не удалось удалить шаблон');
    } finally {
      setBusyId(null);
    }
  };

  const persistTemplate = async () => {
    const payload = toApiPayload(form, globalCountryIds);
    if (form.id) {
      return updateReportTemplate(form.id, payload);
    }
    return createReportTemplate(payload);
  };

  const handleSave = async () => {
    if (!canWrite) return;
    setBusy(true);
    setComposerError('');
    try {
      const saved = await persistTemplate();
      const nextForm = fromApiTemplate(saved);
      setForm(nextForm);
      setGlobalCountryIds(extractGlobalCountryIds(nextForm.sections));
      setSelectedId(saved.id);
      await loadList();
    } catch (err) {
      console.error(err);
      setComposerError('Не удалось сохранить шаблон');
    } finally {
      setBusy(false);
    }
  };

  const handlePreview = async () => {
    setBusy(true);
    setComposerError('');
    try {
      const blob = await generateAdhocReport(toApiPayload(form, globalCountryIds), 'pdf');
      previewPdfBlob(blob);
    } catch (err) {
      console.error(err);
      setComposerError(err?.message || 'Не удалось сформировать предпросмотр PDF');
    } finally {
      setBusy(false);
    }
  };

  const handleDownload = async () => {
    setBusy(true);
    setComposerError('');
    const ext = exportExtension(exportFormat);
    try {
      let templateId = form.id;
      if (canWrite) {
        const saved = await persistTemplate();
        const nextForm = fromApiTemplate(saved);
        setForm(nextForm);
        setGlobalCountryIds(extractGlobalCountryIds(nextForm.sections));
        setSelectedId(saved.id);
        templateId = saved.id;
        await loadList();
        const blob = await generateReport(templateId, [], exportFormat);
        downloadFileBlob(blob, `${saved.name || 'report'}.${ext}`);
      } else {
        const blob = await generateAdhocReport(toApiPayload(form, globalCountryIds), exportFormat);
        downloadFileBlob(blob, `${form.name || 'report'}.${ext}`);
      }
    } catch (err) {
      console.error(err);
      setComposerError(err?.message || `Не удалось сформировать ${ext.toUpperCase()}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="report-modal__overlay" onClick={onClose}>
      <div
        className="report-modal__content report-modal__content--builder"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-modal-title"
      >
        <header className="report-modal__header">
          <div>
            <h2 id="report-modal-title">Отчёты</h2>
            <p className="report-modal__subtitle">
              Шаблоны слева, состав и фильтры справа · PDF / DOCX
            </p>
          </div>
          <button type="button" className="report-modal__close" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </header>

        <div className="report-builder">
          <ReportSidebar
            templates={templates}
            selectedId={selectedId}
            search={templateSearch}
            onSearchChange={setTemplateSearch}
            loading={loading}
            error={listError}
            canWrite={canWrite}
            canDelete={canDelete}
            busyId={busyId}
            onCreate={handleCreate}
            onSelect={openTemplate}
            onDelete={handleDelete}
          />
          <ReportComposer
            form={form}
            onChange={setForm}
            sectionTypes={sectionTypes}
            countries={countries}
            globalCountryIds={globalCountryIds}
            onGlobalCountryIdsChange={setGlobalCountryIds}
            canWrite={canWrite}
            busy={busy}
            error={composerError}
            exportFormat={exportFormat}
            onExportFormatChange={setExportFormat}
            onPreview={handlePreview}
            onSave={handleSave}
            onDownload={handleDownload}
          />
        </div>
      </div>
    </div>
  );
}
