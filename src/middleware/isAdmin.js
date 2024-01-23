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


//하나의 함수에 두 가지 내용을 구현?  - 피드백

// const jwt = require('jsonwebtoken');

// const authenticate = (req, res, next, isAdminCheck = false) => {
//     const token = req.cookies.token;

//     try {
//         if (!token) {
//             throw new Error("no token");
//         }

//         const decodedToken = jwt.verify(token, process.env.SECRET_KEY);

//         if (isAdminCheck && !decodedToken.isadmin) {
//             return res.status(403).json({ error: "관리자 권한이 없습니다." });
//         }

//         req.user = decodedToken;
//         next();
//     } catch (error) {
//         const result = {
//             success: false,
//             message: ""
//         };

//         if (error.message === "no token") {
//             result.message = "token이 없음";
//         } else if (error.message === "jwt expired") {
//             result.message = "token 끝남";
//         } else if (error.message === "invalid token") {
//             result.message = "token 조작됨";
//         } else {
//             result.message = "오류 발생";
//         }

//         res.status(401).json(result);
//     }
// };

// const isLogin = (req, res, next) => {
//     authenticate(req, res, next);
// };

// const isAdmin = (req, res, next) => {
//     const token = req.cookies.token;

//     authenticate(req, res, next, true);
// };

// module.exports = {
//     isLogin,
//     isAdmin
// };

