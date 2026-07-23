from django.db import transaction
from rest_framework import serializers

from reports.models import ReportSection, ReportTemplate

SECTION_FILTER_KEYS = {
    ReportSection.SectionType.COUNTRIES: {'country_ids'},
    ReportSection.SectionType.TARGETS: {'country_ids', 'type_ids', 'title'},
    ReportSection.SectionType.EQUIPMENT: {'category_ids', 'origin_country_ids', 'title'},
    ReportSection.SectionType.EVENTS: {'country_ids', 'event_type_ids', 'date_from', 'date_to', 'title'},
    ReportSection.SectionType.SITUATIONS: {
        'country_ids', 'date_from', 'date_to', 'title', 'group_by_situation',
    },
    ReportSection.SectionType.ZONES: {'target_ids', 'action_type_ids', 'country_ids'},
    ReportSection.SectionType.VULNERABILITIES: {'target_ids', 'country_ids'},
    ReportSection.SectionType.COUNTRY_FULL: {'country_ids'},
    ReportSection.SectionType.OBJECTS_FULL: {'target_ids', 'country_ids'},
}

DEFAULT_SECTION_TITLES = dict(ReportSection.SectionType.choices)


def _normalize_filters(section_type, filters):
    if filters is None:
        filters = {}
    if not isinstance(filters, dict):
        raise serializers.ValidationError({'filters': 'Фильтры должны быть объектом.'})
    allowed = SECTION_FILTER_KEYS.get(section_type, set())
    cleaned = {}
    for key, value in filters.items():
        if key not in allowed:
            continue
        cleaned[key] = value
    return cleaned


class ReportSectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReportSection
        fields = (
            'id',
            'section_type',
            'title',
            'order',
            'filters',
            'page_break_before',
        )
        read_only_fields = ('id',)

    def validate(self, attrs):
        section_type = attrs.get('section_type')
        if section_type is None and self.instance is not None:
            section_type = self.instance.section_type
        if not section_type:
            raise serializers.ValidationError({'section_type': 'Обязательное поле.'})
        if section_type not in ReportSection.SectionType.values:
            raise serializers.ValidationError({'section_type': 'Неизвестный тип раздела.'})

        title = attrs.get('title')
        if title is None and self.instance is None:
            attrs['title'] = DEFAULT_SECTION_TITLES.get(section_type, 'Раздел')
        elif isinstance(title, str) and not title.strip():
            attrs['title'] = DEFAULT_SECTION_TITLES.get(section_type, 'Раздел')

        filters = attrs.get('filters', None)
        if filters is not None or self.instance is None:
            attrs['filters'] = _normalize_filters(section_type, filters if filters is not None else {})
        return attrs


class ReportTemplateSerializer(serializers.ModelSerializer):
    sections = ReportSectionSerializer(many=True)
    created_by_name = serializers.SerializerMethodField()
    sections_count = serializers.SerializerMethodField()

    class Meta:
        model = ReportTemplate
        fields = (
            'id',
            'name',
            'description',
            'created_by',
            'created_by_name',
            'created_at',
            'updated_at',
            'sections',
            'sections_count',
        )
        read_only_fields = ('id', 'created_by', 'created_at', 'updated_at', 'created_by_name', 'sections_count')

    def get_created_by_name(self, obj):
        user = obj.created_by
        if not user:
            return ''
        return user.get_full_name() or user.username

    def get_sections_count(self, obj):
        if hasattr(obj, '_prefetched_objects_cache') and 'sections' in obj._prefetched_objects_cache:
            return len(obj.sections.all())
        return obj.sections.count()

    def validate_sections(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError('Разделы должны быть списком.')
        return value

    def _replace_sections(self, template, sections_data):
        template.sections.all().delete()
        to_create = []
        for index, item in enumerate(sections_data):
            to_create.append(ReportSection(
                template=template,
                section_type=item['section_type'],
                title=item.get('title') or DEFAULT_SECTION_TITLES.get(item['section_type'], 'Раздел'),
                order=item.get('order', index),
                filters=item.get('filters') or {},
                page_break_before=item.get('page_break_before', True),
            ))
        ReportSection.objects.bulk_create(to_create)

    @transaction.atomic
    def create(self, validated_data):
        sections_data = validated_data.pop('sections', [])
        request = self.context.get('request')
        user = getattr(request, 'user', None) if request else None
        template = ReportTemplate.objects.create(
            created_by=user if user and user.is_authenticated else None,
            **validated_data,
        )
        self._replace_sections(template, sections_data)
        return template

    @transaction.atomic
    def update(self, instance, validated_data):
        sections_data = validated_data.pop('sections', None)
        instance.name = validated_data.get('name', instance.name)
        instance.description = validated_data.get('description', instance.description)
        instance.save()
        if sections_data is not None:
            self._replace_sections(instance, sections_data)
        return instance


class ReportGenerateSerializer(serializers.Serializer):
    overrides = serializers.ListField(
        child=serializers.DictField(),
        required=False,
        allow_empty=True,
        default=list,
    )

    def validate_overrides(self, value):
        result = {}
        for item in value or []:
            section_id = item.get('section_id')
            if section_id is None:
                continue
            try:
                section_id = int(section_id)
            except (TypeError, ValueError):
                raise serializers.ValidationError('section_id должен быть числом.')
            filters = item.get('filters')
            if filters is not None and not isinstance(filters, dict):
                raise serializers.ValidationError('filters должен быть объектом.')
            result[section_id] = filters if filters is not None else {}
        return result


class ReportGeneratePresetSerializer(serializers.Serializer):
    KIND_CHOICES = (
        ('country_full', 'Полный отчёт по стране'),
        ('objects_full', 'Полный отчёт по объектам'),
    )

    kind = serializers.ChoiceField(choices=KIND_CHOICES)
    country_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        allow_empty=True,
        default=list,
    )
    target_ids = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        allow_empty=True,
        default=list,
    )
    name = serializers.CharField(required=False, allow_blank=True, default='')
    format = serializers.ChoiceField(
        choices=[('pdf', 'PDF'), ('docx', 'DOCX')],
        required=False,
        default='pdf',
    )

    def validate(self, attrs):
        kind = attrs.get('kind')
        country_ids = attrs.get('country_ids') or []
        target_ids = [str(t).strip() for t in (attrs.get('target_ids') or []) if str(t).strip()]
        attrs['target_ids'] = target_ids
        if kind == 'country_full' and not country_ids:
            raise serializers.ValidationError({'country_ids': 'Выберите хотя бы одну страну.'})
        if kind == 'objects_full' and not target_ids and not country_ids:
            raise serializers.ValidationError(
                {'target_ids': 'Выберите объекты или страны для отчёта.'}
            )
        if not attrs.get('name'):
            attrs['name'] = dict(self.KIND_CHOICES).get(kind, 'Отчёт')
        return attrs
