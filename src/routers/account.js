const router = require("express").Router()
const jwt = require('jsonwebtoken');
const loginCheck = require('../middleware/loginCheck');
const isLogin = require("../middleware/isLogin");
const queryConnect = require('../modules/queryConnect');
const makeLog = require("../modules/makelog");
const checkPattern = require("../middleware/checkPattern")
const { idReq, pwReq, emailReq, nameReq, genderReq, birthReq, addressReq, telReq }= require("../config/patterns")

// 로그인 API
router.post('/login', checkPattern('id', idReq), checkPattern('pw', pwReq), isLogin, async (req, res, next) => {
    const { id, pw } = req.body;
    const result = {
        success: false,
        message: '로그인 실패',
        data: {
            token : ""
        }
    };

    try {
        const query = {
            text: 'SELECT * FROM account WHERE id = $1 AND pw = $2',
            values: [id, pw],
        };

        const { rows } = await queryConnect(query);

        if (rows.length === 0) {
            return next({
                message: "일치하는 정보 없음",
                status: 401
            });
        }

        const user = rows[0];

        // 토큰 생성
        const token = jwt.sign(
            { id: user.id,  

            }, 
            process.env.SECRET_KEY,
            {
                "issuer":req.body.id,
                "expiresIn":"1m"
            }
        );

        result.success = true;
        result.message = '로그인 성공';
        result.data = user;
        result.data.token = token

        const logData = {
            ip: req.ip,
            userId: id,
            apiName: '/account/login',
            restMethod: 'POST',
            inputData: { id },
            outputData: result,
            time: new Date(),
        };

        makeLog(req, res, logData, next);
        res.send(result);

    } catch (error) {
        console.error('로그인 오류: ', error);
        result.message = '로그인 오류 발생';
        result.error = error;
        next(error);
    }
});

// 로그아웃 API
router.post('/logout', loginCheck, async (req, res, next) => {
    const id = req.user.id; // 사용자 정보는 loginCheck 미들웨어에서 req.user에 저장되어 있습니다.
    const result = {
        success: false,
        message: '로그아웃 실패',
        data: null
    };

    const logData = {
        ip: req.ip,
        userId: id,
        apiName: '/account/logout',
        restMethod: 'POST',
        inputData: {},
        outputData: result,
        time: new Date(),
    };

    makeLog(req, res, logData, next);

    // 클라이언트에서 전달된 토큰을 검증하는 로직 추가
    const token = req.headers.token;

    if (!token) {
        return next({
            status: 401,
            message: '토큰이 없습니다.'
        });
    }

    // 토큰이 유효하면 로그아웃 성공 처리
    jwt.verify(token, process.env.SECRET_KEY, (err, decoded) => {
        if (err) {
            return next({
                status: 401,
                message: '토큰 검증 실패'
            });
        }

        result.success = true;
        result.message = '로그아웃 성공';
        res.status(200).json(result);
    });
});


// id 찾기 API
router.get("/findid", checkPattern('name', 'email'),async (req, res, next) => {
    const { name, email } = req.body;
    const result = {
        success: false,
        message: "아이디 찾기 실패",
        data: null
    };

    try {
        const query = {
            text: 'SELECT id FROM account WHERE name = $1 AND email = $2',
            values: [name, email],
        };

        const { rows } = await queryConnect(query);

        if (rows.length == 0) {
            return next({
                message : "일치하는 정보 없음",
                status : 401
            });  
        }

        const foundId = rows[0].id;
        result.success = true;
        result.message = `아이디 찾기 성공, 아이디는 ${foundId} 입니다.`;
        result.data = { id: foundId };

        const logData = {
            ip: req.ip,
            userId: "", 
            apiName: '/account/findid', 
            restMethod: 'GET', 
            inputData: { name, email }, 
            outputData: result, 
            time: new Date(), 
        };

        await makeLog(req, res, logData, next);
        res.send(result);

    } catch (error) {
        result.error = error;
        return next(error);
    }
});

// pw 찾기 API
router.get("/findpw", checkPattern('id', 'name', 'email'), async (req,res,next) => {
    const { name, email, id } = req.body
    const result = {
        "success" : false, 
        "message" : "",
        "data" : null 
    }

    try{
        const query = {
            text: 'SELECT pw FROM account WHERE name = $1 AND email = $2 AND id = $3',
            values: [name, email, id],
        };

        const { rows } = await queryConnect(query);

        if (rows.length === 0) {
            return next({
                message : "일치하는 정보 없음",
                status : 401
            });                
        }
       
        const foundPw = rows[0].pw;
        result.success = true;
        result.message = `비밀번호 찾기 성공, 비밀번호는 ${foundPw} 입니다.`;
        result.data = { pw: foundPw };
        
        const logData = {
            ip: req.ip,
            userId: id, 
            apiName: '/account/findpw', 
            restMethod: 'GET', 
            inputData: { name, email, id }, 
            outputData: result, 
            time: new Date(), 
        };

        await makeLog(req, res, logData, next);       
        res.send(result);

    } catch (error) {
        result.message = error.message;
    }
});

// 회원가입 API
router.post("/", checkPattern('id', 'pw', 'name', 'email', 'gender', 'birth', 'address', 'tel'), async (req, res, next) => {
    const { id, pw, name, email, tel, birth, address, gender } = req.body;
    const result = {
        success: false,
        message: '',
        data: null,
    };

    try {
        const selectQuery = {
            text: 'SELECT * FROM account WHERE id = $1 OR email = $2',
            values: [id, email],
        };
        const { rows } = await queryConnect(selectQuery);

        if (rows.length > 0) {
            return next({
                message : "이미 사용 중",
                status : 409
            });   
        } else {
            const insertQuery = {
                text: 'INSERT INTO account (name, id, pw, email, birth, tel, address, gender) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
                values: [name, id, pw, email, birth, tel, address, gender],
            };
            const { rowCount } = await queryConnect(insertQuery);

            if (rowCount == 0) {
                return next({
                    message : "회원 가입 오류",
                    status : 500
                });
            }  

            result.success = true;
            result.data = rowCount;
            result.message = "회원 가입 성공"
        }

        const logData = {
            ip: req.ip,
            userId: id, 
            apiName: '/account', 
            restMethod: 'POST', 
            inputData: { id, pw, name, email, tel, birth, address, gender }, 
            outputData: result, 
            time: new Date(), 
        };

        await makeLog(req, res, logData, next);
        res.send(result)  

    }
    catch(e){
        next();
    }
});

// 회원정보 보기 API
router.get("/my", loginCheck, async (req, res, next) => {
    const userIdx = req.user.idx; // req.user를 통해 사용자 정보에 접근
    const userId = req.user.id;  // req.user를 통해 사용자 정보에 접근

    const result = {
        success: false,
        message: '',
        data: null,
    };

    try {
        const query = {
            text: 'SELECT id, pw, email, name, address, birth, tel, gender FROM account WHERE idx =$1',
            values: [userIdx],
        };

        const { rows } = await queryConnect(query);

        if (rows.length === 0) {
            return next({
                message: "해당 계정 없음",
                status: 404
            });
        }

        result.success = true;
        result.message = "회원정보 불러오기 성공";
        result.data = rows;

        const logData = {
            ip: req.ip,
            userId: userId,
            apiName: '/account/my',
            restMethod: 'GET',
            inputData: {},
            outputData: result,
            time: new Date(),
        };

        await makeLog(req, res, logData, next);
        res.send(result);
    } catch (error) {
        result.message = error.message;
        next(error);
    }
});

// 회원정보 수정 API
router.put("/my", loginCheck, checkPattern('pw', 'gender', 'birth', 'address', 'tel'), async (req, res, next) => {
    const { pw, tel, birth, gender, address } = req.body;
    const userIdx = req.user.idx; // req.user를 통해 사용자 정보에 접근
    const userId = req.user.id;  // req.user를 통해 사용자 정보에 접근

    const result = {
        success: false,
        message: '',
        data: null,
    };

    try {
        const query = {
            text: 'UPDATE account SET pw = $1, tel = $2, gender = $3, address = $4, birth = $5 WHERE idx = $6',
            values: [pw, tel, gender, address, birth, userIdx],
        };

        const { rowCount } = await queryConnect(query);

        if (rowCount === 0) {
            throw new Error("회원정보 수정 실패");
        }

        result.success = true;
        result.data = { pw, tel, gender, address, birth };
        result.message = "회원정보 수정 성공";

        const logData = {
            ip: req.ip,
            userId,
            apiName: '/account/my',
            restMethod: 'PUT',
            inputData: { pw, tel, birth, gender, address },
            outputData: result,
            time: new Date(),
        };

        await makeLog(req, res, logData, next);
        res.send(result);
    } catch (error) {
        result.message = error.message;
        next(error);
    }
});

// 회원정보 삭제 API
router.delete("/my", loginCheck, async (req, res, next) => {
    const userIdx = req.user.idx; // req.user를 통해 사용자 정보에 접근
    const userId = req.user.id;  // req.user를 통해 사용자 정보에 접근

    const result = {
        success: false,
        message: '',
        data: null,
    };

    try {
        const query = {
            text: 'DELETE FROM account WHERE idx = $1',
            values: [userIdx],
        };

        const { rowCount } = await queryConnect(query);

        if (rowCount === 0) {
            return next({
                message: "회원정보 삭제 실패",
                status: 400
            });
        }

        result.success = true;
        result.data = rowCount;
        result.message = '회원정보 삭제 성공';

        const logData = {
            ip: req.ip,
            userId,
            apiName: '/account/my',
            restMethod: 'DELETE',
            inputData: {},
            outputData: result,
            time: new Date(),
        };

        // makeLog 함수에 로그 데이터 전달
        makeLog(req, res, logData, next);

        // 클라이언트에게는 로그아웃 메시지만 전송하므로 토큰 검증이 필요 없음
        result.message = '로그아웃 성공';
        res.send(result);
    } catch (error) {
        result.error = error;
        result.status = 500;
        return next(error);
    }
});

module.exports = router