# HODs App

This Django app manages Head of Department (HOD) functionality for the ICMS system.

## Features

- HOD registration requests
- Admin approval/rejection of HOD requests
- HOD profile management
- HOD timetable management
- Department-specific access control

## Models

### HOD
- Complete HOD profile with personal and professional information
- Links to User model and Department
- Image upload support
- Active/inactive status tracking

### HODRegistrationRequest
- Handles HOD registration workflow
- Admin approval process
- Status tracking (pending, approved, rejected, retired)
- Department assignment with constraints

## API Endpoints

### Public Endpoints
- `POST /api/hods/registration/` - Submit HOD registration request

### Admin Endpoints
- `GET /api/hods/admin/requests/` - List all HOD requests
- `POST /api/hods/admin/requests/{id}/action/` - Approve/reject HOD request
- `GET /api/hods/admin/records/` - List all active HODs
- `POST /api/hods/admin/records/` - Create new HOD record
- `GET /api/hods/admin/records/{id}/` - Get HOD details
- `PUT /api/hods/admin/records/{id}/` - Update HOD record
- `DELETE /api/hods/admin/records/{id}/` - Deactivate HOD
- `GET /api/hods/admin/departments/` - List departments with HOD status
- `GET /api/hods/admin/stats/` - Get HOD statistics

### HOD Endpoints
- `GET /api/hods/timetable/` - View/manage department timetables
- `POST /api/hods/timetable/` - Create timetable entry
- `DELETE /api/hods/timetable/{id}/` - Delete timetable entry

## Permissions

- `IsAdminUser` - Only admin users can access admin endpoints
- `IsHODUser` - Only HOD users can access HOD-specific endpoints
- `IsAdminOrHOD` - Both admin and HOD users can access

## Migration

To migrate existing HOD data from other apps:
```bash
python manage.py migrate_hod_data
```

## Department Constraints

- Each department can have only one active HOD at a time
- When assigning a new HOD to a department, the system checks for existing active HODs
- HODs can only manage timetables for their assigned department

## File Structure

```
hods/
├── __init__.py
├── admin.py              # Django admin configuration
├── apps.py              # App configuration
├── models.py            # HOD and HODRegistrationRequest models
├── serializers.py       # DRF serializers
├── permissions.py       # Custom permissions
├── signals.py           # Django signals for real-time updates
├── views.py             # Registration and request management views
├── management_views.py  # Admin management views
├── timetable_views.py   # HOD timetable management views
├── urls.py              # URL routing
├── tests.py             # Unit tests
├── migrations/          # Database migrations
├── management/          # Management commands
│   └── commands/
│       └── migrate_hod_data.py
└── README.md            # This file
```

## Usage Examples

### Register as HOD
```python
POST /api/hods/registration/
{
    "name": "Dr. John Smith",
    "email": "john.smith@university.edu",
    "employee_id": "HOD001",
    "phone": "1234567890",
    "department_id": 1,
    "specialization": "Computer Science",
    "designation": "HOD",
    "experience_years": 10,
    "password": "securepassword",
    "confirm_password": "securepassword"
}
```

### Approve HOD Request (Admin)
```python
POST /api/hods/admin/requests/1/action/
{
    "action": "approve"
}
```

### Create Timetable Entry (HOD)
```python
POST /api/hods/timetable/
{
    "course_id": 1,
    "instructor_id": 1,
    "day": "monday",
    "start_time": "09:00",
    "end_time": "10:00",
    "room": "Room 101"
}
```