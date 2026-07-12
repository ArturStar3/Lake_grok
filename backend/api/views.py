from collections import defaultdict

from rest_framework import viewsets
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.decorators import action
from django.db import transaction
from django.db.models import Q, Count, Prefetch, F, OuterRef, Subquery
from django.utils import timezone
from formular.viewshed import compute_los_polygon

from accounts.permissions import (
    CountryScopedQuerysetMixin,
    EquipmentPermission,
    EventsPermission,
    OperationalSituationsPermission,
    FormularPermission,
    CountryDossierPermission,
    IsActiveAppUser,
    IsSuperUserOrReadOnlyReference,
    PersonsPermission,
    TargetsPermission,
)
from api.access import (
    ensure_can_delete,
    ensure_can_read,
    ensure_can_write,
    ensure_country_access,
    filter_by_user_countries,
)

from .serializers import (
    TargetSerializer,
    TargetListSerializer,
    TargetParentPickerSerializer,
    TargetCreateSerializer,
    CountryInfoSerializer,
    CountryInfoWriteSerializer,
    CountrySectionsSerializer,
    CountryAttachmentSerializer,
    FormularSerializer,
    FormularAttachmentSerializer,
    CountryListSerializer,
    MarkerListSerializer,
    EventMarkerListSerializer,
    FormularSectionsListSerializer,
    FormularBulkUpdateSerializer,
    ActionTypeListSerializer,
    TargetTypeSerializer,
    TargetTypeWriteSerializer,
    EventTypeSerializer,
    EventSerializer,
    EventWriteSerializer,
    OperationalSituationSerializer,
    OperationalSituationListSerializer,
    OperationalSituationRevisionSerializer,
    OperationalSituationRevisionWriteSerializer,
    OperationalSituationTimelineRevisionSerializer,
    TargetSubordinateSerializer,
    EquipmentCategorySerializer,
    EquipmentCategoryWriteSerializer,
    EquipmentParameterDefinitionSerializer,
    EquipmentParameterDefinitionWriteSerializer,
    UnitOfMeasureSerializer,
    EquipmentSerializer,
    EquipmentWriteSerializer,
    EquipmentImageSerializer,
    PersonSectionsListSerializer,
    PersonInfoSerializer,
    PersonBulkUpdateSerializer,
    PersonAttachmentSerializer,
    PersonPhotoSerializer,
    RelationTypeSerializer,
    PersonListSerializer,
    PersonSerializer,
    PersonCreateSerializer,
    PersonRelationSerializer,
    PersonRelationWriteSerializer,
)
from formular.models import (
    Target,
    Country,
    CountryInfo,
    CountrySections,
    CountryAttachment,
    Formular,
    Marker,
    EventMarker,
    FormularAttachment,
    FormularSections,
    ActionType,
    TargetAction,
    TargetEquipment,
    TargetType,
    EventType,
    Event,
    OperationalSituation,
    OperationalSituationRevision,
    PersonSections,
    RelationType,
    Person,
    PersonInfo,
    PersonAttachment,
    PersonPhoto,
    PersonRelation,
)
from equipment.models import (
    EquipmentCategory,
    EquipmentParameterDefinition,
    Equipment,
    EquipmentParameterValue,
    EquipmentImage,
    UnitOfMeasure,
)
from .target_utils import (
    replace_target_actions,
    replace_target_equipment,
    resolve_deployed_equipment_los_zone,
)
from .operational_situation_utils import (
    correct_current_revision,
    correct_revision,
    create_new_revision,
    create_operational_situation,
    delete_operational_situation_revision,
    fork_operational_situation,
)
from accounts.services.permissions import get_allowed_country_ids

def _equipment_links_prefetch(*, zone_values_only=True):
    pv_qs = EquipmentParameterValue.objects.select_related(
        'parameter',
        'parameter__action_type',
    )
    if zone_values_only:
        pv_qs = pv_qs.filter(
            parameter__action_type__isnull=False,
            value__gt=0,
        )
    else:
        pv_qs = pv_qs.select_related('parameter__unit')
    equipment_prefetch = [
        Prefetch(
            'equipment__parameter_values',
            queryset=pv_qs,
        ),
    ]
    if not zone_values_only:
        equipment_prefetch.append('equipment__images')
    return Prefetch(
        'equipment_links',
        queryset=TargetEquipment.objects.select_related(
            'equipment',
            'equipment__category',
            'equipment__category__parent',
            'equipment__category__parent__parent',
        ).prefetch_related(
            *equipment_prefetch
        ),
    )


def _target_zones_prefetch():
    """Prefetch actions и техники с зонами (общий для list и detail)."""
    return [
        Prefetch(
            'actions',
            queryset=TargetAction.objects.select_related('action_type'),
        ),
        _equipment_links_prefetch(zone_values_only=True),
    ]


def _target_list_queryset():
    """Список targets: без Count(children) и без type__countries."""
    return (
        Target.objects.select_related('country', 'marker', 'type')
        .prefetch_related(*_target_zones_prefetch())
        .order_by('title')
    )


def _target_detail_queryset():
    """Детали target: полный prefetch + children_count + все ТТХ техники."""
    return (
        Target.objects.select_related('country', 'marker', 'type')
        .prefetch_related(
            Prefetch(
                'actions',
                queryset=TargetAction.objects.select_related('action_type'),
            ),
            _equipment_links_prefetch(zone_values_only=False),
            'type__countries',
        )
        .annotate(children_count=Count('children'))
    )


class TargetViewSet(CountryScopedQuerysetMixin, viewsets.ModelViewSet):
    """Объект разведки"""

    permission_classes = [TargetsPermission]
    country_field = 'country_id'
    queryset = _target_list_queryset()

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return TargetCreateSerializer
        if self.action == 'list':
            return TargetListSerializer
        return TargetSerializer

    def get_queryset(self):
        if self.action == 'retrieve':
            qs = _target_detail_queryset()
        else:
            qs = _target_list_queryset()
        parent = self.request.query_params.get('parent')
        if parent:
            qs = qs.filter(parent_id=parent)
        return self.filter_by_allowed_countries(qs)

    def destroy(self, request, *args, **kwargs):
        ensure_can_delete(request.user)
        return super().destroy(request, *args, **kwargs)

    @action(detail=False, methods=['get'], url_path='parent-options')
    def parent_options(self, request):
        """Лёгкий список объектов для выбора родителя (без вложенных actions/country)."""
        qs = (
            Target.objects.select_related('type')
            .only('id', 'title', 'label', 'country_id', 'type_id')
            .order_by('title')
        )
        qs = filter_by_user_countries(qs, request.user, 'country_id')
        return Response(TargetParentPickerSerializer(qs, many=True).data)

    @action(detail=False, methods=['get'], url_path='formular-completion')
    def formular_completion(self, request):
        """Заполненность формуляра по объектам страны."""
        country_id = request.query_params.get('country')
        if country_id:
            ensure_country_access(request.user, country_id)
            ensure_can_read(request.user, 'targets', country_id)
            targets = Target.objects.filter(country_id=country_id)
        else:
            targets = filter_by_user_countries(Target.objects.all(), request.user, 'country_id')
        targets = targets.order_by('title')

        leaf_sections = (
            FormularSections.objects.filter(is_hidden=False)
            .exclude(
                id__in=FormularSections.objects.filter(parent__isnull=False).values('parent')
            )
            .order_by('order', 'title')
        )

        filled = (
            Formular.objects.filter(target__in=targets, section__in=leaf_sections)
            .exclude(content__isnull=True)
            .exclude(content__exact='')
            .values_list('target_id', 'section_id')
        )
        attached = (
            FormularAttachment.objects.filter(target__in=targets, section__in=leaf_sections)
            .values_list('target_id', 'section_id')
        )

        filled_pairs = set(filled) | set(attached)
        total = leaf_sections.count()
        leaf_list = list(leaf_sections)

        filled_by_target = defaultdict(set)
        for tgt_id, sec_id in filled_pairs:
            filled_by_target[tgt_id].add(sec_id)

        target_rows = targets.only('id', 'title', 'label')
        result_targets = []
        for t in target_rows:
            filled_ids = filled_by_target.get(t.id, set())
            percent = round(len(filled_ids) * 100 / total, 1) if total else 0
            result_targets.append({
                'id': t.id,
                'title': t.title,
                'label': t.label,
                'percent': percent,
                'sections': {str(sec.id): sec.id in filled_ids for sec in leaf_list},
            })

        return Response({
            'sections': [{'id': s.id, 'title': s.title} for s in leaf_list],
            'targets': result_targets,
        })

    @transaction.atomic
    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)

        actions_data = serializer.validated_data.pop('actions', None)
        deployed_data = serializer.validated_data.pop('deployed_equipment', None)

        self.perform_update(serializer)

        replace_target_actions(instance, actions_data)
        replace_target_equipment(instance, deployed_data)

        instance = _target_detail_queryset().get(pk=instance.pk)
        return Response(TargetSerializer(instance).data)

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        instance = _target_detail_queryset().get(pk=serializer.instance.pk)
        headers = self.get_success_headers(serializer.data)
        return Response(
            TargetSerializer(instance).data,
            status=status.HTTP_201_CREATED,
            headers=headers,
        )

    def _compute_los_zone_response(self, target, *, max_range_km, min_elevation_deg, antenna_height, persist_action=None):
        try:
            antenna_height = float(antenna_height)
        except (TypeError, ValueError):
            return Response(
                {'detail': 'Некорректная высота антенны'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            geometry = compute_los_polygon(
                target.lat,
                target.lng,
                antenna_height_m=antenna_height,
                max_range_km=float(max_range_km),
                min_elevation_deg=float(min_elevation_deg or 0.5),
            )
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:
            return Response(
                {'detail': f'Ошибка расчёта зоны: {exc}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        computed_at = timezone.now()
        if persist_action is not None:
            persist_action.zone_geometry = geometry
            persist_action.zone_geometry_computed_at = computed_at
            persist_action.save(update_fields=['zone_geometry', 'zone_geometry_computed_at'])

        if antenna_height != target.antenna_height_m:
            target.antenna_height_m = antenna_height
            target.save(update_fields=['antenna_height_m'])

        payload = {
            'zone_geometry': geometry,
            'zone_geometry_computed_at': computed_at,
        }
        if persist_action is not None:
            payload['action_id'] = persist_action.id
        return Response(payload)

    @action(
        detail=True,
        methods=['post'],
        url_path=r'actions/(?P<action_id>[^/.]+)/compute-los-zone',
    )
    def compute_los_zone(self, request, pk=None, action_id=None):
        """Рассчитать полигон зоны действия с учётом рельефа (GLO-90 DEM)."""
        target = self.get_object()
        try:
            action = target.actions.select_related('action_type').get(pk=action_id)
        except TargetAction.DoesNotExist:
            return Response(
                {'detail': 'Действие не найдено'},
                status=status.HTTP_404_NOT_FOUND,
            )

        action_type = action.action_type
        if not action_type:
            return Response(
                {'detail': 'Тип действия не указан'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not action.radius or action.radius <= 0:
            return Response(
                {'detail': 'Укажите радиус действия (км)'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        antenna_height = request.data.get('antenna_height_m', target.antenna_height_m)
        return self._compute_los_zone_response(
            target,
            max_range_km=action.radius,
            min_elevation_deg=action_type.min_elevation_deg,
            antenna_height=antenna_height,
            persist_action=action,
        )

    @action(
        detail=True,
        methods=['post'],
        url_path=(
            r'deployed-equipment/(?P<equipment_id>[^/.]+)/parameters/'
            r'(?P<parameter_id>[^/.]+)/compute-los-zone'
        ),
    )
    def compute_equipment_los_zone(self, request, pk=None, equipment_id=None, parameter_id=None):
        """Рассчитать полигон зоны техники (ТТХ) с учётом рельефа."""
        target = self.get_object()
        try:
            zone_params = resolve_deployed_equipment_los_zone(target, equipment_id, parameter_id)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        antenna_height = request.data.get('antenna_height_m', target.antenna_height_m)
        return self._compute_los_zone_response(
            target,
            max_range_km=zone_params['radius_km'],
            min_elevation_deg=zone_params['min_elevation_deg'],
            antenna_height=antenna_height,
        )


class UnitOfMeasureViewSet(viewsets.ModelViewSet):
    """Единицы измерения ТТХ"""

    serializer_class = UnitOfMeasureSerializer
    permission_classes = [IsSuperUserOrReadOnlyReference]
    queryset = UnitOfMeasure.objects.all().order_by('title')

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if EquipmentParameterDefinition.objects.filter(unit=instance).exists():
            return Response(
                {'detail': 'Единица используется в параметрах ТТХ'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)


class EquipmentCategoryViewSet(viewsets.ModelViewSet):
    """Категории техники"""

    permission_classes = [IsSuperUserOrReadOnlyReference]
    queryset = EquipmentCategory.objects.select_related('parent').order_by('order', 'title')

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return EquipmentCategoryWriteSerializer
        return EquipmentCategorySerializer

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.children.exists():
            return Response(
                {'detail': 'У категории есть подкатегории'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if instance.equipment.exists():
            return Response(
                {'detail': 'В категории есть образцы техники'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        instance = self.queryset.get(pk=serializer.instance.pk)
        return Response(
            EquipmentCategorySerializer(instance).data,
            status=status.HTTP_201_CREATED,
        )

    @transaction.atomic
    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        instance = self.queryset.get(pk=instance.pk)
        return Response(EquipmentCategorySerializer(instance).data)


class EquipmentParameterDefinitionViewSet(viewsets.ModelViewSet):
    """Определения параметров ТТХ"""

    permission_classes = [IsSuperUserOrReadOnlyReference]
    queryset = (
        EquipmentParameterDefinition.objects
        .select_related('unit', 'action_type')
        .prefetch_related('categories')
        .order_by('title')
    )

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return EquipmentParameterDefinitionWriteSerializer
        return EquipmentParameterDefinitionSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        maps_to_zone = self.request.query_params.get('maps_to_zone')
        if maps_to_zone and maps_to_zone.lower() in ('1', 'true', 'yes'):
            qs = qs.filter(action_type__isnull=False)
        category_id = self.request.query_params.get('category')
        if category_id:
            qs = qs.filter(categories__id=category_id)
        return qs.distinct()

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if EquipmentParameterValue.objects.filter(parameter=instance).exists():
            return Response(
                {'detail': 'Параметр используется в значениях ТТХ образцов'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)

    def _parameter_detail_queryset(self):
        return self.queryset

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        instance = self._parameter_detail_queryset().get(pk=serializer.instance.pk)
        return Response(
            EquipmentParameterDefinitionSerializer(instance).data,
            status=status.HTTP_201_CREATED,
        )

    @transaction.atomic
    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        instance = self._parameter_detail_queryset().get(pk=instance.pk)
        return Response(EquipmentParameterDefinitionSerializer(instance).data)


class EquipmentViewSet(viewsets.ModelViewSet):
    """Каталог образцов техники"""

    permission_classes = [EquipmentPermission]
    queryset = (
        Equipment.objects
        .select_related('category', 'origin_country')
        .prefetch_related(
            Prefetch(
                'parameter_values',
                queryset=EquipmentParameterValue.objects.select_related(
                    'parameter',
                    'parameter__unit',
                    'parameter__action_type',
                ),
            ),
            'images',
        )
        .order_by('title')
    )

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return EquipmentWriteSerializer
        return EquipmentSerializer

    def _equipment_detail_queryset(self):
        return self.queryset

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        instance = self._equipment_detail_queryset().get(pk=serializer.instance.pk)
        return Response(
            EquipmentSerializer(instance).data,
            status=status.HTTP_201_CREATED,
        )

    @transaction.atomic
    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        instance = self._equipment_detail_queryset().get(pk=instance.pk)
        return Response(EquipmentSerializer(instance).data)


class EquipmentImageViewSet(viewsets.ModelViewSet):
    """Изображения образцов техники"""

    serializer_class = EquipmentImageSerializer
    permission_classes = [EquipmentPermission]
    queryset = EquipmentImage.objects.select_related('equipment').order_by('order', 'created_at')

    def get_queryset(self):
        qs = super().get_queryset()
        equipment_id = self.request.query_params.get('equipment')
        if self.action == 'list' and not equipment_id:
            return qs.none()
        if equipment_id:
            qs = qs.filter(equipment_id=equipment_id)
        return qs


class CountryViewSet(CountryScopedQuerysetMixin, viewsets.ModelViewSet):
    """Список стран с полным CRUD"""

    serializer_class = CountryListSerializer
    permission_classes = [CountryDossierPermission]
    country_field = 'id'
    queryset = Country.objects.all().order_by('title')

class MarkerViewSet(viewsets.ReadOnlyModelViewSet):
    """Список маркеров"""

    serializer_class = MarkerListSerializer
    permission_classes = [IsActiveAppUser]
    queryset = Marker.objects.all().order_by('order', 'title')

class EventMarkerViewSet(viewsets.ReadOnlyModelViewSet):
    """Список маркеров событий"""

    serializer_class = EventMarkerListSerializer
    permission_classes = [IsActiveAppUser]
    queryset = EventMarker.objects.all().order_by('title')

class ActionTypeViewSet(viewsets.ModelViewSet):
    """CRUD типов зон действия"""

    serializer_class = ActionTypeListSerializer
    permission_classes = [IsSuperUserOrReadOnlyReference]
    queryset = ActionType.objects.all().order_by('title')

class TargetTypeViewSet(viewsets.ModelViewSet):
    """CRUD типов объектов разведки"""

    permission_classes = [IsSuperUserOrReadOnlyReference]
    queryset = (
        TargetType.objects
        .select_related('parent')
        .prefetch_related('countries')
        .order_by('order', 'title')
    )

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return TargetTypeWriteSerializer
        return TargetTypeSerializer

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.children.exists():
            return Response(
                {'detail': 'У типа есть подтипы'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if instance.target_types.exists():
            return Response(
                {'detail': 'Тип используется объектами разведки'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        instance = self.queryset.get(pk=serializer.instance.pk)
        return Response(
            TargetTypeSerializer(instance).data,
            status=status.HTTP_201_CREATED,
        )

    @transaction.atomic
    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        instance = self.queryset.get(pk=instance.pk)
        return Response(TargetTypeSerializer(instance).data)


class EventTypeViewSet(viewsets.ModelViewSet):
    """CRUD типов событий"""

    serializer_class = EventTypeSerializer
    permission_classes = [IsSuperUserOrReadOnlyReference]
    queryset = EventType.objects.all().order_by('title')

class CountryInfoView(APIView):
    """Возвращает информацию по стране с её разделами"""

    permission_classes = [CountryDossierPermission]

    def get(self, request, iso_code):
        try:
            country = Country.objects.get(iso_code=iso_code)
        except Country.DoesNotExist:
            return Response({'detail': 'Country not found'}, status=status.HTTP_404_NOT_FOUND)

        ensure_country_access(request.user, country.id)
        ensure_can_read(request.user, 'country_dossier', country.id)

        # Получаем все CountryInfo для этой страны
        infos = CountryInfo.objects.filter(country=country).select_related(
            'section', 'section__parent'
        )
        serializer = CountryInfoSerializer(infos, many=True)
        return Response(serializer.data)

class CountrySectionsViewSet(viewsets.ReadOnlyModelViewSet):
    """Список разделов для информации по странам"""
    
    serializer_class = CountrySectionsSerializer
    permission_classes = [IsActiveAppUser]
    queryset = CountrySections.objects.select_related('parent').order_by('order', 'title')

class CountryInfoViewSet(CountryScopedQuerysetMixin, viewsets.ModelViewSet):
    """CRUD для информации по странам"""
    
    permission_classes = [CountryDossierPermission]
    country_field = 'country_id'
    queryset = CountryInfo.objects.all().select_related('country', 'section', 'section__parent')
    
    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return CountryInfoWriteSerializer
        return CountryInfoSerializer


class CountryAttachmentViewSet(CountryScopedQuerysetMixin, viewsets.ModelViewSet):
    """Изображения информации по странам"""

    serializer_class = CountryAttachmentSerializer
    permission_classes = [CountryDossierPermission]
    country_field = 'country_id'
    queryset = CountryAttachment.objects.select_related('country', 'section').order_by('-created_at')

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params
        country_id = params.get('country')
        section_id = params.get('section')

        if self.action == 'list' and not country_id and not section_id:
            return qs.none()

        if country_id:
            qs = qs.filter(country_id=country_id)
        if section_id:
            qs = qs.filter(section_id=section_id)

        return qs

class FormularView(APIView):
    """Возвращает формуляр объекта разведки"""

    permission_classes = [FormularPermission]

    def get(self, request, target_id):
        try:
            target = Target.objects.get(id=target_id)
        except Target.DoesNotExist:
            return Response({'detail': 'Target not found'}, status=status.HTTP_404_NOT_FOUND)

        ensure_country_access(request.user, target.country_id)
        ensure_can_read(request.user, 'formular', target.country_id)

        # Получаем все пункты формуляра для этого объекта
        formular_items = Formular.objects.filter(
            target=target
        ).select_related('section', 'section__parent')
        
        formular_serializer = FormularSerializer(formular_items, many=True)

        # Прямые подчинённые (непосредственные дети) + количество их детей через Count
        direct_subordinates = (
            Target.objects.filter(parent=target)
            .select_related('type', 'marker')
            .prefetch_related('type__countries')
            .annotate(children_count=Count('children'))
            .order_by('title')
        )
        subordinates_serializer = TargetSubordinateSerializer(direct_subordinates, many=True)

        return Response({
            'formular': formular_serializer.data,
            'subordinates': subordinates_serializer.data,
        })

class FormularSectionsViewSet(viewsets.ReadOnlyModelViewSet):
    """Список разделов формуляра"""

    serializer_class = FormularSectionsListSerializer
    permission_classes = [IsActiveAppUser]
    queryset = FormularSections.objects.all().order_by('order', 'title')

class FormularBulkUpdateView(APIView):
    """Массовое обновление/создание пунктов формуляра"""

    permission_classes = [FormularPermission]

    def post(self, request, target_id):
        try:
            target = Target.objects.get(id=target_id)
        except Target.DoesNotExist:
            return Response({'detail': 'Target not found'}, status=status.HTTP_404_NOT_FOUND)

        ensure_country_access(request.user, target.country_id)
        ensure_can_write(request.user, 'formular', target.country_id)

        items = request.data.get('items', [])
        
        if not isinstance(items, list):
            return Response({'detail': 'items must be a list'}, status=status.HTTP_400_BAD_REQUEST)

        for item in items:
            serializer = FormularBulkUpdateSerializer(data=item)
            if not serializer.is_valid():
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        section_ids = [item['section_id'] for item in items]
        sections_by_id = FormularSections.objects.in_bulk(section_ids)
        missing = sorted(set(section_ids) - set(sections_by_id.keys()))
        if missing:
            return Response(
                {'detail': 'Unknown section_id', 'ids': missing},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            existing = {
                f.section_id: f
                for f in Formular.objects.filter(target=target, section_id__in=section_ids)
            }
            to_create = []
            to_update = []
            for item in items:
                section_id = item['section_id']
                content = item.get('content', '')
                if section_id in existing:
                    row = existing[section_id]
                    if row.content != content:
                        row.content = content
                        to_update.append(row)
                else:
                    to_create.append(
                        Formular(target=target, section_id=section_id, content=content)
                    )
            if to_create:
                Formular.objects.bulk_create(to_create)
            if to_update:
                Formular.objects.bulk_update(to_update, ['content'])

        return Response({'detail': 'Formular updated successfully'}, status=status.HTTP_200_OK)


class FormularAttachmentViewSet(viewsets.ModelViewSet):
    """Изображения формуляра"""

    serializer_class = FormularAttachmentSerializer
    permission_classes = [FormularPermission]
    queryset = FormularAttachment.objects.select_related('target', 'section').order_by('-created_at')

    def get_queryset(self):
        qs = super().get_queryset()
        qs = filter_by_user_countries(qs, self.request.user, 'target__country_id')
        params = self.request.query_params
        target_id = params.get('target')
        section_id = params.get('section')

        if self.action == 'list' and not target_id and not section_id:
            return qs.none()

        if target_id:
            qs = qs.filter(target_id=target_id)
        if section_id:
            qs = qs.filter(section_id=section_id)

        return qs


class EventViewSet(CountryScopedQuerysetMixin, viewsets.ModelViewSet):
    """События"""

    permission_classes = [EventsPermission]
    country_field = 'country_id'
    queryset = Event.objects.select_related('country', 'marker', 'event_type').all().order_by('-created_at')

    def destroy(self, request, *args, **kwargs):
        ensure_can_delete(request.user)
        return super().destroy(request, *args, **kwargs)

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return EventWriteSerializer
        return EventSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        qs = self.filter_by_allowed_countries(qs)
        params = self.request.query_params

        date_from = params.get('date_from')
        date_to = params.get('date_to')
        time_from = params.get('time_from')
        time_to = params.get('time_to')
        countries = params.get('countries')
        title = params.get('title')
        event_types = params.get('event_types')

        if countries:
            try:
                country_ids = [int(cid) for cid in countries.split(',') if cid.strip()]
                qs = qs.filter(country_id__in=country_ids)
            except ValueError:
                return qs.none()

        if event_types:
            try:
                type_ids = [int(tid) for tid in event_types.split(',') if tid.strip()]
                qs = qs.filter(event_type_id__in=type_ids)
            except ValueError:
                return qs.none()

        if title:
            qs = qs.filter(title__icontains=title)

        if date_from and date_to:
            qs = qs.filter(
                Q(date_start__lte=date_to) &
                (Q(date_end__isnull=True) | Q(date_end__gte=date_from))
            )
        elif date_from:
            qs = qs.filter(
                Q(date_end__isnull=True, date_start__gte=date_from) | Q(date_end__gte=date_from)
            )
        elif date_to:
            qs = qs.filter(
                Q(date_start__lte=date_to) | Q(date_start__isnull=True, date_end__lte=date_to)
            )

        if time_from and time_to:
            qs = qs.filter(
                Q(time_start__lte=time_to) &
                (Q(time_end__isnull=True) | Q(time_end__gte=time_from))
            )
        elif time_from:
            qs = qs.filter(
                Q(time_end__isnull=True, time_start__gte=time_from) | Q(time_end__gte=time_from)
            )
        elif time_to:
            qs = qs.filter(
                Q(time_start__lte=time_to) | Q(time_start__isnull=True, time_end__lte=time_to)
            )

        return qs


def _latest_revision_by_datetime_subquery():
    return OperationalSituationRevision.objects.filter(
        situation_id=OuterRef('pk'),
    ).order_by(
        F('situation_date').desc(nulls_last=True),
        F('situation_time').desc(nulls_last=True),
        '-version',
    )


def _operational_situation_base_queryset():
    latest = _latest_revision_by_datetime_subquery()
    return OperationalSituation.objects.select_related(
        'current_revision',
        'created_by',
    ).prefetch_related(
        'current_revision__countries',
    ).annotate(
        revision_count=Count('revisions'),
        _display_revision_id=Subquery(latest.values('id')[:1]),
        _display_revision_date=Subquery(latest.values('situation_date')[:1]),
        _display_revision_time=Subquery(latest.values('situation_time')[:1]),
    ).order_by(
        F('_display_revision_date').desc(nulls_last=True),
        F('_display_revision_time').desc(nulls_last=True),
        '-created_at',
    )


class OperationalSituationViewSet(viewsets.ModelViewSet):
    """Оперативная обстановка с версионированием."""

    permission_classes = [OperationalSituationsPermission]
    queryset = _operational_situation_base_queryset()
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def get_serializer_class(self):
        if self.action == 'list':
            return OperationalSituationListSerializer
        if self.action in ('revisions', 'timeline'):
            return OperationalSituationRevisionSerializer
        return OperationalSituationSerializer

    def _filter_by_allowed_countries(self, qs):
        allowed = get_allowed_country_ids(self.request.user)
        if allowed is None:
            return qs
        if not allowed:
            return qs.none()
        return qs.filter(current_revision__countries__id__in=allowed).distinct()

    def _apply_list_filters(self, qs):
        params = self.request.query_params
        countries = params.get('countries')
        date_from = params.get('date_from')
        date_to = params.get('date_to')
        title = params.get('title')

        if countries:
            try:
                country_ids = [int(cid) for cid in countries.split(',') if cid.strip()]
                qs = qs.filter(current_revision__countries__id__in=country_ids).distinct()
            except ValueError:
                return qs.none()

        if title:
            qs = qs.filter(current_revision__title__icontains=title)

        if date_from:
            qs = qs.filter(current_revision__situation_date__gte=date_from)
        if date_to:
            qs = qs.filter(current_revision__situation_date__lte=date_to)

        return qs

    def get_queryset(self):
        qs = super().get_queryset()
        qs = self._filter_by_allowed_countries(qs)
        if self.action in ('list', 'timeline'):
            qs = self._apply_list_filters(qs)
        return qs

    def _build_display_revision_cache(self, situations):
        rev_ids = {
            obj._display_revision_id
            for obj in situations
            if getattr(obj, '_display_revision_id', None)
        }
        if not rev_ids:
            return {}
        revisions = OperationalSituationRevision.objects.filter(
            id__in=rev_ids,
        ).prefetch_related('countries')
        return {
            revision.id: OperationalSituationRevisionSerializer(revision).data
            for revision in revisions
        }

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        situations = list(page) if page is not None else list(queryset)
        context = self.get_serializer_context()
        context['_os_display_revision_cache'] = self._build_display_revision_cache(situations)
        serializer = self.get_serializer(situations, many=True, context=context)
        if page is not None:
            return self.get_paginated_response(serializer.data)
        return Response(serializer.data)

    def _payload_from_serializer(self, serializer):
        data = dict(serializer.validated_data)
        countries = data.pop('country_ids', None)
        if countries is not None:
            data['country_ids'] = [country.id for country in countries]
        return data

    def _ensure_country_access(self, country_ids):
        for country_id in country_ids:
            ensure_country_access(self.request.user, country_id)

    def _merge_revision_write_payload(self, revision, payload):
        merged = {
            'title': payload.get('title', revision.title),
            'description': payload.get('description', revision.description),
            'situation_date': payload.get('situation_date', revision.situation_date),
            'situation_time': payload.get('situation_time', revision.situation_time),
            'color': payload.get('color', revision.color),
            'geometry': payload.get('geometry', revision.geometry),
            'change_note': payload.get('change_note', ''),
        }
        if 'country_ids' in payload:
            merged['country_ids'] = payload['country_ids']
        else:
            merged['country_ids'] = list(revision.countries.values_list('id', flat=True))
        return merged

    def create(self, request, *args, **kwargs):
        serializer = OperationalSituationRevisionWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = self._payload_from_serializer(serializer)
        self._ensure_country_access(payload.get('country_ids', []))
        situation = create_operational_situation(payload, request.user)
        situation = self.get_queryset().get(pk=situation.pk)
        return Response(
            OperationalSituationSerializer(situation).data,
            status=status.HTTP_201_CREATED,
        )

    def destroy(self, request, *args, **kwargs):
        ensure_can_delete(request.user)
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['get', 'post'], url_path='revisions')
    def revisions(self, request, pk=None):
        situation = self.get_object()
        if request.method == 'GET':
            revisions_qs = situation.revisions.prefetch_related('countries').order_by(
                F('situation_date').asc(nulls_last=True),
                F('situation_time').asc(nulls_last=True),
                'version',
            )
            return Response(OperationalSituationRevisionSerializer(revisions_qs, many=True).data)

        serializer = OperationalSituationRevisionWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = self._payload_from_serializer(serializer)
        self._ensure_country_access(payload.get('country_ids', []))
        create_new_revision(situation, payload, request.user)
        situation = self.get_queryset().get(pk=situation.pk)
        return Response(
            OperationalSituationSerializer(situation).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['patch'], url_path='current')
    def correct_current(self, request, pk=None):
        situation = self.get_object()
        serializer = OperationalSituationRevisionWriteSerializer(
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        payload = self._payload_from_serializer(serializer)
        if payload.get('country_ids'):
            self._ensure_country_access(payload['country_ids'])
        current = situation.current_revision
        if not current:
            return Response({'detail': 'У обстановки нет текущей ревизии'}, status=status.HTTP_400_BAD_REQUEST)
        merged = self._merge_revision_write_payload(current, payload)
        correct_current_revision(situation, merged, request.user)
        situation = self.get_queryset().get(pk=situation.pk)
        return Response(OperationalSituationSerializer(situation).data)

    @action(detail=True, methods=['patch', 'delete'], url_path=r'revisions/(?P<revision_id>[^/.]+)')
    def revision_detail(self, request, pk=None, revision_id=None):
        situation = self.get_object()
        try:
            revision = situation.revisions.prefetch_related('countries').get(pk=revision_id)
        except OperationalSituationRevision.DoesNotExist:
            return Response({'detail': 'Ревизия не найдена'}, status=status.HTTP_404_NOT_FOUND)

        if request.method == 'DELETE':
            ensure_can_delete(request.user)
            result = delete_operational_situation_revision(revision)
            if result is None:
                return Response(status=status.HTTP_204_NO_CONTENT)
            situation = self.get_queryset().get(pk=result.pk)
            return Response(OperationalSituationSerializer(situation).data)

        serializer = OperationalSituationRevisionWriteSerializer(
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        payload = self._payload_from_serializer(serializer)
        if payload.get('country_ids'):
            self._ensure_country_access(payload['country_ids'])
        merged = self._merge_revision_write_payload(revision, payload)
        correct_revision(revision, merged, request.user)
        situation = self.get_queryset().get(pk=situation.pk)
        return Response(OperationalSituationSerializer(situation).data)

    @action(detail=True, methods=['post'], url_path='fork')
    def fork(self, request, pk=None):
        situation = self.get_object()
        serializer = OperationalSituationRevisionWriteSerializer(
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        payload = self._payload_from_serializer(serializer)
        if payload.get('country_ids'):
            self._ensure_country_access(payload['country_ids'])
        new_situation = fork_operational_situation(situation, payload, request.user)
        new_situation = self.get_queryset().get(pk=new_situation.pk)
        return Response(
            OperationalSituationSerializer(new_situation).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=['get'], url_path='timeline')
    def timeline(self, request):
        situations = self.get_queryset()
        revisions = OperationalSituationRevision.objects.filter(
            situation_id__in=situations.values('id'),
        ).select_related('situation').prefetch_related('countries').order_by(
            F('situation_date').desc(nulls_last=True),
            F('situation_time').desc(nulls_last=True),
            '-version',
        )
        params = request.query_params
        if params.get('date_from'):
            revisions = revisions.filter(situation_date__gte=params['date_from'])
        if params.get('date_to'):
            revisions = revisions.filter(situation_date__lte=params['date_to'])
        return Response(OperationalSituationTimelineRevisionSerializer(revisions, many=True).data)


class PersonSectionsViewSet(viewsets.ReadOnlyModelViewSet):
    """Список разделов персоналий"""

    serializer_class = PersonSectionsListSerializer
    permission_classes = [IsActiveAppUser]
    queryset = PersonSections.objects.all().order_by('order', 'title')


class RelationTypeViewSet(viewsets.ModelViewSet):
    """Характеры связи между лицами"""

    serializer_class = RelationTypeSerializer
    permission_classes = [IsSuperUserOrReadOnlyReference]
    queryset = RelationType.objects.all().order_by('title')


class PersonViewSet(viewsets.ModelViewSet):
    """Лица, привязанные к объектам"""

    permission_classes = [PersonsPermission]
    queryset = Person.objects.select_related('target').prefetch_related(
        Prefetch('photos', queryset=PersonPhoto.objects.order_by('order', 'created_at')),
    ).order_by('order', 'full_name')

    def destroy(self, request, *args, **kwargs):
        ensure_can_delete(request.user)
        return super().destroy(request, *args, **kwargs)

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return PersonCreateSerializer
        if self.action == 'list':
            return PersonListSerializer
        return PersonSerializer

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context.setdefault('request', self.request)
        return context

    def get_queryset(self):
        qs = super().get_queryset()
        qs = filter_by_user_countries(qs, self.request.user, 'target__country_id')
        target_id = self.request.query_params.get('target')
        if target_id:
            qs = qs.filter(target_id=target_id)
        return qs


class PersonDetailView(APIView):
    """Данные по лицу: разделы и связи"""

    permission_classes = [PersonsPermission]

    def get(self, request, person_id):
        try:
            person = Person.objects.select_related('target').prefetch_related(
                Prefetch('photos', queryset=PersonPhoto.objects.order_by('order', 'created_at')),
            ).get(pk=person_id)
        except Person.DoesNotExist:
            return Response({'detail': 'Person not found'}, status=status.HTTP_404_NOT_FOUND)

        ensure_country_access(request.user, person.target.country_id)
        ensure_can_read(request.user, 'persons', person.target.country_id)

        info_items = PersonInfo.objects.filter(person=person).select_related('section', 'section__parent')
        info_serializer = PersonInfoSerializer(info_items, many=True)

        relations = PersonRelation.objects.filter(
            Q(person_from=person) | Q(person_to=person)
        ).select_related('person_from', 'person_to', 'relation_type')
        relations_serializer = PersonRelationSerializer(
            relations,
            many=True,
            context={'person_id': person_id, 'request': request},
        )

        photos = PersonPhoto.objects.filter(person=person).order_by('order', 'created_at')
        photos_serializer = PersonPhotoSerializer(
            photos,
            many=True,
            context={'request': request},
        )

        return Response({
            'person': PersonSerializer(person, context={'request': request}).data,
            'info': info_serializer.data,
            'relations': relations_serializer.data,
            'photos': photos_serializer.data,
        })


class PersonBulkUpdateView(APIView):
    """Массовое обновление данных по разделам лица"""

    permission_classes = [PersonsPermission]

    def post(self, request, person_id):
        try:
            person = Person.objects.select_related('target').get(pk=person_id)
        except Person.DoesNotExist:
            return Response({'detail': 'Person not found'}, status=status.HTTP_404_NOT_FOUND)

        ensure_country_access(request.user, person.target.country_id)
        ensure_can_write(request.user, 'persons', person.target.country_id)

        items = request.data.get('items', [])
        if not isinstance(items, list):
            return Response({'detail': 'items must be a list'}, status=status.HTTP_400_BAD_REQUEST)

        for item in items:
            serializer = PersonBulkUpdateSerializer(data=item)
            if not serializer.is_valid():
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        section_ids = [item['section_id'] for item in items]
        sections_by_id = PersonSections.objects.in_bulk(section_ids)
        missing = sorted(set(section_ids) - set(sections_by_id.keys()))
        if missing:
            return Response(
                {'detail': 'Unknown section_id', 'ids': missing},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            existing = {
                row.section_id: row
                for row in PersonInfo.objects.filter(person=person, section_id__in=section_ids)
            }
            to_create = []
            to_update = []
            for item in items:
                section_id = item['section_id']
                content = item.get('content', '')
                if section_id in existing:
                    row = existing[section_id]
                    if row.content != content:
                        row.content = content
                        to_update.append(row)
                else:
                    to_create.append(
                        PersonInfo(person=person, section_id=section_id, content=content)
                    )
            if to_create:
                PersonInfo.objects.bulk_create(to_create)
            if to_update:
                PersonInfo.objects.bulk_update(to_update, ['content'])

        return Response({'detail': 'Person info updated successfully'}, status=status.HTTP_200_OK)


class PersonAttachmentViewSet(viewsets.ModelViewSet):
    """Изображения персоналий"""

    serializer_class = PersonAttachmentSerializer
    permission_classes = [PersonsPermission]
    queryset = PersonAttachment.objects.select_related('person', 'section').order_by('-created_at')

    def get_queryset(self):
        qs = super().get_queryset()
        qs = filter_by_user_countries(qs, self.request.user, 'person__target__country_id')
        params = self.request.query_params
        person_id = params.get('person')
        section_id = params.get('section')

        if self.action == 'list' and not person_id and not section_id:
            return qs.none()

        if person_id:
            qs = qs.filter(person_id=person_id)
        if section_id:
            qs = qs.filter(section_id=section_id)
        return qs


class PersonPhotoViewSet(viewsets.ModelViewSet):
    """Фотографии лица"""

    serializer_class = PersonPhotoSerializer
    permission_classes = [PersonsPermission]
    queryset = PersonPhoto.objects.select_related('person').order_by('order', 'created_at')

    def get_queryset(self):
        qs = super().get_queryset()
        qs = filter_by_user_countries(qs, self.request.user, 'person__target__country_id')
        person_id = self.request.query_params.get('person')
        if self.action == 'list' and not person_id:
            return qs.none()
        if person_id:
            qs = qs.filter(person_id=person_id)
        return qs


class PersonRelationViewSet(viewsets.ModelViewSet):
    """Связи между лицами"""

    permission_classes = [PersonsPermission]
    queryset = PersonRelation.objects.select_related(
        'person_from', 'person_to', 'relation_type'
    ).order_by('id')

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return PersonRelationWriteSerializer
        return PersonRelationSerializer

    def get_serializer_context(self):
        context = super().get_serializer_context()
        person_id = self.request.query_params.get('person')
        if person_id:
            context['person_id'] = person_id
        return context

    def get_queryset(self):
        qs = super().get_queryset()
        qs = filter_by_user_countries(qs, self.request.user, 'person_from__target__country_id')
        person_id = self.request.query_params.get('person')
        if person_id:
            qs = qs.filter(Q(person_from_id=person_id) | Q(person_to_id=person_id))
        return qs
