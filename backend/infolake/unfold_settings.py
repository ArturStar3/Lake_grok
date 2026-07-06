from django.templatetags.static import static
from django.urls import reverse_lazy
from django.utils.translation import gettext_lazy as _


def _environment_callback(request):
    return ['Оффлайн', 'success']


def _site_url_callback(request):
    from django.conf import settings

    return settings.FRONTEND_URL.rstrip('/')


UNFOLD = {
    'SITE_TITLE': 'InfoLake',
    'SITE_HEADER': _('Администрирование электронной разведывательной сводки'),
    'SITE_SUBHEADER': _('Справочники, объекты, техника'),
    'SITE_SYMBOL': 'radar',
    'SHOW_HISTORY': True,
    'SHOW_VIEW_ON_SITE': False,
    'SITE_URL': _site_url_callback,
    'ENVIRONMENT': 'infolake.unfold_settings._environment_callback',
    # Только локальные ресурсы — без Google Fonts и CDN (оффлайн-развёртывание).
    'STYLES': [
        lambda request: static('admin/css/markdown_admin.css'),
    ],
    'SCRIPTS': [
        lambda request: static('admin/js/markdown_admin.js'),
    ],
    'BORDER_RADIUS': '6px',
    'SIDEBAR': {
        'show_search': True,
        'show_all_applications': True,
        'navigation': [
            {
                'title': _('Карта и объекты'),
                'separator': True,
                'items': [
                    {
                        'title': _('Объекты разведки'),
                        'icon': 'location_on',
                        'link': reverse_lazy('admin:formular_target_changelist'),
                    },
                    {
                        'title': _('События'),
                        'icon': 'event',
                        'link': reverse_lazy('admin:formular_event_changelist'),
                    },
                    {
                        'title': _('Типы действий'),
                        'icon': 'adjust',
                        'link': reverse_lazy('admin:formular_actiontype_changelist'),
                    },
                    {
                        'title': _('Маркеры'),
                        'icon': 'flag',
                        'link': reverse_lazy('admin:formular_marker_changelist'),
                    },
                ],
            },
            {
                'title': _('Персоналии'),
                'separator': True,
                'items': [
                    {
                        'title': _('Список лиц'),
                        'icon': 'person',
                        'link': reverse_lazy('admin:formular_person_changelist'),
                    },
                    {
                        'title': _('Разделы персоналий'),
                        'icon': 'folder_open',
                        'link': reverse_lazy('admin:formular_personsections_changelist'),
                    },
                    {
                        'title': _('Характеры связей'),
                        'icon': 'link',
                        'link': reverse_lazy('admin:formular_relationtype_changelist'),
                    },
                    {
                        'title': _('Фото лиц'),
                        'icon': 'photo_camera',
                        'link': reverse_lazy('admin:formular_personphoto_changelist'),
                    },
                    {
                        'title': _('Изображения персоналий'),
                        'icon': 'image',
                        'link': reverse_lazy('admin:formular_personattachment_changelist'),
                    },
                    {
                        'title': _('Связи между лицами'),
                        'icon': 'group',
                        'link': reverse_lazy('admin:formular_personrelation_changelist'),
                    },
                ],
            },
            {
                'title': _('Техника'),
                'separator': True,
                'items': [
                    {
                        'title': _('Каталог техники'),
                        'icon': 'flight',
                        'link': reverse_lazy('admin:equipment_equipment_changelist'),
                    },
                    {
                        'title': _('Параметры ТТХ'),
                        'icon': 'tune',
                        'link': reverse_lazy(
                            'admin:equipment_equipmentparameterdefinition_changelist',
                        ),
                    },
                    {
                        'title': _('Категории техники'),
                        'icon': 'category',
                        'link': reverse_lazy('admin:equipment_equipmentcategory_changelist'),
                    },
                    {
                        'title': _('Единицы измерения'),
                        'icon': 'straighten',
                        'link': reverse_lazy('admin:equipment_unitofmeasure_changelist'),
                    },
                ],
            },
            {
                'title': _('Справочники'),
                'separator': True,
                'items': [
                    {
                        'title': _('Страны'),
                        'icon': 'public',
                        'link': reverse_lazy('admin:formular_country_changelist'),
                    },
                    {
                        'title': _('Типы объектов'),
                        'icon': 'hub',
                        'link': reverse_lazy('admin:formular_targettype_changelist'),
                    },
                    {
                        'title': _('Разделы формуляра'),
                        'icon': 'description',
                        'link': reverse_lazy('admin:formular_formularsections_changelist'),
                    },
                    {
                        'title': _('Разделы страны'),
                        'icon': 'map',
                        'link': reverse_lazy('admin:formular_countrysections_changelist'),
                    },
                    {
                        'title': _('Типы событий'),
                        'icon': 'event_note',
                        'link': reverse_lazy('admin:formular_eventtype_changelist'),
                    },
                    {
                        'title': _('Маркеры событий'),
                        'icon': 'place',
                        'link': reverse_lazy('admin:formular_eventmarker_changelist'),
                    },
                ],
            },
            {
                'title': _('Вложения'),
                'separator': True,
                'items': [
                    {
                        'title': _('Изображения формуляра'),
                        'icon': 'attach_file',
                        'link': reverse_lazy('admin:formular_formularattachment_changelist'),
                    },
                    {
                        'title': _('Изображения стран'),
                        'icon': 'collections',
                        'link': reverse_lazy('admin:formular_countryattachment_changelist'),
                    },
                ],
            },
        ],
    },
    'LOGIN': {
        'image': lambda request: static('admin/img/icon-addlink.svg'),
    },
}
