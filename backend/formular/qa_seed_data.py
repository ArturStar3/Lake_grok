"""Справочники для seed_qa_data: страны СНГ, bbox, типы действий, демо-тексты."""

from formular.enums import ActionLineTypes, ZoneGeometryModes

SEED_LABEL_PREFIX = 'seed:qa'
SEED_TAG = 'seed:qa'
QA_ATTACHMENT_PREFIX = '[qa] '
QA_PASSWORD = 'QaTest123!'

CIS_COUNTRIES = [
    {
        'iso_code': 'AM',
        'title': 'Армения',
        'title_short': 'АРМ',
        'palette': 'Синий',
        'bounds': (38.84, 41.30, 43.45, 46.63),
    },
    {
        'iso_code': 'AZ',
        'title': 'Азербайджан',
        'title_short': 'АЗЕ',
        'palette': 'Красный',
        'bounds': (38.5, 41.5, 44.5, 51.0),
    },
    {
        'iso_code': 'BY',
        'title': 'Беларусь',
        'title_short': 'БЛР',
        'palette': 'Зелёный',
        'bounds': (51.26, 56.17, 23.18, 32.78),
    },
    {
        'iso_code': 'KZ',
        'title': 'Казахстан',
        'title_short': 'КЗ',
        'palette': 'Жёлтый',
        'bounds': (40.5, 54.5, 46.5, 87.0),
    },
    {
        'iso_code': 'KG',
        'title': 'Кыргызстан',
        'title_short': 'КГ',
        'palette': 'Зелёный',
        'bounds': (39.0, 43.5, 69.0, 80.5),
    },
    {
        'iso_code': 'MD',
        'title': 'Молдова',
        'title_short': 'МДА',
        'palette': 'Морской',
        'bounds': (45.47, 48.49, 26.62, 30.16),
    },
    {
        'iso_code': 'RU',
        'title': 'Россия',
        'title_short': 'РФ',
        'palette': 'Красный',
        'bounds': (44.0, 62.0, 28.0, 60.0),
    },
    {
        'iso_code': 'TJ',
        'title': 'Таджикистан',
        'title_short': 'ТДЖ',
        'palette': 'Морской',
        'bounds': (36.5, 41.0, 67.5, 75.5),
    },
    {
        'iso_code': 'TM',
        'title': 'Туркменистан',
        'title_short': 'ТКМ',
        'palette': 'Жёлтый',
        'bounds': (35.0, 42.5, 52.5, 66.5),
    },
    {
        'iso_code': 'UZ',
        'title': 'Узбекистан',
        'title_short': 'УЗБ',
        'palette': 'Синий',
        'bounds': (37.5, 45.5, 56.0, 66.5),
    },
]

COUNTRY_BOUNDS = {item['iso_code']: item['bounds'] for item in CIS_COUNTRIES}

HQ_TITLE_KEYWORDS = (
    'Стратегическое командование',
    'Оперативное командование',
    'Headquarters',
    'HigherMAB',
    'Общевойсковая армия',
    'Армейский корпус',
)

NON_FLAG_KEYWORDS = (
    'Мост',
    'Аэродром',
    'Авиабаза',
    'НПЗ',
    'Перевал',
    'Автотоннель',
    'вышка',
    'жд станция',
    'Склад',
    'База хранения',
    'Гидротех',
    'опасность',
    'ОПК',
    'Радиопеленгатор',
    'ремонта танков',
    'вооружения',
)

ACTION_TYPE_SPECS = [
    {
        'title': 'Разведка',
        'color': '#00ced1',
        'line_type': ActionLineTypes.SOLID,
        'zone_mode': ZoneGeometryModes.FLAT,
    },
    {
        'title': 'Патрулирование',
        'color': '#ff8c00',
        'line_type': ActionLineTypes.DASHED,
        'zone_mode': ZoneGeometryModes.FLAT,
    },
    {
        'title': 'Огневая поддержка',
        'color': '#9370db',
        'line_type': ActionLineTypes.DASH_DOT,
        'zone_mode': ZoneGeometryModes.FLAT,
    },
    {
        'title': 'Блокада',
        'color': '#dc143c',
        'line_type': ActionLineTypes.DASH_X,
        'zone_mode': ZoneGeometryModes.FLAT,
    },
    {
        'title': 'РЛС',
        'color': '#00ced1',
        'line_type': ActionLineTypes.SOLID,
        'zone_mode': ZoneGeometryModes.LOS_RADAR,
        'min_elevation_deg': 0.5,
    },
    {
        'title': 'Затопление — нормальный уровень',
        'color': '#3498db',
        'line_type': ActionLineTypes.DASHED,
        'zone_mode': ZoneGeometryModes.POLYGON,
        'is_inundation_zone': True,
    },
    {
        'title': 'Затопление — аварийный уровень',
        'color': '#e74c3c',
        'line_type': ActionLineTypes.SOLID,
        'zone_mode': ZoneGeometryModes.POLYGON,
        'is_inundation_zone': True,
    },
    {
        'title': 'Боевой радиус',
        'color': '#e74c3c',
        'line_type': ActionLineTypes.SOLID,
        'zone_mode': ZoneGeometryModes.FLAT,
    },
]

EVENT_MARKER_FILES = [
    'Авиабаза.svg',
    'Мост.svg',
    'Радиопеленгаторный_пункт.svg',
    'Вирусная_опасность.svg',
    'Радиационная_опасность.svg',
    'Перевал.svg',
]

EVENT_TYPE_TITLES = [
    'Учения',
    'Переброска войск',
    'Авиационная активность',
    'Строительство',
    'Инцидент',
    'Разведывательная активность',
]

EVENT_SPECS = [
    {
        'title': 'Учения ОДКБ «Рубеж»',
        'object_name': 'Полигон Сарышаган',
        'description': (
            f'[{SEED_TAG}] Совместные учения ПВО и авиации. '
            'Отработка перехвата и взаимодействия штабов.'
        ),
        'event_type': 'Учения',
        'country_iso': 'KZ',
        'marker_file': 'Авиабаза.svg',
        'color': '#27ae60',
        'date_start': '2025-09-12',
        'date_end': '2025-09-18',
        'time_start': '06:00:00',
        'time_end': '22:00:00',
        'shape': {
            'type': 'circle',
            'geometry': {'lat': 46.0, 'lng': 73.6, 'radius': 85000},
        },
    },
    {
        'title': 'Переброска мотострелковой колонны',
        'object_name': 'Трасса М1, Минская область',
        'description': (
            f'[{SEED_TAG}] Перемещение колонны БТР и тягачей. '
            'Оценочная численность — до батальона.'
        ),
        'event_type': 'Переброска войск',
        'country_iso': 'BY',
        'marker_file': 'Мост.svg',
        'color': '#f2994a',
        'date_start': '2025-11-03',
        'date_end': '2025-11-05',
        'time_start': '04:30:00',
        'time_end': '20:00:00',
        'shape': {
            'type': 'area',
            'geometry': {
                'points': [
                    {'lat': 53.90, 'lng': 27.45},
                    {'lat': 53.95, 'lng': 27.70},
                    {'lat': 53.80, 'lng': 27.75},
                    {'lat': 53.78, 'lng': 27.50},
                ],
            },
        },
    },
    {
        'title': 'Активность стратегической авиации',
        'object_name': 'Авиабаза Энгельс',
        'description': (
            f'[{SEED_TAG}] Зафиксированы вылеты стратегической авиации '
            'и сопровождение истребителями.'
        ),
        'event_type': 'Авиационная активность',
        'country_iso': 'RU',
        'marker_file': 'Авиабаза.svg',
        'color': '#2f80ed',
        'date_start': '2026-01-15',
        'date_end': None,
        'time_start': '08:00:00',
        'time_end': '14:30:00',
        'shape': {
            'type': 'point',
            'geometry': {'lat': 51.47, 'lng': 46.21},
        },
    },
    {
        'title': 'Модернизация позиции РЛС',
        'object_name': 'РЛС Алматы',
        'description': (
            f'[{SEED_TAG}] На объекте ведутся работы по замене антенного поста.'
        ),
        'event_type': 'Строительство',
        'country_iso': 'KZ',
        'marker_file': 'Радиопеленгаторный_пункт.svg',
        'color': '#9b51e0',
        'date_start': '2026-02-01',
        'date_end': '2026-04-30',
        'time_start': None,
        'time_end': None,
        'shape': {
            'type': 'circle',
            'geometry': {'lat': 43.24, 'lng': 76.95, 'radius': 12000},
        },
    },
    {
        'title': 'Инцидент на КПП',
        'object_name': 'Пограничный переход «Дустлик»',
        'description': (
            f'[{SEED_TAG}] Временное ограничение пропускного режима ~4 часа.'
        ),
        'event_type': 'Инцидент',
        'country_iso': 'UZ',
        'marker_file': 'Мост.svg',
        'color': '#eb5757',
        'date_start': '2025-12-20',
        'date_end': '2025-12-20',
        'time_start': '11:15:00',
        'time_end': '15:40:00',
        'shape': {
            'type': 'point',
            'geometry': {'lat': 41.32, 'lng': 69.28},
        },
    },
    {
        'title': 'Разведывательные полёты БПЛА',
        'object_name': 'Район Гиссарской долины',
        'description': (
            f'[{SEED_TAG}] Зафиксированы полёты БПЛА на малых высотах.'
        ),
        'event_type': 'Разведывательная активность',
        'country_iso': 'TJ',
        'marker_file': 'Перевал.svg',
        'color': '#56ccf2',
        'date_start': '2026-03-04',
        'date_end': '2026-03-04',
        'time_start': '05:10:00',
        'time_end': '09:40:00',
        'shape': {
            'type': 'circle',
            'geometry': {'lat': 38.56, 'lng': 68.78, 'radius': 28000},
        },
    },
    {
        'title': 'Учения ПВО на Кавказе',
        'object_name': 'Полигон Гянджа',
        'description': (
            f'[{SEED_TAG}] Отработка отражения налёта крылатых ракет.'
        ),
        'event_type': 'Учения',
        'country_iso': 'AZ',
        'marker_file': 'Радиопеленгаторный_пункт.svg',
        'color': '#27ae60',
        'date_start': '2026-04-10',
        'date_end': '2026-04-14',
        'time_start': '07:00:00',
        'time_end': '21:00:00',
        'shape': {
            'type': 'area',
            'geometry': {
                'points': [
                    {'lat': 40.68, 'lng': 46.32},
                    {'lat': 40.75, 'lng': 46.50},
                    {'lat': 40.62, 'lng': 46.55},
                    {'lat': 40.58, 'lng': 46.36},
                ],
            },
        },
    },
    {
        'title': 'Строительство складского комплекса',
        'object_name': 'Окрестности Бишкека',
        'description': (
            f'[{SEED_TAG}] Возведение складов ГСМ и боксов для техники.'
        ),
        'event_type': 'Строительство',
        'country_iso': 'KG',
        'marker_file': 'Вирусная_опасность.svg',
        'color': '#9b51e0',
        'date_start': '2026-05-01',
        'date_end': '2026-08-31',
        'time_start': None,
        'time_end': None,
        'shape': {
            'type': 'point',
            'geometry': {'lat': 42.87, 'lng': 74.59},
        },
    },
]

HYDRO_SITES = [
    {
        'iso_code': 'TJ',
        'title': 'Рогунская ГЭС (qa)',
        'lat': 38.389,
        'lng': 69.771,
        'crest_elevation_m': 1095.0,
        'normal_pool_level_m': 1070.0,
        'max_pool_level_m': 1090.0,
    },
    {
        'iso_code': 'TJ',
        'title': 'Нурекская ГЭС (qa)',
        'lat': 38.372,
        'lng': 69.348,
        'crest_elevation_m': 920.0,
        'normal_pool_level_m': 910.0,
        'max_pool_level_m': 918.0,
    },
    {
        'iso_code': 'KG',
        'title': 'Токтогульская ГЭС (qa)',
        'lat': 41.656,
        'lng': 72.863,
        'crest_elevation_m': 900.0,
        'normal_pool_level_m': 875.0,
        'max_pool_level_m': 900.0,
    },
    {
        'iso_code': 'KZ',
        'title': 'Шардаринская ГЭС (qa)',
        'lat': 41.244,
        'lng': 67.971,
        'crest_elevation_m': 255.0,
        'normal_pool_level_m': 250.0,
        'max_pool_level_m': 254.0,
    },
    {
        'iso_code': 'AZ',
        'title': 'Мингечевирская ГЭС (qa)',
        'lat': 40.780,
        'lng': 47.028,
        'crest_elevation_m': 83.0,
        'normal_pool_level_m': 83.0,
        'max_pool_level_m': 83.0,
    },
]

EQUIPMENT_CATEGORY_TREE = [
    ('ВВС', None, 1),
    ('Истребители', 'ВВС', 1),
    ('Бомбардировщики', 'ВВС', 2),
    ('Сухопутные войска', None, 2),
    ('Танки', 'Сухопутные войска', 1),
    ('БМП', 'Сухопутные войска', 2),
    ('ПВО', None, 3),
    ('ЗРК', 'ПВО', 1),
]

EQUIPMENT_SPECS = [
    {
        'designation': 'Су-35С',
        'title': 'Многоцелевой истребитель Су-35С',
        'category': 'Истребители',
        'iso': 'RU',
        'description': 'Многоцелевой истребитель поколения 4++',
    },
    {
        'designation': 'Ту-160',
        'title': 'Стратегический бомбардировщик Ту-160',
        'category': 'Бомбардировщики',
        'iso': 'RU',
        'description': 'Стратегический ракетоносец-бомбардировщик',
    },
    {
        'designation': 'Т-90М',
        'title': 'Основной боевой танк Т-90М «Прорыв»',
        'category': 'Танки',
        'iso': 'RU',
        'description': 'ОБТ с усиленной защитой',
    },
    {
        'designation': 'Т-72Б3',
        'title': 'Основной боевой танк Т-72Б3',
        'category': 'Танки',
        'iso': 'RU',
        'description': 'Модернизированный ОБТ семейства Т-72',
    },
    {
        'designation': 'БМП-3',
        'title': 'Боевая машина пехоты БМП-3',
        'category': 'БМП',
        'iso': 'RU',
        'description': 'БМП с мощным вооружением',
    },
    {
        'designation': 'Тор-М2',
        'title': 'Зенитный ракетный комплекс «Тор-М2»',
        'category': 'ЗРК',
        'iso': 'RU',
        'description': 'Короткодействующий ЗРК',
    },
    {
        'designation': 'С-400',
        'title': 'Зенитная ракетная система С-400 «Триумф»',
        'category': 'ЗРК',
        'iso': 'RU',
        'description': 'Дальнодействующий ЗРК',
    },
    {
        'designation': 'Су-34',
        'title': 'Фронтовой бомбардировщик Су-34',
        'category': 'Истребители',
        'iso': 'RU',
        'description': 'Ударный самолёт для работы по наземным целям',
    },
]

PERSON_PROFILES = [
    {
        'full_name': 'Петров Игорь Сергеевич',
        'position': 'Командир авиаполка, полковник',
        'info': {
            'education': 'Военная академия ВВС, 2004 г.',
            'family': 'Женат, двое детей.',
            'service': 'С 2004 г. на командных должностях авиации.',
            'contacts': 'Связан с представителями завода-изготовителя.',
            'assessment': 'Ключевая фигура управления полком.',
        },
    },
    {
        'full_name': 'Сидоров Алексей Викторович',
        'position': 'Заместитель командира по вооружению, подполковник',
        'info': {
            'education': 'Военная академия, инженерное отделение, 2007 г.',
            'service': 'Инженер-оружейник, заместитель командира.',
            'assessment': 'Ответственен за боеготовность вооружения.',
        },
    },
    {
        'full_name': 'Козлов Владимир Петрович',
        'position': 'Начальник штаба полка, подполковник',
        'info': {
            'education': 'Общевойсковая академия, 2006 г.',
            'service': 'Штабная карьера, начальник штаба с 2021 г.',
            'assessment': 'Координатор планирования.',
        },
    },
    {
        'full_name': 'Жумабеков Ерлан Кайратович',
        'position': 'Командир расчёта РЛС, капитан',
        'info': {
            'education': 'Военный институт Сил воздушной обороны, 2015 г.',
            'service': 'Дежурный командир смены РЛС с 2020 г.',
            'assessment': 'Оперативный руководитель смены.',
        },
    },
    {
        'full_name': 'Нурланов Асхат Темирланович',
        'position': 'Заместитель командира расчёта, старший лейтенант',
        'info': {
            'education': 'Военный институт Сил воздушной обороны, 2019 г.',
            'service': 'Специалист по аппаратуре обработки сигналов.',
            'assessment': 'Технический специалист.',
        },
    },
    {
        'full_name': 'Иванов Сергей Николаевич',
        'position': 'Начальник склада ГСМ, майор',
        'info': {
            'education': 'Тыловое училище, 2009 г.',
            'service': 'Служба в подразделениях материального обеспечения.',
            'assessment': 'Контроль запасов топлива.',
        },
    },
    {
        'full_name': 'Алиев Рашид Мамедович',
        'position': 'Командир бригады, полковник',
        'info': {
            'education': 'Общевойсковая академия, 2005 г.',
            'service': 'Командование мотострелковыми соединениями.',
            'assessment': 'Высокий приоритет сопровождения.',
        },
    },
    {
        'full_name': 'Садыков Бекзат Омурбекович',
        'position': 'Начальник учебного центра, полковник',
        'info': {
            'education': 'Военный институт, 2003 г.',
            'service': 'Подготовка мотострелковых подразделений.',
            'assessment': 'Организатор боевой подготовки.',
        },
    },
]

PERSON_RELATIONS = [
    ('Петров Игорь Сергеевич', 'Сидоров Алексей Викторович', 'Подчиняется'),
    ('Петров Игорь Сергеевич', 'Козлов Владимир Петрович', 'Подчиняется'),
    ('Козлов Владимир Петрович', 'Сидоров Алексей Викторович', 'Коллега'),
    ('Жумабеков Ерлан Кайратович', 'Нурланов Асхат Темирланович', 'Подчиняется'),
    ('Алиев Рашид Мамедович', 'Садыков Бекзат Омурбекович', 'Коллега'),
]

SITUATION_SPECS = [
    {
        'title': f'[{SEED_TAG}] Обстановка Центральная Азия',
        'description': 'Сводка по объектам Казахстана и Узбекистана.',
        'iso_codes': ['KZ', 'UZ'],
        'color': '#2f80ed',
        'geometry': {
            'type': 'Polygon',
            'coordinates': [[
                [66.9, 41.2],
                [71.5, 41.2],
                [71.5, 43.4],
                [66.9, 43.4],
                [66.9, 41.2],
            ]],
        },
        'second_revision': True,
    },
    {
        'title': f'[{SEED_TAG}] Обстановка европейская часть РФ',
        'description': 'Контроль объектов западного направления.',
        'iso_codes': ['RU'],
        'color': '#eb5757',
        'geometry': {
            'type': 'Polygon',
            'coordinates': [[
                [36.0, 54.0],
                [40.0, 54.0],
                [40.0, 56.5],
                [36.0, 56.5],
                [36.0, 54.0],
            ]],
        },
        'second_revision': True,
    },
    {
        'title': f'[{SEED_TAG}] Обстановка Беларусь',
        'description': 'Наблюдение за перебросками и складами.',
        'iso_codes': ['BY'],
        'color': '#27ae60',
        'geometry': {
            'type': 'Polygon',
            'coordinates': [[
                [27.2, 53.6],
                [28.1, 53.6],
                [28.1, 54.1],
                [27.2, 54.1],
                [27.2, 53.6],
            ]],
        },
    },
    {
        'title': f'[{SEED_TAG}] Обстановка Кавказ',
        'description': 'Азербайджан и Армения.',
        'iso_codes': ['AZ', 'AM'],
        'color': '#f2994a',
        'geometry': {
            'type': 'Polygon',
            'coordinates': [[
                [44.6, 39.8],
                [46.8, 39.8],
                [46.8, 41.2],
                [44.6, 41.2],
                [44.6, 39.8],
            ]],
        },
    },
    {
        'title': f'[{SEED_TAG}] Обстановка Ферганская долина',
        'description': 'Узбекистан, Кыргызстан, Таджикистан.',
        'iso_codes': ['UZ', 'KG', 'TJ'],
        'color': '#9b51e0',
        'geometry': {
            'type': 'Polygon',
            'coordinates': [[
                [70.5, 40.2],
                [72.8, 40.2],
                [72.8, 41.4],
                [70.5, 41.4],
                [70.5, 40.2],
            ]],
        },
    },
]

VULNERABILITY_SPECS = [
    ('КПП-1', 'Главный контрольно-пропускной пункт'),
    ('Склад ГСМ', 'Резервуарный парк у периметра'),
    ('Антенный пост', 'Открытая позиция РЛС'),
    ('Электроподстанция', 'Питание объекта'),
    ('Вертолётная площадка', 'Площадка в северной части'),
    ('Капонир №3', 'Стоянка ударной авиации'),
    ('Узел связи', 'Аппаратная защищённой связи'),
    ('Ремонтный бокс', 'Техническое обслуживание техники'),
]

QA_USERS = [
    {
        'username': 'qa_operator',
        'full_name': 'QA Оператор',
        'is_staff': False,
        'group': 'Операторы (только чтение)',
    },
    {
        'username': 'qa_analyst',
        'full_name': 'QA Аналитик',
        'is_staff': False,
        'group': 'СНГ',
    },
]


def marker_title_from_filename(filename: str) -> str:
    return filename.rsplit('.', 1)[0].replace('_', ' ')


def is_hq_title(title: str) -> bool:
    return any(key.lower() in title.lower() for key in HQ_TITLE_KEYWORDS)


def is_flag_title(title: str) -> bool:
    lowered = title.lower()
    if any(key.lower() in lowered for key in NON_FLAG_KEYWORDS):
        return False
    return True
