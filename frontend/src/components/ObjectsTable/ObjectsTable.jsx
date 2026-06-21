
import { useMemo, useState } from "react";

export default function ObjectsTable({ data, selectedObj, onCheckboxChange, onObjectClick, onTitleClick, hoveredTargetId, onRowHover, onEditClick, onDeleteClick }) {
    const selectedSet = new Set(selectedObj);

    // Группировка по странам, затем по Типу объекта (type -> TargetType)
    const countryTypeGroups = useMemo(() => {
        const byCountry = {};
        for (const item of data) {
            const countryTitle = item.country?.title || "Без страны";
            if (!byCountry[countryTitle]) {
                byCountry[countryTitle] = [];
            }
            byCountry[countryTitle].push(item);
        }

        const sortedCountries = Object.keys(byCountry).sort((a, b) =>
            a.localeCompare(b, "ru")
        );

        return sortedCountries.map((country) => {
            const countryItems = byCountry[country];
            const byType = {};
            for (const item of countryItems) {
                const typeTitle = item.type?.title || "Без типа";
                if (!byType[typeTitle]) {
                    byType[typeTitle] = [];
                }
                byType[typeTitle].push(item);
            }

            const sortedTypes = Object.keys(byType).sort((a, b) =>
                a.localeCompare(b, "ru")
            );

            const types = sortedTypes.map((type) => ({
                type,
                items: byType[type],
            }));

            return {
                country,
                types,
                // Для удобства: плоский список всех items страны
                allItems: countryItems,
            };
        });
    }, [data]);

    // Состояние для раскрытых групп: страны + типы
    const [expandedCountries, setExpandedCountries] = useState(new Set());
    const [expandedTypes, setExpandedTypes] = useState(new Set());

    const allCountryNames = countryTypeGroups.map(g => g.country);

    const expandAll = () => {
        setExpandedCountries(new Set(allCountryNames));
        // Раскрываем все типы
        const allTypeKeys = [];
        countryTypeGroups.forEach(cg => {
            cg.types.forEach(tg => {
                allTypeKeys.push(`${cg.country}|||${tg.type}`);
            });
        });
        setExpandedTypes(new Set(allTypeKeys));
    };

    const collapseAll = () => {
        setExpandedCountries(new Set());
        setExpandedTypes(new Set());
    };

    // Глобальный "выбрать все видимые" (на все отфильтрованные объекты)
    const dataIds = data.map((item) => item.id);
    const isAllSelected = data.length > 0 && dataIds.every((id) => selectedSet.has(id));

    const handleSelectAllChange = (e) => {
        const isChecked = e.target.checked;
        dataIds.forEach((id) => onCheckboxChange(id, isChecked));
    };

    // Выбрать/снять все объекты в конкретной стране
    const handleCountryCheckbox = (items, checked) => {
        items.forEach((item) => {
            onCheckboxChange(item.id, checked);
        });
    };

    // Выбрать/снять все объекты в конкретном типе (внутри страны)
    const handleTypeCheckbox = (items, checked) => {
        items.forEach((item) => {
            onCheckboxChange(item.id, checked);
        });
    };

    return (
        <div className="formular__data">
            {/* Верхний чекбокс на все видимые объекты */}
            <div className="formular__select-all-bar">
                <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={handleSelectAllChange}
                    aria-label="Выбрать все видимые объекты"
                />
                <span className="select-all-label">
                    Выбрать все видимые ({data.length})
                </span>
            </div>

            {/* Кнопки управления раскрытием всех групп */}
            <div className="expand-controls">
                <button 
                    type="button" 
                    className="expand-btn" 
                    onClick={expandAll}
                >
                    Развернуть все
                </button>
                <button 
                    type="button" 
                    className="expand-btn" 
                    onClick={collapseAll}
                >
                    Свернуть все
                </button>
            </div>

            <div className="formular__country-groups">
                {countryTypeGroups.map(({ country, types, allItems }) => {
                    const countryItemIds = allItems.map((i) => i.id);
                    const selectedInCountry = countryItemIds.filter((id) => selectedSet.has(id));
                    const allInCountrySelected = allItems.length > 0 && selectedInCountry.length === allItems.length;
                    const someInCountrySelected = selectedInCountry.length > 0 && !allInCountrySelected;

                    return (
                        <details 
                            key={country} 
                            className="country-group"
                            open={expandedCountries.has(country)}
                            onToggle={(e) => {
                                const isOpen = e.currentTarget.open;
                                setExpandedCountries(prev => {
                                    const next = new Set(prev);
                                    if (isOpen) {
                                        next.add(country);
                                    } else {
                                        next.delete(country);
                                    }
                                    return next;
                                });
                            }}
                        >
                            <summary
                                className="country-header"
                                onClick={(e) => {
                                    if (e.target.tagName === "INPUT") {
                                        e.stopPropagation();
                                    }
                                }}
                            >
                                <input
                                    type="checkbox"
                                    checked={allInCountrySelected}
                                    ref={(el) => {
                                        if (el) el.indeterminate = someInCountrySelected;
                                    }}
                                    onChange={(e) => {
                                        e.stopPropagation();
                                        handleCountryCheckbox(allItems, e.target.checked);
                                    }}
                                    aria-label={`Выбрать все объекты страны ${country}`}
                                />
                                <span className="country-name">{country}</span>
                                <span className="country-count">({allItems.length})</span>
                                {someInCountrySelected && (
                                    <span className="country-partial">({selectedInCountry.length} выбрано)</span>
                                )}
                            </summary>

                            <div className="country-objects">
                                {types.map(({ type, items: typeItems }) => {
                                    const typeItemIds = typeItems.map((i) => i.id);
                                    const selectedInType = typeItemIds.filter((id) => selectedSet.has(id));
                                    const allInTypeSelected = typeItems.length > 0 && selectedInType.length === typeItems.length;
                                    const someInTypeSelected = selectedInType.length > 0 && !allInTypeSelected;

                                    const typeKey = `${country}|||${type}`;

                                    return (
                                        <details 
                                            key={typeKey}
                                            className="branch-group"
                                            open={expandedTypes.has(typeKey)}
                                            onToggle={(e) => {
                                                const isOpen = e.currentTarget.open;
                                                setExpandedTypes(prev => {
                                                    const next = new Set(prev);
                                                    if (isOpen) {
                                                        next.add(typeKey);
                                                    } else {
                                                        next.delete(typeKey);
                                                    }
                                                    return next;
                                                });
                                            }}
                                        >
                                            <summary
                                                className="branch-header"
                                                onClick={(e) => {
                                                    if (e.target.tagName === "INPUT") {
                                                        e.stopPropagation();
                                                    }
                                                }}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={allInTypeSelected}
                                                    ref={(el) => {
                                                        if (el) el.indeterminate = someInTypeSelected;
                                                    }}
                                                    onChange={(e) => {
                                                        e.stopPropagation();
                                                        handleTypeCheckbox(typeItems, e.target.checked);
                                                    }}
                                                    aria-label={`Выбрать все объекты типа ${type} в стране ${country}`}
                                                />
                                                <span className="branch-name">{type}</span>
                                                <span className="branch-count">({typeItems.length})</span>
                                                {someInTypeSelected && (
                                                    <span className="branch-partial">({selectedInType.length} выбрано)</span>
                                                )}
                                            </summary>

                                            <div className="branch-objects">
                                                {typeItems.map((item) => (
                                                    <div
                                                        key={item.id}
                                                        className={`formular__table-row object-row${
                                                            hoveredTargetId === item.id ? " formular__table-row--hovered" : ""
                                                        }`}
                                                    >
                                                        <div className="formular__table-data">
                                                            <input
                                                                type="checkbox"
                                                                name="object"
                                                                value={item.id}
                                                                checked={selectedObj.includes(item.id)}
                                                                onChange={(e) => onCheckboxChange(item.id, e.target.checked)}
                                                            />
                                                        </div>

                                                        <div className="formular__table-data formular__table-data--action">
                                                            <button
                                                                className="formular__flyto-btn"
                                                                onClick={() => {
                                                                    if (onObjectClick) {
                                                                        onObjectClick(item);
                                                                    }
                                                                }}
                                                                onMouseEnter={() => {
                                                                    if (onRowHover) {
                                                                        onRowHover(item.id);
                                                                    }
                                                                }}
                                                                onMouseLeave={() => {
                                                                    if (onRowHover) {
                                                                        onRowHover(null);
                                                                    }
                                                                }}
                                                                aria-label={`Перейти к объекту ${item.title} на карте`}
                                                                title="Перейти к объекту на карте"
                                                            >
                                                                <svg
                                                                    width="20"
                                                                    height="20"
                                                                    viewBox="0 0 24 24"
                                                                    fill="none"
                                                                    xmlns="http://www.w3.org/2000/svg"
                                                                >
                                                                    <path
                                                                        d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"
                                                                        fill="currentColor"
                                                                    />
                                                                </svg>
                                                            </button>
                                                        </div>

                                                        <div
                                                            className="formular__table-data formular__table-data--clickable object-title"
                                                            onClick={() => {
                                                                if (onTitleClick) {
                                                                    onTitleClick(item.id);
                                                                }
                                                            }}
                                                            role="button"
                                                            tabIndex={0}
                                                            aria-label={`Открыть формуляр объекта ${item.title}`}
                                                        >
                                                            {item.title}
                                                        </div>

                                                        <div className="formular__table-data formular__table-data--action">
                                                            <div className="formular__actions-group">
                                                                <button
                                                                    className="formular__action-btn formular__action-btn--edit"
                                                                    onClick={() => {
                                                                        if (onEditClick) {
                                                                            onEditClick(item.id);
                                                                        }
                                                                    }}
                                                                    aria-label={`Редактировать объект ${item.title}`}
                                                                    title="Редактировать объект"
                                                                >
                                                                    <svg
                                                                        width="16"
                                                                        height="16"
                                                                        viewBox="0 0 24 24"
                                                                        fill="none"
                                                                        xmlns="http://www.w3.org/2000/svg"
                                                                    >
                                                                        <path
                                                                            d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"
                                                                            fill="currentColor"
                                                                        />
                                                                    </svg>
                                                                </button>
                                                                <button
                                                                    className="formular__action-btn formular__action-btn--delete"
                                                                    onClick={() => {
                                                                        if (onDeleteClick) {
                                                                            onDeleteClick(item.id, item.title);
                                                                        }
                                                                    }}
                                                                    aria-label={`Удалить объект ${item.title}`}
                                                                    title="Удалить объект"
                                                                >
                                                                    <svg
                                                                        width="16"
                                                                        height="16"
                                                                        viewBox="0 0 24 24"
                                                                        fill="none"
                                                                        xmlns="http://www.w3.org/2000/svg"
                                                                    >
                                                                        <path
                                                                            d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"
                                                                            fill="currentColor"
                                                                        />
                                                                    </svg>
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </details>
                                    );
                                })}
                            </div>
                        </details>
                    );
                })}
            </div>
        </div>
    );
}
