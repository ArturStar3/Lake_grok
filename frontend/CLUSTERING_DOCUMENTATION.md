# Улучшения функционала кластеризации маркеров на карте

## Что было сделано

### 1. Создана новая утилита `markerClusteringUtils.js`

Этот файл содержит всю логику кластеризации маркеров:

#### Основные функции:

- **`groupByCountryAndFilter(objects)`** - Группирует объекты по `country.title` и фильтрует только те, где `marker.is_flag === true`

- **`sortByOrder(objects)`** - Сортирует объекты по `marker.order` по возрастанию (меньше = выше приоритет)

- **`latLngToPixel(map, lat, lng)`** - Преобразует координаты lat/lng в пиксели на карте Leaflet

- **`calcDistancePx(p1, p2)`** - Вычисляет расстояние между двумя точками в пикселях

- **`findNearbyObjects(baseObj, candidates, map)`** - Находит все объекты на расстоянии < 1 см (37.8px) от базового объекта

- **`createClusters(objects, map)`** - Создает кластеры объектов на основе близости на карте

- **`calculateClusterOffsets(cluster)`** - Рассчитывает смещения по Y для каждого маркера в кластере

- **`applyClusterOffsets(cluster, offsets)`** - Применяет офсеты к объектам, выравнивая их координаты

- **`processMarkerClustering(objects, map)`** - Главная функция, которая объединяет весь алгоритм

#### Константы:

```javascript
const CLUSTER_DISTANCE_CM = 1; // Расстояние для группировки в см
const CLUSTER_DISTANCE_PX = 37.8; // Эквивалент в пикселях (1 см при 96 DPI)
```

### 2. Обновлен `MapUtils.jsx`

- Добавлен импорт функций кластеризации
- Добавлен state `clusteredObjects` для хранения обработанных объектов
- В `useEffect` теперь применяется `processMarkerClustering(objects, mapInstance)`
- Функция теперь возвращает объект `{ iconsById, clusteredObjects }` вместо просто `iconsById`
- В `useMemo` используется `clusteredObjects` для создания иконок с корректными смещениями

### 3. Обновлен `MapComponent.jsx`

- Теперь передается `mapInstance.current` в `LabelGeneration`
- Используется `clusteredObjects` вместо `displayedObjects` для корректного отображения маркеров с офсетами

### 4. Примеры использования

Отдельного файла `clusteringExamples.js` в репозитории нет. Рабочие вызовы лежат в `markerClusteringUtils.js`, `MapUtils.jsx` и `BubbleClusterLayer.jsx`. Фрагмент ниже показывает те же функции.

## Как это работает

### Алгоритм кластеризации:

1. **Фильтрация**: Отбираются только объекты с `is_flag = true`
2. **Группировка**: Объекты группируются по `country.title`
3. **Сортировка**: В каждой группе объекты сортируются по `marker.order` (возрастание)
4. **Создание кластеров**:
   - Берется объект с наивысшим приоритетом (минимальный order)
   - Ищутся все объекты на расстоянии < 1 см на карте
   - Они группируются в один кластер
   - Процесс повторяется для оставшихся объектов
5. **Расчет позиций**:
   - Все объекты в кластере получают координаты главного маркера (lat, lng)
   - Каждому назначается `offsetY` для вертикального смещения
   - Маркеры выстраиваются вертикально, начиная от нижнего к верхнему

### Пример расчета offsetY:

Если кластер = [obj1, obj2, obj3, obj4] с order=[1, 2, 2, 4]:

```
Без смещения (от нижнего к верхнему):
obj4.offsetY = 0          (bottom)
obj3.offsetY = 50         (height of obj4)
obj2.offsetY = 100        (height of obj4 + obj3)
obj1.offsetY = 150        (height of all below)

После нормализации (центрирование):
obj4.offsetY = -100
obj3.offsetY = -50
obj2.offsetY = 0
obj1.offsetY = 50         (top)
```

## Использование в коде

### В MapComponent:

```jsx
const { iconsById, clusteredObjects } = LabelGeneration(
  objects,
  mapInstance.current,
);
const displayedObjectsForMarkers = clusteredObjects.filter((obj) =>
  selectedObj.includes(obj.id),
);

{
  displayedObjectsForMarkers.map((obj, idx) => (
    <Marker
      key={getMarkerKey(obj, idx)}
      position={[obj.lat, obj.lng]}
      icon={iconsById[obj.id]}
      draggable={false}
    />
  ));
}
```

### В MapUtils:

```jsx
const { iconsById, clusteredObjects } = useMemo(() => {
  // Создание иконок с учетом offsetY
  // Маркеры позиционируются с transform: translateY(${offsetY}px)
}, [clusteredObjects, svgCache]);
```

## Данные объекта после кластеризации

После применения кластеризации каждый объект содержит:

```javascript
{
  ...originalObject,
  lat: 41.3,                    // Координата главного маркера (для всех в кластере)
  lng: 69.2,                    // Координата главного маркера (для всех в кластере)
  offsetY: -50,                 // Смещение по вертикали
  isInCluster: true,            // Флаг, что объект в кластере
  clusterId: "739ac49f-e3c..."  // ID главного объекта кластера
}
```

## Отладка

### Проверка данных API:

Убедитесь, что API возвращает объекты с полной структурой:

```json
{
  "id": "...",
  "title": "...",
  "label": "...",
  "lat": 41.3,
  "lng": 69.2,
  "country": { "title": "Узбекистан", "color": "blue" },
  "marker": {
    "path": "...",
    "top": 5,
    "width": 100,
    "height": 50,
    "order": 1,
    "scale": "1.0",
    "is_flag": true
  }
}
```

### Проверка в браузере:

1. Откройте React DevTools
2. Найдите компонент `MapComponent`
3. Проверьте props `clusteredObjects`
4. Убедитесь, что объекты имеют `offsetY`, `isInCluster`, `clusterId`

### Логирование:

В `markerClusteringUtils.js` можно добавить console.log для отладки:

```javascript
export const processMarkerClustering = (objects, map) => {
  // ...
  console.log("Grouped by country:", groupedByCountry);
  console.log("Clusters created:", clusters);
  console.log("Result:", result);
  // ...
};
```

## Параметры, которые можно настроить

В `markerClusteringUtils.js`:

```javascript
const CM_TO_PIXELS = 37.8; // Преобразование см в пиксели
const CLUSTER_DISTANCE_CM = 1; // Радиус группировки в сантиметрах
const CLUSTER_DISTANCE_PX = 37.8; // Радиус в пикселях
```

Чтобы изменить радиус группировки (например, на 2 см):

```javascript
const CLUSTER_DISTANCE_CM = 2;
const CLUSTER_DISTANCE_PX = CLUSTER_DISTANCE_CM * CM_TO_PIXELS;
```

## Возможные улучшения в будущем

1. **Анимация**: Добавить плавную анимацию появления маркеров в кластере
2. **Интерактивность**: Кликнуть на главный маркер для раскрытия/скрытия кластера
3. **Динамические размеры**: Автоматический расчет высоты кластера на основе количества объектов
4. **Кэширование**: Кэшировать результаты кластеризации для быстрого переключения фильтров
5. **Оптимизация**: Использовать WebWorker для обработки больших массивов данных
