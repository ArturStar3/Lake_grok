from django.contrib.auth import get_user_model
from django.db.models.signals import post_save
from django.dispatch import receiver

from .enums import UserStatus
from .models import UserProfile

User = get_user_model()


@receiver(post_save, sender=User)
def ensure_user_profile(sender, instance, created, **kwargs):
    if created and not hasattr(instance, 'profile'):
        UserProfile.objects.create(
            user=instance,
            status=UserStatus.ACTIVE if instance.is_superuser else UserStatus.PENDING,
            full_name=instance.get_full_name() or '',
        )
