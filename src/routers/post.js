const router = require("express").Router();
const isLogin = require('../middleware/isLogin');
const queryConnect = require('../modules/queryConnect');
const makeLog = require("../modules/makelog");
const isBlank = require("../middleware/isBlank")
const redis = require("redis").createClient();
const upload = require("../config/multer");
const s3 = require("../config/s3")

// 게시물 목록 불러오기 API
router.get("/", isLogin, async (req, res, next) => {
    const userId = req.user.id;  

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
            userId,  
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

// 게시물 검색하기 -> 제목, 내용, 작성자 통틀어 해서 바꿔오기, 따로 search 카테고리 만들어서 /search/word 등등...
router.get("/search", isLogin, async (req, res, next) => {
    const userIdx = req.user.idx
    const userId = req.user.id
    const { title } = req.query
    const time = new Date() //timestamp
    const result = {
        "message": "",
        "data": {
            "searchPost": null,
        }
    }
    try {
        await redis.connect()
        redis.ZADD(`recent${userIdx}`, { //Sorted Set에 멤버를 추가하고 해당 멤버에 대한 점수를 설정 - 시간으로 score 설정해서 정렬하기 위함

            score: time.getTime(),
            value: title
        })
        await redis.EXPIRE(`recent${userIdx}`, 86400) //지정된 키의 만료 시간을 설정 만료 시간이 지나면 키는 자동으로 삭제

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
            result.message = `게시물 있음, ${rowCount}개의 게시물이 검색되었습니다.`
        }
        const logData = {
            ip: req.ip,
            userId: userId,
            apiName: '/post/search',
            restMethod: 'GET',
            inputData: { userId },
            outputData: result,
            time: new Date(),
        };

        makeLog(req, res, logData, next);
        return res.status(200).send(result);
    } catch (error) {
        next(error)
    } finally {
        await redis.disconnect()
    }
})

// 최근 검색어 5개 출력 API 
router.get("/recent", isLogin, async (req, res, next) => {
    const userIdx = req.user.idx;
    const userId = req.user.id

    const result = {
        success: false,
        message: "",
        data: null,
    };

    try {
        await redis.connect();

        const recentSearch = await redis.ZRANGE(`recent${userIdx}`, -5, -1);//ZRANGE (Sorted Set에서 범위를 가져오기), 매개변수로 rev 주게 됨
        console.log("검색기록: ", recentSearch);

        if (recentSearch.length === 0) {
            result.message = "최근 검색기록 없음.";
            return res.status(200).send(result);
        }

        result.success=true
        result.data = recentSearch.reverse();
        await redis.EXPIRE(`recent${userIdx}`, 86400); // 24시간

        const logData = {
            ip: req.ip,
            userId: userId,
            apiName: '/post/recent',
            restMethod: 'GET',
            inputData: { userId },
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

// 게시물 불러오기 API
router.get("/:postIdx", isLogin, async (req, res, next) => {
    const postIdx = req.params.postIdx;
    const userId = req.user.id;

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
            userId,  
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

// 게시물 쓰기 API - 여러 개 업로드 가능
//새로운 테이블 만들어서 (이미지 저장 테이블), 이걸 post에 가리키게 만들고, 그럼 post에서 그걸 가지고 오는거?
//f키 설정을 잘 하기...
router.post("/", isLogin, upload.array("file", 5), isBlank('content', 'title'), async (req, res, next) => {
    const userIdx = req.user.idx;
    const userId = req.user.id;
    const { content, title } = req.body;
    const files = req.files;
    const result = {
        success: false,
        message: "",
        data: null
    };

    try {
        let imageIdxArray = [];

        // 파일 업로드가 성공하면 해당 파일의 S3 URL을 가져와서 DB에 저장
        if (files && files.length > 0) {
            for (const file of files) {
                const imageUrl = file.location;

                // 이미지 테이블에 이미지 저장
                const imageInsertQuery = {
                    text: 'INSERT INTO image (image_url) VALUES ($1) RETURNING idx',
                    values: [imageUrl]
                };

                const imageResult = await queryConnect(imageInsertQuery);
                const imageIdx = imageResult.rows[0].idx;

                imageIdxArray.push(imageIdx);
            }
        }

        // 포스트 테이블에 게시물 등록
        const postInsertQuery = {
            text: 'INSERT INTO post (title, content, account_idx) VALUES ($1, $2, $3) RETURNING idx',
            values: [title, content, userIdx]
        };

        const postResult = await queryConnect(postInsertQuery);
        const postIdx = postResult.rows[0].idx;

        // post_image 테이블에 이미지와 포스트 연결 정보 저장
        for (let i = 0; i < imageIdxArray.length; i++) {
            const imageIdx = imageIdxArray[i];
            const order = i + 1; // 1부터 시작하도록 순차적으로 order 부여
        
            const postImageInsertQuery = {
                text: 'INSERT INTO post_image (post_idx, image_idx, image_order) VALUES ($1, $2, $3)',
                values: [postIdx, imageIdx, order]
            };
        
            await queryConnect(postImageInsertQuery);
        }
        

        result.success = true;
        result.message = "게시물 등록 성공";
        result.data = postResult.rowCount;

        const logData = {
            ip: req.ip,
            userId,
            apiName: '/post',
            restMethod: 'POST',
            inputData: { content, title, imageIdxArray },
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
router.put("/:postIdx", isLogin, upload.array("file", 5), isBlank('content', 'title'),  async (req, res, next) => {
    const postIdx = req.params.postIdx;
    const userIdx = req.user.idx;
    const { content, title } = req.body;

    const result = {
        success: false,
        message: "",
        data: null
    };

    try {
        // 이전 게시물 정보 가져오기
        const getPostQuery = {
            text: 'SELECT * FROM post WHERE idx = $1 AND account_idx = $2',
            values: [postIdx, userIdx],
        };
        const { rows: [post] } = await queryConnect(getPostQuery);

        if (!post) {
            result.message = '게시물이나 권한이 없습니다.';
            return res.send(result);
        }

        // 새로운 이미지가 업로드된 경우 이전 이미지 삭제
        if (req.file && post.image) {
            const imageKey = post.image.split('/').pop(); // 이전 이미지 URL에서 파일 이름 추출
            await s3.deleteObject({ Bucket: 'sohyunxxistageus', Key: `uploads/${imageKey}` }).promise();
        }

        // 파일 업로드가 성공하면 해당 파일의 S3 URL을 가져와서 DB에 저장
        const fileUrl = req.file ? req.file.location : post.image;

        // 게시물 수정
        const updatePostQuery = {
            text: `
                UPDATE post 
                SET title = $1, content = $2, image = $3 
                WHERE idx = $4 AND account_idx = $5
            `,
            values: [title, content, fileUrl, postIdx, userIdx],
        };

        const { rowCount } = await queryConnect(updatePostQuery);

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
    const userIdx = req.user.idx;

    const result = {
        "success": false,
        "message": "",
        editable: false
    };

    try {
        // 해당 게시물이 존재하는지 확인
        const checkPostQuery = {
            text: 'SELECT * FROM post WHERE idx = $1 AND account_idx = $2',
            values: [postIdx, userIdx],
        };
        const { rows: [post] } = await queryConnect(checkPostQuery);

        if (!post) {
            result.message = '게시물이나 권한이 없습니다.';
            return res.send(result);
        }

        // post_image 테이블에서 연결된 이미지 정보 가져오기
        const getPostImageQuery = {
            text: 'SELECT image_idx FROM post_image WHERE post_idx = $1',
            values: [postIdx],
        };
        const postImageResult = await queryConnect(getPostImageQuery);
        console.log("postImageResult:  ", postImageResult)

        if (postImageResult.rows.length > 0) {
            // post_image에 연결된 이미지가 존재할 경우
            console.log("이미지 존재")
            const imageIdxArray = postImageResult.rows.map(row => row.image_idx);
            console.log("imageIdxArray: ", imageIdxArray)

            for (const imageIdx of imageIdxArray) {
                // post_image 테이블에서 이미지 정보 먼저 삭제
                console.log("반복문 진입")
                console.log("imageIdx: ", imageIdx)
                /// S3 버킷에서 이미지 삭제
                const getImageInfoQuery = {
                    text: 'SELECT * FROM image WHERE idx = $1',
                    values: [imageIdx],
                };
                const imageInfoResult = await queryConnect(getImageInfoQuery);
                console.log("imageInfoResult: ",imageInfoResult)
                if (imageInfoResult.rows.length > 0) {
                    console.log("if문 진입")
                    const imageKey = imageInfoResult.rows[0].image_url;
                    const decodedKey = decodeURIComponent(imageKey.split('/').pop());
                    console.log("이미지 키: ",imageKey, "디코드 키: ",decodedKey)
                    try {
                        await s3.deleteObject({ Bucket: 'sohyunxxistageus', Key: `uploads/${decodedKey}` }).promise();
                        console.log("S3에서 이미지 삭제 성공");
                    } catch (error) {
                        console.error("S3에서 이미지 삭제 실패:", error);
                    }
                }
                const deletePostImageQuery = {
                    text: 'DELETE FROM post_image WHERE post_idx = $1 AND image_idx = $2',
                    values: [postIdx, imageIdx],
                };
                await queryConnect(deletePostImageQuery);

                // 이후 image 테이블에서 이미지 삭제
                const deleteImageQuery = {
                    text: 'DELETE FROM image WHERE idx = $1',
                    values: [imageIdx],
                };
                await queryConnect(deleteImageQuery);

            }
        }

        // post 테이블에서 게시물 삭제
        const deletePostQuery = {
            text: `DELETE FROM post WHERE idx = $1 AND account_idx = $2`,
            values: [postIdx, userIdx],
        };

        const { rowCount } = await queryConnect(deletePostQuery);

        if (rowCount > 0) {
            result.editable = true;
            result.success = true;
            result.message = "게시물 삭제 성공";
        } else {
            result.message = '게시물 삭제 실패. 해당 게시물이나 권한이 없습니다.';
        }

    } catch (e) {
        result.message = e.message;
        return next(e);
    } finally {
        return res.send(result);
    }
});


module.exports = router