const jwt = require("jsonwebtoken")

const isLogin =(req, res, next) =>{

    const token = req.cookies.token // 헤더 말고 쿠키 -> 클라이언트로부터 쿠키 값 받음

    try{
        if(!token){
            throw new Error("no token")
        }
        jwt.verify(token, process.env.SECRET_KEY)// a.b와 c 비교

        //없어도 되는 부분 -> veryify 함수에서 알아서 해줌.
        // const payload = token.split(".")[1] //총 3개 나오게됨, 그중에 1번째
        // const convert = Buffer.from(payload,"base64") //base64로 인코딩된 payload를 다시 디코딩
        // const data = JSON.parse(convert.toString()) //디코딩된걸 json으로 바꿔주는 작업

        // req.decode = data
        
        next()
    } catch (err){ 
        const result = {
            "success" : false,
            "message":""
        }


        if(err.message =="no token"){
            result.message = "token이 없음"

        } else if(err.message =="jwt expired"){
            result.message = "token 끝남"

        } else if (err.message == "invalid token"){
            result.message = "token 조작됨"

        } else{
            result.message = "오류 발생"
        }
        res.send(result)
    }
}

module.exports = isLogin