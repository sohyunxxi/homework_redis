const multer = require("multer");
const multerS3 = require("multer-s3");
const s3 = require("./s3");
console.log(4)

const storage = multerS3({
    s3: s3,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB 제한
    },
    bucket: "sohyunxxistageus",
    acl: "public-read", // 파일 접근 권한 설정
    key: function (req, file, cb) {
        // 파일의 S3에 저장될 경로 및 이름 설정 - 다른친구들은 timestamp도 추가해줌
        cb(null, "uploads/" + Date.now() + "-" + file.originalname);
    },
});
console.log("실행실행실행")
const upload = multer({ storage: storage });

module.exports = upload;
//분리하기 (업로드 부분, STORAGE)