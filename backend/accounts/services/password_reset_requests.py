from django.utils import timezone

from accounts.models import PasswordResetRequest, PasswordResetRequestStatus


def create_or_refresh_password_reset_request(user, note=''):
    pending = PasswordResetRequest.objects.filter(
        user=user,
        status=PasswordResetRequestStatus.PENDING,
    ).first()
    if pending:
        if note:
            pending.note = note
            pending.save(update_fields=['note'])
        return pending, False
    return PasswordResetRequest.objects.create(user=user, note=note), True


def resolve_password_reset_requests(user, actor, status=PasswordResetRequestStatus.RESOLVED):
    now = timezone.now()
    return PasswordResetRequest.objects.filter(
        user=user,
        status=PasswordResetRequestStatus.PENDING,
    ).update(status=status, resolved_at=now, resolved_by=actor)
