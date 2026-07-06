import json

from django.contrib.admin.views.decorators import staff_member_required
from django.http import JsonResponse
from django.views.decorators.http import require_POST

from infolake.markdown_render import render_markdown


@staff_member_required
@require_POST
def markdown_preview(request):
    """AJAX-предпросмотр Markdown для виджета админки."""
    try:
        payload = json.loads(request.body.decode('utf-8'))
        text = payload.get('content', '')
    except (json.JSONDecodeError, UnicodeDecodeError):
        text = request.POST.get('content', '')
    return JsonResponse({'html': str(render_markdown(text))})
