require('dotenv').config(); 
const aws = require('aws-sdk'); // 업데이트?

const s3 = new aws.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION,
  });

  module.exports = s3

  //파일로 굳이 분리하지 말기, 같이 MULTER랑 합치기
  //CONST MULTER해서 같이 만들기

  