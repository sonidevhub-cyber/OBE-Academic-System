# Generated manually for direct Vision/Mission keyword to PO mapping.

from django.db import migrations, models


def forward_direct_keyword_links(apps, schema_editor):
    PEOKeywordMapping = apps.get_model('obe', 'PEOKeywordMapping')
    VisionMissionMapping = apps.get_model('obe', 'VisionMissionMapping')

    PEOKeywordMapping.objects.filter(
        mission_keyword_id=None,
        vision_keyword_id=None,
    ).delete()

    for mapping in PEOKeywordMapping.objects.exclude(
        mission_keyword_id=None
    ).exclude(
        vision_keyword_id=None
    ):
        PEOKeywordMapping.objects.get_or_create(
            peo_id=mapping.peo_id,
            vision_keyword_id=mapping.vision_keyword_id,
            mission_keyword_id=None,
            defaults={
                'is_active': mapping.is_active,
                'created_at': mapping.created_at,
            },
        )
        mapping.vision_keyword_id = None
        mapping.save(update_fields=['vision_keyword'])

    for chain in VisionMissionMapping.objects.filter(is_active=True):
        mission_links = PEOKeywordMapping.objects.filter(
            mission_keyword_id=chain.mission_keyword_id,
            is_active=True,
        )
        for mission_link in mission_links:
            PEOKeywordMapping.objects.get_or_create(
                peo_id=mission_link.peo_id,
                vision_keyword_id=chain.vision_keyword_id,
                mission_keyword_id=None,
                defaults={'is_active': True},
            )

    seen = set()
    for mapping in PEOKeywordMapping.objects.order_by('-is_active', 'created_at', 'id'):
        key = (mapping.peo_id, mapping.mission_keyword_id, mapping.vision_keyword_id)
        if key in seen:
            mapping.delete()
            continue
        seen.add(key)


class Migration(migrations.Migration):

    atomic = False

    dependencies = [
        ('obe', '0043_employersurveyresponse_additional_feedback'),
    ]

    operations = [
        migrations.RunPython(forward_direct_keyword_links, migrations.RunPython.noop),
        migrations.RunSQL("COMMIT;", migrations.RunSQL.noop),
        migrations.AlterUniqueTogether(
            name='peokeywordmapping',
            unique_together=set(),
        ),
        migrations.AddField(
            model_name='missionkeyword',
            name='peos',
            field=models.ManyToManyField(blank=True, related_name='mission_keywords', through='obe.PEOKeywordMapping', through_fields=('mission_keyword', 'peo'), to='obe.peo'),
        ),
        migrations.AddField(
            model_name='visionkeyword',
            name='peos',
            field=models.ManyToManyField(blank=True, related_name='vision_keywords', through='obe.PEOKeywordMapping', through_fields=('vision_keyword', 'peo'), to='obe.peo'),
        ),
        migrations.AddConstraint(
            model_name='peokeywordmapping',
            constraint=models.CheckConstraint(check=models.Q(('mission_keyword__isnull', False), ('vision_keyword__isnull', True), _connector='AND') | models.Q(('mission_keyword__isnull', True), ('vision_keyword__isnull', False), _connector='AND'), name='peo_keyword_exactly_one_keyword'),
        ),
        migrations.AddConstraint(
            model_name='peokeywordmapping',
            constraint=models.UniqueConstraint(condition=models.Q(('mission_keyword__isnull', False)), fields=('peo', 'mission_keyword'), name='uniq_peo_mission_keyword_mapping'),
        ),
        migrations.AddConstraint(
            model_name='peokeywordmapping',
            constraint=models.UniqueConstraint(condition=models.Q(('vision_keyword__isnull', False)), fields=('peo', 'vision_keyword'), name='uniq_peo_vision_keyword_mapping'),
        ),
        migrations.DeleteModel(
            name='VisionMissionMapping',
        ),
    ]
