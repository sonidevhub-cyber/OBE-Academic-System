# Coordinator Management System

## Overview
The Coordinator Management System provides comprehensive functionality for managing coordinators who handle timetable creation, course allocation, and departmental coordination tasks.

## Key Features

### 1. Coordinator Role Management
- **HOD Assignment**: Coordinators are assigned by HODs
- **Dual Role Capability**: Coordinators can also act as instructors (configurable by HOD)
- **Department-based**: Coordinators work within specific departments

### 2. Timetable Management
- **Proposal Creation**: Coordinators create timetable proposals
- **HOD Approval**: All timetables require HOD approval before implementation
- **Slot Management**: Detailed time slot allocation with room assignments
- **Conflict Detection**: Automatic validation to prevent scheduling conflicts

### 3. Course Allocation
- **Instructor Assignment**: Coordinators propose course-instructor allocations
- **Approval Workflow**: HOD reviews and approves/rejects allocations
- **Semester-based**: Allocations are organized by semester

### 4. Professional Dashboard
- **Performance Metrics**: Track approval rates, workload distribution
- **Activity Monitoring**: Recent proposals, allocations, and approvals
- **Professional Development**: Training hours, certifications tracking
- **Department Overview**: Comprehensive department statistics

## API Endpoints

### Coordinator Management
- `GET /api/coordinators/api/coordinators/` - List coordinators
- `POST /api/coordinators/api/coordinators/` - Create coordinator
- `GET /api/coordinators/api/coordinators/{id}/` - Get coordinator details
- `PUT /api/coordinators/api/coordinators/{id}/` - Update coordinator
- `DELETE /api/coordinators/api/coordinators/{id}/` - Delete coordinator

### Timetable Proposals
- `GET /api/coordinators/api/timetable-proposals/` - List proposals
- `POST /api/coordinators/api/timetable-proposals/` - Create proposal
- `POST /api/coordinators/api/timetable-proposals/{id}/submit_to_hod/` - Submit to HOD
- `POST /api/coordinators/api/timetable-proposals/{id}/approve_proposal/` - HOD approval
- `POST /api/coordinators/api/timetable-proposals/{id}/reject_proposal/` - HOD rejection

### Course Allocations
- `GET /api/coordinators/api/course-allocations/` - List allocations
- `POST /api/coordinators/api/course-allocations/` - Create allocation
- `POST /api/coordinators/api/course-allocations/{id}/approve_allocation/` - HOD approval
- `POST /api/coordinators/api/course-allocations/{id}/reject_allocation/` - HOD rejection

### HOD Management
- `POST /api/coordinators/api/hod-management/promote_instructor_to_coordinator/` - Promote instructor
- `POST /api/coordinators/api/hod-management/create_new_coordinator/` - Create new coordinator
- `POST /api/coordinators/api/hod-management/{id}/toggle_instructor_permission/` - Toggle instructor role
- `DELETE /api/coordinators/api/hod-management/{id}/remove_coordinator/` - Remove coordinator
- `GET /api/coordinators/api/hod-management/department_instructors/` - List department instructors

### Professional Dashboard
- `GET /api/coordinators/api/professional-dashboard/dashboard_overview/` - Dashboard overview
- `GET /api/coordinators/api/professional-dashboard/workload_analysis/` - Workload analysis
- `GET /api/coordinators/api/professional-dashboard/performance_metrics/` - Performance metrics
- `POST /api/coordinators/api/professional-dashboard/update_professional_info/` - Update professional info

## Models

### Coordinator
- Basic coordinator information and department assignment
- Dual role capability (coordinator + instructor)
- HOD assignment tracking

### TimetableProposal
- Timetable proposals with approval workflow
- Status tracking (draft, submitted, approved, rejected, implemented)
- HOD review comments

### TimetableSlot
- Individual time slots within proposals
- Course, instructor, time, and room assignments

### CourseAllocation
- Course-instructor allocation proposals
- Semester-based organization
- Approval workflow

### CoordinatorDashboard
- Performance metrics and statistics
- Professional development tracking
- Automated metric updates

## Permissions

### Role-based Access
- **Coordinators**: Can create proposals and allocations
- **HODs**: Can approve/reject proposals and manage coordinators
- **Admins**: Full system access

### Department-based Security
- Coordinators can only work within their assigned department
- HODs can only manage coordinators in their department

## Workflow

### 1. Coordinator Creation
1. HOD promotes existing instructor OR creates new coordinator
2. HOD sets whether coordinator can act as instructor
3. System creates coordinator profile and dashboard

### 2. Timetable Creation
1. Coordinator creates timetable proposal
2. Coordinator adds time slots to proposal
3. Coordinator submits proposal to HOD
4. HOD reviews and approves/rejects
5. If approved, system creates actual timetable entries

### 3. Course Allocation
1. Coordinator proposes course-instructor allocation
2. HOD reviews allocation
3. HOD approves/rejects with comments
4. Approved allocations become active

## Usage Examples

### Creating a Timetable Proposal
```python
# Create proposal
proposal_data = {
    "semester": 1,
    "title": "Fall 2024 Timetable",
    "description": "Complete timetable for fall semester"
}

# Add time slots
slot_data = {
    "proposal_id": proposal.id,
    "course": 1,
    "instructor": 2,
    "day": "monday",
    "start_time": "09:00",
    "end_time": "10:30",
    "room": "Room 101"
}
```

### Promoting Instructor to Coordinator
```python
promotion_data = {
    "instructor_id": 5,
    "can_act_as_instructor": True
}
```

## Integration Points

### With Existing Systems
- **Academics**: Uses existing Course, Semester, Department models
- **Instructors**: Integrates with instructor management
- **HODs**: Extends HOD management capabilities
- **Users**: Extends user role system

### Database Relationships
- Coordinators belong to departments
- Proposals link to semesters and courses
- Allocations connect courses with instructors
- Dashboards track coordinator performance