import './DeployedEquipmentDisplay.css';

function formatLabel(equipment) {
  if (!equipment) return '—';
  const designation = equipment.designation?.trim();
  const title = equipment.title?.trim();
  if (designation && title && designation !== title) {
    return `${designation} (${title})`;
  }
  return designation || title || '—';
}

export default function DeployedEquipmentDisplay({ items = [] }) {
  if (!items.length) return null;

  return (
    <section className="deployed-equipment-display">
      <h3 className="deployed-equipment-display__title">Вооружение и техника</h3>
      <ul className="deployed-equipment-display__list">
        {items.map((row) => (
          <li key={row.equipment?.id} className="deployed-equipment-display__card">
            <div className="deployed-equipment-display__header">
              <strong>{formatLabel(row.equipment)}</strong>
              <span className="deployed-equipment-display__qty">× {row.quantity}</span>
            </div>

            {row.specs?.length > 0 && (
              <div className="deployed-equipment-display__block">
                <div className="deployed-equipment-display__subtitle">ТТХ</div>
                <ul className="deployed-equipment-display__specs">
                  {row.specs.map((spec) => (
                    <li key={spec.title}>
                      {spec.title}: {spec.value}
                      {spec.unit ? ` ${spec.unit}` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {row.zones?.length > 0 && (
              <div className="deployed-equipment-display__block">
                <div className="deployed-equipment-display__subtitle">Зоны на карте</div>
                <ul className="deployed-equipment-display__zones">
                  {row.zones.map((zone) => (
                    <li key={`${zone.parameter_title}-${zone.radius_km}`}>
                      {zone.parameter_title}: {zone.radius_km} км
                      {zone.action_type?.title ? ` (${zone.action_type.title})` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
