import "./IntersectionTable.css";

export default function IntersectionTable({ intersections, selectedIntersections = [], onIntersectionToggle, onSelectAllIntersections }) {
    if (!intersections || intersections.length === 0) {
        return (
            <div className="intersection-table__empty">
                <p>Точки пересечения не обнаружены</p>
            </div>
        );
    }

    const allSelected = intersections.length > 0 && selectedIntersections.length === intersections.length;
    const someSelected = selectedIntersections.length > 0 && selectedIntersections.length < intersections.length;

    return (
        <div className="intersection-table">
            <h3 className="intersection-table__title">Точки пересечения зон действия</h3>
            <div className="intersection-table__wrapper">
                <table className="intersection-table__content events__table">
                    <thead>
                        <tr className="events__table-row">
                            <th className="events__head-cell events__head-cell--select-all">
                                <input 
                                    type="checkbox" 
                                    checked={allSelected}
                                    ref={input => {
                                        if (input) {
                                            input.indeterminate = someSelected;
                                        }
                                    }}
                                    onChange={(e) => onSelectAllIntersections?.(e.target.checked)}
                                    aria-label="Выбрать все точки"
                                />
                            </th>
                            <th className="events__head-cell">Название</th>
                            <th className="events__head-cell">Широта</th>
                            <th className="events__head-cell">Долгота</th>
                            <th className="events__head-cell">Пересечение объектов</th>
                        </tr>
                    </thead>
                    <tbody>
                        {intersections.map((intersection) => (
                            <tr key={intersection.id} className="events__table-row">
                                <td className="events__table-data">
                                    <input 
                                        type="checkbox" 
                                        checked={selectedIntersections.includes(intersection.id)}
                                        onChange={() => onIntersectionToggle?.(intersection.id)}
                                        aria-label={`Показать ${intersection.label} на карте`}
                                    />
                                </td>
                                <td className="events__table-data">{intersection.label}</td>
                                <td className="events__table-data">{intersection.lat.toFixed(6)}</td>
                                <td className="events__table-data">{intersection.lng.toFixed(6)}</td>
                                <td className="events__table-data">
                                    <div className="intersection-table__objects">
                                        {intersection.objects.map((objName, idx) => (
                                            <span key={idx} className="intersection-table__object-name">
                                                {objName}
                                                {idx < intersection.objects.length - 1 && ', '}
                                            </span>
                                        ))}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
