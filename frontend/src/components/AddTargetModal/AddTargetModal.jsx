import { useState, useMemo, useEffect } from 'react';
import axios from 'axios';
import { addColorClassToSvg } from '../../utils/svgUtils';
import { useActionsArray } from '../../hooks/useActionsArray';
import { useDropdownWithSearch } from '../../hooks/useDropdownWithSearch';
import { useTargetFormData } from '../../hooks/useTargetFormData';
import {
    buildTargetTypeTree,
    flattenTargetTypeTree,
    formatTypeOptionLabel,
    filterTargetTypesForCountry,
    filterParentOptionsForTarget,
} from '../../utils/targetTypeTree';
import './AddTargetModal.css';

import { API_URL } from '../../config/api';

const API_ROOT = API_URL;

const formatCoord = (value) => {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return '';
    return Number(value).toFixed(6);
};

export default function AddTargetModal({
    isOpen,
    onClose,
    initialCoords = null,
    onTargetAdded,
    onTargetAddedWithFormular,
    cachedTargets = null,
}) {
    const [formData, setFormData] = useState({
        country: '',
        title: '',
        label: '',
        type: '',
        marker: '',
        parent: '',
        lat: '',
        lng: '',
        actions: []
    });
    
    // Используем хук для загрузки справочников
    const { countries, markers, actionTypes, targetTypes, targets, markerSvgs } = useTargetFormData(isOpen, cachedTargets);

    const typeSelectOptions = useMemo(() => {
        const applicable = filterTargetTypesForCountry(targetTypes, formData.country);
        return flattenTargetTypeTree(buildTargetTypeTree(applicable));
    }, [targetTypes, formData.country]);
    
    const [errors, setErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Хуки для управления actions
    const { handleAddAction, handleRemoveAction, handleActionChange } = useActionsArray(formData, setFormData);
    
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
    
    // Dropdown для выбора parent (вышестоящий объект)
    const parentOptions = useMemo(
        () => filterParentOptionsForTarget(targets, targetTypes, {
            countryId: formData.country,
            typeId: formData.type,
        }),
        [targets, targetTypes, formData.country, formData.type],
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

    useEffect(() => {
        if (!isOpen || !initialCoords) return;

        const countryId = initialCoords.countryIso
            ? countries.find((c) => c.iso_code === initialCoords.countryIso)?.id || ''
            : '';

        setFormData((prev) => ({
            ...prev,
            lat: formatCoord(initialCoords.lat),
            lng: formatCoord(initialCoords.lng),
            country: countryId || prev.country,
        }));
    }, [isOpen, initialCoords, countries]);

    // Получаем цвет выбранной страны
    const selectedCountryColor = formData.country 
        ? countries.find(c => c.id === formData.country)?.color || 'blue'
        : 'blue';
    
    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
        // Очищаем ошибку для этого поля
        if (errors[name]) {
            setErrors(prev => ({
                ...prev,
                [name]: null
            }));
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
        
        // Валидация действий
        formData.actions.forEach((action, index) => {
            if (action.action_type_id && (!action.radius || parseFloat(action.radius) < 0)) {
                newErrors[`action_${index}_radius`] = 'Введите корректный радиус';
            }
            if (action.radius && parseFloat(action.radius) > 0 && !action.action_type_id) {
                newErrors[`action_${index}_type`] = 'Выберите тип действия';
            }
        });
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };
    
    const handleSubmit = async (e, openFormular = false) => {
        e.preventDefault();
        
        if (!validateForm()) {
            return;
        }
        
        setIsSubmitting(true);
        
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
                    .filter(action => action.action_type_id && action.radius > 0)
                    .map(action => ({
                        action_type_id: parseInt(action.action_type_id),
                        radius: parseFloat(action.radius)
                    }))
            };
            
            const response = await axios.post(`${API_ROOT}/api/v1/targets/`, dataToSend);
            
            // Сбрасываем форму
            setFormData({
                country: '',
                title: '',
                label: '',
                type: '',
                marker: '',
                parent: '',
                lat: '',
                lng: '',
                actions: []
            });
            setErrors({});
            
            // Закрываем модальное окно
            onClose();
            
            // Уведомляем родительский компонент об успешном добавлении
            if (openFormular && onTargetAddedWithFormular) {
                onTargetAddedWithFormular(response.data);
            } else if (onTargetAdded) {
                onTargetAdded(response.data);
            }
        } catch (error) {
            console.error('Ошибка при добавлении объекта:', error);
            if (error.response && error.response.data) {
                setErrors(error.response.data);
            } else {
                setErrors({ general: 'Произошла ошибка при сохранении объекта' });
            }
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const handleClose = () => {
        setFormData({
            country: '',
            title: '',
            label: '',
            type: '',
            marker: '',
            parent: '',
            lat: '',
            lng: '',
            actions: []
        });
        setErrors({});
        onClose();
    };
    
    if (!isOpen) return null;
    
    return (
        <div className="add-target-modal__overlay">
            <div className="add-target-modal__content" onClick={(e) => e.stopPropagation()}>
                <div className="add-target-modal__header">
                    <h2>Добавить объект</h2>
                    <button 
                        className="add-target-modal__close"
                        onClick={handleClose}
                        aria-label="Закрыть"
                    >
                        ×
                    </button>
                </div>
                
                {errors.general && (
                    <div className="add-target-modal__error-general">
                        {errors.general}
                    </div>
                )}
                
                <form className="add-target-modal__form" onSubmit={handleSubmit}>
                    <div className="add-target-modal__field">
                        <label className="add-target-modal__label">
                            Страна <span className="add-target-modal__required">*</span>
                        </label>
                        <div className="add-target-modal__country-select" ref={countryDropdown.dropdownRef}>
                            <button
                                type="button"
                                className={`add-target-modal__country-trigger ${errors.country ? 'add-target-modal__input--error' : ''}`}
                                onClick={countryDropdown.handleToggle}
                            >
                                <span>{formData.country ? countries.find(c => c.id === formData.country)?.title || 'Выберите страну' : 'Выберите страну'}</span>
                                <svg 
                                    className={`add-target-modal__country-arrow${countryDropdown.isOpen ? ' add-target-modal__country-arrow--open' : ''}`}
                                    width="20" 
                                    height="20" 
                                    viewBox="0 0 20 20"
                                >
                                    <path d="M5 7l5 5 5-5" stroke="currentColor" strokeWidth="2" fill="none"/>
                                </svg>
                            </button>
                            
                            {countryDropdown.isOpen && (
                                <div className="add-target-modal__country-dropdown">
                                    <div className="add-target-modal__search-wrapper">
                                        <input
                                            ref={countryDropdown.searchInputRef}
                                            type="text"
                                            className="add-target-modal__search-input"
                                            placeholder="Поиск страны..."
                                            value={countryDropdown.search}
                                            onChange={(e) => countryDropdown.setSearch(e.target.value)}
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    </div>
                                    <div className="add-target-modal__country-list">
                                        {countryDropdown.filtered.length > 0 ? (
                                            countryDropdown.filtered.map(country => (
                                                <button
                                                    key={country.id}
                                                    type="button"
                                                    className={`add-target-modal__country-option${formData.country === country.id ? ' add-target-modal__country-option--selected' : ''}`}
                                                    onClick={() => countryDropdown.handleSelect(country.id)}
                                                >
                                                    {country.title}
                                                </button>
                                            ))
                                        ) : (
                                            <div className="add-target-modal__no-results">Ничего не найдено</div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                        {errors.country && (
                            <span className="add-target-modal__error">{errors.country}</span>
                        )}
                    </div>

                    <div className="add-target-modal__field">
                        <label className="add-target-modal__label">Тип объекта</label>
                        <select
                            name="type"
                            value={formData.type}
                            onChange={handleChange}
                            className={`add-target-modal__select ${errors.type ? 'add-target-modal__input--error' : ''}`}
                        >
                            <option value="">Выберите тип</option>
                            {typeSelectOptions.map(({ node, depth }) => (
                                <option key={node.id} value={node.id}>
                                    {formatTypeOptionLabel(node.title, depth)}
                                </option>
                            ))}
                        </select>
                        {errors.type && (
                            <span className="add-target-modal__error">{errors.type}</span>
                        )}
                    </div>

                    {/* Выбор вышестоящего объекта (parent) */}
                    <div className="add-target-modal__field">
                        <label className="add-target-modal__label">Вышестоящий объект (parent)</label>
                        <div className="add-target-modal__country-select" ref={parentDropdown.dropdownRef}>
                            <button
                                type="button"
                                className={`add-target-modal__country-trigger ${errors.parent ? 'add-target-modal__input--error' : ''}`}
                                onClick={parentDropdown.handleToggle}
                            >
                                <span>{formData.parent ? parentOptions.find(p => p.id === formData.parent)?.title || 'Выберите вышестоящий' : 'Выберите вышестоящий (необязательно)'}</span>
                                <svg 
                                    className={`add-target-modal__country-arrow${parentDropdown.isOpen ? ' add-target-modal__country-arrow--open' : ''}`}
                                    width="20" 
                                    height="20" 
                                    viewBox="0 0 20 20"
                                >
                                    <path d="M5 7l5 5 5-5" stroke="currentColor" strokeWidth="2" fill="none"/>
                                </svg>
                            </button>
                            
                            {parentDropdown.isOpen && (
                                <div className="add-target-modal__country-dropdown">
                                    <div className="add-target-modal__search-wrapper">
                                        <input
                                            ref={parentDropdown.searchInputRef}
                                            type="text"
                                            className="add-target-modal__search-input"
                                            placeholder="Поиск объекта..."
                                            value={parentDropdown.search}
                                            onChange={(e) => parentDropdown.setSearch(e.target.value)}
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    </div>
                                    <div className="add-target-modal__country-list">
                                        {parentDropdown.filtered.length > 0 ? (
                                            parentDropdown.filtered.map(p => (
                                                <button
                                                    key={p.id}
                                                    type="button"
                                                    className={`add-target-modal__country-option${formData.parent === p.id ? ' add-target-modal__country-option--selected' : ''}`}
                                                    onClick={() => parentDropdown.handleSelect(p.id)}
                                                >
                                                    {p.title}
                                                </button>
                                            ))
                                        ) : (
                                            <div className="add-target-modal__no-results">Ничего не найдено</div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                        {errors.parent && (
                            <span className="add-target-modal__error">{errors.parent}</span>
                        )}
                    </div>
                    
                    <div className="add-target-modal__field">
                        <label className="add-target-modal__label">
                            Наименование объекта <span className="add-target-modal__required">*</span>
                        </label>
                        <input
                            type="text"
                            name="title"
                            value={formData.title}
                            onChange={handleChange}
                            className={`add-target-modal__input ${errors.title ? 'add-target-modal__input--error' : ''}`}
                            placeholder="Введите название"
                        />
                        {errors.title && (
                            <span className="add-target-modal__error">{errors.title}</span>
                        )}
                    </div>
                    
                    <div className="add-target-modal__field">
                        <label className="add-target-modal__label">
                            Метка
                        </label>
                        <input
                            type="text"
                            name="label"
                            value={formData.label}
                            onChange={handleChange}
                            className="add-target-modal__input"
                            placeholder="Введите метку (необязательно)"
                        />
                    </div>
                    
                    <div className="add-target-modal__field">
                        <label className="add-target-modal__label">
                            Маркер
                        </label>
                        <div className="add-target-modal__marker-select" ref={markerDropdown.dropdownRef}>
                            <button
                                type="button"
                                className="add-target-modal__marker-trigger"
                                onClick={markerDropdown.handleToggle}
                            >
                                {formData.marker ? (
                                    <div className="add-target-modal__marker-selected">
                                        {markerSvgs.get(formData.marker) && (
                                            <div 
                                                className="add-target-modal__marker-icon"
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
                                    className={`add-target-modal__marker-arrow${markerDropdown.isOpen ? ' add-target-modal__marker-arrow--open' : ''}`}
                                    width="20" 
                                    height="20" 
                                    viewBox="0 0 20 20"
                                >
                                    <path d="M5 7l5 5 5-5" stroke="currentColor" strokeWidth="2" fill="none"/>
                                </svg>
                            </button>
                            
                            {markerDropdown.isOpen && (
                                <div className="add-target-modal__marker-dropdown">
                                    <div className="add-target-modal__search-wrapper">
                                        <input
                                            ref={markerDropdown.searchInputRef}
                                            type="text"
                                            className="add-target-modal__search-input"
                                            placeholder="Поиск маркера..."
                                            value={markerDropdown.search}
                                            onChange={(e) => markerDropdown.setSearch(e.target.value)}
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    </div>
                                    <div className="add-target-modal__marker-list">
                                        <button
                                            type="button"
                                            className={`add-target-modal__marker-option${!formData.marker ? ' add-target-modal__marker-option--selected' : ''}`}
                                            onClick={() => markerDropdown.handleSelect('')}
                                        >
                                            <span>Без маркера</span>
                                        </button>
                                        {markerDropdown.filtered.length > 0 ? (
                                            markerDropdown.filtered.map(marker => (
                                                <button
                                                    key={marker.id}
                                                    type="button"
                                                    className={`add-target-modal__marker-option${formData.marker === marker.id ? ' add-target-modal__marker-option--selected' : ''}`}
                                                    onClick={() => markerDropdown.handleSelect(marker.id)}
                                                >
                                                    {markerSvgs.get(marker.id) && (
                                                        <div 
                                                            className="add-target-modal__marker-icon"
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
                                            <div className="add-target-modal__no-results">Ничего не найдено</div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    
                    <div className="add-target-modal__row">
                        <div className="add-target-modal__field">
                            <label className="add-target-modal__label">
                                Широта <span className="add-target-modal__required">*</span>
                            </label>
                            <input
                                type="number"
                                name="lat"
                                value={formData.lat}
                                onChange={handleChange}
                                step="0.000001"
                                className={`add-target-modal__input ${errors.lat ? 'add-target-modal__input--error' : ''}`}
                                placeholder="Например: 55.751244"
                            />
                            {errors.lat && (
                                <span className="add-target-modal__error">{errors.lat}</span>
                            )}
                        </div>
                        
                        <div className="add-target-modal__field">
                            <label className="add-target-modal__label">
                                Долгота <span className="add-target-modal__required">*</span>
                            </label>
                            <input
                                type="number"
                                name="lng"
                                value={formData.lng}
                                onChange={handleChange}
                                step="0.000001"
                                className={`add-target-modal__input ${errors.lng ? 'add-target-modal__input--error' : ''}`}
                                placeholder="Например: 37.618423"
                            />
                            {errors.lng && (
                                <span className="add-target-modal__error">{errors.lng}</span>
                            )}
                        </div>
                    </div>
                    
                    <div className="add-target-modal__section">
                        <div className="add-target-modal__section-header">
                            <label className="add-target-modal__label">
                                Действия объекта
                            </label>
                            <button
                                type="button"
                                className="add-target-modal__button add-target-modal__button--add-action"
                                onClick={handleAddAction}
                            >
                                + Добавить действие
                            </button>
                        </div>
                        
                        {formData.actions.length > 0 && (
                            <div className="add-target-modal__actions-list">
                                {formData.actions.map((action, index) => (
                                    <div key={index} className="add-target-modal__action-item">
                                        <div className="add-target-modal__action-fields">
                                            <div className="add-target-modal__field">
                                                <label className="add-target-modal__label--small">
                                                    Тип действия
                                                </label>
                                                <select
                                                    value={action.action_type_id}
                                                    onChange={(e) => handleActionChange(index, 'action_type_id', e.target.value)}
                                                    className={`add-target-modal__select ${errors[`action_${index}_type`] ? 'add-target-modal__input--error' : ''}`}
                                                >
                                                    <option value="">Выберите тип</option>
                                                    {actionTypes.map(type => (
                                                        <option key={type.id} value={type.id}>
                                                            {type.title}
                                                        </option>
                                                    ))}
                                                </select>
                                                {errors[`action_${index}_type`] && (
                                                    <span className="add-target-modal__error">{errors[`action_${index}_type`]}</span>
                                                )}
                                            </div>
                                            
                                            <div className="add-target-modal__field">
                                                <label className="add-target-modal__label--small">
                                                    Радиус, км
                                                </label>
                                                <input
                                                    type="number"
                                                    value={action.radius}
                                                    onChange={(e) => handleActionChange(index, 'radius', e.target.value)}
                                                    step="0.1"
                                                    min="0"
                                                    className={`add-target-modal__input ${errors[`action_${index}_radius`] ? 'add-target-modal__input--error' : ''}`}
                                                    placeholder="0"
                                                />
                                                {errors[`action_${index}_radius`] && (
                                                    <span className="add-target-modal__error">{errors[`action_${index}_radius`]}</span>
                                                )}
                                            </div>
                                        </div>
                                        
                                        <button
                                            type="button"
                                            className="add-target-modal__button add-target-modal__button--remove-action"
                                            onClick={() => handleRemoveAction(index)}
                                            aria-label="Удалить действие"
                                        >
                                            ×
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    
                    <div className="add-target-modal__actions">
                        <button
                            type="button"
                            className="add-target-modal__button add-target-modal__button--cancel"
                            onClick={handleClose}
                        >
                            Отмена
                        </button>
                        <button
                            type="submit"
                            className="add-target-modal__button add-target-modal__button--submit"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? 'Сохранение...' : 'Добавить объект'}
                        </button>
                        <button
                            type="button"
                            className="add-target-modal__button add-target-modal__button--submit-formular"
                            onClick={(e) => handleSubmit(e, true)}
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? 'Сохранение...' : 'Сохранить и заполнить формуляр'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
