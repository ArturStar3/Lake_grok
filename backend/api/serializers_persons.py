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
class PersonSectionsListSerializer(serializers.ModelSerializer):
    """Список разделов персоналий для редактора"""

    class Meta:
        model = PersonSections
        fields = (
            'id',
            'title',
            'order',
            'parent',
            'is_hidden',
        )


class PersonSectionsSerializer(serializers.ModelSerializer):
    """Раздел персоналий (для чтения)"""

    parent = serializers.StringRelatedField(read_only=True)

    class Meta:
        model = PersonSections
        fields = (
            'id',
            'title',
            'order',
            'parent',
            'is_hidden',
        )


class PersonInfoSerializer(serializers.ModelSerializer):
    """Данные по лицу и разделу"""

    section = PersonSectionsSerializer()

    class Meta:
        model = PersonInfo
        fields = (
            'section',
            'content',
        )


class PersonBulkUpdateSerializer(serializers.Serializer):
    """Массовое обновление данных по разделам лица"""

    section_id = serializers.IntegerField()
    content = serializers.CharField(allow_blank=True, required=False)


class PersonAttachmentSerializer(serializers.ModelSerializer):
    """Изображения персоналий"""

    class Meta:
        model = PersonAttachment
        fields = (
            'id',
            'person',
            'section',
            'title',
            'description',
            'image',
            'created_at',
        )


def _person_avatar_photo(person):
    photos = list(person.photos.all())
    return next((photo for photo in photos if photo.order == 1), None)


def _person_avatar_url(person, request):
    photo = _person_avatar_photo(person)
    if not photo or not photo.image:
        return None
    url = photo.image.url
    if request:
        return request.build_absolute_uri(url)
    return url


class PersonPhotoSerializer(serializers.ModelSerializer):
    """Фотографии лица"""

    class Meta:
        model = PersonPhoto
        fields = (
            'id',
            'person',
            'title',
            'image',
            'order',
            'created_at',
        )
        read_only_fields = ('id', 'created_at')

    def validate_order(self, value):
        if value < 1:
            raise serializers.ValidationError('Порядок должен быть не меньше 1.')
        return value

    def _next_order(self, person, exclude_pk=None):
        qs = PersonPhoto.objects.filter(person=person)
        if exclude_pk:
            qs = qs.exclude(pk=exclude_pk)
        current_max = qs.aggregate(max_order=Max('order'))['max_order']
        return (current_max or 0) + 1

    def _demote_current_avatar(self, person, new_order_for_old, exclude_pk=None):
        qs = PersonPhoto.objects.filter(person=person, order=1)
        if exclude_pk:
            qs = qs.exclude(pk=exclude_pk)
        current_avatar = qs.first()
        if current_avatar:
            current_avatar.order = new_order_for_old
            current_avatar.save(update_fields=['order'])

    @transaction.atomic
    def create(self, validated_data):
        person = validated_data['person']
        order = validated_data.get('order')
        if order is None:
            if not PersonPhoto.objects.filter(person=person).exists():
                validated_data['order'] = 1
            else:
                validated_data['order'] = self._next_order(person)
        elif order == 1:
            self._demote_current_avatar(person, self._next_order(person))
        return super().create(validated_data)

    @transaction.atomic
    def update(self, instance, validated_data):
        old_order = instance.order
        new_order = validated_data.get('order', old_order)
        if new_order == 1 and old_order != 1:
            other = PersonPhoto.objects.filter(
                person=instance.person,
                order=1,
            ).exclude(pk=instance.pk).first()
            if other:
                other.order = old_order
                other.save(update_fields=['order'])
        return super().update(instance, validated_data)


class RelationTypeSerializer(serializers.ModelSerializer):
    """Характер связи между лицами"""

    class Meta:
        model = RelationType
        fields = (
            'id',
            'title',
            'reverse_title',
        )


class PersonListSerializer(serializers.ModelSerializer):
    """Краткая информация о лице"""

    avatar = serializers.SerializerMethodField()

    class Meta:
        model = Person
        fields = (
            'id',
            'full_name',
            'position',
            'target',
            'avatar',
            'order',
        )

    def get_avatar(self, obj):
        return _person_avatar_url(obj, self.context.get('request'))


class PersonSerializer(serializers.ModelSerializer):
    """Лицо (чтение)"""

    avatar = serializers.SerializerMethodField()

    class Meta:
        model = Person
        fields = (
            'id',
            'target',
            'full_name',
            'position',
            'avatar',
            'order',
        )

    def get_avatar(self, obj):
        return _person_avatar_url(obj, self.context.get('request'))


class PersonCreateSerializer(serializers.ModelSerializer):
    """Создание/обновление лица"""

    class Meta:
        model = Person
        fields = (
            'id',
            'target',
            'full_name',
            'position',
            'order',
        )
        read_only_fields = ('id',)


class PersonRelationSerializer(serializers.ModelSerializer):
    """Связь между лицами"""

    person_from = PersonListSerializer(read_only=True)
    person_to = PersonListSerializer(read_only=True)
    relation_type = RelationTypeSerializer(read_only=True)
    direction = serializers.SerializerMethodField()
    label = serializers.SerializerMethodField()

    class Meta:
        model = PersonRelation
        fields = (
            'id',
            'person_from',
            'person_to',
            'relation_type',
            'notes',
            'direction',
            'label',
        )

    def get_direction(self, obj):
        context_person_id = self.context.get('person_id')
        if context_person_id and str(obj.person_from_id) == str(context_person_id):
            return 'out'
        if context_person_id and str(obj.person_to_id) == str(context_person_id):
            return 'in'
        return 'out'

    def get_label(self, obj):
        context_person_id = self.context.get('person_id')
        if context_person_id and str(obj.person_to_id) == str(context_person_id):
            return obj.relation_type.effective_reverse_title
        return obj.relation_type.title


class PersonRelationWriteSerializer(serializers.ModelSerializer):
    """Создание/обновление связи между лицами"""

    class Meta:
        model = PersonRelation
        fields = (
            'id',
            'person_from',
            'person_to',
            'relation_type',
            'notes',
        )

    def validate(self, attrs):
        person_from = attrs.get('person_from', getattr(self.instance, 'person_from', None))
        person_to = attrs.get('person_to', getattr(self.instance, 'person_to', None))
        if person_from and person_to and person_from.id == person_to.id:
            raise serializers.ValidationError('Лицо не может быть связано само с собой')
        return attrs


