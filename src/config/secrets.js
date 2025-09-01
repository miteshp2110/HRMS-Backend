const dotenv = require('dotenv');
const path = require('path');

// Tell dotenv to load the .env file from the project root
dotenv.config();

/**
 * @description Centralized configuration object.
 * All environment variables should be loaded and exported from here.
 */
const secrets = {
  dbHost: process.env.DB_HOST,
  dbUser: process.env.DB_USER,
  dbPassword: process.env.DB_PASSWORD,
  dbDatabase: process.env.DB_DATABASE,
  dbPort: parseInt(process.env.DB_PORT, 10) || 3306,

  serverPort : parseInt(process.env.PORT,10) || 4000,
  jwtSecret: process.env.JWT_SECRET,


  awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
  awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  awsS3BucketName: process.env.AWS_S3_BUCKET_NAME,
  awsS3Region: process.env.AWS_S3_REGION,

  apiKey: process.env.API_KEY
};

module.exports = secrets;