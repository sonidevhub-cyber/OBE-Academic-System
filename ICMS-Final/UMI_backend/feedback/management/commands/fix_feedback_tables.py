from django.core.management.base import BaseCommand
from django.db import connection

class Command(BaseCommand):
    help = 'Fix feedback tables'

    def handle(self, *args, **options):
        with connection.cursor() as cursor:
            # Drop existing tables if they exist
            cursor.execute("DROP TABLE IF EXISTS feedback_feedbacknotification CASCADE;")
            cursor.execute("DROP TABLE IF EXISTS feedback_feedback CASCADE;")
            
            # Create feedback table
            cursor.execute("""
                CREATE TABLE feedback_feedback (
                    id SERIAL PRIMARY KEY,
                    feedback_type VARCHAR(20) DEFAULT 'general',
                    title VARCHAR(200) NOT NULL,
                    message TEXT NOT NULL,
                    rating INTEGER DEFAULT 3,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    is_reviewed BOOLEAN DEFAULT FALSE,
                    semester VARCHAR(50),
                    subject_area VARCHAR(100),
                    department_id INTEGER
                );
            """)
            
            # Create notification table
            cursor.execute("""
                CREATE TABLE feedback_feedbacknotification (
                    id SERIAL PRIMARY KEY,
                    message VARCHAR(255) NOT NULL,
                    is_read BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    feedback_id INTEGER,
                    hod_id INTEGER
                );
            """)
            
        self.stdout.write(self.style.SUCCESS('Successfully created feedback tables'))