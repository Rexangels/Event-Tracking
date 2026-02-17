from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('inehss', '0004_officerassignment_lifecycle_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='formsubmission',
            name='location_accuracy_m',
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='formsubmission',
            name='location_captured_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='formsubmission',
            name='location_source',
            field=models.CharField(blank=True, max_length=30),
        ),
    ]
