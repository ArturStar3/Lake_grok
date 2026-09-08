"""Персональное избранное карты: CRUD только для текущего пользователя."""

from django.db import IntegrityError
from rest_framework import serializers, viewsets
from rest_framework.permissions import IsAuthenticated

from accounts.models import MAP_FAVORITES_MAX, MapFavorite, MapFavoriteKind
from accounts.permissions import IsActiveAppUser


class MapFavoriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = MapFavorite
        fields = (
            'id',
            'kind',
            'entity_id',
            'card_id',
            'title',
            'source_title',
            'subtitle',
        )
        extra_kwargs = {
            'card_id': {'allow_blank': True, 'required': False},
            'source_title': {'allow_blank': True, 'required': False},
            'subtitle': {'allow_blank': True, 'required': False},
        }

    def validate(self, attrs):
        kind = attrs.get('kind', getattr(self.instance, 'kind', None))
        entity_id = str(attrs.get('entity_id', getattr(self.instance, 'entity_id', '')) or '').strip()
        card_id = str(attrs.get('card_id', getattr(self.instance, 'card_id', '')) or '').strip()
        if 'entity_id' in attrs:
            attrs['entity_id'] = entity_id
        if kind != MapFavoriteKind.FORMULAR:
            card_id = ''
        if 'card_id' in attrs or kind != MapFavoriteKind.FORMULAR:
            attrs['card_id'] = card_id

        title = str(attrs.get('title', getattr(self.instance, 'title', '')) or '').strip()
        source_title = str(attrs.get('source_title', getattr(self.instance, 'source_title', '')) or '').strip()
        if 'title' in attrs or 'source_title' in attrs:
            attrs['title'] = title or source_title or 'Без названия'
            attrs['source_title'] = source_title or attrs['title']
        if 'subtitle' in attrs:
            attrs['subtitle'] = str(attrs.get('subtitle') or '').strip()
        return attrs

    def create(self, validated_data):
        user = self.context['request'].user
        if MapFavorite.objects.filter(user=user).count() >= MAP_FAVORITES_MAX:
            raise serializers.ValidationError(f'Не больше {MAP_FAVORITES_MAX} пунктов.')
        duplicate = MapFavorite.objects.filter(
            user=user,
            kind=validated_data['kind'],
            entity_id=validated_data['entity_id'],
            card_id=validated_data.get('card_id') or '',
        ).exists()
        if duplicate:
            raise serializers.ValidationError('Этот пункт уже в избранном.')
        try:
            return MapFavorite.objects.create(user=user, **validated_data)
        except IntegrityError as exc:
            raise serializers.ValidationError('Этот пункт уже в избранном.') from exc

    def update(self, instance, validated_data):
        for key in ('title', 'source_title', 'subtitle'):
            if key in validated_data:
                setattr(instance, key, validated_data[key])
        instance.save(update_fields=['title', 'source_title', 'subtitle', 'updated_at'])
        return instance


class MapFavoriteViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, IsActiveAppUser]
    serializer_class = MapFavoriteSerializer
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def get_queryset(self):
        return MapFavorite.objects.filter(user=self.request.user).order_by('created_at', 'id')
