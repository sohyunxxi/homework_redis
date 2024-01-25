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

//정해진 시간에 접속자 업데이트 -> Agenda or node-schedule or node-cron
//셋의 차이점 : Agenda : 몽고디비 사용

const job = schedule.scheduleJob('0 0 * * *', async () => { //자정에 업데이트
    try {
        await redis.connect();
        console.log("실행중");

        // Redis에서 일일 접속자 수 조회
        const dailyLogin = await redis.SCARD("dailyLogin");

        // 데이터베이스에서 누적 접속자 수 조회
        const loginQuery = {
            text: 'SELECT total FROM login',
        };
        let loginResult = parseInt((await queryConnect(loginQuery)).rows[0].total);

        // 누적 접속자 수에 일일 접속자 수를 더함
        loginResult += dailyLogin;

        // 누적 접속자 수를 업데이트하는 쿼리
        const updateQuery = {
            text: 'UPDATE login SET total = $1',
            values: [loginResult],
        };

        // 쿼리 실행
        await queryConnect(updateQuery);

        // Redis의 dailyLogin 집합 삭제
        await redis.DEL("dailyLogin");

        console.log(`접속자 업데이트 완료: ${dailyLogin}`);
    } catch (error) {
        console.error('에러 발생:', error);
    } finally {
        redis.disconnect();
    }
});


//======Web Server======
app.listen(port, () => {
    console.log(`${port}번에서 HTTP 웹서버 실행`);
});
https.createServer(options, app).listen(httpsPort, () => { //https 서버
    console.log(`${httpsPort}번에서 HTTPS 웹서버 실행`); // 포트 수정
});