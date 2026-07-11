import { useMemo, useState } from 'react';
import { formatEquipmentLabel } from '../../utils/equipmentCatalogUtils';
import EquipmentDetailModal from './EquipmentDetailModal';
import './DeployedEquipmentDisplay.css';

function getPrimaryImage(row) {
  const images = row.equipment?.images;
  if (!images?.length) return null;
  return images[0].image;
}

const UNCATEGORIZED_KEY = '__none__';

function sortEquipmentItems(items) {
  return [...items].sort((a, b) =>
    formatEquipmentLabel(a.equipment).localeCompare(formatEquipmentLabel(b.equipment), 'ru'),
  );
}

function getOrCreateChild(parent, key, title, order, depth) {
  if (!parent.children.has(key)) {
    parent.children.set(key, {
      key,
      title,
      order,
      depth,
      children: new Map(),
      items: [],
    });
  }
  return parent.children.get(key);
}

function sortTreeNodes(childrenMap) {
  return Array.from(childrenMap.values())
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, 'ru'))
    .map((node) => ({
      ...node,
      items: sortEquipmentItems(node.items),
      children: sortTreeNodes(node.children),
    }));
}

function buildCategoryTree(items) {
  const root = { children: new Map() };

  items.forEach((row) => {
    const path = row.equipment?.category?.path;
    if (!path?.length) {
      const node = getOrCreateChild(root, UNCATEGORIZED_KEY, 'Без категории', 9999, 0);
      node.items.push(row);
      return;
    }

    let current = root;
    path.forEach((segment, index) => {
      const node = getOrCreateChild(
        current,
        String(segment.id),
        segment.title,
        segment.order ?? 9999,
        index,
      );
      if (index === path.length - 1) {
        node.items.push(row);
      }
      current = node;
    });
  });

  return sortTreeNodes(root.children);
}

function EquipmentCard({ row, onSelect }) {
  const imageUrl = getPrimaryImage(row);
  const label = formatEquipmentLabel(row.equipment);

  return (
    <li>
      <button
        type="button"
        className="deployed-equipment-display__card"
        onClick={() => onSelect(row)}
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
}

function CategoryTreeNode({ node, onSelect }) {
  const TitleTag = node.depth === 0 ? 'h4' : 'h5';

  return (
    <div
      className={`deployed-equipment-display__category deployed-equipment-display__category--depth-${node.depth}`}
    >
      <TitleTag className="deployed-equipment-display__category-title">{node.title}</TitleTag>
      {node.children.map((child) => (
        <CategoryTreeNode key={child.key} node={child} onSelect={onSelect} />
      ))}
      {node.items.length > 0 && (
        <ul className="deployed-equipment-display__grid">
          {node.items.map((row) => (
            <EquipmentCard
              key={row.equipment?.id}
              row={row}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

export default function DeployedEquipmentDisplay({ items = [], onEditInCatalog, hideTitle = false }) {
  const [selectedRow, setSelectedRow] = useState(null);

  const categoryTree = useMemo(() => buildCategoryTree(items), [items]);

  if (!items.length) return null;

  const handleEditInCatalog = (equipmentId) => {
    setSelectedRow(null);
    onEditInCatalog?.(equipmentId);
  };

  return (
    <>
      <section className="deployed-equipment-display">
        {!hideTitle && (
          <h3 className="deployed-equipment-display__title">Вооружение и техника</h3>
        )}
        {categoryTree.map((node) => (
          <CategoryTreeNode
            key={node.key}
            node={node}
            onSelect={setSelectedRow}
          />
        ))}
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
