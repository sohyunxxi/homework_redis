const schedule = require('node-schedule');

const job = schedule.scheduleJob('0 0 * * *', async () => { //자정에 업데이트 -> 미들웨어로 빼기
    try {
        await redis.connect();
        console.log("실행중");

        const dailyLogin = await redis.SCARD("dailyLogin"); // 개수 가져오기

        const loginQuery = {
            text: 'SELECT total FROM login',
        };
        let loginResult = parseInt((await queryConnect(loginQuery)).rows[0].total);

        loginResult += dailyLogin;

        const updateQuery = {
            text: 'UPDATE login SET total = $1',
            values: [loginResult],
        };

        await queryConnect(updateQuery);

        await redis.DEL("dailyLogin"); // 삭제

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

module.exports = job