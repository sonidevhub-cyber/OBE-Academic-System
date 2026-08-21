def _iso(value):
    return value.isoformat() if value else None


def _decimal(value):
    return str(value) if value is not None else None


def populate_batch_framework_snapshot(batch):
    """
    Populate immutable framework snapshots for a new Batch instance.

    This function intentionally mutates only the unsaved Batch object. Batch.save()
    calls it before the insert, so the snapshot is written atomically with the row.
    """
    from .models import (
        GAPEOMapping,
        Mission,
        MissionKeyword,
        PEO,
        PEOKeywordMapping,
        Vision,
        VisionKeyword,
        VisionMissionMapping,
    )

    program = batch.program
    department = getattr(program, "department", None)

    peos = list(
        PEO.objects.filter(program=program, is_active=True)
        .order_by("order_number")
    )
    peo_ids = [peo.id for peo in peos]

    ga_mappings_by_peo = {}
    for mapping in (
        GAPEOMapping.objects.filter(peo_id__in=peo_ids, is_active=True)
        .select_related("ga")
        .order_by("ga__order_number", "peo__order_number")
    ):
        ga_mappings_by_peo.setdefault(str(mapping.peo_id), []).append({
            "mapping_id": str(mapping.id),
            "ga_id": str(mapping.ga_id),
            "ga_code": f"GA-{mapping.ga.order_number}",
            "weight": _decimal(mapping.weight),
        })

    keyword_mappings_by_peo = {}
    for mapping in (
        PEOKeywordMapping.objects.filter(peo_id__in=peo_ids, is_active=True)
        .select_related("mission_keyword", "vision_keyword")
        .order_by("peo__order_number", "created_at")
    ):
        keyword_mappings_by_peo.setdefault(str(mapping.peo_id), []).append({
            "mapping_id": str(mapping.id),
            "peo_id": str(mapping.peo_id),
            "mission_keyword_id": str(mapping.mission_keyword_id) if mapping.mission_keyword_id else None,
            "mission_keyword": mapping.mission_keyword.text if mapping.mission_keyword_id else None,
            "vision_keyword_id": str(mapping.vision_keyword_id) if mapping.vision_keyword_id else None,
            "vision_keyword": mapping.vision_keyword.text if mapping.vision_keyword_id else None,
        })

    batch.peo_snapshot = {
        "program_id": str(program.id),
        "captured_peo_count": len(peos),
        "peos": [
            {
                "id": str(peo.id),
                "code": f"PEO-{peo.order_number}",
                "order_number": peo.order_number,
                "title": peo.title,
                "description": peo.description,
                "kpi_threshold": _decimal(peo.kpi_threshold),
                "ga_mappings": ga_mappings_by_peo.get(str(peo.id), []),
                "keyword_mappings": keyword_mappings_by_peo.get(str(peo.id), []),
            }
            for peo in peos
        ],
    }

    vision = (
        Vision.objects.filter(department=department, is_active=True).order_by("-created_at").first()
        if department else None
    )
    mission = (
        Mission.objects.filter(department=department, is_active=True).order_by("-created_at").first()
        if department else None
    )
    vision_keywords = list(
        VisionKeyword.objects.filter(vision=vision, is_active=True).order_by("text")
        if vision else []
    )
    mission_keywords = list(
        MissionKeyword.objects.filter(mission=mission, is_active=True).order_by("text")
        if mission else []
    )

    vm_mappings = []
    if vision_keywords and mission_keywords:
        vm_mappings = [
            {
                "mapping_id": str(mapping.id),
                "mission_keyword_id": str(mapping.mission_keyword_id),
                "mission_keyword": mapping.mission_keyword.text,
                "vision_keyword_id": str(mapping.vision_keyword_id),
                "vision_keyword": mapping.vision_keyword.text,
            }
            for mapping in VisionMissionMapping.objects.filter(
                mission_keyword_id__in=[keyword.id for keyword in mission_keywords],
                vision_keyword_id__in=[keyword.id for keyword in vision_keywords],
                is_active=True,
            ).select_related("mission_keyword", "vision_keyword")
        ]

    batch.vision_mission_snapshot = {
        "program_id": str(program.id),
        "department_id": str(department.id) if department else None,
        "vision": {
            "id": str(vision.id) if vision else None,
            "vision_text": vision.statement if vision else "",
            "last_updated": _iso(vision.updated_at) if vision else None,
            "updated_by": str(vision.created_by_id) if vision and vision.created_by_id else None,
            "keywords": [
                {"id": str(keyword.id), "text": keyword.text}
                for keyword in vision_keywords
            ],
        },
        "mission": {
            "id": str(mission.id) if mission else None,
            "mission_text": mission.statement if mission else "",
            "last_updated": _iso(mission.updated_at) if mission else None,
            "updated_by": str(mission.created_by_id) if mission and mission.created_by_id else None,
            "keywords": [
                {"id": str(keyword.id), "text": keyword.text}
                for keyword in mission_keywords
            ],
        },
        "vision_mission_mappings": vm_mappings,
        "peo_keyword_mappings": [
            mapping
            for mappings in keyword_mappings_by_peo.values()
            for mapping in mappings
        ],
    }
