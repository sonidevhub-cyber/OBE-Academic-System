import os
import django
from django.db import connection

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'UMI_backend.settings')
django.setup()

def check_table():
    with connection.cursor() as cursor:
        tables = ['authtoken_token', 'core_customuser', 'academics_attendance', 'students_student']
        for table in tables:
            print(f"\n--- {table} ---")
            cursor.execute(f"SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '{table}'")
            rows = cursor.fetchall()
            for row in rows:
                print(f"Column: {row[0]}, Type: {row[1]}")

if __name__ == "__main__":
    check_table()
