//==========package============
const express = require("express");
const path = require("path");
const fs = require("fs");
const https = require("https");
const session = require("express-session")
const cookieParser = require('cookie-parser');
const makeLog = require('./src/modules/makelog');
const redis = require("redis").createClient();
const schedule = require('node-schedule');
const queryConnect = require('./src/modules/queryConnect');
const setupScheduledJob = require('./src/modules/schedule');
//======Init========
const app = express()
const sessionObj = require('./src/config/session');
const port = 8000
const httpsPort = 8443
const options={
  "key": fs.readFileSync(path.join(__dirname, "./src/keys/key.pem")),
  "cert": fs.readFileSync(path.join(__dirname, "./src/keys/cert.pem")),
  "passphrase":"1234"
}
const currentTime = new Date();
console.log('현재 시간:', currentTime);
app.use(session(sessionObj));
app.use(express.json()) 
app.use(cookieParser());

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


app.use(async (err, req, res, next) => {
    const logData = {
        timestamp: new Date(),
        message: err.message || '서버 오류',
        status: err.status || 500,
    };

    await makeLog(req, res, logData, next);
    
    res.status(err.status || 500).send({
        success: false,
        message: err.message || '서버 오류',
        data: null,
    });
});

setupScheduledJob();

//======Web Server======
app.listen(port, () => {
    console.log(`${port}번에서 HTTP 웹서버 실행`);
});
https.createServer(options, app).listen(httpsPort, () => { //https 서버
    console.log(`${httpsPort}번에서 HTTPS 웹서버 실행`); // 포트 수정
});