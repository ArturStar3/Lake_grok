from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    TargetViewSet,
    CountryViewSet,
    MarkerViewSet,
    EventMarkerViewSet,
    ActionTypeViewSet,
    TargetTypeViewSet,
    MilitaryBranchViewSet,
    EventTypeViewSet,
    EventViewSet,
    CountryInfoView,
    CountrySectionsViewSet,
    CountryInfoViewSet,
    CountryAttachmentViewSet,
    FormularView,
    FormularSectionsViewSet,
    FormularBulkUpdateView,
    FormularAttachmentViewSet
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
    r'military-branches',
    MilitaryBranchViewSet,
    basename='military-branches'
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

urlpatterns = [
    path('', include(router.urls)),
    path('country/<str:iso_code>/', CountryInfoView.as_view(), name='country-info'),
    path('formular/<uuid:target_id>/', FormularView.as_view(), name='formular'),
    path('formular/<uuid:target_id>/bulk/', FormularBulkUpdateView.as_view(), name='formular-bulk'),
]