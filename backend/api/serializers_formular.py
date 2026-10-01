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
    EventMarkerListSerializer,
)
from .serializers_targets import (
    EventTypeSerializer,
)

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


