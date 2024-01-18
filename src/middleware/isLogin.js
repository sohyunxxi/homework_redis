//필요 없음

const jwt = require('jsonwebtoken');
const session = require('express-session');


const users = {}; // 사용자 정보 및 세션을 저장할 객체

const isLogin = (req, res, next) => {
  const { username } = req.body;
  const secretKey = process.env.SECRET_KEY;

  if (req.session.isLoggedIn) {
    // 이미 로그인한 경우 - 이 부분 이상
    res.status(401).json({ message: '이미 로그인 중입니다. 원래 디바이스에서 로그아웃합니다.' });
  } else {
    // 세션에 사용자 정보 저장
    req.session.isLoggedIn = true;
    req.session.user = { username };

    if (users[username]) {
      // 이미 다른 디바이스에서 로그인한 경우
      res.message = '중복 로그인 - 처음 로그인한 디바이스에서 로그아웃합니다.';
      req.session.destroy(() => {
        // 세션 해제 후 로그인 처리
        const token = jwt.sign({ username }, secretKey, { expiresIn: '1m' });
        users[username] = token;
        req.user = { username, token };
        next();
      });
    } else {
      // 새로운 로그인인 경우 토큰 발급
      const token = jwt.sign({ username }, secretKey, { expiresIn: '1m' });
      users[username] = token;

      // 사용자 정보 및 토큰을 요청 객체에 추가
      req.user = { username, token };

      next();
    }
  }
};

module.exports = isLogin;
