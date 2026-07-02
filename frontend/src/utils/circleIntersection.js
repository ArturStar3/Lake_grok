/**
 * Вычисляет точки пересечения двух окружностей
 * @param {Object} circle1 - {lat, lng, radius} первая окружность (radius в км)
 * @param {Object} circle2 - {lat, lng, radius} вторая окружность (radius в км)
 * @returns {Array} - массив точек пересечения [{lat, lng}] (может быть 0, 1 или 2 точки)
 */
export function calculateCircleIntersections(circle1, circle2) {
  // Радиусы приходят в километрах, переводим в метры
  const r1 = circle1.radius * 1000;
  const r2 = circle2.radius * 1000;
  
  // Радиус Земли в метрах
  const R = 6371000;
  
  // Переводим координаты в радианы
  const lat1Rad = circle1.lat * Math.PI / 180;
  const lng1Rad = circle1.lng * Math.PI / 180;
  const lat2Rad = circle2.lat * Math.PI / 180;
  const lng2Rad = circle2.lng * Math.PI / 180;
  
  // Вычисляем расстояние между центрами окружностей (формула гаверсинусов)
  const dLat = lat2Rad - lat1Rad;
  const dLng = lng2Rad - lng1Rad;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1Rad) * Math.cos(lat2Rad) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // расстояние в метрах
  
  // Проверяем, есть ли пересечение
  if (d > r1 + r2) {
    // Окружности не пересекаются (слишком далеко)
    return [];
  }
  if (d < Math.abs(r1 - r2)) {
    // Одна окружность внутри другой
    return [];
  }
  if (d === 0 && r1 === r2) {
    // Окружности совпадают
    return [];
  }
  
  // Вычисляем точки пересечения
  // Используем упрощенный метод через азимут и расстояние
  const bearing = Math.atan2(
    Math.sin(lng2Rad - lng1Rad) * Math.cos(lat2Rad),
    Math.cos(lat1Rad) * Math.sin(lat2Rad) - 
    Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(lng2Rad - lng1Rad)
  );
  
  // Расстояние от первого центра до точки на линии между центрами
  const a_dist = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  
  // Высота от линии между центрами до точек пересечения
  const h = Math.sqrt(r1 * r1 - a_dist * a_dist);
  
  // Точка на линии между центрами
  const midLat = Math.asin(
    Math.sin(lat1Rad) * Math.cos(a_dist / R) +
    Math.cos(lat1Rad) * Math.sin(a_dist / R) * Math.cos(bearing)
  );
  const midLng = lng1Rad + Math.atan2(
    Math.sin(bearing) * Math.sin(a_dist / R) * Math.cos(lat1Rad),
    Math.cos(a_dist / R) - Math.sin(lat1Rad) * Math.sin(midLat)
  );
  
  const intersections = [];
  
  if (h > 0.1) { // Две точки пересечения (порог 0.1 метр)
    // Перпендикулярные направления
    const perpBearing1 = bearing + Math.PI / 2;
    const perpBearing2 = bearing - Math.PI / 2;
    
    // Первая точка пересечения
    const lat3 = Math.asin(
      Math.sin(midLat) * Math.cos(h / R) +
      Math.cos(midLat) * Math.sin(h / R) * Math.cos(perpBearing1)
    );
    const lng3 = midLng + Math.atan2(
      Math.sin(perpBearing1) * Math.sin(h / R) * Math.cos(midLat),
      Math.cos(h / R) - Math.sin(midLat) * Math.sin(lat3)
    );
    
    // Вторая точка пересечения
    const lat4 = Math.asin(
      Math.sin(midLat) * Math.cos(h / R) +
      Math.cos(midLat) * Math.sin(h / R) * Math.cos(perpBearing2)
    );
    const lng4 = midLng + Math.atan2(
      Math.sin(perpBearing2) * Math.sin(h / R) * Math.cos(midLat),
      Math.cos(h / R) - Math.sin(midLat) * Math.sin(lat4)
    );
    
    intersections.push(
      { lat: lat3 * 180 / Math.PI, lng: lng3 * 180 / Math.PI },
      { lat: lat4 * 180 / Math.PI, lng: lng4 * 180 / Math.PI }
    );
  } else { // Одна точка касания
    intersections.push({
      lat: midLat * 180 / Math.PI,
      lng: midLng * 180 / Math.PI
    });
  }
  
  return intersections;
}

/** Быстрая проверка: могут ли две зоны пересекаться (радиусы в км). */
function zonesMayIntersect(zone1, zone2) {
  const maxDistKm = zone1.radius + zone2.radius;
  const minDistKm = Math.abs(zone1.radius - zone2.radius);
  const midLatRad = ((zone1.lat + zone2.lat) / 2) * Math.PI / 180;
  const dLatKm = Math.abs(zone1.lat - zone2.lat) * 111;
  const dLngKm = Math.abs(zone1.lng - zone2.lng) * 111 * Math.cos(midLatRad);
  const approxDistKm = Math.hypot(dLatKm, dLngKm);
  return approxDistKm <= maxDistKm && approxDistKm >= minDistKm;
}

/**
 * @param {Array} objects - массив объектов с actions[], lat, lng, label
 * @returns {Array} - массив объектов пересечений {id, label, lat, lng, objects: [obj1.label, obj2.label]}
 */
export function findAllIntersections(objects) {
  const intersections = [];
  let intersectionId = 1;
  
  // Создаём плоский массив всех зон действия с информацией об объекте
  const allZones = [];
  objects.forEach(obj => {
    if (obj.actions && obj.actions.length > 0) {
      obj.actions.forEach((action, actionIndex) => {
        if (action.radius && action.radius > 0) {
          allZones.push({
            objectId: obj.id,
            objectTitle: obj.title,
            actionIndex: actionIndex,
            actionTitle: action.action_type?.title || 'Зона действия',
            lat: obj.lat,
            lng: obj.lng,
            radius: action.radius
          });
        }
      });
    }
  });
  
  // Группируем по типу действия — сравниваем только зоны одного типа
  const zonesByAction = new Map();
  allZones.forEach((zone) => {
    const list = zonesByAction.get(zone.actionTitle);
    if (list) list.push(zone);
    else zonesByAction.set(zone.actionTitle, [zone]);
  });

  for (const sameTypeZones of zonesByAction.values()) {
    for (let i = 0; i < sameTypeZones.length; i++) {
      for (let j = i + 1; j < sameTypeZones.length; j++) {
        const zone1 = sameTypeZones[i];
        const zone2 = sameTypeZones[j];

        if (!zonesMayIntersect(zone1, zone2)) continue;

        const circle1 = {
          lat: zone1.lat,
          lng: zone1.lng,
          radius: zone1.radius
        };
        const circle2 = {
          lat: zone2.lat,
          lng: zone2.lng,
          radius: zone2.radius
        };

        const points = calculateCircleIntersections(circle1, circle2);

        points.forEach(point => {
          const label1 = `${zone1.objectTitle} - ${zone1.actionTitle} (${zone1.radius}км)`;
          const label2 = `${zone2.objectTitle} - ${zone2.actionTitle} (${zone2.radius}км)`;

          intersections.push({
            id: intersectionId++,
            label: `Точка ${intersectionId - 1}`,
            lat: point.lat,
            lng: point.lng,
            objects: [label1, label2]
          });
        });
      }
    }
  }

  return intersections;
}
