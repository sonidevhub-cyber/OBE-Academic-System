
import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "UMI_backend.settings")
django.setup()

from obe.models import CLOGAMapping
from django.db.models import Count

print("Removing duplicate CLO mappings...")

duplicates = CLOGAMapping.objects.values('clo').annotate(count=Count('clo')).filter(count__gt=1)

for d in duplicates:
    # Get all mappings for this CLO, sorted by creation date (oldest first)
    mappings = list(CLOGAMapping.objects.filter(clo=d['clo']).order_by('created_at'))
    # Keep the last one (most recent), delete the rest
    to_delete = mappings[:-1]
    print(f"CLO {d['clo']}: Deleting {len(to_delete)} old mappings...")
    for m in to_delete:
        m.delete()
    print(f"  Kept: {mappings[-1]}")

print("Done!")

