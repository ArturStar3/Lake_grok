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
class EventViewSet(CountryScopedQuerysetMixin, viewsets.ModelViewSet):
    """События"""

    permission_classes = [EventsPermission]
    country_field = 'country_id'
    queryset = Event.objects.select_related('country', 'marker', 'event_type').all().order_by('-created_at')

    def destroy(self, request, *args, **kwargs):
        ensure_can_delete(request.user, 'events')
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


