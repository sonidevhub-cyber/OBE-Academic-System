
from decimal import Decimal
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('obe', '0010_gacqirecord_update'),
    ]

    operations = [
        migrations.AddField(
            model_name='peo',
            name='kpi_threshold',
            field=models.DecimalField(decimal_places=2, default=Decimal('60.00'), max_digits=5),
        ),
    ]
