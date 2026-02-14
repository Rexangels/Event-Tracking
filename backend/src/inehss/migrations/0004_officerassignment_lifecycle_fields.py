from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('inehss', '0003_officerassignment_is_persistent_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='officerassignment',
            name='escalation_level',
            field=models.CharField(
                choices=[
                    ('none', 'None'),
                    ('low', 'Low'),
                    ('medium', 'Medium'),
                    ('high', 'High'),
                    ('critical', 'Critical'),
                ],
                default='none',
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='officerassignment',
            name='escalation_reason',
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name='officerassignment',
            name='progress_percent',
            field=models.PositiveSmallIntegerField(default=0),
        ),
        migrations.AlterField(
            model_name='officerassignment',
            name='status',
            field=models.CharField(
                choices=[
                    ('pending', 'Pending'),
                    ('accepted', 'Accepted'),
                    ('in_progress', 'In Progress'),
                    ('awaiting_review', 'Awaiting Review'),
                    ('approved', 'Approved'),
                    ('revision_needed', 'Revision Needed'),
                    ('completed', 'Completed'),
                    ('declined', 'Declined'),
                    ('reassigned', 'Reassigned'),
                ],
                default='pending',
                max_length=20,
            ),
        ),
    ]
