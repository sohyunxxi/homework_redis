const router = require("express").Router();
const isLogin = require('../middleware/isLogin');
const queryConnect = require('../modules/queryConnect');
const makeLog = require("../modules/makelog");
const isBlank = require("../middleware/isBlank")
const redis = require("redis").createClient();

// 게시물 목록 불러오기 API
router.get("/", isLogin, async (req, res, next) => {
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
            text: `
                SELECT 
                    post.*, 
                    account.id AS account_id
                FROM 
                    post
                INNER JOIN 
                    account ON post.account_idx = account.idx
                ORDER BY 
                    post.created_at DESC
            `,
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

// 게시물 검색하기
router.get("/search", isLogin, async (req, res, next) => {
    const userKey = req.user.idx
    const { title } = req.query
    const time = new Date()
    const result = {
        "message": "",
        "data": {
            "searchPost": null,
            "recent": null
        }
    }
    try {
        await redis.connect()
        redis.ZADD(`recent${userKey}`, {
            score: time.getTime(),
            value: title
        })
        await redis.EXPIRE(`recent${userKey}`, 86400)

        const recentSearch = await redis.ZRANGE(`recent${userKey}`, 0, -1)
        const filpped = recentSearch.reverse().slice(0, 5)

        const query = {
            text: `
                SELECT 
                    post.title, 
                    post.content, 
                    post.created_at, 
                    account.id AS postingUser
                FROM 
                    post
                JOIN 
                    account ON post.account_idx = account.idx
                WHERE 
                    post.title ILIKE $1
                ORDER BY 
                    post.created_at DESC
            `,
            values: [`%${title}%`],
        };
        const {rowCount, rows}= await queryConnect(query);
        console.log("결과: ",rowCount)
        console.log("rows: ",rows)
        if (rowCount == 0) {
            result.message = "게시물 없음."
        } else {
            result.data.searchPost = rowCount
            result.message = "게시물 있음"
        }
        const logData = {
            ip: req.ip,
            userId: id,
            apiName: '/post/search',
            restMethod: 'GET',
            inputData: { id },
            outputData: result,
            time: new Date(),
        };

        makeLog(req, res, logData, next);
        result.data.recentResult = filpped

        return res.status(200).send(result)
    } catch (error) {
        next(error)
    } finally {
        await redis.disconnect()
    }
})

// 최근 검색어 5개 출력 API
router.get("/recent", isLogin, async (req, res, next) => {
    const userIdx = req.user.idx;
    const result = initializeResult();

    try {
        await redis.connect();

        const recentSearch = await redis.ZRANGE(`recent${userIdx}`, -5, -1);
        console.log("검색기록: ", recentSearch);

        if (recentSearch.length === 0) {
            result.message = "최근 검색기록 없음.";
            return res.status(200).send(result);
        }

        result.data = recentSearch.reverse();
        await redis.EXPIRE(`recent${userIdx}`, 86400); // 24시간
        const logData = {
            ip: req.ip,
            userId: id,
            apiName: '/post/recent',
            restMethod: 'GET',
            inputData: { id },
            outputData: result,
            time: new Date(),
        };

        makeLog(req, res, logData, next);
    
        res.status(200).send(result);
    } catch (error) {
        next(error);
    } finally {
        await redis.disconnect();
    }
});

function initializeResult() {
    return {
        message: "",
        data: null,
    };
}


// 게시물 불러오기 API
router.get("/:postIdx", isLogin, async (req, res, next) => {
    const postIdx = req.params.postIdx;
    const userId = req.user.id;  // req.user를 통해 사용자 정보에 접근

    const result = {
        success: false,
        message: "",
        data: null
    };
    try {
        const query = {
            text: ` SELECT 
                        post.*, 
                        account.id AS account_id
                    FROM 
                        post
                    JOIN 
                        account ON post.account_idx = account.idx
                    WHERE 
                        post.idx = $1;`,
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
router.post("/", isLogin, isBlank('content', 'title'), async (req, res, next) => {
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
            text: `
                INSERT INTO 
                    post (title, content, account_idx) 
                VALUES 
                    ($1, $2, $3)
            `,
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
router.put("/:postIdx", isLogin, isBlank('content', 'title'), async (req, res, next) => {
    const postIdx = req.params.postIdx;
    const userIdx = req.user.idx;  // req.user를 통해 사용자 정보에 접근

    const { content, title } = req.body;

    const result = {
        success: false,
        message: "",
        data: null
    };
    try {
        const query = {
            text: `
                UPDATE 
                    post 
                SET 
                    title = $1, 
                    content = $2 
                WHERE 
                    idx = $3 
                    AND account_idx = $4
            `,
            values: [title, content, postIdx, userIdx],
        };
        

        const { rowCount } = await queryConnect(query);

        if (rowCount > 0) {
            result.success = true;
            result.message = "업데이트 성공";
        } else {
            result.success = false;
            result.message = "해당 게시물이나 권한이 없습니다.";
        }

    } catch (e) {
        result.message = e.message;
    } finally {
        res.send(result);
    }
});

// 게시물 삭제하기 API
router.delete("/:idx", isLogin, async (req, res, next) => {
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
            text: `DELETE FROM 
                        post 
                    WHERE 
                        idx = $1 AND account_idx = $2`,
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