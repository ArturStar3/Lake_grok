from rest_framework import serializers
from decimal import Decimal
from django.db import transaction
from django.db.models import Max

from formular.models import (
    Target,
    Country,
    MarkerColorPalette,
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
    TargetVulnerability,
    DemoScenario,
    DemoScenarioStage,
    DemoScenarioStep,
    DemoStepStartMode,
    DemoStepTool,
    DemoTableauMedia,
    DemoMosaicMedia,
)
from equipment.models import (
    EquipmentCategory,
    UnitOfMeasure,
    EquipmentParameterDefinition,
    Equipment,
    EquipmentParameterValue,
    EquipmentImage,
)
from .target_utils import create_target_actions, replace_target_equipment, serialize_deployed_equipment
from .demo_scenario_utils import (
    MAX_STEP_DURATION_MS,
    MIN_STEP_DURATION_MS,
    clear_other_default_scenarios,
    normalize_animation,
    normalize_camera,
    normalize_scenario_mosaic,
    normalize_scenario_sequence,
    normalize_scenario_tableau,
    normalize_selection,
    normalize_step_duration,
    normalize_step_mosaic,
    normalize_text,
    replace_demo_scenario_library,
    replace_demo_scenario_steps,
)
from formular.map_display_utils import normalize_map_display_zoom_rules
from formular.models import DEFAULT_DEMO_STEP_DURATION_MS
from formular.zone_geometry_validation import validate_zone_geometry

from .serializers_reference import (
    ActionTypeSerializer,
    CountryListSerializer,
)

class EquipmentCategorySerializer(serializers.ModelSerializer):
    """Категория техники (чтение)"""

    parent = serializers.PrimaryKeyRelatedField(read_only=True, allow_null=True)

    class Meta:
        model = EquipmentCategory
        fields = (
            'id',
            'title',
            'parent',
            'order',
        )


class EquipmentCategoryWriteSerializer(serializers.ModelSerializer):
    """Создание/обновление категории техники"""

    parent_id = serializers.PrimaryKeyRelatedField(
        queryset=EquipmentCategory.objects.all(),
        source='parent',
        required=False,
        allow_null=True,
    )

    class Meta:
        model = EquipmentCategory
        fields = (
            'title',
            'parent_id',
            'order',
        )

    def validate(self, attrs):
        parent = attrs.get('parent')
        instance = getattr(self, 'instance', None)
        if instance and parent:
            if parent.pk == instance.pk:
                raise serializers.ValidationError(
                    {'parent_id': 'Категория не может быть родителем самой себя'}
                )
            cursor = parent
            while cursor is not None:
                if cursor.pk == instance.pk:
                    raise serializers.ValidationError(
                        {'parent_id': 'Циклическая иерархия категорий'}
                    )
                cursor = cursor.parent
        return attrs


class EquipmentCategoryBriefSerializer(serializers.ModelSerializer):
    """Краткая категория для вложенных ответов"""

    class Meta:
        model = EquipmentCategory
        fields = (
            'id',
            'title',
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
    """Определение параметра ТТХ (чтение)"""

    unit = UnitOfMeasureSerializer(read_only=True)
    action_type = ActionTypeSerializer(read_only=True)
    categories = EquipmentCategoryBriefSerializer(many=True, read_only=True)
    category_ids = serializers.SerializerMethodField()

    class Meta:
        model = EquipmentParameterDefinition
        fields = (
            'id',
            'title',
            'code',
            'unit',
            'action_type',
            'categories',
            'category_ids',
            'help_text',
            'zone_color',
            'zone_line_type',
        )

    def get_category_ids(self, obj):
        return list(obj.categories.values_list('id', flat=True))


class EquipmentParameterDefinitionWriteSerializer(serializers.ModelSerializer):
    """Создание/обновление шаблона параметра ТТХ"""

    unit_id = serializers.PrimaryKeyRelatedField(
        queryset=UnitOfMeasure.objects.all(),
        source='unit',
        required=False,
        allow_null=True,
    )
    action_type_id = serializers.PrimaryKeyRelatedField(
        queryset=ActionType.objects.all(),
        source='action_type',
        required=False,
        allow_null=True,
    )
    category_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=EquipmentCategory.objects.all(),
        source='categories',
        required=False,
    )

    class Meta:
        model = EquipmentParameterDefinition
        fields = (
            'title',
            'code',
            'help_text',
            'unit_id',
            'action_type_id',
            'category_ids',
            'zone_color',
            'zone_line_type',
        )

    def validate_code(self, value):
        import re

        if not re.match(r'^[a-z][a-z0-9_]*$', value):
            raise serializers.ValidationError(
                'Код: латиница в нижнем регистре, snake_case (например range_km)'
            )
        return value

    def validate(self, attrs):
        instance = getattr(self, 'instance', None)
        action_type = attrs.get(
            'action_type',
            instance.action_type if instance else None,
        )
        unit = attrs.get(
            'unit',
            instance.unit if instance else None,
        )
        if action_type:
            if not unit:
                raise serializers.ValidationError(
                    {'unit_id': 'Для параметра зоны нужна единица измерения'}
                )
            if unit.symbol.lower() not in ('км', 'km'):
                raise serializers.ValidationError(
                    {'unit_id': 'Тип зоны допустим только для единицы «км»'}
                )
        else:
            zone_color = attrs.get('zone_color', getattr(instance, 'zone_color', None) if instance else None)
            zone_line_type = attrs.get(
                'zone_line_type',
                getattr(instance, 'zone_line_type', None) if instance else None,
            )
            if zone_color or zone_line_type:
                raise serializers.ValidationError(
                    'Переопределение оформления зоны допустимо только для параметра с типом зоны'
                )
        return attrs


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


class EquipmentParameterValueWriteSerializer(serializers.Serializer):
    """Запись значения ТТХ."""

    parameter_id = serializers.IntegerField()
    value = serializers.FloatField()


class EquipmentImageSerializer(serializers.ModelSerializer):
    """Изображение образца техники"""

    class Meta:
        model = EquipmentImage
        fields = (
            'id',
            'equipment',
            'title',
            'image',
            'order',
            'created_at',
        )


class EquipmentWriteSerializer(serializers.ModelSerializer):
    """Создание/обновление образца техники с ТТХ."""

    category_id = serializers.PrimaryKeyRelatedField(
        queryset=EquipmentCategory.objects.all(),
        source='category',
        required=False,
        allow_null=True,
    )
    origin_country_id = serializers.PrimaryKeyRelatedField(
        queryset=Country.objects.all(),
        source='origin_country',
        required=False,
        allow_null=True,
    )
    parameter_values = EquipmentParameterValueWriteSerializer(many=True, required=False)

    class Meta:
        model = Equipment
        fields = (
            'id',
            'title',
            'designation',
            'category_id',
            'origin_country_id',
            'description',
            'parameter_values',
        )
        read_only_fields = ('id',)

    def create(self, validated_data):
        from .equipment_utils import replace_equipment_parameter_values

        values_data = validated_data.pop('parameter_values', None)
        equipment = Equipment.objects.create(**validated_data)
        replace_equipment_parameter_values(
            equipment,
            values_data if values_data is not None else [],
        )
        return equipment

    def update(self, instance, validated_data):
        from .equipment_utils import replace_equipment_parameter_values

        values_data = validated_data.pop('parameter_values', serializers.empty)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if values_data is not serializers.empty:
            replace_equipment_parameter_values(instance, values_data or [])
        return instance


class EquipmentListSerializer(serializers.ModelSerializer):
    """Краткая информация об образце техники"""

    category = EquipmentCategorySerializer(read_only=True)
    images = EquipmentImageSerializer(many=True, read_only=True)

    class Meta:
        model = Equipment
        fields = (
            'id',
            'title',
            'designation',
            'category',
            'images',
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
    images = EquipmentImageSerializer(many=True, read_only=True)

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
            'images',
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

