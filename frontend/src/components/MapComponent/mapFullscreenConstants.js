/** @typedef {'layers' | 'objects' | 'events' | 'zones' | 'situations'} FullscreenDockTab */

export const FULLSCREEN_DOCK_TABS = /** @type {const} */ ([
  'layers',
  'objects',
  'events',
  'zones',
  'situations',
]);

export const FULLSCREEN_TAB_LABELS = {
  layers: { short: 'Слои', label: 'Слои карты' },
  objects: { short: 'Объекты', label: 'Объекты' },
  events: { short: 'События', label: 'События' },
  zones: { short: 'Зоны', label: 'Зоны действия' },
  situations: { short: 'Обстановка', label: 'Оперативная обстановка' },
};
