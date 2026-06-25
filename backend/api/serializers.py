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
)
from equipment.models import (
    EquipmentCategory,
    UnitOfMeasure,
    EquipmentParameterDefinition,
    Equipment,
    EquipmentParameterValue,
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
            'color',
            'line_type',
        )

class ActionTypeListSerializer(serializers.ModelSerializer):
    """Список типов действий для выбора"""

    class Meta:
        model = ActionType
        fields = (
            'id',
            'title',
            'color',
            'line_type',
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


class EquipmentCategorySerializer(serializers.ModelSerializer):
    """Категория техники"""

    parent = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = EquipmentCategory
        fields = (
            'id',
            'title',
            'parent',
            'order',
        )


class UnitOfMeasureSerializer(serializers.ModelSerializer):
    """Единица измерения"""

    class Meta:
        model = UnitOfMeasure
        fields = (
            'id',
            'title',
            'symbol',
        )


class EquipmentParameterDefinitionSerializer(serializers.ModelSerializer):
    """Определение параметра ТТХ"""

    unit = UnitOfMeasureSerializer(read_only=True)
    action_type = ActionTypeSerializer(read_only=True)

    class Meta:
        model = EquipmentParameterDefinition
        fields = (
            'id',
            'title',
            'code',
            'unit',
            'action_type',
            'help_text',
        )


class EquipmentParameterValueSerializer(serializers.ModelSerializer):
    """Значение ТТХ образца"""

    parameter = EquipmentParameterDefinitionSerializer(read_only=True)
    parameter_id = serializers.PrimaryKeyRelatedField(
        queryset=EquipmentParameterDefinition.objects.all(),
        source='parameter',
        write_only=True,
    )

    class Meta:
        model = EquipmentParameterValue
        fields = (
            'id',
            'parameter',
            'parameter_id',
            'value',
        )


class EquipmentListSerializer(serializers.ModelSerializer):
    """Краткая информация об образце техники"""

    category = EquipmentCategorySerializer(read_only=True)

    class Meta:
        model = Equipment
        fields = (
            'id',
            'title',
            'designation',
            'category',
        )


class EquipmentSerializer(serializers.ModelSerializer):
    """Образец техники с ТТХ"""

    category = EquipmentCategorySerializer(read_only=True)
    category_id = serializers.PrimaryKeyRelatedField(
        queryset=EquipmentCategory.objects.all(),
        source='category',
        write_only=True,
        required=False,
        allow_null=True,
    )
    origin_country = CountryListSerializer(read_only=True)
    origin_country_id = serializers.PrimaryKeyRelatedField(
        queryset=Country.objects.all(),
        source='origin_country',
        write_only=True,
        required=False,
        allow_null=True,
    )
    parameter_values = EquipmentParameterValueSerializer(many=True, read_only=True)

    class Meta:
        model = Equipment
        fields = (
            'id',
            'title',
            'designation',
            'category',
            'category_id',
            'origin_country',
            'origin_country_id',
            'description',
            'parameter_values',
        )


class CatalogEquipmentZoneSerializer(serializers.Serializer):
    """Зона из каталога ТТХ (без отдельного хранения на площадке)"""

    parameter_title = serializers.CharField()
    action_type = ActionTypeSerializer()
    radius_km = serializers.FloatField()


class TargetDeployedEquipmentSerializer(serializers.Serializer):
    """Техника на объекте, зоны — из каталога."""

    equipment = EquipmentListSerializer()
    quantity = serializers.IntegerField()
    zones = CatalogEquipmentZoneSerializer(many=True)

class TargetTypeSerializer(serializers.ModelSerializer):
    """Тип объекта разведки"""

    countries = serializers.PrimaryKeyRelatedField(many=True, read_only=True)

    class Meta:
        model = TargetType
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
    deployed_equipment = serializers.SerializerMethodField()
    type = TargetTypeSerializer()
    children_count = serializers.IntegerField(read_only=True)
    parent = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = Target
        fields = (
            'id',
            'title',
            'label',
            'actions',
            'deployed_equipment',
            'type',
            'action_radius',
            'lat',
            'lng',
            'country',
            'marker',
            'parent',
            'children_count',
        )

    def get_deployed_equipment(self, obj):
        items = [
            {
                'equipment': link.equipment,
                'quantity': link.quantity,
                'zones': [
                    {
                        'parameter_title': pv.parameter.title,
                        'action_type': pv.parameter.action_type,
                        'radius_km': pv.value,
                    }
                    for pv in link.equipment.catalog_zone_values()
                ],
            }
            for link in obj.equipment_links.all()
        ]
        return TargetDeployedEquipmentSerializer(items, many=True).data


class TargetParentPickerSerializer(serializers.ModelSerializer):
    """Минимальный сериализатор для выбора родительского объекта."""

    class Meta:
        model = Target
        fields = ('id', 'title', 'label')


class TargetSubordinateSerializer(serializers.ModelSerializer):
    """Лёгкий сериализатор для прямых подчинённых объектов (в дереве подчинённости)"""

    type = TargetTypeSerializer()
    marker = MarkerSerializer()
    children_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Target
        fields = (
            'id',
            'title',
            'label',
            'type',
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

        if actions_data:
            type_ids = [a['action_type_id'] for a in actions_data]
            types_by_id = ActionType.objects.in_bulk(type_ids)
            to_create = [
                TargetAction(
                    target=target,
                    action_type=types_by_id[action_data['action_type_id']],
                    radius=action_data.get('radius'),
                )
                for action_data in actions_data
                if action_data.get('action_type_id') in types_by_id
            ]
            if to_create:
                TargetAction.objects.bulk_create(to_create)

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
