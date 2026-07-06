
import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "UMI_backend.settings")
django.setup()

from obe.models import CLOGAMapping
from django.db.models import Count

print("Checking for duplicate CLO mappings...")
duplicates = CLOGAMapping.objects.values('clo').annotate(count=Count('clo')).filter(count__gt=1)
print("Duplicate CLO IDs:", [d['clo'] for d in duplicates])
print("\nDetails:")
for d in duplicates:
    mappings = CLOGAMapping.objects.filter(clo=d['clo']).all()
    print(f"CLO {d['clo']}:")
    for m in mappings:
        print(f"  - {m}")

