#!/usr/bin/env python3
"""
Admin User Creation Script for Music Performance Academy

This script allows you to create an admin user manually.
Use this for:
1. Initial setup when no admin user exists
2. Creating additional admin users
3. Recovering admin access if needed

Usage:
    python create_admin.py
"""

import os
import sys
from datetime import datetime
import bcrypt

# Add the current directory to Python path so we can import app
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app, db, User, generate_verification_token

def create_admin_user():
    """Create a new admin user interactively"""
    
    print("🔧 Music Performance Academy - Admin User Creation")
    print("=" * 50)
    
    with app.app_context():
        # Check existing admin users
        existing_admins = User.query.filter_by(role='admin').all()
        
        if existing_admins:
            print(f"ℹ️  Found {len(existing_admins)} existing admin user(s):")
            for admin in existing_admins:
                status = "✅ Verified" if admin.is_verified else "⚠️  Unverified"
                print(f"   - {admin.username} ({admin.email}) - {status}")
            print()
            
            confirm = input("Do you want to create another admin user? (y/N): ").strip().lower()
            if confirm not in ['y', 'yes']:
                print("Operation cancelled.")
                return
        else:
            print("ℹ️  No admin users found in database.")
        
        print("\n📝 Enter details for new admin user:")
        
        # Get username
        while True:
            username = input("Username: ").strip()
            if not username:
                print("❌ Username cannot be empty.")
                continue
            
            existing_user = User.query.filter_by(username=username).first()
            if existing_user:
                print(f"❌ Username '{username}' already exists.")
                continue
            
            break
        
        # Get email
        while True:
            email = input("Email: ").strip().lower()
            if not email or '@' not in email:
                print("❌ Please enter a valid email address.")
                continue
            
            existing_user = User.query.filter_by(email=email).first()
            if existing_user:
                print(f"❌ Email '{email}' already exists.")
                continue
            
            break
        
        # Ask for password setup method
        print("\n🔐 Password Setup Options:")
        print("1. Set password now")
        print("2. Send verification email (requires password setup later)")
        
        while True:
            choice = input("Choose option (1 or 2): ").strip()
            if choice in ['1', '2']:
                break
            print("❌ Please enter 1 or 2.")
        
        if choice == '1':
            # Set password immediately
            import getpass
            while True:
                password = getpass.getpass("Password: ")
                if len(password) < 6:
                    print("❌ Password must be at least 6 characters long.")
                    continue
                
                confirm_password = getpass.getpass("Confirm Password: ")
                if password != confirm_password:
                    print("❌ Passwords do not match.")
                    continue
                
                break
            
            # Create user with password
            hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
            admin_user = User(
                username=username,
                email=email,
                role='admin',
                password=hashed_password.decode('utf-8'),
                is_verified=True
            )
            
            db.session.add(admin_user)
            db.session.commit()
            
            print("\n✅ Admin user created successfully!")
            print(f"   Username: {username}")
            print(f"   Email: {email}")
            print("   Status: Ready to use")
            print(f"\n🌐 You can now sign in at: www.mpalondon.co.uk/signin")
            
        else:
            # Create user without password (requires email verification)
            verification_token = generate_verification_token()
            admin_user = User(
                username=username,
                email=email,
                role='admin',
                verification_token=verification_token,
                is_verified=False,
                password=None
            )
            
            db.session.add(admin_user)
            db.session.commit()
            
            print("\n✅ Admin user created successfully!")
            print(f"   Username: {username}")
            print(f"   Email: {email}")
            print("   Status: Requires password setup")
            print(f"\n🔗 Setup URL: https://mpalondon.pythonanywhere.com/verify-email/{verification_token}")
            print("\n⚠️  IMPORTANT: Save this URL - you'll need it to set up the admin password!")
            print("   The admin user cannot sign in until the password is set via this URL.")

if __name__ == "__main__":
    try:
        create_admin_user()
    except KeyboardInterrupt:
        print("\n\nOperation cancelled by user.")
    except Exception as e:
        print(f"\n❌ Error: {e}")
        print("Please check your database connection and try again.") 