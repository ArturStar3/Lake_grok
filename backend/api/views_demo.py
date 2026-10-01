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
class DemoScenarioViewSet(viewsets.ModelViewSet):
    """Сценарии автоматической демонстрации возможностей карты."""

    permission_classes = [DemoScenariosPermission]
    queryset = DemoScenario.objects.prefetch_related(
        Prefetch('stages', queryset=DemoScenarioStage.objects.order_by('order')),
        Prefetch('stages__steps', queryset=DemoScenarioStep.objects.order_by('order')),
        Prefetch('steps', queryset=DemoScenarioStep.objects.order_by('order')),
    ).order_by('title')

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return DemoScenarioWriteSerializer
        return DemoScenarioSerializer

    @action(detail=False, methods=['post'], url_path='import-scanner-document')
    def import_scanner_document(self, request):
        from .demo_scanner import import_docx

        ensure_can_write(request.user, 'demo_scenarios')
        return Response(import_docx(request.FILES.get('file')))

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user if self.request.user.is_authenticated else None)

    def destroy(self, request, *args, **kwargs):
        ensure_can_delete(request.user, 'demo_scenarios')
        return super().destroy(request, *args, **kwargs)


class DemoTableauMediaViewSet(viewsets.ModelViewSet):
    """Загрузка изображений для блоков художественного режима."""

    permission_classes = [DemoScenariosPermission]
    serializer_class = DemoTableauMediaSerializer
    queryset = DemoTableauMedia.objects.all().order_by('-created_at')
    http_method_names = ['get', 'post', 'head', 'options', 'delete']

    def get_queryset(self):
        if self.action == 'list':
            return DemoTableauMedia.objects.none()
        return super().get_queryset()

    def create(self, request, *args, **kwargs):
        ensure_can_write(request.user, 'demo_scenarios')
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        serializer.save(
            created_by=self.request.user if self.request.user.is_authenticated else None,
        )

    def destroy(self, request, *args, **kwargs):
        ensure_can_delete(request.user, 'demo_scenarios')
        return super().destroy(request, *args, **kwargs)


class DemoMosaicMediaViewSet(viewsets.ModelViewSet):
    """Загрузка видео для слотов мультиэкранной демонстрации."""

    permission_classes = [DemoScenariosPermission]
    serializer_class = DemoMosaicMediaSerializer
    queryset = DemoMosaicMedia.objects.all().order_by('-created_at')
    http_method_names = ['get', 'post', 'head', 'options', 'delete']

    def get_queryset(self):
        if self.action == 'list':
            return DemoMosaicMedia.objects.none()
        return super().get_queryset()

    def create(self, request, *args, **kwargs):
        ensure_can_write(request.user, 'demo_scenarios')
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        serializer.save(
            created_by=self.request.user if self.request.user.is_authenticated else None,
        )

    def destroy(self, request, *args, **kwargs):
        ensure_can_delete(request.user, 'demo_scenarios')
        return super().destroy(request, *args, **kwargs)


