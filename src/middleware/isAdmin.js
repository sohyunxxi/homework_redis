const jwt = require('jsonwebtoken');

const isAdmin = (req, res, next) => {
    const token = req.cookies.token; 

    if (!token) {
        return res.status(401).json({ error: "토큰이 없음" });
    }

    try {
        const decodedToken = jwt.verify(token, process.env.SECRET_KEY); 
        if (decodedToken.isadmin) {
            next();
        } else {
            return res.status(403).json({ error: "관리자 권한이 없습니다." });
        }
    } catch (error) {
        return res.status(401).json({ error: "유효하지 않은 토큰" });
    }
};

module.exports = isAdmin;
