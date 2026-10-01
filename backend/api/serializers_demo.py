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
class DemoScenarioStepSerializer(serializers.ModelSerializer):
    """Шаг сценария демонстрации (чтение)."""

    class Meta:
        model = DemoScenarioStep
        fields = (
            'id',
            'stage',
            'order',
            'title',
            'tool',
            'duration_ms',
            'start_mode',
            'hold_previous',
            'wait_for_click',
            'camera',
            'selection',
            'animation',
            'text',
            'mosaic',
        )


class DemoScenarioStepWriteSerializer(serializers.Serializer):
    """Шаг сценария демонстрации (запись, порядок задаётся позицией в массиве)."""

    title = serializers.CharField(max_length=255, required=False, allow_blank=True, default='')
    tool = serializers.ChoiceField(choices=DemoStepTool.choices, default=DemoStepTool.CAMERA)
    duration_ms = serializers.IntegerField(
        required=False,
        min_value=MIN_STEP_DURATION_MS,
        max_value=MAX_STEP_DURATION_MS,
        default=DEFAULT_DEMO_STEP_DURATION_MS,
    )
    start_mode = serializers.ChoiceField(
        choices=DemoStepStartMode.choices,
        default=DemoStepStartMode.ON_CLICK,
    )
    hold_previous = serializers.BooleanField(required=False, default=False)
    wait_for_click = serializers.BooleanField(required=False, default=False)
    camera = serializers.JSONField(required=False, default=dict)
    selection = serializers.JSONField(required=False, default=dict)
    animation = serializers.JSONField(required=False, default=dict)
    text = serializers.JSONField(required=False, default=dict)
    mosaic = serializers.JSONField(required=False, default=dict)

    def validate_camera(self, value):
        return normalize_camera(value)

    def validate_selection(self, value):
        return normalize_selection(value)

    def validate_animation(self, value):
        return normalize_animation(value)

    def validate_text(self, value):
        return normalize_text(value)

    def validate_mosaic(self, value):
        return normalize_step_mosaic(value)


class DemoScenarioStageSerializer(serializers.ModelSerializer):
    """Этап-шаблон со вложенными шагами (чтение)."""

    steps = DemoScenarioStepSerializer(many=True, read_only=True)

    class Meta:
        model = DemoScenarioStage
        fields = ('id', 'order', 'title', 'cue', 'duration_ms', 'steps')


class DemoScenarioStageWriteSerializer(serializers.Serializer):
    """Этап при записи сценария."""

    id = serializers.CharField(required=False, allow_blank=True, allow_null=True, max_length=80)
    title = serializers.CharField(max_length=255, required=False, allow_blank=True, default='')
    cue = serializers.IntegerField(required=False, allow_null=True)
    duration_ms = serializers.IntegerField(required=False, min_value=0, max_value=600000, default=0)
    steps = DemoScenarioStepWriteSerializer(many=True, required=False)


class DemoScenarioSerializer(serializers.ModelSerializer):
    """Сценарий демонстрации со вложенными этапами (чтение)."""

    stages = DemoScenarioStageSerializer(many=True, read_only=True)
    steps = serializers.SerializerMethodField()
    stage_count = serializers.SerializerMethodField()
    step_count = serializers.SerializerMethodField()

    class Meta:
        model = DemoScenario
        fields = (
            'id',
            'title',
            'description',
            'is_default',
            'loop',
            'auto_advance',
            'mosaic',
            'tableau',
            'sequence',
            'default_step_duration_ms',
            'created_at',
            'updated_at',
            'stages',
            'steps',
            'stage_count',
            'step_count',
        )

    def get_steps(self, obj):
        steps = []
        for stage in obj.stages.all():
            steps.extend(stage.steps.all())
        return DemoScenarioStepSerializer(steps, many=True, context=self.context).data

    def get_stage_count(self, obj):
        return len(obj.stages.all())

    def get_step_count(self, obj):
        return sum(len(stage.steps.all()) for stage in obj.stages.all())


class DemoScenarioWriteSerializer(serializers.ModelSerializer):
    """Создание/обновление сценария демонстрации вместе с этапами и программой."""

    stages = DemoScenarioStageWriteSerializer(many=True, required=False)
    steps = DemoScenarioStepWriteSerializer(many=True, required=False)
    sequence = serializers.JSONField(required=False, default=list)

    class Meta:
        model = DemoScenario
        fields = (
            'id',
            'title',
            'description',
            'is_default',
            'loop',
            'auto_advance',
            'mosaic',
            'tableau',
            'sequence',
            'default_step_duration_ms',
            'stages',
            'steps',
        )
        read_only_fields = ('id',)

    def validate_default_step_duration_ms(self, value):
        return normalize_step_duration(value)

    def validate_mosaic(self, value):
        return normalize_scenario_mosaic(value)

    def validate_tableau(self, value):
        return normalize_scenario_tableau(value)

    def validate_sequence(self, value):
        return normalize_scenario_sequence(value)

    def _replace_library(self, scenario, validated_data):
        stages_data = validated_data.pop('stages', serializers.empty)
        steps_data = validated_data.pop('steps', serializers.empty)
        sequence_data = validated_data.get('sequence', serializers.empty)
        mosaic_data = validated_data.get('mosaic', serializers.empty)
        tableau_data = validated_data.get('tableau', serializers.empty)

        if stages_data is not serializers.empty:
            replace_demo_scenario_library(
                scenario,
                stages_data or [],
                sequence_data=None if sequence_data is serializers.empty else sequence_data,
                mosaic_data=None if mosaic_data is serializers.empty else mosaic_data,
                tableau_data=None if tableau_data is serializers.empty else tableau_data,
            )
        elif steps_data is not serializers.empty:
            replace_demo_scenario_steps(scenario, steps_data or [])
        elif (
            sequence_data is not serializers.empty
            or mosaic_data is not serializers.empty
            or tableau_data is not serializers.empty
        ):
            stage_rows = [
                {
                    'id': str(stage.id),
                    'title': stage.title,
                    'cue': stage.cue,
                    'duration_ms': stage.duration_ms,
                    'steps': [
                        {
                            'title': step.title,
                            'tool': step.tool,
                            'duration_ms': step.duration_ms,
                            'start_mode': step.start_mode,
                            'hold_previous': step.hold_previous,
                            'camera': step.camera,
                            'selection': step.selection,
                            'animation': step.animation,
                            'text': step.text,
                            'mosaic': step.mosaic,
                        }
                        for step in stage.steps.all()
                    ],
                }
                for stage in scenario.stages.all()
            ]
            replace_demo_scenario_library(
                scenario,
                stage_rows,
                sequence_data=None if sequence_data is serializers.empty else sequence_data,
                mosaic_data=None if mosaic_data is serializers.empty else mosaic_data,
                tableau_data=None if tableau_data is serializers.empty else tableau_data,
            )

    @transaction.atomic
    def create(self, validated_data):
        stages_data = validated_data.pop('stages', serializers.empty)
        steps_data = validated_data.pop('steps', serializers.empty)
        sequence_data = validated_data.pop('sequence', [])
        mosaic_data = validated_data.get('mosaic')
        tableau_data = validated_data.get('tableau')
        scenario = DemoScenario.objects.create(**validated_data)
        if stages_data is not serializers.empty:
            replace_demo_scenario_library(
                scenario,
                stages_data or [],
                sequence_data=sequence_data,
                mosaic_data=mosaic_data,
                tableau_data=tableau_data,
            )
        else:
            replace_demo_scenario_steps(scenario, steps_data if steps_data is not serializers.empty else [])
            if sequence_data:
                scenario.sequence = normalize_scenario_sequence(sequence_data)
                scenario.save(update_fields=['sequence'])
        clear_other_default_scenarios(scenario)
        return scenario

    @transaction.atomic
    def update(self, instance, validated_data):
        stages_data = validated_data.pop('stages', serializers.empty)
        steps_data = validated_data.pop('steps', serializers.empty)
        sequence_data = validated_data.pop('sequence', serializers.empty)
        mosaic_data = validated_data.get('mosaic', serializers.empty)
        tableau_data = validated_data.get('tableau', serializers.empty)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if stages_data is not serializers.empty:
            replace_demo_scenario_library(
                instance,
                stages_data or [],
                sequence_data=None if sequence_data is serializers.empty else sequence_data,
                mosaic_data=None if mosaic_data is serializers.empty else mosaic_data,
                tableau_data=None if tableau_data is serializers.empty else tableau_data,
            )
        elif steps_data is not serializers.empty:
            replace_demo_scenario_steps(instance, steps_data or [])
        elif (
            sequence_data is not serializers.empty
            or mosaic_data is not serializers.empty
            or tableau_data is not serializers.empty
        ):
            self._replace_library(instance, {
                'sequence': sequence_data,
                'mosaic': mosaic_data,
                'tableau': tableau_data,
            })
        clear_other_default_scenarios(instance)
        return instance

    def to_representation(self, instance):
        return DemoScenarioSerializer(instance, context=self.context).data


class DemoTableauMediaSerializer(serializers.ModelSerializer):
    """Загрузка изображения для блоков художественного режима."""

    url = serializers.SerializerMethodField()

    class Meta:
        model = DemoTableauMedia
        fields = ('id', 'image', 'url', 'created_at')
        read_only_fields = ('id', 'url', 'created_at')

    def get_url(self, obj):
        request = self.context.get('request')
        if not obj.image:
            return None
        url = obj.image.url
        if request is not None:
            return request.build_absolute_uri(url)
        return url

    def validate_image(self, value):
        if not value:
            raise serializers.ValidationError('Файл обязателен')
        content_type = getattr(value, 'content_type', '') or ''
        name = (getattr(value, 'name', '') or '').lower()
        allowed = (
            content_type in ('image/jpeg', 'image/png', 'image/webp')
            or name.endswith(('.jpg', '.jpeg', '.png', '.webp'))
        )
        if not allowed:
            raise serializers.ValidationError('Допустимы JPEG, PNG или WebP')
        if value.size > 5 * 1024 * 1024:
            raise serializers.ValidationError('Максимальный размер файла — 5 МБ')
        return value


class DemoMosaicMediaSerializer(serializers.ModelSerializer):
    """Загрузка видео для слотов мультиэкранной демонстрации."""

    url = serializers.SerializerMethodField()

    class Meta:
        model = DemoMosaicMedia
        fields = ('id', 'video', 'url', 'created_at')
        read_only_fields = ('id', 'url', 'created_at')

    def get_url(self, obj):
        request = self.context.get('request')
        if not obj.video:
            return None
        url = obj.video.url
        if request is not None:
            return request.build_absolute_uri(url)
        return url

    def validate_video(self, value):
        if not value:
            raise serializers.ValidationError('Файл обязателен')
        content_type = getattr(value, 'content_type', '') or ''
        name = (getattr(value, 'name', '') or '').lower()
        allowed = (
            content_type in ('video/mp4', 'video/webm', 'video/quicktime')
            or name.endswith(('.mp4', '.webm', '.mov'))
        )
        if not allowed:
            raise serializers.ValidationError('Допустимы MP4 или WebM')
        if value.size > 80 * 1024 * 1024:
            raise serializers.ValidationError('Максимальный размер файла — 80 МБ')
        return value

