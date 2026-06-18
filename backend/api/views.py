from rest_framework import viewsets
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework import status
from rest_framework.decorators import action
from django.db.models import Q, Count

from .serializers import (
    TargetSerializer,
    TargetCreateSerializer,
    TargetActionCreateSerializer,
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
    MilitaryBranchSerializer,
    EventTypeSerializer,
    EventSerializer,
    EventWriteSerializer,
    TargetSubordinateSerializer,
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
    TargetType,
    MilitaryBranch,
    EventType,
    Event
)

class TargetViewSet(viewsets.ModelViewSet):
    """Объект разведки"""

    permission_classes = [AllowAny]
    queryset = Target.objects.select_related(
        'country', 'marker', 'type'
    ).annotate(children_count=Count('children'))

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return TargetCreateSerializer
        return TargetSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        parent = self.request.query_params.get('parent')
        if parent:
            try:
                qs = qs.filter(parent_id=int(parent))
            except (ValueError, TypeError):
                qs = qs.none()
        return qs
    
    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        
        # Обработка действий при обновлении
        actions_data = serializer.validated_data.pop('actions', [])
        
        # Обновляем основные поля Target
        self.perform_update(serializer)
        
        # Удаляем старые действия и создаем новые
        instance.actions.all().delete()
        
        for action_data in actions_data:
            action_type_id = action_data.get('action_type_id')
            radius = action_data.get('radius')
            
            try:
                action_type = ActionType.objects.get(id=action_type_id)
                TargetAction.objects.create(
                    target=instance,
                    action_type=action_type,
                    radius=radius
                )
            except ActionType.DoesNotExist:
                continue
        
        return Response(serializer.data)

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

class ActionTypeViewSet(viewsets.ReadOnlyModelViewSet):
    """Список типов действий"""

    serializer_class = ActionTypeListSerializer
    permission_classes = [AllowAny]
    queryset = ActionType.objects.all().order_by('title')

class TargetTypeViewSet(viewsets.ReadOnlyModelViewSet):
    """Список типов объектов разведки"""

    serializer_class = TargetTypeSerializer
    permission_classes = [AllowAny]
    queryset = TargetType.objects.all().order_by('title')


class MilitaryBranchViewSet(viewsets.ReadOnlyModelViewSet):
    """Список видов и родов войск"""

    serializer_class = MilitaryBranchSerializer
    permission_classes = [AllowAny]
    queryset = MilitaryBranch.objects.all().order_by('title')


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
        infos = CountryInfo.objects.filter(country=country)
        serializer = CountryInfoSerializer(infos, many=True)
        return Response(serializer.data)

class CountrySectionsViewSet(viewsets.ReadOnlyModelViewSet):
    """Список разделов для информации по странам"""
    
    serializer_class = CountrySectionsSerializer
    permission_classes = [AllowAny]
    queryset = CountrySections.objects.all().order_by('order', 'title')

class CountryInfoViewSet(viewsets.ModelViewSet):
    """CRUD для информации по странам"""
    
    permission_classes = [AllowAny]
    queryset = CountryInfo.objects.all().select_related('country', 'section')
    
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

        # Валидация данных
        for item in items:
            serializer = FormularBulkUpdateSerializer(data=item)
            if not serializer.is_valid():
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        # Обновление/создание записей
        for item in items:
            section_id = item['section_id']
            content = item.get('content', '')
            
            try:
                section = FormularSections.objects.get(id=section_id)
            except FormularSections.DoesNotExist:
                continue

            Formular.objects.update_or_create(
                target=target,
                section=section,
                defaults={'content': content}
            )

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
                pass

        if event_types:
            try:
                type_ids = [int(tid) for tid in event_types.split(',') if tid.strip()]
                qs = qs.filter(event_type_id__in=type_ids)
            except ValueError:
                pass

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
