from django.core.management.base import BaseCommand
from infrastructure.models import EventModel, MediaModel


class Command(BaseCommand):
    help = 'Clears all events and media from the database.'

    def handle(self, *args, **options):
        # Delete all media first (due to foreign key)
        media_count = MediaModel.objects.count()
        MediaModel.objects.all().delete()
        self.stdout.write(self.style.SUCCESS(f'Deleted {media_count} media attachments'))

        # Delete all events
        event_count = EventModel.objects.count()
        EventModel.objects.all().delete()
        self.stdout.write(self.style.SUCCESS(f'Deleted {event_count} events'))

        self.stdout.write(self.style.SUCCESS('Database cleared successfully!'))
