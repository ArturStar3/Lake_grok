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


