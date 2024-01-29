require('dotenv').config(); 
const aws = require('aws-sdk'); // 업데이트?

const s3 = new aws.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION,
  });

  module.exports = s3