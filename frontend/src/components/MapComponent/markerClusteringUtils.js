/**
 * Утилиты для кластеризации и группировки маркеров на карте
 */

const CM_TO_PIXELS = 37.8; // 1 см в пикселях при 96 DPI
const CLUSTER_DISTANCE_CM = 1; // Расстояние в сантиметрах для группировки
const CLUSTER_DISTANCE_PX = CLUSTER_DISTANCE_CM * CM_TO_PIXELS; // ~37.8 пикселей

/**
 * Группирует объекты где is_flag=true по country.title и сортирует по marker.order
 * @param {Array} objects - Массив объектов с данными маркеров
 * @returns {Object} Объект вида { countryTitle: [sorted_objects] }
 */
export const groupByCountryAndFilter = (objects) => {
  if (!Array.isArray(objects)) return {};

  return objects
    .filter(obj => obj.marker?.is_flag === true)
    .reduce((acc, obj) => {
      const country = obj.country?.title || "Unknown";
      if (!acc[country]) {
        acc[country] = [];
      }
      acc[country].push(obj);
      return acc;
    }, {});
};

/**
 * Сортирует объекты по marker.order (по возрастанию приоритета)
 * @param {Array} objects - Массив объектов
 * @returns {Array} Отсортированный массив
 */
export const sortByOrder = (objects) => {
  return [...objects].sort((a, b) => {
    const orderA = parseInt(a.marker?.order) || 999;
    const orderB = parseInt(b.marker?.order) || 999;
    return orderA - orderB;
  });
};

/**
 * Преобразует координаты lat/lng в пиксели на карте Leaflet
 * @param {Object} map - Инстанс Leaflet карты
 * @param {number} lat - Широта
 * @param {number} lng - Долгота
 * @returns {Object|null} { x, y } в пикселях или null
 */
export const latLngToPixel = (map, lat, lng) => {
  if (!map || !map.latLngToLayerPoint) return null;
  try {
    const point = map.latLngToLayerPoint({ lat, lng });
    return { x: point.x, y: point.y };
  } catch (err) {
    console.warn("Ошибка при преобразовании координат:", err);
    return null;
  }
};

/**
 * Вычисляет расстояние между двумя точками в пикселях
 * @param {Object} p1 - Первая точка { x, y }
 * @param {Object} p2 - Вторая точка { x, y }
 * @returns {number} Расстояние в пикселях
 */
export const calcDistancePx = (p1, p2) => {
  if (!p1 || !p2) return Infinity;
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
};

/**
 * Находит все объекты, находящиеся на расстоянии менее CLUSTER_DISTANCE_PX от базового объекта
 * @param {Object} baseObj - Базовый объект
 * @param {Array} candidates - Массив кандидатов для проверки
 * @param {Object} map - Инстанс Leaflet карты
 * @returns {Array} Массив объектов, находящихся близко
 */
export const findNearbyObjects = (baseObj, candidates, map) => {
  if (!map || !baseObj) return [];

  const basePixel = latLngToPixel(map, baseObj.lat, baseObj.lng);
  if (!basePixel) return [];

  return candidates.filter(candidate => {
    if (candidate.id === baseObj.id) return true; // Включаем сам базовый объект

    const candidatePixel = latLngToPixel(map, candidate.lat, candidate.lng);
    if (!candidatePixel) return false;

    const distance = calcDistancePx(basePixel, candidatePixel);
    return distance <= CLUSTER_DISTANCE_PX;
  });
};

/**
 * Группирует объекты в кластеры на основе близости на карте (spatial hash, O(n) среднее).
 * @param {Array} objects - Отсортированные объекты одной страны
 * @param {Object} map - Инстанс Leaflet карты
 * @returns {Array} Массив кластеров, где каждый кластер - это массив объектов
 */
export const createClusters = (objects, map) => {
  if (!Array.isArray(objects) || objects.length === 0) return [];
  if (!map) return objects.map((obj) => [obj]);

  const cellSize = CLUSTER_DISTANCE_PX;
  const grid = new Map();

  const cellKey = (x, y) => `${Math.floor(x / cellSize)},${Math.floor(y / cellSize)}`;

  objects.forEach((obj) => {
    const pixel = latLngToPixel(map, obj.lat, obj.lng);
    if (!pixel) return;
    const key = cellKey(pixel.x, pixel.y);
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push({ obj, pixel });
  });

  const clusters = [];
  const processed = new Set();

  for (const baseObj of objects) {
    if (processed.has(baseObj.id)) continue;

    const basePixel = latLngToPixel(map, baseObj.lat, baseObj.lng);
    if (!basePixel) {
      processed.add(baseObj.id);
      clusters.push([baseObj]);
      continue;
    }

    const cluster = [];
    const bx = Math.floor(basePixel.x / cellSize);
    const by = Math.floor(basePixel.y / cellSize);

    for (let cx = bx - 1; cx <= bx + 1; cx++) {
      for (let cy = by - 1; cy <= by + 1; cy++) {
        const cell = grid.get(`${cx},${cy}`);
        if (!cell) continue;
        for (const { obj, pixel } of cell) {
          if (processed.has(obj.id)) continue;
          if (calcDistancePx(basePixel, pixel) <= CLUSTER_DISTANCE_PX) {
            cluster.push(obj);
            processed.add(obj.id);
          }
        }
      }
    }

    cluster.sort((a, b) => {
      const orderA = parseInt(a.marker?.order) || 999;
      const orderB = parseInt(b.marker?.order) || 999;
      return orderA - orderB;
    });

    clusters.push(cluster);
  }

  return clusters;
};

/**
 * Вычисляет смещение по Y для маркеров в кластере
 * @param {Array} cluster - Массив объектов в кластере (отсортирован по order от меньшего к большему)
 * @returns {Object} Объект вида { objectId: offsetY }
 */
export const calculateClusterOffsets = (cluster) => {
  if (!Array.isArray(cluster) || cluster.length === 0) return {};

  const offsets = {};
  if (cluster.length === 1) {
    offsets[cluster[0].id] = 0;
    return offsets;
  }

  const overlapFactor = 0.8; // 80% высоты, чтобы был 20% overlap
  let currentOffset = 0;
  for (let i = cluster.length - 1; i >= 0; i--) {
    const obj = cluster[i];
    offsets[obj.id] = currentOffset;
    if (i > 0) {
      const markerScale = parseFloat(obj.marker?.scale) || 1;
      const iconHeight = (obj.marker?._computedIconHeight) ? obj.marker._computedIconHeight : (obj.marker?.height || 50) * markerScale;
      currentOffset -= iconHeight * overlapFactor;
    }
  }
  // (Логирование маркеров отключено)
  return offsets;
};

/**
 * Применяет офсеты к объектам в кластере (обновляет lat/lng и добавляет offsetY)
 * @param {Array} cluster - Массив объектов в кластере (отсортирован по order)
 * @param {Object} offsets - Объект с офсетами
 * @returns {Array} Массив объектов с обновленными координатами
 */
export const applyClusterOffsets = (cluster, offsets) => {
  if (!Array.isArray(cluster)) return [];

  // Базовая точка берется из ПЕРВОГО объекта (старший с меньшим order)
  // Это точка, где будет располагаться ПОСЛЕДНИЙ объект (младший с offsetY=0)
  const baseObj = cluster[0];

  return cluster.map(obj => ({
    ...obj,
    lat: baseObj.lat, // Все объекты в точке старшего объекта
    lng: baseObj.lng,
    offsetY: offsets[obj.id] || 0, // Смещение по Y (у последнего = 0, у первого = максимальное отрицательное)
    isInCluster: true,
    clusterId: baseObj.id
  }));
};

/**
 * Основная функция обработки кластеризации
 * @param {Array} objects - Исходные объекты
 * @param {Object} map - Инстанс Leaflet карты
 * @returns {Array} Массив объектов с применеными офсетами
 */
export const processMarkerClustering = (objects, map) => {
  if (!Array.isArray(objects) || !map) return objects;

  // Группируем по странам и фильтруем
  const groupedByCountry = groupByCountryAndFilter(objects);

  let result = [];

  // Обрабатываем каждую страну
  for (const country in groupedByCountry) {
    let countryObjects = groupedByCountry[country];
    countryObjects = sortByOrder(countryObjects);

    // Создаем кластеры
    const clusters = createClusters(countryObjects, map);

    // Применяем офсеты к каждому кластеру
    clusters.forEach(cluster => {
      const offsets = calculateClusterOffsets(cluster);
      const processedCluster = applyClusterOffsets(cluster, offsets);
      result.push(...processedCluster);
    });
  }

  // Добавляем обратно объекты, которые не являются флажками
  const flaggedIds = new Set(result.map(o => o.id));
  const nonFlaggedObjects = objects.filter(obj => !flaggedIds.has(obj.id));

  return [...result, ...nonFlaggedObjects];
};

/**
 * Функция для вычисления позиции маркера с учетом offsetY
 * Используется для позиционирования на карте
 * @param {Object} obj - Объект маркера
 * @param {number} scale - Масштаб карты (зум уровень)
 * @returns {Object} { top, left } позиция в пикселях
 */
export const calculateMarkerPosition = (obj, _scale = 1) => {
  if (!obj.offsetY) {
    return { top: 0, left: 0 };
  }

  // offsetY преобразуется в пиксели с учетом масштаба маркера
  const markerScale = parseFloat(obj.marker?.scale) || 1;
  const offsetPixels = obj.offsetY * markerScale;

  return {
    top: offsetPixels,
    left: 0
  };
};

/**
 * Кластеризация объектов с is_flag=false (группировка элементов с количеством)
 * @param {Array} objects - Массив объектов
 * @param {Object} mapInstance - Экземпляр карты
 * @param {Array} selectedIds - Массив выбранных ID объектов
 * @returns {Array} Массив объектов с информацией о кластерах
 */
export const processNonFlagClustering = (objects, mapInstance, selectedIds = []) => {
  if (!objects || !Array.isArray(objects) || !mapInstance) return objects;

  // Фильтруем только объекты с is_flag=false
  const nonFlagObjects = objects.filter(obj => obj.marker?.is_flag !== true);
  
  if (nonFlagObjects.length === 0) return [];

  // Группируем по стране
  const groupedByCountry = nonFlagObjects.reduce((acc, obj) => {
    const country = obj.country?.title || "Unknown";
    if (!acc[country]) {
      acc[country] = [];
    }
    acc[country].push(obj);
    return acc;
  }, {});

  const result = [];
  
  Object.entries(groupedByCountry).forEach(([country, countryObjects]) => {
    // Для каждой страны ищем кластеры
    const clusters = createClusters(countryObjects, mapInstance);
    
    clusters.forEach((cluster, clusterIdx) => {
      if (cluster.length === 1) {
        // Одиночный объект - показываем как есть
        result.push({
          ...cluster[0],
          isGrouped: false,
          groupSize: 1,
          groupObjects: cluster
        });
      } else {
        // Несколько объектов в группе
        const groupId = `group-${country}-${clusterIdx}`;
        
        // Проверяем сколько объектов группы выбрано
        const selectedInGroup = cluster.filter(obj => selectedIds.includes(obj.id));
        
        // Группировка для страны
        
        if (selectedInGroup.length < cluster.length) {
          // Выбраны не все объекты группы - показываем каждый отдельно
          cluster.forEach(obj => {
            result.push({
              ...obj,
              isGrouped: false,
              groupSize: 1,
              groupObjects: [obj]
            });
          });
        } else if (selectedInGroup.length === cluster.length) {
          // Выбраны ВСЕ объекты группы - показываем как группу
          const mainObj = cluster[0]; // Главный объект группы — его позиция будет позицией иконки группировки (требование 1)
          
          // Базовая точка = координаты первого объекта кластера.
          // Все записи группы (иконка + скрытые) будут иметь одинаковые lat/lng,
          // чтобы центр окружности при hover всегда совпадал с позицией групповой иконки.
          const baseLat = mainObj.lat;
          const baseLng = mainObj.lng;

          // Возвращаем один "главный" объект для иконки группы (явно фиксируем координаты)
          result.push({
            ...mainObj,
            lat: baseLat,
            lng: baseLng,
            isGrouped: true,
            groupSize: cluster.length,
            groupObjects: cluster,
            groupId: groupId,
            isGroupIcon: true // Флаг что это иконка группы, а не обычный объект
          });
          
          // Помечаем остальные объекты как скрытые (они не будут отображаться как отдельные маркеры на карте, только в круге)
          cluster.slice(1).forEach(obj => {
            result.push({
              ...obj,
              lat: baseLat,
              lng: baseLng,
              isGrouped: true,
              groupSize: cluster.length,
              groupObjects: cluster,
              groupId: groupId,
              isHidden: true, // Этот объект скрыт за группой
              mainGroupObject: mainObj
            });
          });
        }
      }
    });
  });

  return result;
};

/**
 * Получить относительные позиции элементов группы в круге (для отображения при hover).
 * Используется для компактного размещения маркеров группы вокруг иконки группировки.
 *
 * По умолчанию радиус маленький, чтобы элементы располагались плотно ВОКРУГ маркера группировки
 * (см. требования в project_context.md раздел 3.2-3.3).
 *
 * @param {Array} groupObjects - Массив объектов в группе
 * @param {Number} radius - Радиус круга в пикселях (рекомендуется 28-40 для компактности)
 * @returns {Array} Массив объектов с относительными circleX/circleY (пиксели относительно центра)
 */
export const getGroupCirclePositions = (groupObjects, radius = 40) => {
  if (!Array.isArray(groupObjects) || groupObjects.length === 0) return [];

  const count = groupObjects.length;
  const angleStep = (2 * Math.PI) / count;

  return groupObjects.map((obj, index) => {
    const angle = angleStep * index;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;

    return {
      ...obj,
      circleX: x,
      circleY: y,
      angle: angle
    };
  });
};
