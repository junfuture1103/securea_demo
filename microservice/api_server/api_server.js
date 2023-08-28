const express = require('express');
const bodyParser = require('body-parser');

const app = express();
const port = 3000; // 사용할 포트 번호

// Body parser middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// API 엔드포인트
app.post('/api', (req, res) => {
    const requestData = req.body;

    console.log('Received Request:', requestData); // 입력된 요청 출력
    
    // 'message' 키로 전송된 데이터 추출
    const requestAPI = requestData.message;

    console.log('Received Text:', requestAPI); // 추출한 데이터 출력
    
    var jsonObject = null;
    console.log('command: ', JSON.parse(requestAPI).command); // 추출한 데이터 출력
    
    if(JSON.parse(requestAPI).command == "callToLocal"){
        jsonObject = {
            "packetStatus": "respond",
            "type": "command",
            "command": "callFromLocal",
            "params": {
                "fromCallNum": "101-505"
            },
            "result": {
                "status": true,
                "getCall": true,
                "callConnectionInfo": {
                    "callRoomNum": "300",
                    "peerId": "bbbbbbbb"
                }
            }
        };
    }
    
    if(JSON.parse(requestAPI).command == "getHomeData"){
        jsonObject = {
            "packetStatus": "respond",
            "type": "command",
            "command": "getHomeData",
            "params": null,
            "result": {
                "dayOfWeek": "Monday",
                "tempOfDay": 26,
                "secureModeStatus": true
            }
        };
    }
    console.log(jsonObject)

    // 여기에서 응답 데이터를 생성하고 보내는 로직을 추가할 수 있습니다.
    const response = {
        status: 'success',
        message: jsonObject
    };

    console.log('Sending Response:', response); // 응답 내용 출력

    res.json(response);
});

// 서버 시작
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
