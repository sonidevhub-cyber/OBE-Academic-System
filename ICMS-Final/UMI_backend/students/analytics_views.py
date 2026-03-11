from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.db.models import Avg, Count, Q, Max, Min
from django.utils import timezone
from datetime import datetime, timedelta
from .models import Student
from academics.models import Result, Course, Department, Semester, Attendance
from .services.analysis import generate_performance_notes


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def student_analytics_dashboard(request):
    """Get comprehensive analytics for student dashboard"""
    try:
        student = Student.objects.get(user=request.user)
        
        # Basic student info
        student_data = {
            "name": student.name,
            "student_id": student.student_id,
            "department": student.department.name if student.department else None,
            "semester": student.semester.name if student.semester else None,
            "gpa": float(student.gpa or 0),
            "attendance_percentage": float(student.attendance_percentage or 0)
        }
        
        # GPA Trend (last 4 semesters)
        gpa_trend = []
        current_sem = student.semester.semester_number if student.semester else 1
        for i in range(max(1, current_sem-3), current_sem+1):
            sem_results = Result.objects.filter(
                student=student,
                course__semester__semester_number=i
            ).aggregate(avg_gpa=Avg('gpa'))
            gpa_trend.append({
                "semester": f"Sem {i}",
                "gpa": round(float(sem_results['avg_gpa'] or 0), 2)
            })
        
        # Recent Results (last 5)
        recent_results = []
        results = Result.objects.filter(student=student).order_by('-exam_date')[:5]
        for result in results:
            percentage = 0
            if result.total_marks and result.obtained_marks:
                percentage = round((result.obtained_marks / result.total_marks) * 100, 2)
            
            recent_results.append({
                "subject": result.course.name if result.course else "N/A",
                "obtained_marks": result.obtained_marks or 0,
                "total_marks": result.total_marks or 0,
                "percentage": percentage,
                "grade": result.grade or "N/A",
                "exam_date": result.exam_date.strftime('%Y-%m-%d') if result.exam_date else None
            })
        
        # Attendance Analytics - Real Data
        attendance_data = []
        from academics.models import SlotAttendance
        
        # Get real attendance from SlotAttendance model
        slot_attendance = SlotAttendance.objects.filter(student=student)
        
        if slot_attendance.exists():
            # Group by course
            course_attendance = {}
            for record in slot_attendance:
                course_name = record.course.name if record.course else "Unknown Course"
                if course_name not in course_attendance:
                    course_attendance[course_name] = {'total': 0, 'present': 0}
                
                course_attendance[course_name]['total'] += 1
                if record.status == 'present':
                    course_attendance[course_name]['present'] += 1
            
            for course_name, data in course_attendance.items():
                percentage = (data['present'] / data['total'] * 100) if data['total'] > 0 else 0
                attendance_data.append({
                    "course": course_name,
                    "total_classes": data['total'],
                    "present_classes": data['present'],
                    "attendance_percentage": round(percentage, 2)
                })
        else:
            # Fallback to old Attendance model if SlotAttendance is empty
            if student.semester:
                courses = Course.objects.filter(semester=student.semester)
                for course in courses:
                    attendance_records = Attendance.objects.filter(
                        student=student,
                        course=course
                    )
                    total_classes = attendance_records.count()
                    present_classes = attendance_records.filter(status='present').count()
                    attendance_percentage = (present_classes / total_classes * 100) if total_classes > 0 else 0
                    
                    attendance_data.append({
                        "course": course.name,
                        "total_classes": total_classes,
                        "present_classes": present_classes,
                        "attendance_percentage": round(attendance_percentage, 2)
                    })
        
        # Performance Insights
        performance_notes = generate_performance_notes(student)
        
        # Subject-wise Performance
        subject_performance = []
        if student.semester:
            courses = Course.objects.filter(semester=student.semester)
            for course in courses:
                course_results = Result.objects.filter(student=student, course=course)
                if course_results.exists():
                    avg_marks = course_results.aggregate(avg=Avg('obtained_marks'))['avg'] or 0
                    latest_result = course_results.order_by('-exam_date').first()
                    
                    subject_performance.append({
                        "subject": course.name,
                        "average_marks": round(float(avg_marks), 2),
                        "latest_grade": latest_result.grade if latest_result else "N/A",
                        "trend": "improving" if len(course_results) > 1 else "stable"
                    })
        
        # Monthly Attendance Trend - Real Data
        monthly_attendance = []
        from academics.models import SlotAttendance
        
        for i in range(6):  # Last 6 months
            month_start = timezone.now().replace(day=1) - timedelta(days=30*i)
            month_end = month_start + timedelta(days=30)
            
            # Try SlotAttendance first
            month_slot_attendance = SlotAttendance.objects.filter(
                student=student,
                date__range=[month_start, month_end]
            )
            
            if month_slot_attendance.exists():
                total = month_slot_attendance.count()
                present = month_slot_attendance.filter(status='present').count()
            else:
                # Fallback to old Attendance model
                month_attendance = Attendance.objects.filter(
                    student=student,
                    date__range=[month_start, month_end]
                )
                total = month_attendance.count()
                present = month_attendance.filter(status='present').count()
            
            percentage = (present / total * 100) if total > 0 else 0
            
            monthly_attendance.append({
                "month": month_start.strftime('%b %Y'),
                "percentage": round(percentage, 2),
                "total_classes": total,
                "present_classes": present
            })
        
        monthly_attendance.reverse()  # Show chronologically
        
        return Response({
            "student": student_data,
            "gpa_trend": gpa_trend,
            "recent_results": recent_results,
            "attendance_data": attendance_data,
            "performance_notes": performance_notes,
            "subject_performance": subject_performance,
            "monthly_attendance": monthly_attendance,
            "summary_stats": {
                "total_courses": len(subject_performance),
                "average_attendance": round(sum([a['attendance_percentage'] for a in attendance_data]) / len(attendance_data), 2) if attendance_data else 0,
                "total_results": len(recent_results),
                "current_gpa": student_data["gpa"]
            }
        }, status=status.HTTP_200_OK)
        
    except Student.DoesNotExist:
        return Response({"error": "Student profile not found"}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def department_analytics(request):
    """Get department-wide analytics for HOD/Admin"""
    try:
        # Get user's department if they're HOD
        user_department = None
        if hasattr(request.user, 'hod_profile'):
            user_department = request.user.hod_profile.department
        
        # Department Performance Overview
        departments_data = []
        departments = Department.objects.all()
        
        for dept in departments:
            students = Student.objects.filter(department=dept)
            total_students = students.count()
            
            if total_students > 0:
                avg_gpa = students.aggregate(avg=Avg('gpa'))['avg'] or 0
                avg_attendance = students.aggregate(avg=Avg('attendance_percentage'))['avg'] or 0
                
                # Recent results count
                recent_results = Result.objects.filter(
                    student__department=dept,
                    exam_date__gte=timezone.now() - timedelta(days=30)
                ).count()
                
                departments_data.append({
                    "department": dept.name,
                    "total_students": total_students,
                    "average_gpa": round(float(avg_gpa), 2),
                    "average_attendance": round(float(avg_attendance), 2),
                    "recent_results": recent_results
                })
        
        # Semester-wise Distribution
        semester_distribution = []
        semesters = Semester.objects.all().order_by('semester_number')
        for sem in semesters:
            student_count = Student.objects.filter(semester=sem).count()
            semester_distribution.append({
                "semester": sem.name,
                "student_count": student_count
            })
        
        # Top Performers (by GPA)
        top_performers = []
        top_students = Student.objects.filter(gpa__isnull=False).order_by('-gpa')[:10]
        for student in top_students:
            top_performers.append({
                "name": student.name,
                "student_id": student.student_id,
                "department": student.department.name if student.department else "N/A",
                "gpa": float(student.gpa),
                "attendance": float(student.attendance_percentage or 0)
            })
        
        return Response({
            "departments": departments_data,
            "semester_distribution": semester_distribution,
            "top_performers": top_performers,
            "summary": {
                "total_students": Student.objects.count(),
                "total_departments": departments.count(),
                "average_gpa": round(float(Student.objects.aggregate(avg=Avg('gpa'))['avg'] or 0), 2),
                "average_attendance": round(float(Student.objects.aggregate(avg=Avg('attendance_percentage'))['avg'] or 0), 2)
            }
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def course_analytics(request):
    """Get course-wise performance analytics"""
    try:
        course_id = request.query_params.get('course_id')
        semester_id = request.query_params.get('semester_id')
        
        courses_query = Course.objects.all()
        if course_id:
            courses_query = courses_query.filter(course_id=course_id)
        if semester_id:
            courses_query = courses_query.filter(semester_id=semester_id)
        
        courses_data = []
        for course in courses_query:
            # Get all results for this course
            results = Result.objects.filter(course=course)
            students_enrolled = Student.objects.filter(courses=course).count()
            
            if results.exists():
                avg_marks = results.aggregate(avg=Avg('obtained_marks'))['avg'] or 0
                pass_rate = results.filter(grade__in=['A+', 'A', 'B+', 'B', 'C+', 'C']).count()
                pass_percentage = (pass_rate / results.count() * 100) if results.count() > 0 else 0
                
                # Grade distribution
                grade_distribution = {}
                for grade in ['A+', 'A', 'B+', 'B', 'C+', 'C', 'D', 'F']:
                    count = results.filter(grade=grade).count()
                    grade_distribution[grade] = count
                
                courses_data.append({
                    "course_name": course.name,
                    "course_code": course.course_code,
                    "semester": course.semester.name if course.semester else "N/A",
                    "students_enrolled": students_enrolled,
                    "results_recorded": results.count(),
                    "average_marks": round(float(avg_marks), 2),
                    "pass_percentage": round(pass_percentage, 2),
                    "grade_distribution": grade_distribution
                })
        
        return Response({
            "courses": courses_data,
            "summary": {
                "total_courses": courses_query.count(),
                "total_results": Result.objects.filter(course__in=courses_query).count()
            }
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)