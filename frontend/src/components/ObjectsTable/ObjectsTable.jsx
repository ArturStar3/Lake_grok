
import { memo, useCallback, useMemo, useState } from "react";
import {
    groupObjectsByCountryAndTypeTree,
    makeTypeExpandKey,
    collectAllTypeExpandKeys,
} from "../../utils/targetTypeTree";

const ObjectRow = memo(function ObjectRow({
    item,
    isSelected,
    isHovered,
    onCheckboxChange,
    onObjectClick,
    onTitleClick,
    onRowHover,
    onEditClick,
    onDeleteClick,
}) {
    return (
        <div
            className={`formular__table-row object-row${
                isHovered ? " formular__table-row--hovered" : ""
            }`}
        >
            <div className="formular__table-data">
                <input
                    type="checkbox"
                    name="object"
                    value={item.id}
                    checked={isSelected}
                    onChange={(e) => onCheckboxChange(item.id, e.target.checked)}
                />
            </div>

            <div className="formular__table-data formular__table-data--action">
                <button
                    className="formular__flyto-btn"
                    onClick={() => onObjectClick?.(item)}
                    onMouseEnter={() => onRowHover?.(item.id)}
                    onMouseLeave={() => onRowHover?.(null)}
                    aria-label={`Перейти к объекту ${item.title} на карте`}
                    title="Перейти к объекту на карте"
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path
                            d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"
                            fill="currentColor"
                        />
                    </svg>
                </button>
            </div>

            <div
                className="formular__table-data formular__table-data--clickable object-title"
                onClick={() => onTitleClick?.(item.id)}
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
                        onClick={() => onEditClick?.(item.id)}
                        aria-label={`Редактировать объект ${item.title}`}
                        title="Редактировать объект"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path
                                d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"
                                fill="currentColor"
                            />
                        </svg>
                    </button>
                    <button
                        className="formular__action-btn formular__action-btn--delete"
                        onClick={() => onDeleteClick?.(item.id, item.title)}
                        aria-label={`Удалить объект ${item.title}`}
                        title="Удалить объект"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path
                                d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"
                                fill="currentColor"
                            />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
});

function toggleSetKey(setter, key) {
    setter((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
    });
}

const TypeGroupNode = memo(function TypeGroupNode({
    node,
    countryKey,
    depth,
    expandedTypes,
    onToggleType,
    selectedSet,
    hoveredTargetId,
    onTypeCheckbox,
    rowProps,
}) {
    const typeKey = makeTypeExpandKey(countryKey, node.typeId);
    const isOpen = expandedTypes.has(typeKey);
    const typeItemIds = node.allItems.map((i) => i.id);
    const selectedInType = typeItemIds.filter((id) => selectedSet.has(id));
    const allInTypeSelected = typeItemIds.length > 0 && selectedInType.length === typeItemIds.length;
    const someInTypeSelected = selectedInType.length > 0 && !allInTypeSelected;

    return (
        <details
            className={`branch-group${depth > 0 ? ' branch-group--nested' : ''}`}
            style={depth > 0 ? { marginLeft: `${depth * 12}px` } : undefined}
            open={isOpen}
        >
            <summary
                className="branch-header"
                onClick={(e) => {
                    if (e.target.tagName === "INPUT") {
                        e.stopPropagation();
                        return;
                    }
                    e.preventDefault();
                    onToggleType(typeKey);
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
                        onTypeCheckbox(node.allItems, e.target.checked);
                    }}
                    aria-label={`Выбрать все объекты типа ${node.title}`}
                />
                <span className="branch-name">{node.title}</span>
                <span className="branch-count">({typeItemIds.length})</span>
                {someInTypeSelected && (
                    <span className="branch-partial">({selectedInType.length} выбрано)</span>
                )}
            </summary>

            <div className="branch-objects">
                {node.items.map((item) => (
                    <ObjectRow
                        key={item.id}
                        item={item}
                        isSelected={selectedSet.has(item.id)}
                        isHovered={hoveredTargetId === item.id}
                        {...rowProps}
                    />
                ))}
                {node.children.map((child) => (
                    <TypeGroupNode
                        key={child.typeId}
                        node={child}
                        countryKey={countryKey}
                        depth={depth + 1}
                        expandedTypes={expandedTypes}
                        onToggleType={onToggleType}
                        selectedSet={selectedSet}
                        hoveredTargetId={hoveredTargetId}
                        onTypeCheckbox={onTypeCheckbox}
                        rowProps={rowProps}
                    />
                ))}
            </div>
        </details>
    );
});

export default function ObjectsTable({
    data,
    targetTypes = [],
    selectedObj,
    onCheckboxChange,
    onObjectClick,
    onTitleClick,
    hoveredTargetId,
    onRowHover,
    onEditClick,
    onDeleteClick,
}) {
    const selectedSet = useMemo(() => new Set(selectedObj), [selectedObj]);

    const countryTypeGroups = useMemo(
        () => groupObjectsByCountryAndTypeTree(data, targetTypes),
        [data, targetTypes],
    );

    const [expandedCountries, setExpandedCountries] = useState(new Set());
    const [expandedTypes, setExpandedTypes] = useState(new Set());

    const allCountryKeys = countryTypeGroups.map((g) => g.countryKey);

    const expandAll = () => {
        setExpandedCountries(new Set(allCountryKeys));
        setExpandedTypes(new Set(collectAllTypeExpandKeys(countryTypeGroups)));
    };

    const collapseAll = () => {
        setExpandedCountries(new Set());
        setExpandedTypes(new Set());
    };

    const dataIds = useMemo(() => data.map((item) => item.id), [data]);
    const isAllSelected = data.length > 0 && dataIds.every((id) => selectedSet.has(id));

    const handleSelectAllChange = (e) => {
        const isChecked = e.target.checked;
        dataIds.forEach((id) => onCheckboxChange(id, isChecked));
    };

    const handleCountryCheckbox = useCallback((items, checked) => {
        items.forEach((item) => onCheckboxChange(item.id, checked));
    }, [onCheckboxChange]);

    const handleTypeCheckbox = useCallback((items, checked) => {
        items.forEach((item) => onCheckboxChange(item.id, checked));
    }, [onCheckboxChange]);

    const toggleCountry = (countryKey) => toggleSetKey(setExpandedCountries, countryKey);
    const toggleType = useCallback((typeKey) => toggleSetKey(setExpandedTypes, typeKey), []);

    // Стабильная ссылка на набор колбэков строки — без этого React.memo у ObjectRow
    // не срабатывал бы и таблица из сотен строк перерисовывалась целиком при каждом
    // наведении курсора на маркер карты (hoveredTargetId меняется очень часто).
    const rowProps = useMemo(() => ({
        onCheckboxChange,
        onObjectClick,
        onTitleClick,
        onRowHover,
        onEditClick,
        onDeleteClick,
    }), [onCheckboxChange, onObjectClick, onTitleClick, onRowHover, onEditClick, onDeleteClick]);

    return (
        <div className="formular__data">
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

            <div className="expand-controls">
                <button type="button" className="expand-btn" onClick={expandAll}>
                    Развернуть все
                </button>
                <button type="button" className="expand-btn" onClick={collapseAll}>
                    Свернуть все
                </button>
            </div>

            <div className="formular__country-groups">
                {countryTypeGroups.map(({ countryKey, country, typeNodes, orphanItems, allItems }) => {
                    const countryItemIds = allItems.map((i) => i.id);
                    const selectedInCountry = countryItemIds.filter((id) => selectedSet.has(id));
                    const allInCountrySelected = allItems.length > 0 && selectedInCountry.length === allItems.length;
                    const someInCountrySelected = selectedInCountry.length > 0 && !allInCountrySelected;
                    const isCountryOpen = expandedCountries.has(countryKey);

                    return (
                        <details
                            key={countryKey}
                            className="country-group"
                            open={isCountryOpen}
                        >
                            <summary
                                className="country-header"
                                onClick={(e) => {
                                    if (e.target.tagName === "INPUT") {
                                        e.stopPropagation();
                                        return;
                                    }
                                    e.preventDefault();
                                    toggleCountry(countryKey);
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
                                {typeNodes.map((node) => (
                                    <TypeGroupNode
                                        key={node.typeId}
                                        node={node}
                                        countryKey={countryKey}
                                        depth={0}
                                        expandedTypes={expandedTypes}
                                        onToggleType={toggleType}
                                        selectedSet={selectedSet}
                                        hoveredTargetId={hoveredTargetId}
                                        onTypeCheckbox={handleTypeCheckbox}
                                        rowProps={rowProps}
                                    />
                                ))}

                                {orphanItems.length > 0 && (
                                    <details className="branch-group" open>
                                        <summary className="branch-header">
                                            <span className="branch-name">Без типа</span>
                                            <span className="branch-count">({orphanItems.length})</span>
                                        </summary>
                                        <div className="branch-objects">
                                            {orphanItems.map((item) => (
                                                <ObjectRow
                                                    key={item.id}
                                                    item={item}
                                                    isSelected={selectedSet.has(item.id)}
                                                    isHovered={hoveredTargetId === item.id}
                                                    {...rowProps}
                                                />
                                            ))}
                                        </div>
                                    </details>
                                )}
                            </div>
                        </details>
                    );
                })}
            </div>
        </div>
    );
}
