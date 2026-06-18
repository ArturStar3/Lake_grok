from rest_framework import serializers

from formular.models import (
    Target,
    Country,
    Marker,
    EventMarker,
    TargetAction,
    ActionType,
    TargetType,
    EventType,
    CountrySections,
    CountryInfo,
    CountryAttachment,
    Formular,
    FormularSections,
    FormularAttachment,
    Event,
    MilitaryBranch
)


class CountrySerializer(serializers.ModelSerializer):
    """Список стран"""

    class Meta:
        model = Country
        fields = (
            'id',
            'title',
            'color'
        )

class CountryListSerializer(serializers.ModelSerializer):
    """Список стран для выбора"""

    class Meta:
        model = Country
        fields = (
            'id',
            'title',
            'title_short',
            'iso_code',
            'color'
        )

class MarkerSerializer(serializers.ModelSerializer):
    """Список маркеров"""

    class Meta:
        model = Marker
        fields = (
            'id',
            'title',
            'path',
            'top',
            'width',
            'height',
            'order',
            'scale',
            'is_flag'
        )

class MarkerListSerializer(serializers.ModelSerializer):
    """Список маркеров для выбора"""

    class Meta:
        model = Marker
        fields = (
            'id',
            'title',
            'path',
            'top',
            'width',
            'height',
            'order',
            'scale',
            'is_flag'
        )

class EventMarkerListSerializer(serializers.ModelSerializer):
    """Список маркеров событий"""

    class Meta:
        model = EventMarker
        fields = (
            'id',
            'title',
            'path'
        )


class ActionTypeSerializer(serializers.ModelSerializer):
    """Тип действия над объектом разведки"""

    class Meta:
        model = ActionType
        fields = (
            'id',
            'title',
            'animation',
        )

class ActionTypeListSerializer(serializers.ModelSerializer):
    """Список типов действий для выбора"""

    class Meta:
        model = ActionType
        fields = (
            'id',
            'title',
            'animation',
        )

class TargetActionSerializer(serializers.ModelSerializer):
    """Действие над объектом разведки"""

    action_type = ActionTypeSerializer()

    class Meta:
        model = TargetAction
        fields = (
            'action_type',
            'radius',
        )

class TargetTypeSerializer(serializers.ModelSerializer):
    """Тип объекта разведки"""

    class Meta:
        model = TargetType
        fields = (
            'id',
            'title'
        )


class MilitaryBranchSerializer(serializers.ModelSerializer):
    """Вид / род войск"""

    countries = serializers.PrimaryKeyRelatedField(many=True, read_only=True)

    class Meta:
        model = MilitaryBranch
        fields = (
            'id',
            'title',
            'countries'
        )


class EventTypeSerializer(serializers.ModelSerializer):
    """Тип события"""

    class Meta:
        model = EventType
        fields = (
            'id',
            'title'
        )

class TargetSerializer(serializers.ModelSerializer):
    """Объект разведки"""

    country = CountrySerializer()
    marker = MarkerSerializer()
    actions = TargetActionSerializer(many=True)
    type = TargetTypeSerializer()
    branch = MilitaryBranchSerializer()
    children_count = serializers.IntegerField(read_only=True)
    parent = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = Target
        fields = (
            'id',
            'title',
            'label',
            'actions',
            'type',
            'branch',
            'action_radius',
            'lat',
            'lng',
            'country',
            'marker',
            'parent',
            'children_count',
        )


class TargetSubordinateSerializer(serializers.ModelSerializer):
    """Лёгкий сериализатор для прямых подчинённых объектов (в дереве подчинённости)"""

    type = TargetTypeSerializer()
    branch = MilitaryBranchSerializer()
    marker = MarkerSerializer()
    children_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Target
        fields = (
            'id',
            'title',
            'label',
            'type',
            'branch',
            'marker',
            'lat',
            'lng',
            'children_count',
        )


class TargetActionCreateSerializer(serializers.Serializer):
    """Сериализатор для создания действия объекта"""
    
    action_type_id = serializers.IntegerField()
    radius = serializers.FloatField(min_value=0)

class TargetCreateSerializer(serializers.ModelSerializer):
    """Сериализатор для создания объекта разведки"""

    actions = TargetActionCreateSerializer(many=True, required=False)

    class Meta:
        model = Target
        fields = (
            'id',
            'country',
            'title',
            'label',
            'marker',
            'type',
            'branch',
            'action_radius',
            'lat',
            'lng',
            'parent',
            'actions',
        )
        read_only_fields = ('id',)
    
    def create(self, validated_data):
        actions_data = validated_data.pop('actions', [])
        target = Target.objects.create(**validated_data)
        
        # Создаем действия
        for action_data in actions_data:
            action_type_id = action_data.get('action_type_id')
            radius = action_data.get('radius')
            
            try:
                action_type = ActionType.objects.get(id=action_type_id)
                TargetAction.objects.create(
                    target=target,
                    action_type=action_type,
                    radius=radius
                )
            except ActionType.DoesNotExist:
                continue
        
        return target

class CountrySectionsSerializer(serializers.ModelSerializer):
    """Раздел информации по стране"""

    parent = serializers.StringRelatedField(read_only=True)

    class Meta:
        model = CountrySections
        fields = (
            'id',
            'title',
            'order',
            'parent',
            'is_hidden'
        )

class CountryInfoSerializer(serializers.ModelSerializer):
    """Информация по стране в разделе (для чтения)"""

    section = CountrySectionsSerializer()

    class Meta:
        model = CountryInfo
        fields = (
            'id',
            'country',
            'section',
            'content',
        )
        
class CountryInfoWriteSerializer(serializers.ModelSerializer):
    """Информация по стране в разделе (для записи)"""

    class Meta:
        model = CountryInfo
        fields = (
            'id',
            'country',
            'section',
            'content',
        )


class CountryAttachmentSerializer(serializers.ModelSerializer):
    """Изображения информации по стране"""

    class Meta:
        model = CountryAttachment
        fields = (
            'id',
            'country',
            'section',
            'title',
            'description',
            'image',
            'created_at'
        )

class FormularSectionsParentSerializer(serializers.ModelSerializer):
    """Родительский раздел формы"""

    class Meta:
        model = FormularSections
        fields = (
            'title',
            'order',
            'is_hidden',
        )

class FormularSectionsSerializer(serializers.ModelSerializer):
    """Раздел формы"""

    parent = FormularSectionsParentSerializer(read_only=True)

    class Meta:
        model = FormularSections
        fields = (
            'id',
            'title',
            'order',
            'parent',
            'is_hidden'
        )

class EventSerializer(serializers.ModelSerializer):
    """Событие (для чтения)"""

    country = CountryListSerializer()
    marker = EventMarkerListSerializer()
    event_type = EventTypeSerializer()

    class Meta:
        model = Event
        fields = (
            'id',
            'title',
            'object_name',
            'description',
            'event_type',
            'date_start',
            'date_end',
            'time_start',
            'time_end',
            'country',
            'marker',
            'color',
            'shape',
            'created_at',
            'updated_at'
        )

class EventWriteSerializer(serializers.ModelSerializer):
    """Событие (для записи)"""

    class Meta:
        model = Event
        fields = (
            'id',
            'title',
            'object_name',
            'description',
            'event_type',
            'date_start',
            'date_end',
            'time_start',
            'time_end',
            'country',
            'marker',
            'color',
            'shape'
        )
        read_only_fields = ('id',)

class FormularSerializer(serializers.ModelSerializer):
    """Формуляр"""

    section = FormularSectionsSerializer()

    class Meta:
        model = Formular
        fields = (
            'section',
            'content',
        )


class FormularAttachmentSerializer(serializers.ModelSerializer):
    """Изображения формуляра"""

    class Meta:
        model = FormularAttachment
        fields = (
            'id',
            'target',
            'section',
            'title',
            'description',
            'image',
            'created_at'
        )

class FormularSectionsListSerializer(serializers.ModelSerializer):
    """Список разделов формуляра для редактора"""

    class Meta:
        model = FormularSections
        fields = (
            'id',
            'title',
            'order',
            'parent',
            'is_hidden'
        )

class FormularBulkUpdateSerializer(serializers.Serializer):
    """Сериализатор для массового обновления формуляра"""
    
    section_id = serializers.IntegerField()
    content = serializers.CharField(allow_blank=True, required=False)
