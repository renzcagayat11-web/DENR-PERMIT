# Cloudinary Setup Guide

## Problem
You're getting a 500 Internal Server Error when uploading files because Cloudinary credentials are not configured.

## Solution

### Step 1: Create a Cloudinary Account
1. Go to [https://cloudinary.com](https://cloudinary.com)
2. Sign up for a free account
3. Verify your email address

### Step 2: Get Your Cloudinary Credentials
1. Log in to your Cloudinary dashboard
2. Go to Settings → Account → Security
3. Copy the following values:
   - **Cloud name**
   - **API Key** 
   - **API Secret**

### Step 3: Configure Environment Variables
Create a `.env` file in your project root (same level as `package.json`):

```bash
# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=dkek3ptmd
CLOUDINARY_API_KEY=347253484341184
CLOUDINARY_API_SECRET=BQ8s3qLgv5cMd4tQDuVI2QvYjP4

# Firebase Configuration
GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json

# Server Configuration
PORT=3000
```

**Important:** Replace the placeholder values with your actual Cloudinary credentials.

### Step 4: Install Required Dependencies
Make sure you have the required packages installed:

```bash
npm install cloudinary multer-storage-cloudinary multer dotenv
```

### Step 5: Restart Your Server
After creating the `.env` file, restart your server:

```bash
npm start
```

## File Upload Features Now Available

### ✅ Large File Support
- **Maximum file size:** 50MB
- **Supported formats:** 
  - Images: JPEG, PNG, GIF, WebP
  - Documents: PDF, Word (.doc, .docx), Excel (.xls, .xlsx)

### ✅ Profile Picture Uploads
- Max size: 10MB
- Automatic resizing and optimization
- Progress tracking

### ✅ Document Uploads for Applications
- Support for large PDF and Word documents
- Multiple file upload capability
- Progress tracking for each file
- Automatic file type validation

### ✅ Error Handling
- Clear error messages for missing credentials
- File size validation
- File type validation
- Network error handling

## Testing the Upload

### Test Profile Picture Upload:
1. Go to Customer Dashboard → Profile Section
2. Click "Edit Avatar"
3. Select an image file (under 10MB)
4. Should see upload progress and success message

### Test Document Upload:
1. Go to Create Application page
2. Try uploading a PDF or Word document (under 50MB)
3. Should see progress bar and success message

## Troubleshooting

### Still Getting 500 Error?
1. **Check `.env` file exists** in project root
2. **Verify credentials** are correct (no typos)
3. **Restart server** after adding `.env` file
4. **Check console logs** for specific error messages

### Common Issues:
- **"Cloudinary not configured"** → `.env` file missing or credentials incorrect
- **"File too large"** → File exceeds 50MB limit
- **"Invalid file type"** → File not in supported formats

## Security Notes
- Never commit your `.env` file to version control
- Keep your API secret secure
- The `.env` file is already in `.gitignore`

## Next Steps
Once configured, you can:
1. Upload profile pictures up to 10MB
2. Upload application documents up to 50MB
3. Use the file upload manager for custom upload features
4. Track upload progress with visual indicators

Need help? Check the browser console for detailed error messages.
