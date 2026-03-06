from django.db import migrations, models
import hashlib
from django.utils import timezone


def backfill_hash_chain(apps, schema_editor):
    AuditLog = apps.get_model('infrastructure', 'AuditLog')
    previous_hash = '0' * 64

    for log in AuditLog.objects.all().order_by('timestamp', 'id'):
        payload = '|'.join([
            str(log.id),
            log.action or '',
            log.source or '',
            log.status or '',
            log.details or '',
            log.ip_address or '',
            previous_hash,
            timezone.now().isoformat(),
        ])
        entry_hash = hashlib.sha256(payload.encode('utf-8')).hexdigest()
        log.prev_hash = previous_hash
        log.entry_hash = entry_hash
        log.save(update_fields=['prev_hash', 'entry_hash'])
        previous_hash = entry_hash


class Migration(migrations.Migration):

    dependencies = [
        ('infrastructure', '0007_alter_userprofile_role'),
    ]

    operations = [
        migrations.AddField(
            model_name='auditlog',
            name='prev_hash',
            field=models.CharField(db_index=True, default='0000000000000000000000000000000000000000000000000000000000000000', editable=False, max_length=64),
        ),
        migrations.AddField(
            model_name='auditlog',
            name='entry_hash',
            field=models.CharField(null=True, editable=False, max_length=64),
        ),
        migrations.RunPython(backfill_hash_chain, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='auditlog',
            name='entry_hash',
            field=models.CharField(editable=False, max_length=64, unique=True),
        ),
    ]
