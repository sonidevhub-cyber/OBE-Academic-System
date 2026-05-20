# ICMS-Final TODO

## Coordinator: Course Allocation backend + dashboard tab

- [x] Create `coordinators` Django app/module
  - [ ] Add `apps.py`, `models.py`, `serializers.py`, `views.py`, `urls.py`

- [ ] Add `CourseAllocation` model compatible with frontend expected fields
  - [ ] `course`, `instructor`, `semester`, `coordinator`, `status`, timestamps, `hod_comments`
- [ ] Implement CourseAllocation API endpoints
  - [ ] `GET /api/coordinators/course-allocations/`
  - [ ] `POST /api/coordinators/course-allocations/`
  - [ ] `PUT /api/coordinators/course-allocations/<id>/`
  - [ ] `DELETE /api/coordinators/course-allocations/<id>/`
  - [ ] `POST /api/coordinators/course-allocations/<id>/approve_allocation/`
  - [ ] `POST /api/coordinators/course-allocations/<id>/reject_allocation/`
- [ ] Wire URLs in `UMI_backend/urls.py`
- [ ] Ensure app is added to `INSTALLED_APPS`
- [ ] Frontend wiring
  - [ ] Replace placeholder in `Frontend/src/pages/CoordinatorDashboard.tsx` "Course Allocation" tab with `CoordinatorAllocationModule`
- [ ] Run/test
  - [ ] `GET /api/coordinators/course-allocations/` returns 200
  - [ ] Coordinator dashboard tab loads allocation list

