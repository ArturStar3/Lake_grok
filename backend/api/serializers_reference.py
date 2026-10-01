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


def _validate_hex_color(value):
    if not isinstance(value, str) or len(value) != 7 or value[0] != '#':
        raise serializers.ValidationError('Цвет должен быть в формате #RRGGBB')
    try:
        int(value[1:], 16)
    except ValueError as exc:
        raise serializers.ValidationError('Цвет должен быть в формате #RRGGBB') from exc
    return value


class MarkerColorPaletteSerializer(serializers.ModelSerializer):
    """Палитра цветов маркера страны."""

    class Meta:
        model = MarkerColorPalette
        fields = (
            'id',
            'title',
            'color_first',
            'color_second',
            'color_third',
            'color_forth',
        )

    def _validate_palette_color(self, value):
        return _validate_hex_color(value)

    def validate_color_first(self, value):
        return self._validate_palette_color(value)

    def validate_color_second(self, value):
        return self._validate_palette_color(value)

    def validate_color_third(self, value):
        return self._validate_palette_color(value)

    def validate_color_forth(self, value):
        return self._validate_palette_color(value)


class CountrySerializer(serializers.ModelSerializer):
    """Список стран"""

    marker_palette = MarkerColorPaletteSerializer(read_only=True)

    class Meta:
        model = Country
        fields = (
            'id',
            'title',
            'marker_palette',
        )

class CountryListSerializer(serializers.ModelSerializer):
    """Список стран для выбора"""

    marker_palette = MarkerColorPaletteSerializer(read_only=True)
    marker_palette_id = serializers.PrimaryKeyRelatedField(
        queryset=MarkerColorPalette.objects.all(),
        source='marker_palette',
        write_only=True,
        required=False,
    )

    class Meta:
        model = Country
        fields = (
            'id',
            'title',
            'title_short',
            'iso_code',
            'marker_palette',
            'marker_palette_id',
        )

    def validate(self, attrs):
        attrs = super().validate(attrs)
        if self.instance is None and not attrs.get('marker_palette'):
            default = MarkerColorPalette.objects.filter(title='Синий').first()
            if default is None:
                default = MarkerColorPalette.objects.order_by('id').first()
            if default:
                attrs['marker_palette'] = default
        return attrs

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
            'zone_mode',
            'is_inundation_zone',
            'min_elevation_deg',
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
            'zone_mode',
            'is_inundation_zone',
            'min_elevation_deg',
        )

    def validate_color(self, value):
        if not isinstance(value, str) or len(value) != 7 or value[0] != '#':
            raise serializers.ValidationError('Цвет должен быть в формате #RRGGBB')
        try:
            int(value[1:], 16)
        except ValueError as exc:
            raise serializers.ValidationError('Цвет должен быть в формате #RRGGBB') from exc
        return value

    def validate(self, attrs):
        zone_mode = attrs.get(
            'zone_mode',
            getattr(self.instance, 'zone_mode', None),
        )
        min_elevation = attrs.get(
            'min_elevation_deg',
            getattr(self.instance, 'min_elevation_deg', None),
        )
        is_inundation = attrs.get(
            'is_inundation_zone',
            getattr(self.instance, 'is_inundation_zone', False),
        )

        if zone_mode == 'los_radar':
            if min_elevation is None:
                raise serializers.ValidationError({
                    'min_elevation_deg': 'Укажите минимальный угол места для режима с учётом рельефа',
                })
        else:
            attrs['min_elevation_deg'] = None

        if is_inundation and zone_mode != 'polygon':
            raise serializers.ValidationError({
                'is_inundation_zone': 'Зона затопления возможна только при режиме «Полигон»',
            })

        return attrs

class TargetActionSerializer(serializers.ModelSerializer):
    """Действие над объектом разведки"""

    action_type = ActionTypeSerializer()

    class Meta:
        model = TargetAction
        fields = (
            'id',
            'action_type',
            'radius',
            'zone_geometry',
            'zone_geometry_computed_at',
            'zone_metadata',
        )


