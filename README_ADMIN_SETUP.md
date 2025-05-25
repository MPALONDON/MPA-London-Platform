# Admin User Management & System Setup Guide

## Overview

The Music Performance Academy application uses a secure, database-driven admin authentication system with comprehensive feature integration including Music AI processing, Google Drive storage, and advanced email communications.

## Key Security Improvements

### 1. **Database-Only Authentication**
- **Before**: Admin credentials were stored in `.env` file and could create authentication conflicts
- **After**: All authentication is handled through the database with proper bcrypt password hashing

### 2. **Automatic Admin User Creation**
- If no admin users exist in the database, the system automatically creates a default admin account
- This account requires password setup through email verification for security

### 3. **Secure Password Management**
- Admin accounts are created without passwords initially
- Password setup requires email verification through a secure token
- All passwords are hashed using bcrypt for security
- Self-service password reset available

## First-Time Admin Setup

### Option 1: Automatic Creation (Recommended)
1. Start the application normally with `python app.py`
2. If no admin users exist, the system will:
   - Create a default admin account with email from `ADMIN_EMAIL` environment variable (defaults to `admin@mpalondon.co.uk`)
   - Generate a secure verification token
   - Display a verification URL in the console

3. Look for output like:
   ```
   Default admin account created with email: admin@mpalondon.co.uk
   Visit /verify-email/{TOKEN} to set up the admin password
   IMPORTANT: Save this verification URL - you'll need it to access your admin account!
   ```

4. Visit the verification URL to set your admin password

### Option 2: Manual Creation Script
Use the `create_admin.py` script for manual admin user creation:

```bash
python create_admin.py
```

The script will:
- Check for existing admin users
- Allow you to create additional admin accounts
- Send verification emails automatically
- Provide recovery options if needed

## Complete Environment Variables Setup

Create a `.env` file in your project root with the following variables:

### Required Database Configuration
```env
# MySQL Database Settings
DB_HOST=localhost
DB_USER=your_database_user
DB_PASSWORD=your_database_password
DB_NAME=mpa_london
DB_PORT=3306

# Security
SECRET_KEY=your-very-secure-secret-key-here
```

### Required Email Configuration
```env
# SMTP Email Settings (Required for user verification)
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_USE_TLS=True
MAIL_USERNAME=your-email@gmail.com
MAIL_PASSWORD=your-app-specific-password

# Admin Settings
ADMIN_EMAIL=admin@mpalondon.co.uk
```

### Optional Advanced Features

#### Music AI Integration
```env
# Music AI Platform (formerly Moises)
MUSIC_AI_API_KEY=your-music-ai-api-key
```

**Setup Instructions:**
1. Sign up at [Music AI Platform](https://www.music.ai/)
2. Get API key from your dashboard
3. Add to `.env` file
4. Features enabled:
   - Stem separation (vocals, drums, bass, piano, guitar)
   - Song structure analysis
   - Audio enhancement (coming soon)

#### Google Drive Integration
```env
# Google Drive API
GOOGLE_DRIVE_FOLDER_ID=your-google-drive-folder-id
```

**Setup Instructions:**
1. Create Google Cloud Project
2. Enable Google Drive API
3. Create service account credentials
4. Download `credentials.json` to project root
5. Create a Google Drive folder and get its ID
6. Share folder with service account email

#### Additional Optional Settings
```env
# Flask Session Configuration
SESSION_TYPE=filesystem
SESSION_PERMANENT=False
SESSION_USE_SIGNER=True

# File Upload Settings
MAX_CONTENT_LENGTH=16777216  # 16MB max file size
UPLOAD_FOLDER=static/uploads

# Logging
LOG_LEVEL=INFO
LOG_FILE=app.log
```

## Feature-Specific Setup

### 1. Music AI Platform Integration

**Prerequisites:**
- Music AI platform account
- Valid API key
- Audio files for processing

**Configuration:**
1. Add `MUSIC_AI_API_KEY` to `.env`
2. Restart application
3. Access Music AI features in admin dashboard
4. Upload audio files and start processing jobs

**Available Workflows:**
- **Stem Separation**: Isolate vocals, drums, bass, piano, guitar
- **Song Analysis**: Analyze song structure and sections
- **Audio Enhancement**: Coming soon

### 2. Google Drive File Storage

**Prerequisites:**
- Google Cloud Project with Drive API enabled
- Service account with JSON credentials
- Google Drive folder for file storage

**Setup Process:**
1. **Create Google Cloud Project**
   ```bash
   # Visit: https://console.cloud.google.com/
   # Create new project or select existing
   ```

2. **Enable Drive API**
   ```bash
   # In Google Cloud Console:
   # APIs & Services > Library > Google Drive API > Enable
   ```

3. **Create Service Account**
   ```bash
   # IAM & Admin > Service Accounts > Create Service Account
   # Download JSON credentials file
   # Rename to 'credentials.json' and place in project root
   ```

4. **Setup Drive Folder**
   ```bash
   # Create folder in Google Drive
   # Share with service account email (from credentials.json)
   # Copy folder ID from URL and add to .env
   ```

### 3. Email Service Configuration

**Gmail Setup (Recommended):**
1. Enable 2-Factor Authentication on Gmail account
2. Generate App-Specific Password
3. Use app password in `MAIL_PASSWORD`

**Alternative SMTP Providers:**
- **SendGrid**: Professional email service
- **Mailgun**: Developer-friendly email API
- **Amazon SES**: AWS email service

### 4. Database SSL Configuration

For production environments with SSL-enabled databases:

```env
# SSL Database Connection
DB_SSL_CA=/path/to/ca-cert.pem
DB_SSL_CERT=/path/to/client-cert.pem
DB_SSL_KEY=/path/to/client-key.pem
```

## User Role Management

### Admin Capabilities
- **Full System Access**: All features and settings
- **User Management**: Create, edit, delete users
- **Music AI Features**: Upload files, process audio
- **System Configuration**: Prices, terms, rooms, instruments
- **Analytics**: Attendance reports, user statistics
- **Newsletter Management**: Send campaigns, manage subscribers

### Staff Capabilities
- **Student Management**: View and edit student accounts
- **Session Scheduling**: Create and manage lessons/classes
- **Attendance Tracking**: Record and view attendance
- **Material Management**: Upload and allocate materials
- **Music AI Features**: Process audio files
- **Group Management**: Create and manage student groups

### Student Capabilities
- **Personal Dashboard**: View schedule and materials
- **Settings Management**: Update personal information
- **Material Access**: Download allocated materials
- **Attendance View**: See attendance history

## Security Best Practices

### 1. **Password Security**
- All passwords hashed with bcrypt
- Minimum password requirements enforced
- Password reset via email verification
- Account lockout after failed attempts

### 2. **Email Verification**
- New accounts require email verification
- Secure token generation with expiration
- Password reset requires email confirmation

### 3. **Session Management**
- Secure session cookies
- Session timeout configuration
- CSRF protection enabled

### 4. **Database Security**
- SSL connections for production
- Prepared statements prevent SQL injection
- Regular backup procedures

## Troubleshooting

### Admin Access Issues

**No Admin Users Available:**
```bash
# Use the admin creation script
python create_admin.py

# Or check application logs for auto-generated verification URLs
tail -f app.log
```

**Email Verification Not Working:**
1. Check SMTP configuration in `.env`
2. Verify email credentials
3. Check spam/junk folders
4. Test email sending:
   ```bash
   python -c "
   from app import send_verification_email
   send_verification_email('test@example.com', 'test-token')
   "
   ```

### Music AI Integration Issues

**API Key Problems:**
1. Verify API key is correct in `.env`
2. Check Music AI platform account status
3. Ensure sufficient API credits
4. Test connection:
   ```bash
   curl -H "Authorization: Bearer YOUR_API_KEY" https://api.music.ai/v1/workflows
   ```

**File Upload Failures:**
1. Check file size limits (100MB max)
2. Verify supported formats: MP3, WAV, FLAC, M4A
3. Check disk space availability
4. Review application logs for errors

### Google Drive Integration Issues

**Authentication Errors:**
1. Verify `credentials.json` file exists
2. Check service account permissions
3. Ensure Drive folder is shared with service account
4. Test API access:
   ```bash
   python -c "
   from drive_config import get_google_drive_service
   service = get_google_drive_service()
   print('Drive API connected successfully')
   "
   ```

### Database Connection Issues

**Connection Failures:**
1. Verify database server is running
2. Check connection parameters in `.env`
3. Test database connectivity:
   ```bash
   mysql -h localhost -u your_user -p your_database
   ```

**SSL Connection Problems:**
1. Verify SSL certificates are valid
2. Check certificate file paths
3. Ensure database server supports SSL

## Maintenance & Monitoring

### Regular Tasks

**Daily:**
- Monitor application logs
- Check email delivery status
- Review Music AI job status

**Weekly:**
- Database backup verification
- User account review
- System performance check

**Monthly:**
- Update dependencies
- Security audit
- Backup cleanup

### Monitoring Commands

```bash
# Check application status
ps aux | grep python

# Monitor logs
tail -f app.log

# Database status
mysql -e "SHOW PROCESSLIST;"

# Disk usage
df -h

# Memory usage
free -m
```

### Backup Procedures

**Database Backup:**
```bash
mysqldump -u user -p mpa_london > backup_$(date +%Y%m%d).sql
```

**File Backup:**
```bash
tar -czf files_backup_$(date +%Y%m%d).tar.gz static/uploads/
```

**Configuration Backup:**
```bash
cp .env .env.backup.$(date +%Y%m%d)
```

## Support & Documentation

### Getting Help

1. **Check Application Logs**: Most issues are logged with detailed error messages
2. **Verify Configuration**: Ensure all required environment variables are set
3. **Test Components**: Use provided test commands for individual features
4. **Review Documentation**: Check this guide and main README.md

### Common Solutions

**"Database connection failed"**
- Check MySQL service status
- Verify credentials in `.env`
- Test network connectivity

**"Email sending failed"**
- Verify SMTP settings
- Check email provider requirements
- Test with simple email client

**"Music AI API error"**
- Verify API key validity
- Check account credits/limits
- Review API documentation

### Development vs Production

**Development Environment:**
- Use local MySQL instance
- Gmail SMTP for testing
- Local file storage
- Debug mode enabled

**Production Environment:**
- Managed database service
- Professional email service
- Cloud file storage
- SSL certificates
- Monitoring and logging
- Regular backups

---

The new system provides enterprise-level security, comprehensive feature integration, and scalable architecture for Music Performance Academy London's growing needs. 