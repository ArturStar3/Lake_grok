from rest_framework import serializers
from decimal import Decimal
from django.db import transaction
from django.db.models import Max

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
    PersonSections,
    RelationType,
    Person,
    PersonInfo,
    PersonAttachment,
    PersonPhoto,
    PersonRelation,
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
            'zone_mode',
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
            'country',
            'marker',
        )

    def get_deployed_equipment(self, obj):
        request = self.context.get('request')
        return serialize_deployed_equipment(obj, request=request)


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
            'antenna_height_m',
            'country',
            'marker',
            'parent',
            'children_count',
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
    radius = serializers.FloatField(min_value=Decimal('0'))


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
        return attrs

    def create(self, validated_data):
        actions_data = validated_data.pop('actions', [])
        deployed_data = validated_data.pop('deployed_equipment', None)
        target = Target.objects.create(**validated_data)
        create_target_actions(target, actions_data)
        replace_target_equipment(target, deployed_data if deployed_data is not None else [])
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
