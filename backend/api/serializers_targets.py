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
    CountrySerializer,
    MarkerSerializer,
    TargetActionSerializer,
)

class TargetTypeBriefSerializer(serializers.ModelSerializer):
    """Краткий тип объекта (без M2M countries) — для списка targets."""

    parent = serializers.PrimaryKeyRelatedField(read_only=True, allow_null=True)

    class Meta:
        model = TargetType
        fields = ('id', 'title', 'parent')


class TargetTypeSerializer(serializers.ModelSerializer):
    """Тип объекта разведки (чтение)"""

    parent = serializers.PrimaryKeyRelatedField(read_only=True, allow_null=True)
    countries = serializers.PrimaryKeyRelatedField(many=True, read_only=True)

    class Meta:
        model = TargetType
        fields = (
            'id',
            'title',
            'parent',
            'order',
            'countries',
        )


class TargetTypeWriteSerializer(serializers.ModelSerializer):
    """Создание/обновление типа объекта разведки"""

    parent_id = serializers.PrimaryKeyRelatedField(
        queryset=TargetType.objects.all(),
        source='parent',
        required=False,
        allow_null=True,
    )
    country_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Country.objects.all(),
        source='countries',
        required=False,
    )

    class Meta:
        model = TargetType
        fields = (
            'title',
            'parent_id',
            'order',
            'country_ids',
        )

    def validate(self, attrs):
        parent = attrs.get('parent')
        instance = getattr(self, 'instance', None)
        if instance and parent:
            if parent.pk == instance.pk:
                raise serializers.ValidationError(
                    {'parent_id': 'Тип не может быть родителем самого себя'}
                )
            cursor = parent
            while cursor is not None:
                if cursor.pk == instance.pk:
                    raise serializers.ValidationError(
                        {'parent_id': 'Циклическая иерархия типов объектов'}
                    )
                cursor = cursor.parent
        return attrs


class EventTypeSerializer(serializers.ModelSerializer):
    """Тип события"""

    class Meta:
        model = EventType
        fields = (
            'id',
            'title'
        )

class TargetListSerializer(serializers.ModelSerializer):
    """
    Облегчённый список объектов разведки (GET /targets/).
    Без parent, children_count, action_radius и countries у type.
    """

    country = CountrySerializer()
    marker = MarkerSerializer()
    actions = TargetActionSerializer(many=True)
    deployed_equipment = serializers.SerializerMethodField()
    type = TargetTypeBriefSerializer()

    class Meta:
        model = Target
        fields = (
            'id',
            'title',
            'label',
            'actions',
            'deployed_equipment',
            'type',
            'lat',
            'lng',
            'antenna_height_m',
            'crest_elevation_m',
            'normal_pool_level_m',
            'max_pool_level_m',
            'country',
            'marker',
        )

    def get_deployed_equipment(self, obj):
        request = self.context.get('request')
        return serialize_deployed_equipment(obj, request=request)


class MapDisplaySettingsSerializer(serializers.ModelSerializer):
    """Настройки отображения карты (singleton)."""

    zoom_rules = serializers.SerializerMethodField()

    class Meta:
        model = MapDisplaySettings
        fields = ('zoom_rules',)

    def get_zoom_rules(self, obj):
        return normalize_map_display_zoom_rules(obj.zoom_rules)


class TargetVulnerabilitySerializer(serializers.ModelSerializer):
    """Уязвимое место объекта."""

    class Meta:
        model = TargetVulnerability
        fields = (
            'id',
            'target',
            'title',
            'description',
            'image',
            'lat',
            'lng',
            'order',
        )
        read_only_fields = ('id',)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        image = data.get('image')
        request = self.context.get('request')
        if image and request and not str(image).startswith(('http://', 'https://')):
            data['image'] = request.build_absolute_uri(image)
        return data


class TargetSerializer(serializers.ModelSerializer):
    """Объект разведки"""

    country = CountrySerializer()
    marker = MarkerSerializer()
    actions = TargetActionSerializer(many=True)
    deployed_equipment = serializers.SerializerMethodField()
    type = TargetTypeSerializer()
    children_count = serializers.IntegerField(read_only=True)
    parent = serializers.PrimaryKeyRelatedField(read_only=True)
    vulnerabilities = TargetVulnerabilitySerializer(many=True, read_only=True)

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
            'antenna_height_m',
            'crest_elevation_m',
            'normal_pool_level_m',
            'max_pool_level_m',
            'country',
            'marker',
            'parent',
            'children_count',
            'vulnerabilities',
        )

    def get_deployed_equipment(self, obj):
        request = self.context.get('request')
        return serialize_deployed_equipment(obj, include_specs=True, request=request)


class TargetParentPickerSerializer(serializers.ModelSerializer):
    """Минимальный сериализатор для выбора родительского объекта."""

    country = serializers.PrimaryKeyRelatedField(read_only=True)
    type = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = Target
        fields = ('id', 'title', 'label', 'country', 'type')


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
    radius = serializers.FloatField(min_value=0, required=False, allow_null=True)
    zone_geometry = serializers.JSONField(required=False, allow_null=True)
    zone_metadata = serializers.JSONField(required=False, allow_null=True)


class TargetDeployedEquipmentWriteSerializer(serializers.Serializer):
    """Запись техники на объекте (through TargetEquipment)."""

    equipment_id = serializers.IntegerField()
    quantity = serializers.IntegerField(min_value=1, default=1, required=False)


class TargetCreateSerializer(serializers.ModelSerializer):
    """Сериализатор для создания объекта разведки"""

    actions = TargetActionCreateSerializer(many=True, required=False)
    deployed_equipment = TargetDeployedEquipmentWriteSerializer(many=True, required=False)

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
            'antenna_height_m',
            'crest_elevation_m',
            'normal_pool_level_m',
            'max_pool_level_m',
            'parent',
            'actions',
            'deployed_equipment',
        )
        read_only_fields = ('id',)

    def validate(self, attrs):
        parent = attrs.get('parent', getattr(self.instance, 'parent', None))
        country = attrs.get('country', getattr(self.instance, 'country', None))
        target_type = attrs.get('type', getattr(self.instance, 'type', None))

        if parent:
            if country and parent.country_id != country.id:
                raise serializers.ValidationError({
                    'parent': 'Родительский объект должен принадлежать той же стране',
                })
            if target_type and parent.type_id:
                parent_type = parent.type
                if parent_type.order > target_type.order:
                    raise serializers.ValidationError({
                        'parent': (
                            'Родительский объект не может иметь тип с более высоким '
                            'порядком (order), чем текущий объект'
                        ),
                    })

        actions_data = self.initial_data.get('actions')
        if actions_data is not None:
            from django.core.exceptions import ValidationError as DjangoValidationError

            from .target_utils import validate_target_actions_for_target

            try:
                validate_target_actions_for_target(actions_data, target_type=target_type)
            except (ValueError, DjangoValidationError) as exc:
                raise serializers.ValidationError({'actions': str(exc)}) from exc

        return attrs

    def create(self, validated_data):
        actions_data = validated_data.pop('actions', [])
        deployed_data = validated_data.pop('deployed_equipment', None)
        target = Target.objects.create(**validated_data)
        create_target_actions(target, actions_data)
        replace_target_equipment(target, deployed_data if deployed_data is not None else [])
        return target

