const router = require("express").Router();
const loginCheck = require('../middleware/loginCheck');
const queryConnect = require('../modules/queryConnect');
const makeLog = require("../modules/makelog");
const isBlank = require("../middleware/isBlank")


// 게시물 목록 불러오기 API
router.get("/", loginCheck, async (req, res, next) => {
    const userId = req.user.id;  // req.user를 통해 사용자 정보에 접근

    const result = {
        success: false,
        message: "",
        data: {
            posts: []
        }
    };

    try {
        const query = {
            text: `SELECT post.*, account.id AS account_id
                    FROM post
                    INNER JOIN account ON post.account_idx = account.idx
                    ORDER BY post.created_at DESC`,
        };
        const { rows } = await queryConnect(query);
        result.data.posts = rows

        result.success = true;
        result.message = "게시물 불러오기 성공";    
        const logData = {
            ip: req.ip,
            userId,  // req.user를 통해 사용자 정보에 접근
            apiName: '/post', 
            restMethod: 'GET', 
            inputData: {}, 
            outputData: result, 
            time: new Date(), 
        };

        await makeLog(req, res, logData, next);    
        res.send(result);
    } catch (error) {
        console.error('게시물 불러오기 오류: ', error);
        result.message = "게시물 불러오기 실패";
        return next(error);
    }
});


// 게시물 불러오기 API
router.get("/:postIdx", loginCheck, async (req, res, next) => {
    const postIdx = req.params.postIdx;
    const userId = req.user.id;  // req.user를 통해 사용자 정보에 접근

    const result = {
        success: false,
        message: "",
        data: null
    };
    try {
        const query = {
            text: `SELECT post.*, account.id AS account_id
                    FROM post
                    JOIN account ON post.account_idx = account.idx
                    WHERE post.idx = $1;`,
            values: [postIdx],
        };
        const { rows } = await queryConnect(query);
        if (rows.length == 0) {
            return next({
                message: '게시물 불러오기 실패',
                status: 500
            });
        } 

        const post = rows
        result.success = true;
        result.data = post; 
        
        const logData = {
            ip: req.ip,
            userId,  // req.user를 통해 사용자 정보에 접근
            apiName: '/post:/postIdx', 
            restMethod: 'GET', 
            inputData: {}, 
            outputData: result, 
            time: new Date(), 
        };

        await makeLog(req, res, logData, next);
        res.send(result);
    } catch (error) {
        console.error('게시물 가져오기 오류 발생: ', error.message);
        result.message = error.message;
        return next(error);
    }
});

// 게시물 쓰기 API
router.post("/", loginCheck, isBlank('content', 'title'), async (req, res, next) => {
    const userIdx = req.user.idx;  // req.user를 통해 사용자 정보에 접근
    const userId = req.user.id;    // req.user를 통해 사용자 정보에 접근

    const { content, title } = req.body;

    const result = {
        success: false,
        message: "",
        data: null
    };
    try {
        const query = {
            text: 'INSERT INTO post (title, content, account_idx) VALUES ($1, $2, $3)',
            values: [title, content, userIdx],
        };

        const { rowCount } = await queryConnect(query);

        if (rowCount == 0) {
            return next({
                message: '게시물 등록 오류',
                status: 500
            });
        }

        result.success = true;
        result.message = "게시물 등록 성공";
        result.data = rowCount;

        const logData = {
            ip: req.ip,
            userId,  // req.user를 통해 사용자 정보에 접근
            apiName: '/post',
            restMethod: 'POST',
            inputData: { content, title },
            outputData: result,
            time: new Date(),
        };

        await makeLog(req, res, logData, next);
        res.send(result);
    } catch (e) {
        result.message = e.message;
        return next(e);
    }
});

// 게시물 수정하기 API
router.put("/:postIdx", loginCheck, isBlank('content', 'title'), async (req, res, next) => {
    const userIdx = req.user.idx;  // req.user를 통해 사용자 정보에 접근
    const userId = req.user.id;    // req.user를 통해 사용자 정보에 접근

    const { content, title } = req.body;

    const result = {
        success: false,
        message: "",
        data: null
    };
    try {
        const query = {
            text: 'UPDATE post SET title = $1, content = $2 WHERE account_idx = $3',
            values: [title, content, userIdx],
        };
        
        const { rowCount } = await queryConnect(query);

        if (rowCount == 0) {
            return next({
                message: '게시물 수정 오류',
                status: 500
            });
        }

        result.success = true;
        result.message = "게시물 수정 성공";
        result.data = rowCount;

        const logData = {
            ip: req.ip,
            userId: userId,
            apiName: '/post',
            restMethod: 'PUT',
            inputData: { content, title },
            outputData: result,
            time: new Date(),
        };

        await makeLog(req, res, logData, next);
        res.send(result);
    } catch (e) {
        result.message = e.message;
        return next(e);
    }
});
// 게시물 삭제하기 API
router.delete("/:idx", loginCheck, async (req, res, next) => {
    const postIdx = req.params.idx;
    const userIdx = req.user.idx;  // req.user를 통해 사용자 정보에 접근
    const userId = req.user.id;    // req.user를 통해 사용자 정보에 접근

    const result = {
        "success": false,
        "message": "",
        editable: false
    };
    try {
        const query = {
            text: 'DELETE FROM post WHERE idx = $1 AND account_idx = $2',
            values: [postIdx, userIdx],
        };

        const { rowCount } = await queryConnect(query);
        if (rowCount == 0) {
            return next({
                message: '게시물 삭제 실패. 해당 게시물이나 권한이 없습니다.',
                status: 400
            });
        } 

        result.editable = true;
        result.success = true;
        result.message = "게시물 삭제 성공";

        const logData = {
            ip: req.ip,
            userId,
            apiName: '/post/:idx',
            restMethod: 'DELETE',
            inputData: {},
            outputData: result,
            time: new Date(),
        };

        await makeLog(req, res, logData, next);
        res.send(result);
    } catch (e) {
        result.message = e.message;        
        return next(e);
    }
});

module.exports = router