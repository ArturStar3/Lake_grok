from types import SimpleNamespace

from django.core.exceptions import ImproperlyConfigured
from django.http import HttpResponse
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from accounts.permissions import ReportsPermission
from accounts.services.permissions import can_delete_module
from reports.models import ReportSection, ReportTemplate
from reports.serializers import (
    DEFAULT_SECTION_TITLES,
    ReportGeneratePresetSerializer,
    ReportGenerateSerializer,
    ReportTemplateSerializer,
    _normalize_filters,
)
from reports.services.docx_builder import build_docx_bytes, build_docx_for_template, docx_filename
from reports.services.pdf_builder import build_pdf_bytes, build_pdf_for_template, pdf_filename

DOCX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'


class ReportTemplateViewSet(viewsets.ModelViewSet):
    queryset = ReportTemplate.objects.prefetch_related('sections').select_related('created_by')
    serializer_class = ReportTemplateSerializer
    permission_classes = [ReportsPermission]

    def destroy(self, request, *args, **kwargs):
        if not can_delete_module(request.user, 'reports'):
            return Response(
                {'detail': 'Недостаточно прав для удаления шаблона отчёта.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().destroy(request, *args, **kwargs)

    @action(detail=False, methods=['get'], url_path='section-types')
    def section_types(self, request):
        data = [
            {'value': value, 'label': label}
            for value, label in ReportSection.SectionType.choices
        ]
        return Response(data)

    def _resolve_format(self, raw):
        fmt = str(raw or 'pdf').strip().lower()
        if fmt not in ('pdf', 'docx'):
            return None
        return fmt

    def _pdf_error_response(self, exc):
        if isinstance(exc, ImproperlyConfigured):
            return Response({'detail': str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        raise exc

    def _file_response(self, *, payload: bytes, fmt: str, name_base: str):
        if fmt == 'docx':
            filename = docx_filename(name_base)
            response = HttpResponse(payload, content_type=DOCX_CONTENT_TYPE)
        else:
            filename = pdf_filename(name_base)
            response = HttpResponse(payload, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response

    def _build_export(self, *, fmt, pdf_fn, docx_fn, filename_base):
        if fmt == 'docx':
            payload = docx_fn()
            return self._file_response(payload=payload, fmt='docx', name_base=filename_base)
        try:
            payload = pdf_fn()
        except ImproperlyConfigured as exc:
            return self._pdf_error_response(exc)
        return self._file_response(payload=payload, fmt='pdf', name_base=filename_base)

    @action(detail=True, methods=['post'], url_path='generate')
    def generate(self, request, pk=None):
        template = self.get_object()
        serializer = ReportGenerateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        overrides = serializer.validated_data.get('overrides') or {}

        fmt = self._resolve_format(request.data.get('format', 'pdf'))
        if fmt is None:
            return Response(
                {'detail': 'Параметр format должен быть pdf или docx.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        normalized = {}
        sections_by_id = {s.id: s for s in template.sections.all()}
        for section_id, filters in overrides.items():
            section = sections_by_id.get(section_id)
            if not section:
                continue
            normalized[section_id] = _normalize_filters(section.section_type, filters)

        return self._build_export(
            fmt=fmt,
            pdf_fn=lambda: build_pdf_for_template(
                template, request.user, section_overrides=normalized or None
            ),
            docx_fn=lambda: build_docx_for_template(
                template, request.user, section_overrides=normalized or None
            ),
            filename_base=template.name,
        )

    @action(detail=False, methods=['post'], url_path='generate-adhoc')
    def generate_adhoc(self, request):
        serializer = ReportTemplateSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        validated = serializer.validated_data
        sections_data = validated.get('sections') or []

        fmt = self._resolve_format(request.data.get('format', 'pdf'))
        if fmt is None:
            return Response(
                {'detail': 'Параметр format должен быть pdf или docx.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        sections = []
        for index, item in enumerate(sections_data):
            section_type = item['section_type']
            sections.append(SimpleNamespace(
                id=None,
                section_type=section_type,
                title=item.get('title') or DEFAULT_SECTION_TITLES.get(section_type, 'Раздел'),
                order=item.get('order', index),
                filters=item.get('filters') or {},
                page_break_before=item.get('page_break_before', True),
            ))

        name = validated.get('name') or 'Предпросмотр отчёта'
        return self._build_export(
            fmt=fmt,
            pdf_fn=lambda: build_pdf_bytes(
                template_name=name,
                template_description=validated.get('description') or '',
                sections=sections,
                user=request.user,
            ),
            docx_fn=lambda: build_docx_bytes(
                template_name=name,
                template_description=validated.get('description') or '',
                sections=sections,
                user=request.user,
            ),
            filename_base=validated.get('name') or 'preview',
        )

    @action(detail=False, methods=['post'], url_path='generate-preset')
    def generate_preset(self, request):
        serializer = ReportGeneratePresetSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        kind = data['kind']
        fmt = data.get('format') or 'pdf'
        filters = _normalize_filters(kind, {
            'country_ids': data.get('country_ids') or [],
            'target_ids': data.get('target_ids') or [],
        })
        section = SimpleNamespace(
            id=None,
            section_type=kind,
            title=DEFAULT_SECTION_TITLES.get(kind, 'Отчёт'),
            order=0,
            filters=filters,
            page_break_before=False,
        )
        name = data.get('name') or DEFAULT_SECTION_TITLES.get(kind, 'Отчёт')
        return self._build_export(
            fmt=fmt,
            pdf_fn=lambda: build_pdf_bytes(
                template_name=name,
                template_description='',
                sections=[section],
                user=request.user,
            ),
            docx_fn=lambda: build_docx_bytes(
                template_name=name,
                template_description='',
                sections=[section],
                user=request.user,
            ),
            filename_base=data.get('name') or kind,
        )
