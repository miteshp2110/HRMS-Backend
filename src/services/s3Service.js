const S3 = require('aws-sdk/clients/s3');
const { v4: uuidv4 } = require('uuid');
const secrets = require('../config/secrets');

// Initialize S3 client
const s3 = new S3({
    region: secrets.awsS3Region,
    accessKeyId: secrets.awsAccessKeyId,
    secretAccessKey: secrets.awsSecretAccessKey,
});

/**
 * @description Uploads a file to the configured AWS S3 bucket.
 * @param {Buffer} fileBuffer - The file content as a buffer.
 * @param {string} originalname - The original name of the file to get the extension.
 * @param {string} mimetype - The MIME type of the file.
 * @returns {Promise<string>} The public URL of the uploaded file.
*/
const uploadProfileImage = async (fileBuffer, originalname, mimetype) => {
    // Generate a unique filename to prevent overwrites
  const fileExtension = originalname.split('.').pop();
  const fileName = `profiles/${uuidv4()}.${fileExtension}`;

  const uploadParams = {
    Bucket: secrets.awsS3BucketName,
    Key: fileName,
    Body: fileBuffer,
    ContentType: mimetype,
  };

  try {
    const data = await s3.upload(uploadParams).promise();
    console.log('File uploaded successfully. Location:', data.Location);
    return data.Location; // The public URL of the file
  } catch (error) {
    console.error('Error uploading file to S3:', error);
    throw new Error('Failed to upload profile image.');
  }
};



const uploadDocumentTOS3 = async (fileBuffer, originalname, mimetype) => {
    // Generate a unique filename to prevent overwrites
  const fileExtension = originalname.split('.').pop();
  const fileName = `documents/${uuidv4()}.${fileExtension}`;

  const uploadParams = {
    Bucket: secrets.awsS3BucketName,
    Key: fileName,
    Body: fileBuffer,
    ContentType: mimetype,
  };

  try {
    const data = await s3.upload(uploadParams).promise();
    console.log('File uploaded successfully. Location:', data.Location);
    return data.Location; // The public URL of the file
  } catch (error) {
    console.error('Error uploading file to S3:', error);
    throw new Error('Failed to upload profile document');
  }
};

module.exports = {
  uploadProfileImage,
  uploadDocumentTOS3
};