import os
import pickle
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload, MediaIoBaseDownload
import io
import logging

# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# If modifying these scopes, delete the file token.pickle.
SCOPES = ['https://www.googleapis.com/auth/drive.file']

def get_google_drive_service():
    logger.debug("Starting Google Drive service initialization")
    creds = None
    # The file token.pickle stores the user's access and refresh tokens, and is
    # created automatically when the authorization flow completes for the first time.
    if os.path.exists('token.pickle'):
        logger.debug("Found existing token.pickle file")
        with open('token.pickle', 'rb') as token:
            creds = pickle.load(token)
    # If there are no (valid) credentials available, let the user log in.
    if not creds or not creds.valid:
        logger.debug("No valid credentials found")
        if creds and creds.expired and creds.refresh_token:
            logger.debug("Refreshing expired credentials")
            creds.refresh(Request())
        else:
            logger.debug("Starting new OAuth flow")
            try:
                flow = InstalledAppFlow.from_client_secrets_file(
                    'credentials.json', SCOPES)
                logger.debug("Created flow from credentials.json")
                creds = flow.run_local_server(port=8080)
                logger.debug("Completed OAuth flow")
            except Exception as e:
                logger.error(f"Error during OAuth flow: {str(e)}")
                raise

        # Save the credentials for the next run
        with open('token.pickle', 'wb') as token:
            logger.debug("Saving new credentials to token.pickle")
            pickle.dump(creds, token)

    try:
        service = build('drive', 'v3', credentials=creds)
        logger.debug("Successfully built Drive service")
        return service
    except Exception as e:
        logger.error(f"Error building Drive service: {str(e)}")
        raise

def create_folder(service, folder_name, parent_id=None):
    """Creates a folder in Google Drive."""
    logger.debug(f"Creating folder: {folder_name}")
    file_metadata = {
        'name': folder_name,
        'mimeType': 'application/vnd.google-apps.folder'
    }
    if parent_id:
        file_metadata['parents'] = [parent_id]
        logger.debug(f"Folder will be created under parent ID: {parent_id}")

    try:
        # First check if folder already exists
        query = f"name='{folder_name}' and mimeType='application/vnd.google-apps.folder' and trashed=false"
        if parent_id:
            query += f" and '{parent_id}' in parents"
        existing_folders = service.files().list(
            q=query,
            fields="files(id, name)"
        ).execute()
        if existing_folders.get('files'):
            folder_id = existing_folders['files'][0]['id']
            logger.debug(f"Found existing folder with ID: {folder_id}")
            return folder_id
        # Create new folder if it doesn't exist
        file = service.files().create(
            body=file_metadata,
            fields='id, name',
            supportsAllDrives=True
        ).execute()
        folder_id = file.get('id')
        logger.debug(f"Successfully created folder with ID: {folder_id}")
        # Set folder permissions to make it accessible
        permission = {
            'type': 'anyone',
            'role': 'reader'
        }
        service.permissions().create(
            fileId=folder_id,
            body=permission,
            fields='id',
            supportsAllDrives=True
        ).execute()
        logger.debug(f"Set folder permissions for ID: {folder_id}")
        return folder_id
    except Exception as e:
        logger.error(f"Error creating folder: {str(e)}")
        raise

def upload_file(service, file_path, file_name, mime_type, folder_id=None):
    """Uploads a file to Google Drive."""
    logger.debug(f"Starting file upload: {file_name}")
    file_metadata = {
        'name': file_name,
        'mimeType': mime_type
    }
    
    if folder_id:
        file_metadata['parents'] = [folder_id]
        logger.debug(f"File will be uploaded to folder ID: {folder_id}")

    try:
        media = MediaFileUpload(
            file_path,
            mimetype=mime_type,
            resumable=True
        )
        logger.debug("Created media upload object")
        
        # Create the file in Google Drive
        file = service.files().create(
            body=file_metadata,
            media_body=media,
            fields='id, name, webViewLink',
            supportsAllDrives=True
        ).execute()
        
        file_id = file.get('id')
        logger.debug(f"Successfully uploaded file with ID: {file_id}")
        
        # Make the file publicly accessible
        permission = {
            'type': 'anyone',
            'role': 'reader'
        }
        service.permissions().create(
            fileId=file_id,
            body=permission,
            fields='id'
        ).execute()
        
        logger.debug(f"Set file permissions for ID: {file_id}")
        return file_id
    except Exception as e:
        logger.error(f"Error uploading file: {str(e)}")
        raise

def download_file(service, file_id, output_path):
    """Downloads a file from Google Drive."""
    request = service.files().get_media(fileId=file_id)
    fh = io.BytesIO()
    downloader = MediaIoBaseDownload(fh, request)
    
    done = False
    while done is False:
        status, done = downloader.next_chunk()
    
    fh.seek(0)
    with open(output_path, 'wb') as f:
        f.write(fh.read())

def list_files(service, folder_id=None, query=None):
    """Lists files in Google Drive."""
    if not query:
        query = "mimeType != 'application/vnd.google-apps.folder'"
    
    if folder_id:
        query += f" and '{folder_id}' in parents"
    
    results = service.files().list(
        q=query,
        pageSize=100,
        fields="nextPageToken, files(id, name, mimeType)"
    ).execute()
    
    return results.get('files', [])

def delete_file(service, file_id):
    """Deletes a file from Google Drive."""
    service.files().delete(fileId=file_id).execute()

def share_file(service, file_id, email, role='reader'):
    """Shares a file with a specific user."""
    user_permission = {
        'type': 'user',
        'role': role,
        'emailAddress': email
    }
    
    service.permissions().create(
        fileId=file_id,
        body=user_permission,
        fields='id'
    ).execute() 