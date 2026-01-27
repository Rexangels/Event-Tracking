import random
from datetime import timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone
from infrastructure.models import EventModel

class Command(BaseCommand):
    help = 'Generates a large dataset of events for stress testing.'

    def add_arguments(self, parser):
        parser.add_argument('count', type=int, help='Number of events to create')
        parser.add_argument('--delete', action='store_true', help='Delete existing events first')

    def handle(self, *args, **options):
        count = options['count']
        delete = options['delete']

        if delete:
            self.stdout.write('Deleting existing events...')
            EventModel.objects.all().delete()

        self.stdout.write(f'Generating {count} events...')

        categories = ['SENSORY', 'HUMAN_REPORT', 'API_FEED', 'GEOPOLITICAL', 'ENVIRONMENTAL']
        severities = ['low', 'medium', 'high', 'critical']
        
        # Define some hotspots for clustering demo
        hotspots = [
            {'lat': 48.8566, 'lng': 2.3522, 'name': 'France'},
            {'lat': 51.5074, 'lng': -0.1278, 'name': 'England'}, # GeoJSON might use England or UK
            {'lat': 40.7128, 'lng': -74.0060, 'name': 'USA'},
            {'lat': 34.0522, 'lng': -118.2437, 'name': 'USA'},
            {'lat': 35.6762, 'lng': 139.6503, 'name': 'Japan'},
            {'lat': -33.8688, 'lng': 151.2093, 'name': 'Australia'},
            {'lat': -23.5505, 'lng': -46.6333, 'name': 'Brazil'},
            {'lat': 55.7558, 'lng': 37.6173, 'name': 'Russia'},
        ]

        batch_size = 1000
        events = []
        
        for i in range(count):
            # 70% chance to be near a hotspot, 30% random global
            if random.random() < 0.7:
                spot = random.choice(hotspots)
                # Gaussian distribution around hotspot - increased spread for "State" visibility
                lat = random.gauss(spot['lat'], 3.0)
                lng = random.gauss(spot['lng'], 3.0)
                region = spot['name']
            else:
                lat = random.uniform(-60, 80)
                lng = random.uniform(-180, 180)
                region = 'Global'

            event = EventModel(
                title=f"Simulation Event #{i+1}",
                description=f"Automated stress test event generated in {region} region.",
                category=random.choice(categories),
                severity=random.choice(severities),
                latitude=lat,
                longitude=lng,
                created_at=timezone.now() - timedelta(minutes=random.randint(0, 10000)),
                status='VERIFIED' if random.random() > 0.5 else 'PENDING',
                trust_score=random.uniform(0.1, 1.0)
            )
            events.append(event)

            if len(events) >= batch_size:
                EventModel.objects.bulk_create(events)
                events = []
                self.stdout.write(f'Created {i+1} events...')

        if events:
            EventModel.objects.bulk_create(events)

        self.stdout.write(self.style.SUCCESS(f'Successfully created {count} events'))
