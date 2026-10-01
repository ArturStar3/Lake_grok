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
    CountryListSerializer,
    _validate_hex_color,
)


class OperationalSituationRevisionSerializer(serializers.ModelSerializer):
    countries = CountryListSerializer(many=True, read_only=True)
    situation_id = serializers.UUIDField(source='situation.id', read_only=True)

    class Meta:
        model = OperationalSituationRevision
        fields = (
            'id',
            'situation_id',
            'version',
            'title',
            'description',
            'situation_date',
            'situation_time',
            'color',
            'geometry',
            'countries',
            'change_kind',
            'change_note',
            'parent_revision',
            'created_at',
        )


class OperationalSituationRevisionWriteSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=255, required=False)
    description = serializers.CharField(required=False, allow_blank=True, default='')
    situation_date = serializers.DateField(required=False, allow_null=True)
    situation_time = serializers.TimeField(required=False, allow_null=True)
    color = serializers.CharField(max_length=7, required=False, default='#2f80ed')
    geometry = serializers.JSONField(required=False)
    country_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Country.objects.all(),
        required=False,
    )
    change_note = serializers.CharField(required=False, allow_blank=True, default='')

    def validate(self, attrs):
        if self.partial:
            return attrs
        if not attrs.get('title'):
            raise serializers.ValidationError({'title': 'Укажите название'})
        if not attrs.get('geometry'):
            raise serializers.ValidationError({'geometry': 'Укажите геометрию'})
        if not attrs.get('country_ids'):
            raise serializers.ValidationError({'country_ids': 'Укажите хотя бы одну страну'})
        return attrs

    def validate_color(self, value):
        return _validate_hex_color(value)

    def validate_geometry(self, value):
        if value is None:
            return value
        try:
            return validate_zone_geometry(value)
        except ValueError as exc:
            raise serializers.ValidationError(str(exc)) from exc


class OperationalSituationListSerializer(serializers.ModelSerializer):
    current_revision = OperationalSituationRevisionSerializer(read_only=True)
    display_revision = serializers.SerializerMethodField()
    revision_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = OperationalSituation
        fields = (
            'id',
            'created_at',
            'current_revision',
            'display_revision',
            'revision_count',
        )

    def get_display_revision(self, obj):
        rev_id = getattr(obj, '_display_revision_id', None)
        if not rev_id:
            if obj.current_revision:
                return OperationalSituationRevisionSerializer(obj.current_revision).data
            return None

        cache = self.context.setdefault('_os_display_revision_cache', {})
        if rev_id not in cache:
            revision = (
                OperationalSituationRevision.objects
                .filter(pk=rev_id)
                .prefetch_related('countries')
                .first()
            )
            cache[rev_id] = (
                OperationalSituationRevisionSerializer(revision).data
                if revision else None
            )
        return cache[rev_id]


class OperationalSituationSerializer(OperationalSituationListSerializer):
    class Meta(OperationalSituationListSerializer.Meta):
        fields = OperationalSituationListSerializer.Meta.fields


class OperationalSituationTimelineRevisionSerializer(OperationalSituationRevisionSerializer):
    situation_created_at = serializers.DateTimeField(source='situation.created_at', read_only=True)

    class Meta(OperationalSituationRevisionSerializer.Meta):
        fields = OperationalSituationRevisionSerializer.Meta.fields + (
            'situation_created_at',
        )


