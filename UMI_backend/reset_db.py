import os
import django
from django.db import connection

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'UMI_backend.settings')
django.setup()

def reset_db():
    with connection.cursor() as cursor:
        print("Dropping public schema...")
        cursor.execute("DROP SCHEMA public CASCADE")
        print("Creating public schema...")
        cursor.execute("CREATE SCHEMA public")
        cursor.execute("GRANT ALL ON SCHEMA public TO public")
        cursor.execute("GRANT ALL ON SCHEMA public TO postgres")
        print("Done.")

if __name__ == "__main__":
    reset_db()
