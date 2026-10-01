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
        ensure_can_delete(request.user, 'operational_situations')
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
            ensure_can_delete(request.user, 'operational_situations')
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


