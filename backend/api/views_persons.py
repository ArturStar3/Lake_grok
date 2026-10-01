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
        ensure_can_delete(request.user, 'persons')
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
