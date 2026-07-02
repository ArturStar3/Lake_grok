import { useState, useRef, useLayoutEffect } from 'react';
import { formatEquipmentLabel } from '../../utils/equipmentCatalogUtils';
import EquipmentDetailModal from './EquipmentDetailModal';
import './DeployedEquipmentDisplay.css';

function getPrimaryImage(row) {
  const images = row.equipment?.images;
  if (!images?.length) return null;
  return images[0].image;
}

export default function DeployedEquipmentDisplay({ items = [], onEditInCatalog }) {
  const [selectedRow, setSelectedRow] = useState(null);
  const gridRef = useRef(null);

  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid) return undefined;

    const syncCardHeights = () => {
      const cards = grid.querySelectorAll('.deployed-equipment-display__card');
      if (!cards.length) return;

      cards.forEach((card) => {
        card.style.height = '';
      });

      let maxHeight = 0;
      cards.forEach((card) => {
        maxHeight = Math.max(maxHeight, card.getBoundingClientRect().height);
      });

      if (maxHeight > 0) {
        const heightPx = `${Math.ceil(maxHeight)}px`;
        cards.forEach((card) => {
          card.style.height = heightPx;
        });
      }
    };

    syncCardHeights();

    const observer = new ResizeObserver(syncCardHeights);
    observer.observe(grid);

    return () => observer.disconnect();
  }, [items]);

  if (!items.length) return null;

  const handleEditInCatalog = (equipmentId) => {
    setSelectedRow(null);
    onEditInCatalog?.(equipmentId);
  };

  return (
    <>
      <section className="deployed-equipment-display">
        <h3 className="deployed-equipment-display__title">Вооружение и техника</h3>
        <ul className="deployed-equipment-display__grid" ref={gridRef}>
          {items.map((row) => {
            const imageUrl = getPrimaryImage(row);
            const label = formatEquipmentLabel(row.equipment);

            return (
              <li key={row.equipment?.id}>
                <button
                  type="button"
                  className="deployed-equipment-display__card"
                  onClick={() => setSelectedRow(row)}
                >
                  <div className="deployed-equipment-display__card-image-wrap">
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={label}
                        className="deployed-equipment-display__card-image"
                      />
                    ) : (
                      <div className="deployed-equipment-display__card-placeholder">
                        Нет фото
                      </div>
                    )}
                  </div>
                  <div className="deployed-equipment-display__card-body">
                    <span className="deployed-equipment-display__card-title">{label}</span>
                    <span className="deployed-equipment-display__card-qty">
                      {row.quantity}
                    </span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <EquipmentDetailModal
        isOpen={selectedRow != null}
        deployedRow={selectedRow}
        onClose={() => setSelectedRow(null)}
        onEditInCatalog={handleEditInCatalog}
      />
    </>
  );
}
