// schedule.js
const schedule = require('node-schedule');
const redis = require("redis").createClient();
const queryConnect = require('./queryConnect');
const makeLog = require('./makelog');

const setupScheduledJob = () => {
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
            const insertQuery = {
                text: 'INSERT INTO login (total) VALUES ($1)',
                values: [loginResult],
            };            
    
            // 쿼리 실행
            await queryConnect(insertQuery);
    
            // Redis의 dailyLogin 집합 삭제
            await redis.DEL("dailyLogin");
    
            console.log(`접속자 업데이트 완료: ${dailyLogin}`);
    
            const logData = {
                timestamp: new Date(),
                message: '접속자 업데이트 완료',
                status: 200,
            };
    
            await makeLog(null, null, logData, null); // 필요한 데이터를 전달
    
        } catch (error) {
            console.error('에러 발생:', error);
            next();
        } finally {
            redis.disconnect();
        }
    });
};

module.exports = setupScheduledJob;
