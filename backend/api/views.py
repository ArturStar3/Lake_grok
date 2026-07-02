from rest_framework import viewsets
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework import status
from rest_framework.decorators import action
from django.db import transaction
from django.db.models import Q, Count, Prefetch

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
    TargetSubordinateSerializer,
    EquipmentCategorySerializer,
    EquipmentCategoryWriteSerializer,
    EquipmentParameterDefinitionSerializer,
    EquipmentParameterDefinitionWriteSerializer,
    UnitOfMeasureSerializer,
    EquipmentSerializer,
    EquipmentWriteSerializer,
    EquipmentImageSerializer,
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
)
from equipment.models import (
    EquipmentCategory,
    EquipmentParameterDefinition,
    Equipment,
    EquipmentParameterValue,
    EquipmentImage,
    UnitOfMeasure,
)
from .target_utils import replace_target_actions, replace_target_equipment

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
        queryset=TargetEquipment.objects.select_related('equipment').prefetch_related(
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


class TargetViewSet(viewsets.ModelViewSet):
    """Объект разведки"""

    permission_classes = [AllowAny]
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
            try:
                qs = qs.filter(parent_id=int(parent))
            except (ValueError, TypeError):
                qs = qs.none()
        return qs

    @action(detail=False, methods=['get'], url_path='parent-options')
    def parent_options(self, request):
        """Лёгкий список объектов для выбора родителя (без вложенных actions/country)."""
        qs = Target.objects.only('id', 'title', 'label').order_by('title')
        return Response(TargetParentPickerSerializer(qs, many=True).data)

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


class UnitOfMeasureViewSet(viewsets.ModelViewSet):
    """Единицы измерения ТТХ"""

    serializer_class = UnitOfMeasureSerializer
    permission_classes = [AllowAny]
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

    permission_classes = [AllowAny]
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

    permission_classes = [AllowAny]
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

    permission_classes = [AllowAny]
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
    permission_classes = [AllowAny]
    queryset = EquipmentImage.objects.select_related('equipment').order_by('order', 'created_at')

    def get_queryset(self):
        qs = super().get_queryset()
        equipment_id = self.request.query_params.get('equipment')
        if self.action == 'list' and not equipment_id:
            return qs.none()
        if equipment_id:
            qs = qs.filter(equipment_id=equipment_id)
        return qs


class CountryViewSet(viewsets.ModelViewSet):
    """Список стран с полным CRUD"""

    serializer_class = CountryListSerializer
    permission_classes = [AllowAny]
    queryset = Country.objects.all().order_by('title')

class MarkerViewSet(viewsets.ReadOnlyModelViewSet):
    """Список маркеров"""

    serializer_class = MarkerListSerializer
    permission_classes = [AllowAny]
    queryset = Marker.objects.all().order_by('order', 'title')

class EventMarkerViewSet(viewsets.ReadOnlyModelViewSet):
    """Список маркеров событий"""

    serializer_class = EventMarkerListSerializer
    permission_classes = [AllowAny]
    queryset = EventMarker.objects.all().order_by('title')

class ActionTypeViewSet(viewsets.ModelViewSet):
    """CRUD типов зон действия"""

    serializer_class = ActionTypeListSerializer
    permission_classes = [AllowAny]
    queryset = ActionType.objects.all().order_by('title')

class TargetTypeViewSet(viewsets.ModelViewSet):
    """CRUD типов объектов разведки"""

    permission_classes = [AllowAny]
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
    permission_classes = [AllowAny]
    queryset = EventType.objects.all().order_by('title')

class CountryInfoView(APIView):
    """Возвращает информацию по стране с её разделами"""

    def get(self, request, iso_code):
        try:
            country = Country.objects.get(iso_code=iso_code)
        except Country.DoesNotExist:
            return Response({'detail': 'Country not found'}, status=status.HTTP_404_NOT_FOUND)

        # Получаем все CountryInfo для этой страны
        infos = CountryInfo.objects.filter(country=country).select_related(
            'section', 'section__parent'
        )
        serializer = CountryInfoSerializer(infos, many=True)
        return Response(serializer.data)

class CountrySectionsViewSet(viewsets.ReadOnlyModelViewSet):
    """Список разделов для информации по странам"""
    
    serializer_class = CountrySectionsSerializer
    permission_classes = [AllowAny]
    queryset = CountrySections.objects.select_related('parent').order_by('order', 'title')

class CountryInfoViewSet(viewsets.ModelViewSet):
    """CRUD для информации по странам"""
    
    permission_classes = [AllowAny]
    queryset = CountryInfo.objects.all().select_related('country', 'section', 'section__parent')
    
    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return CountryInfoWriteSerializer
        return CountryInfoSerializer


class CountryAttachmentViewSet(viewsets.ModelViewSet):
    """Изображения информации по странам"""

    serializer_class = CountryAttachmentSerializer
    permission_classes = [AllowAny]
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

    permission_classes = [AllowAny]

    def get(self, request, target_id):
        try:
            target = Target.objects.get(id=target_id)
        except Target.DoesNotExist:
            return Response({'detail': 'Target not found'}, status=status.HTTP_404_NOT_FOUND)

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
    permission_classes = [AllowAny]
    queryset = FormularSections.objects.all().order_by('order', 'title')

class FormularBulkUpdateView(APIView):
    """Массовое обновление/создание пунктов формуляра"""

    permission_classes = [AllowAny]

    def post(self, request, target_id):
        try:
            target = Target.objects.get(id=target_id)
        except Target.DoesNotExist:
            return Response({'detail': 'Target not found'}, status=status.HTTP_404_NOT_FOUND)

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
    permission_classes = [AllowAny]
    queryset = FormularAttachment.objects.select_related('target', 'section').order_by('-created_at')

    def get_queryset(self):
        qs = super().get_queryset()
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


class EventViewSet(viewsets.ModelViewSet):
    """События"""

    permission_classes = [AllowAny]
    queryset = Event.objects.select_related('country', 'marker', 'event_type').all().order_by('-created_at')

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return EventWriteSerializer
        return EventSerializer

    def get_queryset(self):
        qs = super().get_queryset()
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
