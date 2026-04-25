# ICMS Project Setup Guide

This project has two parts:

- `UMI_backend` - Django + DRF backend
- `Frontend` - React frontend

Use this guide when setting up the project on a new machine after cloning from Git.

## 1. Clone the repository

```bash
git clone <your-repo-url>
cd ICMS-Final
```

## 2. Backend prerequisites

Make sure these are installed:

- Python 3.13.x
- PostgreSQL
- `pip`

## 3. Create the backend virtual environment

From the project root:

```bash
python -m venv .venv
```

Activate it:

Windows PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
```

Windows CMD:

```cmd
.\.venv\Scripts\activate.bat
```

## 4. Install backend dependencies

If your repo includes a backend requirements file, install from it:

```bash
pip install -r requirements.txt
```

If `requirements.txt` is not committed yet, the team should export it from the working machine and commit it. Without that file, another machine may fail because required Django packages are missing.

At minimum, the backend currently depends on packages such as:

- Django
- djangorestframework
- django-cors-headers
- django-extensions
- python-dotenv
- psycopg / psycopg2 for PostgreSQL

## 5. Create the PostgreSQL database

The backend is currently configured in [settings.py](./UMI_backend/UMI_backend/settings.py) to use:

- Database: `icms_db`
- User: `icms_user`
- Password: `admin.123`
- Host: `localhost`
- Port: `5432`

Create that database and user in PostgreSQL, or update `settings.py` / `.env` to match your machine.

Example SQL:

```sql
CREATE DATABASE icms_db;
CREATE USER icms_user WITH PASSWORD 'admin.123';
GRANT ALL PRIVILEGES ON DATABASE icms_db TO icms_user;
```

## 6. Run backend migrations

Go to the backend folder:

```bash
cd UMI_backend
```

Then run:

```bash
python manage.py migrate
```

What this now does automatically:

- creates RBAC roles if they do not exist
- creates RBAC permissions if they do not exist
- assigns all active permissions to `SAC`

Seeded RBAC roles:

- `SAC` - Super Admin
- `JSC` - Limited Admin
- `HOD`
- `COORDINATOR`
- `INSTRUCTOR`
- `STUDENT`
- `PRINCIPAL`

## 7. Create the first system user

After migrations, create the first Django superuser:

```bash
python manage.py createsuperuser
```

How it works now:

- Django `superuser` is the bootstrap account
- that user is automatically mapped into RBAC as `SAC`
- `SAC` is the application superadmin
- `JSC` is the limited admin role

This means the system becomes usable after:

1. `migrate`
2. `createsuperuser`
3. login as that first `SAC`
4. create other users through the application

## 8. Optional RBAC repair commands

If needed, you can run:

```bash
python manage.py seed_roles
```

This manually re-runs the RBAC seed safely.

For existing Django superusers created before this RBAC bootstrap was added:

```bash
python manage.py fix_superadmins
```

This normalizes those accounts and ensures they are linked to `SAC`.

## 9. Start the backend

```bash
python manage.py runserver
```

Backend default URL:

```text
http://127.0.0.1:8000/
```

## 10. Frontend prerequisites

Make sure these are installed:

- Node.js
- npm

## 11. Install frontend dependencies

Open a new terminal and go to the frontend folder:

```bash
cd Frontend
npm install
```

## 12. Start the frontend

```bash
npm start
```

Frontend default URL:

```text
http://localhost:3000/
```

## 13. Fresh machine checklist

If a collaborator gets errors after cloning, check these first:

- PostgreSQL is installed and running
- database `icms_db` exists
- database user `icms_user` exists
- backend dependencies are installed
- frontend dependencies are installed
- `python manage.py migrate` has been run
- `python manage.py createsuperuser` has been run
- backend server is running
- frontend server is running

## Password reset OTP setup

To make the forgot-password flow send a real OTP email, create `UMI_backend/.env` with SMTP settings.
If those settings are missing, Django falls back to the console email backend, which prints the message in the terminal instead of delivering it to Gmail.

Recommended setup for Resend SMTP:

```env
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.resend.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_USE_SSL=False
EMAIL_HOST_USER=resend
EMAIL_HOST_PASSWORD=re_your_resend_api_key
DEFAULT_FROM_EMAIL=ICMS <your-verified-sender@yourdomain.com>
RESEND_API_KEY=re_your_resend_api_key
RESEND_FROM_EMAIL=ICMS <your-verified-sender@yourdomain.com>
PASSWORD_RESET_OTP_LENGTH=6
PASSWORD_RESET_OTP_EXPIRE_MINUTES=10
```

Notes:

- Resend uses `resend` as the SMTP username and your Resend API key as the password.
- Make sure `RESEND_FROM_EMAIL` is a sender address from a verified Resend domain.
- The frontend sends the email to the backend, and the backend emails a 6-digit OTP.
- The user enters that OTP on the same forgot-password form, then chooses a new password.

If you prefer Gmail SMTP, keep the same structure but swap the host and credentials:

```env
EMAIL_HOST=smtp.gmail.com
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-gmail-app-password
DEFAULT_FROM_EMAIL=ICMS <your-email@gmail.com>
```

For Gmail, use a Google App Password, not your normal Gmail login password.

## 14. Recommended team improvement

To make onboarding reliable, commit a backend `requirements.txt` file to Git. Otherwise new collaborators may clone the project successfully but still fail to run it because Python dependencies are not documented in a machine-readable way.
