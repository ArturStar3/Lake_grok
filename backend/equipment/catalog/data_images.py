"""
Файлы изображений и названия на Wikimedia Commons.
Скачивание: python manage.py download_equipment_catalog_images
"""

EQUIPMENT_IMAGE_SOURCES = {
    'Су-35С': [
        {'file': 'su-35s_1.jpg', 'commons': 'Sukhoi Su-35S.jpg'},
        {'file': 'su-35s_2.jpg', 'commons': 'Su-35S at MAKS-2011.jpg'},
    ],
    'МиГ-31БМ': [
        {'file': 'mig-31_1.jpg', 'commons': 'Mikoyan-Gurevich MiG-31.jpg'},
    ],
    'Су-57': [
        {'file': 'su-57_1.jpg', 'commons': 'Sukhoi Su-57 at MAKS-2011 (cropped).jpg'},
        {'file': 'su-57_2.jpg', 'commons': 'T-50 (Su-57 prototype) at MAKS-2011.jpg'},
    ],
    'Ту-160': [
        {'file': 'tu-160_1.jpg', 'commons': 'Tupolev Tu-160 Belolobov.jpg'},
    ],
    'Су-34': [
        {'file': 'su-34_1.jpg', 'commons': 'Sukhoi Su-34.jpg'},
        {'file': 'su-34_2.jpg', 'commons': 'Su-34 01.jpg'},
    ],
    'Ка-52': [
        {'file': 'ka-52_1.jpg', 'commons': 'Kamov Ka-52.jpg'},
    ],
    'Ми-28Н': [
        {'file': 'mi-28_1.jpg', 'commons': 'Mil Mi-28N.jpg'},
    ],
    'Т-90М': [
        {'file': 't-90m_1.jpg', 'commons': 'T-90 tank.jpg'},
        {'file': 't-90m_2.jpg', 'commons': 'T-90A tank.jpg'},
    ],
    'Т-72Б3': [
        {'file': 't-72b3_1.jpg', 'commons': 'T-72B3 tank.jpg'},
    ],
    'БМП-3': [
        {'file': 'bmp-3_1.jpg', 'commons': 'BMP-3.jpg'},
    ],
    'БТР-82А': [
        {'file': 'btr-82a_1.jpg', 'commons': 'BTR-82A.jpg'},
    ],
    '2С19 «Мста-С»': [
        {'file': '2s19_1.jpg', 'commons': '2S19 Msta-S.jpg'},
    ],
    '9K720 «Искандер»': [
        {'file': 'iskander_1.jpg', 'commons': '9K720 Iskander-M TEL.jpg'},
    ],
    'Тор-М2': [
        {'file': 'tor-m2_1.jpg', 'commons': 'Tor-M2U.jpg'},
    ],
    'С-400': [
        {'file': 's-400_1.jpg', 'commons': 'S-400 launcher.jpg'},
        {'file': 's-400_2.jpg', 'commons': 'S-400 Triumph.jpg'},
    ],
    'F-35A': [
        {'file': 'f-35a_1.jpg', 'commons': 'F-35A flight (2010).jpg'},
        {'file': 'f-35a_2.jpg', 'commons': 'F-35 Lightning II.jpg'},
    ],
    'F-16C': [
        {'file': 'f-16c_1.jpg', 'commons': 'F-16 Fighting Falcon.jpg'},
    ],
    'F-22A': [
        {'file': 'f-22a_1.jpg', 'commons': 'F-22 Raptor.jpg'},
    ],
    'B-52H': [
        {'file': 'b-52h_1.jpg', 'commons': 'B-52 Stratofortress.jpg'},
    ],
    'A-10C': [
        {'file': 'a-10c_1.jpg', 'commons': 'Fairchild Republic A-10 Thunderbolt II.jpg'},
    ],
    'M1A2 Abrams': [
        {'file': 'm1a2_1.jpg', 'commons': 'M1 Abrams tank.jpg'},
        {'file': 'm1a2_2.jpg', 'commons': 'M1A2 Abrams.jpg'},
    ],
    'Leopard 2A7': [
        {'file': 'leopard-2a7_1.jpg', 'commons': 'Leopard 2 A7 main battle tank.jpg'},
    ],
    'Challenger 2': [
        {'file': 'challenger-2_1.jpg', 'commons': 'Challenger 2 tank.jpg'},
    ],
    'Leclerc': [
        {'file': 'leclerc_1.jpg', 'commons': 'Leclerc tank.jpg'},
    ],
    'M2 Bradley': [
        {'file': 'm2-bradley_1.jpg', 'commons': 'M2 Bradley IFV.jpg'},
    ],
    'M109A7': [
        {'file': 'm109a7_1.jpg', 'commons': 'M109 paladin.jpg'},
    ],
    'M142 HIMARS': [
        {'file': 'himars_1.jpg', 'commons': 'M142 HIMARS.jpg'},
        {'file': 'himars_2.jpg', 'commons': 'HIMARS.jpg'},
    ],
    'MIM-104 Patriot': [
        {'file': 'patriot_1.jpg', 'commons': 'Patriot missile system.jpg'},
    ],
    'NASAMS': [
        {'file': 'nasams_1.jpg', 'commons': 'NASAMS.jpg'},
    ],
    'Rafale': [
        {'file': 'rafale_1.jpg', 'commons': 'Dassault Rafale.jpg'},
        {'file': 'rafale_2.jpg', 'commons': 'Rafale M.jpg'},
    ],
    'Eurofighter Typhoon': [
        {'file': 'typhoon_1.jpg', 'commons': 'Eurofighter Typhoon.jpg'},
    ],
    'PzH 2000': [
        {'file': 'pzh2000_1.jpg', 'commons': 'PzH 2000.jpg'},
    ],
    'IRIS-T SLM': [
        {'file': 'iris-t_1.jpg', 'commons': 'IRIS-T SLM.jpg'},
    ],
    '«Адмирал Кузнецов»': [
        {'file': 'kuznetsov_1.jpg', 'commons': 'Admiral Kuznetsov aircraft carrier.jpg'},
    ],
    'Gerald R. Ford': [
        {'file': 'ford-cvn78_1.jpg', 'commons': 'USS Gerald R. Ford (CVN-78).jpg'},
    ],
    'HMS Queen Elizabeth': [
        {'file': 'queen-elizabeth_1.jpg', 'commons': 'HMS Queen Elizabeth (R08).jpg'},
    ],
    '«Адмирал Горшков»': [
        {'file': 'gorshkov_1.jpg', 'commons': 'Admiral Flota Sovetskogo Soyuza Gorshkov.jpg'},
    ],
    '«Адмирал Григорович»': [
        {'file': 'grigorovich_1.jpg', 'commons': 'Admiral Grigorovich (ship).jpg'},
    ],
    'FREMM': [
        {'file': 'fremm_1.jpg', 'commons': 'French frigate Aquitaine.jpg'},
    ],
    '«Маршал Шапошников»': [
        {'file': 'shaposhnikov_1.jpg', 'commons': 'Marshal Shaposhnikov (ship).jpg'},
    ],
    'Arleigh Burke': [
        {'file': 'arleigh-burke_1.jpg', 'commons': 'USS Arleigh Burke (DDG-51).jpg'},
    ],
    'Type 45 Daring': [
        {'file': 'type45_1.jpg', 'commons': 'HMS Daring (D32).jpg'},
    ],
    '«Стерегущий»': [
        {'file': 'steregushchy_1.jpg', 'commons': 'Steregushchy-class corvette.jpg'},
    ],
    'Visby': [
        {'file': 'visby_1.jpg', 'commons': 'HMS Visby (K31).jpg'},
    ],
    '«Буян-М»': [
        {'file': 'buyan-m_1.jpg', 'commons': 'Buyan-M-class corvette.jpg'},
    ],
    '«Борей»': [
        {'file': 'borei_1.jpg', 'commons': 'Yury Dolgorukiy (submarine).jpg'},
    ],
    '«Ясень-М»': [
        {'file': 'yasen-m_1.jpg', 'commons': 'Severodvinsk (submarine).jpg'},
    ],
    'Virginia': [
        {'file': 'virginia_1.jpg', 'commons': 'USS Virginia (SSN-774).jpg'},
    ],
    'Type 212A': [
        {'file': 'type212a_1.jpg', 'commons': 'German submarine U-31 (S184).jpg'},
    ],
}
