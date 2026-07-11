import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import axios from 'axios';
import { addColorClassToSvg } from '../../utils/svgUtils';
import { useActionsArray } from '../../hooks/useActionsArray';
import { useDeployedEquipmentArray } from '../../hooks/useDeployedEquipmentArray';
import { useDropdownWithSearch } from '../../hooks/useDropdownWithSearch';
import { fetchReferenceData, subscribeReferenceDataInvalidation } from '../../hooks/useReferenceData';
import TargetEquipmentEditor from '../TargetEquipment/TargetEquipmentEditor';
import {
    buildTargetTypeTree,
    flattenTargetTypeTree,
    formatTypeOptionLabel,
    filterTargetTypesForCountry,
    filterParentOptionsForTarget,
} from '../../utils/targetTypeTree';
import PersonEditor from '../PersonEditor/PersonEditor';
import MarkdownEditor from '../common/MarkdownEditor/MarkdownEditor';
import MarkdownContent from '../common/MarkdownEditor/MarkdownContent';
import PolygonCoordinateEditor from '../common/PolygonCoordinateEditor/PolygonCoordinateEditor';
import noUserIcon from '../../assets/images/no_user.png';
import './EditTargetModal.css';
import { API_URL } from '../../config/api';
import {
    geoJsonPolygonToDrawPoints,
    isInundationAction,
    isInundationZoneType,
    isPolygonZoneMode,
    mapTargetActionToForm,
    pointsToGeoJsonPolygon,
    resolveActionType,
} from '../../utils/inundationZone';
import {
    drawPointsToEditable,
    editablePointsKey,
    drawPointsKey,
    parseLatLngPoints,
    validateEditablePolygonPoints,
} from '../../utils/polygonDrawUtils';

function ActionPolygonCoordinateField({ zoneGeometry, onGeometryChange, error }) {
    const [editable, setEditable] = useState([]);
    const skipSyncRef = useRef(false);
    const zonePointsKey = drawPointsKey(geoJsonPolygonToDrawPoints(zoneGeometry));

    useEffect(() => {
        if (skipSyncRef.current) {
            skipSyncRef.current = false;
            return;
        }
        const next = drawPointsToEditable(geoJsonPolygonToDrawPoints(zoneGeometry));
        const nextKey = editablePointsKey(next);
        setEditable((prev) => (
            editablePointsKey(prev) === nextKey ? prev : next
        ));
    }, [zonePointsKey, zoneGeometry]);

    const handleChange = (nextEditable) => {
        setEditable(nextEditable);
        skipSyncRef.current = true;
        const parsed = parseLatLngPoints(nextEditable, { minCount: 3 });
        onGeometryChange(parsed ? pointsToGeoJsonPolygon(parsed) : null, nextEditable);
    };

    return (
        <div className="edit-target-modal__polygon-coords">
            <PolygonCoordinateEditor
                points={editable}
                onChange={handleChange}
                error={error}
                hint="Введите координаты вручную или нарисуйте на карте"
                compact
            />
        </div>
    );
}

const API_ROOT = API_URL;

export default function EditTargetModal({
    targetId,
    isOpen,
    onClose,
    onTargetUpdated,
    cachedTargets = null,
    onStartPolygonDraw,
    formPatch = null,
    onFormPatchApplied,
}) {
    const [activeTab, setActiveTab] = useState('target');
    const [formData, setFormData] = useState({
        country: '',
        title: '',
        label: '',
        type: '',
        marker: '',
        parent: '',
        lat: '',
        lng: '',
        actions: [],
        deployed_equipment: [],
    });
    
    const [formularData, setFormularData] = useState({});
    const [sections, setSections] = useState([]);
    const [attachmentsBySection, setAttachmentsBySection] = useState({});
    const [attachmentDrafts, setAttachmentDrafts] = useState({});
    const [attachmentFormsOpen, setAttachmentFormsOpen] = useState({});
    const [previewImage, setPreviewImage] = useState(null);
    const [persons, setPersons] = useState([]);
    const [personEditorOpen, setPersonEditorOpen] = useState(false);
    const [editingPersonId, setEditingPersonId] = useState(null);
    
    const [countries, setCountries] = useState([]);
    const [markers, setMarkers] = useState([]);
    const [actionTypes, setActionTypes] = useState([]);
    const [targetTypes, setTargetTypes] = useState([]);
    const [targets, setTargets] = useState([]);  // для выбора parent
    const [equipmentCatalog, setEquipmentCatalog] = useState([]);
    const [markerSvgs, setMarkerSvgs] = useState(new Map());
    
    const [errors, setErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [loading, setLoading] = useState(true);

    const inundationActionTypes = useMemo(
        () => actionTypes.filter((type) => isInundationZoneType(type)),
        [actionTypes],
    );
    const regularActionTypes = useMemo(
        () => actionTypes.filter((type) => !isInundationZoneType(type)),
        [actionTypes],
    );
    const isInundationRow = useCallback(
        (action) => isInundationAction(action, actionTypes),
        [actionTypes],
    );
    const showInundationSection = useMemo(
        () => inundationActionTypes.length > 0,
        [inundationActionTypes],
    );

    useEffect(() => {
        if (!formPatch) return;
        skipNextApiLoadRef.current = true;
        preserveLocalFormRef.current = true;
        setFormData(formPatch);
        setLoading(false);
        onFormPatchApplied?.();
    }, [formPatch, onFormPatchApplied]);

    const handleAddInundationAction = useCallback(() => {
        setFormData((prev) => ({
            ...prev,
            actions: [
                ...prev.actions,
                {
                    action_type_id: '',
                    radius: '',
                    zone_geometry: null,
                    inundation_scenario: true,
                    zone_metadata: {
                        water_level_m: '',
                        seasonality: '',
                        scenario_label: '',
                        notes: '',
                    },
                },
            ],
        }));
    }, []);

    const handleInundationMetadataChange = useCallback((index, field, value) => {
        setFormData((prev) => {
            const nextActions = [...prev.actions];
            const current = nextActions[index] || {};
            nextActions[index] = {
                ...current,
                zone_metadata: {
                    ...(current.zone_metadata || {}),
                    [field]: value,
                },
            };
            return { ...prev, actions: nextActions };
        });
    }, []);

    const handleClearPolygon = useCallback((index) => {
        setFormData((prev) => {
            const nextActions = [...prev.actions];
            nextActions[index] = {
                ...nextActions[index],
                zone_geometry: null,
            };
            return { ...prev, actions: nextActions };
        });
        setErrors((prev) => {
            const key = `action_${index}_polygon`;
            const next = { ...prev };
            delete next[key];
            return next;
        });
    }, []);

    const handlePolygonPointsChange = useCallback((index, geometry, editable) => {
        setFormData((prev) => {
            const nextActions = [...prev.actions];
            nextActions[index] = {
                ...nextActions[index],
                zone_geometry: geometry,
            };
            return { ...prev, actions: nextActions };
        });
        setErrors((prev) => {
            const key = `action_${index}_polygon`;
            if (geometry) {
                const next = { ...prev };
                delete next[key];
                return next;
            }
            if (!editable?.length) {
                const next = { ...prev };
                delete next[key];
                return next;
            }
            const validationError = validateEditablePolygonPoints(editable);
            if (!validationError) {
                const next = { ...prev };
                delete next[key];
                return next;
            }
            return { ...prev, [key]: validationError };
        });
    }, []);

    const handleStartPolygonDraw = useCallback((index) => {
        if (!onStartPolygonDraw) return;
        const action = formData.actions[index];
        onStartPolygonDraw({
            actionIndex: index,
            initialPoints: geoJsonPolygonToDrawPoints(action?.zone_geometry),
            formData,
            formularData,
            isInundation: isInundationRow(action),
        });
    }, [onStartPolygonDraw, formData, formularData, isInundationRow]);

    const typeSelectOptions = useMemo(() => {
        const applicable = filterTargetTypesForCountry(targetTypes, formData.country);
        return flattenTargetTypeTree(buildTargetTypeTree(applicable));
    }, [targetTypes, formData.country]);
    
    // Хуки для управления actions
    const { handleAddAction, handleRemoveAction } = useActionsArray(formData, setFormData);
    const handleActionChange = useCallback((index, field, value) => {
        setFormData((prev) => {
            const newActions = [...prev.actions];
            const current = { ...newActions[index], [field]: value };
            if (field === 'action_type_id') {
                const matched = actionTypes.find((type) => String(type.id) === String(value));
                current.action_type = matched || null;
                if (matched && isInundationZoneType(matched)) {
                    current.inundation_scenario = true;
                    current.polygon_scenario = false;
                    current.zone_metadata = current.zone_metadata || {
                        water_level_m: '',
                        seasonality: '',
                        scenario_label: '',
                        notes: '',
                    };
                } else if (matched && isPolygonZoneMode(matched.zone_mode)) {
                    current.inundation_scenario = false;
                    current.polygon_scenario = true;
                    current.zone_metadata = null;
                } else {
                    current.inundation_scenario = false;
                    current.polygon_scenario = false;
                    current.zone_metadata = null;
                    current.zone_geometry = null;
                }
            }
            newActions[index] = current;
            return { ...prev, actions: newActions };
        });
    }, [actionTypes]);
    const {
        handleAddEquipmentWithId,
        handleRemoveEquipment,
        handleEquipmentChange,
    } = useDeployedEquipmentArray(setFormData);
    
    // Хуки для dropdown с поиском
    const countryDropdown = useDropdownWithSearch(
        countries,
        (id) => {
            const newCountryId = id;
            setFormData(prev => ({ ...prev, country: newCountryId }));
            if (errors.country) {
                setErrors(prev => ({ ...prev, country: null }));
            }
        }
    );
    
    const markerDropdown = useDropdownWithSearch(
        markers,
        (id) => {
            setFormData(prev => ({ ...prev, marker: id }));
            if (errors.marker) {
                setErrors(prev => ({ ...prev, marker: null }));
            }
        }
    );
    
    // Dropdown для parent (исключаем себя)
    const parentOptions = useMemo(
        () => filterParentOptionsForTarget(targets, targetTypes, {
            countryId: formData.country,
            typeId: formData.type,
            excludeId: targetId,
        }),
        [targets, targetTypes, formData.country, formData.type, targetId],
    );

    useEffect(() => {
        if (!formData.parent) return;
        const stillValid = parentOptions.some((t) => t.id === formData.parent);
        if (!stillValid) {
            setFormData((prev) => ({ ...prev, parent: '' }));
        }
    }, [parentOptions, formData.parent]);

    const parentDropdown = useDropdownWithSearch(
        parentOptions,
        (id) => {
            setFormData(prev => ({ ...prev, parent: id }));
            if (errors.parent) {
                setErrors(prev => ({ ...prev, parent: null }));
            }
        }
    );

    const selectedCountryColor = formData.country 
        ? countries.find(c => c.id === formData.country)?.color || 'blue'
        : 'blue';

    const loadSeqRef = useRef(0);
    const skipNextApiLoadRef = useRef(false);
    const preserveLocalFormRef = useRef(false);
    const cachedTargetsRef = useRef(cachedTargets);
    const isOpenRef = useRef(isOpen);
    cachedTargetsRef.current = cachedTargets;
    isOpenRef.current = isOpen;
    const [refReloadToken, setRefReloadToken] = useState(0);

    useEffect(() => {
        return subscribeReferenceDataInvalidation(() => {
            if (isOpenRef.current) setRefReloadToken((token) => token + 1);
        });
    }, []);
    
    useEffect(() => {
        if (!isOpen || !targetId) {
            preserveLocalFormRef.current = false;
            skipNextApiLoadRef.current = false;
            return undefined;
        }

        if (skipNextApiLoadRef.current) {
            skipNextApiLoadRef.current = false;
            return undefined;
        }

        if (preserveLocalFormRef.current) {
            return undefined;
        }

        const controller = new AbortController();
        const seq = ++loadSeqRef.current;

        const loadData = async () => {
            setLoading(true);
            try {
                const refs = await fetchReferenceData({ signal: controller.signal });

                const [
                    targetRes,
                    sectionsRes,
                    equipmentRes,
                ] = await Promise.all([
                    axios.get(`${API_ROOT}/api/v1/targets/${targetId}/`, { signal: controller.signal }),
                    axios.get(`${API_ROOT}/api/v1/formular-sections/`, { signal: controller.signal }),
                    axios.get(`${API_ROOT}/api/v1/equipment/`, { signal: controller.signal }),
                ]);

                if (seq !== loadSeqRef.current) return;

                const target = targetRes.data;

                setCountries(refs.countries);
                setMarkers(refs.markers);
                setActionTypes(refs.actionTypes);
                setTargetTypes(refs.targetTypes);
                setMarkerSvgs(refs.markerSvgs);
                setEquipmentCatalog(Array.isArray(equipmentRes.data) ? equipmentRes.data : []);

                const cachedParents = cachedTargetsRef.current;
                if (cachedParents && cachedParents.length > 0) {
                    setTargets(cachedParents.map((t) => ({
                        id: t.id,
                        title: t.title,
                        label: t.label,
                        country: t.country?.id ?? t.country,
                        type: t.type?.id ?? t.type,
                    })));
                } else {
                    const parentsRes = await axios.get(`${API_ROOT}/api/v1/targets/parent-options/`, {
                        signal: controller.signal,
                    });
                    if (seq !== loadSeqRef.current) return;
                    setTargets(parentsRes.data || []);
                }
            
                setFormData({
                    country: target.country?.id || '',
                    title: target.title || '',
                    label: target.label || '',
                    type: target.type?.id || '',
                    marker: target.marker?.id || '',
                    parent: target.parent || '',
                    lat: target.lat || '',
                    lng: target.lng || '',
                    actions: target.actions?.map((action) => mapTargetActionToForm(action)) || [],
                    deployed_equipment: (target.deployed_equipment || []).map((row) => ({
                        equipment_id: row.equipment?.id || '',
                        quantity: row.quantity || 1,
                    })),
                });
            
                const organized = organizeIntoHierarchy(sectionsRes.data);
                setSections(organized);
            
                try {
                    const formularRes = await axios.get(`${API_ROOT}/api/v1/formular/${targetId}/`, {
                        signal: controller.signal,
                    });
                    if (seq !== loadSeqRef.current) return;
                    const existingData = {};
                    const formularItems = formularRes.data.formular || (Array.isArray(formularRes.data) ? formularRes.data : []);
                    formularItems.forEach(item => {
                        existingData[item.section.id] = item.content || '';
                    });
                    setFormularData(existingData);
                } catch (err) {
                    if (err?.code === 'ERR_CANCELED' || axios.isCancel?.(err)) return;
                    if (err.response?.status !== 404) {
                        console.warn('Ошибка загрузки формуляра:', err);
                    }
                    setFormularData({});
                }

                try {
                    const attachmentsRes = await axios.get(`${API_ROOT}/api/v1/formular-attachments/`, {
                        params: { target: targetId },
                        signal: controller.signal,
                    });
                    if (seq !== loadSeqRef.current) return;
                    const grouped = {};
                    (attachmentsRes.data || []).forEach((item) => {
                        if (!grouped[item.section]) {
                            grouped[item.section] = [];
                        }
                        grouped[item.section].push(item);
                    });
                    setAttachmentsBySection(grouped);
                } catch (err) {
                    if (err?.code === 'ERR_CANCELED' || axios.isCancel?.(err)) return;
                    console.warn('Ошибка загрузки изображений формуляра:', err);
                    setAttachmentsBySection({});
                }

                try {
                    const personsRes = await axios.get(`${API_ROOT}/api/v1/persons/`, {
                        params: { target: targetId },
                        signal: controller.signal,
                    });
                    if (seq !== loadSeqRef.current) return;
                    setPersons(personsRes.data || []);
                } catch (err) {
                    if (err?.code === 'ERR_CANCELED' || axios.isCancel?.(err)) return;
                    setPersons([]);
                }
            } catch (error) {
                if (error?.code === 'ERR_CANCELED' || axios.isCancel?.(error)) return;
                if (seq !== loadSeqRef.current) return;
                console.error('Ошибка загрузки данных:', error);
                setErrors({ general: 'Не удалось загрузить данные объекта' });
            } finally {
                if (seq === loadSeqRef.current) {
                    setLoading(false);
                }
            }
        };

        loadData();
        return () => {
            controller.abort();
            loadSeqRef.current += 1;
        };
    }, [isOpen, targetId, refReloadToken]);
    
    const organizeIntoHierarchy = (sections) => {
        const sectionMap = {};
        const rootSections = [];
        
        sections.forEach(section => {
            sectionMap[section.id] = { ...section, children: [] };
        });
        
        sections.forEach(section => {
            if (section.parent) {
                const parent = sectionMap[section.parent];
                if (parent) {
                    parent.children.push(sectionMap[section.id]);
                }
            } else {
                rootSections.push(sectionMap[section.id]);
            }
        });
        
            const sortByOrder = (arr) => {
                const getOrderValue = (value) => {
                    const parsed = Number(value);
                    return Number.isFinite(parsed) ? parsed : 9999;
                };
                arr.sort((a, b) => getOrderValue(a.order) - getOrderValue(b.order));
            arr.forEach(item => {
                if (item.children.length > 0) {
                    sortByOrder(item.children);
                }
            });
        };
        sortByOrder(rootSections);
        
        return rootSections;
    };
    
    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
        if (errors[name]) {
            setErrors(prev => ({
                ...prev,
                [name]: null
            }));
        }
    };
    
    const handleFormularChange = (sectionId, value) => {
        setFormularData(prev => ({
            ...prev,
            [sectionId]: value
        }));
    };

    const handleAttachmentDraftChange = (sectionId, field, value) => {
        setAttachmentDrafts((prev) => ({
            ...prev,
            [sectionId]: {
                title: prev[sectionId]?.title || "",
                description: prev[sectionId]?.description || "",
                files: prev[sectionId]?.files || [],
                uploading: prev[sectionId]?.uploading || false,
                [field]: value
            }
        }));
    };

    const handleAttachmentUpload = async (sectionId) => {
        const draft = attachmentDrafts[sectionId];
        if (!draft?.files?.length || !draft.title?.trim()) return;

        handleAttachmentDraftChange(sectionId, "uploading", true);

        try {
            const uploaded = [];
            for (const file of draft.files) {
                const formData = new FormData();
                formData.append('target', targetId);
                formData.append('section', sectionId);
                formData.append('title', draft.title.trim());
                formData.append('description', draft.description || '');
                formData.append('image', file);

                const resp = await axios.post(`${API_ROOT}/api/v1/formular-attachments/`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                uploaded.push(resp.data);
            }

            setAttachmentsBySection((prev) => {
                const next = { ...prev };
                next[sectionId] = [...(next[sectionId] || []), ...uploaded];
                return next;
            });

            setAttachmentDrafts((prev) => ({
                ...prev,
                [sectionId]: { title: "", description: "", files: [], uploading: false }
            }));
        } catch (err) {
            console.error('Не удалось загрузить изображение:', err);
            handleAttachmentDraftChange(sectionId, "uploading", false);
        }
    };

    const handleAttachmentDelete = async (sectionId, attachmentId) => {
        try {
            await axios.delete(`${API_ROOT}/api/v1/formular-attachments/${attachmentId}/`);
            setAttachmentsBySection((prev) => {
                const next = { ...prev };
                next[sectionId] = (next[sectionId] || []).filter((item) => item.id !== attachmentId);
                return next;
            });
        } catch (err) {
            console.error('Не удалось удалить изображение:', err);
        }
    };
    
    const validateForm = () => {
        const newErrors = {};
        
        if (!formData.country) {
            newErrors.country = 'Выберите страну';
        }
        if (!formData.title.trim()) {
            newErrors.title = 'Введите наименование объекта';
        }
        if (!formData.lat || isNaN(parseFloat(formData.lat))) {
            newErrors.lat = 'Введите корректную широту';
        } else {
            const lat = parseFloat(formData.lat);
            if (lat < -90 || lat > 90) {
                newErrors.lat = 'Широта должна быть от -90 до 90';
            }
        }
        if (!formData.lng || isNaN(parseFloat(formData.lng))) {
            newErrors.lng = 'Введите корректную долготу';
        } else {
            const lng = parseFloat(formData.lng);
            if (lng < -180 || lng > 180) {
                newErrors.lng = 'Долгота должна быть от -180 до 180';
            }
        }
        
        formData.actions.forEach((action, index) => {
            const actionType = resolveActionType(action, actionTypes);
            const isInundation = isInundationRow(action);
            const isPolygon = isPolygonZoneMode(actionType?.zone_mode);

            if (isInundation) {
                if (!action.action_type_id) {
                    newErrors[`action_${index}_type`] = 'Выберите тип сценария';
                }
                if (!action.zone_geometry) {
                    newErrors[`action_${index}_polygon`] = 'Нарисуйте полигон зоны затопления';
                }
                return;
            }

            if (isPolygon) {
                if (!action.action_type_id) {
                    newErrors[`action_${index}_type`] = 'Выберите тип действия';
                }
                if (!action.zone_geometry) {
                    newErrors[`action_${index}_polygon`] = 'Нарисуйте полигон зоны';
                }
                return;
            }

            if (action.action_type_id && (!action.radius || parseFloat(action.radius) < 0)) {
                newErrors[`action_${index}_radius`] = 'Введите корректный радиус';
            }
            if (action.radius && parseFloat(action.radius) > 0 && !action.action_type_id) {
                newErrors[`action_${index}_type`] = 'Выберите тип действия';
            }
        });

        const equipmentRows = (formData.deployed_equipment || []).filter((row) => row.equipment_id);
        const seenEquipment = new Set();
        equipmentRows.forEach((row) => {
            const equipmentId = parseInt(row.equipment_id, 10);
            if (seenEquipment.has(equipmentId)) {
                newErrors.deployed_equipment = 'Один образец техники указан несколько раз';
            }
            seenEquipment.add(equipmentId);
        });
        equipmentRows.forEach((row, index) => {
            const qty = parseInt(row.quantity, 10);
            if (!qty || qty < 1) {
                newErrors[`equipment_${index}_qty`] = 'Минимум 1';
            }
        });
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const reloadPersons = async () => {
        if (!targetId) return;
        try {
            const res = await axios.get(`${API_ROOT}/api/v1/persons/`, { params: { target: targetId } });
            setPersons(res.data || []);
        } catch (err) {
            console.warn('Ошибка загрузки персоналий:', err);
        }
    };

    const handleDeletePerson = async (id) => {
        if (!window.confirm('Удалить лицо?')) return;
        try {
            await axios.delete(`${API_ROOT}/api/v1/persons/${id}/`);
            await reloadPersons();
        } catch (err) {
            console.error(err);
        }
    };

    const handleMovePerson = async (index, direction) => {
        const swapIndex = index + direction;
        if (swapIndex < 0 || swapIndex >= persons.length) return;

        const reordered = [...persons];
        [reordered[index], reordered[swapIndex]] = [reordered[swapIndex], reordered[index]];
        const updates = reordered.map((person, personIndex) => ({
            id: person.id,
            order: personIndex + 1,
        }));

        try {
            await Promise.all(
                updates.map((item) =>
                    axios.patch(`${API_ROOT}/api/v1/persons/${item.id}/`, { order: item.order }),
                ),
            );
            setPersons(
                reordered.map((person, personIndex) => ({
                    ...person,
                    order: personIndex + 1,
                })),
            );
        } catch (err) {
            console.error('Ошибка изменения порядка персоналий:', err);
            await reloadPersons();
        }
    };
    
    const handleSave = async () => {
        if (!validateForm()) {
            return;
        }
        
        setIsSubmitting(true);
        setErrors({});
        
        try {
            const dataToSend = {
                country: formData.country,
                title: formData.title.trim(),
                label: formData.label.trim() || null,
                type: formData.type || null,
                marker: formData.marker || null,
                parent: formData.parent || null,
                lat: parseFloat(formData.lat),
                lng: parseFloat(formData.lng),
                actions: formData.actions
                    .filter((action) => {
                        if (!action.action_type_id) return false;
                        const actionType = resolveActionType(action, actionTypes);
                        if (isInundationRow(action) || isPolygonZoneMode(actionType?.zone_mode)) {
                            return Boolean(action.zone_geometry);
                        }
                        return action.radius && parseFloat(action.radius) > 0;
                    })
                    .map((action) => {
                        const actionType = resolveActionType(action, actionTypes);
                        const payload = {
                            action_type_id: parseInt(action.action_type_id, 10),
                        };
                        if (isInundationRow(action)) {
                            payload.zone_geometry = action.zone_geometry;
                            payload.zone_metadata = {
                                water_level_m: action.zone_metadata?.water_level_m === ''
                                    ? null
                                    : Number(action.zone_metadata?.water_level_m),
                                seasonality: action.zone_metadata?.seasonality || '',
                                scenario_label: action.zone_metadata?.scenario_label || '',
                                notes: action.zone_metadata?.notes || '',
                            };
                            return payload;
                        }
                        if (isPolygonZoneMode(actionType?.zone_mode)) {
                            payload.zone_geometry = action.zone_geometry;
                            return payload;
                        }
                        payload.radius = parseFloat(action.radius);
                        return payload;
                    }),
                deployed_equipment: (formData.deployed_equipment || [])
                    .filter((row) => row.equipment_id)
                    .map((row) => ({
                        equipment_id: parseInt(row.equipment_id, 10),
                        quantity: parseInt(row.quantity, 10) || 1,
                    })),
            };
            
            await axios.put(`${API_ROOT}/api/v1/targets/${targetId}/`, dataToSend);
            
            // Сохраняем формуляр
            const items = Object.entries(formularData).map(([sectionId, content]) => ({
                section_id: parseInt(sectionId),
                content: content || ''
            }));
            
            await axios.post(`${API_ROOT}/api/v1/formular/${targetId}/bulk/`, { items });

            preserveLocalFormRef.current = false;
            
            if (onTargetUpdated) {
                onTargetUpdated();
            }
            
            onClose();
        } catch (error) {
            console.error('Ошибка при обновлении объекта:', error);
            if (error.response && error.response.data) {
                const apiErrors = error.response.data;
                if (typeof apiErrors.actions === 'string') {
                    setErrors({ general: apiErrors.actions });
                } else {
                    setErrors(apiErrors);
                }
            } else {
                setErrors({ general: 'Произошла ошибка при сохранении' });
            }
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const renderSection = (section, level = 0) => {
        if (section.is_hidden) return null;
        
        const hasChildren = section.children && section.children.length > 0;
        const isParent = hasChildren;
        const isRoot = level === 0;
        const attachments = attachmentsBySection[section.id] || [];
        const draft = attachmentDrafts[section.id] || { title: "", description: "", files: [], uploading: false };
        const isAttachmentFormOpen = !!attachmentFormsOpen[section.id];
        
        return (
            <div key={section.id} className={`edit-target-modal__section edit-target-modal__section--level-${level}`}>
                {isParent ? (
                    <h4 className={`edit-target-modal__section-title edit-target-modal__section-title--level-${level}`}>
                        {section.title}
                    </h4>
                ) : (
                    <div className={`edit-target-modal__field${isRoot ? " edit-target-modal__field--root" : ""}`}>
                        {isRoot ? (
                            <h4 className="edit-target-modal__section-title edit-target-modal__section-title--level-0">
                                {section.title}
                            </h4>
                        ) : (
                            <label className="edit-target-modal__label--small">
                                {section.title}
                            </label>
                        )}
                        <MarkdownEditor
                            className="edit-target-modal__markdown"
                            value={formularData[section.id] || ''}
                            onChange={(val) => handleFormularChange(section.id, val)}
                            placeholder="Введите информацию..."
                            rows={2}
                        />

                        <div className="edit-target-modal__attachments">
                            <div className="edit-target-modal__attachments-title">Изображения</div>
                            {attachments.length > 0 && (
                                <div className="edit-target-modal__attachments-list">
                                    {attachments.map((item) => (
                                        <div key={item.id} className="edit-target-modal__attachment-card">
                                            <button
                                                type="button"
                                                className="edit-target-modal__attachment-thumb"
                                                onClick={() => setPreviewImage(item)}
                                            >
                                                <img src={item.image} alt={item.title} />
                                            </button>
                                            <div className="edit-target-modal__attachment-info">
                                                <strong>{item.title}</strong>
                                                {item.description && (
                                                    <MarkdownContent variant="compact">{item.description}</MarkdownContent>
                                                )}
                                            </div>
                                            <button
                                                type="button"
                                                className="edit-target-modal__attachment-remove"
                                                onClick={() => handleAttachmentDelete(section.id, item.id)}
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {!isAttachmentFormOpen ? (
                                <button
                                    type="button"
                                    className="edit-target-modal__attachment-toggle"
                                    onClick={() =>
                                        setAttachmentFormsOpen((prev) => ({
                                            ...prev,
                                            [section.id]: true
                                        }))
                                    }
                                >
                                    Добавить изображение
                                </button>
                            ) : (
                                <div className="edit-target-modal__attachment-form">
                                    <input
                                        type="text"
                                        className="edit-target-modal__input"
                                        placeholder="Название изображения"
                                        value={draft.title}
                                        onChange={(e) => handleAttachmentDraftChange(section.id, "title", e.target.value)}
                                    />
                                    <MarkdownEditor
                                        variant="compact"
                                        value={draft.description}
                                        onChange={(val) => handleAttachmentDraftChange(section.id, 'description', val)}
                                        placeholder="Описание (необязательно)"
                                        rows={2}
                                    />
                                    <input
                                        type="file"
                                        accept="image/*"
                                        multiple
                                        onChange={(e) => handleAttachmentDraftChange(section.id, "files", Array.from(e.target.files || []))}
                                    />
                                    <div className="edit-target-modal__attachment-actions">
                                        <button
                                            type="button"
                                            className="edit-target-modal__button edit-target-modal__button--save"
                                            onClick={() => handleAttachmentUpload(section.id)}
                                            disabled={!draft.files.length || !draft.title?.trim() || draft.uploading}
                                        >
                                            {draft.uploading ? "Загрузка..." : "Добавить"}
                                        </button>
                                        <button
                                            type="button"
                                            className="edit-target-modal__button edit-target-modal__button--cancel"
                                            onClick={() =>
                                                setAttachmentFormsOpen((prev) => ({
                                                    ...prev,
                                                    [section.id]: false
                                                }))
                                            }
                                            disabled={draft.uploading}
                                        >
                                            Скрыть
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
                
                {hasChildren && (
                    <div className="edit-target-modal__subsections">
                        {section.children.map(child => renderSection(child, level + 1))}
                    </div>
                )}
            </div>
        );
    };
    
    if (!isOpen) return null;
    
    return (
        <div className="edit-target-modal__overlay">
            <div className="edit-target-modal__content" onClick={(e) => e.stopPropagation()}>
                <div className="edit-target-modal__header">
                    <h2>Редактирование объекта</h2>
                    <button 
                        className="edit-target-modal__close"
                        onClick={onClose}
                        aria-label="Закрыть"
                    >
                        ×
                    </button>
                </div>
                
                {errors.general && (
                    <div className="edit-target-modal__error-general">
                        {errors.general}
                    </div>
                )}
                
                <div className="edit-target-modal__tabs">
                    <button
                        className={`edit-target-modal__tab ${activeTab === 'target' ? 'edit-target-modal__tab--active' : ''}`}
                        onClick={() => setActiveTab('target')}
                    >
                        Основная информация
                    </button>
                    <button
                        className={`edit-target-modal__tab ${activeTab === 'equipment' ? 'edit-target-modal__tab--active' : ''}`}
                        onClick={() => setActiveTab('equipment')}
                    >
                        Вооружение и техника
                    </button>
                    <button
                        className={`edit-target-modal__tab ${activeTab === 'formular' ? 'edit-target-modal__tab--active' : ''}`}
                        onClick={() => setActiveTab('formular')}
                    >
                        Формуляр
                    </button>
                    <button
                        className={`edit-target-modal__tab ${activeTab === 'persons' ? 'edit-target-modal__tab--active' : ''}`}
                        onClick={() => setActiveTab('persons')}
                    >
                        Персоналии
                    </button>
                </div>
                
                <div className="edit-target-modal__body">
                    {loading ? (
                        <div className="edit-target-modal__loading">Загрузка...</div>
                    ) : (
                        <>
                            {activeTab === 'target' && (
                                <div className="edit-target-modal__tab-content">
                                    <div className="edit-target-modal__field">
                                        <label className="edit-target-modal__label">
                                            Страна <span className="edit-target-modal__required">*</span>
                                        </label>
                                        <div className="edit-target-modal__country-select" ref={countryDropdown.dropdownRef}>
                                            <button
                                                type="button"
                                                className={`edit-target-modal__country-trigger ${errors.country ? 'edit-target-modal__input--error' : ''}`}
                                                onClick={countryDropdown.handleToggle}
                                            >
                                                <span>{formData.country ? countries.find(c => c.id === formData.country)?.title || 'Выберите страну' : 'Выберите страну'}</span>
                                                <svg 
                                                    className={`edit-target-modal__country-arrow${countryDropdown.isOpen ? ' edit-target-modal__country-arrow--open' : ''}`}
                                                    width="20" 
                                                    height="20" 
                                                    viewBox="0 0 20 20"
                                                >
                                                    <path d="M5 7l5 5 5-5" stroke="currentColor" strokeWidth="2" fill="none"/>
                                                </svg>
                                            </button>
                                            
                                            {countryDropdown.isOpen && (
                                                <div className="edit-target-modal__country-dropdown">
                                                    <div className="edit-target-modal__search-wrapper">
                                                        <input
                                                            ref={countryDropdown.searchInputRef}
                                                            type="text"
                                                            className="edit-target-modal__search-input"
                                                            placeholder="Поиск страны..."
                                                            value={countryDropdown.search}
                                                            onChange={(e) => countryDropdown.setSearch(e.target.value)}
                                                            onClick={(e) => e.stopPropagation()}
                                                        />
                                                    </div>
                                                    <div className="edit-target-modal__country-list">
                                                        {countryDropdown.filtered.length > 0 ? (
                                                            countryDropdown.filtered.map(country => (
                                                                <button
                                                                    key={country.id}
                                                                    type="button"
                                                                    className={`edit-target-modal__country-option${formData.country === country.id ? ' edit-target-modal__country-option--selected' : ''}`}
                                                                    onClick={() => countryDropdown.handleSelect(country.id)}
                                                                >
                                                                    {country.title}
                                                                </button>
                                                            ))
                                                        ) : (
                                                            <div className="edit-target-modal__no-results">Ничего не найдено</div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        {errors.country && (
                                            <span className="edit-target-modal__error">{errors.country}</span>
                                        )}
                                    </div>
                                    
                                    <div className="edit-target-modal__field">
                                        <label className="edit-target-modal__label">Тип объекта</label>
                                        <select
                                            name="type"
                                            value={formData.type}
                                            onChange={handleChange}
                                            className={`edit-target-modal__select ${errors.type ? 'edit-target-modal__input--error' : ''}`}
                                        >
                                            <option value="">Выберите тип</option>
                                            {typeSelectOptions.map(({ node, depth }) => (
                                                <option key={node.id} value={node.id}>
                                                    {formatTypeOptionLabel(node.title, depth)}
                                                </option>
                                            ))}
                                        </select>
                                        {errors.type && (
                                            <span className="edit-target-modal__error">{errors.type}</span>
                                        )}
                                    </div>

                                    <div className="edit-target-modal__field">
                                        <label className="edit-target-modal__label">
                                            Наименование объекта <span className="edit-target-modal__required">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            name="title"
                                            value={formData.title}
                                            onChange={handleChange}
                                            className={`edit-target-modal__input ${errors.title ? 'edit-target-modal__input--error' : ''}`}
                                            placeholder="Введите название"
                                        />
                                        {errors.title && (
                                            <span className="edit-target-modal__error">{errors.title}</span>
                                        )}
                                    </div>
                                    
                                    <div className="edit-target-modal__field">
                                        <label className="edit-target-modal__label">
                                            Метка
                                        </label>
                                        <input
                                            type="text"
                                            name="label"
                                            value={formData.label}
                                            onChange={handleChange}
                                            className="edit-target-modal__input"
                                            placeholder="Введите метку (необязательно)"
                                        />
                                    </div>
                                    
                                    <div className="edit-target-modal__field">
                                        <label className="edit-target-modal__label">
                                            Маркер
                                        </label>
                                        <div className="edit-target-modal__marker-select" ref={markerDropdown.dropdownRef}>
                                            <button
                                                type="button"
                                                className="edit-target-modal__marker-trigger"
                                                onClick={markerDropdown.handleToggle}
                                            >
                                                {formData.marker ? (
                                                    <div className="edit-target-modal__marker-selected">
                                                        {markerSvgs.get(formData.marker) && (
                                                            <div 
                                                                className="edit-target-modal__marker-icon"
                                                                dangerouslySetInnerHTML={{ 
                                                                    __html: addColorClassToSvg(
                                                                        markerSvgs.get(formData.marker), 
                                                                        selectedCountryColor
                                                                    ) 
                                                                }}
                                                            />
                                                        )}
                                                        <span>{markers.find(m => m.id === formData.marker)?.title || 'Выберите маркер'}</span>
                                                    </div>
                                                ) : (
                                                    <span>Без маркера</span>
                                                )}
                                                <svg 
                                                    className={`edit-target-modal__marker-arrow${markerDropdown.isOpen ? ' edit-target-modal__marker-arrow--open' : ''}`}
                                                    width="20" 
                                                    height="20" 
                                                    viewBox="0 0 20 20"
                                                >
                                                    <path d="M5 7l5 5 5-5" stroke="currentColor" strokeWidth="2" fill="none"/>
                                                </svg>
                                            </button>
                                            
                                            {markerDropdown.isOpen && (
                                                <div className="edit-target-modal__marker-dropdown">
                                                    <div className="edit-target-modal__search-wrapper">
                                                        <input
                                                            ref={markerDropdown.searchInputRef}
                                                            type="text"
                                                            className="edit-target-modal__search-input"
                                                            placeholder="Поиск маркера..."
                                                            value={markerDropdown.search}
                                                            onChange={(e) => markerDropdown.setSearch(e.target.value)}
                                                            onClick={(e) => e.stopPropagation()}
                                                        />
                                                    </div>
                                                    <div className="edit-target-modal__marker-list">
                                                        <button
                                                            type="button"
                                                            className={`edit-target-modal__marker-option${!formData.marker ? ' edit-target-modal__marker-option--selected' : ''}`}
                                                            onClick={() => markerDropdown.handleSelect('')}
                                                        >
                                                            <span>Без маркера</span>
                                                        </button>
                                                        {markerDropdown.filtered.length > 0 ? (
                                                            markerDropdown.filtered.map(marker => (
                                                                <button
                                                                    key={marker.id}
                                                                    type="button"
                                                                    className={`edit-target-modal__marker-option${formData.marker === marker.id ? ' edit-target-modal__marker-option--selected' : ''}`}
                                                                    onClick={() => markerDropdown.handleSelect(marker.id)}
                                                                >
                                                                    {markerSvgs.get(marker.id) && (
                                                                        <div 
                                                                            className="edit-target-modal__marker-icon"
                                                                            dangerouslySetInnerHTML={{ 
                                                                                __html: addColorClassToSvg(
                                                                                    markerSvgs.get(marker.id), 
                                                                                    selectedCountryColor
                                                                                ) 
                                                                            }}
                                                                        />
                                                                    )}
                                                                    <span>{marker.title}</span>
                                                                </button>
                                                            ))
                                                        ) : (
                                                            <div className="edit-target-modal__no-results">Ничего не найдено</div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Выбор parent */}
                                    <div className="edit-target-modal__field">
                                        <label className="edit-target-modal__label">Вышестоящий объект (parent)</label>
                                        <div className="edit-target-modal__marker-select" ref={parentDropdown.dropdownRef}>
                                            <button
                                                type="button"
                                                className={`edit-target-modal__marker-trigger ${errors.parent ? 'edit-target-modal__input--error' : ''}`}
                                                onClick={parentDropdown.handleToggle}
                                            >
                                                <span>{formData.parent ? parentOptions.find(p => p.id === formData.parent)?.title || 'Выберите вышестоящий' : 'Выберите вышестоящий (необязательно)'}</span>
                                                <svg 
                                                    className={`edit-target-modal__marker-arrow${parentDropdown.isOpen ? ' edit-target-modal__marker-arrow--open' : ''}`}
                                                    width="20" 
                                                    height="20" 
                                                    viewBox="0 0 20 20"
                                                >
                                                    <path d="M5 7l5 5 5-5" stroke="currentColor" strokeWidth="2" fill="none"/>
                                                </svg>
                                            </button>
                                            
                                            {parentDropdown.isOpen && (
                                                <div className="edit-target-modal__marker-dropdown">
                                                    <div className="edit-target-modal__search-wrapper">
                                                        <input
                                                            ref={parentDropdown.searchInputRef}
                                                            type="text"
                                                            className="edit-target-modal__search-input"
                                                            placeholder="Поиск объекта..."
                                                            value={parentDropdown.search}
                                                            onChange={(e) => parentDropdown.setSearch(e.target.value)}
                                                            onClick={(e) => e.stopPropagation()}
                                                        />
                                                    </div>
                                                    <div className="edit-target-modal__marker-list">
                                                        <button
                                                            type="button"
                                                            className={`edit-target-modal__marker-option${!formData.parent ? ' edit-target-modal__marker-option--selected' : ''}`}
                                                            onClick={() => parentDropdown.handleSelect('')}
                                                        >
                                                            (нет)
                                                        </button>
                                                        {parentDropdown.filtered.length > 0 ? (
                                                            parentDropdown.filtered.map(p => (
                                                                <button
                                                                    key={p.id}
                                                                    type="button"
                                                                    className={`edit-target-modal__marker-option${formData.parent === p.id ? ' edit-target-modal__marker-option--selected' : ''}`}
                                                                    onClick={() => parentDropdown.handleSelect(p.id)}
                                                                >
                                                                    {p.title}
                                                                </button>
                                                            ))
                                                        ) : (
                                                            <div className="edit-target-modal__no-results">Ничего не найдено</div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        {errors.parent && (
                                            <span className="edit-target-modal__error">{errors.parent}</span>
                                        )}
                                    </div>
                                    
                                    <div className="edit-target-modal__row">
                                        <div className="edit-target-modal__field">
                                            <label className="edit-target-modal__label">
                                                Широта <span className="edit-target-modal__required">*</span>
                                            </label>
                                            <input
                                                type="number"
                                                name="lat"
                                                value={formData.lat}
                                                onChange={handleChange}
                                                step="0.000001"
                                                className={`edit-target-modal__input ${errors.lat ? 'edit-target-modal__input--error' : ''}`}
                                                placeholder="Например: 55.751244"
                                            />
                                            {errors.lat && (
                                                <span className="edit-target-modal__error">{errors.lat}</span>
                                            )}
                                        </div>
                                        
                                        <div className="edit-target-modal__field">
                                            <label className="edit-target-modal__label">
                                                Долгота <span className="edit-target-modal__required">*</span>
                                            </label>
                                            <input
                                                type="number"
                                                name="lng"
                                                value={formData.lng}
                                                onChange={handleChange}
                                                step="0.000001"
                                                className={`edit-target-modal__input ${errors.lng ? 'edit-target-modal__input--error' : ''}`}
                                                placeholder="Например: 37.618423"
                                            />
                                            {errors.lng && (
                                                <span className="edit-target-modal__error">{errors.lng}</span>
                                            )}
                                        </div>
                                    </div>

                                    {showInundationSection && (
                                        <div className="edit-target-modal__section">
                                            <div className="edit-target-modal__section-header">
                                                <label className="edit-target-modal__label">
                                                    Зоны затопления
                                                </label>
                                                <button
                                                    type="button"
                                                    className="edit-target-modal__button-add-action"
                                                    onClick={handleAddInundationAction}
                                                >
                                                    + Добавить сценарий
                                                </button>
                                            </div>
                                            {formData.actions.map((action, index) => {
                                                if (!isInundationRow(action)) return null;

                                                const metadata = action.zone_metadata || {};
                                                return (
                                                    <div key={`inundation-${index}`} className="edit-target-modal__action-item edit-target-modal__action-item--inundation">
                                                        <div className="edit-target-modal__action-fields">
                                                            <div className="edit-target-modal__field">
                                                                <label className="edit-target-modal__label--small">Тип сценария</label>
                                                                <select
                                                                    value={action.action_type_id}
                                                                    onChange={(e) => handleActionChange(index, 'action_type_id', e.target.value)}
                                                                    className={`edit-target-modal__select ${errors[`action_${index}_type`] ? 'edit-target-modal__input--error' : ''}`}
                                                                >
                                                                    <option value="">Выберите тип</option>
                                                                    {inundationActionTypes.map((type) => (
                                                                        <option key={type.id} value={type.id}>{type.title}</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                            <div className="edit-target-modal__field">
                                                                <label className="edit-target-modal__label--small">Уровень воды, м</label>
                                                                <input
                                                                    type="number"
                                                                    value={metadata.water_level_m ?? ''}
                                                                    onChange={(e) => handleInundationMetadataChange(index, 'water_level_m', e.target.value)}
                                                                    step="0.1"
                                                                    className="edit-target-modal__input"
                                                                />
                                                            </div>
                                                            <div className="edit-target-modal__field">
                                                                <label className="edit-target-modal__label--small">Сезонность</label>
                                                                <input
                                                                    type="text"
                                                                    value={metadata.seasonality ?? ''}
                                                                    onChange={(e) => handleInundationMetadataChange(index, 'seasonality', e.target.value)}
                                                                    className="edit-target-modal__input"
                                                                    placeholder="Например: паводок"
                                                                />
                                                            </div>
                                                            <div className="edit-target-modal__field">
                                                                <label className="edit-target-modal__label--small">Подпись сценария</label>
                                                                <input
                                                                    type="text"
                                                                    value={metadata.scenario_label ?? ''}
                                                                    onChange={(e) => handleInundationMetadataChange(index, 'scenario_label', e.target.value)}
                                                                    className="edit-target-modal__input"
                                                                    placeholder="Например: НПУ"
                                                                />
                                                            </div>
                                                        </div>
                                                        <div className="edit-target-modal__inundation-actions">
                                                            <button
                                                                type="button"
                                                                className="edit-target-modal__button-add-action"
                                                                onClick={() => handleStartPolygonDraw(index)}
                                                            >
                                                                {action.zone_geometry ? 'Перерисовать на карте' : 'Нарисовать на карте'}
                                                            </button>
                                                            {action.zone_geometry && (
                                                                <button
                                                                    type="button"
                                                                    className="edit-target-modal__button-secondary"
                                                                    onClick={() => handleClearPolygon(index)}
                                                                >
                                                                    Очистить полигон
                                                                </button>
                                                            )}
                                                            <span className="edit-target-modal__polygon-status">
                                                                {action.zone_geometry ? 'Полигон задан' : 'Полигон не задан'}
                                                            </span>
                                                            {errors[`action_${index}_polygon`] && (
                                                                <span className="edit-target-modal__error">{errors[`action_${index}_polygon`]}</span>
                                                            )}
                                                        </div>
                                                        <ActionPolygonCoordinateField
                                                            zoneGeometry={action.zone_geometry}
                                                            onGeometryChange={(geometry, editable) => handlePolygonPointsChange(index, geometry, editable)}
                                                            error={errors[`action_${index}_polygon`]}
                                                        />
                                                        <button
                                                            type="button"
                                                            className="edit-target-modal__button-remove-action"
                                                            onClick={() => handleRemoveAction(index)}
                                                            aria-label="Удалить сценарий"
                                                        >
                                                            ×
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                    
                                    <div className="edit-target-modal__section">
                                        <div className="edit-target-modal__section-header">
                                            <label className="edit-target-modal__label">
                                                Действия объекта
                                            </label>
                                            <button
                                                type="button"
                                                className="edit-target-modal__button-add-action"
                                                onClick={handleAddAction}
                                            >
                                                + Добавить действие
                                            </button>
                                        </div>
                                        
                                        {formData.actions.length > 0 && (
                                            <div className="edit-target-modal__actions-list">
                                                {formData.actions.map((action, index) => {
                                                    if (isInundationRow(action)) return null;
                                                    const actionType = resolveActionType(action, actionTypes);
                                                    const isPolygon = isPolygonZoneMode(actionType?.zone_mode);
                                                    return (
                                                    <div key={index} className={`edit-target-modal__action-item${isPolygon ? ' edit-target-modal__action-item--inundation' : ''}`}>
                                                        <div className="edit-target-modal__action-fields">
                                                            <div className="edit-target-modal__field">
                                                                <label className="edit-target-modal__label--small">
                                                                    Тип действия
                                                                </label>
                                                                <select
                                                                    value={action.action_type_id}
                                                                    onChange={(e) => handleActionChange(index, 'action_type_id', e.target.value)}
                                                                    className={`edit-target-modal__select ${errors[`action_${index}_type`] ? 'edit-target-modal__input--error' : ''}`}
                                                                >
                                                                    <option value="">Выберите тип</option>
                                                                    {regularActionTypes.map(type => (
                                                                        <option key={type.id} value={type.id}>
                                                                            {type.title}
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                                {errors[`action_${index}_type`] && (
                                                                    <span className="edit-target-modal__error">{errors[`action_${index}_type`]}</span>
                                                                )}
                                                            </div>

                                                            {!isPolygon && (
                                                            <div className="edit-target-modal__field">
                                                                <label className="edit-target-modal__label--small">
                                                                    Радиус, км
                                                                </label>
                                                                <input
                                                                    type="number"
                                                                    value={action.radius}
                                                                    onChange={(e) => handleActionChange(index, 'radius', e.target.value)}
                                                                    step="0.1"
                                                                    min="0"
                                                                    className={`edit-target-modal__input ${errors[`action_${index}_radius`] ? 'edit-target-modal__input--error' : ''}`}
                                                                    placeholder="0"
                                                                />
                                                                {errors[`action_${index}_radius`] && (
                                                                    <span className="edit-target-modal__error">{errors[`action_${index}_radius`]}</span>
                                                                )}
                                                            </div>
                                                            )}
                                                        </div>

                                                        {isPolygon && (
                                                            <div className="edit-target-modal__inundation-actions">
                                                                <button
                                                                    type="button"
                                                                    className="edit-target-modal__button-add-action"
                                                                    onClick={() => handleStartPolygonDraw(index)}
                                                                >
                                                                    {action.zone_geometry ? 'Перерисовать на карте' : 'Нарисовать на карте'}
                                                                </button>
                                                                {action.zone_geometry && (
                                                                    <button
                                                                        type="button"
                                                                        className="edit-target-modal__button-secondary"
                                                                        onClick={() => handleClearPolygon(index)}
                                                                    >
                                                                        Очистить полигон
                                                                    </button>
                                                                )}
                                                                <span className="edit-target-modal__polygon-status">
                                                                    {action.zone_geometry ? 'Полигон задан' : 'Полигон не задан'}
                                                                </span>
                                                                {errors[`action_${index}_polygon`] && (
                                                                    <span className="edit-target-modal__error">{errors[`action_${index}_polygon`]}</span>
                                                                )}
                                                            </div>
                                                        )}
                                                        {isPolygon && (
                                                            <ActionPolygonCoordinateField
                                                                zoneGeometry={action.zone_geometry}
                                                                onGeometryChange={(geometry, editable) => handlePolygonPointsChange(index, geometry, editable)}
                                                                error={errors[`action_${index}_polygon`]}
                                                            />
                                                        )}
                                                        
                                                        <button
                                                            type="button"
                                                            className="edit-target-modal__button-remove-action"
                                                            onClick={() => handleRemoveAction(index)}
                                                            aria-label="Удалить действие"
                                                        >
                                                            ×
                                                        </button>
                                                    </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'equipment' && (
                                <div className="edit-target-modal__tab-content">
                                    <TargetEquipmentEditor
                                        deployedEquipment={formData.deployed_equipment}
                                        catalog={equipmentCatalog}
                                        errors={errors}
                                        onAddEquipment={handleAddEquipmentWithId}
                                        onRemove={handleRemoveEquipment}
                                        onChange={handleEquipmentChange}
                                    />
                                </div>
                            )}
                            
                            {activeTab === 'formular' && (
                                <div className="edit-target-modal__tab-content">
                                    {sections.map(section => renderSection(section))}
                                </div>
                            )}

                            {activeTab === 'persons' && (
                                <div className="edit-target-modal__tab-content">
                                    <div className="edit-target-modal__persons-toolbar">
                                        <button
                                            type="button"
                                            className="edit-target-modal__button-add-action"
                                            onClick={() => {
                                                setEditingPersonId(null);
                                                setPersonEditorOpen(true);
                                            }}
                                        >
                                            + Добавить лицо
                                        </button>
                                    </div>
                                    {persons.length === 0 ? (
                                        <p className="edit-target-modal__persons-empty">Персоналии не указаны.</p>
                                    ) : (
                                        <ul className="edit-target-modal__persons-list">
                                            {persons.map((person, index) => (
                                                <li key={person.id} className="edit-target-modal__persons-item">
                                                    <div className="edit-target-modal__persons-order">
                                                        <button
                                                            type="button"
                                                            className="edit-target-modal__persons-order-btn"
                                                            onClick={() => handleMovePerson(index, -1)}
                                                            disabled={index === 0}
                                                            aria-label="Переместить выше"
                                                            title="Выше"
                                                        >
                                                            ↑
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="edit-target-modal__persons-order-btn"
                                                            onClick={() => handleMovePerson(index, 1)}
                                                            disabled={index === persons.length - 1}
                                                            aria-label="Переместить ниже"
                                                            title="Ниже"
                                                        >
                                                            ↓
                                                        </button>
                                                    </div>
                                                    <img
                                                        className="edit-target-modal__persons-avatar"
                                                        src={person.avatar || noUserIcon}
                                                        alt=""
                                                    />
                                                    <div className="edit-target-modal__persons-info">
                                                        <div className="edit-target-modal__persons-name">
                                                            {person.full_name}
                                                        </div>
                                                        {person.position && (
                                                            <div className="edit-target-modal__persons-position">
                                                                {person.position}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="edit-target-modal__persons-actions">
                                                        <button
                                                            type="button"
                                                            className="edit-target-modal__persons-action edit-target-modal__persons-action--edit"
                                                            onClick={() => {
                                                                setEditingPersonId(person.id);
                                                                setPersonEditorOpen(true);
                                                            }}
                                                        >
                                                            Редактировать
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="edit-target-modal__persons-action edit-target-modal__persons-action--delete"
                                                            onClick={() => handleDeletePerson(person.id)}
                                                        >
                                                            Удалить
                                                        </button>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
                
                <div className="edit-target-modal__footer">
                    <button
                        type="button"
                        className="edit-target-modal__button edit-target-modal__button--cancel"
                        onClick={onClose}
                        disabled={isSubmitting}
                    >
                        Отмена
                    </button>
                    <button
                        type="button"
                        className="edit-target-modal__button edit-target-modal__button--save"
                        onClick={handleSave}
                        disabled={isSubmitting || loading}
                    >
                        {isSubmitting ? 'Сохранение...' : 'Сохранить изменения'}
                    </button>
                </div>
            </div>
            {previewImage && (
                <div className="edit-target-modal__image-preview" onClick={() => setPreviewImage(null)}>
                    <div className="edit-target-modal__image-preview-content" onClick={(e) => e.stopPropagation()}>
                        <button
                            type="button"
                            className="edit-target-modal__image-preview-close"
                            onClick={() => setPreviewImage(null)}
                            aria-label="Закрыть"
                        >
                            ×
                        </button>
                        <img src={previewImage.image} alt={previewImage.title} />
                        <div className="edit-target-modal__image-preview-caption">
                            <strong>{previewImage.title}</strong>
                            {previewImage.description && (
                                <MarkdownContent variant="compact">{previewImage.description}</MarkdownContent>
                            )}
                        </div>
                    </div>
                </div>
            )}
            {personEditorOpen && (
                <PersonEditor
                    personId={editingPersonId}
                    targetId={targetId}
                    isOpen={personEditorOpen}
                    onClose={() => {
                        setPersonEditorOpen(false);
                        setEditingPersonId(null);
                    }}
                    onSaved={reloadPersons}
                />
            )}
        </div>
    );
}
