from flask import Flask, render_template, request, redirect, url_for, flash, session, jsonify, make_response, abort
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import json
import os
from datetime import datetime, timedelta
import pytz
from werkzeug.utils import secure_filename
import pymysql
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
import bcrypt  # Add bcrypt for password hashing
import secrets  # Add secrets for secure token generation
from flask_login import LoginManager, UserMixin, login_user, login_required, current_user, logout_user
from functools import wraps
from sqlalchemy import func
from flask_mail import Message, Mail
from dotenv import load_dotenv
from config import MUSIC_AI_API_KEY
from drive_config import get_google_drive_service, upload_file, create_folder, delete_file
import traceback
from googleapiclient.http import MediaFileUpload
import requests
from musicai_sdk import MusicAiClient
import tempfile
import uuid
import re
from urllib.parse import urlparse
from markupsafe import Markup



# Load environment variables
load_dotenv()

# Debug environment variables
print("Environment Variables:")
print(f"MAIL_USERNAME: {os.getenv('MAIL_USERNAME')}")
print(f"MAIL_PASSWORD: {os.getenv('MAIL_PASSWORD')}")
print(f"SECRET_KEY: {os.getenv('SECRET_KEY')}")
print(f"DB_USERNAME: {os.getenv('DB_USERNAME')}")
print(f"DB_PASSWORD: {os.getenv('DB_PASSWORD')}")
print(f"DB_NAME: {os.getenv('DB_NAME')}")

# Initialize extensions
db = SQLAlchemy()
migrate = Migrate()
login_manager = LoginManager()
mail = Mail()

# Create the Flask app
app = Flask(__name__)
app.secret_key = os.getenv('SECRET_KEY')  # Get secret key from environment variable
app.debug = True  # Enable debug mode
app.config['TEMPLATES_AUTO_RELOAD'] = True  # Auto-reload templates

# MySQL Database configuration
db_config = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'user': os.getenv('DB_USERNAME'),
    'password': os.getenv('DB_PASSWORD'),
    'database': os.getenv('DB_NAME'),
    'ssl_ca': os.getenv('DB_SSL_CA'),
    'ssl_verify_cert': os.getenv('DB_SSL_VERIFY', 'true').lower() == 'true'
}

# Construct the URI
app.config['SQLALCHEMY_DATABASE_URI'] = (
    f"mysql+pymysql://{db_config['user']}:{db_config['password']}"
    f"@{db_config['host']}/{db_config['database']}"
    f"{'?ssl_ca=' + db_config['ssl_ca'] if db_config['ssl_ca'] else ''}"
    f"{'&ssl_verify_cert=' + str(db_config['ssl_verify_cert']).lower() if db_config['ssl_ca'] else ''}"
)
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Email configuration
app.config['MAIL_SERVER'] = os.getenv('MAIL_SERVER')
app.config['MAIL_PORT'] = int(os.getenv('MAIL_PORT', 587))
app.config['MAIL_USE_TLS'] = os.getenv('MAIL_USE_TLS', 'True') == 'True'
app.config['MAIL_USERNAME'] = os.getenv('MAIL_USERNAME')
app.config['MAIL_PASSWORD'] = os.getenv('MAIL_PASSWORD')
app.config['MAIL_DEFAULT_SENDER'] = os.getenv('MAIL_USERNAME')

# Initialize extensions with app
db.init_app(app)
migrate.init_app(app, db)
login_manager.init_app(app)
login_manager.login_view = 'signin'
mail.init_app(app)

# Application factory pattern not used - app is created directly above

@login_manager.user_loader
def load_user(user_id):
    return db.session.get(User, int(user_id))

# Admin credentials
MPA_LONDON_EMAIL = os.getenv('MAIL_USERNAME')


# Payment processing is now handled manually outside the website

# Models
class Instrument(db.Model):
    __tablename__ = 'instruments'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False, unique=True)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(pytz.timezone('Europe/London')))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(pytz.timezone('Europe/London')), onupdate=lambda: datetime.now(pytz.timezone('Europe/London')))
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'is_active': self.is_active,
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M:%S') if self.created_at else None,
            'updated_at': self.updated_at.strftime('%Y-%m-%d %H:%M:%S') if self.updated_at else None
        }

class User(db.Model, UserMixin):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password = db.Column(db.String(120), nullable=True)  # Allow null for unverified users
    email = db.Column(db.String(120), unique=True, nullable=False)
    role = db.Column(db.String(20), nullable=False)
    verification_token = db.Column(db.String(100), unique=True, nullable=True)
    is_verified = db.Column(db.Boolean, default=False)
    instrument_id = db.Column(db.Integer, db.ForeignKey('instruments.id'), nullable=True)
    
    # Relationships with cascade deletion
    materials = db.relationship('Material', backref='owner', lazy=True, cascade="all, delete-orphan")
    sessions = db.relationship('Session', backref='user', lazy=True, cascade="all, delete-orphan")
    allocated_materials = db.relationship('MaterialAllocation', backref='student', lazy=True, cascade="all, delete-orphan")
    instrument = db.relationship('Instrument', backref='users')
    
    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'role': self.role,
            'is_verified': self.is_verified,
            'instrument_id': self.instrument_id,
            'instrument': self.instrument.name if self.instrument else None
        }
    
    def check_password(self, password):
        if not self.password:
            return False
        return bcrypt.checkpw(password.encode('utf-8'), self.password.encode('utf-8'))
    
    def set_password(self, password):
        if password:
            self.password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            self.is_verified = True

class Material(db.Model):
    __tablename__ = 'materials'
    
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100), nullable=False)
    type = db.Column(db.String(20), nullable=False)  # 'file' or 'link'
    url = db.Column(db.String(500), nullable=False)
    description = db.Column(db.Text)
    category = db.Column(db.String(50))
    instrument_id = db.Column(db.Integer, db.ForeignKey('instruments.id'))
    date_added = db.Column(db.DateTime, default=lambda: datetime.now(pytz.timezone('Europe/London')))
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    
    # Relationships
    allocations = db.relationship('MaterialAllocation', backref='material', lazy=True)
    instrument = db.relationship('Instrument', backref='materials')
    
    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'type': self.type,
            'url': self.url,
            'description': self.description,
            'category': self.category,
            'instrument_id': self.instrument_id,
            'instrument': self.instrument.name if self.instrument else None,
            'date_added': self.date_added.strftime('%Y-%m-%d %H:%M:%S') if self.date_added else None,
            'user_id': self.user_id
        }

class Attendance(db.Model):
    __tablename__ = 'attendances'
    
    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.Integer, db.ForeignKey('sessions.id'), nullable=False)
    student_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    status = db.Column(db.String(20), nullable=False)  # 'present', 'absent', 'late', 'excused'
    notes = db.Column(db.Text)
    recorded_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    recorded_at = db.Column(db.DateTime, default=lambda: datetime.now(pytz.timezone('Europe/London')))
    invoiced = db.Column(db.Boolean, default=False)  # Add invoiced field
    
    # Relationships
    student = db.relationship('User', foreign_keys=[student_id], backref='attendances')
    recorder = db.relationship('User', foreign_keys=[recorded_by], backref='recorded_attendances')
    
    def to_dict(self):
        return {
            'id': self.id,
            'session_id': self.session_id,
            'student_id': self.student_id,
            'status': self.status,
            'notes': self.notes,
            'recorded_by': self.recorded_by,
            'recorded_at': self.recorded_at.isoformat() if self.recorded_at else None,
            'student': self.student.to_dict() if self.student else None,
            'recorder': self.recorder.to_dict() if self.recorder else None,
            'invoiced': self.invoiced
        }

class Session(db.Model):
    __tablename__ = 'sessions'
    
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100), nullable=False)
    date = db.Column(db.String(20), nullable=False)
    time = db.Column(db.String(20), nullable=False)
    duration = db.Column(db.Integer, nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    group_id = db.Column(db.Integer, db.ForeignKey('groups.id'), nullable=True)
    room_id = db.Column(db.Integer, db.ForeignKey('rooms.id'), nullable=True)
    instrument_id = db.Column(db.Integer, db.ForeignKey('instruments.id'), nullable=True)
    is_recurring = db.Column(db.Boolean, default=False)
    recurrence_type = db.Column(db.String(20))
    recurrence_end_date = db.Column(db.String(20))
    parent_session_id = db.Column(db.Integer, db.ForeignKey('sessions.id'), nullable=True)
    
    # Add relationship to Room
    room = db.relationship('Room', backref='sessions')
    # Add relationship to Attendance using string reference
        # Add relationship to Attendance
    attendances = db.relationship('Attendance', backref='session', lazy=True, cascade="all, delete-orphan")
    instrument = db.relationship('Instrument', backref='sessions')
    
    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'date': self.date,
            'time': self.time,
            'duration': self.duration,
            'user_id': self.user_id,
            'group_id': self.group_id,
            'room_id': self.room_id,
            'room_name': self.room.name if self.room else None,
            'instrument_id': self.instrument_id,
            'instrument': self.instrument.name if self.instrument else None,
            'is_recurring': self.is_recurring,
            'recurrence_type': self.recurrence_type,
            'recurrence_end_date': self.recurrence_end_date,
            'parent_session_id': self.parent_session_id,
            'notes': getattr(self, 'notes', None)
        }

class MaterialAllocation(db.Model):
    __tablename__ = 'material_allocations'
    
    id = db.Column(db.Integer, primary_key=True)
    material_id = db.Column(db.Integer, db.ForeignKey('materials.id'), nullable=False)
    student_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    date_allocated = db.Column(db.DateTime, default=lambda: datetime.now(pytz.timezone('Europe/London')))
    
    def to_dict(self):
        return {
            'id': self.id,
            'material_id': self.material_id,
            'student_id': self.student_id,
            'date_allocated': self.date_allocated.strftime('%Y-%m-%d %H:%M:%S')
        }

class Group(db.Model):
    __tablename__ = 'groups'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(pytz.timezone('Europe/London')))
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    
    # Relationships
    members = db.relationship('GroupMember', backref='group', lazy=True, cascade="all, delete-orphan")
    material_allocations = db.relationship('GroupMaterialAllocation', backref='group', lazy=True, cascade="all, delete-orphan")
    sessions = db.relationship('Session', backref='group', lazy=True, cascade="all, delete-orphan")
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M:%S'),
            'created_by': self.created_by,
            'member_count': len(self.members),
            'material_count': len(self.material_allocations)
        }

class GroupMember(db.Model):
    __tablename__ = 'group_members'
    
    id = db.Column(db.Integer, primary_key=True)
    group_id = db.Column(db.Integer, db.ForeignKey('groups.id'), nullable=False)
    student_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    date_added = db.Column(db.DateTime, default=lambda: datetime.now(pytz.timezone('Europe/London')))
    
    def to_dict(self):
        return {
            'id': self.id,
            'group_id': self.group_id,
            'student_id': self.student_id,
            'date_added': self.date_added.strftime('%Y-%m-%d %H:%M:%S')
        }

class GroupMaterialAllocation(db.Model):
    __tablename__ = 'group_material_allocations'
    
    id = db.Column(db.Integer, primary_key=True)
    group_id = db.Column(db.Integer, db.ForeignKey('groups.id'), nullable=False)
    material_id = db.Column(db.Integer, db.ForeignKey('materials.id'), nullable=False)
    date_allocated = db.Column(db.DateTime, default=lambda: datetime.now(pytz.timezone('Europe/London')))
    
    def to_dict(self):
        return {
            'id': self.id,
            'group_id': self.group_id,
            'material_id': self.material_id,
            'date_allocated': self.date_allocated.isoformat() if self.date_allocated else None
        }

class JamNight(db.Model):
    __tablename__ = 'jam_nights'
    
    id = db.Column(db.Integer, primary_key=True)
    date = db.Column(db.Date, nullable=False)
    time_start = db.Column(db.String(10), nullable=False, default='19:30')
    time_end = db.Column(db.String(10), nullable=False, default='21:30')
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(pytz.timezone('Europe/London')))
    
    def to_dict(self):
        return {
            'id': self.id,
            'date': self.date.strftime('%Y-%m-%d'),
            'time_start': self.time_start,
            'time_end': self.time_end,
            'is_active': self.is_active,
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M:%S')
        }

class Room(db.Model):
    __tablename__ = 'rooms'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    capacity = db.Column(db.Integer, nullable=False, default=6)
    description = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(pytz.timezone('Europe/London')))
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'capacity': self.capacity,
            'description': self.description,
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M:%S')
        }

class Term(db.Model):
    __tablename__ = 'terms'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    start_date = db.Column(db.Date, nullable=False)
    end_date = db.Column(db.Date, nullable=False)
    duration_weeks = db.Column(db.Integer, nullable=False, default=10)  # 10 or 12 weeks
    has_break = db.Column(db.Boolean, default=False)
    break_start_date = db.Column(db.Date, nullable=True)
    break_end_date = db.Column(db.Date, nullable=True)
    display_order = db.Column(db.Integer, default=0)  # New column for ordering
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(pytz.timezone('Europe/London')))
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'start_date': self.start_date.strftime('%Y-%m-%d') if self.start_date else None,
            'end_date': self.end_date.strftime('%Y-%m-%d') if self.end_date else None,
            'duration_weeks': self.duration_weeks,
            'has_break': self.has_break,
            'break_start_date': self.break_start_date.strftime('%Y-%m-%d') if self.break_start_date else None,
            'break_end_date': self.break_end_date.strftime('%Y-%m-%d') if self.break_end_date else None,
            'display_order': self.display_order,
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M:%S') if self.created_at else None
        }

class Subscriber(db.Model):
    __tablename__ = 'subscribers'
    
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    date_subscribed = db.Column(db.DateTime, default=lambda: datetime.now(pytz.timezone('Europe/London')))
    is_active = db.Column(db.Boolean, default=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'email': self.email,
            'date_subscribed': self.date_subscribed.isoformat(),
            'is_active': self.is_active
        }

class Feedback(db.Model):
    __tablename__ = 'feedbacks'
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    group_id = db.Column(db.Integer, db.ForeignKey('groups.id'), nullable=True)
    author_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(pytz.timezone('Europe/London')))

    # Add relationships
    group = db.relationship('Group', backref='feedbacks')
    student = db.relationship('User', foreign_keys=[student_id], backref='received_feedbacks')
    author = db.relationship('User', foreign_keys=[author_id], backref='authored_feedbacks')

    def to_dict(self):
        return {
            'id': self.id,
            'student_id': self.student_id,
            'group_id': self.group_id,
            'author_id': self.author_id,
            'content': self.content,
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M')
        }

class Price(db.Model):
    __tablename__ = 'prices'
    
    id = db.Column(db.Integer, primary_key=True)
    service_type = db.Column(db.String(50), unique=True, nullable=False)  # e.g., 'guitar_lesson', 'band_class'
    pounds = db.Column(db.Integer, nullable=False, default=0)  # Store whole pounds
    pence = db.Column(db.Integer, nullable=True)  # Store pence (optional)
    mobile_service_available = db.Column(db.Boolean, default=False)  # New column for mobile service availability
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(pytz.timezone('Europe/London')))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(pytz.timezone('Europe/London')), onupdate=lambda: datetime.now(pytz.timezone('Europe/London')))

class MusicAiFile(db.Model):
    __tablename__ = 'music_ai_files'
    
    id = db.Column(db.String(36), primary_key=True)  # UUID
    name = db.Column(db.String(255), nullable=False)
    original_filename = db.Column(db.String(255), nullable=False)
    music_ai_url = db.Column(db.Text, nullable=False)  # Use TEXT for long URLs
    file_size = db.Column(db.Integer)
    mime_type = db.Column(db.String(100))
    uploaded_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    uploaded_at = db.Column(db.DateTime, default=lambda: datetime.now(pytz.timezone('Europe/London')))
    
    # Relationships
    uploader = db.relationship('User', backref='music_ai_files')
    jobs = db.relationship('MusicAiJob', backref='source_file', cascade="all, delete-orphan")
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'original_filename': self.original_filename,
            'music_ai_url': self.music_ai_url,
            'file_size': self.file_size,
            'mime_type': self.mime_type,
            'uploaded_by': self.uploaded_by,
            'uploaded_at': self.uploaded_at.isoformat() if self.uploaded_at else None
        }

class MusicAiJob(db.Model):
    __tablename__ = 'music_ai_jobs'
    
    id = db.Column(db.String(36), primary_key=True)  # UUID
    file_id = db.Column(db.String(36), db.ForeignKey('music_ai_files.id'), nullable=False)
    job_type = db.Column(db.String(50), nullable=False)  # 'stem-separation', 'transcription', etc.
    workflow = db.Column(db.String(100), nullable=False)
    status = db.Column(db.String(20), nullable=False, default='processing')
    parameters = db.Column(db.JSON)  # Store job parameters as JSON
    result_urls = db.Column(db.JSON)  # Store download URLs when completed
    error_message = db.Column(db.Text)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(pytz.timezone('Europe/London')))
    completed_at = db.Column(db.DateTime)
    
    # Relationships
    creator = db.relationship('User', backref='music_ai_jobs')
    
    def to_dict(self):
        return {
            'id': self.id,
            'file_id': self.file_id,
            'fileName': self.source_file.name if self.source_file else 'Unknown',
            'job_type': self.job_type,
            'workflow': self.workflow,
            'status': self.status,
            'parameters': self.parameters,
            'result_urls': self.result_urls,
            'error_message': self.error_message,
            'created_by': self.created_by,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None
        }
    
    def to_dict(self):
        amount = self.pounds
        if self.pence is not None:
            amount = float(f"{self.pounds}.{self.pence:02d}")
        return {
            'id': self.id,
            'service_type': self.service_type,
            'pounds': self.pounds,
            'pence': self.pence,
            'amount': amount,
            'mobile_service_available': self.mobile_service_available,
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M:%S'),
            'updated_at': self.updated_at.strftime('%Y-%m-%d %H:%M:%S')
        }

def get_price(service_type):
    """Get the current price for a service type"""
    price = Price.query.filter_by(service_type=service_type).first()
    if not price:
        return 0
    if price.pence is not None:
        return float(f"{price.pounds}.{price.pence:02d}")
    return price.pounds

@app.context_processor
def utility_processor():
    return {
        'get_price': get_price,
        'process_feedback_links': process_feedback_links
    }

@app.route('/admin/prices', methods=['GET', 'POST'])
@login_required
def manage_prices():
    if current_user.role != 'admin':
        abort(403)
    
    if request.method == 'POST':
        service_type = request.form.get('service_type')
        pounds = int(request.form.get('pounds', 0))
        pence = request.form.get('pence')
        
        # Convert pence to integer if provided, otherwise None
        if pence and pence.strip():
            pence = int(pence)
            if pence < 0 or pence > 99:
                flash('Pence must be between 0 and 99', 'error')
                return redirect(url_for('manage_prices'))
        else:
            pence = None
        
        # Check if price already exists
        price = Price.query.filter_by(service_type=service_type).first()
        if price:
            price.pounds = pounds
            price.pence = pence
        else:
            price = Price(service_type=service_type, pounds=pounds, pence=pence)
            db.session.add(price)
        
        db.session.commit()
        flash('Price updated successfully', 'success')
        return redirect(url_for('manage_prices'))
    
    prices = Price.query.all()
    return render_template('admin/prices.html', prices=prices)

@app.route('/api/prices', methods=['GET'])
@login_required
def get_prices():
    if current_user.role != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    prices = Price.query.all()
    return jsonify([price.to_dict() for price in prices])

@app.route('/api/prices/<int:price_id>', methods=['PUT'])
@login_required
def update_price(price_id):
    if current_user.role != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    price = db.session.get(Price, price_id)
    if not price:
        return jsonify({'error': 'Price not found'}), 404
    data = request.get_json()
    
    if 'pounds' in data:
        price.pounds = int(data['pounds'])
    if 'pence' in data:
        pence = data['pence']
        if pence is not None:
            pence = int(pence)
            if pence < 0 or pence > 99:
                return jsonify({'error': 'Pence must be between 0 and 99'}), 400
        price.pence = pence
    
    db.session.commit()
    return jsonify(price.to_dict())

# Utility Functions
def generate_verification_token():
    """Generate a secure token for email verification"""
    return secrets.token_urlsafe(32)

# Database setup
def migrate_passwords_to_bcrypt():
    """Migrate existing plain text passwords to bcrypt hashed passwords"""
    with app.app_context():
        users = User.query.all()
        for user in users:
            # Skip users with None passwords (unverified users)
            if user.password is None:
                continue
                
            # Check if the password is already a bcrypt hash
            if not user.password.startswith('$2b$') and not user.password.startswith('$2a$'):
                # Hash the plain text password
                hashed_password = bcrypt.hashpw(user.password.encode('utf-8'), bcrypt.gensalt())
                user.password = hashed_password.decode('utf-8')
        
        db.session.commit()
        print("Password migration completed")

def initialize_default_instruments():
    """Initialize default instruments if they don't exist"""
    with app.app_context():
        default_instruments = [
            'Guitar',
            'Bass',
            'Drums', 
            'Vocals',
            'Keys',
            'Production'
        ]
        
        for instrument_name in default_instruments:
            existing = Instrument.query.filter_by(name=instrument_name).first()
            if not existing:
                instrument = Instrument(name=instrument_name, is_active=True)
                db.session.add(instrument)
        
        db.session.commit()

def initialize_default_rooms():
    """Initialize default rooms if they don't exist"""
    with app.app_context():
        default_rooms = [
            {'name': 'Guitar Room', 'capacity': 6, 'description': 'Dedicated room for guitar lessons'},
            {'name': 'Bass Room', 'capacity': 6, 'description': 'Dedicated room for bass lessons'},
            {'name': 'Vocal Room', 'capacity': 6, 'description': 'Dedicated room for vocal lessons'},
            {'name': 'Drum Room', 'capacity': 6, 'description': 'Dedicated room for drum lessons'}
        ]
        
        for room_data in default_rooms:
            existing_room = Room.query.filter_by(name=room_data['name']).first()
            if not existing_room:
                new_room = Room(**room_data)
                db.session.add(new_room)
        
        db.session.commit()

def ensure_admin_user_exists():
    """
    Ensure at least one admin user exists in the database.
    If no admin users exist, create a default admin account that requires password setup.
    """
    admin_count = User.query.filter_by(role='admin').count()
    
    if admin_count == 0:
        print("No admin users found. Creating default admin account...")
        
        # Create default admin user without password (requires setup)
        default_admin_email = MPA_LONDON_EMAIL
        verification_token = generate_verification_token()
        
        admin_user = User(
            username='Bello-Pluto Salvatore',
            email=default_admin_email,
            role='admin',
            verification_token=verification_token,
            is_verified=False,  # Requires password setup
            password=None  # No password set initially
        )
        
        db.session.add(admin_user)
        db.session.commit()
        
        print(f"Default admin account created with email: {default_admin_email}")
        print(f"Visit /verify-email/{verification_token} to set up the admin password")
        print("IMPORTANT: Save this verification URL - you'll need it to access your admin account!")
        
        return admin_user
    else:
        print(f"Found {admin_count} admin user(s) in database")
        return None

def init_db():
    """Initialize the database"""
    with app.app_context():
        # Create all tables
        db.create_all()
        
        # Migrate passwords to bcrypt
        migrate_passwords_to_bcrypt()
        
        # Initialize default instruments
        initialize_default_instruments()
        
        # Initialize default rooms
        initialize_default_rooms()
        
        # Ensure admin user exists
        ensure_admin_user_exists()
        
        print("Database initialized successfully")

# Database initialization moved to /admin/setup route
# init_db()  # Moved to setup route to prevent startup issues

def load_materials():
    """Load materials from SQLite database"""
    print("Loading materials from database")
    if 'user' in session:
        # Load materials for the current user
        print(f"Loading materials for user ID: {session['user']['id']}")
        materials = Material.query.filter_by(user_id=session['user']['id']).all()
    else:
        # Load all materials if no user is logged in (for admin)
        print("No user in session, loading all materials")
        materials = Material.query.all()
    
    result = [material.to_dict() for material in materials]
    print(f"Found {len(result)} materials")
    
    # Add dateAdded field for compatibility with frontend
    for material in result:
        if 'date_added' in material and material['date_added']:
            material['dateAdded'] = material['date_added']
        else:
            material['dateAdded'] = datetime.now().strftime('%Y-%m-%d')
    
    return result

def save_material(material_data, user_id=None):
    """Save a material to the SQLite database"""
    print(f"Saving material: {material_data}")
    
    # Get user_id from session if not provided
    if user_id is None and 'user' in session:
        user_id = session['user']['id']
    
    # Create new material
    new_material = Material(
        title=material_data['title'],
        type=material_data.get('type', ''),
        url=material_data.get('url', ''),
        description=material_data.get('description', ''),
        category=material_data.get('category', ''),
        user_id=user_id
    )
    
    # Add to database
    db.session.add(new_material)
    db.session.commit()
    
    print(f"Material saved with ID: {new_material.id}")
    return new_material.to_dict()

def delete_material(material_id, user_id=None):
    """Delete a material from the SQLite database"""
    if user_id:
        # Delete only if the material belongs to the user
        material = Material.query.filter_by(id=material_id, user_id=user_id).first()
    else:
        # Admin can delete any material
        material = db.session.get(Material, material_id)
    
    if material:
        # First delete any allocations associated with this material
        MaterialAllocation.query.filter_by(material_id=material_id).delete()
        
        # Then delete the material
        db.session.delete(material)
        db.session.commit()
        return True
    
    return False

def load_sessions():
    """Load sessions from SQLite database"""
    if 'user' in session:
        # If user is admin, load all sessions
        if session['user']['role'] == 'admin':
            sessions = Session.query.all()
        else:
            # If user is student, load their individual sessions and group sessions
            user_id = session['user']['id']
            
            # Get the user's groups
            user_groups = GroupMember.query.filter_by(student_id=user_id).all()
            group_ids = [member.group_id for member in user_groups]
            
            # Query for sessions where user_id matches or group_id is in user's groups
            sessions = Session.query.filter(
                db.or_(
                    Session.user_id == user_id,
                    Session.group_id.in_(group_ids)
                )
            ).all()
    else:
        # Load all sessions if no user is logged in (for admin)
        sessions = Session.query.all()
    
    return [session.to_dict() for session in sessions]

def save_session(session_data, user_id=None):
    """Save a session to the SQLite database"""
    # Use the user_id from the session data if it's provided, otherwise use the logged-in user's ID
    session_user_id = session_data.get('user_id')
    if session_user_id is not None:
        # Convert user_id to integer if it's a string
        try:
            user_id = int(session_user_id)
            print(f"Using user_id from session data: {user_id} (converted from {session_user_id})")
        except (ValueError, TypeError):
            print(f"ERROR: Invalid user_id format: {session_user_id}. Using logged-in user's ID instead.")
    else:
        print(f"Using logged-in user's ID: {user_id}")
    
    # Ensure user_id is an integer
    if user_id is not None:
        try:
            user_id = int(user_id)
        except (ValueError, TypeError):
            print(f"ERROR: Invalid user_id format: {user_id}. Setting to None.")
            user_id = None
    
    # Handle group_id if provided
    group_id = session_data.get('group_id')
    if group_id is not None:
        try:
            group_id = int(group_id)
            print(f"Using group_id from session data: {group_id}")
        except (ValueError, TypeError):
            print(f"ERROR: Invalid group_id format: {group_id}. Setting to None.")
            group_id = None
    
    # Handle room_id if provided
    room_id = session_data.get('room_id')
    if room_id is not None:
        try:
            room_id = int(room_id)
            print(f"Using room_id from session data: {room_id}")
        except (ValueError, TypeError):
            print(f"ERROR: Invalid room_id format: {room_id}. Setting to None.")
            room_id = None
    
    # Extract instrument from session data
    instrument_id = session_data.get('instrument_id')
    if instrument_id is not None:
        try:
            instrument_id = int(instrument_id)
            print(f"Using instrument_id from session data: {instrument_id}")
        except (ValueError, TypeError):
            print(f"ERROR: Invalid instrument_id format: {instrument_id}. Setting to None.")
            instrument_id = None
    
    # Create title if not provided
    if 'title' not in session_data or not session_data['title']:
        if group_id:
            # Get group name for title
            group = db.session.get(Group, group_id)
            group_name = group.name if group else "Unknown Group"
            session_data['title'] = f"Group Session: {group_name}"
        elif user_id:
            # Get user name for title
            user = db.session.get(User, user_id)
            user_name = user.username if user else "Unknown User"
            session_data['title'] = f"Session with {user_name}"
        else:
            session_data['title'] = "Untitled Session"
    
    # Handle recurring sessions
    is_recurring = session_data.get('is_recurring', False)
    recurrence_type = session_data.get('recurrence_type')
    recurrence_end_date = session_data.get('recurrence_end_date')
    
    if is_recurring and recurrence_type and recurrence_end_date:
        # Create the parent session first
        parent_session = Session(
            title=session_data['title'],
            date=session_data['date'],
            time=session_data['time'],
            duration=session_data['duration'],
            user_id=user_id,
            group_id=group_id,
            room_id=room_id,
            instrument_id=instrument_id,
            is_recurring=True,
            recurrence_type=recurrence_type,
            recurrence_end_date=recurrence_end_date
        )
        db.session.add(parent_session)
        db.session.commit()
        
        # Calculate recurring sessions
        start_date = datetime.strptime(session_data['date'], '%Y-%m-%d')
        end_date = datetime.strptime(recurrence_end_date, '%Y-%m-%d')
        current_date = start_date
        
        # Get the term for this session to check for breaks
        term = None
        if group_id:
            group = db.session.get(Group, group_id)
            if group and group.name:
                # Extract term name from group name (format: "{term_name} - {instrument}")
                term_name = group.name.split(' - ')[0]
                term = Term.query.filter_by(name=term_name).first()
        
        # Create child sessions based on recurrence type
        while current_date <= end_date:
            if current_date != start_date:  # Skip the first date as it's already created
                # Check if this date falls within a term break
                skip_date = False
                if term and term.has_break:
                    break_start = term.break_start_date
                    break_end = term.break_end_date
                    if break_start <= current_date.date() <= break_end:
                        skip_date = True
                        print(f"Skipping session on {current_date.date()} due to term break")
                
                if not skip_date:
                    child_session = Session(
                        title=session_data['title'],
                        date=current_date.strftime('%Y-%m-%d'),
                        time=session_data['time'],
                        duration=session_data['duration'],
                        user_id=user_id,
                        group_id=group_id,
                        room_id=room_id,
                        instrument_id=instrument_id,
                        is_recurring=True,
                        recurrence_type=recurrence_type,
                        recurrence_end_date=recurrence_end_date,
                        parent_session_id=parent_session.id
                    )
                    db.session.add(child_session)
            
            # Increment date based on recurrence type
            if recurrence_type == 'weekly':
                current_date += timedelta(days=7)
            elif recurrence_type == 'biweekly':
                current_date += timedelta(days=14)
            elif recurrence_type == 'monthly':
                # Add one month
                if current_date.month == 12:
                    current_date = current_date.replace(year=current_date.year + 1, month=1)
                else:
                    current_date = current_date.replace(month=current_date.month + 1)
            else:
                # Default to weekly if recurrence type is not recognized
                current_date += timedelta(days=7)
        
        db.session.commit()
        return parent_session.to_dict()
    else:
        # Create a single non-recurring session
        new_session = Session(
            title=session_data['title'],
            date=session_data['date'],
            time=session_data['time'],
            duration=session_data['duration'],
            user_id=user_id,
            group_id=group_id,
            room_id=room_id,
            instrument_id=instrument_id
        )
        
        db.session.add(new_session)
        db.session.commit()
        
        return new_session.to_dict()

def delete_session(session_id, user_id=None, delete_all=False):
    """Delete a session from the SQLite database"""
    # Get the session
    session = db.session.get(Session, session_id)
    
    if not session:
        return False
    
    # If this is a recurring session
    if session.is_recurring:
        if delete_all:
            # If this is a child session, find and delete all siblings
            if session.parent_session_id:
                # Delete all sessions with the same parent
                Session.query.filter_by(parent_session_id=session.parent_session_id).delete()
                # Delete the parent session
                Session.query.filter_by(id=session.parent_session_id).delete()
            else:
                # This is a parent session, delete all child sessions
                Session.query.filter_by(parent_session_id=session_id).delete()
                # Delete the parent session
                db.session.delete(session)
        else:
            # Delete only this specific session
            db.session.delete(session)
    else:
        # For non-recurring sessions, just delete the session
        db.session.delete(session)
    
    db.session.commit()
    return True

# User authentication
def load_users():
    """Load users from SQLite database"""
    users = User.query.all()
    user_dicts = [user.to_dict() for user in users]
    
    # Sort users by role (admin first, then students) and username
    user_dicts.sort(key=lambda x: (x['role'] != 'admin', x['role'] != 'student', x['username'].lower()))
    
    # Log all users for debugging
    print("All users after sorting:")
    for user in user_dicts:
        print(f"ID: {user['id']}, Username: {user['username']}, Role: {user['role']}, Email: {user['email']}")
    
    return user_dicts

def save_user(user_data):
    """Save a user to the SQLite database"""
    # Check if password is provided
    if 'password' in user_data and user_data['password']:
        # Hash the password
        hashed_password = bcrypt.hashpw(user_data['password'].encode('utf-8'), bcrypt.gensalt())
        
        # Create new user with password
        new_user = User(
            username=user_data['username'],
            email=user_data['email'],
            role=user_data.get('role', 'student'),
            password=hashed_password.decode('utf-8'),
            is_verified=True,  # Set as verified since password is provided
            instrument_id=user_data.get('instrument_id')  # Add instrument_id field
        )
        
        db.session.add(new_user)
        db.session.commit()
        
        return new_user.to_dict()
    else:
        # Generate a verification token for email verification flow
        verification_token = generate_verification_token()
        
        # Create new user without password initially
        new_user = User(
            username=user_data['username'],
            email=user_data['email'],
            role=user_data.get('role', 'student'),
            verification_token=verification_token,
            is_verified=False,
            instrument_id=user_data.get('instrument_id')  # Add instrument_id field
        )
        
        db.session.add(new_user)
        db.session.commit()
        
        # Send verification email
        if send_verification_email(user_data['email'], verification_token):
            print("Verification email sent successfully")
        else:
            print("Failed to send verification email")
            # If email sending fails, we should probably delete the user
            db.session.delete(new_user)
            db.session.commit()
            raise Exception("Failed to send verification email")
        
        return new_user.to_dict()

def send_verification_email(email, token):
    try:
        print("\n=== Starting Email Verification Process ===")
        # Email configuration
        sender_email = os.getenv('MAIL_USERNAME')
        password = os.getenv('MAIL_PASSWORD')
        
        print(f"Checking email credentials...")
        print(f"MAIL_USERNAME: {sender_email}")
        print(f"MAIL_PASSWORD: {'Set' if password else 'Not set'}")
        
        if not sender_email or not password:
            print("Error: Email credentials not found in environment variables")
            return False
            
        # Create verification link
        verification_link = url_for('verify_email', token=token, _external=True)
        print(f"Generated verification link: {verification_link}")
        
        # Create message
        print("Creating email message...")
        msg = MIMEMultipart()
        msg['From'] = sender_email
        msg['To'] = email
        msg['Subject'] = "Verify Your Email and Set Password"
        
        body = f"""
        Hello,
        
        Please click the following link to verify your email and set your password:
        {verification_link}
        
        If you did not request this verification, please ignore this email.
        
        Best regards,
        MPA London
        """
        
        msg.attach(MIMEText(body, 'plain'))
        
        # Create SMTP session
        print("Connecting to SMTP server...")
        server = smtplib.SMTP('smtp.gmail.com', 587)
        print("Starting TLS...")
        server.starttls()
        print("Attempting login...")
        server.login(sender_email, password)
        
        # Send email
        print(f"Sending email to {email}...")
        server.send_message(msg)
        print("Email sent successfully!")
        server.quit()
        print("=== Email Verification Process Complete ===\n")
        
        return True
        
    except Exception as e:
        print("\n=== Email Verification Error ===")
        print(f"Error type: {type(e)}")
        print(f"Error message: {str(e)}")
        import traceback
        print("Full traceback:")
        print(traceback.format_exc())
        print("=== End of Error Report ===\n")
        return False

def get_user_by_username(username):
    """Get a user by username from the SQLite database"""
    user = User.query.filter_by(username=username).first()
    
    if user:
        return user.to_dict()
    return None

def get_user_by_email(email):
    """Get a user by email from the SQLite database"""
    user = User.query.filter_by(email=email).first()
    
    if user:
        return user.to_dict()
    return None

@app.route('/')
def home():
    return render_template('home.html')

@app.route('/about')
def about():
    return render_template('about.html')

@app.route('/contact', methods=['GET', 'POST'])
def contact():
    if request.method == 'POST':
        name = request.form.get('name')
        email = request.form.get('email')
        subject = request.form.get('subject')
        message = request.form.get('message')
        
        # Send email
        email_sent = send_email(name, email, subject, message)
        
        if email_sent:
            return redirect(url_for('contact_success'))
        else:
            flash('There was an error sending your message. Please try again later.')
            return redirect(url_for('contact'))
    
    return render_template('contact.html')

@app.route('/contact-success')
def contact_success():
    return render_template('contact_success.html')

@app.route('/taster', methods=['GET', 'POST'])
def taster():
    if request.method == 'POST':
        student_name = request.form.get('student-name')
        age = request.form.get('age')
        email = request.form.get('email')
        confirm_email = request.form.get('confirm-email')
        phone = request.form.get('phone')
        contact_method = request.form.get('contact-method')
        message = request.form.get('message')
        
        # Print form data for debugging
        print(f"Taster form submitted: {student_name}, {age}, {email}, {phone}, {contact_method}")
        
        # Send email
        email_sent = send_taster_email(student_name, age, email, phone, contact_method, message)
        
        if email_sent:
            return redirect(url_for('taster_success'))
        else:
            flash('There was an error submitting your form. Please try again later.')
            return redirect(url_for('taster'))
    
    return render_template('taster.html')

@app.route('/taster-success')
def taster_success():
    return render_template('taster_success.html')

@app.route('/signin', methods=['GET', 'POST'])
def signin():
    if request.method == 'POST':
        email = request.form.get('email')
        password = request.form.get('password')
        
        user = User.query.filter_by(email=email).first()
        
        if user and user.check_password(password):
            if not user.is_verified:
                return render_template('signin.html', error='Please verify your email before logging in.')
            
            login_user(user)
            session['user'] = {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'role': user.role
            }
            
            if user.role in ['admin', 'staff']:
                return redirect(url_for('dashboard'))
            else:
                return redirect(url_for('student_dashboard'))
        
        return render_template('signin.html', error='Invalid email or password')
    
    return render_template('signin.html')

@app.route('/signout')
@login_required
def signout():
    session.pop('user', None)
    logout_user()
    return redirect(url_for('signin'))


@app.route('/dashboard')
@login_required
def dashboard():
    if current_user.role not in ['admin', 'staff']:
        return redirect(url_for('student_dashboard'))
    
    # Get all sessions
    sessions = Session.query.order_by(Session.date).all()
    
    # Get all materials
    materials = Material.query.all()
    
    # Get all users
    users = User.query.all()
    
    # Get all rooms
    rooms = Room.query.all()
    
    # Only get jam nights and term dates for admin
    jam_nights = []
    term_dates = []
    if current_user.role == 'admin':
        jam_nights = JamNight.query.order_by(JamNight.date).all()
        term_dates = Term.query.order_by(Term.start_date).all()
    
    return render_template('dashboard.html',
                         sessions=sessions,
                         materials=materials,
                         users=users,
                         rooms=rooms,
                         jam_nights=jam_nights,
                         term_dates=term_dates)

@app.route('/settings')
@login_required
def settings():
    if current_user.role not in ['admin', 'staff']:
        return redirect(url_for('student_dashboard'))
    
    print(f"Current user role: {current_user.role}")
    print(f"Current user ID: {current_user.id}")
    
    # Load all users based on role
    if current_user.role == 'admin':
        # Admin can see all users
        students = User.query.filter_by(role='student').all()
        staff_users = User.query.filter_by(role='staff').all()
        admin_users = User.query.filter_by(role='admin').all()
        print(f"Admin view - Found {len(students)} students, {len(staff_users)} staff users, and {len(admin_users)} admin users")
        print("Staff users:", [user.username for user in staff_users])
        print("Admin users:", [user.username for user in admin_users])
    else:
        # Staff can only see students
        students = User.query.filter_by(role='student').all()
        staff_users = []
        admin_users = []
        print(f"Staff view - Found {len(students)} students")
    
    return render_template('settings.html', 
                         students=students, 
                         staff_users=staff_users, 
                         admin_users=admin_users,
                         current_user=current_user)

@app.route('/api/sessions', methods=['GET', 'POST', 'DELETE'])
@login_required
def api_sessions():
    if request.method == 'GET':
        # Check if a specific group_id is requested
        group_id = request.args.get('group_id')
        
        if group_id:
            # Filter sessions by group_id
            try:
                group_id = int(group_id)
                sessions = Session.query.filter_by(group_id=group_id).order_by(Session.date).all()
                return jsonify({'sessions': [session.to_dict() for session in sessions]})
            except ValueError:
                return jsonify({'error': 'Invalid group ID'}), 400
        
        # Original logic for all sessions
        if current_user.role == 'student':
            # Students can see their own sessions and group sessions
            group_ids = [gm.group_id for gm in GroupMember.query.filter_by(student_id=current_user.id).all()]
            sessions = Session.query.filter(
                db.or_(
                    Session.user_id == current_user.id,
                    Session.group_id.in_(group_ids)
                )
            ).order_by(Session.date).all()
        else:
            # Admin and staff can see all sessions
            sessions = Session.query.order_by(Session.date).all()
        return jsonify([session.to_dict() for session in sessions])
    
    if request.method == 'POST':
        # Only admin and staff can create sessions
        if current_user.role not in ['admin', 'staff']:
            return jsonify({'error': 'Unauthorized'}), 403
        
        data = request.get_json()
        if not data.get('date') or not data.get('time'):
            return jsonify({'error': 'Date and time are required'}), 400
        
        # Create the session using the save_session function
        try:
            session_data = {
                'date': data['date'],
                'time': data['time'],
                'duration': data.get('duration', 60),  # Default to 60 minutes
                'title': data.get('title', ''),
                'notes': data.get('notes', ''),
                'user_id': data.get('user_id'),
                'group_id': data.get('group_id'),
                'room_id': data.get('room_id'),
                'instrument_id': data.get('instrument_id'),  # Add instrument_id field
                'is_recurring': data.get('is_recurring', False),
                'recurrence_type': data.get('recurrence_type'),
                'recurrence_end_date': data.get('recurrence_end_date')
            }
            
            new_session = save_session(session_data, current_user.id)
            return jsonify(new_session), 201
        except Exception as e:
            print(f"Error creating session: {str(e)}")
            return jsonify({'error': 'Failed to create session'}), 500
    
    if request.method == 'DELETE':
        # Only admin and staff can delete sessions
        if current_user.role not in ['admin', 'staff']:
            return jsonify({'error': 'Unauthorized'}), 403
        
        session_id = request.args.get('id')
        delete_all = request.args.get('delete_all', 'false').lower() == 'true'
        
        if not session_id:
            return jsonify({'error': 'Session ID is required'}), 400
        
        try:
            session_id = int(session_id)
            if delete_session(session_id, current_user.id, delete_all):
                return jsonify({'message': 'Session deleted successfully'}), 200
            else:
                return jsonify({'error': 'Session not found'}), 404
        except ValueError:
            return jsonify({'error': 'Invalid session ID'}), 400

@app.route('/api/sessions/<int:session_id>')
@login_required
def get_session(session_id):
    session = db.session.get(Session, session_id)
    if not session:
        return jsonify({'error': 'Session not found'}), 404
    
    # Check if user has access to this session
    if current_user.role == 'student':
        group_ids = [gm.group_id for gm in GroupMember.query.filter_by(student_id=current_user.id).all()]
        if session.user_id != current_user.id and session.group_id not in group_ids:
            return jsonify({'error': 'Unauthorized access'}), 403
    
    # Get room name if available
    room_name = None
    if session.room_id:
        room = db.session.get(Room, session.room_id)
        if room:
            room_name = room.name
    
    return jsonify({
        'id': session.id,
        'title': session.title,
        'start_time': f"{session.date} {session.time}",
        'duration': session.duration,
        'notes': session.notes if hasattr(session, 'notes') else None,
        'type': 'group' if session.group_id else 'individual',
        'instrument': session.instrument.name if session.instrument else None,
        'room_name': room_name
    })

@app.route('/api/materials', methods=['GET', 'POST', 'DELETE'])
@login_required
def api_materials():
    if request.method == 'GET':
        # Allow all logged-in users to view materials
        if current_user.role == 'student':
            # Get group IDs where the student is a member
            group_ids = [gm.group_id for gm in GroupMember.query.filter_by(student_id=current_user.id).all()]
            # Get material IDs allocated directly to the student
            direct_material_ids = [ma.material_id for ma in MaterialAllocation.query.filter_by(student_id=current_user.id).all()]
            # Get material IDs allocated to the student's groups
            group_material_ids = [gma.material_id for gma in GroupMaterialAllocation.query.filter(GroupMaterialAllocation.group_id.in_(group_ids)).all()]
            # Combine and deduplicate material IDs
            all_material_ids = set(direct_material_ids + group_material_ids)
            materials = Material.query.filter(Material.id.in_(all_material_ids)).all()
        else:
            # Admin and staff can see all materials
            materials = Material.query.all()
        return jsonify([material.to_dict() for material in materials])
    
    if request.method == 'POST':
        # Only admin and staff can create materials
        if current_user.role not in ['admin', 'staff']:
            return jsonify({'error': 'Unauthorized'}), 403
        
        data = request.get_json()
        if not data.get('title') or not data.get('type') or not data.get('url'):
            return jsonify({'error': 'Title, type, and URL are required'}), 400
        
        material = Material(
            title=data['title'],
            type=data['type'],
            url=data['url'],
            description=data.get('description', ''),
            category=data.get('category', ''),
            instrument_id=data.get('instrument_id'),  # Add instrument_id field
            user_id=current_user.id
        )
        db.session.add(material)
        db.session.commit()
        return jsonify(material.to_dict()), 201
    
    if request.method == 'DELETE':
        # Only admin and staff can delete materials
        if current_user.role not in ['admin', 'staff']:
            return jsonify({'error': 'Unauthorized'}), 403
        
        material_id = request.args.get('id')
        material = db.session.get(Material, material_id)
        if not material:
            return jsonify({'error': 'Material not found'}), 404
        
        try:
            # Get the file ID from the material's URL
            file_id = material.url.split('id=')[-1] if 'id=' in material.url else None
            
            if file_id:
                # Delete from Google Drive
                service = get_google_drive_service()
                delete_file(service, file_id)
                print(f"Deleted file from Google Drive with ID: {file_id}")
            
            # Delete from database
            db.session.delete(material)
            db.session.commit()
            return jsonify({'message': 'Material deleted successfully'}), 200
            
        except Exception as e:
            print(f"Error deleting material: {str(e)}")
            return jsonify({'error': f'Failed to delete material: {str(e)}'}), 500

@app.route('/api/allocations', methods=['GET', 'POST', 'DELETE'])
def api_allocations():
    """API endpoint for material allocations"""
    if 'user' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    # Admin and staff can manage allocations
    if session['user']['role'] not in ['admin', 'staff']:
        return jsonify({'error': 'Forbidden'}), 403
    
    if request.method == 'GET':
        # Get all allocations or filter by student_id
        student_id = request.args.get('student_id')
        if student_id:
            try:
                student_id = int(student_id)
                allocations = get_allocations_by_student(student_id)
            except ValueError:
                return jsonify({'error': 'Invalid student ID'}), 400
        else:
            allocations = get_all_allocations()
        
        return jsonify(allocations)
    
    elif request.method == 'POST':
        data = request.json
        
        # Check for required fields
        if not data:
            return jsonify({'error': 'No data provided'}), 400
            
        if 'material_id' not in data:
            return jsonify({'error': 'Material ID is required'}), 400
            
        if 'student_id' not in data:
            return jsonify({'error': 'Student ID is required'}), 400
        
        # Create new allocation
        new_allocation = save_allocation(data)
        return jsonify(new_allocation), 201
    
    elif request.method == 'DELETE':
        allocation_id = request.args.get('id')
        if not allocation_id:
            return jsonify({'error': 'Allocation ID is required'}), 400
        
        try:
            allocation_id = int(allocation_id)
        except ValueError:
            return jsonify({'error': 'Invalid allocation ID'}), 400
        
        # Delete the allocation
        delete_allocation(allocation_id)
        return jsonify({'success': True}), 200

def get_allocated_materials(student_id):
    """Get materials allocated to a specific student"""
    with app.app_context():
        allocations = MaterialAllocation.query.filter_by(student_id=student_id).all()
        materials = []
        
        for allocation in allocations:
            material = db.session.get(Material, allocation.material_id)
            if material:
                material_dict = material.to_dict()
                material_dict['date_allocated'] = allocation.date_allocated.strftime('%Y-%m-%d %H:%M:%S')
                materials.append(material_dict)
        
        return materials

def get_allocations_by_student(student_id):
    """Get all allocations for a specific student"""
    with app.app_context():
        allocations = MaterialAllocation.query.filter_by(student_id=student_id).all()
        return [allocation.to_dict() for allocation in allocations]

def get_all_allocations():
    """Get all material allocations"""
    with app.app_context():
        allocations = MaterialAllocation.query.all()
        return [allocation.to_dict() for allocation in allocations]

def save_allocation(allocation_data):
    """Save a material allocation to the database"""
    with app.app_context():
        # Check if allocation already exists
        existing = MaterialAllocation.query.filter_by(
            material_id=allocation_data['material_id'],
            student_id=allocation_data['student_id']
        ).first()
        
        if existing:
            return existing.to_dict()
        
        new_allocation = MaterialAllocation(
            material_id=allocation_data['material_id'],
            student_id=allocation_data['student_id']
        )
        
        db.session.add(new_allocation)
        db.session.commit()
        
        return new_allocation.to_dict()

def delete_allocation(allocation_id):
    """Delete a material allocation from the database"""
    with app.app_context():
        allocation = db.session.get(MaterialAllocation, allocation_id)
        if allocation:
            db.session.delete(allocation)
            db.session.commit()
            return True
        return False

@app.route('/api/materials/upload', methods=['POST'])
def upload_material():
    """Handle file uploads for materials using Google Drive"""
    if 'user' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    # Get instrument from form data
    instrument = request.form.get('instrument')
    instrument_id = request.form.get('instrument_id')
    if not instrument:
        return jsonify({'error': 'Instrument selection is required'}), 400
    
    # Convert instrument_id to integer if provided
    if instrument_id:
        try:
            instrument_id = int(instrument_id)
        except (ValueError, TypeError):
            instrument_id = None
    
    temp_path = None
    try:
        print(f"Starting file upload for instrument: {instrument}")
        
        # Get Google Drive service
        print("Getting Google Drive service...")
        service = get_google_drive_service()
        print("Successfully got Google Drive service")
        
        # Create a temporary file to store the upload
        temp_path = os.path.join(app.root_path, 'temp', secure_filename(file.filename))
        print(f"Creating temporary file at: {temp_path}")
        os.makedirs(os.path.dirname(temp_path), exist_ok=True)
        file.save(temp_path)
        print("Temporary file created successfully")
        
        # Get file mime type
        mime_type = file.content_type or 'application/octet-stream'
        print(f"File mime type: {mime_type}")
        
        # Get or create the main MPA Materials folder
        print("Looking for main MPA Materials folder...")
        main_folder = service.files().list(
            q="name='MPA Materials' and mimeType='application/vnd.google-apps.folder' and trashed=false",
            fields="files(id, name)"
        ).execute()
        
        if not main_folder.get('files'):
            print("Main folder not found, creating it...")
            main_folder_id = create_folder(service, "MPA Materials")
            print(f"Created main folder with ID: {main_folder_id}")
        else:
            main_folder_id = main_folder['files'][0]['id']
            print(f"Found main folder with ID: {main_folder_id}")
        
        # Get or create the instrument subfolder
        print(f"Looking for instrument subfolder: {instrument}")
        instrument_folder = service.files().list(
            q=f"name='{instrument}' and '{main_folder_id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false",
            fields="files(id, name)"
        ).execute()
        
        if not instrument_folder.get('files'):
            print(f"Instrument folder not found, creating it...")
            folder_id = create_folder(service, instrument, main_folder_id)
            print(f"Created instrument folder with ID: {folder_id}")
        else:
            folder_id = instrument_folder['files'][0]['id']
            print(f"Found instrument folder with ID: {folder_id}")
        
        # Upload to Google Drive
        print(f"Uploading file to folder ID: {folder_id}")
        file_id = upload_file(
            service=service,
            file_path=temp_path,
            file_name=secure_filename(file.filename),
            mime_type=mime_type,
            folder_id=folder_id
        )
        print(f"File uploaded successfully with ID: {file_id}")
        
        # Clean up temporary file
        print("Cleaning up temporary file...")
        if os.path.exists(temp_path):
            os.remove(temp_path)
            print("Temporary file removed")
        
        # Return the file ID and a direct download URL
        file_url = f'https://drive.google.com/uc?id={file_id}'
        print(f"Returning success response with file URL: {file_url}")
        return jsonify({
            'url': file_url,
            'file_id': file_id,
            'instrument': instrument
        }), 200
        
    except Exception as e:
        print(f"Error in upload_material: {str(e)}")
        app.logger.error(f"Error uploading file to Google Drive: {str(e)}")
        # Clean up temporary file if it exists
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except:
                pass
        return jsonify({'error': f'Failed to upload file: {str(e)}'}), 500

@app.route('/api/users', methods=['GET', 'POST', 'DELETE'])
@login_required
def api_users():
    if current_user.role not in ['admin', 'staff']:
        return jsonify({'error': 'Unauthorized'}), 403
    
    if request.method == 'GET':
        user_id = request.args.get('id')
        if user_id:
            user = db.session.get(User, user_id)
            if user:
                return jsonify([user.to_dict()])
            else:
                return jsonify([])
        if current_user.role == 'staff':
            # Staff can only see students
            users = User.query.filter_by(role='student').all()
        else:
            # Admin can see all users
            users = User.query.all()
        return jsonify([user.to_dict() for user in users])
    
    if request.method == 'POST':
        data = request.get_json()
        
        # Validate required fields
        if not data.get('username') or not data.get('email'):
            return jsonify({'error': 'Username and email are required'}), 400
        
        # Check if username or email already exists
        if User.query.filter_by(username=data['username']).first():
            return jsonify({'error': 'Username already exists'}), 400
        
        if User.query.filter_by(email=data['email']).first():
            return jsonify({'error': 'Email already exists'}), 400
        
        # Staff can only create student accounts
        if current_user.role == 'staff' and data.get('role') != 'student':
            return jsonify({'error': 'Staff can only create student accounts'}), 403
        
        try:
            # Use save_user function to create the user
            user = save_user(data)
            return jsonify(user), 201
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    
    if request.method == 'DELETE':
        user_id = request.args.get('id')
        if not user_id:
            return jsonify({'error': 'User ID is required'}), 400
        
        user = db.session.get(User, user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Staff can only delete student accounts
        if current_user.role == 'staff' and user.role != 'student':
            return jsonify({'error': 'Staff can only delete student accounts'}), 403
        
        # Admin cannot delete themselves
        if current_user.role == 'admin' and user.id == current_user.id:
            return jsonify({'error': 'Cannot delete your own admin account'}), 403
        
        try:
            # Delete all feedback authored by this user
            Feedback.query.filter_by(author_id=user.id).delete()
            
            # Delete the user
            db.session.delete(user)
            db.session.commit()
            return jsonify({'message': 'User deleted successfully'}), 200
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': str(e)}), 500

@app.route('/student/dashboard')
def student_dashboard():
    """Render the student dashboard"""
    if not current_user.is_authenticated or current_user.role != 'student':
        return redirect(url_for('signin'))
    
    user_id = current_user.id
    
    # Get all sessions for this student
    sessions = Session.query.filter(
        (Session.user_id == user_id) | 
        (Session.group_id.in_(
            db.session.query(GroupMember.group_id)
            .filter(GroupMember.student_id == user_id)
        ))
    ).order_by(Session.date.desc()).all()
    
    # Get all materials allocated to this student
    materials = get_allocated_materials(user_id)
    
    # Get individual feedback for this student
    individual_feedbacks = Feedback.query.filter_by(student_id=user_id).order_by(Feedback.created_at.desc()).all()
    
    # Get group feedback for groups this student belongs to
    group_feedbacks = Feedback.query.join(
        GroupMember,
        Feedback.group_id == GroupMember.group_id
    ).filter(
        GroupMember.student_id == user_id
    ).order_by(Feedback.created_at.desc()).all()
    
    return render_template('student_dashboard.html', 
                         sessions=sessions, 
                         materials=materials, 
                         individual_feedbacks=individual_feedbacks,
                         group_feedbacks=group_feedbacks)

@app.route('/terms')
def terms():
    return render_template('terms.html')

@app.route('/privacy')
def privacy():
    return render_template('privacy.html', current_date=datetime.now().strftime('%B %d, %Y'))

@app.route('/guitar')
def guitar():
    single_lesson_price = get_price('guitar_lesson')
    if single_lesson_price == 0:
        single_lesson_price = 35
    mobile_price = single_lesson_price + 10
    package_price = get_price('guitar_package')
    if package_price == 0:
        package_price = 300
    
    # Get mobile service availability
    price_record = Price.query.filter_by(service_type='guitar_lesson').first()
    mobile_service_available = price_record.mobile_service_available if price_record else False
    
    return render_template('guitar.html', 
                         single_lesson_price=single_lesson_price, 
                         package_price=package_price, 
                         mobile_price=mobile_price,
                         mobile_service_available=mobile_service_available)

@app.route('/bass')
def bass():
    single_lesson_price = get_price('bass_lesson')
    if single_lesson_price == 0:
        single_lesson_price = 35
    mobile_price = single_lesson_price + 10
    package_price = get_price('bass_package')
    if package_price == 0:
        package_price = 300
    
    # Get mobile service availability
    price_record = Price.query.filter_by(service_type='bass_lesson').first()
    mobile_service_available = price_record.mobile_service_available if price_record else False
    
    return render_template('bass.html', 
                         single_lesson_price=single_lesson_price, 
                         package_price=package_price, 
                         mobile_price=mobile_price,
                         mobile_service_available=mobile_service_available)

@app.route('/guitar-services')
def guitar_services():
    # Get prices from database
    basic_setup = LuthierPrices.query.filter_by(service_name='Basic Setup').first()
    complete_fretwork = LuthierPrices.query.filter_by(service_name='Complete Fretwork').first()
    advanced_services = LuthierPrices.query.filter_by(category='advanced').all()

    return render_template('guitar_services.html',
                         basic_setup=basic_setup,
                         complete_fretwork=complete_fretwork,
                         advanced_services=advanced_services)

@app.route('/drums')
def drums():
    single_lesson_price = get_price('drum_lesson')
    if single_lesson_price == 0:
        single_lesson_price = 35
    package_price = get_price('drums_package')
    if package_price == 0:
        package_price = 350
    return render_template('drums.html', single_lesson_price=single_lesson_price, package_price=package_price)

@app.route('/vocals')
def vocals():
    single_lesson_price = get_price('vocal_lesson')
    if single_lesson_price == 0:
        single_lesson_price = 35
    mobile_price = single_lesson_price + 10
    package_price = get_price('vocals_package')
    if package_price == 0:
        package_price = 300
    
    # Get mobile service availability
    price_record = Price.query.filter_by(service_type='vocal_lesson').first()
    mobile_service_available = price_record.mobile_service_available if price_record else False
    
    return render_template('vocals.html', 
                         single_lesson_price=single_lesson_price, 
                         package_price=package_price, 
                         mobile_price=mobile_price,
                         mobile_service_available=mobile_service_available)

@app.route('/lessons')
def lessons():
    return render_template('lessons.html')

@app.route('/piano-keyboard')
def piano_keyboard():
    return render_template('piano_keyboard.html')

@app.route('/band_classes')
def band_classes():
    # Get all terms from the database, ordered by display_order
    terms = Term.query.order_by(Term.display_order.asc()).all()
    return render_template('band_classes.html', terms=terms)

@app.route('/band-practise')
def band_practise():
    # Redirect to the new band-classes route
    return redirect(url_for('band_classes'))

@app.route('/weekly-jam')
def weekly_jam():
    # Get all upcoming jam nights
    jam_nights = JamNight.query.filter(
        JamNight.is_active == True,
        JamNight.date >= datetime.now().date()
    ).order_by(JamNight.date.asc()).all()
    
    return render_template('weekly_jam.html', jam_nights=jam_nights)

def send_email(name, email, subject, message):
    try:
        msg = Message(
            subject=f"Contact Form: {subject}",
            recipients=[MPA_LONDON_EMAIL],
            body=f"""
            Name: {name}
            Email: {email}
            Subject: {subject}
            
            Message:
            {message}
            """
        )
        mail.send(msg)
        return True
    except Exception as e:
        print(f"Error sending email: {e}")
        return False

def send_taster_email(student_name, age, email, phone, contact_method, message):
    try:
        msg = Message(
            subject="Free Taster Session Request",
            recipients=[MPA_LONDON_EMAIL],
            body=f"""
            Student Name: {student_name}
            Age: {age}
            Email: {email}
            Phone: {phone}
            Preferred Contact Method: {contact_method}
            
            Message:
            {message}
            """
        )
        mail.send(msg)
        return True
    except Exception as e:
        print(f"Error sending email: {e}")
        return False


@app.route('/verify-email/<token>', methods=['GET', 'POST'])
def verify_email(token):
    """Verify email and set password"""
    # Find user with this token
    user = User.query.filter_by(verification_token=token).first()
    
    if not user:
        return render_template('error.html', error="Invalid or expired verification link.")
    
    if user.is_verified:
        return redirect(url_for('signin'))
    
    if request.method == 'POST':
        password = request.form.get('password')
        confirm_password = request.form.get('confirm_password')
        
        # Validate password
        if not password or len(password) < 8:
            return render_template('set_password.html', token=token, error="Password must be at least 8 characters long.")
        
        if password != confirm_password:
            return render_template('set_password.html', token=token, error="Passwords do not match.")
        
        # Hash the password and update user
        hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
        user.password = hashed_password.decode('utf-8')
        user.is_verified = True
        user.verification_token = None  # Clear the token
        
        db.session.commit()
        
        # Only flash the success message after password is set
        flash("Your account has been verified and your password has been set. You can now log in.")
        return redirect(url_for('signin'))
    
    # GET request - show the password creation form without any flash messages
    return render_template('set_password.html', token=token)

@app.route('/resend-verification', methods=['POST'])
def resend_verification():
    """Resend verification email"""
    email = request.form.get('email')
    
    if not email:
        return jsonify({'error': 'Email is required'}), 400
    
    user = User.query.filter_by(email=email).first()
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    if user.is_verified:
        return jsonify({'error': 'User is already verified'}), 400
    
    # Generate a new token
    user.verification_token = generate_verification_token()
    db.session.commit()
    
    # Send verification email
    if send_verification_email(email, user.verification_token):
        return jsonify({'message': 'Verification email sent'}), 200
    else:
        return jsonify({'error': 'Failed to send verification email'}), 500

@app.route('/api/users/<int:user_id>/reset-password', methods=['POST'])
def reset_user_password(user_id):
    """Reset a user's password and send them an email with a verification link"""
    try:
        # Check if user is logged in and is admin
        if 'user' not in session:
            return jsonify({'error': 'Unauthorized'}), 401
            
        if session['user']['role'] != 'admin':
            return jsonify({'error': 'Forbidden'}), 403
        
        # Get the user to reset password for
        user = db.session.get(User, user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Generate a new verification token
        user.verification_token = generate_verification_token()
        user.is_verified = False  # Set to unverified until they set a new password
        user.password = None  # Clear the existing password
        
        try:
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            print(f"Database error: {str(e)}")
            return jsonify({'error': 'Database error occurred'}), 500
        
        # Send verification email
        try:
            if send_verification_email(user.email, user.verification_token):
                return jsonify({'message': 'Password reset email sent successfully'}), 200
            else:
                # If email sending fails, rollback the changes
                user.is_verified = True  # Restore verified status
                user.verification_token = None  # Clear the token
                db.session.commit()
                return jsonify({'error': 'Failed to send password reset email'}), 500
        except Exception as e:
            # If email sending fails, rollback the changes
            user.is_verified = True  # Restore verified status
            user.verification_token = None  # Clear the token
            db.session.commit()
            print(f"Email error: {str(e)}")
            return jsonify({'error': 'Failed to send password reset email'}), 500
            
    except Exception as e:
        print(f"Unexpected error in reset_user_password: {str(e)}")
        return jsonify({'error': 'An unexpected error occurred'}), 500

@app.route('/forgot-password', methods=['GET', 'POST'])
def forgot_password():
    """Handle forgot password requests"""
    if request.method == 'POST':
        email = request.form.get('email')
        if not email:
            return render_template('forgot_password.html', error='Email is required')
        
        # Find user by email
        user = User.query.filter_by(email=email).first()
        
        if user:
            # Generate a new verification token
            user.verification_token = generate_verification_token()
            user.is_verified = False  # Set to unverified until they set a new password
            db.session.commit()
            
            # Send verification email
            if send_verification_email(email, user.verification_token):
                flash('Password reset instructions have been sent to your email.')
                return redirect(url_for('signin'))
            else:
                return render_template('forgot_password.html', error='Failed to send password reset email')
        else:
            # Don't reveal if the email exists or not for security reasons
            flash('If your email is registered, you will receive password reset instructions.')
            return redirect(url_for('signin'))
    
    # GET request - show the form
    return render_template('forgot_password.html')

# Custom login_required decorator
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user' not in session:
            return jsonify({'error': 'Unauthorized'}), 401
        return f(*args, **kwargs)
    return decorated_function

# Group API Routes
@app.route('/api/groups', methods=['GET', 'POST'])
@login_required
def manage_groups():
    if request.method == 'GET':
        try:
            # Get all groups
            groups = Group.query.all()
            return jsonify([group.to_dict() for group in groups])
        except Exception as e:
            print(f"Error loading groups: {str(e)}")
            return jsonify({'error': 'Failed to load groups. Please try again later.'}), 500
    
    elif request.method == 'POST':
        # Create a new group
        data = request.json
        
        if not data or 'name' not in data:
            return jsonify({'error': 'Group name is required'}), 400
        
        try:
            # Check if group name already exists
            existing_group = Group.query.filter_by(name=data['name']).first()
            if existing_group:
                return jsonify({'error': 'A group with this name already exists'}), 400
            
            # Create new group
            new_group = Group(
                name=data['name'],
                description=data.get('description', ''),
                created_by=session['user']['id']
            )
            
            db.session.add(new_group)
            db.session.commit()
            
            return jsonify(new_group.to_dict()), 201
        except Exception as e:
            db.session.rollback()
            print(f"Error creating group: {str(e)}")
            return jsonify({'error': 'Failed to create group. Please try again later.'}), 500

@app.route('/api/groups/<int:group_id>', methods=['GET', 'PUT', 'DELETE'])
@login_required
def manage_group(group_id):
    try:
        group = Group.query.get_or_404(group_id)
        
        if request.method == 'GET':
            # Get group details including members
            group_data = group.to_dict()
            members = GroupMember.query.filter_by(group_id=group_id).all()
            group_data['members'] = [member.to_dict() for member in members]
            return jsonify(group_data)
        
        elif request.method == 'PUT':
            # Update group
            data = request.json
            
            if 'name' in data:
                # Check if new name already exists
                existing_group = Group.query.filter_by(name=data['name']).first()
                if existing_group and existing_group.id != group_id:
                    return jsonify({'error': 'A group with this name already exists'}), 400
                
                group.name = data['name']
            
            if 'description' in data:
                group.description = data['description']
            
            db.session.commit()
            return jsonify(group.to_dict())
        
        elif request.method == 'DELETE':
            # Delete group
            db.session.delete(group)
            db.session.commit()
            return jsonify({'message': 'Group deleted successfully'})
            
    except Exception as e:
        db.session.rollback()
        print(f"Error managing group {group_id}: {str(e)}")
        return jsonify({'error': 'Failed to process request. Please try again later.'}), 500

@app.route('/api/groups/<int:group_id>/members', methods=['GET', 'POST', 'DELETE'])
@login_required
def manage_group_members(group_id):
    try:
        group = Group.query.get_or_404(group_id)
        
        if request.method == 'GET':
            # Get all members of the group with student information
            members = GroupMember.query.filter_by(group_id=group_id).all()
            result = []
            for member in members:
                # Get the student information
                student = db.session.get(User, member.student_id)
                if student:
                    member_data = member.to_dict()
                    member_data.update({
                        'username': student.username,
                        'email': student.email,
                        'role': student.role
                    })
                    result.append(member_data)
            return jsonify(result)
        
        elif request.method == 'POST':
            # Add a member to the group
            data = request.json
            
            if not data or 'student_id' not in data:
                return jsonify({'error': 'Student ID is required'}), 400
            
            student_id = data['student_id']
            
            # Check if student exists
            student = db.session.get(User, student_id)
            if not student or student.role != 'student':
                return jsonify({'error': 'Invalid student ID'}), 400
            
            # Check if student is already in the group
            existing_member = GroupMember.query.filter_by(group_id=group_id, student_id=student_id).first()
            if existing_member:
                return jsonify({'error': 'Student is already in this group'}), 400
            
            # Add student to group
            new_member = GroupMember(
                group_id=group_id,
                student_id=student_id
            )
            
            db.session.add(new_member)
            db.session.commit()
            
            return jsonify({
                'id': new_member.id,
                'group_id': new_member.group_id,
                'student_id': new_member.student_id,
                'student': {
                    'id': student.id,
                    'username': student.username,
                    'email': student.email,
                    'role': student.role
    },
    'date_added': new_member.date_added.strftime('%Y-%m-%d %H:%M:%S')
}), 201
        
        elif request.method == 'DELETE':
            # Remove a member from the group
            data = request.json
            
            if not data or 'student_id' not in data:
                return jsonify({'error': 'Student ID is required'}), 400
            
            student_id = data['student_id']
            
            # Find and remove the member
            member = GroupMember.query.filter_by(group_id=group_id, student_id=student_id).first()
            if not member:
                return jsonify({'error': 'Student is not in this group'}), 404
            
            db.session.delete(member)
            db.session.commit()
            
            return jsonify({'message': 'Student removed from group successfully'})
            
    except Exception as e:
        db.session.rollback()
        print(f"Error managing group members for group {group_id}: {str(e)}")
        return jsonify({'error': 'Failed to process request. Please try again later.'}), 500

@app.route('/api/groups/<int:group_id>/materials', methods=['GET', 'POST', 'DELETE'])
@login_required
def manage_group_materials(group_id):
    try:
        group = Group.query.get_or_404(group_id)
        
        if request.method == 'GET':
            # Get all materials allocated to the group with material information
            allocations = GroupMaterialAllocation.query.filter_by(group_id=group_id).all()
            result = []
            for allocation in allocations:
                # Get the material information
                material = db.session.get(Material, allocation.material_id)
                if material:
                    allocation_data = allocation.to_dict()
                    allocation_data.update({
                        'title': material.title,
                        'category': material.category,
                        'type': material.type,
                        'url': material.url,
                        'description': material.description
                    })
                    result.append(allocation_data)
            return jsonify(result)
        
        elif request.method == 'POST':
            # Allocate materials to the group
            data = request.json
            
            if not data or 'material_ids' not in data or not isinstance(data['material_ids'], list):
                return jsonify({'error': 'Material IDs list is required'}), 400
            
            material_ids = data['material_ids']
            
            # Check if materials exist
            for material_id in material_ids:
                material = db.session.get(Material, material_id)
                if not material:
                    return jsonify({'error': f'Material with ID {material_id} does not exist'}), 400
            
            # Add materials to group
            for material_id in material_ids:
                # Check if material is already allocated to the group
                existing_allocation = GroupMaterialAllocation.query.filter_by(
                    group_id=group_id, 
                    material_id=material_id
                ).first()
                
                if not existing_allocation:
                    new_allocation = GroupMaterialAllocation(
                        group_id=group_id,
                        material_id=material_id
                    )
                    db.session.add(new_allocation)
            
            db.session.commit()
            
            return jsonify({'message': 'Materials allocated to group successfully'}), 201
        
        elif request.method == 'DELETE':
            # Remove materials from the group
            data = request.json
            
            # Handle both single material_id and list of material_ids
            if not data:
                return jsonify({'error': 'No data provided'}), 400
            
            material_ids = []
            if 'material_id' in data:
                # Single material ID
                material_ids = [data['material_id']]
            elif 'material_ids' in data and isinstance(data['material_ids'], list):
                # List of material IDs
                material_ids = data['material_ids']
            else:
                return jsonify({'error': 'Material ID or Material IDs list is required'}), 400
            
            # Remove materials from group
            for material_id in material_ids:
                allocation = GroupMaterialAllocation.query.filter_by(
                    group_id=group_id, 
                    material_id=material_id
                ).first()
                
                if allocation:
                    db.session.delete(allocation)
            db.session.commit()
            # Return the updated list of allocations for the group
            allocations = GroupMaterialAllocation.query.filter_by(group_id=group_id).all()
            return jsonify({'message': 'Materials removed from group successfully', 'allocations': [a.to_dict() for a in allocations]})
            
    except Exception as e:
        db.session.rollback()
        print(f"Error managing group materials for group {group_id}: {str(e)}")
        return jsonify({'error': 'Failed to process request. Please try again later.'}), 500


def migrate_sessions_add_group_id():
    """Add group_id column to sessions table if it doesn't exist"""
    with app.app_context():
        try:
            inspector = db.inspect(db.engine)
            columns = [col['name'] for col in inspector.get_columns('sessions')]
            
            if 'group_id' not in columns:
                print("Adding group_id column to sessions table...")
                with db.engine.connect() as conn:
                    conn.execute(db.text('ALTER TABLE sessions ADD COLUMN group_id INTEGER REFERENCES groups(id)'))
                    conn.commit()
                print("Successfully added group_id column to sessions table")
            else:
                print("group_id column already exists in sessions table")
        except Exception as e:
            print(f"Error during migration: {str(e)}")
            # Continue execution even if there's an error
            pass

# Database initialization moved to /admin/setup route
# init_db()  # Moved to setup route to prevent startup issues

@app.route('/api/materials/<int:material_id>', methods=['PATCH'])
def update_material(material_id):
    """Update a material's properties"""
    if 'user' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    # Only admin can update materials
    if session['user']['role'] != 'admin':
        return jsonify({'error': 'Forbidden'}), 403
    
    material = db.session.get(Material, material_id)
    if not material:
        return jsonify({'error': 'Material not found'}), 404
    data = request.json
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    try:
        # Update material properties
        if 'title' in data:
            # If this is a Google Drive file, update the file name in Drive
            if 'id=' in material.url:
                file_id = material.url.split('id=')[-1]
                service = get_google_drive_service()
                
                # Update file metadata in Google Drive
                file_metadata = {
                    'name': data['title']
                }
                service.files().update(
                    fileId=file_id,
                    body=file_metadata,
                    fields='id, name'
                ).execute()
                print(f"Updated Google Drive file name for file ID: {file_id}")
            
            # Update title in database
            material.title = data['title']
        
        db.session.commit()
        return jsonify(material.to_dict()), 200
        
    except Exception as e:
        db.session.rollback()
        print(f"Error updating material: {str(e)}")
        return jsonify({'error': f'Failed to update material: {str(e)}'}), 500


@app.route('/safeguarding')
def safeguarding():
    return render_template('safeguarding.html')


@app.route('/api/jam-nights', methods=['GET'])
@login_required
def get_jam_nights():
    if current_user.role != 'admin':
        return jsonify({'error': 'Unauthorized'}), 401
    
    jam_nights = JamNight.query.filter(JamNight.date >= datetime.now().date()).order_by(JamNight.date).all()
    return jsonify([jam_night.to_dict() for jam_night in jam_nights])

@app.route('/api/jam-nights', methods=['POST'])
@login_required
def add_jam_night():
    if current_user.role != 'admin':
        return jsonify({'error': 'Unauthorized'}), 401
    
    data = request.json
    try:
        date = datetime.strptime(data['date'], '%Y-%m-%d').date()
        time_start = data.get('time_start', '19:30')
        time_end = data.get('time_end', '21:30')
        
        jam_night = JamNight(date=date, time_start=time_start, time_end=time_end)
        db.session.add(jam_night)
        db.session.commit()
        
        return jsonify(jam_night.to_dict()), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/jam-nights/<int:jam_night_id>', methods=['DELETE'])
@login_required
def delete_jam_night(jam_night_id):
    if current_user.role != 'admin':
        return jsonify({'error': 'Unauthorized'}), 401
    
    jam_night = JamNight.query.get_or_404(jam_night_id)
    db.session.delete(jam_night)
    db.session.commit()
    
    return jsonify({'message': 'Jam night deleted successfully'})

@app.route('/api/jam-nights/<int:jam_night_id>', methods=['PUT'])
@login_required
def update_jam_night(jam_night_id):
    if current_user.role != 'admin':
        return jsonify({'error': 'Unauthorized'}), 401
    
    jam_night = JamNight.query.get_or_404(jam_night_id)
    data = request.json
    
    try:
        if 'date' in data:
            jam_night.date = datetime.strptime(data['date'], '%Y-%m-%d').date()
        if 'time_start' in data:
            jam_night.time_start = data['time_start']
        if 'time_end' in data:
            jam_night.time_end = data['time_end']
        if 'is_active' in data:
            jam_night.is_active = data['is_active']
        
        db.session.commit()
        return jsonify(jam_night.to_dict())
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/jam-nights/<int:jam_night_id>', methods=['GET'])
@login_required
def get_jam_night(jam_night_id):
    if current_user.role != 'admin':
        return jsonify({'error': 'Unauthorized'}), 401
    
    jam_night = JamNight.query.get_or_404(jam_night_id)
    return jsonify(jam_night.to_dict())

@app.route('/api/rooms', methods=['GET', 'POST'])
@login_required
def manage_rooms():
    if current_user.role not in ['admin', 'staff']:
        return jsonify({'error': 'Unauthorized'}), 403
    
    if request.method == 'GET':
        rooms = Room.query.all()
        return jsonify([room.to_dict() for room in rooms])
    
    if request.method == 'POST':
        data = request.get_json()
        if not data.get('name') or not data.get('capacity'):
            return jsonify({'error': 'Name and capacity are required'}), 400
        
        room = Room(
            name=data['name'],
            capacity=data['capacity'],
            description=data.get('description', '')
        )
        db.session.add(room)
        db.session.commit()
        return jsonify(room.to_dict()), 201

@app.route('/api/rooms/<int:room_id>', methods=['GET', 'PUT', 'DELETE'])
@login_required
def manage_room(room_id):
    if current_user.role not in ['admin', 'staff']:
        return jsonify({'error': 'Unauthorized'}), 403
    
    room = Room.query.get_or_404(room_id)
    
    if request.method == 'GET':
        return jsonify(room.to_dict())
    
    if request.method == 'PUT':
        data = request.get_json()
        if 'name' in data:
            room.name = data['name']
        if 'capacity' in data:
            room.capacity = data['capacity']
        if 'description' in data:
            room.description = data['description']
        
        db.session.commit()
        return jsonify(room.to_dict())
    
    if request.method == 'DELETE':
        db.session.delete(room)
        db.session.commit()
        return jsonify({'message': 'Room deleted successfully'}), 200

# Initialize default rooms if they don't exist
def initialize_default_rooms():
    with app.app_context():
        default_rooms = [
            {'name': 'Guitar Room', 'capacity': 6, 'description': 'Dedicated room for guitar lessons'},
            {'name': 'Bass Room', 'capacity': 6, 'description': 'Dedicated room for bass lessons'},
            {'name': 'Vocal Room', 'capacity': 6, 'description': 'Dedicated room for vocal lessons'},
            {'name': 'Drum Room', 'capacity': 6, 'description': 'Dedicated room for drum lessons'}
        ]
        
        for room_data in default_rooms:
            existing_room = Room.query.filter_by(name=room_data['name']).first()
            if not existing_room:
                new_room = Room(**room_data)
                db.session.add(new_room)
        
        db.session.commit()

def init_rooms():
    """Initialize the rooms table if it doesn't exist."""
    print("Initializing rooms table...")
    try:
        # Check if the rooms table exists and has any rooms
        if not Room.query.first():
            print("No rooms found. Initializing default rooms...")
            initialize_default_rooms()
        else:
            print(f"Found {Room.query.count()} existing rooms in the database.")
    except Exception as e:
        print(f"Error checking rooms table: {str(e)}")
        db.session.rollback()

# Call init_rooms when the application starts
with app.app_context():
    init_rooms()

@app.route('/admin/rooms')
@login_required
def get_rooms():
    """Display all rooms."""
    # Check if user is admin by role instead of is_admin flag
    if not session.get('user', {}).get('role') == 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    try:
        rooms = Room.query.all()
        print(f"Found {len(rooms)} rooms in database")
        rooms_data = [{
            'id': room.id,
            'name': room.name,
            'capacity': room.capacity,
            'description': room.description
        } for room in rooms]
        print("Returning rooms data:", rooms_data)
        return jsonify(rooms_data)  # Return array directly instead of wrapping in object
    except Exception as e:
        print(f"Error fetching rooms: {str(e)}")
        return jsonify({'error': 'Error fetching rooms'}), 500

@app.route('/check-session-availability', methods=['POST'])
def check_session_availability():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
            
        # Get required fields
        date = data.get('date')
        time = data.get('time')
        instrument = data.get('instrument')
        
        if not all([date, time]):
            return jsonify({'error': 'Missing required fields'}), 400
            
        # Convert date and time to datetime object
        try:
            requested_datetime = datetime.strptime(f"{date} {time}", "%Y-%m-%d %H:%M")
        except ValueError:
            return jsonify({'error': 'Invalid date or time format'}), 400
            
        # For band practice, check room capacity
        if instrument:
            # Get the room for this instrument
            room = Room.query.filter_by(name=f"{instrument} Room").first()
            if room:
                # Find existing group for this term and instrument
                term = Term.query.filter(
                    Term.start_date <= date,
                    Term.end_date >= date
                ).first()
                
                if term:
                    group_name = f"{term.name} - {instrument}"
                    group = Group.query.filter_by(name=group_name).first()
                    
                    if group:
                        # Count current members
                        current_members = GroupMember.query.filter_by(group_id=group.id).count()
                        if current_members >= room.capacity:
                            return jsonify({
                                'available': False,
                                'message': 'This time slot is fully booked'
                            })
        
        # Check for overlapping sessions
        existing_sessions = Session.query.filter_by(date=date).all()
        
        for session in existing_sessions:
            # Parse the session time
            try:
                session_time = datetime.strptime(session.time, "%H:%M").time()
                session_datetime = datetime.combine(requested_datetime.date(), session_time)
                
                # Check if times overlap (assuming 1.5 hour duration for band practice)
                if abs((session_datetime - requested_datetime).total_seconds()) < 5400:  # 1.5 hours = 5400 seconds
                    return jsonify({
                        'available': False,
                        'message': 'This time slot is already booked'
                    })
            except ValueError:
                continue
        
        return jsonify({
            'available': True,
            'message': 'Time slot is available'
        })
        
    except Exception as e:
        print(f"Error checking session availability: {str(e)}")
        return jsonify({'error': 'An error occurred while checking availability'}), 500

@app.route('/api/available-slots', methods=['GET'])
def get_available_slots():
    date = request.args.get('date')
    instrument = request.args.get('instrument')
    
    if not date:
        return jsonify({'error': 'Date parameter is required'}), 400
    
    # Generate all possible time slots (15-minute intervals from 9:00 to 21:00)
    all_slots = []
    start_time = datetime.strptime('09:00', '%H:%M')
    end_time = datetime.strptime('21:00', '%H:%M')
    
    current_time = start_time
    while current_time <= end_time:
        all_slots.append(current_time.strftime('%H:%M'))
        current_time += timedelta(minutes=15)
    
    # Find booked slots
    booked_slots = []
    existing_sessions = Session.query.filter(
        Session.date == date
    ).all()
    
    for session in existing_sessions:
        # Extract instrument from session title
        session_instrument = None
        if session.title:
            if " - " in session.title:
                # Format: "Name - Instrument"
                session_instrument = session.title.split(" - ")[1].strip()
            else:
                # Format: "Instrument PAYG Session"
                session_instrument = session.title.split()[0]
        
        # Only consider sessions with matching instrument
        if session_instrument and session_instrument.lower() == instrument.lower():
            session_start = datetime.strptime(session.time, '%H:%M')
            session_end = session_start + timedelta(minutes=session.duration)
            
            # Add all 15-minute slots that overlap with this session
            current = session_start
            while current < session_end:
                booked_slots.append(current.strftime('%H:%M'))
                current += timedelta(minutes=15)
    
    # Create response with availability for each slot
    available_slots = []
    for slot in all_slots:
        available_slots.append({
            'time': slot,
            'available': slot not in booked_slots
        })
    
    return jsonify(available_slots), 200

@app.route('/api/room-bookings/<room_name>', methods=['GET'])
@login_required
def get_room_bookings(room_name):
    """Get bookings for a specific room on a specific date."""
    # Check if user is admin or staff
    if 'user' not in session or session['user']['role'] not in ['admin', 'staff']:
        return jsonify({'error': 'Unauthorized'}), 403
    
    date = request.args.get('date')
    if not date:
        return jsonify({'error': 'Date parameter is required'}), 400
    
    try:
        print(f"DEBUG: Getting bookings for room '{room_name}' on date '{date}'")
        
        # Get current time for real-time status
        current_time = datetime.now().strftime('%H:%M')
        current_date = datetime.now().strftime('%Y-%m-%d')
        
        # Get the room by name
        room = Room.query.filter_by(name=room_name).first()
        if not room:
            return jsonify({
                'room_name': room_name,
                'date': date,
                'bookings': []
            })
        
        # Get all sessions for the specified date and room
        sessions = Session.query.filter_by(date=date, room_id=room.id).all()
        print(f"DEBUG: Found {len(sessions)} sessions for room {room_name} on date {date}")
        
        bookings = []
        
        for session_obj in sessions:
            print(f"DEBUG: Processing session: ID={session_obj.id}, Title={session_obj.title}")
            
            # Calculate session end time
            start_time = datetime.strptime(session_obj.time, '%H:%M')
            end_time = start_time + timedelta(minutes=session_obj.duration)
            end_time_str = end_time.strftime('%H:%M')
            
            # Determine if session is currently active
            is_active = False
            if date == current_date:
                session_start = datetime.strptime(session_obj.time, '%H:%M')
                session_end = session_start + timedelta(minutes=session_obj.duration)
                current = datetime.strptime(current_time, '%H:%M')
                is_active = session_start <= current <= session_end
            
            # Extract instrument from the last word of the title
            instrument = None
            if session_obj.title:
                instrument = session_obj.title.split()[-1].strip()
            
            # Handle group sessions
            if session_obj.group_id:
                group = db.session.get(Group, session_obj.group_id)
                if group:
                    # Count current members
                    current_members = GroupMember.query.filter_by(group_id=group.id).count()
                    
                    bookings.append({
                        'id': session_obj.id,
                        'name': group.name,
                        'time': session_obj.time,
                        'end_time': end_time_str,
                        'duration': session_obj.duration,
                        'instrument': instrument,
                        'is_group': True,
                        'current_members': current_members,
                        'capacity': room.capacity,
                        'is_full': current_members >= room.capacity,
                        'is_active': is_active
                    })
            else:
                # Handle individual sessions
                user = db.session.get(User, session_obj.user_id)
                user_name = user.username if user else "Unknown User"
                
                bookings.append({
                    'id': session_obj.id,
                    'name': user_name,
                    'time': session_obj.time,
                    'end_time': end_time_str,
                    'duration': session_obj.duration,
                    'instrument': instrument,
                    'is_group': False,
                    'is_active': is_active
                })
        
        # Sort bookings by time
        bookings.sort(key=lambda x: x['time'])
        print(f"DEBUG: Returning {len(bookings)} bookings for room '{room_name}'")
        
        return jsonify({
            'room_name': room_name,
            'date': date,
            'bookings': bookings
        })
    except Exception as e:
        print(f"ERROR in get_room_bookings: {str(e)}")
        return jsonify({'error': str(e)}), 500

# Term API Routes
@app.route('/api/terms', methods=['GET'])
@login_required
def get_terms():
    terms = Term.query.order_by(Term.display_order.asc()).all()
    return jsonify([term.to_dict() for term in terms])

@app.route('/api/terms', methods=['POST'])
@login_required
def add_term():
    """Add a new term."""
    # Check if user is admin
    if 'user' not in session or session['user']['role'] != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    try:
        data = request.json
        
        # Validate required fields
        if not data or 'name' not in data or 'start_date' not in data or 'end_date' not in data:
            return jsonify({'error': 'Missing required fields'}), 400
        
        # Create new term
        new_term = Term(
            name=data['name'],
            start_date=datetime.strptime(data['start_date'], '%Y-%m-%d').date(),
            end_date=datetime.strptime(data['end_date'], '%Y-%m-%d').date(),
            duration_weeks=data.get('duration_weeks', 10),  # Default to 10 weeks
            has_break=data.get('has_break', False)
        )
        
        # Handle break dates if has_break is True
        if new_term.has_break:
            if 'break_start_date' not in data or 'break_end_date' not in data:
                return jsonify({'error': 'Break dates are required when has_break is True'}), 400
            
            new_term.break_start_date = datetime.strptime(data['break_start_date'], '%Y-%m-%d').date()
            new_term.break_end_date = datetime.strptime(data['break_end_date'], '%Y-%m-%d').date()
        
        db.session.add(new_term)
        db.session.commit()
        
        return jsonify(new_term.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/terms/<int:term_id>', methods=['DELETE'])
@login_required
def delete_term(term_id):
    """Delete a term."""
    # Check if user is admin
    if 'user' not in session or session['user']['role'] != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    try:
        term = Term.query.get_or_404(term_id)
        db.session.delete(term)
        db.session.commit()
        return jsonify({'message': 'Term deleted successfully'})
    except Exception as e:
        db.session.rollback()
        print(f"Error deleting term: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/terms/<int:term_id>', methods=['PUT'])
@login_required
def update_term(term_id):
    """Update a term."""
    # Check if user is admin
    if 'user' not in session or session['user']['role'] != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    try:
        term = Term.query.get_or_404(term_id)
        data = request.json
        
        if 'name' in data:
            term.name = data['name']
        
        if 'start_date' in data:
            term.start_date = datetime.strptime(data['start_date'], '%Y-%m-%d').date()
        
        if 'end_date' in data:
            term.end_date = datetime.strptime(data['end_date'], '%Y-%m-%d').date()
        
        if 'duration_weeks' in data:
            term.duration_weeks = data['duration_weeks']
        
        # Handle break fields
        if 'has_break' in data:
            term.has_break = data['has_break']
            
            # If has_break is changed to True, require break dates
            if term.has_break and ('break_start_date' not in data or 'break_end_date' not in data):
                return jsonify({'error': 'Break dates are required when has_break is True'}), 400
            
            # Update break dates if provided
            if term.has_break:
                term.break_start_date = datetime.strptime(data['break_start_date'], '%Y-%m-%d').date()
                term.break_end_date = datetime.strptime(data['break_end_date'], '%Y-%m-%d').date()
            else:
                # Clear break dates if has_break is False
                term.break_start_date = None
                term.break_end_date = None
        
        db.session.commit()
        return jsonify(term.to_dict())
    except Exception as e:
        db.session.rollback()
        print(f"Error updating term: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/terms/<int:term_id>', methods=['GET'])
@login_required
def get_term(term_id):
    """Get a single term by ID."""
    try:
        term = Term.query.get_or_404(term_id)
        return jsonify(term.to_dict())
    except Exception as e:
        print(f"Error fetching term: {str(e)}")
        return jsonify({'error': str(e)}), 500

def format_course_name(course):
    """Format course name for display."""
    course_names = {
        'guitar': 'Guitar',
        'bass': 'Bass',
        'drums': 'Drums',
        'vocals': 'Vocals',
        'band_classes': 'Band Classes'
    }
    return course_names.get(course.lower(), course)

@app.route('/api/materials/categories', methods=['GET'])
def get_material_categories():
    """Get all unique material categories"""
    if 'user' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    # Get all materials
    materials = Material.query.all()
    
    # Extract unique categories
    categories = set()
    for material in materials:
        if material.category:
            categories.add(material.category)
    
    return jsonify(list(categories))

@app.route('/api/terms/reorder', methods=['POST'])
@login_required
def reorder_terms():
    if request.method == 'POST':
        try:
            data = request.get_json()
            new_order = data.get('order', [])
            
            # Update the order of each term
            for term_data in new_order:
                term_id = term_data.get('id')
                order = term_data.get('order')
                
                term = db.session.get(Term, term_id)
                if term:
                    term.display_order = order
            
            db.session.commit()
            return jsonify({'success': True})
            
        except Exception as e:
            db.session.rollback()
            print(f"Error reordering terms: {e}")
            return jsonify({'success': False, 'error': str(e)}), 500
    
    return jsonify({'success': False, 'error': 'Invalid request method'}), 405

@app.route('/electricguitar')
def electricguitar():
    single_lesson_price = get_price('electric_guitar_lesson')
    if single_lesson_price == 0:
        single_lesson_price = 35
    package_price = get_price('guitar_package')  # Using same package price as guitar
    if package_price == 0:
        package_price = 300
    return render_template('electricguitar.html', single_lesson_price=single_lesson_price, package_price=package_price)

@app.route('/bassguitar')
def bassguitar():
    single_lesson_price = get_price('bass_lesson')
    if single_lesson_price == 0:
        single_lesson_price = 35
    package_price = get_price('bass_package')
    if package_price == 0:
        package_price = 350
    return render_template('bass.html', single_lesson_price=single_lesson_price, package_price=package_price)

@app.route('/student/settings')
def student_settings():
    if 'user' not in session:
        return redirect(url_for('signin'))
    
    if session['user']['role'] != 'student':
        return redirect(url_for('dashboard'))
    
    # Get user's data
    user = db.session.get(User, session['user']['id'])
    user_data = {
        'id': user.id,
        'username': user.username,
        'email': user.email,
        'instrument_id': user.instrument_id,
        'instrument': user.instrument.name if user.instrument else None
    }
    
    return render_template('student_settings.html', user=user_data)

@app.route('/api/student/settings', methods=['PUT', 'DELETE'])
def student_settings_api():
    if 'user' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    if session['user']['role'] != 'student':
        return jsonify({'error': 'Unauthorized'}), 401
    
    user = db.session.get(User, session['user']['id'])
    
    if request.method == 'PUT':
        try:
            data = request.get_json()
            if not data:
                return jsonify({'error': 'No data provided'}), 400
            
            # Update user data
            if 'email' in data:
                user.email = data['email']
            if 'username' in data:
                user.username = data['username']
            if 'instrument_id' in data:
                user.instrument_id = data['instrument_id']
            
            # Update password if provided
            if data.get('password') and data.get('confirm_password'):
                if data['password'] != data['confirm_password']:
                    return jsonify({'error': 'Passwords do not match'}), 400
                user.set_password(data['password'])
            
            db.session.commit()
            return jsonify({'message': 'Settings updated successfully'})
            
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': str(e)}), 500
            
    elif request.method == 'DELETE':
        try:
            # Delete user's data
            db.session.delete(user)
            db.session.commit()
            session.clear()
            return jsonify({'message': 'Account deleted successfully'})
            
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': str(e)}), 500

@app.route('/api/student/settings/export')
def export_student_data():
    if 'user' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    if session['user']['role'] != 'student':
        return jsonify({'error': 'Unauthorized'}), 401
    
    try:
        user = db.session.get(User, session['user']['id'])
        # Get group IDs for this student
        group_ids = [gm.group_id for gm in GroupMember.query.filter_by(student_id=user.id).all()]
        # Get all group sessions for these groups
        group_sessions = Session.query.filter(Session.group_id.in_(group_ids)).all() if group_ids else []
        # Get all user data
        user_data = {
            'personal_info': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'instrument_id': user.instrument_id,
                'instrument': user.instrument.name if user.instrument else None
            },
            'sessions': [session.to_dict() for session in user.sessions],
            'group_sessions': [session.to_dict() for session in group_sessions],
            'materials': [material.to_dict() for material in user.materials],
            'allocated_materials': [allocation.to_dict() for allocation in user.allocated_materials]
        }
        # Create response with JSON data
        response = make_response(jsonify(user_data))
        response.headers['Content-Disposition'] = 'attachment; filename=my-data-export.json'
        return response
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/subscribe', methods=['POST'])
def subscribe():
    """Handle newsletter subscription"""
    try:
        email = request.form.get('email')
        
        if not email:
            return jsonify({'error': 'Email is required'}), 400
            
        # Check if email is already subscribed
        existing_subscriber = Subscriber.query.filter_by(email=email).first()
        if existing_subscriber:
            if existing_subscriber.is_active:
                return jsonify({'error': 'This email is already subscribed'}), 400
            else:
                # Reactivate existing subscription
                existing_subscriber.is_active = True
                db.session.commit()
                return jsonify({'message': 'Subscription reactivated successfully'}), 200
        
        # Create new subscriber
        new_subscriber = Subscriber(email=email)
        db.session.add(new_subscriber)
        db.session.commit()
        
        # Send confirmation email
        try:
            send_subscription_confirmation_email(email)
        except Exception as e:
            print(f"Error sending subscription confirmation email: {str(e)}")
            # Don't fail the subscription if email sending fails
        
        return jsonify({'message': 'Successfully subscribed to newsletter'}), 200
        
    except Exception as e:
        db.session.rollback()
        print(f"Error in subscription: {str(e)}")
        return jsonify({'error': 'An error occurred while processing your subscription'}), 500

@app.route('/unsubscribe', methods=['POST'])
def unsubscribe():
    """Handle newsletter unsubscription"""
    try:
        email = request.form.get('email')
        
        if not email:
            return jsonify({'error': 'Email is required'}), 400
            
        # Find and deactivate subscription
        subscriber = Subscriber.query.filter_by(email=email).first()
        if not subscriber:
            return jsonify({'error': 'Email not found in our subscription list'}), 404
            
        subscriber.is_active = False
        db.session.commit()
        
        return jsonify({'message': 'Successfully unsubscribed from newsletter'}), 200
        
    except Exception as e:
        db.session.rollback()
        print(f"Error in unsubscription: {str(e)}")
        return jsonify({'error': 'An error occurred while processing your unsubscription'}), 500

def send_subscription_confirmation_email(email):
    """Send subscription confirmation email"""
    try:
        subject = "Welcome to Our Newsletter!"
        message = f"""
        Thank you for subscribing to our newsletter!
        
        You will now receive updates about:
        - New courses and workshops
        - Special events and performances
        - Important announcements
        - And much more!
        
        If you wish to unsubscribe at any time, simply reply to this email.
        
        Best regards,
        The Music School Team
        """
        
        msg = Message(
            subject=subject,
            recipients=[email],
            body=message
        )
        mail.send(msg)
        return True
        
    except Exception as e:
        print(f"Error sending subscription confirmation email: {str(e)}")
        return False

@app.route('/api/newsletter/subscribe', methods=['POST'])
def api_subscribe():
    """Handle newsletter subscription via API"""
    try:
        data = request.get_json()
        email = data.get('email')
        
        if not email:
            return jsonify({'error': 'Email is required'}), 400
            
        # Check if email is already subscribed
        existing_subscriber = Subscriber.query.filter_by(email=email).first()
        if existing_subscriber:
            if existing_subscriber.is_active:
                return jsonify({'error': 'This email is already subscribed'}), 400
            else:
                # Reactivate existing subscription
                existing_subscriber.is_active = True
                db.session.commit()
                return jsonify({'message': 'Subscription reactivated successfully'}), 200
        
        # Create new subscriber
        new_subscriber = Subscriber(email=email)
        db.session.add(new_subscriber)
        db.session.commit()
        
        # Send confirmation email
        try:
            send_subscription_confirmation_email(email)
        except Exception as e:
            print(f"Error sending subscription confirmation email: {str(e)}")
            # Don't fail the subscription if email sending fails
        
        return jsonify({'message': 'Successfully subscribed to newsletter'}), 200
        
    except Exception as e:
        db.session.rollback()
        print(f"Error in subscription: {str(e)}")
        return jsonify({'error': 'An error occurred while processing your subscription'}), 500

@app.route('/api/newsletter/unsubscribe', methods=['POST'])
def api_unsubscribe():
    """Handle newsletter unsubscription via API"""
    try:
        data = request.get_json()
        email = data.get('email')
        
        if not email:
            return jsonify({'error': 'Email is required'}), 400
            
        # Find and deactivate subscription
        subscriber = Subscriber.query.filter_by(email=email).first()
        if not subscriber:
            return jsonify({'error': 'Email not found in our subscription list'}), 404
            
        subscriber.is_active = False
        db.session.commit()
        
        return jsonify({'message': 'Successfully unsubscribed from newsletter'}), 200
        
    except Exception as e:
        db.session.rollback()
        print(f"Error in unsubscription: {str(e)}")
        return jsonify({'error': 'An error occurred while processing your unsubscription'}), 500

@app.route('/test-db-ssl')
def test_db_ssl():
    try:
        # Execute a query to check SSL status
        result = db.session.execute(db.text("SHOW STATUS LIKE 'Ssl_cipher'")).fetchone()
        if result and result[1]:
            return f"SSL is enabled. Cipher: {result[1]}"
        return "SSL is not enabled"
    except Exception as e:
        return f"Error: {str(e)}"

@app.route('/test-db-ssl-details')
def test_db_ssl_details():
    try:
        ssl_vars = [
            'Ssl_cipher',
            'Ssl_version',
            'Ssl_session_cache_mode',
            'Ssl_session_cache_timeout',
            'Ssl_session_cache_size',
            'Ssl_accept_renegotiates',
            'Ssl_accepts',
            'Ssl_finished_accepts'
        ]
        
        results = {}
        for var in ssl_vars:
            result = db.session.execute(db.text(f"SHOW STATUS LIKE '{var}'")).fetchone()
            if result:
                results[var] = result[1]
        
        return jsonify({
            'status': 'success',
            'ssl_details': results
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/feedback', methods=['GET'])
@login_required
def feedback():
    if current_user.role not in ['admin', 'staff']:
        abort(403)
    students = User.query.filter_by(role='student').all()
    groups = Group.query.all()
    feedbacks = Feedback.query.order_by(Feedback.created_at.desc()).all()
    # Group feedbacks by student and group, and include author_username
    feedback_by_student = {}
    feedback_by_group = {}
    for fb in feedbacks:
        author_username = fb.author.username if fb.author else f"User {fb.author_id}"
        fb_dict = {
            'id': fb.id,
            'created_at': fb.created_at,
            'author_username': author_username,
            'author_id': fb.author_id,
            'content': fb.content
        }
        if fb.student_id:
            feedback_by_student.setdefault(fb.student_id, []).append(fb_dict)
        if fb.group_id:
            feedback_by_group.setdefault(fb.group_id, []).append(fb_dict)
    return render_template('feedback.html', students=students, groups=groups, feedback_by_student=feedback_by_student, feedback_by_group=feedback_by_group)

@app.route('/api/feedback', methods=['POST'])
@login_required
def api_feedback():
    try:
        data = request.get_json()
        
        feedback = Feedback(
            student_id=data.get('student_id') if data.get('student_id') else None,
            group_id=data.get('group_id') if data.get('group_id') else None,
            author_id=current_user.id,
            content=data['content']
        )
        
        db.session.add(feedback)
        db.session.commit()
        
        return jsonify({'success': True, 'feedback': feedback.to_dict()})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/feedback/<int:feedback_id>', methods=['DELETE'])
@login_required
def delete_feedback(feedback_id):
    feedback = Feedback.query.get_or_404(feedback_id)
    # Only allow admin to delete any feedback, staff can only delete their own
    if current_user.role == 'admin' or (current_user.role == 'staff' and feedback.author_id == current_user.id):
        db.session.delete(feedback)
        db.session.commit()
        return jsonify({'success': True})
    else:
        return jsonify({'error': 'Unauthorized'}), 403

@app.route('/admin/newsletter', methods=['GET', 'POST'])
@login_required
def admin_newsletter():
    if current_user.role != 'admin':
        flash('Access denied. Only administrators can access this page.', 'error')
        return redirect(url_for('home'))
    
    if request.method == 'POST':
        subject = request.form.get('subject')
        content = request.form.get('content')
        attachment = request.files.get('attachment')
        
        if not subject or not content:
            flash('Subject and content are required.', 'error')
            return redirect(url_for('admin_newsletter'))
        
        try:
            # Get all active subscribers
            subscribers = Subscriber.query.filter_by(is_active=True).all()
            recipient_emails = [sub.email for sub in subscribers]
            
            if not recipient_emails:
                flash('No active subscribers found.', 'error')
                return redirect(url_for('admin_newsletter'))
            
            # Create message
            msg = Message(
                subject=subject,
                recipients=recipient_emails,
                body=content,
                html=content
            )
            
            # Handle attachment if provided
            if attachment and attachment.filename:
                msg.attach(
                    attachment.filename,
                    'application/octet-stream',
                    attachment.read()
                )
            
            # Send email
            mail.send(msg)
            
            flash(f'Newsletter sent successfully to {len(recipient_emails)} subscribers.', 'success')
        except Exception as e:
            flash(f'Error sending newsletter: {str(e)}', 'error')
            print(f"Error sending newsletter: {str(e)}")
            print(f"Full traceback: {traceback.format_exc()}")
    
    # Get all subscribers and count of active ones
    subscribers = Subscriber.query.order_by(Subscriber.date_subscribed.desc()).all()
    active_subscribers = sum(1 for sub in subscribers if sub.is_active)
    
    return render_template('admin/newsletter.html', 
                         subscribers=subscribers,
                         active_subscribers=active_subscribers)

def send_newsletter(subject, content, attachment=None):
    """Send newsletter to all active subscribers"""
    try:
        # Get all active subscribers
        subscribers = Subscriber.query.filter_by(is_active=True).all()
        recipient_emails = [sub.email for sub in subscribers]
        
        # Create message
        msg = Message(
            subject=subject,
            recipients=recipient_emails,
            body=content
        )
        
        # Handle attachment if provided
        if attachment and attachment.filename:
            filename = secure_filename(attachment.filename)
            msg.attach(
                filename,
                attachment.content_type,
                attachment.read()
            )
        
        # Send email
        mail.send(msg)
        return True, len(recipient_emails)
        
    except Exception as e:
        print(f"Error sending newsletter: {str(e)}")
        return False, 0

class LuthierPrices(db.Model):
    __tablename__ = 'luthier_prices'
    
    id = db.Column(db.Integer, primary_key=True)
    service_name = db.Column(db.String(100), nullable=False)
    pounds = db.Column(db.Integer, nullable=True)
    pence = db.Column(db.Integer, nullable=True)
    description = db.Column(db.Text)
    category = db.Column(db.String(50), nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(pytz.timezone('Europe/London')))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(pytz.timezone('Europe/London')), onupdate=lambda: datetime.now(pytz.timezone('Europe/London')))

class Event(db.Model):
    __tablename__ = 'events'
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=False)
    date = db.Column(db.Date, nullable=False)
    time = db.Column(db.String(10), nullable=False)
    price = db.Column(db.Numeric(10, 2), nullable=True)  # 10 digits total, 2 decimal places, nullable
    image_url = db.Column(db.String(500), nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(pytz.timezone('Europe/London')))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(pytz.timezone('Europe/London')), onupdate=lambda: datetime.now(pytz.timezone('Europe/London')))

    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'date': self.date.strftime('%Y-%m-%d'),
            'time': self.time,
            'price': float(self.price) if self.price is not None else None,
            'image_url': self.image_url,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }

@app.route('/admin/events', methods=['GET', 'POST'])
@login_required
def admin_events():
    if current_user.role != 'admin':
        abort(403)
    
    if request.method == 'POST':
        title = request.form.get('title')
        description = request.form.get('description')
        date = datetime.strptime(request.form.get('date'), '%Y-%m-%d').date()
        time = request.form.get('time')
        price = request.form.get('price')
        image = request.files.get('image')
        image_url = None

        if image and image.filename:
            try:
                service = get_google_drive_service()
                # Only use Events Page folder at the root
                events_folder = service.files().list(
                    q="name='Events Page' and mimeType='application/vnd.google-apps.folder' and 'root' in parents and trashed=false",
                    fields="files(id, name)"
                ).execute()
                if not events_folder.get('files'):
                    # Create Events Page folder at root if not found
                    events_folder_id = create_folder(service, 'Events Page')
                else:
                    events_folder_id = events_folder['files'][0]['id']
                # Save image to temp file
                temp_path = os.path.join(app.root_path, 'temp', secure_filename(image.filename))
                os.makedirs(os.path.dirname(temp_path), exist_ok=True)
                image.save(temp_path)
                # Upload to Google Drive
                mime_type = image.content_type or 'application/octet-stream'
                file_id = upload_file(
                    service=service,
                    file_path=temp_path,
                    file_name=secure_filename(image.filename),
                    mime_type=mime_type,
                    folder_id=events_folder_id
                )
                if os.path.exists(temp_path):
                    os.remove(temp_path)
                image_url = f'https://drive.google.com/uc?id={file_id}'
            except Exception as e:
                flash(f'Error uploading image: {str(e)}', 'error')
                return redirect(url_for('admin_events'))
        # Create the event
        event = Event(
            title=title,
            description=description,
            date=date,
            time=time,
            price=float(price) if price else None,
            image_url=image_url
        )
        db.session.add(event)
        db.session.commit()
        flash('Event created successfully!', 'success')
        return redirect(url_for('admin_events'))
    # GET request - show all events
    events = Event.query.order_by(Event.date.asc(), Event.time.asc()).all()
    return render_template('admin/events.html', events=events)

@app.route('/admin/events/<int:event_id>/edit', methods=['GET', 'POST'])
@login_required
def edit_event(event_id):
    if current_user.role != 'admin':
        abort(403)
    event = Event.query.get_or_404(event_id)
    if request.method == 'POST':
        event.title = request.form.get('title')
        event.description = request.form.get('description')
        event.date = datetime.strptime(request.form.get('date'), '%Y-%m-%d').date()
        event.time = request.form.get('time')
        price = request.form.get('price')
        event.price = float(price) if price else None
        image = request.files.get('image')
        if image and image.filename:
            # Upload to Google Drive under MPA Materials/Events Page
            service = get_google_drive_service()
            # Get or create MPA Materials folder
            main_folder = service.files().list(
                q="name='MPA Materials' and mimeType='application/vnd.google-apps.folder' and trashed=false",
                fields="files(id, name)"
            ).execute()
            
            if not main_folder.get('files'):
                mpa_folder_id = create_folder(service, "MPA Materials")
            else:
                mpa_folder_id = main_folder['files'][0]['id']
            
            # Get or create the Events Page folder
            events_folder = service.files().list(
                q=f"name='Events Page' and '{mpa_folder_id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false",
                fields="files(id, name)"
            ).execute()
            
            if not events_folder.get('files'):
                events_folder_id = create_folder(service, "Events Page", mpa_folder_id)
            else:
                events_folder_id = events_folder['files'][0]['id']
                
            # Save image to temp file
            temp_path = os.path.join(app.root_path, 'temp', secure_filename(image.filename))
            os.makedirs(os.path.dirname(temp_path), exist_ok=True)
            image.save(temp_path)
            
            # Upload to Google Drive
            mime_type = image.content_type or 'application/octet-stream'
            file_id = upload_file(
                service=service,
                file_path=temp_path,
                file_name=secure_filename(image.filename),
                mime_type=mime_type,
                folder_id=events_folder_id
            )
            
            # Clean up temporary file
            if os.path.exists(temp_path):
                os.remove(temp_path)
                
            # Create the direct access URL
            image_url = f'https://drive.google.com/uc?id={file_id}'
        db.session.commit()
        flash('Event updated successfully!', 'success')
        return redirect(url_for('admin_events'))
    return render_template('admin/edit_event.html', event=event)

@app.route('/admin/events/<int:event_id>/delete', methods=['POST'])
@login_required
def delete_event(event_id):
    if current_user.role != 'admin':
        abort(403)
    event = Event.query.get_or_404(event_id)
    
    # Delete the image from Google Drive if it exists
    if event.image_url and 'drive.google.com/uc?id=' in event.image_url:
        try:
            file_id = event.image_url.split('id=')[-1]
            service = get_google_drive_service()
            delete_file(service, file_id)
            print(f"Deleted file from Google Drive with ID: {file_id}")
        except Exception as e:
            print(f"Error deleting file from Google Drive: {str(e)}")
            # Continue with event deletion even if image deletion fails
    
    db.session.delete(event)
    db.session.commit()
    flash('Event deleted successfully', 'success')
    return redirect(url_for('admin_events'))

@app.route('/events')
def events():
    next_event = Event.query.filter(Event.date >= datetime.now(pytz.timezone('Europe/London')).date()).order_by(Event.date.asc(), Event.time.asc()).first()
    return render_template('events.html', next_event=next_event)

# Create the events table if it doesn't exist
with app.app_context():
    db.create_all()



@app.route('/api/sessions/<int:session_id>/attendance', methods=['GET'])
@login_required
def get_session_attendance(session_id):
    if current_user.role not in ['admin', 'staff']:
        return jsonify({'error': 'Unauthorized'}), 403
        
    session = Session.query.get_or_404(session_id)
    attendances = Attendance.query.filter_by(session_id=session_id).all()
    
    return jsonify([attendance.to_dict() for attendance in attendances])

@app.route('/api/sessions/<int:session_id>/attendance', methods=['POST'])
@login_required
def record_attendance(session_id):
    if current_user.role not in ['admin', 'staff']:
        return jsonify({'error': 'Unauthorized'}), 403
        
    data = request.get_json()
    if not data or 'student_id' not in data or 'status' not in data:
        return jsonify({'error': 'Missing required fields'}), 400
        
    # Check if attendance record already exists
    existing = Attendance.query.filter_by(
        session_id=session_id,
        student_id=data['student_id']
    ).first()
    
    if existing:
        # Update existing record
        existing.status = data['status']
        existing.notes = data.get('notes')
        existing.recorded_by = current_user.id
        existing.recorded_at = datetime.now(pytz.timezone('Europe/London'))
    else:
        # Create new record
        attendance = Attendance(
            session_id=session_id,
            student_id=data['student_id'],
            status=data['status'],
            notes=data.get('notes'),
            recorded_by=current_user.id
        )
        db.session.add(attendance)
    
    try:
        db.session.commit()
        return jsonify({'message': 'Attendance recorded successfully'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/sessions/<int:session_id>/attendance/bulk', methods=['POST'])
@login_required
def record_bulk_attendance(session_id):
    if current_user.role not in ['admin', 'staff']:
        return jsonify({'error': 'Unauthorized'}), 403
        
    data = request.get_json()
    if not data or not isinstance(data, list):
        return jsonify({'error': 'Invalid data format'}), 400
        
    try:
        for record in data:
            if 'student_id' not in record or 'status' not in record:
                continue
                
            existing = Attendance.query.filter_by(
                session_id=session_id,
                student_id=record['student_id']
            ).first()
            
            if existing:
                existing.status = record['status']
                existing.notes = record.get('notes')
                existing.recorded_by = current_user.id
                existing.recorded_at = datetime.now(pytz.timezone('Europe/London'))
            else:
                attendance = Attendance(
                    session_id=session_id,
                    student_id=record['student_id'],
                    status=record['status'],
                    notes=record.get('notes'),
                    recorded_by=current_user.id
                )
                db.session.add(attendance)
        
        db.session.commit()
        return jsonify({'message': 'Attendance records updated successfully'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/sessions/<int:session_id>/attendance', methods=['POST'])
@login_required
def record_attendance_form(session_id):
    if current_user.role not in ['admin', 'staff']:
        flash('You do not have permission to record attendance.', 'error')
        return redirect(url_for('dashboard'))
    
    # Get the session
    class_session = Session.query.get_or_404(session_id)
    
    # Check if we received form data or JSON data
    if request.content_type and 'application/json' in request.content_type:
        # Handle JSON data (from AJAX requests)
        data = request.get_json()
        if isinstance(data, list):
            try:
                for record in data:
                    if 'student_id' not in record or 'status' not in record:
                        continue
                        
                    existing = Attendance.query.filter_by(
                        session_id=session_id,
                        student_id=record['student_id']
                    ).first()
                    
                    if existing:
                        existing.status = record['status']
                        existing.notes = record.get('notes', '')
                        existing.recorded_by = current_user.id
                        existing.recorded_at = datetime.now(pytz.timezone('Europe/London'))
                    else:
                        attendance = Attendance(
                            session_id=session_id,
                            student_id=record['student_id'],
                            status=record['status'],
                            notes=record.get('notes', ''),
                            recorded_by=current_user.id
                        )
                        db.session.add(attendance)
                
                db.session.commit()
                return jsonify({'message': 'Attendance records updated successfully'})
            except Exception as e:
                db.session.rollback()
                return jsonify({'error': str(e)}), 500
    else:
        # Process form data for each student
        for key, value in request.form.items():
            if key.startswith('status_'):
                student_id = int(key.replace('status_', ''))
                status = value
                notes = request.form.get(f'notes_{student_id}', '')
                
                # Check if an attendance record already exists
                existing = Attendance.query.filter_by(
                    session_id=session_id,
                    student_id=student_id
                ).first()
                
                if existing:
                    # Update existing record
                    existing.status = status
                    existing.notes = notes
                    existing.recorded_by = current_user.id
                    existing.recorded_at = datetime.now(pytz.timezone('Europe/London'))
                else:
                    # Create new record
                    attendance = Attendance(
                        session_id=session_id,
                        student_id=student_id,
                        status=status,
                        notes=notes,
                        recorded_by=current_user.id
                    )
                    db.session.add(attendance)
        
        try:
            db.session.commit()
            flash('Attendance recorded successfully', 'success')
        except Exception as e:
            db.session.rollback()
            flash(f'Error recording attendance: {str(e)}', 'error')
        
        return redirect(url_for('view_attendance', session_id=session_id))

@app.route('/sessions/<int:session_id>/attendance')
@login_required
def view_attendance(session_id):
    if current_user.role not in ['admin', 'staff']:
        flash('You do not have permission to view attendance records.', 'error')
        return redirect(url_for('dashboard'))
        
    class_session = Session.query.get_or_404(session_id)
    group = class_session.group
    students = []
    
    # Get the room name
    room_name = None
    if class_session.room_id:
        room = db.session.get(Room, class_session.room_id)
        if room:
            room_name = room.name
    
    if group:
        # Get students from the group
        group_members = GroupMember.query.filter_by(group_id=group.id).all()
        for member in group_members:
            student = db.session.get(User, member.student_id)
            if student:
                students.append(student)
    else:
        # If no group, get the student from the session
        if class_session.user_id:
            student = db.session.get(User, class_session.user_id)
            if student:
                students = [student]
    
    # Get existing attendance records
    attendance_records = {a.student_id: a for a in Attendance.query.filter_by(session_id=session_id).all()}
    
    return render_template('attendance.html', 
                         class_session=class_session,
                         students=students,
                         attendance_records=attendance_records,
                         room_name=room_name)

@app.route('/admin/attendance-analytics')
@login_required
def attendance_analytics():
    if current_user.role not in ['admin', 'staff']:
        flash('You are not authorized to access this page.', 'error')
        return redirect(url_for('dashboard'))
    
    return render_template('admin/attendance_analytics.html')

# API endpoint to get attendance data
@app.route('/api/attendance')
@login_required
def get_attendance_data():
    if current_user.role not in ['admin', 'staff']:
        return jsonify({'error': 'Unauthorized'}), 403
    
    # Get query parameters
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    student_id = request.args.get('student_id')
    instrument = request.args.get('instrument')
    status = request.args.get('status')
    group_id = request.args.get('group_id')
    room_id = request.args.get('room_id')
    
    # Use SQLAlchemy ORM instead of raw SQL
    try:
        # Start with a base query
        query = db.session.query(
            Attendance,
            User.username.label('student_name'),
            Session.date,
            Session.time,
            Instrument.name.label('instrument_name'),
            Session.group_id,
            Session.duration,
            Session.room_id,
            Room.name.label('room_name')
        ).join(
            Session, Attendance.session_id == Session.id
        ).join(
            User, Attendance.student_id == User.id
        ).outerjoin(
            Room, Session.room_id == Room.id
        ).outerjoin(
            Instrument, Session.instrument_id == Instrument.id
        )
        
        # Apply filters
        if start_date:
            query = query.filter(Session.date >= start_date)
        
        if end_date:
            query = query.filter(Session.date <= end_date)
        
        if student_id:
            query = query.filter(Attendance.student_id == student_id)
        
        if instrument:
            query = query.filter(Instrument.name == instrument)
        
        if status:
            query = query.filter(Attendance.status == status)
        
        if group_id:
            query = query.filter(Session.group_id == group_id)
        
        if room_id:
            query = query.filter(Session.room_id == room_id)
        
        # Order by date and time
        query = query.order_by(Session.date.desc(), Session.time.asc())
        
        # Execute the query
        results = query.all()
        
        # Format the results
        attendance_records = []
        for result in results:
            attendance = result[0]  # The Attendance object
            student_name = result[1]
            date = result[2]
            time = result[3]
            instrument_name = result[4]
            group_id = result[5]
            duration = result[6]
            room_id = result[7]
            room_name = result[8]
            
            session_type = 'group' if group_id else 'individual'
            
            record = {
                'id': attendance.id,
                'session_id': attendance.session_id,
                'student_id': attendance.student_id,
                'student_name': student_name,
                'status': attendance.status,
                'notes': attendance.notes,
                'invoiced': attendance.invoiced,
                'date': date,
                'time': time,
                'instrument': instrument_name,
                'group_id': group_id,
                'duration': duration,
                'room_id': room_id,
                'room_name': room_name,
                'session_type': session_type
            }
            
            attendance_records.append(record)
        
        return jsonify(attendance_records)
    except Exception as e:
        app.logger.error(f"Error in get_attendance_data: {str(e)}")
        return jsonify({'error': str(e)}), 500

# API endpoint to update attendance
@app.route('/api/attendance/<int:record_id>', methods=['PATCH'])
@login_required
def update_attendance_record(record_id):
    if current_user.role not in ['admin', 'staff']:
        return jsonify({'error': 'Unauthorized'}), 403
    
    data = request.json
    
    # Validate data
    if 'status' not in data or data['status'] not in ['present', 'absent', 'late', 'excused']:
        return jsonify({'error': 'Invalid status'}), 400
    
    # Update record
    attendance = db.session.get(Attendance, record_id)
    if not attendance:
        return jsonify({'error': 'Attendance record not found'}), 404
    
    attendance.status = data['status']
    attendance.notes = data.get('notes', '')
    attendance.invoiced = data.get('invoiced', False)
    attendance.recorded_at = datetime.now(pytz.timezone('Europe/London'))
    
    db.session.commit()
    
    return jsonify({'message': 'Attendance record updated successfully'})

# API endpoint to get current term dates
@app.route('/api/current-term')
@login_required
def get_current_term():
    if current_user.role not in ['admin', 'staff']:
        return jsonify({'error': 'Unauthorized'}), 403
    
    # Query to find current term based on current date
    current_term = Term.query.filter(
        Term.start_date <= datetime.now(pytz.timezone('Europe/London')).date(),
        Term.end_date >= datetime.now(pytz.timezone('Europe/London')).date()
    ).order_by(Term.display_order).first()
    
    if not current_term:
        # If no current term, return upcoming term or most recent term
        upcoming_term = Term.query.filter(
            Term.start_date > datetime.now(pytz.timezone('Europe/London')).date()
        ).order_by(Term.start_date).first()
        
        if upcoming_term:
            return jsonify(upcoming_term.to_dict())
            
        # If no upcoming term, get the most recent past term
        past_term = Term.query.filter(
            Term.end_date < datetime.now(pytz.timezone('Europe/London')).date()
        ).order_by(Term.end_date.desc()).first()
        
        if past_term:
            return jsonify(past_term.to_dict())
            
        return jsonify({})
    
    return jsonify(current_term.to_dict())

# API endpoint to get students for filters
@app.route('/api/students')
@login_required
def get_students_api():
    if current_user.role not in ['admin', 'staff']:
        return jsonify({'error': 'Unauthorized'}), 403
    
    try:
        app.logger.info("API students endpoint called by user ID: %s", current_user.id)
        
        # Get all student users
        students = User.query.filter_by(role='student').all()
        app.logger.info("Found %d students in database", len(students))
        
        # Format the response
        student_data = []
        for student in students:
            student_dict = student.to_dict()
            student_data.append({
                'id': student_dict['id'],
                'name': student_dict['username'],
                'email': student_dict['email'],
                'instrument': student_dict['instrument']
            })
        
        app.logger.info("Returning %d formatted student records", len(student_data))
        return jsonify(student_data)
    except Exception as e:
        app.logger.error("Error in get_students_api: %s", str(e), exc_info=True)
        return jsonify({'error': str(e)}), 500

# API endpoint to get all groups for filtering
@app.route('/api/groups')
@login_required
def get_groups_api():
    if current_user.role not in ['admin', 'staff']:
        return jsonify({'error': 'Unauthorized'}), 403
    
    try:
        # Get all groups
        groups = Group.query.all()
        
        # Format the response
        group_data = []
        for group in groups:
            group_data.append({
                'id': group.id,
                'name': group.name,
                'description': group.description,
                'member_count': len(group.members) if group.members else 0,
                'material_count': len(group.material_allocations) if group.material_allocations else 0
            })
        
        return jsonify(group_data)
    except Exception as e:
        app.logger.error(f"Error in get_groups_api: {str(e)}")
        return jsonify({'error': str(e)}), 500

# API endpoint to get all rooms for filtering
@app.route('/api/rooms')
@login_required
def get_rooms_api():
    if current_user.role not in ['admin', 'staff']:
        return jsonify({'error': 'Unauthorized'}), 403
    
    try:
        # Get all rooms
        rooms = Room.query.all()
        
        # Format the response
        room_data = []
        for room in rooms:
            room_data.append({
                'id': room.id,
                'name': room.name,
                'location': room.location
            })
        
        return jsonify(room_data)
    except Exception as e:
        app.logger.error(f"Error in get_rooms_api: {str(e)}")
        return jsonify({'error': str(e)}), 500

# Instrument API Routes
@app.route('/api/instruments', methods=['GET', 'POST'])
@login_required
def manage_instruments():
    if request.method == 'GET':
        # Get all active instruments by default, or all instruments if requested
        include_inactive = request.args.get('include_inactive', 'false').lower() == 'true'
        if include_inactive:
            instruments = Instrument.query.order_by(Instrument.name).all()
        else:
            instruments = Instrument.query.filter_by(is_active=True).order_by(Instrument.name).all()
        return jsonify([instrument.to_dict() for instrument in instruments])
    
    if request.method == 'POST':
        # Only admin can create instruments
        if current_user.role != 'admin':
            return jsonify({'error': 'Unauthorized'}), 403
        
        data = request.get_json()
        if not data.get('name'):
            return jsonify({'error': 'Name is required'}), 400
        
        # Check if instrument already exists
        existing = Instrument.query.filter_by(name=data['name']).first()
        if existing:
            return jsonify({'error': 'Instrument already exists'}), 400
        
        instrument = Instrument(
            name=data['name'],
            is_active=data.get('is_active', True)
        )
        db.session.add(instrument)
        db.session.commit()
        return jsonify(instrument.to_dict()), 201

@app.route('/api/instruments/<int:instrument_id>', methods=['GET', 'PUT', 'DELETE'])
@login_required
def manage_instrument(instrument_id):
    if current_user.role != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    
    instrument = Instrument.query.get_or_404(instrument_id)
    
    if request.method == 'GET':
        return jsonify(instrument.to_dict())
    
    if request.method == 'PUT':
        data = request.get_json()
        if 'name' in data:
            # Check if new name already exists
            existing = Instrument.query.filter_by(name=data['name']).first()
            if existing and existing.id != instrument_id:
                return jsonify({'error': 'Instrument name already exists'}), 400
            instrument.name = data['name']
        if 'is_active' in data:
            instrument.is_active = data['is_active']
        
        db.session.commit()
        return jsonify(instrument.to_dict())
    
    if request.method == 'DELETE':
        # Check if instrument is being used
        users_count = User.query.filter_by(instrument_id=instrument_id).count()
        materials_count = Material.query.filter_by(instrument_id=instrument_id).count()
        sessions_count = Session.query.filter_by(instrument_id=instrument_id).count()
        
        if users_count > 0 or materials_count > 0 or sessions_count > 0:
            # Soft delete by setting is_active to False
            instrument.is_active = False
            db.session.commit()
            return jsonify({'message': 'Instrument deactivated successfully (was in use)'}), 200
        else:
            # Hard delete if not in use
            db.session.delete(instrument)
            db.session.commit()
            return jsonify({'message': 'Instrument deleted successfully'}), 200

# Initialize default instruments
def initialize_default_instruments():
    """Initialize default instruments if they don't exist"""
    with app.app_context():
        default_instruments = [
            'Guitar',
            'Bass',
            'Drums', 
            'Vocals',
            'Keys',
            'Production'
        ]
        
        for instrument_name in default_instruments:
            existing = Instrument.query.filter_by(name=instrument_name).first()
            if not existing:
                instrument = Instrument(name=instrument_name, is_active=True)
                db.session.add(instrument)
        
        db.session.commit()

# Default instruments initialization moved to /admin/setup route
# initialize_default_instruments()  # Moved to setup route to prevent startup issues

# Music AI API Routes using Official SDK Pattern
# Simple Music AI Client implementation based on the official SDK
class SimpleMusicAiClient:
    def __init__(self, api_key):
        self.api_key = api_key
        self.base_url = "https://api.music.ai/api"  # Fixed: Added /api prefix
        self.headers = {
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        }
    
    def upload_file(self, file_path):
        """Upload a file and return the temporary URL"""
        with open(file_path, 'rb') as f:
            files = {'file': f}
            response = requests.post(
                f"{self.base_url}/upload",  # Now resolves to /api/upload
                files=files,
                headers={'Authorization': f'Bearer {self.api_key}'}
            )
            response.raise_for_status()
            return response.json()['url']
    
    def add_job(self, name, workflow, params):
        """Create a new job"""
        data = {
            'name': name,
            'workflow': workflow,
            'params': params
        }
        response = requests.post(
            f"{self.base_url}/job",  # Fixed: Should be /job not /jobs
            json=data,
            headers=self.headers
        )
        response.raise_for_status()
        return response.json()
    
    def list_jobs(self, filters=None):
        """List all jobs with optional filters"""
        params = {}
        if filters:
            if filters.get('status'):
                params['status'] = ','.join(filters['status'])
            if filters.get('workflow'):
                params['workflow'] = ','.join(filters['workflow'])
        
        response = requests.get(
            f"{self.base_url}/job",  # Fixed: Should be /job not /jobs
            params=params,
            headers=self.headers
        )
        response.raise_for_status()
        return response.json()
    
    def get_job(self, job_id):
        """Get job details by ID"""
        response = requests.get(
            f"{self.base_url}/job/{job_id}",  # Fixed: Should be /job not /jobs
            headers=self.headers
        )
        response.raise_for_status()
        return response.json()
    
    def wait_for_job_completion(self, job_id):
        """Wait for job to complete (simplified version)"""
        import time
        max_wait = 300  # 5 minutes
        wait_time = 0
        
        while wait_time < max_wait:
            job = self.get_job(job_id)
            if job['status'] in ['SUCCEEDED', 'FAILED']:
                return job
            time.sleep(5)
            wait_time += 5
        
        raise Exception("Job timeout")
    
    def delete_job(self, job_id):
        """Delete a job from Music AI service"""
        response = requests.delete(
            f"{self.base_url}/job/{job_id}",  # Fixed: Should be /job not /jobs
            headers=self.headers
        )
        if response.status_code == 404:
            # Job doesn't exist on remote server, that's okay
            return {'message': 'Job not found on remote server'}
        response.raise_for_status()
        return response.json() if response.content else {'message': 'Job deleted successfully'}

# Initialize Music AI client
# Set to True for testing without real API calls, False for production
MUSIC_AI_TEST_MODE = False

if MUSIC_AI_TEST_MODE:
    # Test mode - simulate API responses
    music_ai_client = "test_mode"
    app.logger.info("Music AI running in TEST MODE - API calls will be simulated")
else:
    try:
        # Use official Music.AI SDK
        music_ai_client = MusicAiClient(api_key=MUSIC_AI_API_KEY) if MUSIC_AI_API_KEY else None
        if music_ai_client:
            app.logger.info("Music AI client initialized successfully with official SDK")
        else:
            app.logger.warning("Music AI API key not configured")
    except Exception as e:
        app.logger.error(f"Music AI client initialization failed: {str(e)}")
        music_ai_client = None

# Music AI data now stored in database - old JSON variables removed

# Old JSON functions removed - data now stored in database

# Migration function to move existing JSON data to database
def migrate_json_to_database():
    """Migrate existing music_ai_data.json to database tables"""
    import json
    import os
    
    json_file = 'music_ai_data.json'
    if not os.path.exists(json_file):
        app.logger.info("No music_ai_data.json found to migrate")
        return
    
    try:
        with open(json_file, 'r') as f:
            data = json.load(f)
        
        # Migrate files
        files_migrated = 0
        for file_id, file_data in data.get('files', {}).items():
            existing_file = MusicAiFile.query.get(file_id)
            if not existing_file:
                new_file = MusicAiFile(
                    id=file_id,
                    name=file_data.get('name'),
                    original_filename=file_data.get('name'),
                    music_ai_url=file_data.get('music_ai_url'),
                    uploaded_by=file_data.get('uploaded_by', 1),
                    uploaded_at=datetime.fromisoformat(file_data.get('uploaded_at', '').replace('Z', '+00:00')) if file_data.get('uploaded_at') else datetime.now(pytz.timezone('Europe/London'))
                )
                db.session.add(new_file)
                files_migrated += 1
        
        db.session.commit()  # Commit files first
        
        # Migrate jobs
        jobs_migrated = 0
        for job_id, job_data in data.get('jobs', {}).items():
            existing_job = MusicAiJob.query.get(job_id)
            if not existing_job:
                # Find corresponding file
                file_name = job_data.get('fileName')
                source_file = MusicAiFile.query.filter_by(name=file_name).first()
                
                if source_file:
                    new_job = MusicAiJob(
                        id=job_id,
                        file_id=source_file.id,
                        job_type=job_data.get('type'),
                        workflow=job_data.get('workflow'),
                        status=job_data.get('status', 'processing'),
                        parameters=job_data.get('parameters', {}),
                        created_by=job_data.get('created_by', 1),
                        created_at=datetime.fromisoformat(job_data.get('created_at', '').replace('Z', '+00:00')) if job_data.get('created_at') else datetime.now(pytz.timezone('Europe/London'))
                    )
                    if job_data.get('completed_at'):
                        new_job.completed_at = datetime.fromisoformat(job_data.get('completed_at').replace('Z', '+00:00'))
                    
                    db.session.add(new_job)
                    jobs_migrated += 1
        
        db.session.commit()
        app.logger.info(f"✅ Migration completed: {files_migrated} files, {jobs_migrated} jobs")
        
        # Backup the JSON file
        backup_name = f"music_ai_data_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        os.rename(json_file, backup_name)
        app.logger.info(f"📦 Original JSON backed up as: {backup_name}")
        
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"❌ Migration failed: {str(e)}")

# Database migration complete - JSON functions no longer needed

# Music AI workflow mappings - Updated with custom instrument-specific workflows
MUSIC_AI_WORKFLOWS = {
    # Custom instrument separation workflows
    'vocals': 'vocals-api',           # Custom vocals separation
    'drums': 'drums-api',             # Custom drums separation  
    'bass': 'bass-api',               # Custom bass separation
    'piano': 'keys-api',              # Custom keys/piano separation
    'guitar': 'guitar-api',           # Custom guitar separation
    
    # Note: Multi-stem workflows removed - using individual instrument workflows only
    
    # Enhancement workflows (fallback to basic for now)
    'mastering': 'music-ai/stems-vocals-accompaniment',     # Fallback
    'denoise': 'music-ai/stems-vocals-accompaniment',       # Fallback
    'vocal_enhance': 'music-ai/stems-vocals-accompaniment', # Fallback
    'instrument_enhance': 'music-ai/stems-vocals-accompaniment', # Fallback
    
    # Song analysis workflow using custom song sections analysis
    'song_sections': 'song-sections-api',          # Custom song sections workflow
}

# Custom workflows are now statically defined above - no dynamic detection needed
app.logger.info("Using custom instrument-specific workflows")
app.logger.info(f"Configured workflows: {list(MUSIC_AI_WORKFLOWS.keys())}")

@app.route('/api/music-ai/upload', methods=['POST'])
@login_required
def upload_music_ai_files():
    """Upload audio files for Music AI processing"""
    if current_user.role not in ['admin', 'staff']:
        return jsonify({'error': 'Unauthorized'}), 403
    
    if not music_ai_client:
        return jsonify({'error': 'Music AI service not configured'}), 503
    
    try:
        app.logger.info(f"Upload request received. Files in request: {list(request.files.keys())}")
        uploaded_files = []
        
        for file_key in request.files:
            files = request.files.getlist(file_key)
            for file in files:
                if file and file.filename:
                    # Save file temporarily
                    temp_dir = tempfile.gettempdir()
                    file_path = os.path.join(temp_dir, f"{uuid.uuid4()}_{secure_filename(file.filename)}")
                    file.save(file_path)
                    
                    try:
                        # Upload to Music AI platform or simulate in test mode
                        if music_ai_client == "test_mode":
                            song_url = f"https://test-music-ai.com/files/{uuid.uuid4()}.mp3"
                        else:
                            # Use official SDK upload method
                            song_url = music_ai_client.upload_file(file_path)
                        
                        # Store file info in database
                        file_id = str(uuid.uuid4())
                        new_file = MusicAiFile(
                            id=file_id,
                            name=file.filename,
                            original_filename=file.filename,
                            music_ai_url=song_url,
                            file_size=os.path.getsize(file_path) if os.path.exists(file_path) else None,
                            mime_type=file.content_type,
                            uploaded_by=current_user.id
                        )
                        db.session.add(new_file)
                        db.session.commit()
                        
                        app.logger.info(f"Successfully stored file {file.filename} with ID {file_id}")
                        
                        uploaded_files.append({
                            'id': file_id,
                            'name': file.filename
                        })
                        
                        # Clean up temp file after upload
                        if os.path.exists(file_path):
                            os.remove(file_path)
                        
                    except Exception as e:
                        app.logger.error(f"Error uploading {file.filename} to Music AI: {str(e)}")
                        # Clean up temp file
                        if os.path.exists(file_path):
                            os.remove(file_path)
                        continue
        
        return jsonify({
            'message': f'Successfully uploaded {len(uploaded_files)} files',
            'files': uploaded_files
        })
    
    except Exception as e:
        app.logger.error(f"Error uploading files to Music AI: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/music-ai/stem-separation', methods=['POST'])
@login_required
def music_ai_stem_separation():
    """Start stem separation job"""
    if current_user.role not in ['admin', 'staff']:
        return jsonify({'error': 'Unauthorized'}), 403
    
    if not music_ai_client:
        return jsonify({'error': 'Music AI service not configured'}), 503
    
    try:
        data = request.get_json()
        app.logger.info(f"Stem separation request data: {data}")
        
        file_id = data.get('fileIndex')
        separation_type = data.get('separationType')
        
        app.logger.info(f"File ID: {file_id}, Separation Type: {separation_type}")
        
        if file_id is None or not separation_type:
            app.logger.error(f"Missing required parameters - File ID: {file_id}, Separation Type: {separation_type}")
            return jsonify({'error': 'Missing required parameters'}), 400
        
        # Get file info from database
        file_info = MusicAiFile.query.get(file_id)
        if not file_info:
            app.logger.error(f"File not found - file_id: {file_id}")
            return jsonify({'error': 'File not found'}), 404
        
        # Map separation type to workflow
        workflow = MUSIC_AI_WORKFLOWS.get(separation_type)
        if not workflow:
            return jsonify({'error': f'Unknown separation type: {separation_type}'}), 400
        
        # Add informational message based on workflow being used
        warning_message = None
        if separation_type in ['vocals', 'drums', 'bass', 'piano', 'guitar']:
            # Using custom instrument-specific workflows
            warning_message = f"✅ Using optimized custom {separation_type} separation workflow for best results!"
        elif separation_type in ['4stem', '5stem']:
            # Using the general Stem Separation Suite
            warning_message = f"✅ Using advanced Stem Separation Suite for {separation_type} - may provide up to 17+ stems!"
        elif workflow == 'music-ai/stems-vocals-accompaniment':
            # Fallback workflows
            warning_message = f"⚠️ Using basic fallback workflow for {separation_type}. Results may be limited."
        
        # Create job with Music AI or simulate in test mode
        if music_ai_client == "test_mode":
            job_data = {
                'id': str(uuid.uuid4()),
                'status': 'STARTED',
                'name': f"Stem Separation - {file_info.name}"
            }
        else:
            # Use official SDK - returns job dictionary with 'id' field
            app.logger.info(f"Calling Music.AI API with workflow: {workflow}, inputUrl: {file_info.music_ai_url}")
            try:
                job_response = music_ai_client.add_job(
                    f"Stem Separation - {file_info.name}",
                    workflow,
                    {'inputUrl': file_info.music_ai_url}
                )
                app.logger.info(f"Music.AI API response: {job_response}")
                job_data = {'id': job_response['id']}
            except Exception as api_error:
                app.logger.error(f"Music.AI API error: {str(api_error)}")
                raise api_error
        
        # Store job info in database
        new_job = MusicAiJob(
            id=job_data['id'],
            file_id=file_info.id,
            job_type='stem-separation',
            workflow=workflow,
            status='processing',
            parameters={'separationType': separation_type},
            created_by=current_user.id
        )
        db.session.add(new_job)
        db.session.commit()
        
        response_data = {
            'message': 'Stem separation job started successfully',
            'jobId': job_data['id']
        }
        
        if warning_message:
            response_data['warning'] = warning_message
        
        return jsonify(response_data)
    
    except Exception as e:
        app.logger.error(f"Error starting stem separation: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/music-ai/enhancement', methods=['POST'])
@login_required
def music_ai_enhancement():
    """Start audio enhancement job"""
    if current_user.role not in ['admin', 'staff']:
        return jsonify({'error': 'Unauthorized'}), 403
    
    if not music_ai_client:
        return jsonify({'error': 'Music AI service not configured'}), 503
    
    try:
        data = request.get_json()
        file_id = data.get('fileIndex')
        enhancement_type = data.get('enhancementType')
        
        if file_id is None or not enhancement_type:
            return jsonify({'error': 'Missing required parameters'}), 400
        
        # Get file info from database
        file_info = MusicAiFile.query.get(file_id)
        if not file_info:
            return jsonify({'error': 'File not found'}), 404
        
        # Map enhancement type to workflow
        workflow = MUSIC_AI_WORKFLOWS.get(enhancement_type)
        if not workflow:
            return jsonify({'error': f'Unknown enhancement type: {enhancement_type}'}), 400
        
        # Create job with Music AI or simulate in test mode
        if music_ai_client == "test_mode":
            job_data = {
                'id': str(uuid.uuid4()),
                'status': 'STARTED',
                'name': f"Audio Enhancement - {file_info.name}"
            }
        else:
            # Use official SDK
            job_response = music_ai_client.add_job(
                f"Audio Enhancement - {file_info.name}",
                workflow,
                {'inputUrl': file_info.music_ai_url}
            )
            job_data = {'id': job_response['id']}
        
        # Store job info in database
        new_job = MusicAiJob(
            id=job_data['id'],
            file_id=file_info.id,
            job_type='enhancement',
            workflow=workflow,
            status='processing',
            parameters={'enhancementType': enhancement_type},
            created_by=current_user.id
        )
        db.session.add(new_job)
        db.session.commit()
        
        return jsonify({
            'message': 'Audio enhancement job started successfully',
            'jobId': job_data['id']
        })
    
    except Exception as e:
        app.logger.error(f"Error starting audio enhancement: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/music-ai/transcription', methods=['POST'])
@login_required
def music_ai_transcription():
    """Start music transcription job"""
    if current_user.role not in ['admin', 'staff']:
        return jsonify({'error': 'Unauthorized'}), 403
    
    if not music_ai_client:
        return jsonify({'error': 'Music AI service not configured'}), 503
    
    try:
        data = request.get_json()
        file_id = data.get('fileIndex')
        transcription_type = data.get('transcriptionType')
        
        if file_id is None or not transcription_type:
            return jsonify({'error': 'Missing required parameters'}), 400
        
        # Get file info from database
        file_info = MusicAiFile.query.get(file_id)
        if not file_info:
            return jsonify({'error': 'File not found'}), 404
        
        # Map transcription type to workflow
        workflow = MUSIC_AI_WORKFLOWS.get(transcription_type)
        if not workflow:
            return jsonify({'error': f'Unknown transcription type: {transcription_type}'}), 400
        
        # Add informational message about song analysis workflow
        warning_message = None
        if workflow == 'song-sections-api':
            if transcription_type == 'song_sections':
                warning_message = "✅ Using custom Song Sections workflow to analyze song structure, timing, and musical form!"
            else:
                warning_message = f"✅ Using custom Song Sections workflow for {transcription_type} analysis!"
        elif workflow == 'music-ai/stems-vocals-accompaniment':
            warning_message = f"⚠️ Using basic fallback workflow for {transcription_type}. Results may be limited."
        
        # Create job with Music AI or simulate in test mode
        if music_ai_client == "test_mode":
            job_data = {
                'id': str(uuid.uuid4()),
                'status': 'STARTED',
                'name': f"Music Transcription - {file_info.name}"
            }
        else:
            # Use official SDK
            job_response = music_ai_client.add_job(
                f"Music Transcription - {file_info.name}",
                workflow,
                {'inputUrl': file_info.music_ai_url}
            )
            job_data = {'id': job_response['id']}
        
        # Store job info in database
        new_job = MusicAiJob(
            id=job_data['id'],
            file_id=file_info.id,
            job_type='transcription',
            workflow=workflow,
            status='processing',
            parameters={'transcriptionType': transcription_type},
            created_by=current_user.id
        )
        db.session.add(new_job)
        db.session.commit()
        
        response_data = {
            'message': 'Music transcription job started successfully',
            'jobId': job_data['id']
        }
        
        if warning_message:
            response_data['warning'] = warning_message
        
        return jsonify(response_data)
    
    except Exception as e:
        app.logger.error(f"Error starting music transcription: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/music-ai/jobs', methods=['GET'])
@login_required
def get_music_ai_jobs():
    """Get all Music AI jobs with status from database"""
    if current_user.role not in ['admin', 'staff']:
        return jsonify({'error': 'Unauthorized'}), 403
    
    try:
        # Auto-sync status for processing jobs (but don't fail if sync fails)
        if music_ai_client and music_ai_client != "test_mode":
            try:
                processing_jobs = MusicAiJob.query.filter_by(status='processing').all()
                updated_count = 0
                
                for job in processing_jobs:
                    try:
                        remote_job = music_ai_client.get_job(job.id)
                        if remote_job.get('status') == 'SUCCEEDED':
                            job.status = 'completed'
                            job.completed_at = datetime.now(pytz.timezone('Europe/London'))
                            if remote_job.get('result'):
                                job.result_urls = remote_job['result']
                            updated_count += 1
                        elif remote_job.get('status') == 'FAILED':
                            job.status = 'failed'
                            job.error_message = remote_job.get('errorMessage', 'Job failed')
                            updated_count += 1
                    except:
                        continue
                
                if updated_count > 0:
                    db.session.commit()
                    app.logger.info(f"Auto-synced {updated_count} job statuses")
            except Exception as sync_error:
                app.logger.warning(f"Auto-sync failed: {str(sync_error)}")
        
        # Get jobs from database ordered by creation date (newest first)
        db_jobs = MusicAiJob.query.order_by(MusicAiJob.created_at.desc()).all()
        
        jobs = []
        for job in db_jobs:
            # Get the source file info
            source_file = MusicAiFile.query.get(job.file_id)
            
            jobs.append({
                'id': job.id,
                'type': job.job_type,
                'workflow': job.workflow,
                'fileName': source_file.original_filename if source_file else 'Unknown',
                'status': job.status,
                'created_at': job.created_at.isoformat() if job.created_at else None,
                'completed_at': job.completed_at.isoformat() if job.completed_at else None,
                'created_by': job.created_by,
                'error_message': job.error_message,
                'parameters': job.parameters or {}
            })
        
        return jsonify({'jobs': jobs})
    
    except Exception as e:
        app.logger.error(f"Error getting Music AI jobs: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/music-ai/results', methods=['GET'])
@login_required
def get_music_ai_results():
    """Get list of completed Music AI jobs with download links"""
    if current_user.role not in ['admin', 'staff']:
        return jsonify({'error': 'Unauthorized'}), 403
    
    if not music_ai_client:
        return jsonify({'results': []})
    
    try:
        # Get completed jobs from database
        completed_jobs = MusicAiJob.query.filter_by(
            status='completed',
            created_by=current_user.id
        ).order_by(MusicAiJob.completed_at.desc()).all()
        
        results = []
        
        if music_ai_client == "test_mode":
            # In test mode, return mock completed jobs
            for job in completed_jobs:
                source_file = MusicAiFile.query.get(job.file_id)
                results.append({
                    'id': job.id,
                    'type': job.job_type,
                    'fileName': source_file.original_filename if source_file else 'Unknown',
                    'downloadUrls': [
                        {'name': 'vocals.wav', 'url': f"/api/music-ai/download/{job.id}/vocals.wav"},
                        {'name': 'instruments.wav', 'url': f"/api/music-ai/download/{job.id}/instruments.wav"}
                    ],
                    'completed_at': job.completed_at.isoformat() if job.completed_at else None,
                    'created_at': job.created_at.isoformat() if job.created_at else None
                })
        else:
            # Use stored result URLs from our database when available
            for job in completed_jobs:
                source_file = MusicAiFile.query.get(job.file_id)
                
                # Get download URLs from stored results or fetch from remote
                download_urls = []
                if job.result_urls:
                    # Use stored URLs
                    for key, url in job.result_urls.items():
                        if url and url.startswith('http'):
                            download_urls.append({
                                'name': key,
                                'url': url
                            })
                else:
                    # Fallback: fetch from remote (in case result_urls wasn't stored)
                    try:
                        remote_job = music_ai_client.get_job(job.id)
                        if remote_job.get('result'):
                            for key, url in remote_job['result'].items():
                                if url and url.startswith('http'):
                                    download_urls.append({
                                        'name': key,
                                        'url': url
                                    })
                            # Store for next time
                            job.result_urls = remote_job['result']
                            db.session.commit()
                    except Exception as fetch_error:
                        app.logger.warning(f"Could not fetch results for job {job.id}: {str(fetch_error)}")
                
                results.append({
                    'id': job.id,
                    'type': job.job_type,
                    'fileName': source_file.original_filename if source_file else 'Unknown',
                    'downloadUrls': download_urls,
                    'completed_at': job.completed_at.isoformat() if job.completed_at else None,
                    'created_at': job.created_at.isoformat() if job.created_at else None
                })
        
        return jsonify({'results': results})
    
    except Exception as e:
        app.logger.error(f"Error getting Music AI results: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/music-ai/download/<job_id>/<filename>')
@login_required
def download_music_ai_result(job_id, filename):
    """Download Music AI processing result"""
    if current_user.role not in ['admin', 'staff']:
        return jsonify({'error': 'Unauthorized'}), 403
    
    if not music_ai_client:
        return jsonify({'error': 'Music AI service not configured'}), 503
    
    try:
        # Check if user owns this job via database
        job = MusicAiJob.query.filter_by(id=job_id, created_by=current_user.id).first()
        if not job:
            return jsonify({'error': 'Job not found or access denied'}), 404
        
        # Get job details from Music AI
        remote_job = music_ai_client.get_job(job_id)
        
        if remote_job['status'] != 'SUCCEEDED':
            return jsonify({'error': 'Job not completed successfully'}), 400
        
        # Find the download URL for the requested file
        download_url = None
        if remote_job.get('result'):
            # Handle different possible key formats from Music.AI
            if filename in remote_job['result']:
                download_url = remote_job['result'][filename]
            elif filename.replace('.wav', '') in remote_job['result']:
                download_url = remote_job['result'][filename.replace('.wav', '')]
        
        app.logger.info(f"Job result keys: {list(remote_job.get('result', {}).keys()) if remote_job.get('result') else 'No results'}")
        app.logger.info(f"Looking for filename: {filename}")
        app.logger.info(f"Found download URL: {download_url}")
        
        if not download_url:
            return jsonify({
                'error': 'File not found in job results',
                'available_files': list(remote_job.get('result', {}).keys()) if remote_job.get('result') else []
            }), 404
        
        # Redirect to the actual download URL  
        return redirect(download_url)
    
    except Exception as e:
        app.logger.error(f"Error downloading Music AI result: {str(e)}")
        return jsonify({'error': str(e)}), 500

# Helper endpoint for testing - remove in production
@app.route('/api/music-ai/test-connection', methods=['GET'])
@login_required
def test_music_ai_connection():
    """Test Music AI connection"""
    if current_user.role not in ['admin', 'staff']:
        return jsonify({'error': 'Unauthorized'}), 403
    
    if not music_ai_client:
        return jsonify({
            'connected': False,
            'error': 'Music AI API key not configured'
        })
    
    try:
        # Try to list jobs to test connection
        jobs = music_ai_client.list_jobs()
        return jsonify({
            'connected': True,
            'message': 'Successfully connected to Music AI',
            'job_count': len(jobs)
        })
    except Exception as e:
        return jsonify({
            'connected': False,
            'error': str(e)
        })

# Status sync endpoint
@app.route('/api/music-ai/sync-status', methods=['POST'])
@login_required
def sync_music_ai_status():
    """Sync job statuses with Music AI service"""
    if current_user.role not in ['admin', 'staff']:
        return jsonify({'error': 'Unauthorized'}), 403
    
    if not music_ai_client or music_ai_client == "test_mode":
        return jsonify({'message': 'Sync not needed in test mode'})
    
    try:
        # Get all processing jobs from our database
        processing_jobs = MusicAiJob.query.filter_by(status='processing').all()
        
        if not processing_jobs:
            return jsonify({'message': 'No processing jobs to sync', 'updated': 0})
        
        updated_count = 0
        
        # Check each processing job against Music AI
        for job in processing_jobs:
            try:
                # Get remote job status
                remote_job = music_ai_client.get_job(job.id)
                app.logger.info(f"Checking job {job.id}: remote status = {remote_job.get('status')}")
                
                # Update if status changed
                if remote_job.get('status') == 'SUCCEEDED':
                    job.status = 'completed'
                    job.completed_at = datetime.now(pytz.timezone('Europe/London'))
                    # Store result URLs if available
                    if remote_job.get('result'):
                        job.result_urls = remote_job['result']
                    updated_count += 1
                    app.logger.info(f"Updated job {job.id} to completed")
                    
                elif remote_job.get('status') == 'FAILED':
                    job.status = 'failed'
                    job.error_message = remote_job.get('errorMessage', 'Job failed')
                    updated_count += 1
                    app.logger.info(f"Updated job {job.id} to failed")
                    
            except Exception as job_error:
                app.logger.warning(f"Could not check status for job {job.id}: {str(job_error)}")
                continue
        
        # Commit all updates
        if updated_count > 0:
            db.session.commit()
        
        return jsonify({
            'message': f'Status sync completed',
            'checked': len(processing_jobs),
            'updated': updated_count
        })
    
    except Exception as e:
        app.logger.error(f"Error syncing Music AI status: {str(e)}")
        return jsonify({'error': str(e)}), 500

# Test mode helper - simulate job completion
@app.route('/api/music-ai/simulate-completion/<job_id>', methods=['POST'])
@login_required
def simulate_job_completion(job_id):
    """Simulate job completion for testing"""
    if current_user.role not in ['admin', 'staff']:
        return jsonify({'error': 'Unauthorized'}), 403
    
    try:
        # Get job from database
        job = MusicAiJob.query.filter_by(id=job_id, created_by=current_user.id).first()
        if not job:
            return jsonify({'error': 'Job not found or unauthorized'}), 404
        
        # Update job status in database
        job.status = 'completed'
        job.completed_at = datetime.now(pytz.timezone('Europe/London'))
        db.session.commit()
        
        return jsonify({
            'message': 'Job marked as completed',
            'job': job.to_dict()
        })
    
    except Exception as e:
        app.logger.error(f"Error simulating job completion: {str(e)}")
        return jsonify({'error': str(e)}), 500

# Helper endpoint to create test job with download links
@app.route('/api/music-ai/create-test-job', methods=['POST'])
@login_required
def create_test_job():
    """Create a test job with mock download links for testing"""
    if current_user.role not in ['admin', 'staff']:
        return jsonify({'error': 'Unauthorized'}), 403
    
    try:
        # Create a test job ID
        job_id = str(uuid.uuid4())
        file_id = str(uuid.uuid4())
        
        # First create a test file entry
        test_file = MusicAiFile(
            id=file_id,
            name='test-song.mp3',
            original_filename='test-song.mp3',
            music_ai_url='https://test.example.com/test-song.mp3',
            file_size=5000000,  # 5MB
            mime_type='audio/mpeg',
            uploaded_by=current_user.id
        )
        db.session.add(test_file)
        
        # Create test job
        test_job = MusicAiJob(
            id=job_id,
            file_id=file_id,
            job_type='stem-separation',
            workflow='music-ai/stems-vocals-accompaniment',
            status='completed',
            parameters={'separationType': '4stem'},
            created_by=current_user.id,
            completed_at=datetime.now(pytz.timezone('Europe/London'))
        )
        db.session.add(test_job)
        db.session.commit()
        
        return jsonify({
            'message': 'Test job created successfully',
            'jobId': job_id,
            'job': test_job.to_dict()
        })
    
    except Exception as e:
        app.logger.error(f"Error creating test job: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/music-ai/jobs/<job_id>', methods=['DELETE'])
@login_required
def delete_music_ai_job(job_id):
    """Delete a Music AI job from both local database and remote Music.AI service"""
    if current_user.role not in ['admin', 'staff']:
        return jsonify({'error': 'Unauthorized'}), 403
    
    try:
        # Get job from database
        job = MusicAiJob.query.get(job_id)
        if not job:
            return jsonify({'error': 'Job not found'}), 404
        
        remote_deletion_result = None
        
        # Try to delete from Music.AI service first (if not in test mode)
        if music_ai_client and music_ai_client != "test_mode":
            try:
                remote_deletion_result = music_ai_client.delete_job(job_id)
                app.logger.info(f"Deleted job {job_id} from Music.AI service: {remote_deletion_result}")
            except Exception as remote_error:
                app.logger.warning(f"Could not delete job {job_id} from Music.AI service: {str(remote_error)}")
                # Continue with local deletion even if remote deletion fails
        
        # Delete the job from our database
        db.session.delete(job)
        db.session.commit()
        
        app.logger.info(f"Deleted Music AI job {job_id} from local database by user {current_user.id}")
        
        # Prepare response message
        message = 'Job deleted successfully from local database'
        if remote_deletion_result:
            if 'not found' in remote_deletion_result.get('message', '').lower():
                message += ' (job was already removed from Music.AI service)'
            else:
                message += ' and Music.AI service'
        elif music_ai_client and music_ai_client != "test_mode":
            message += ' (could not delete from Music.AI service - may still appear on their website)'
        
        return jsonify({
            'message': message,
            'jobId': job_id,
            'remoteDeleted': remote_deletion_result is not None
        })
    
    except Exception as e:
        app.logger.error(f"Error deleting Music AI job {job_id}: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/music-ai/files/<file_id>', methods=['DELETE'])
@login_required  
def delete_music_ai_file(file_id):
    """Delete a Music AI file and all its associated jobs from both local database and remote Music.AI service"""
    if current_user.role not in ['admin', 'staff']:
        return jsonify({'error': 'Unauthorized'}), 403
    
    try:
        # Get file from database
        file_record = MusicAiFile.query.get(file_id)
        if not file_record:
            return jsonify({'error': 'File not found'}), 404
        
        # Get all jobs associated with this file
        associated_jobs = MusicAiJob.query.filter_by(file_id=file_id).all()
        job_count = len(associated_jobs)
        
        # Try to delete each job from Music.AI service first
        remote_deletions = 0
        remote_failures = 0
        
        if music_ai_client and music_ai_client != "test_mode":
            for job in associated_jobs:
                try:
                    music_ai_client.delete_job(job.id)
                    remote_deletions += 1
                    app.logger.info(f"Deleted job {job.id} from Music.AI service")
                except Exception as remote_error:
                    remote_failures += 1
                    app.logger.warning(f"Could not delete job {job.id} from Music.AI service: {str(remote_error)}")
        
        # Delete the file record (this will cascade delete all jobs from our database)
        db.session.delete(file_record)
        db.session.commit()
        
        app.logger.info(f"Deleted Music AI file {file_id} and {job_count} associated jobs from local database by user {current_user.id}")
        
        # Prepare response message
        message = f'File and {job_count} associated jobs deleted from local database'
        if remote_deletions > 0:
            message += f', {remote_deletions} jobs also deleted from Music.AI service'
        if remote_failures > 0:
            message += f' ({remote_failures} jobs could not be deleted from Music.AI service)'
        
        return jsonify({
            'message': message,
            'fileId': file_id,
            'jobsDeleted': job_count,
            'remoteJobsDeleted': remote_deletions,
            'remoteJobFailures': remote_failures
        })
    
    except Exception as e:
        app.logger.error(f"Error deleting Music AI file {file_id}: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/sessions/<int:session_id>', methods=['PUT'])
@login_required
def update_session(session_id):
    # Only admin and staff can update sessions
    if current_user.role not in ['admin', 'staff']:
        return jsonify({'error': 'Unauthorized'}), 403
    
    session = db.session.get(Session, session_id)
    if not session:
        return jsonify({'error': 'Session not found'}), 404
    
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    try:
        # Update session fields
        if 'title' in data:
            session.title = data['title']
        if 'date' in data:
            session.date = data['date']
        if 'time' in data:
            session.time = data['time']
        if 'duration' in data:
            session.duration = data['duration']
        if 'group_id' in data:
            session.group_id = data['group_id']
        if 'user_id' in data:
            session.user_id = data['user_id']
        if 'room_id' in data:
            session.room_id = data['room_id']
        if 'instrument_id' in data:
            session.instrument_id = data['instrument_id']
        
        db.session.commit()
        return jsonify(session.to_dict()), 200
        
    except Exception as e:
        db.session.rollback()
        print(f"Error updating session: {str(e)}")
        return jsonify({'error': 'Failed to update session'}), 500

def process_feedback_links(content):
    """
    Process markdown-style links in feedback content and convert them to safe HTML links.
    Supports [text](url) syntax and validates URLs for security.
    """
    if not content:
        return content
    
    # Regex pattern to match [text](url) markdown links
    link_pattern = r'\[([^\]]+)\]\(([^)]+)\)'
    
    def replace_link(match):
        text = match.group(1).strip()
        url = match.group(2).strip()
        
        # Validate URL to prevent XSS
        try:
            parsed = urlparse(url)
            # Only allow http, https, and mailto schemes
            if parsed.scheme not in ['http', 'https', 'mailto']:
                # If no scheme, assume https
                if not parsed.scheme and not url.startswith('mailto:'):
                    url = 'https://' + url
                    parsed = urlparse(url)
                
                # Final validation
                if parsed.scheme not in ['http', 'https', 'mailto']:
                    return f"[{text}]({url})"  # Return original if invalid
            
            # Escape text content to prevent XSS
            safe_text = text.replace('<', '&lt;').replace('>', '&gt;').replace('"', '&quot;')
            safe_url = url.replace('"', '&quot;')
            
            # Create safe HTML link
            return f'<a href="{safe_url}" target="_blank" rel="noopener noreferrer">{safe_text}</a>'
            
        except Exception:
            # If URL parsing fails, return original text
            return f"[{text}]({url})"
    
    # Replace all markdown links with HTML links
    processed = re.sub(link_pattern, replace_link, content)
    
    # Also auto-link plain URLs (basic implementation)
    url_pattern = r'(?<![\["])(https?://[^\s<>"]+)'
    def replace_plain_url(match):
        url = match.group(0)
        safe_url = url.replace('"', '&quot;')
        return f'<a href="{safe_url}" target="_blank" rel="noopener noreferrer">{url}</a>'
    
    processed = re.sub(url_pattern, replace_plain_url, processed)
    
    # Convert newlines to <br> tags for better display
    processed = processed.replace('\n', '<br>')
    
    return Markup(processed)

@app.route('/admin/setup')
def admin_setup():
    """
    Comprehensive database setup route for new deployments.
    This handles all initialization that was previously done at module level.
    """
    try:
        setup_results = []
        
        # 1. Create all database tables
        setup_results.append("Creating database tables...")
        db.create_all()
        setup_results.append("✅ Database tables created successfully")
        
        # 2. Initialize default instruments
        setup_results.append("Initializing default instruments...")
        initialize_default_instruments()
        setup_results.append("✅ Default instruments initialized")
        
        # 3. Initialize default rooms
        setup_results.append("Initializing default rooms...")
        initialize_default_rooms()
        setup_results.append("✅ Default rooms initialized")
        
        # 4. Ensure admin user exists
        setup_results.append("Creating admin user...")
        ensure_admin_user_exists()
        setup_results.append("✅ Admin user created/verified")
        
        # 5. Migrate passwords to bcrypt if needed
        setup_results.append("Checking password encryption...")
        migrate_passwords_to_bcrypt()
        setup_results.append("✅ Password encryption verified")
        
        # 6. Migrate JSON data to database if needed
        setup_results.append("Checking for data migrations...")
        migrate_json_to_database()
        setup_results.append("✅ Data migrations completed")
        
        setup_results.append("\n🎉 Database setup completed successfully!")
        setup_results.append("You can now log in with your admin credentials.")
        
        return "<br>".join(setup_results)
        
    except Exception as e:
        error_msg = f"❌ Setup failed: {str(e)}"
        print(error_msg)  # Log to console
        return f"{error_msg}<br><br>Please check the error logs for more details.", 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000,debug = True) 
