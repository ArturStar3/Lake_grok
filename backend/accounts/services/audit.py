from accounts.models import AuthAuditLog
from accounts.permissions import get_client_ip


def log_auth_event(request, action, user=None, actor=None, details=''):
    AuthAuditLog.objects.create(
        action=action,
        user=user,
        actor=actor or (request.user if getattr(request, 'user', None) and request.user.is_authenticated else None),
        ip_address=get_client_ip(request) if request else None,
        details=details,
    )
