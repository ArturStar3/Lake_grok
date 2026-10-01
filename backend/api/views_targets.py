from collections import defaultdict

from rest_framework import viewsets
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from django.db import transaction
from django.db.models import Q, Count, Prefetch, F, OuterRef, Subquery
from django.utils import timezone
from formular.viewshed import compute_los_polygon

from accounts.permissions import (
    CountryScopedQuerysetMixin,
    DemoScenariosPermission,
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
    MapDisplaySettingsSerializer,
    MarkerColorPaletteSerializer,
    TargetVulnerabilitySerializer,
    DemoScenarioSerializer,
    DemoScenarioWriteSerializer,
    DemoTableauMediaSerializer,
    DemoMosaicMediaSerializer,
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
    MapDisplaySettings,
    MarkerColorPalette,
    TargetVulnerability,
    DemoScenario,
    DemoScenarioStage,
    DemoScenarioStep,
    DemoTableauMedia,
    DemoMosaicMedia,
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
        Target.objects.select_related('country__marker_palette', 'marker', 'type')
        .prefetch_related(*_target_zones_prefetch())
        .order_by('title')
    )


def _target_detail_queryset():
    """Детали target: полный prefetch + children_count + все ТТХ техники."""
    return (
        Target.objects.select_related('country__marker_palette', 'marker', 'type')
        .prefetch_related(
            Prefetch(
                'actions',
                queryset=TargetAction.objects.select_related('action_type'),
            ),
            _equipment_links_prefetch(zone_values_only=False),
            'type__countries',
            Prefetch(
                'vulnerabilities',
                queryset=TargetVulnerability.objects.order_by('order', 'title'),
            ),
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
        ensure_can_delete(request.user, 'targets')
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


class TargetVulnerabilityViewSet(viewsets.ModelViewSet):
    """Уязвимые места объекта."""

    serializer_class = TargetVulnerabilitySerializer
    permission_classes = [TargetsPermission]
    queryset = TargetVulnerability.objects.select_related('target').order_by('order', 'title')

    def get_queryset(self):
        qs = super().get_queryset()
        qs = filter_by_user_countries(qs, self.request.user, 'target__country_id')
        target_id = self.request.query_params.get('target')
        if self.action == 'list' and not target_id:
            return qs.none()
        if target_id:
            qs = qs.filter(target_id=target_id)
        return qs

    def destroy(self, request, *args, **kwargs):
        ensure_can_delete(request.user, 'targets')
        return super().destroy(request, *args, **kwargs)


