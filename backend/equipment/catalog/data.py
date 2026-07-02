"""
Открытые справочные данные по образцам вооружения и техники.
ТТХ — ориентировочные публичные значения (Википедия, брошюры производителей).
Изображения — Wikimedia Commons (лицензии CC-BY-SA / public domain).
"""

from formular.enums import ActionLineTypes

CATALOG_VERSION = 1

COUNTRY_SPECS = [
    ('RU', 'Россия', 'РФ', 'red'),
    ('US', 'США', 'США', 'blue'),
    ('DE', 'Германия', 'ГР', 'yellow'),
    ('FR', 'Франция', 'ФР', 'blue'),
    ('GB', 'Великобритания', 'ВБ', 'marine'),
    ('PL', 'Польша', 'ПЛ', 'red'),
    ('UA', 'Украина', 'УА', 'yellow'),
    ('IT', 'Италия', 'ИТ', 'green'),
    ('SE', 'Швеция', 'ШВ', 'yellow'),
    ('NO', 'Норвегия', 'НР', 'marine'),
]

ACTION_TYPE_SPECS = [
    ('Практическая дальность', '#2ecc71', ActionLineTypes.SOLID),
    ('Перегоночная дальность', '#3498db', ActionLineTypes.DASHED),
    ('Боевой радиус', '#e74c3c', ActionLineTypes.SOLID),
    ('Дальность стрельбы', '#9b59b6', ActionLineTypes.DASH_DOT),
    ('Радиус действия', '#f39c12', ActionLineTypes.DASHED),
    ('Зона поражения', '#c0392b', ActionLineTypes.SOLID),
]

PARAMETER_SPECS = [
    {
        'code': 'practical_range',
        'title': 'Практическая дальность полёта',
        'zone': 'Практическая дальность',
        'unit': 'км',
        'categories': ['Истребители', 'Бомбардировщики', 'Штурмовая авиация', 'Вертолёты'],
    },
    {
        'code': 'ferry_range',
        'title': 'Перегоночная дальность',
        'zone': 'Перегоночная дальность',
        'unit': 'км',
        'categories': [
            'Истребители', 'Бомбардировщики', 'Штурмовая авиация',
            'Авианосцы', 'Эсминцы', 'Фрегаты', 'Корветы', 'МРК',
        ],
    },
    {
        'code': 'combat_radius',
        'title': 'Боевой радиус действия',
        'zone': 'Боевой радиус',
        'unit': 'км',
        'categories': ['Истребители', 'Бомбардировщики', 'Штурмовая авиация', 'Вертолёты', 'Авианосцы'],
    },
    {
        'code': 'gun_range',
        'title': 'Дальность стрельбы',
        'zone': 'Дальность стрельбы',
        'unit': 'км',
        'categories': [
            'Танки', 'БМП', 'БТР', 'Артиллерия', 'Ракетные комплексы',
            'Эсминцы', 'Фрегаты', 'Корветы', 'МРК',
        ],
    },
    {
        'code': 'operational_radius',
        'title': 'Радиус действия',
        'zone': 'Радиус действия',
        'unit': 'км',
        'categories': [
            'Танки', 'БМП', 'БТР', 'Артиллерия', 'ЗРК', 'Ракетные комплексы',
            'Авианосцы', 'Эсминцы', 'Фрегаты', 'Корветы', 'МРК', 'Подлодки',
        ],
    },
    {
        'code': 'engagement_range',
        'title': 'Зона поражения',
        'zone': 'Зона поражения',
        'unit': 'км',
        'categories': [
            'ЗРК', 'Ракетные комплексы',
            'Эсминцы', 'Фрегаты', 'Корветы', 'МРК', 'Подлодки',
        ],
    },
    {
        'code': 'max_speed',
        'title': 'Максимальная скорость',
        'zone': None,
        'unit': 'км/ч',
        'categories': [
            'Истребители', 'Бомбардировщики', 'Штурмовая авиация', 'Вертолёты',
            'Танки', 'БМП', 'БТР', 'Артиллерия',
            'Авианосцы', 'Эсминцы', 'Фрегаты', 'Корветы', 'МРК', 'Подлодки',
        ],
    },
]

CATEGORY_TREE = [
    ('ВВС', None, 1),
    ('Истребители', 'ВВС', 1),
    ('Бомбардировщики', 'ВВС', 2),
    ('Штурмовая авиация', 'ВВС', 3),
    ('Вертолёты', 'ВВС', 4),
    ('Сухопутные войска', None, 2),
    ('Танки', 'Сухопутные войска', 1),
    ('БМП', 'Сухопутные войска', 2),
    ('БТР', 'Сухопутные войска', 3),
    ('Артиллерия', 'Сухопутные войска', 4),
    ('Ракетные комплексы', 'Сухопутные войска', 5),
    ('ПВО', None, 3),
    ('ЗРК', 'ПВО', 1),
    ('ВМФ', None, 4),
    ('Авианосцы', 'ВМФ', 1),
    ('Эсминцы', 'ВМФ', 2),
    ('Фрегаты', 'ВМФ', 3),
    ('Корветы', 'ВМФ', 4),
    ('Подлодки', 'ВМФ', 5),
    ('МРК', 'ВМФ', 6),
]

# file — имя в catalog/images/; url — Wikimedia Commons для первичной загрузки
EQUIPMENT_ITEMS = [
    {
        'designation': 'Су-35С',
        'title': 'Многоцелевой истребитель Су-35С',
        'category': 'Истребители',
        'iso': 'RU',
        'description': 'Многоцелевой истребитель 4++ поколения ВКС РФ.',
        'values': {'practical_range': 3600, 'ferry_range': 4500, 'combat_radius': 1500, 'max_speed': 2400},
        'images': [
            {'file': 'su-35s_1.jpg', 'url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/Sukhoi_Su-35S_%28cropped%29.jpg/1280px-Sukhoi_Su-35S_%28cropped%29.jpg'},
            {'file': 'su-35s_2.jpg', 'url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Russian_Air_Force_Sukhoi_Su-35S.jpg/1280px-Russian_Air_Force_Sukhoi_Su-35S.jpg'},
        ],
    },
    {
        'designation': 'МиГ-31БМ',
        'title': 'Истребитель-перехватчик МиГ-31БМ',
        'category': 'Истребители',
        'iso': 'RU',
        'description': 'Высотный перехватчик дальнего радиуса действия.',
        'values': {'practical_range': 3000, 'ferry_range': 3300, 'combat_radius': 720, 'max_speed': 3000},
        'images': [
            {'file': 'mig-31_1.jpg', 'url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Mig-31.jpg/1280px-Mig-31.jpg'},
        ],
    },
    {
        'designation': 'Су-57',
        'title': 'Истребитель Су-57',
        'category': 'Истребители',
        'iso': 'RU',
        'description': 'Многофункциональный истребитель пятого поколения.',
        'values': {'practical_range': 3500, 'ferry_range': 4200, 'combat_radius': 1500, 'max_speed': 2100},
        'images': [
            {'file': 'su-57_1.jpg', 'url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Sukhoi_Su-57_at_MAKS-2011_%28cropped%29.jpg/1280px-Sukhoi_Su-57_at_MAKS-2011_%28cropped%29.jpg'},
            {'file': 'su-57_2.jpg', 'url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Su-57_%28T-50%29_prototype_%28cropped%29.jpg/1280px-Su-57_%28T-50%29_prototype_%28cropped%29.jpg'},
        ],
    },
    {
        'designation': 'Ту-160',
        'title': 'Стратегический бомбардировщик Ту-160',
        'category': 'Бомбардировщики',
        'iso': 'RU',
        'description': 'Стратегический ракетоносец-бомбардировщик.',
        'values': {'practical_range': 12300, 'ferry_range': 16000, 'combat_radius': 7300, 'max_speed': 950},
        'images': [
            {'file': 'tu-160_1.jpg', 'url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2c/Tu-160_Belolobov.jpg/1280px-Tu-160_Belolobov.jpg'},
        ],
    },
    {
        'designation': 'Су-34',
        'title': 'Фронтовой бомбардировщик Су-34',
        'category': 'Штурмовая авиация',
        'iso': 'RU',
        'description': 'Ударный самолёт для поражения наземных целей.',
        'values': {'practical_range': 4000, 'ferry_range': 4500, 'combat_radius': 1100, 'max_speed': 1900},
        'images': [
            {'file': 'su-34_1.jpg', 'url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Sukhoi_Su-34_%28cropped%29.jpg/1280px-Sukhoi_Su-34_%28cropped%29.jpg'},
            {'file': 'su-34_2.jpg', 'url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Su-34_01.jpg/1280px-Su-34_01.jpg'},
        ],
    },
    {
        'designation': 'Ка-52',
        'title': 'Ударный вертолёт Ка-52 «Аллигатор»',
        'category': 'Вертолёты',
        'iso': 'RU',
        'description': 'Разведывательно-ударный вертолёт.',
        'values': {'combat_radius': 460, 'max_speed': 300},
        'images': [
            {'file': 'ka-52_1.jpg', 'url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0c/Kamov_Ka-52_%28cropped%29.jpg/1280px-Kamov_Ka-52_%28cropped%29.jpg'},
        ],
    },
    {
        'designation': 'Ми-28Н',
        'title': 'Ударный вертолёт Ми-28Н «Ночной охотник»',
        'category': 'Вертолёты',
        'iso': 'RU',
        'description': 'Ударный вертолёт армейской авиации.',
        'values': {'combat_radius': 450, 'max_speed': 320},
        'images': [
            {'file': 'mi-28_1.jpg', 'url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/Mil_Mi-28N_%28cropped%29.jpg/1280px-Mil_Mi-28N_%28cropped%29.jpg'},
        ],
    },
    {
        'designation': 'Т-90М',
        'title': 'ОБТ Т-90М «Прорыв»',
        'category': 'Танки',
        'iso': 'RU',
        'description': 'Основной боевой танк с модернизированной защитой и вооружением.',
        'values': {'gun_range': 5, 'operational_radius': 450, 'max_speed': 60},
        'images': [
            {'file': 't-90m_1.jpg', 'url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/T-90M_tank_%28cropped%29.jpg/1280px-T-90M_tank_%28cropped%29.jpg'},
            {'file': 't-90m_2.jpg', 'url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/T-90A_tank.jpg/1280px-T-90A_tank.jpg'},
        ],
    },
    {
        'designation': 'Т-72Б3',
        'title': 'ОБТ Т-72Б3',
        'category': 'Танки',
        'iso': 'RU',
        'description': 'Модернизированный танк семейства Т-72.',
        'values': {'gun_range': 4, 'operational_radius': 400, 'max_speed': 60},
        'images': [
            {'file': 't-72b3_1.jpg', 'url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/T-72B3_tank.jpg/1280px-T-72B3_tank.jpg'},
        ],
    },
    {
        'designation': 'БМП-3',
        'title': 'БМП БМП-3',
        'category': 'БМП',
        'iso': 'RU',
        'description': 'Боевая машина пехоты с универсальным вооружением.',
        'values': {'gun_range': 4, 'operational_radius': 600, 'max_speed': 70},
        'images': [
            {'file': 'bmp-3_1.jpg', 'url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/BMP-3_%28cropped%29.jpg/1280px-BMP-3_%28cropped%29.jpg'},
        ],
    },
    {
        'designation': 'БТР-82А',
        'title': 'БТР БТР-82А',
        'category': 'БТР',
        'iso': 'RU',
        'description': 'Колёсный бронетранспортёр.',
        'values': {'gun_range': 2, 'operational_radius': 500, 'max_speed': 80},
        'images': [
            {'file': 'btr-82a_1.jpg', 'url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/BTR-82A_%28cropped%29.jpg/1280px-BTR-82A_%28cropped%29.jpg'},
        ],
    },
    {
        'designation': '2С19 «Мста-С»',
        'title': 'САУ 2С19 «Мста-С»',
        'category': 'Артиллерия',
        'iso': 'RU',
        'description': '152-мм самоходная артиллерийская установка.',
        'values': {'gun_range': 29, 'operational_radius': 50, 'max_speed': 60},
        'images': [
            {'file': '2s19_1.jpg', 'url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/2S19_Msta-S.jpg/1280px-2S19_Msta-S.jpg'},
        ],
    },
    {
        'designation': '9K720 «Искандер»',
        'title': 'ОТРК 9K720 «Искандер»',
        'category': 'Ракетные комплексы',
        'iso': 'RU',
        'description': 'Оперативно-тактический ракетный комплекс.',
        'values': {'engagement_range': 500, 'operational_radius': 50},
        'images': [
            {'file': 'iskander_1.jpg', 'url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/9K720_Iskander_%28cropped%29.jpg/1280px-9K720_Iskander_%28cropped%29.jpg'},
        ],
    },
    {
        'designation': 'Тор-М2',
        'title': 'ЗРК «Тор-М2»',
        'category': 'ЗРК',
        'iso': 'RU',
        'description': 'Короткодействующий зенитный ракетный комплекс.',
        'values': {'engagement_range': 15, 'operational_radius': 25},
        'images': [
            {'file': 'tor-m2_1.jpg', 'url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Tor_M2E_%28cropped%29.jpg/1280px-Tor_M2E_%28cropped%29.jpg'},
        ],
    },
    {
        'designation': 'С-400',
        'title': 'ЗРС С-400 «Триумф»',
        'category': 'ЗРК',
        'iso': 'RU',
        'description': 'Дальнодействующая зенитная ракетная система.',
        'values': {'engagement_range': 250, 'operational_radius': 40},
        'images': [
            {'file': 's-400_1.jpg', 'url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/S-400_launcher.jpg/1280px-S-400_launcher.jpg'},
            {'file': 's-400_2.jpg', 'url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1f/S-400_Triumf_%28cropped%29.jpg/1280px-S-400_Triumf_%28cropped%29.jpg'},
        ],
    },
    {
        'designation': 'F-35A',
        'title': 'Истребитель F-35A Lightning II',
        'category': 'Истребители',
        'iso': 'US',
        'description': 'Многофункциональный истребитель-bomber 5 поколения ВВС США и NATO.',
        'values': {'practical_range': 2200, 'ferry_range': 2800, 'combat_radius': 1100, 'max_speed': 1960},
        'images': [
            {'file': 'f-35a_1.jpg', 'url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/61/F-35A_flight_%28cropped%29.jpg/1280px-F-35A_flight_%28cropped%29.jpg'},
            {'file': 'f-35a_2.jpg', 'url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7f/F-35A_Lightning_II_%28cropped%29.jpg/1280px-F-35A_Lightning_II_%28cropped%29.jpg'},
        ],
    },
    {
        'designation': 'F-16C',
        'title': 'Истребитель F-16C Fighting Falcon',
        'category': 'Истребители',
        'iso': 'US',
        'description': 'Многофункциональный истребитель NATO.',
        'values': {'practical_range': 2200, 'ferry_range': 4200, 'combat_radius': 550, 'max_speed': 2120},
        'images': [
            {'file': 'f-16c_1.jpg', 'url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0f/F-16C_Fighting_Falcon_%28cropped%29.jpg/1280px-F-16C_Fighting_Falcon_%28cropped%29.jpg'},
        ],
    },
    {
        'designation': 'F-22A',
        'title': 'Истребитель F-22A Raptor',
        'category': 'Истребители',
        'iso': 'US',
        'description': 'Истребитель превосходства в воздухе ВВС США.',
        'values': {'practical_range': 760, 'ferry_range': 3200, 'combat_radius': 850, 'max_speed': 2410},
        'images': [
            {'file': 'f-22a_1.jpg', 'url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/F-22_Raptor_%28cropped%29.jpg/1280px-F-22_Raptor_%28cropped%29.jpg'},
        ],
    },
    {
        'designation': 'B-52H',
        'title': 'Бомбардировщик B-52H Stratofortress',
        'category': 'Бомбардировщики',
        'iso': 'US',
        'description': 'Стратегический бомбардировщик ВВС США.',
        'values': {'practical_range': 14160, 'ferry_range': 16000, 'combat_radius': 7300, 'max_speed': 1000},
        'images': [
            {'file': 'b-52h_1.jpg', 'url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/B-52_Stratofortress_%28cropped%29.jpg/1280px-B-52_Stratofortress_%28cropped%29.jpg'},
        ],
    },
    {
        'designation': 'A-10C',
        'title': 'Штурмовик A-10C Thunderbolt II',
        'category': 'Штурмовая авиация',
        'iso': 'US',
        'description': 'Штурмовик для непосредственной поддержки сухопутных войск.',
        'values': {'combat_radius': 460, 'max_speed': 706},
        'images': [
            {'file': 'a-10c_1.jpg', 'url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/A-10_Thunderbolt_II_%28cropped%29.jpg/1280px-A-10_Thunderbolt_II_%28cropped%29.jpg'},
        ],
    },
    {
        'designation': 'M1A2 Abrams',
        'title': 'ОБТ M1A2 Abrams',
        'category': 'Танки',
        'iso': 'US',
        'description': 'Основной боевой танк армии США.',
        'values': {'gun_range': 4, 'operational_radius': 425, 'max_speed': 67},
        'images': [
            {'file': 'm1a2_1.jpg', 'url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/M1A2_Abrams_%28cropped%29.jpg/1280px-M1A2_Abrams_%28cropped%29.jpg'},
            {'file': 'm1a2_2.jpg', 'url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/M1_Abrams_tank.jpg/1280px-M1_Abrams_tank.jpg'},
        ],
    },
    {
        'designation': 'Leopard 2A7',
        'title': 'ОБТ Leopard 2A7',
        'category': 'Танки',
        'iso': 'DE',
        'description': 'Основной боевой танк Bundeswehr и ряда стран NATO.',
        'values': {'gun_range': 4, 'operational_radius': 450, 'max_speed': 68},
        'images': [
            {'file': 'leopard-2a7_1.jpg', 'url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Leopard_2A7%2B_%28cropped%29.jpg/1280px-Leopard_2A7%2B_%28cropped%29.jpg'},
        ],
    },
    {
        'designation': 'Challenger 2',
        'title': 'ОБТ Challenger 2',
        'category': 'Танки',
        'iso': 'GB',
        'description': 'Основной боевой танк British Army.',
        'values': {'gun_range': 4, 'operational_radius': 450, 'max_speed': 59},
        'images': [
            {'file': 'challenger-2_1.jpg', 'url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Challenger_2_%28cropped%29.jpg/1280px-Challenger_2_%28cropped%29.jpg'},
        ],
    },
    {
        'designation': 'Leclerc',
        'title': 'ОБТ Leclerc',
        'category': 'Танки',
        'iso': 'FR',
        'description': 'Основной боевой танк Armée de Terre.',
        'values': {'gun_range': 4, 'operational_radius': 450, 'max_speed': 71},
        'images': [
            {'file': 'leclerc_1.jpg', 'url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Leclerc-IMG_1744_%28cropped%29.jpg/1280px-Leclerc-IMG_1744_%28cropped%29.jpg'},
        ],
    },
    {
        'designation': 'M2 Bradley',
        'title': 'БМП M2 Bradley',
        'category': 'БМП',
        'iso': 'US',
        'description': 'Боевая машина пехоты армии США.',
        'values': {'gun_range': 3, 'operational_radius': 400, 'max_speed': 66},
        'images': [
            {'file': 'm2-bradley_1.jpg', 'url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/M2_Bradley_%28cropped%29.jpg/1280px-M2_Bradley_%28cropped%29.jpg'},
        ],
    },
    {
        'designation': 'M109A7',
        'title': 'САУ M109A7 Paladin',
        'category': 'Артиллерия',
        'iso': 'US',
        'description': '155-мм самоходная артиллерийская установка.',
        'values': {'gun_range': 30, 'operational_radius': 50, 'max_speed': 56},
        'images': [
            {'file': 'm109a7_1.jpg', 'url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/M109A6_Paladin_%28cropped%29.jpg/1280px-M109A6_Paladin_%28cropped%29.jpg'},
        ],
    },
    {
        'designation': 'M142 HIMARS',
        'title': 'РСЗО M142 HIMARS',
        'category': 'Ракетные комплексы',
        'iso': 'US',
        'description': 'Реактивная система залпового огня на колёсном шасси.',
        'values': {'engagement_range': 300, 'operational_radius': 50},
        'images': [
            {'file': 'himars_1.jpg', 'url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/M142_HIMARS_%28cropped%29.jpg/1280px-M142_HIMARS_%28cropped%29.jpg'},
            {'file': 'himars_2.jpg', 'url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/HIMARS_%28cropped%29.jpg/1280px-HIMARS_%28cropped%29.jpg'},
        ],
    },
    {
        'designation': 'MIM-104 Patriot',
        'title': 'ЗРК MIM-104 Patriot',
        'category': 'ЗРК',
        'iso': 'US',
        'description': 'Зенитный ракетный комплекс Patriot PAC-3.',
        'values': {'engagement_range': 160, 'operational_radius': 30},
        'images': [
            {'file': 'patriot_1.jpg', 'url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Patriot_missile_launcher_%28cropped%29.jpg/1280px-Patriot_missile_launcher_%28cropped%29.jpg'},
        ],
    },
    {
        'designation': 'NASAMS',
        'title': 'ЗРК NASAMS',
        'category': 'ЗРК',
        'iso': 'NO',
        'description': 'Norwegian Advanced Surface-to-Air Missile System (NATO).',
        'values': {'engagement_range': 25, 'operational_radius': 20},
        'images': [
            {'file': 'nasams_1.jpg', 'url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/NASAMS_%28cropped%29.jpg/1280px-NASAMS_%28cropped%29.jpg'},
        ],
    },
    {
        'designation': 'Rafale',
        'title': 'Истребитель Dassault Rafale',
        'category': 'Истребители',
        'iso': 'FR',
        'description': 'Многофункциональный истребитель ВВС Франции.',
        'values': {'practical_range': 3700, 'ferry_range': 3700, 'combat_radius': 1850, 'max_speed': 1912},
        'images': [
            {'file': 'rafale_1.jpg', 'url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Dassault_Rafale_%28cropped%29.jpg/1280px-Dassault_Rafale_%28cropped%29.jpg'},
            {'file': 'rafale_2.jpg', 'url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Rafale_M_%28cropped%29.jpg/1280px-Rafale_M_%28cropped%29.jpg'},
        ],
    },
    {
        'designation': 'Eurofighter Typhoon',
        'title': 'Истребитель Eurofighter Typhoon',
        'category': 'Истребители',
        'iso': 'DE',
        'description': 'Многофункциональный истребитель стран NATO (EF2000).',
        'values': {'practical_range': 2900, 'ferry_range': 3800, 'combat_radius': 1389, 'max_speed': 2495},
        'images': [
            {'file': 'typhoon_1.jpg', 'url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Eurofighter_Typhoon_%28cropped%29.jpg/1280px-Eurofighter_Typhoon_%28cropped%29.jpg'},
        ],
    },
    {
        'designation': 'PzH 2000',
        'title': 'САУ PzH 2000',
        'category': 'Артиллерия',
        'iso': 'DE',
        'description': '155-мм самоходная артиллерийская установка Bundeswehr.',
        'values': {'gun_range': 40, 'operational_radius': 50, 'max_speed': 60},
        'images': [
            {'file': 'pzh2000_1.jpg', 'url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/PzH_2000_%28cropped%29.jpg/1280px-PzH_2000_%28cropped%29.jpg'},
        ],
    },
    {
        'designation': 'IRIS-T SLM',
        'title': 'ЗРК IRIS-T SLM',
        'category': 'ЗРК',
        'iso': 'DE',
        'description': 'Средней дальности ЗРК (используется странами NATO и EU).',
        'values': {'engagement_range': 40, 'operational_radius': 25},
        'images': [
            {'file': 'iris-t_1.jpg', 'url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/IRIS-T_SLM_%28cropped%29.jpg/1280px-IRIS-T_SLM_%28cropped%29.jpg'},
        ],
    },
    # —— ВМФ ——
    {
        'designation': '«Адмирал Кузнецов»',
        'title': 'Авианосец «Адмирал Кузнецов»',
        'category': 'Авианосцы',
        'iso': 'RU',
        'description': 'Тяжёлый авианосец ВМФ РФ, проект 1143.5.',
        'values': {'combat_radius': 1500, 'ferry_range': 14000, 'operational_radius': 2000, 'max_speed': 54},
        'images': [
            {'file': 'kuznetsov_1.jpg', 'url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Admiral_Kuznetsov_%28cropped%29.jpg/1280px-Admiral_Kuznetsov_%28cropped%29.jpg'},
        ],
    },
    {
        'designation': 'Gerald R. Ford',
        'title': 'Авианосец CVN-78 Gerald R. Ford',
        'category': 'Авианосцы',
        'iso': 'US',
        'description': 'Атомный авианосец ВМС США, класс Gerald R. Ford.',
        'values': {'combat_radius': 1100, 'ferry_range': 20000, 'operational_radius': 2500, 'max_speed': 56},
        'images': [
            {'file': 'ford-cvn78_1.jpg', 'url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/USS_Gerald_R._Ford_%28CVN-78%29_%28cropped%29.jpg/1280px-USS_Gerald_R._Ford_%28CVN-78%29_%28cropped%29.jpg'},
        ],
    },
    {
        'designation': 'HMS Queen Elizabeth',
        'title': 'Авианосец HMS Queen Elizabeth',
        'category': 'Авианосцы',
        'iso': 'GB',
        'description': 'Ударный авианосец Королевского флота Великобритании.',
        'values': {'combat_radius': 1300, 'ferry_range': 10000, 'operational_radius': 1800, 'max_speed': 50},
        'images': [
            {'file': 'queen-elizabeth_1.jpg', 'url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/HMS_Queen_Elizabeth_%28R08%29_%28cropped%29.jpg/1280px-HMS_Queen_Elizabeth_%28R08%29_%28cropped%29.jpg'},
        ],
    },
    {
        'designation': '«Адмирал Горшков»',
        'title': 'Фрегат «Адмирал Горшков»',
        'category': 'Фрегаты',
        'iso': 'RU',
        'description': 'Многоцелевой фрегат проекта 22350 ВМФ РФ.',
        'values': {'engagement_range': 400, 'gun_range': 30, 'operational_radius': 800, 'ferry_range': 9000, 'max_speed': 56},
        'images': [
            {'file': 'gorshkov_1.jpg', 'url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Admiral_Gorshkov_%28cropped%29.jpg/1280px-Admiral_Gorshkov_%28cropped%29.jpg'},
        ],
    },
    {
        'designation': '«Адмирал Григорович»',
        'title': 'Фрегат «Адмирал Григорович»',
        'category': 'Фрегаты',
        'iso': 'RU',
        'description': 'Сторожевой фрегат проекта 11356.',
        'values': {'engagement_range': 300, 'gun_range': 25, 'operational_radius': 600, 'ferry_range': 7000, 'max_speed': 56},
        'images': [
            {'file': 'grigorovich_1.jpg', 'url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Admiral_Grigorovich_%28cropped%29.jpg/1280px-Admiral_Grigorovich_%28cropped%29.jpg'},
        ],
    },
    {
        'designation': 'FREMM',
        'title': 'Фрегат FREMM (Aquitaine)',
        'category': 'Фрегаты',
        'iso': 'FR',
        'description': 'Многоцелевой фрегат класса FREMM (Франция / EU).',
        'values': {'engagement_range': 350, 'gun_range': 40, 'operational_radius': 900, 'ferry_range': 11000, 'max_speed': 52},
        'images': [
            {'file': 'fremm_1.jpg', 'url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/FREMM_Aquitaine_%28cropped%29.jpg/1280px-FREMM_Aquitaine_%28cropped%29.jpg'},
        ],
    },
    {
        'designation': '«Маршал Шапошников»',
        'title': 'Эсминец «Маршал Шапошников»',
        'category': 'Эсминцы',
        'iso': 'RU',
        'description': 'Большой противолодочный корабль проекта 1155 (модернизированный).',
        'values': {'engagement_range': 500, 'gun_range': 30, 'operational_radius': 700, 'ferry_range': 8000, 'max_speed': 59},
        'images': [
            {'file': 'shaposhnikov_1.jpg', 'url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Marshal_Shaposhnikov_%28cropped%29.jpg/1280px-Marshal_Shaposhnikov_%28cropped%29.jpg'},
        ],
    },
    {
        'designation': 'Arleigh Burke',
        'title': 'Эсминец Arleigh Burke (DDG-51)',
        'category': 'Эсминцы',
        'iso': 'US',
        'description': 'Универсальный ракетный эсминец ВМС США.',
        'values': {'engagement_range': 400, 'gun_range': 24, 'operational_radius': 800, 'ferry_range': 9000, 'max_speed': 56},
        'images': [
            {'file': 'arleigh-burke_1.jpg', 'url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/USS_Arleigh_Burke_%28DDG-51%29_%28cropped%29.jpg/1280px-USS_Arleigh_Burke_%28DDG-51%29_%28cropped%29.jpg'},
        ],
    },
    {
        'designation': 'Type 45 Daring',
        'title': 'Эсминец Type 45 Daring',
        'category': 'Эсминцы',
        'iso': 'GB',
        'description': 'Противовоздушный эсминец Королевского флота.',
        'values': {'engagement_range': 120, 'gun_range': 25, 'operational_radius': 700, 'ferry_range': 7000, 'max_speed': 54},
        'images': [
            {'file': 'type45_1.jpg', 'url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/HMS_Daring_%28D32%29_%28cropped%29.jpg/1280px-HMS_Daring_%28D32%29_%28cropped%29.jpg'},
        ],
    },
    {
        'designation': '«Стерегущий»',
        'title': 'Корвет «Стерегущий»',
        'category': 'Корветы',
        'iso': 'RU',
        'description': 'Корвет проекта 20380 ВМФ РФ.',
        'values': {'engagement_range': 250, 'gun_range': 20, 'operational_radius': 400, 'ferry_range': 4000, 'max_speed': 50},
        'images': [
            {'file': 'steregushchy_1.jpg', 'url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Steregushchy-class_corvette_%28cropped%29.jpg/1280px-Steregushchy-class_corvette_%28cropped%29.jpg'},
        ],
    },
    {
        'designation': 'Visby',
        'title': 'Корвет Visby (K31)',
        'category': 'Корветы',
        'iso': 'SE',
        'description': 'Стелс-корвет класса Visby, ВМС Швеции.',
        'values': {'engagement_range': 80, 'gun_range': 15, 'operational_radius': 300, 'ferry_range': 3000, 'max_speed': 65},
        'images': [
            {'file': 'visby_1.jpg', 'url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/HMS_Visby_%28K31%29_%28cropped%29.jpg/1280px-HMS_Visby_%28K31%29_%28cropped%29.jpg'},
        ],
    },
    {
        'designation': '«Буян-М»',
        'title': 'МРК «Буян-М»',
        'category': 'МРК',
        'iso': 'RU',
        'description': 'Малый ракетный корабль проекта 21631.',
        'values': {'engagement_range': 2500, 'operational_radius': 500, 'ferry_range': 2500, 'max_speed': 50},
        'images': [
            {'file': 'buyan-m_1.jpg', 'url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Buyan-M-class_corvette_%28cropped%29.jpg/1280px-Buyan-M-class_corvette_%28cropped%29.jpg'},
        ],
    },
    {
        'designation': '«Борей»',
        'title': 'АПЛ «Борей» (955А)',
        'category': 'Подлодки',
        'iso': 'RU',
        'description': 'Стратегическая атомная подводная лодка проекта 955А.',
        'values': {'engagement_range': 8000, 'operational_radius': 2000, 'max_speed': 54},
        'images': [
            {'file': 'borei_1.jpg', 'url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Yury_Dolgorukiy_%28Borei-class%29_%28cropped%29.jpg/1280px-Yury_Dolgorukiy_%28Borei-class%29_%28cropped%29.jpg'},
        ],
    },
    {
        'designation': '«Ясень-М»',
        'title': 'АПЛ «Ясень-М» (885М)',
        'category': 'Подлодки',
        'iso': 'RU',
        'description': 'Многоцелевая атомная подводная лодка проекта 885М.',
        'values': {'engagement_range': 2500, 'operational_radius': 1500, 'max_speed': 59},
        'images': [
            {'file': 'yasen-m_1.jpg', 'url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Severodvinsk_%28Yasen-class%29_%28cropped%29.jpg/1280px-Severodvinsk_%28Yasen-class%29_%28cropped%29.jpg'},
        ],
    },
    {
        'designation': 'Virginia',
        'title': 'АПЛ Virginia (SSN-774)',
        'category': 'Подлодки',
        'iso': 'US',
        'description': 'Многоцелевая атомная подводная лодка ВМС США.',
        'values': {'engagement_range': 2500, 'operational_radius': 2000, 'max_speed': 46},
        'images': [
            {'file': 'virginia_1.jpg', 'url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/USS_Virginia_%28SSN-774%29_%28cropped%29.jpg/1280px-USS_Virginia_%28SSN-774%29_%28cropped%29.jpg'},
        ],
    },
    {
        'designation': 'Type 212A',
        'title': 'Подлодка Type 212A',
        'category': 'Подлодки',
        'iso': 'DE',
        'description': 'Дизель-электрическая подводная лодка Bundesmarine (EU/NATO).',
        'values': {'engagement_range': 1500, 'operational_radius': 1200, 'max_speed': 40},
        'images': [
            {'file': 'type212a_1.jpg', 'url': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/U-31_%28Type_212A%29_%28cropped%29.jpg/1280px-U-31_%28Type_212A%29_%28cropped%29.jpg'},
        ],
    },
]
