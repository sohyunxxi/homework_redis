const jwt = require("jsonwebtoken")

const isLogin = (req, res, next) => {
    console.log("실행")
    const token = req.cookies.token //여기서 문제 - 포스트맨에 있는데 왜 못읽지?

    try {
        if (!token) {
            throw new Error("no token")
        }
        const decoded = jwt.verify(token, process.env.SECRET_KEY);
        req.user = decoded;
        
        next()
    } catch (error) {
        const result = {
            "success": false,
            "message": ""
        }

        if (error.message === "no token") {
            result.message = "토큰이 없음"
        } else if (error.message === "jwt expired") {
            result.message = "토큰이 끝남"
        } else if (error.message === "invalid token") {
            result.message = "토큰이 조작됨"
        } else {
            result.message = "오류 발생"
        }
        res.status(401).send(result)
    }
}

module.exports = isLogin