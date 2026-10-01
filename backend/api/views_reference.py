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
class CountryViewSet(CountryScopedQuerysetMixin, viewsets.ModelViewSet):
    """Список стран с полным CRUD"""

    serializer_class = CountryListSerializer
    permission_classes = [CountryDossierPermission]
    country_field = 'id'
    queryset = Country.objects.select_related('marker_palette').all().order_by('title')

class MarkerColorPaletteViewSet(viewsets.ModelViewSet):
    """CRUD палитр маркеров стран"""

    serializer_class = MarkerColorPaletteSerializer
    permission_classes = [IsSuperUserOrReadOnlyReference]
    queryset = MarkerColorPalette.objects.all().order_by('title')

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.countries.exists():
            return Response(
                {'detail': 'Палитра используется странами'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)

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

