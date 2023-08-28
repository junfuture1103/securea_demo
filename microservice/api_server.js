const express = require('express');
const bodyParser = require('body-parser');
const debug = require('debug');

const app = express();
const port = 3000; // 사용할 포트 번호

// Body parser middleware
app.use(bodyParser.json());

// RequestAPI 클래스 구현
class RequestAPI {
    processRequest(requestMsgJson) {
        let jsonObject = null;

        if (requestMsgJson.command === 'callToLocal') {
            jsonObject = {
                packetStatus: 'respond',
                type: 'command',
                command: 'callFromLocal',
                params: {
                    fromCallNum: '101-505'
                },
                result: {
                    status: true,
                    getCall: true,
                    callConnectionInfo: {
                        callRoomNum: '300',
                        peerId: 'bbbbbbbb'
                    }
                }
            };
        }

        return JSON.stringify(jsonObject);
    }
}

const requestAPI = new RequestAPI();

// API 엔드포인트
app.post('/api', (req, res) => {
    const requestMsgJson = req.body;

    const response = requestAPI.processRequest(requestMsgJson);
    
    console.log('Received Request:', requestMsgJson); // 입력된 요청 출력
    console.log('Sending Response:', response); // 응답 내용 출력

    res.json(response);
});

// 서버 시작
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
