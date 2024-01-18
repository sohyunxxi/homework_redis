//==========package============
const express=require("express")
const session = require("express-session")
const path = require("path")
const cookieParser = require("cookie-parser")
const fs = require("fs")
const https = require("https")
//======Init========
const app = express()
const port = 8000
const httpsPort = 8443
// const connection = require('./src/config/mysql');
const sessionObj = require('./src/config/session');

const options={
  "key": fs.readFileSync(path.join(__dirname, "./src/keys/key.pem")), //가져온 파일의 절대경로
  "cert": fs.readFileSync(path.join(__dirname, "./src/keys/cert.pem")),
  "passphrase":"1234"
}

app.use(express.json()) //json 가지고 통신할 수 있게 해주는 설정. -> 받아온 값을 다시 json으로 바꾸는 등등..
app.use(session(sessionObj)); //모든 url에 접근시 적용
//======Apis========

// app.get("*",(req,res,next)=>{
//     const protocol = req.protocol
//     if(protocol=="http"){
//         const dest=`https://${req.hostname}:8443${req.url}`
//         res.redirect(dest)
//     }
//     next()
// })
const pageApi = require("./src/routers/page")
app.use("/",pageApi)

const accountApi = require("./src/routers/account")
app.use("/account", accountApi)

const postApi = require("./src/routers/post")
app.use("/post",postApi)

const commentApi = require("./src/routers/comment")
app.use("/comment",commentApi)

const historyApi = require("./src/routers/history")
app.use("/history",historyApi)
app.use(cookieParser());
//error handler 넣기
app.use((err, req, res, next) => {
  res.status(err.status || 500).send({
      success: false,
      message: err.message || '서버 오류',
      data: null,
  });
});

//======Web Server======
app.listen(port, ()=>{
    console.log(`${port}번에서 HTTP 웹서버 실행`)
})
https.createServer(options, app).listen(httpsPort, ()=>{ //https 서버
  console.log(`${port}번에서 HTTP 웹서버 실행`)
})
// connection.connect((err) => { //바꾸기
//     if (err) {
//       console.error('MySQL 연결 실패: ' + err.stack);
//       return;
//     }
//     console.log('MySQL에 연결되었습니다. 연결 ID: ' + connection.threadId);
//   });

  