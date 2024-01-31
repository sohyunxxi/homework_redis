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
            result.message = `게시물 있음, ${rowCount}개의 게시물이 검색되었습니다.${rows}`
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
// order에 새로 추가한 이미지들은 순서를 정해서 넣고, 만약 순서를 정해서 넣지 않으면 원래 정해져 있는 순서에...
// 삭제할 이미지 번호를 받아오고(예외처리 필요-이미지 개수에 맞지 않게 번호를 지정하는 경우), 추가할 이미지는 이미지 옆에 번호 추가해서 보내기
// 삭제하지 않는 이미지는 그대로 순서 유지, 만약 번호가 겹치면 기존 이미지 뒤 순서로 새로 추가하는 이미지 저장하기 
// 추가하는 이미지 정보와 이미지 순서의 개수가 맞는지
router.put("/:postIdx", isLogin, upload.array("file", 5), isBlank('content', 'title'), async (req, res, next) => {
    const postIdx = req.params.postIdx;
    const userIdx = req.user.idx;
    const { content, title, newImageOrder, originalImageOrder, deleteImageUrl } = req.body;
    const files = req.files; //새로 추가할 이미지들

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

        // 게시물에 있는 이미지 정보들 가져오기
        const getPostImagesQuery = {
            text: 'SELECT image_idx, image_order FROM post_image WHERE post_idx = $1 ORDER BY image_order',
            values: [postIdx],
        };
        const postImagesResult = await queryConnect(getPostImagesQuery);

        //게시물 이미지 순서에 맞게 map으로 정렬해서 가져오기 (map 함수를 사용하여 배열로 변환하고, 배열의 각 요소를 객체로 만듦)
        const imageIdxOrderArray = postImagesResult.rows.map(row => ({ image_idx: row.image_idx, image_order: row.image_order }));

        // 삭제할 이미지 처리
        if (deleteImageIds && deleteImageIds.length > 0) {
            for (const deleteImageId of deleteImageIds) {
                // 삭제할 이미지의 S3 URL 가져오기
                const getImageUrlQuery = {
                    text: 'SELECT image_url FROM image WHERE idx = $1',
                    values: [deleteImageId],
                };
                const imageUrlResult = await queryConnect(getImageUrlQuery);
                const imageUrlToDelete = imageUrlResult.rows[0].image_url;

                // S3에서 이미지 삭제
                const imageKey = imageUrlToDelete.split('/').pop();
                await s3.deleteObject({ Bucket: 'sohyunxxistageus', Key: `uploads/${imageKey}` }).promise();

                // post_image 및 image 테이블에서 이미지 삭제
                const deleteImageQuery = {
                    text: 'DELETE FROM post_image WHERE post_idx = $1 AND image_idx = $2',
                    values: [postIdx, deleteImageId],
                };
                await queryConnect(deleteImageQuery);

                const deleteImageInfoQuery = {
                    text: 'DELETE FROM image WHERE idx = $1',
                    values: [deleteImageId],
                };
                await queryConnect(deleteImageInfoQuery);
            }
        }

        // 새로운 이미지 추가 및 순서 변경 처리
        if (order && order.length > 0) {
            for (const orderItem of order) {
                const { image_idx, new_order } = orderItem;

                // 이미지 배열이 다 차서 못 넣는 경우 예외 처리
                if (imageIdxOrderArray.length >= 5) {
                    result.message = "이미지 배열이 다 차서 더 이상 이미지를 추가할 수 없습니다.";
                    //return res.send(result);
                }

                // 기존 이미지 순서 변경
                const existingImage = imageIdxOrderArray.find(item => item.image_idx === image_idx);
                if (existingImage) {
                    const updateImageOrderQuery = {
                        text: 'UPDATE post_image SET image_order = $1 WHERE post_idx = $2 AND image_idx = $3',
                        values: [new_order, postIdx, image_idx],
                    };
                    await queryConnect(updateImageOrderQuery);
                } else {
                    // 새로운 이미지 추가
                    const newImageOrder = imageIdxOrderArray.length + 1; // 기존 이미지 뒤에 추가
                    const insertNewImageQuery = {
                        text: 'INSERT INTO post_image (post_idx, image_idx, image_order) VALUES ($1, $2, $3)',
                        values: [postIdx, image_idx, newImageOrder],
                    };
                    await queryConnect(insertNewImageQuery);
                }
            }
        }

        // 파일 업로드가 성공하면 해당 파일의 S3 URL을 가져와서 DB에 저장
        const fileUrl = req.file ? req.file.location : post.image;

        // 게시물 수정
        const updatePostQuery = {
            text: 'UPDATE post SET title = $1, content = $2, image = $3 WHERE idx = $4 AND account_idx = $5',
            values: [title, content, fileUrl, postIdx, userIdx],
        };

        const { rowCount } = await queryConnect(updatePostQuery);

        if (rowCount > 0) {
            result.success = true;
            result.message = "업데이트 성공";
        } else {
            result.success = false;
            result.message = "게시물 업데이트 실패.";
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