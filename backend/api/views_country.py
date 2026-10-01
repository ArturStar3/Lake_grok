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

