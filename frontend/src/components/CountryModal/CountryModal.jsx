import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import EditCountryModal from "../EditCountryModal/EditCountryModal";
import DetailSectionNavigator from "../DetailSections/DetailSectionNavigator";
import "./CountryModal.css";
import { API_URL } from "../../config/api";
import { buildSectionCards, organizeSectionData } from "../../utils/organizeSectionData";
import { useFormularCompletion } from "../../hooks/formular/useFormularCompletion";
import { getCountryMarkerPalette } from "../../utils/markerPalette";

const API_ROOT = API_URL;

export default function CountryModal({
    countryIso,
    onClose,
    onTargetEdit,
    onTargetOpenDetails,
    canEditCountry = false,
}) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [countryId, setCountryId] = useState(null);
    const [country, setCountry] = useState(null);
    const [countryExists, setCountryExists] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [attachmentsBySection, setAttachmentsBySection] = useState({});
    const { sections: completionSections, targets: completionTargets } = useFormularCompletion(countryId);

    useEffect(() => {
        if (!canEditCountry) {
            setIsEditModalOpen(false);
        }
    }, [canEditCountry]);

    useEffect(() => {
        if (!countryIso) return;

        const fetchAttachments = async (id) => {
            try {
                const response = await axios.get(`${API_ROOT}/api/v1/country-attachments/`, {
                    params: { country: id }
                });
                const grouped = {};
                (response.data || []).forEach((item) => {
                    if (!grouped[item.section]) {
                        grouped[item.section] = [];
                    }
                    grouped[item.section].push(item);
                });
                setAttachmentsBySection(grouped);
            } catch (err) {
                console.warn('Ошибка загрузки изображений страны:', err);
            }
        };

        const fetchCountryData = async () => {
            setLoading(true);
            setError(null);
            try {
                const countriesResponse = await axios.get(`${API_ROOT}/api/v1/countries/`);
                const foundCountry = countriesResponse.data.find(c => c.iso_code === countryIso);
                
                if (foundCountry) {
                    setCountryId(foundCountry.id);
                    setCountry(foundCountry);
                    setCountryExists(true);
                    await fetchAttachments(foundCountry.id);
                    
                    try {
                        const response = await axios.get(`${API_ROOT}/api/v1/country/${countryIso}/`);
                        setData(response.data);
                    } catch (err) {
                        if (err.response?.status === 404) {
                            setData([]);
                        } else {
                            throw err;
                        }
                    }
                } else {
                    setCountryExists(false);
                    setData(null);
                    setAttachmentsBySection({});
                }
            } catch (err) {
                setError("Не удалось загрузить информацию о стране");
                console.error("Error fetching country data:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchCountryData();
    }, [countryIso]);

    const sectionCards = useMemo(() => {
        if (!data || !Array.isArray(data)) return [];
        const organized = organizeSectionData(data);
        const prependCards = completionTargets.length > 0 ? [{
            id: 'formular-completion',
            title: 'Заполненность формуляров',
            excerpt: `${completionTargets.length} объектов`,
            badge: { photos: 0, subsections: 0, items: completionTargets.length },
            kind: 'formular-completion',
            payload: { sections: completionSections, targets: completionTargets },
        }] : [];
        return buildSectionCards({ organized, attachmentsBySection, prependCards });
    }, [data, attachmentsBySection, completionSections, completionTargets]);

    const handleOverlayClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };
    
    const handleCountryUpdated = async (updatedCountry) => {
        setCountryId(updatedCountry.id);
        setCountry(updatedCountry);
        setCountryExists(true);
        
        try {
            const response = await axios.get(`${API_ROOT}/api/v1/country/${countryIso}/`);
            setData(response.data);
        } catch (err) {
            if (err.response?.status === 404) {
                setData([]);
            }
        }

        try {
            const attachmentsResponse = await axios.get(`${API_ROOT}/api/v1/country-attachments/`, {
                params: { country: updatedCountry.id }
            });
            const grouped = {};
            (attachmentsResponse.data || []).forEach((item) => {
                if (!grouped[item.section]) {
                    grouped[item.section] = [];
                }
                grouped[item.section].push(item);
            });
            setAttachmentsBySection(grouped);
        } catch (err) {
            console.warn('Ошибка загрузки изображений страны:', err);
        }
    };

    const countryName = country?.title || "Информация о стране";
    const markerPalette = getCountryMarkerPalette(country);
    
    // Приоритет: открываем подробности, если передан коллбек.
    // Иначе (для старых сценариев) используем onTargetEdit как fallback.
    const effectiveOnTargetOpenDetails = onTargetOpenDetails ?? (typeof onTargetEdit === 'function'
        ? (target) => {
            const id = typeof target === 'object' ? target?.id : target;
            return onTargetEdit?.(id);
          }
        : undefined);

    return (
        <>
            <div className="country-modal-overlay" onClick={handleOverlayClick}>
                <div className="country-modal">
                    <div className="country-modal__header">
                        <div className="country-modal__header-main">
                            <h2 className="country-modal__title">{countryName}</h2>
                            {countryExists && country && (
                                <div className="country-modal__meta">
                                    {country.iso_code && (
                                        <span className="country-modal__meta-item">
                                            ISO: {country.iso_code}
                                        </span>
                                    )}
                                    {country.title_short && (
                                        <span className="country-modal__meta-item">
                                            {country.title_short}
                                        </span>
                                    )}
                                    <span
                                        className="country-modal__color-dot"
                                        style={{
                                            background: `linear-gradient(90deg, ${markerPalette.color_first}, ${markerPalette.color_third}, ${markerPalette.color_forth})`,
                                        }}
                                        title="Палитра маркера на карте"
                                        aria-hidden="true"
                                    />
                                </div>
                            )}
                        </div>
                        <div className="country-modal__header-actions">
                            {!loading && !error && canEditCountry && (
                                <button
                                    className="country-modal__edit-btn"
                                    onClick={() => setIsEditModalOpen(true)}
                                    aria-label={countryExists ? "Редактировать страну" : "Добавить страну"}
                                    title={countryExists ? "Редактировать страну" : "Добавить страну"}
                                >
                                    {countryExists ? '✏️' : '➕'}
                                </button>
                            )}
                            <button 
                                className="country-modal__close" 
                                onClick={onClose}
                                aria-label="Закрыть"
                            >
                                ×
                            </button>
                        </div>
                    </div>
                    <div className="country-modal__body">
                        {loading && (
                            <div className="country-modal__loading">Загрузка...</div>
                        )}
                        
                        {error && (
                            <div className="country-modal__error">{error}</div>
                        )}
                        
                        {!loading && !error && !countryExists && (
                            <div className="country-modal__no-data">
                                <p>Страна не найдена в базе данных.</p>
                                <p>Нажмите кнопку "➕" чтобы добавить страну.</p>
                            </div>
                        )}
                        
                        {!loading && !error && countryExists && (
                            <DetailSectionNavigator
                                cards={sectionCards}
                                attachmentsBySection={attachmentsBySection}
                                resetKey={countryIso}
                                initialCardId={
                                    completionTargets.length > 0 ? 'formular-completion' : null
                                }
                                autoExpandSingle
                                onTargetOpenDetails={effectiveOnTargetOpenDetails}
                                emptyMessage="Информация о стране отсутствует."
                            />
                        )}
                    </div>
                </div>
            </div>
            
            {isEditModalOpen && canEditCountry && (
                <EditCountryModal
                    countryId={countryId}
                    countryIso={countryIso}
                    isOpen={isEditModalOpen}
                    onClose={() => setIsEditModalOpen(false)}
                    onCountryUpdated={handleCountryUpdated}
                    isNewCountry={!countryExists}
                />
            )}
        </>
    );
}
