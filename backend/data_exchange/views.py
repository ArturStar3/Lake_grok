import logging

from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import APIException
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import DataExchangePermission, IsActiveAppUser
from accounts.services.permissions import can_read_module, can_write_module
from data_exchange.models import ImportSession
from data_exchange.serializers import (
    ExportRequestSerializer,
    ImportSessionSerializer,
    ResolveImportSerializer,
)
from data_exchange.services.bundle_export import build_export_bundle, export_filename
from data_exchange.services.bundle_import import (
    analyze_bundle,
    apply_import_session,
    cancel_import_session,
)

logger = logging.getLogger(__name__)


class DataExchangeExportView(APIView):
    permission_classes = [IsActiveAppUser]

    def post(self, request):
        if not can_read_module(request.user, 'data_exchange'):
            return Response({'detail': 'Недостаточно прав для экспорта.'}, status=status.HTTP_403_FORBIDDEN)
        serializer = ExportRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            payload = build_export_bundle(
                country_ids=serializer.validated_data['country_ids'],
                user=request.user,
            )
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        response = HttpResponse(payload, content_type='application/zip')
        response['Content-Disposition'] = f'attachment; filename="{export_filename()}"'
        return response


class ImportSessionViewSet(viewsets.ViewSet):
    permission_classes = [IsActiveAppUser, DataExchangePermission]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        queryset = ImportSession.objects.all()
        if not self.request.user.is_superuser:
            queryset = queryset.filter(created_by=self.request.user)
        return queryset

    def get_session(self, pk):
        return get_object_or_404(self.get_queryset(), pk=pk)

    def create(self, request):
        if not can_write_module(request.user, 'data_exchange'):
            return Response({'detail': 'Недостаточно прав для импорта.'}, status=status.HTTP_403_FORBIDDEN)
        uploaded = request.FILES.get('file') or request.FILES.get('bundle')
        if not uploaded:
            return Response({'detail': 'Прикрепите ZIP-файл бандла (поле file).'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            session = analyze_bundle(uploaded, request.user)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except APIException:
            raise
        except Exception:
            logger.exception('Import analysis failed')
            return Response({'detail': 'Ошибка анализа бандла.'}, status=status.HTTP_400_BAD_REQUEST)
        return Response(ImportSessionSerializer(session).data, status=status.HTTP_201_CREATED)

    def retrieve(self, request, pk=None):
        session = self.get_session(pk)
        return Response(ImportSessionSerializer(session).data)

    def destroy(self, request, pk=None):
        session = self.get_session(pk)
        try:
            cancel_import_session(session, user=request.user)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'], url_path='resolve')
    def resolve(self, request, pk=None):
        session = self.get_session(pk)
        serializer = ResolveImportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            summary = apply_import_session(session, serializer.validated_data.get('decisions') or {}, user=request.user)
        except ValueError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except APIException:
            raise
        except Exception:
            logger.exception('Import %s failed; transaction rolled back', session.pk)
            return Response({'detail': 'Ошибка применения. Изменения отменены; сессию можно повторить.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        session.refresh_from_db()
        data = ImportSessionSerializer(session).data
        data['apply_summary'] = summary
        return Response(data)
