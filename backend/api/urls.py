from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    TargetViewSet,
    CountryViewSet,
    MarkerViewSet,
    EventMarkerViewSet,
    ActionTypeViewSet,
    TargetTypeViewSet,
    EventTypeViewSet,
    EventViewSet,
    CountryInfoView,
    CountrySectionsViewSet,
    CountryInfoViewSet,
    CountryAttachmentViewSet,
    FormularView,
    FormularSectionsViewSet,
    FormularBulkUpdateView,
    FormularAttachmentViewSet,
    PersonSectionsViewSet,
    RelationTypeViewSet,
    PersonViewSet,
    PersonDetailView,
    PersonBulkUpdateView,
    PersonAttachmentViewSet,
    PersonPhotoViewSet,
    PersonRelationViewSet,
    EquipmentCategoryViewSet,
    EquipmentParameterDefinitionViewSet,
    UnitOfMeasureViewSet,
    EquipmentViewSet,
    EquipmentImageViewSet,
)

router = DefaultRouter()

router.register(
    r'targets',
    TargetViewSet,
    basename='targets'
)

router.register(
    r'countries',
    CountryViewSet,
    basename='countries'
)

router.register(
    r'markers',
    MarkerViewSet,
    basename='markers'
)

router.register(
    r'event-markers',
    EventMarkerViewSet,
    basename='event-markers'
)

router.register(
    r'action-types',
    ActionTypeViewSet,
    basename='action-types'
)

router.register(
    r'target-types',
    TargetTypeViewSet,
    basename='target-types'
)

router.register(
    r'event-types',
    EventTypeViewSet,
    basename='event-types'
)

router.register(
    r'events',
    EventViewSet,
    basename='events'
)

router.register(
    r'country-sections',
    CountrySectionsViewSet,
    basename='country-sections'
)

router.register(
    r'country-infos',
    CountryInfoViewSet,
    basename='country-infos'
)

router.register(
    r'country-attachments',
    CountryAttachmentViewSet,
    basename='country-attachments'
)

router.register(
    r'formular-sections',
    FormularSectionsViewSet,
    basename='formular-sections'
)

router.register(
    r'formular-attachments',
    FormularAttachmentViewSet,
    basename='formular-attachments'
)

router.register(
    r'person-sections',
    PersonSectionsViewSet,
    basename='person-sections'
)

router.register(
    r'relation-types',
    RelationTypeViewSet,
    basename='relation-types'
)

router.register(
    r'persons',
    PersonViewSet,
    basename='persons'
)

router.register(
    r'person-attachments',
    PersonAttachmentViewSet,
    basename='person-attachments'
)

router.register(
    r'person-photos',
    PersonPhotoViewSet,
    basename='person-photos'
)

router.register(
    r'person-relations',
    PersonRelationViewSet,
    basename='person-relations'
)

router.register(
    r'equipment-categories',
    EquipmentCategoryViewSet,
    basename='equipment-categories'
)

router.register(
    r'equipment-units',
    UnitOfMeasureViewSet,
    basename='equipment-units'
)

router.register(
    r'equipment-parameters',
    EquipmentParameterDefinitionViewSet,
    basename='equipment-parameters'
)

router.register(
    r'equipment',
    EquipmentViewSet,
    basename='equipment'
)

router.register(
    r'equipment-images',
    EquipmentImageViewSet,
    basename='equipment-images'
)

urlpatterns = [
    path('', include(router.urls)),
    path('country/<str:iso_code>/', CountryInfoView.as_view(), name='country-info'),
    path('formular/<uuid:target_id>/', FormularView.as_view(), name='formular'),
    path('formular/<uuid:target_id>/bulk/', FormularBulkUpdateView.as_view(), name='formular-bulk'),
    path('person/<uuid:person_id>/', PersonDetailView.as_view(), name='person-detail'),
    path('person/<uuid:person_id>/bulk/', PersonBulkUpdateView.as_view(), name='person-bulk'),
]