import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import ReportSidebar from './ReportSidebar';
import ReportComposer from './ReportComposer';
import ReportObjectsExportPanel from './ReportObjectsExportPanel';
import {
  createEmptyObjectsForm,
  extractGlobalCountryIds,
  fromApiTemplate,
  isObjectsOnlyTemplate,
  objectsFormFromTemplate,
  toApiPayload,
  toObjectsApiPayload,
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

function unwrapList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

export default function ReportBuilderModal({
  isOpen,
  onClose,
  selectedTargetIds = [],
}) {
  const { user } = useAuth();
  const canWrite = canWriteModule(user, 'reports');
  const canDelete = canDeleteModule(user, 'reports');
  const selectedTargetIdsRef = useRef(selectedTargetIds);
  selectedTargetIdsRef.current = selectedTargetIds;

  const [tab, setTab] = useState('templates');
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

  // Objects tab state (separate from general templates)
  const [objectsSelectedId, setObjectsSelectedId] = useState(null);
  const [objectsSearch, setObjectsSearch] = useState('');
  const [objectsForm, setObjectsForm] = useState(() => createEmptyObjectsForm());
  const [objectsExportFormat, setObjectsExportFormat] = useState('pdf');
  const [objectsBusy, setObjectsBusy] = useState(false);
  const [objectsBusyId, setObjectsBusyId] = useState(null);
  const [objectsError, setObjectsError] = useState('');
  const [targets, setTargets] = useState([]);
  const [targetTypes, setTargetTypes] = useState([]);

  const objectsTemplates = useMemo(
    () => (templates || []).filter(isObjectsOnlyTemplate),
    [templates],
  );

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

  const loadReference = useCallback(async () => {
    try {
      const [countriesRes, targetsRes, typesRes] = await Promise.all([
        axios.get(`${API_URL}/api/v1/countries/`),
        axios.get(`${API_URL}/api/v1/targets/`),
        axios.get(`${API_URL}/api/v1/target-types/`),
      ]);
      setCountries(unwrapList(countriesRes.data));
      setTargets(unwrapList(targetsRes.data));
      setTargetTypes(unwrapList(typesRes.data));
    } catch (err) {
      console.error('Не удалось загрузить справочники для отчётов', err);
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

  const openObjectsTemplate = useCallback(async (tpl) => {
    if (!tpl?.id) return;
    setObjectsBusy(true);
    setObjectsError('');
    try {
      const full = await getReportTemplate(tpl.id);
      const next = objectsFormFromTemplate(full);
      const mapIds = selectedTargetIdsRef.current || [];
      if (!next.targetIds.length && mapIds.length > 0) {
        next.targetIds = mapIds.map(String);
      }
      setObjectsForm(next);
      setObjectsSelectedId(full.id);
    } catch (err) {
      console.error(err);
      setObjectsError('Не удалось открыть шаблон');
    } finally {
      setObjectsBusy(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;
    let cancelled = false;
    setTab('templates');
    setTemplateSearch('');
    setObjectsSearch('');
    setExportFormat('pdf');
    setObjectsExportFormat('pdf');
    setComposerError('');
    setObjectsError('');
    setForm({ ...EMPTY_FORM });
    setSelectedId(null);
    setGlobalCountryIds([]);
    setObjectsSelectedId(null);
    setObjectsForm(createEmptyObjectsForm());
    loadReference();
    (async () => {
      const list = await loadList();
      if (cancelled) return;
      if (list.length > 0) {
        await openTemplate(list[0]);
      }
      const objectsList = (list || []).filter(isObjectsOnlyTemplate);
      if (objectsList.length > 0) {
        await openObjectsTemplate(objectsList[0]);
      } else {
        const mapIds = selectedTargetIdsRef.current || [];
        setObjectsForm({
          ...createEmptyObjectsForm(),
          targetIds: mapIds.map(String),
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, loadList, loadReference, openTemplate, openObjectsTemplate]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isOpen) return null;

  const handleCreate = () => {
    setSelectedId(null);
    setForm({ ...EMPTY_FORM, name: 'Новый отчёт' });
    setGlobalCountryIds([]);
    setComposerError('');
  };

  const handleCreateObjects = () => {
    setObjectsSelectedId(null);
    setObjectsForm({
      ...createEmptyObjectsForm(),
      targetIds: (selectedTargetIds || []).map(String),
    });
    setObjectsError('');
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
      if (objectsSelectedId === tpl.id) {
        const nextObjects = nextList.filter(isObjectsOnlyTemplate);
        if (nextObjects[0]) {
          await openObjectsTemplate(nextObjects[0]);
        } else {
          handleCreateObjects();
        }
      }
    } catch (err) {
      console.error(err);
      setListError('Не удалось удалить шаблон');
    } finally {
      setBusyId(null);
    }
  };

  const handleDeleteObjects = async (tpl) => {
    if (!window.confirm(`Удалить шаблон «${tpl.name}»?`)) return;
    setObjectsBusyId(tpl.id);
    try {
      await deleteReportTemplate(tpl.id);
      const nextList = templates.filter((item) => item.id !== tpl.id);
      setTemplates(nextList);
      if (objectsSelectedId === tpl.id) {
        const nextObjects = nextList.filter(isObjectsOnlyTemplate);
        if (nextObjects[0]) {
          await openObjectsTemplate(nextObjects[0]);
        } else {
          handleCreateObjects();
        }
      }
      if (selectedId === tpl.id) {
        if (nextList[0]) {
          await openTemplate(nextList[0]);
        } else {
          handleCreate();
        }
      }
    } catch (err) {
      console.error(err);
      setObjectsError('Не удалось удалить шаблон');
    } finally {
      setObjectsBusyId(null);
    }
  };

  const persistTemplate = async () => {
    const payload = toApiPayload(form, globalCountryIds);
    if (form.id) {
      return updateReportTemplate(form.id, payload);
    }
    return createReportTemplate(payload);
  };

  const persistObjectsTemplate = async () => {
    const payload = toObjectsApiPayload(objectsForm, targets);
    if (objectsForm.id) {
      return updateReportTemplate(objectsForm.id, payload);
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

  const handleSaveObjects = async () => {
    if (!canWrite) return;
    setObjectsBusy(true);
    setObjectsError('');
    try {
      const saved = await persistObjectsTemplate();
      setObjectsForm(objectsFormFromTemplate(saved));
      setObjectsSelectedId(saved.id);
      await loadList();
    } catch (err) {
      console.error(err);
      setObjectsError('Не удалось сохранить шаблон');
    } finally {
      setObjectsBusy(false);
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

  const handleGenerateObjects = async () => {
    setObjectsBusy(true);
    setObjectsError('');
    const format = objectsExportFormat || 'pdf';
    const ext = exportExtension(format);
    const payload = toObjectsApiPayload(objectsForm, targets);
    try {
      if (canWrite) {
        const saved = await persistObjectsTemplate();
        setObjectsForm(objectsFormFromTemplate(saved));
        setObjectsSelectedId(saved.id);
        await loadList();
        const blob = await generateReport(saved.id, [], format);
        downloadFileBlob(blob, `${saved.name || 'objects-report'}.${ext}`);
      } else {
        const blob = await generatePresetReport({
          kind: 'objects_full',
          country_ids: payload.sections[0].filters.country_ids || [],
          target_ids: payload.sections[0].filters.target_ids || [],
          name: payload.name,
          format,
        });
        downloadFileBlob(blob, `${payload.name || 'objects-report'}.${ext}`);
      }
    } catch (err) {
      console.error(err);
      setObjectsError(err?.message || `Не удалось сформировать ${ext.toUpperCase()}`);
    } finally {
      setObjectsBusy(false);
    }
  };

  const subtitle = tab === 'objects'
    ? 'Библиотека шаблонов по объектам · выбор стран и объектов · PDF / DOCX'
    : 'Шаблоны слева, состав и фильтры справа · PDF / DOCX';

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
              {subtitle}
            </p>
          </div>
          <button type="button" className="report-modal__close" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </header>

        <div className="report-modal__tabs" role="tablist" aria-label="Режим отчётов">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'templates'}
            className={`report-modal__tab${tab === 'templates' ? ' report-modal__tab--active' : ''}`}
            onClick={() => setTab('templates')}
          >
            Шаблоны
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'objects'}
            className={`report-modal__tab${tab === 'objects' ? ' report-modal__tab--active' : ''}`}
            onClick={() => setTab('objects')}
          >
            По объектам
          </button>
        </div>

        {tab === 'templates' ? (
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
        ) : (
          <div className="report-builder report-builder--objects">
            <ReportSidebar
              templates={objectsTemplates}
              selectedId={objectsSelectedId}
              search={objectsSearch}
              onSearchChange={setObjectsSearch}
              loading={loading}
              error={listError}
              canWrite={canWrite}
              canDelete={canDelete}
              busyId={objectsBusyId}
              onCreate={handleCreateObjects}
              onSelect={openObjectsTemplate}
              onDelete={handleDeleteObjects}
            />
            <ReportObjectsExportPanel
              form={objectsForm}
              onChange={setObjectsForm}
              targets={targets}
              targetTypes={targetTypes}
              mapTargetIds={selectedTargetIds}
              canWrite={canWrite}
              busy={objectsBusy}
              error={objectsError}
              exportFormat={objectsExportFormat}
              onExportFormatChange={setObjectsExportFormat}
              onSave={handleSaveObjects}
              onGenerate={handleGenerateObjects}
            />
          </div>
        )}
      </div>
    </div>
  );
}
