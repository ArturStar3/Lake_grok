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


