from django.shortcuts import redirect
from django.urls import re_path

# Модели техники ранее были в app formular; сохраняем старые закладки и ссылки.
_EQUIPMENT_MODEL_PATHS = (
    'equipmentcategory',
    'unitofmeasure',
    'equipmentparameterdefinition',
    'equipment',
)


def _redirect_formular_equipment_admin(request, model_path, rest=''):
    query = request.META.get('QUERY_STRING', '')
    target = f'/admin/equipment/{model_path}/{rest}'
    if query:
        target = f'{target}?{query}'
    return redirect(target, permanent=True)


def _redirect_target_equipment_admin(request, rest=''):
    """TargetEquipment удалён — техника задаётся на странице объекта (Target)."""
    query = request.META.get('QUERY_STRING', '')
    target = '/admin/formular/target/'
    if query:
        target = f'{target}?{query}'
    return redirect(target, permanent=True)


def equipment_admin_redirect_urlpatterns():
    patterns = [
        re_path(
            r'^admin/equipment/targetequipment/$',
            _redirect_target_equipment_admin,
            name='redirect_equipment_targetequipment',
        ),
        re_path(
            r'^admin/equipment/targetequipment/(?P<rest>.+)$',
            lambda request, rest: _redirect_target_equipment_admin(request, rest),
            name='redirect_equipment_targetequipment_detail',
        ),
        re_path(
            r'^admin/formular/targetequipment/$',
            _redirect_target_equipment_admin,
            name='redirect_formular_targetequipment',
        ),
        re_path(
            r'^admin/formular/targetequipment/(?P<rest>.+)$',
            lambda request, rest: _redirect_target_equipment_admin(request, rest),
            name='redirect_formular_targetequipment_detail',
        ),
    ]
    for model_path in _EQUIPMENT_MODEL_PATHS:
        patterns.append(
            re_path(
                rf'^admin/formular/{model_path}/$',
                lambda request, mp=model_path: _redirect_formular_equipment_admin(
                    request, mp,
                ),
                name=f'redirect_formular_{model_path}',
            )
        )
        patterns.append(
            re_path(
                rf'^admin/formular/{model_path}/(?P<rest>.+)$',
                lambda request, rest, mp=model_path: _redirect_formular_equipment_admin(
                    request, mp, rest,
                ),
                name=f'redirect_formular_{model_path}_detail',
            )
        )
    return patterns
