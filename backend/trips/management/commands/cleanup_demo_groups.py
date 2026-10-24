from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from trips.models import Group


class Command(BaseCommand):
    help = "Delete demo trips older than --hours (default 24)."

    def add_arguments(self, parser):
        parser.add_argument("--hours", type=int, default=24)

    def handle(self, *args, **options):
        cutoff = timezone.now() - timedelta(hours=options["hours"])
        stale = list(Group.objects.filter(is_demo=True, created_at__lt=cutoff))
        for group in stale:
            group.delete_with_history()
        self.stdout.write(f"Deleted {len(stale)} demo trip(s).")
