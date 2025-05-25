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

if __name__ == "__main__":
    application.run() 