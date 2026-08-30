import django
django.setup()

from core.models.course import Course

print("Available Courses:")
print("-" * 80)
for course in Course.objects.filter(is_active=True).order_by('code'):
    print(f"UUID: {course.id}")
    print(f"Code: {course.code}")
    print(f"Name: {course.name}")
    print("-" * 80)
