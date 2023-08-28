import debug from 'debug';

const APP_NAME = 'mediasoup-demo';

export default class RequestAPI {
    constructor() {
        console.log("Im here! RequestAPI")
    }

    processRequest(resquestMsg) {
        const requestMsgJson = JSON.parse(resquestMsg);
        var jsonObject = null;
        console.log("check JSON in requestAPI command :", requestMsgJson.command)
        if (requestMsgJson.command == "getAirconditionStatus") {
            jsonObject = {
                "packetStatus": "respond",
                "type": "command",
                "command": "getAirconditionStatus",
                "params": null,
                "result": [
                    {
                        "airconId": 1,
                        "airconName": "거실",
                        "onOff": true,
                        "temp": 22,
                        "airconMode": "외출"
                    },
                    {
                        "airconId": 2,
                        "airconName": "침실1",
                        "onOff": false,
                        "temp": 18,
                        "airconMode": "자동"
                    }
                ]
            };
        }
        else if (requestMsgJson.command == "getHomeData") {
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

        else if (requestMsgJson.command == "getHomeData") {
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

        else if (requestMsgJson.command == "getVisitantList") {
            jsonObject = {
                "packetStatus": "respond",
                "type": "command",
                "command": "getVisitantList",
                "params": null,
                "result": [
                    {
                        "id": 1,
                        "callLocation": "세대 현관",
                        "visitDate": "2024.05.10 12:32",
                        "tag": [
                            "호출",
                            "부재중"
                        ],
                        "videoInfo": {
                            "thumbnailUrl": "https://...",
                            "playUrl": "https://..."
                        }
                    },
                    {
                        "id": 2,
                        "callLocation": "세대 현관",
                        "visitDate": "2024.05.12 14:32",
                        "tag": [
                            "호출",
                            "부재중"
                        ],
                        "videoInfo": {
                            "thumbnailUrl": "https://...",
                            "playUrl": "https://..."
                        }
                    }
                ]
            };
        }


        else if (requestMsgJson.command == "setAirconditionControl") {
            var TFinfo = requestMsgJson.params.onOff
            var Idinfo = requestMsgJson.params.airconId

            jsonObject = {
                "packetStatus": "respond",
                "type": "command",
                "command": "setAirconditionControl",
                "params": {
                    "onOff": TFinfo,
                    "airconId": Idinfo
                },
                "result": {
                    "airconId": Idinfo,
                    "airconName": "거실",
                    "onOff": TFinfo,
                    "temp": 22,
                    "airconMode": "외출"
                }
            };
        }

        else if (requestMsgJson.command == "getSecureMode") {
            jsonObject = {
                "packetStatus": "respond",
                "type": "command",
                "command": "getSecureMode",
                "params": null,
                "result": true
            };
        }

        else if (requestMsgJson.command == "getEntranceCall") {
            jsonObject = {
                "packetStatus": "respond",
                "type": "command",
                "command": "getEntranceCall",
                "params": {
                    "callLocation": "공동 현관"
                },
                "result": {
                    "status": true,
                    "callConnectionInfo": {
                        "callRoomNum": "300",
                        "peerId": "asdf"
                    }
                }
            };
        }
        else if (requestMsgJson.command == "callToLocal") {
            jsonObject = {
                "packetStatus": "respond",
                "type": "command",
                "command": "callToLocal",
                "params": {
                    "toCallNum": "101-505"
                },
                "result": {
                    "status": true,
                    "getCall": false,
                    "callConnectionInfo": {
                        "callRoomNum": "300",
                        "peerId": "aaaaaaaa"
                    }
                }
            };
        }

        else if (requestMsgJson.command == "callFromLocal") {
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


        else if (requestMsgJson.command == "getEntranceCheck") {
            jsonObject = {
                "packetStatus": "respond",
                "type": "command",
                "command": "getEntranceCheck",
                "params": {
                    "callLocation": "공동 현관"
                },
                "result": {
                    "status": true,
                    "getCall": false,
                    "callConnectionInfo": {
                        "callRoomNum": "300",
                        "peerId": "상대방PeerId"
                    }
                }
            };
        }

        else if (requestMsgJson.command == "getEntranceOpen") {
            jsonObject = {
                "packetStatus": "respond",
                "type": "command",
                "subject": "parsed_msg.subject",
                "command": "getEntranceOpen",
                "params": {
                    "callLocation": "공동 현관"
                },
                "result": {
                    "status": true
                }
            };
        }

        else if (requestMsgJson.command == "saveCallVideo") {
            jsonObject = {
                "packetStatus": "respond",
                "type": "command",
                "command": "saveCallVideo",
                "params": null,
                "result": {
                    "status": true
                }
            };
        }

        else if (requestMsgJson.command == "getContactList") {
            jsonObject = {
                "packetStatus": "respond",
                "type": "command",
                "command": "getContactList",
                "params": null,
                "result": {
                    "defaultContactList": [
                        {
                            "id": "bsdfgevca",
                            "name": "경비실",
                            "localCallNum": "00001",
                            "callNum": null
                        }
                    ],
                    "myContactList": [
                        {
                            "id": "2bsdfgevca",
                            "name": "미정이네",
                            "localCallNum": "101-503",
                            "callNum": "010-1111-2222"
                        },
                        {
                            "id": "3bsdfgevca",
                            "name": "철수",
                            "localCallNum": "201-302",
                            "callNum": null
                        }
                    ]
                }
            };
        }

        else if (requestMsgJson.command == "getCouponList") {
            jsonObject = {
                "packetStatus": "respond",
                "type": "command",
                "command": "getCouponList",
                "params": null,
                "result": [
                    {
                        "id": "bsdfgevca",
                        "couponStatus": "사용가능",
                        "title": "홈플러스 세일 홍보 쿠폰",
                        "message": "홈플러스가 세일을 진행합니다. 많이 찾아주세요",
                        "thumbnailUrl": "https://...",
                        "date": "2023년 10월 5일 23:49"
                    },
                    {
                        "id": "2bsdfgevca",
                        "couponStatus": "기간만료",
                        "title": "굽네치킨 특가할인 쿠폰",
                        "message": "굽네치킨에서 전품목 %5 세일!!",
                        "thumbnailUrl": "https://...",
                        "date": "2023년 10월 4일 23:49"
                    }
                ]
            };
        }

        else if (requestMsgJson.command == "useCoupon") {
            jsonObject = {
                "packetStatus": "respond",
                "type": "command",
                "command": "useCoupon",
                "params": {
                    "useCouponId": "useCouponId",
                    "realAddress": "서울시 중랑구 신내동 행복아파트 714동 523호"
                },
                "result": {
                    "status": true,
                    "resultDescription": "쿠폰 사용에 성공했습니다."
                }
            };
        }

        else if (requestMsgJson.command == "getCallHistory") {
            jsonObject = {
                "packetStatus": "respond",
                "type": "command",
                "command": "getCallHistory",
                "params": {
                    "callRecordType": "수신"
                },
                "result": [
                    {
                        "callNum": "00001",
                        "name": "경비실",
                        "date": "2023.10.5 23:49",
                        "callRecordType": "수신"
                    },
                    {
                        "callNum": "101-105",
                        "name": "영미엄마",
                        "date": "2023.10.5 22:49",
                        "callRecordType": "수신"
                    },
                    {
                        "callNum": "010-6557-1234",
                        "name": "친구",
                        "date": "2023.10.8 23:49",
                        "callRecordType": "수신"
                    }
                ]
            };
        }

        else if (requestMsgJson.command == "setAllAirconditionControl") {
            var TFinfo = false

            if (requestMsgJson.params.onOff == true) {
                TFinfo = true
            }

            jsonObject = {
                "packetStatus": "respond",
                "type": "command",
                "command": "setAllAirconditionControl",
                "params": {
                    "onOff": TFinfo
                },
                "result": [
                    {
                        "airconId": 1,
                        "airconName": "거실",
                        "onOff": TFinfo,
                        "temp": 23,
                        "airconMode": "자동"
                    },
                    {
                        "airconId": 2,
                        "airconName": "방1",
                        "onOff": TFinfo,
                        "temp": 18,
                        "airconMode": "외출"
                    },
                    {
                        "airconId": 3,
                        "airconName": "방2",
                        "onOff": TFinfo,
                        "temp": 21,
                        "airconMode": "제습"
                    }
                ]
            };
        }

        const jsonString = JSON.stringify(jsonObject);
        return jsonString;
    }
}

