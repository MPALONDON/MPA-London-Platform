import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()



# Music AI API Configuration
MUSIC_AI_API_KEY = os.getenv('MUSIC_AI_API_KEY')
MUSIC_AI_BASE_URL = os.getenv('MUSIC_AI_BASE_URL', 'https://api.music.ai')

print(f"Music AI API Key loaded: {MUSIC_AI_API_KEY[:10]}..." if MUSIC_AI_API_KEY else "No API key found")

# Other configuration settings can be added here 