from rest_framework import serializers

from data_exchange.models import ImportItem, ImportSession


class ExportRequestSerializer(serializers.Serializer):
    country_ids = serializers.ListField(
        child=serializers.IntegerField(),
        allow_empty=False,
        min_length=1,
    )


class ImportItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = ImportItem
        fields = (
            'id',
            'entity_type',
            'natural_key',
            'status',
            'decision',
            'label',
            'local_snapshot',
            'imported_snapshot',
        )


class ImportSessionSerializer(serializers.ModelSerializer):
    conflicts = serializers.SerializerMethodField()

    class Meta:
        model = ImportSession
        fields = (
            'id',
            'status',
            'manifest',
            'summary',
            'error_message',
            'created_at',
            'updated_at',
            'conflicts',
        )

    def get_conflicts(self, obj):
        qs = obj.items.filter(status__in=['conflict', 'ambiguous']).order_by('entity_type', 'label')
        return ImportItemSerializer(qs[:2000], many=True).data


class ResolveImportSerializer(serializers.Serializer):
    decisions = serializers.DictField(
        child=serializers.ChoiceField(choices=['keep_local', 'use_imported', 'merge']),
        required=False,
        default=dict,
    )
