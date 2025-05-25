# Music Performance Academy (MPA London) - Management Platform

A comprehensive web-based management platform for Music Performance Academy London, featuring advanced audio processing, student management, session scheduling, and administrative tools.

## 🎵 Key Features

### Core Management
- **User Authentication & Authorization** - Role-based access (Admin, Staff, Student) with email verification
- **Student & Staff Management** - Complete user lifecycle with secure password management
- **Session Scheduling** - Advanced calendar system with room booking and recurring sessions
- **Materials Management** - File uploads, YouTube/Spotify links with allocation system
- **Attendance Tracking** - Comprehensive attendance recording with analytics
- **Group Management** - Create and manage student groups with material allocation

### Advanced Features
- **Music AI Integration** - Professional audio processing using Music AI platform (formerly Moises)
  - Stem separation (vocals, drums, bass, piano, guitar)
  - Song structure analysis
  - Audio enhancement (coming soon)
- **Room & Resource Management** - Multi-room booking system with availability checking
- **Term Management** - Academic term planning with break periods
- **Event Management** - Public events with image uploads and pricing
- **Feedback System** - Student feedback collection and management
- **Newsletter System** - Subscriber management with email campaigns
- **Price Management** - Dynamic pricing for different services
- **Jam Nights** - Weekly jam session scheduling
- **Google Drive Integration** - Secure file storage and management

### Security & Communication
- **Bcrypt Password Hashing** - Industry-standard password security
- **Email Verification** - Secure account activation and password reset
- **SMTP Integration** - Automated email notifications
- **SSL/TLS Support** - Secure database connections
- **Session Management** - Secure user sessions with Flask-Login

## 🗄️ Database Architecture

The application uses **MySQL** with the following tables:

### Core Tables
- **users** - User accounts with roles and verification status
- **instruments** - Musical instruments (Guitar, Bass, Drums, Piano, Vocals)
- **sessions** - Lesson/class scheduling with room and instructor assignment
- **materials** - Learning materials with file uploads and links
- **attendances** - Student attendance tracking with status and notes

### Management Tables
- **groups** - Student groups for band classes
- **group_members** - Group membership management
- **rooms** - Practice rooms and teaching spaces
- **terms** - Academic terms with start/end dates and breaks
- **events** - Public events and performances

### Advanced Features
- **material_allocations** - Individual student material assignments
- **group_material_allocations** - Group-based material distribution
- **music_ai_files** - Uploaded audio files for AI processing
- **music_ai_jobs** - Audio processing job tracking
- **feedbacks** - Student feedback collection
- **subscribers** - Newsletter subscription management
- **prices** - Dynamic pricing for services
- **jam_nights** - Weekly jam session scheduling
- **luthier_prices** - Guitar repair and setup pricing

## 🚀 Setup & Installation

### Prerequisites
- Python 3.8+
- MySQL 5.7+ or MariaDB 10.3+
- SMTP email service (Gmail, SendGrid, etc.)
- Google Drive API credentials (optional)
- Music AI API key (optional)

### 1. Clone Repository
```bash
git clone <repository-url>
cd mpa-london-platform
```

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

### 3. Environment Configuration
Create a `.env` file with the following variables:

```env
# Database Configuration
DB_HOST=localhost
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=mpa_london
DB_PORT=3306

# Security
SECRET_KEY=your-secret-key-here

# Email Configuration
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_USE_TLS=True
MAIL_USERNAME=your-email@gmail.com
MAIL_PASSWORD=your-app-password

# Admin Configuration
ADMIN_EMAIL=admin@mpalondon.co.uk

# Optional: Music AI Integration
MUSIC_AI_API_KEY=your-music-ai-api-key

# Optional: Google Drive Integration
GOOGLE_DRIVE_FOLDER_ID=your-drive-folder-id
```

### 4. Database Setup
```bash
# Initialize database
python app.py
# The application will automatically create tables and default data
```

### 5. Admin Account Setup
On first run, the system will create a default admin account:
- Check console output for verification URL
- Visit the URL to set admin password
- Or use: `python create_admin.py` for manual setup

### 6. Run Application
```bash
python app.py
```
Access at `http://localhost:5000`

## 🎛️ API Endpoints

### Authentication
- `POST /signin` - User login
- `POST /signout` - User logout
- `POST /verify-email/<token>` - Email verification
- `POST /forgot-password` - Password reset

### Session Management
- `GET /api/sessions` - List sessions
- `POST /api/sessions` - Create session
- `PUT /api/sessions/<id>` - Update session
- `DELETE /api/sessions/<id>` - Delete session
- `GET /api/available-slots` - Check availability

### Materials & Resources
- `GET /api/materials` - List materials
- `POST /api/materials` - Upload material
- `POST /api/materials/upload` - File upload
- `GET /api/allocations` - Material allocations

### User Management
- `GET /api/users` - List users (admin only)
- `POST /api/users` - Create user
- `PUT /api/users/<id>` - Update user
- `DELETE /api/users/<id>` - Delete user

### Groups & Classes
- `GET /api/groups` - List groups
- `POST /api/groups` - Create group
- `GET /api/groups/<id>/members` - Group members
- `POST /api/groups/<id>/materials` - Allocate materials

### Attendance
- `GET /api/sessions/<id>/attendance` - Session attendance
- `POST /api/sessions/<id>/attendance` - Record attendance
- `GET /api/attendance` - Attendance analytics

### Music AI (Admin/Staff only)
- `POST /api/music-ai/upload` - Upload audio files
- `POST /api/music-ai/stem-separation` - Start stem separation
- `POST /api/music-ai/transcription` - Analyze song structure
- `GET /api/music-ai/jobs` - List processing jobs
- `GET /api/music-ai/results` - Download results

### Administrative
- `GET /api/rooms` - Room management
- `GET /api/terms` - Term management
- `GET /api/instruments` - Instrument management
- `GET /api/prices` - Price management
- `POST /api/newsletter/subscribe` - Newsletter signup

## 🏗️ Project Structure

```
mpa-london-platform/
├── app.py                      # Main Flask application
├── config.py                   # Configuration settings
├── drive_config.py             # Google Drive integration
├── create_admin.py             # Admin user creation script
├── requirements.txt            # Python dependencies
├── .env                        # Environment variables (create this)
├── migrations/                 # Database migrations
├── static/                     # Static assets
│   ├── css/
│   │   └── style.css          # Main stylesheet
│   ├── js/
│   │   └── main.js            # JavaScript functionality
│   └── uploads/               # File uploads
├── templates/                  # HTML templates
│   ├── base.html              # Base template
│   ├── dashboard.html         # Main dashboard
│   ├── index.html             # Public homepage
│   └── ...                    # Other templates
├── data/                       # Data files
├── backup/                     # Database backups
└── flask_session/             # Session storage
```

## 🎯 User Roles & Permissions

### Admin
- Full system access
- User management
- System configuration
- Music AI features
- Analytics and reporting

### Staff
- Student management
- Session scheduling
- Attendance tracking
- Material management
- Music AI features

### Student
- View own schedule
- Access allocated materials
- Update personal settings
- View attendance records

## 🔧 Advanced Configuration

### Music AI Integration
1. Sign up for Music AI platform account
2. Get API key from dashboard
3. Add `MUSIC_AI_API_KEY` to `.env`
4. Features available:
   - Vocal isolation
   - Instrument separation
   - Song structure analysis

### Google Drive Integration
1. Create Google Cloud project
2. Enable Drive API
3. Download credentials JSON
4. Add folder ID to `.env`
5. Automatic file backup enabled

### Email Configuration
Supports multiple SMTP providers:
- Gmail (recommended)
- SendGrid
- Mailgun
- Custom SMTP servers

### Database Optimization
- Regular backups recommended
- Index optimization for large datasets
- SSL connections for production

## 🚀 Deployment

### Production Checklist
- [ ] Set strong `SECRET_KEY`
- [ ] Configure production database
- [ ] Set up SSL certificates
- [ ] Configure email service
- [ ] Set up file storage
- [ ] Enable logging
- [ ] Configure backup strategy

### Recommended Stack
- **Web Server**: Nginx + Gunicorn
- **Database**: MySQL 8.0+ or MariaDB 10.5+
- **SSL**: Let's Encrypt
- **Monitoring**: Application logs + database monitoring

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📝 License

This project is proprietary software for Music Performance Academy London.

## 🆘 Support

For technical support:
1. Check application logs
2. Verify environment configuration
3. Test database connectivity
4. Review email service status

For feature requests or bug reports, please contact the development team.

---

**Music Performance Academy London** - Empowering musical education through technology 