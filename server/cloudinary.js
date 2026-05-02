const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Configure Cloudinary
console.log('Loading Cloudinary configuration...');
console.log('CLOUDINARY_CLOUD_NAME:', process.env.CLOUDINARY_CLOUD_NAME ? 'Found' : 'Missing');
console.log('CLOUDINARY_API_KEY:', process.env.CLOUDINARY_API_KEY ? 'Found' : 'Missing');
console.log('CLOUDINARY_API_SECRET:', process.env.CLOUDINARY_API_SECRET ? 'Found' : 'Missing');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

console.log('Cloudinary configured with cloud_name:', process.env.CLOUDINARY_CLOUD_NAME);

// Configure storage for multer - OPTIMIZED for fast uploads
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'denr-permits', // Folder name in Cloudinary
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'pdf', 'doc', 'docx'],
    // Image optimization for faster uploads
    quality: 'auto:good', // Automatic quality optimization
    fetch_format: 'auto', // Auto-select best format
    // Faster upload settings
    eager: [], // No eager transformations (faster)
    eager_async: false,
    // Unique filename generation
    public_id: (req, file) => {
      // Generate unique filename
      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(2, 8); // Shorter random string
      return `${timestamp}-${randomString}`; // Remove original filename for shorter URLs
    }
  }
});

// Create multer upload middleware - OPTIMIZED for fast uploads
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit for fast uploads
  },
  fileFilter: (req, file, cb) => {
    // Allowed file types
    const allowedTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif',
      'application/pdf', 
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images, PDFs, and Word documents are allowed.'), false);
    }
  }
});

// Upload single file
const uploadSingle = upload.single('file');

// Upload multiple files
const uploadMultiple = upload.array('files', 10); // Max 10 files

// Helper function to upload from base64
const uploadFromBase64 = async (base64String, fileName, folder = 'denr-permits') => {
  try {
    // Remove file extension from public_id to prevent double extensions
    const nameWithoutExt = fileName.replace(/\.[^/.]+$/, "");
    
    // Determine resource type based on file extension
    const fileExtension = fileName.toLowerCase().split('.').pop();
    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExtension);
    const resourceType = isImage ? 'image' : 'raw';
    
    let result;
    if (isImage) {
      // Upload images to image/upload
      result = await cloudinary.uploader.upload(base64String, {
        folder: folder,
        public_id: `${Date.now()}-${nameWithoutExt}`,
        resource_type: 'image'
      });
    } else {
      // Upload documents to raw/upload with no processing
      result = await cloudinary.uploader.upload(base64String, {
        folder: folder,
        public_id: `${Date.now()}-${nameWithoutExt}`,
        resource_type: 'raw',
        // Disable all processing for documents
        format: fileExtension,
        // No transformations for documents
        overwrite: true,
        invalidate: true
      });
    }
    
    return {
      url: result.secure_url,
      public_id: result.public_id,
      format: result.format,
      size: result.bytes,
      original_filename: fileName,
      resource_type: resourceType
    };
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw error;
  }
};

// Delete file from Cloudinary
const deleteFile = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    console.error('Cloudinary delete error:', error);
    throw error;
  }
};

module.exports = {
  cloudinary,
  uploadSingle,
  uploadMultiple,
  uploadFromBase64,
  deleteFile
};
