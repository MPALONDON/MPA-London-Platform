# MPA London Platform - Deployment Guide

## Quick Deployment Steps

### 1. Upload Files to PythonAnywhere
- Upload all project files to `/home/MPALONDON/MPA-London-Platform/`
- Ensure `.env` file is included with correct database credentials

### 2. Set Up Virtual Environment
```bash
python3.13 -m venv /home/MPALONDON/.virtualenvs/MPA-venv
source /home/MPALONDON/.virtualenvs/MPA-venv/bin/activate
cd /home/MPALONDON/MPA-London-Platform
pip install -r requirements.txt
```

### 3. Configure Web App
- **Python version:** 3.13
- **Source code:** `/home/MPALONDON/MPA-London-Platform/`
- **Working directory:** `/home/MPALONDON/MPA-London-Platform/`
- **WSGI configuration file:** `/var/www/mpalondon_pythonanywhere_com_wsgi.py`
- **Virtualenv:** `/home/MPALONDON/.virtualenvs/MPA-venv`

### 4. Use the Proper WSGI File
The `wsgi.py` file in this project loads environment variables BEFORE importing the app:

```python
import sys
import os

# Add project directory to path
project_home = '/home/MPALONDON/MPA-London-Platform'
if project_home not in sys.path:
    sys.path = [project_home] + sys.path

# Load environment variables BEFORE importing the app
from dotenv import load_dotenv
load_dotenv(os.path.join(project_home, '.env'))

# Now import the app safely
from app import app as application
```

### 5. Initialize Database
After deployment, visit: `yourdomain.pythonanywhere.com/admin/setup`

This will:
- Create all database tables
- Initialize default instruments and rooms
- Create admin user
- Run any necessary migrations

### 6. Environment Variables (.env file)
```env
# Database Configuration
DB_USERNAME=MPALONDON
DB_PASSWORD=your_mysql_password
DB_HOST=MPALONDON.mysql.pythonanywhere-services.com
DB_NAME=MPALONDON$MPALONDON

# Flask configuration
SECRET_KEY=your_secret_key

# Email configuration
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_USE_TLS=True
MAIL_USERNAME=your_email@domain.com
MAIL_PASSWORD=your_app_password

# API Keys
MUSIC_AI_API_KEY=your_music_ai_key
STRIPE_SECRET_KEY=your_stripe_secret
STRIPE_PUBLIC_KEY=your_stripe_public
```

## Key Architecture Decisions

### ✅ What We Fixed
1. **Environment Loading:** WSGI file loads `.env` before importing app
2. **No Module-Level DB Calls:** All database initialization moved to `/admin/setup` route
3. **Proper Error Handling:** Setup route provides clear feedback
4. **Version Compatibility:** Updated SQLAlchemy for Python 3.13 compatibility

### ❌ What NOT to Do
1. **Don't** put database calls at module level (outside functions/routes)
2. **Don't** import the app before loading environment variables
3. **Don't** rely on automatic initialization during app startup
4. **Don't** use incompatible package versions

## Troubleshooting

### "Can't connect to MySQL server on 'None'"
- Environment variables not loaded
- Check WSGI file loads `.env` before importing app
- Verify `.env` file exists and has correct database credentials

### "Table doesn't exist"
- Database not initialized
- Visit `/admin/setup` to create tables

### Import/Module Errors
- Check virtual environment is activated
- Verify all packages in `requirements.txt` are installed
- Check Python version compatibility

## Future Updates

When pushing updates to GitHub:
1. The WSGI file and setup route handle initialization properly
2. No need to comment out code manually
3. Just run `/admin/setup` after deployment if database changes are needed

This architecture ensures smooth deployments every time! 🚀 