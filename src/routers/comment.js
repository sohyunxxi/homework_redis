const router = require("express").Router();
const isLogin = require('../middleware/isLogin');
const queryConnect = require('../modules/queryConnect');
const makeLog = require("../modules/makelog");
const isBlank = require("../middleware/isBlank")

// 댓글 불러오기 API

// 댓글 가져오기 API
router.get("/", isLogin, async (req, res, next) => {
    const { postIdx } = req.body;
    const userId = req.user.id;  // req.user를 통해 사용자 정보에 접근

    const result = {
        success: false,
        message: "",
        data: {
            comments: [],
        },
    };

    try {
        if (!postIdx) {
            return next({
                message: 'postIdx 값이 없음',
                status: 400
            });
        }

        const query = {
            text: `
                    SELECT 
                        comment.*, 
                        account.id AS account_id
                    FROM 
                        comment
                    INNER JOIN 
                        account 
                    ON 
                        comment.account_idx = account.idx
                    WHERE 
                        comment.post_idx = $1
                    ORDER BY 
                        comment.created_at DESC
                `,
            values: [postIdx],
        };

        const { rows } = await queryConnect(query);

        result.data.comments = rows

        result.success = true;
        result.message = "댓글 가져오기 성공";
        const logData = {
            ip: req.ip,
            userId,  // req.user를 통해 사용자 정보에 접근
            apiName: '/comment',
            restMethod: 'GET',
            inputData: { postIdx },
            outputData: result,
            time: new Date(),
        };

        await makeLog(req, res, logData, next);
        res.send(result);
    } catch (error) {
        result.message = error.message;
        console.error(error);
        return next(error);
    }
});

// 댓글 등록 API
router.post("/", isLogin, isBlank('content'), async (req, res, next) => {
    const { postIdx, content } = req.body;
    const userIdx = req.user.idx;  // req.user를 통해 사용자 정보에 접근
    const userId = req.user.id;   // req.user를 통해 사용자 정보에 접근

    const result = {
        success: false,
        message: "",
        data: null,
    };

    try {
        if (!postIdx) {
            return next({
                message: 'postIdx 값이 없음',
                status: 400
            });
        }

        const query = {
            text: 
                `
                INSERT INTO 
                    comment (content, account_idx, post_idx) 
                VALUES 
                    ($1, $2, $3)
                `,
            values: [content, userIdx, postIdx],
        };

        const { rowCount } = await queryConnect(query);

        if (rowCount === 0) {
            return next({
                message: '댓글 등록 실패',
                status: 500
            });
        }

        result.success = true;
        result.data = rowCount;
        result.message = "댓글 등록 성공";

        const logData = {
            ip: req.ip,
            userId,  // req.user를 통해 사용자 정보에 접근
            apiName: '/comment',
            restMethod: 'POST',
            inputData: { postIdx, content },
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

// 댓글 수정 API
router.put("/:idx", isLogin, isBlank('content'), async (req, res, next) => {
    const { content } = req.body;
    const commentIdx = req.params.idx;
    const userIdx = req.user.idx;  // req.user를 통해 사용자 정보에 접근
    const userId = req.user.id;   // req.user를 통해 사용자 정보에 접근

    const result = {
        success: false,
        message: "",
        data: null,
        editable: false,
    };

    try {
        const query = {
            text: `
                    UPDATE 
                        comment 
                    SET 
                        content = $1 
                    WHERE 
                        idx = $2 
                    AND 
                        account_idx = $3
                    `,
            values: [content, commentIdx, userIdx],
        };

        const { rowCount } = await queryConnect(query);

        if (rowCount === 0) {
            return next({
                message: '댓글 수정 실패',
                status: 500
            });
        }

        result.editable = true;
        result.success = true;
        result.data = rowCount;
        result.message = "댓글 수정 성공";

        const logData = {
            ip: req.ip,
            userId,  // req.user를 통해 사용자 정보에 접근
            apiName: '/comment/:idx',
            restMethod: 'PUT',
            inputData: { content },
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


// 댓글 삭제 API
router.delete("/:idx", isLogin, async (req, res, next) => {
    const commentIdx = req.params.idx;
    const userIdx = req.user.idx;  // req.user를 통해 사용자 정보에 접근
    const userId = req.user.id;   // req.user를 통해 사용자 정보에 접근

    const result = {
        success: false,
        message: "",
        data: null,
        editable: false,
    };

    try {
        const query = {
            text: `
                DELETE FROM 
                    comment 
                WHERE 
                    idx = $1 
                AND 
                    account_idx = $2
                    `,
            values: [commentIdx, userIdx],
        };

        const { rowCount } = await queryConnect(query);

        if (rowCount === 0) {
            return next({
                message: '삭제 권한 없거나 댓글이 존재하지 않음',
                status: 500
            });
        }

        result.success = true;
        result.data = rowCount;
        result.editable = true;
        result.message = "댓글 삭제 성공";

        const logData = {
            ip: req.ip,
            userId,  // req.user를 통해 사용자 정보에 접근
            apiName: '/comment/:idx',
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