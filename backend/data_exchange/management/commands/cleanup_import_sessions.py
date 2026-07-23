from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from data_exchange.models import ImportSession
from data_exchange.services.bundle_import import cancel_import_session


class Command(BaseCommand):
    help = 'Удаляет незавершённые сессии импорта старше N дней вместе со стейджингом'

    def add_arguments(self, parser):
        parser.add_argument('--days', type=int, default=7)

    def handle(self, *args, **options):
        days = options['days']
        cutoff = timezone.now() - timedelta(days=days)
        qs = ImportSession.objects.filter(
            status__in=[
                ImportSession.Status.ANALYZING,
                ImportSession.Status.READY,
                ImportSession.Status.FAILED,
            ],
            created_at__lt=cutoff,
        )
        count = 0
        for session in qs:
            cancel_import_session(session)
            session.delete()
            count += 1
        self.stdout.write(self.style.SUCCESS(f'Удалено сессий: {count}'))
