//==========package============
const express=require("express")
const path = require("path")
const fs = require("fs")
const https = require("https")
const cookieParser = require('cookie-parser')
const makeLog = require('./src/modules/makelog')
const redis = require("redis").createClient()
//======Init========
const app = express()
const port = 8000
const httpsPort = 8443
const options={
  "key": fs.readFileSync(path.join(__dirname, "./src/keys/key.pem")),
  "cert": fs.readFileSync(path.join(__dirname, "./src/keys/cert.pem")),
  "passphrase":"1234"
}

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
cron.schedule('0 0 * * *', async () => {
    try {
        await redis.connect();
        const count = await redis.SCARD(`dailyLogin`);

        const query = {
            text: 'INSERT INTO login VALUES ($1)',
            values:[count]
        };

        await queryConnect(query)
        await redis.DEL(`dailyLogin`);
 
       console.log(`접속자 삽입 완료: ${count}`);
    } catch (error) {
       console.error('에러 발생:', error);
    } finally {
       redis.disconnect();
    }
 });


//======Web Server======
app.listen(port, ()=>{
    console.log(`${port}번에서 HTTP 웹서버 실행`)
})
https.createServer(options, app).listen(httpsPort, ()=>{ //https 서버
  console.log(`${port}번에서 HTTP 웹서버 실행`)
})


  