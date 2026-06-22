import "./Features.css";
import IntersectionTable from "../IntersectionTable/IntersectionTable";
import ActionZoneFilters from "./ActionZoneFilters";

const formatDistance = (meters) => {
    if (!meters) return "0 м";
    return meters >= 1000 ? `${(meters / 1000).toFixed(2)} км` : `${meters.toFixed(0)} м`;
};

const formatCoord = (value) => value.toFixed(5);

export default function Features({ 
  isMeasureMode, 
  measurements = [], 
  onRemovePoint, 
  showActionRadius, 
  actionRadiusMode = "animation", 
  onActionRadiusModeChange, 
  intersections = [], 
  selectedIntersections = [], 
  onIntersectionToggle, 
  onSelectAllIntersections,
  // props for zone display panel in fullScreen (map_sidebar via separate radiobutton in features block)
  isFullscreen = false,
  actionZoneFilters = {},
  actionZoneAvailableByCountry = {},
  showZoneIntersections = true,
  setShowZoneIntersections,
  toggleActionType,
  toggleAllForCountry,
  resetZoneFilters,
  // New sub-mode for zones measurement tool in fullScreen features (only visible when zones mode active)
  actionZoneViewMode = "displaySettings",
  onActionZoneViewModeChange
}) {
    const totalDistance = measurements.reduce((sum, point) => sum + point.distance, 0);
    return (
        <div className="features">
            <div className="features__header">
                <h3 className="features__title">Инструменты</h3>
                {isMeasureMode && (
                    <div className="features__hint-wrapper">
                        <span className="features__hint-icon" title="Зажмите Ctrl и кликните по карте, чтобы поставить метку и рассчитать расстояние.">?</span>
                    </div>
                )}
            </div>

            {isMeasureMode ? (
                <>
                    <div className="features__table-wrapper">
                        <table className="features__table">
                            <thead>
                                <tr>
                                    <th style={{width: '30px'}}></th>
                                    <th style={{width: '60px'}}>Метка</th>
                                    <th style={{width: '80px'}}>Долгота</th>
                                    <th style={{width: '80px'}}>Широта</th>
                                    <th style={{width: '80px'}}>Дистанция</th>
                                    <th style={{width: '30px'}}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {measurements.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="features__empty">Нет точек измерения</td>
                                    </tr>
                                )}
                                {measurements.map((point, idx) => (
                                    <tr key={point.id}>
                                        <td>
                                            <input type="checkbox" aria-label={`Выбрать точку ${point.index}`} />
                                        </td>
                                        <td>{`Точка ${point.index}`}</td>
                                        <td>{formatCoord(point.lng)}</td>
                                        <td>{formatCoord(point.lat)}</td>
                                        <td>{idx === 0 ? "—" : formatDistance(point.distance)}</td>
                                        <td>
                                            <button
                                                type="button"
                                                className="features__remove"
                                                onClick={() => onRemovePoint?.(point.id)}
                                                aria-label={`Удалить точку ${point.index}`}
                                            >
                                                <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                                                    <path fill="currentColor" d="M9 3h6a1 1 0 0 1 1 1v2h4v2h-1v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V8H4V6h4V4a1 1 0 0 1 1-1Zm1 3h4V5h-4v1Zm-2 4v8h2v-8H8Zm4 0v8h2v-8h-2Zm4 0v8h2v-8h-2Z" />
                                                </svg>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            {measurements.length > 0 && (
                                <tfoot>
                                    <tr className="features__table-total">
                                        <td colSpan={4} className="features__total-label">Итого:</td>
                                        <td className="features__total-value">{formatDistance(totalDistance)}</td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                </>
            ) : (
                <>
                    {showActionRadius ? (
                        <>
                            {/* Второй блок радиокнопок (только в fullScreen при активном инструменте "Зона действия").
                                Появляется в map_sidebar (Features) когда showActionRadius && isFullscreen.
                                Выбор здесь напрямую определяет, какой функционал показан ниже:
                                - "Зона пересечения": отображается функционал точек пересечения (IntersectionTable + точки на карте).
                                - "Настройка отображения": отображается панель с чекбоксами по странам и типам зон.
                                (Первый блок legacy радио "Отображение анимации" / "Считывание координат" полностью убран по запросу.) */}
                            {isFullscreen && showActionRadius && (
                                <div className="features__action-mode">
                                    <label className="features__action-mode-item">
                                        <input
                                            type="radio"
                                            name="actionZoneViewMode"
                                            value="intersections"
                                            checked={actionZoneViewMode === "intersections"}
                                            onChange={() => {
                                                onActionZoneViewModeChange?.("intersections");
                                                // При выборе "Зона пересечения" включаем отображение точек на карте
                                                setShowZoneIntersections?.(true);
                                            }}
                                        />
                                        <span>Зона пересечения</span>
                                    </label>
                                    <label className="features__action-mode-item">
                                        <input
                                            type="radio"
                                            name="actionZoneViewMode"
                                            value="displaySettings"
                                            checked={actionZoneViewMode === "displaySettings"}
                                            onChange={() => onActionZoneViewModeChange?.("displaySettings")}
                                        />
                                        <span>Настройка отображения</span>
                                    </label>
                                </div>
                            )}

                            {/* В fullScreen:
                                - при "Настройка отображения" показываем панель с чекбоксами стран/типов зон (без внутреннего чекбокса пересечений).
                                - при "Зона пересечения" показываем таблицу точек пересечения (функционал привязан к выбору).
                                Фильтры (когда были в "Настройка отображения") продолжают влиять на расчёт пересечений в любом случае.
                                В обычном режиме (!isFullscreen) таблица показывается как раньше (при showActionRadius). */}
                            {/* Настройка отображения зон: в обычном режиме — в footer панели; в fullscreen — по выбору радиокнопки */}
                            {showActionRadius && (!isFullscreen || actionZoneViewMode === "displaySettings") && (
                                <ActionZoneFilters
                                    actionZoneAvailableByCountry={actionZoneAvailableByCountry}
                                    actionZoneFilters={actionZoneFilters}
                                    showZoneIntersections={showZoneIntersections}
                                    setShowZoneIntersections={setShowZoneIntersections}
                                    toggleActionType={toggleActionType}
                                    toggleAllForCountry={toggleAllForCountry}
                                    resetZoneFilters={resetZoneFilters}
                                    // Вернули checkbox "Показывать точки пересечения" (showIntersectionsControl=true).
                                    // Теперь в режиме "Настройка отображения" пользователь может управлять видимостью
                                    // точек пересечения на карте для текущих выбранных (видимые по фильтрам) зон.
                                    // Таблица IntersectionTable остаётся привязанной к радио "Зона пересечения"
                                    // (как просил пользователь в предыдущем запросе).
                                    showIntersectionsControl={true}
                                />
                            )}

                            {( !isFullscreen || actionZoneViewMode === "intersections" ) && (
                                <IntersectionTable 
                                    intersections={intersections}
                                    selectedIntersections={selectedIntersections}
                                    onIntersectionToggle={onIntersectionToggle}
                                    onSelectAllIntersections={onSelectAllIntersections}
                                />
                            )}
                        </>
                    ) : (
                        <p className="features__placeholder">Выберите инструмент, чтобы начать.</p>
                    )}
                </>
            )}
        </div>
    );
}