"""
Логика военной иерархии подчинённости объектов (Target.parent).
"""

from collections import defaultdict

COMMAND_LEVELS = [
    'Стратегическое командование',
    'Оперативное командование',
    'Общевойсковая армия',
    'Армейский корпус',
    'Дивизия',
    ('ПУ бригады', 'ПУ бригады сокращенного состава'),
    'ПУ полка',
    'ПУ батальона',
]

SUPPORT_PARENT_TYPES = {
    'Авиабаза': [
        'ПУ полка', 'ПУ бригады', 'ПУ бригады сокращенного состава',
        'Дивизия', 'Армейский корпус', 'Оперативное командование',
        'Стратегическое командование',
    ],
    'Аэродром': [
        'ПУ полка', 'ПУ бригады', 'Дивизия', 'Армейский корпус',
        'Оперативное командование', 'Стратегическое командование',
    ],
    'Артиллерийский учебный центр': [
        'Оперативное командование', 'Общевойсковая армия', 'Армейский корпус',
        'Дивизия', 'Стратегическое командование',
    ],
    'Мотострелковый учебный центр': [
        'Оперативное командование', 'Общевойсковая армия', 'Армейский корпус',
        'Дивизия', 'Стратегическое командование',
    ],
    'Главный учебный центр': [
        'Стратегическое командование', 'Оперативное командование',
    ],
    'База хранения А': [
        'ПУ батальона', 'ПУ полка', 'ПУ бригады', 'Дивизия', 'Армейский корпус',
    ],
    'База хранения Б': [
        'ПУ батальона', 'ПУ полка', 'ПУ бригады', 'Дивизия', 'Армейский корпус',
    ],
    'Склад хранения': [
        'ПУ батальона', 'ПУ полка', 'ПУ бригады', 'Дивизия',
    ],
    'Центральная база вооружения': [
        'Дивизия', 'Армейский корпус', 'Оперативное командование',
        'Стратегическое командование',
    ],
    'Центральная база ремонта танков': [
        'Дивизия', 'Армейский корпус', 'Оперативное командование',
        'Стратегическое командование',
    ],
    'Мост': ['ПУ батальона', 'ПУ полка', 'ПУ бригады', 'Дивизия'],
    'Перевал': ['ПУ батальона', 'ПУ полка', 'ПУ бригады', 'Дивизия'],
    'Автотоннель': ['ПУ батальона', 'ПУ полка', 'ПУ бригады', 'Дивизия'],
    'Узловая жд станция': [
        'ПУ батальона', 'ПУ полка', 'ПУ бригады', 'Дивизия', 'Армейский корпус',
    ],
    'Гидротехнические сооружения': [
        'ПУ батальона', 'ПУ полка', 'ПУ бригады', 'Дивизия',
    ],
    'Теле-радиовышка': [
        'ПУ батальона', 'ПУ полка', 'ПУ бригады', 'Дивизия', 'Армейский корпус',
    ],
    'Радиопеленгаторный пункт': [
        'ПУ полка', 'ПУ бригады', 'Дивизия', 'Армейский корпус',
        'Оперативное командование',
    ],
    'Нефтеперерабатывающий завод': [
        'Армейский корпус', 'Оперативное командование', 'Стратегическое командование',
    ],
    'Предприятия ОПК': [
        'Армейский корпус', 'Оперативное командование', 'Стратегическое командование',
    ],
    'Вирусная опасность': ['ПУ батальона', 'ПУ полка', 'ПУ бригады'],
    'Радиационная опасность': ['ПУ батальона', 'ПУ полка', 'ПУ бригады'],
}

DEFAULT_SUPPORT_PARENT_TYPES = [
    'ПУ батальона', 'ПУ полка', 'ПУ бригады', 'ПУ бригады сокращенного состава',
    'Дивизия', 'Армейский корпус', 'Общевойсковая армия',
    'Оперативное командование', 'Стратегическое командование',
]

# Если в стране нет командных объектов — инфраструктура может подчиняться другой инфраструктуре.
INFRA_PARENT_TYPES = {
    'Аэродром': ['Авиабаза'],
    'Радиопеленгаторный пункт': ['Авиабаза', 'Аэродром'],
    'Мотострелковый учебный центр': [
        'Центральная база ремонта танков', 'Авиабаза',
    ],
    'Артиллерийский учебный центр': [
        'Центральная база ремонта танков', 'Мотострелковый учебный центр', 'Авиабаза',
    ],
    'Центральная база ремонта танков': ['Авиабаза'],
}

INFRA_ROOT_PRIORITY = [
    'Стратегическое командование',
    'Авиабаза',
    'Центральная база ремонта танков',
    'Оперативное командование',
]


def _types_at_level(level_index):
    item = COMMAND_LEVELS[level_index]
    if isinstance(item, tuple):
        return item
    return (item,)


def command_level(type_title):
    if not type_title:
        return None
    for index, item in enumerate(COMMAND_LEVELS):
        if isinstance(item, tuple):
            if type_title in item:
                return index
        elif item == type_title:
            return index
    return None


def support_parent_preferences(type_title):
    return SUPPORT_PARENT_TYPES.get(type_title, DEFAULT_SUPPORT_PARENT_TYPES)


class _RoundRobin:
    def __init__(self):
        self._state = {}

    def next(self, key, items):
        pool = list(items)
        if not pool:
            return None
        state = self._state.setdefault(key, {'pool': pool, 'index': 0})
        state['pool'] = pool
        parent = state['pool'][state['index'] % len(state['pool'])]
        state['index'] += 1
        return parent


def assign_hierarchy_for_country(targets):
    """Возвращает {target_id: parent_id | None} для объектов одной страны."""
    if not targets:
        return {}

    by_type = defaultdict(list)
    for target in targets:
        type_title = target.type.title if target.type_id else ''
        by_type[type_title].append(target)

    for items in by_type.values():
        items.sort(key=lambda t: (t.title, str(t.id)))

    assignments = {}
    level_targets = {index: [] for index in range(len(COMMAND_LEVELS))}
    rr = _RoundRobin()

    for root in by_type.get('Стратегическое командование', []):
        assignments[root.id] = None
        level_targets[0].append(root)

    def pick_from_levels(level_indices):
        for level_index in level_indices:
            pool = level_targets.get(level_index, [])
            if pool:
                return rr.next(f'level:{level_index}', pool)
        return None

    for level_index in range(1, len(COMMAND_LEVELS)):
        parent_level_indices = list(range(level_index - 1, -1, -1))
        for type_title in _types_at_level(level_index):
            for target in by_type.get(type_title, []):
                parent = pick_from_levels(parent_level_indices)
                assignments[target.id] = parent.id if parent else None
                level_targets[level_index].append(target)

    roots = level_targets[0]

    for target in targets:
        type_title = target.type.title if target.type_id else ''
        if command_level(type_title) is not None:
            if target.id not in assignments:
                assignments[target.id] = None
            continue
        if target.id in assignments:
            continue

        parent = None
        pref_types = list(support_parent_preferences(type_title))
        pref_types.extend(INFRA_PARENT_TYPES.get(type_title, []))

        for pref_type in pref_types:
            candidates = [
                item for item in by_type.get(pref_type, [])
                if item.id in assignments
            ]
            if candidates:
                parent = rr.next(f'type:{pref_type}', candidates)
                break

        if parent is None and roots:
            parent = rr.next('roots', roots)

        assignments[target.id] = parent.id if parent else None

    _assign_infra_only_countries(targets, assignments, by_type, rr)

    return assignments


def _country_has_command_units(targets):
    return any(
        command_level(target.type.title if target.type_id else '') is not None
        for target in targets
    )


def _assign_infra_only_countries(targets, assignments, by_type, rr):
    """Страны без командной структуры (например, демо RU): дерево из инфраструктуры."""
    if _country_has_command_units(targets):
        return

    orphans = [t for t in targets if assignments.get(t.id) is None]
    if len(orphans) <= 1:
        return

    root = None
    for root_type in INFRA_ROOT_PRIORITY:
        pool = by_type.get(root_type, [])
        if pool:
            root = pool[0]
            break
    if root is None:
        root = orphans[0]

    assignments[root.id] = None

    for target in targets:
        if target.id == root.id:
            continue
        type_title = target.type.title if target.type_id else ''
        parent = None
        pref_types = list(INFRA_PARENT_TYPES.get(type_title, []))
        pref_types.extend(support_parent_preferences(type_title))

        for pref_type in pref_types:
            candidates = [
                item for item in by_type.get(pref_type, [])
                if item.id != target.id and (
                    assignments.get(item.id) is not None or item.id == root.id
                )
            ]
            if candidates:
                parent = rr.next(f'infra:{pref_type}', candidates)
                break

        if parent is None:
            parent = root

        assignments[target.id] = parent.id if parent else None
