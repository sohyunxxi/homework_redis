const router = require("express").Router();
const mongoClient = require("../config/mongodb");
const isAdmin = require("../middleware/isAdmin");
const isLogin = require('../middleware/isLogin');
const dateReq = /^(\d{4})(-\d{2})?(-\d{2})?(T\d{2}(:\d{2}(:\d{2}(\.\d{3})?)?)?(Z)?)?$/;

// 로그 불러오기
router.get("/", isLogin, isAdmin, async (req, res, next) => {
    const {id, order, apiName,startDateTime, endDateTime} = req.body; // params 로 바꾸기
    const result = {
        data: null,
        message: "",
        status: 204
    };
    try {
        
        let num = -1; 

        const query = {};

        if (id) {
            query.userId = id;
        }

        if (apiName) {
            query.apiName = apiName;
        }

        if (order === "asc") {
            num = 1;
        }

        if (startDateTime && dateReq.test(startDateTime) && endDateTime && dateReq.test(endDateTime)) {
            query.time = {
                $gte: new Date(startDateTime), // 시간 바꾸기 -> T, Z 빼기
                $lte: new Date(endDateTime)
            };
        }
        const db = await mongoClient()
        const collection = db.collection("log")
        const queryResult = await collection.find(query).sort({ time : num }).toArray();

        result.data = queryResult;
        result.message = "관리자 - 로그 불러오기 성공";
        return res.send(result);

    } catch (err) {
        console.error(err);
        next(err);
    }
});

module.exports = router;
