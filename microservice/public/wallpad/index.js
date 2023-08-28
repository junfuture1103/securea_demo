const mediasoupClient = require('mediasoup-client');
const { Producer } = require('mediasoup-client/lib/types');
const io = require('socket.io-client')

let remote_list = document.getElementById("remoteVideo")
let btnDataSend = document.getElementById("btnDataSend")

var urlParams = new URLSearchParams(window.location.search);

const form = document.getElementById('chat-form');
let dataproducer
form.addEventListener('submit', function(event) {
	event.preventDefault();

	const message = chatInput.value.trim();
	if (!message) {
		return;
	}
	addMessage(message,true);
	chatInput.value = '';

    dataproducer.send(JSON.stringify({
        socketId: socket.id,
        roomNumber,
        command : "communication",
        role : "wallpad",
        msg : message
    }))
});

let rtpCapabilities
let roomNumber = urlParams.get("roomNumber");
let local_url = "wallpad"
let remote_url = ["wallpad", "interphone", "zeroswitch"]
let getLightStatus = false

const socket = io('/client')

let Client

// Client 관리를 위한 Class
class ClientConnection {
    socket = undefined;
    rtpCapabilities = undefined;
    producerTransport = undefined;
    consumerTransports = []
    device
    dataproducer
    producer
    consumers = []
    params = undefined


    constructor(_socket) {
        this.socket = _socket;
        this.params = {
            // mediasoup params
            encodings: [
                {
                    rid: 'r0',
                    maxBitrate: 100000,
                    scalabilityMode: 'S1T3',
                },
                {
                    rid: 'r1',
                    maxBitrate: 300000,
                    scalabilityMode: 'S1T3',
                },
                {
                    rid: 'r2',
                    maxBitrate: 900000,
                    scalabilityMode: 'S1T3',
                },
            ],
          
            codecOptions: {
                videoGoogleStartBitrate: 1000
            }
        }
    }

    getRTPcap = function () {
        return new Promise (resolve => {
            socket.emit('getRTPcap', { roomNumber: roomNumber ,url: local_url }, (data) => {
                if (!data.error) {
                  console.log(`Router RTP Capabilities... ${data.rtpCapabilities}`)
          
                    rtpCapabilities = data.rtpCapabilities
                    resolve(rtpCapabilities);
                }
                else {
                  setTimeout(this.getRTPcap, 1000);
                }
            })
        });
    }

    createDevice = async function () {
        this.rtpCapabilities = await this.getRTPcap();
        this.device = new mediasoupClient.Device();

        await this.device.load({
            routerRtpCapabilities: this.rtpCapabilities
        })
  
        console.log(`===== Device created =====`)
        console.log(`cap : ${this.device.rtpCapabilities}`)
  
    }

    createRecvTransport = function () {
        return new Promise(resolve => {
            socket.emit('createWebRtcTransport', { consumer: true }, ({ params }) => {

                if (params.error) {
                    console.log(params.error)
                    return
                }
                let consumerTransport
                try {
                    consumerTransport = this.device.createRecvTransport(params)
                } catch (error) {
        
                    console.log(error)
                    return
                }
        
                consumerTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
                    try {
        
                        await socket.emit('tranport-recv-connect', {
                            dtlsParameters,
                            serverConsumerTransportId: params.id,
                        })
        
        
                        callback()
                    } catch (error) {
        
                        errback(error)
                    }
                })
        
                resolve({consumerTransport, serverTransportId : params.id})
                // connectRecvTransport(consumerTransport, remoteProducerId, params.id, url)
            })
        })
    }

    consume = function (consumerTransport, remoteProducerId, serverConsumerTransportId, url) {
        return new Promise(async resolve => {
            await socket.emit('consume', {
                rtpCapabilities: this.device.rtpCapabilities,
                remoteProducerId,
                serverConsumerTransportId,
            }, async ({ params }) => {
                if (params.error) {
                    console.log('Cannot Consume')
                    return
                }
        
                console.log(`Consumer Params ${params}`)
        
                const consumer = await consumerTransport.consume({
                    id: params.id,
                    producerId: params.producerId,
                    kind: params.kind,
                    rtpParameters: params.rtpParameters
                })
        
                this.consumerTransports = [
                    ...this.consumerTransports,
                    {
                        consumerTransport,
                        serverConsumerTransportId: params.id,
                        producerId: remoteProducerId,
                        consumer,
                    },
                ]
        
                this.consumers = [
                    ...this.consumers,
                    {
                        consumer: consumer,
                        serverConsumerId : params.serverConsumerId
                    }
                ]
        
                resolve(consumer)
            })
        })
    }

    consumeData = function (consumerTransport, remoteProducerId, serverConsumerTransportId, url) {
        return new Promise(async resolve => {
    await socket.emit('consume-data', {
        rtpCapabilities: this.device.rtpCapabilities,
        remoteProducerId,
        serverConsumerTransportId,
    }, async ({ params }) => {
        if (params.error) {
            console.log(`Cannot Consume ${params.error}`)
            return
        }

        console.log(`Data Consumer Params ${params}`)
        console.log(params.producerId)
        const consumer = await consumerTransport.consumeData({
            id: params.id,
            dataProducerId: params.producerId,
            sctpStreamParameters: params.sctpStreamParameters,
        })

        consumer.on("open", () => {
            console.log("new way dataChannel open")
        })

        consumer.on("error", (error) => {
            console.log(error)
        })

        consumer.on('message', (data) => {
            let parsed = JSON.parse(data)
            console.log(parsed)
            if (parsed.command === 'communication') {
                addMessage(parsed.msg, false)
            }
        })

        this.consumerTransports = [
            ...this.consumerTransports,
            {
                consumerTransport,
                serverConsumerTransportId: params.id,
                producerId: remoteProducerId,
                consumer,
            },
                ]
                resolve(consumer)
            })
        })
    }

    consumer_resume = function (consumerId) {
        for (let i = 0; i < this.consumers.length; i++) {
            if(this.consumers[i].consumer.id === consumerId) {
                socket.emit('consumer-resume', { serverConsumerId: this.consumers[i].serverConsumerId })
            }
        }
    }

    createProduceTransport = function () {
        return new Promise(resolve => {
            socket.emit('createWebRtcTransport', { consumer: false }, ({ params }) => {

                if (params.error) {
                    console.log(params.error)
                    return
                }        
                // 서버로 부터 받은 parameter들을 기반으로 producerTransport를 저장.
                this.producerTransport = this.device.createSendTransport(params)
        
                // Transport의 connect이벤트 처리 함수.
                this.producerTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
                    try {
        
                        // transport-connect 메세지와 함께 dtlsParameters 송신 
                        // connect 이벤트시에 dtlsParameters 자동 생성
                        console.log('transport-connect called')
                        await socket.emit('transport-connect', {
                            dtlsParameters,
                        })
        
                        callback()
        
                    } catch (error) {
                        errback(error)
                    }
                })
        
        
                // 트랜스포트에 produceData() 함수가 호출될시에 발생하는 이벤트 처리 함수
                this.producerTransport.on('producedata', async (parameters, callback, errback) => {
                    console.log("producer-data evoked")
        
                    // 이벤트 발생시의 parameters들을 서버로 송신해 관련 정보를 등록
                    try {
                        await socket.emit('transport-produce-data', {
                            sctpStreamParameters: parameters.sctpStreamParameters,
                            label: parameters.label,
                            protocol: parameters.protocol,
                        }, ({ id, producersExist }) => {
                            console.log(`data callback : ${id} : ${producersExist}`)
                            callback({ id })
        
                            if (producersExist) this.getDataProducers()
                        })
                    } catch (error) {
                        errback(error)
                    }
                })
        
                this.producerTransport.on('produce', async (parameters, callback, errback) => {
                    console.log('produce called')
                    try {
        
                        await socket.emit('transport-produce', {
                            kind: parameters.kind,
                            rtpParameters: parameters.rtpParameters,
                            appData: parameters.appData,
                        }, ({ id, producersExist }) => {
                            console.log(`producer callback : ${id} : ${producersExist}`)
                            callback({ id })
                            // producing 완료 지점 
                            // 상대방들한테 producer의 id를 달라고함. 이걸 이용해 consumer 제작
                            if (producersExist) this.getProducers()
                        })
                    } catch (error) {
                        errback(error)
                    }
                })
                resolve(this.producerTransport)
            })
        }) 
    }

    getLocalStream = () => {
        return new Promise(async resolve => {
            let stream = await navigator.mediaDevices.getUserMedia({
                audio: false,
                video: {
                    width: {
                        min: 640,
                        max: 1920,
                    },
                    height: {
                        min: 400,
                        max: 1080,
                    }
                }
            })

            await this.streamSuccess(stream)
            resolve()
        })
    }
      
      streamSuccess = (stream) => {
        return new Promise(resolve => {
            const track = stream.getVideoTracks()[0]
            this.params = {
                track,
                ...this.params
            }
            localVideo.srcObject = stream

            resolve()
        })
      }
    

    createProducer = async function () {
        return new Promise(async resolve => {
            console.log("making producer")
            this.producer = await this.producerTransport.produce(this.params)

            this.producer.on('trackended', () => {
                console.log('track ended')

            })

            this.producer.on('transportclose', () => {
                console.log('transport ended')

            })

            resolve(this.producer)
        })
    }

    createDataProducer = async function () {
        return new Promise(async resolve => {
            console.log("making dataproducer")
            this.dataproducer = await this.producerTransport.produceData()

            this.dataproducer.on("open", () => {
                console.log("producer data channel opend")
            })

            this.dataproducer.on("error", (error) => {
                console.log(error)
            })

            resolve(this.dataproducer)
        })
    }

    getProducers = function () {
        this.socket.emit('getProducers', { remote_url , roomNumber, socketId: this.socket.id})
    }

    getDataProducers = () => {
        this.socket.emit('getDataProducers', { remote_url , roomNumber, socketId: this.socket.id})
    }

}
// 
socket.on('connection-success', async ({ socketId }) => {
  console.log("===== connection success ======")
  console.log(socketId)

    Client = new ClientConnection(socket);
    await Client.getRTPcap();
    await Client.createDevice();
    let ProducerTransport = await Client.createProduceTransport();
    console.log(ProducerTransport)

    await Client.getLocalStream()
    await Client.createProducer();
    
    dataproducer = await Client.createDataProducer();

    setTimeout(()=>{
        console.log('pipeToRoom Start')
        if(roomNumber == 100) {
            let oppositeRoomNumber = 101
            socket.emit('pipetoRoom', {myRoomNumber: roomNumber, oppositeRoomNumber})
        } else if(roomNumber == 101){
            let oppositeRoomNumber = 100
            socket.emit('pipetoRoom', {myRoomNumber: roomNumber, oppositeRoomNumber})
        }
        
    },10000)
})

// 상대방이 producer를 만들었음을 알리는 이벤트
socket.on('new-producer', async ({producerId, url, producerSocketId, consumerSocketId}) => {
    // signalNewConsumerTransport(producerId, url, false)
    
    let cTransport = await Client.createRecvTransport()
    let consumer = await Client.consume(cTransport.consumerTransport, producerId, cTransport.serverTransportId, url)
/// consumer Transport
    const { track } = consumer

    var remoteVideoList = document.getElementById("remoteVideo")
    var localli = document.createElement("li")
    localli.setAttribute("class", "RemoteVideoLi")
    var Video = document.createElement("video")
    Video.setAttribute("autoplay", true)
    Video.setAttribute("class", "video")
    Video.srcObject = new MediaStream([track])
    localli.appendChild(Video)
    remoteVideoList.appendChild(localli)

    Client.consumer_resume(consumer.id)
})

// 내가 상대들한테 영상 producer id를 알려달라고 요청했고 그에대한 응답.
socket.on('getProducers-response', async (producerId,url) => {
    let cTransport = await Client.createRecvTransport()
    let consumer = await Client.consume(cTransport.consumerTransport, producerId, cTransport.serverTransportId, url)

    const { track } = consumer

    var remoteVideoList = document.getElementById("remoteVideo")
    var localli = document.createElement("li")
    localli.setAttribute("class", "RemoteVideoLi")
    var Video = document.createElement("video")
    Video.setAttribute("autoplay", true)
    Video.setAttribute("class", "video")
    Video.srcObject = new MediaStream([track])
    localli.appendChild(Video)
    remoteVideoList.appendChild(localli)

    Client.consumer_resume(consumer.id)
})

socket.on('new-dataproducer', async ({producerId, url, producerSocketId, consumerSocketId}) => {
    console.log('directProducer')
    let cTransport = await Client.createRecvTransport()
    let consumer = await Client.consumeData(cTransport.consumerTransport, producerId, cTransport.serverTransportId, url)
    
})


socket.on('getDataProducers-response', async (producerId,url) => {
    let cTransport = await Client.createRecvTransport()
    let consumer = await Client.consumeData(cTransport.consumerTransport, producerId, cTransport.serverTransportId, url)
})


// d여기까지가 중요한것 
// 밑은 아마 deprecated

socket.on('createWebRtcTransportResponse', async ({consumer, params, isData, remoteProducerId}) => {
    if(consumer) {
       
            if (params.error) {
                console.log(params.error)
                return
            }
            console.log(`PARAMS... ${params}`)
    
            let consumerTransport
            try {
                consumerTransport = device.createRecvTransport(params)
            } catch (error) {
    
                console.log(error)
                return
            }
    
            consumerTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
                try {
                    console.log('connection complete')
                    await socket.emit('transport-recv-connect', {
                        dtlsParameters,
                        serverConsumerTransportId: params.id,
                        roomNumber,
                        socketId: socket.id,
                    })
    
                    callback()
                } catch (error) {
    
                    errback(error)
                }
            })
            addConsumerTransport(consumerTransport, remoteProducerId)
            if(isData) {
                connectDataRecvTransport(consumerTransport, remoteProducerId, params.id)
            }else {
                connectRecvTransport(consumerTransport, remoteProducerId, params.id)
            }
        
    } else {
        console.log(params)
        producerTransport = device.createSendTransport(params)


        producerTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
            try {

                await socket.emit('transport-connect', {
                dtlsParameters,
                roomNumber,
                socketId: socket.id
                })

                callback()

            } catch (error) {
                errback(error)
            }
        })


        producerTransport.on('producedata', async (parameters, callback, errback) => {
            console.log("producer-data evoked")
            console.log(parameters)
            dataproducerCallback = callback;
            console.log(dataproducerCallback)
          try {
              await socket.emit('transport-produce-data', {
                  sctpStreamParameters: parameters.sctpStreamParameters,
                  label: parameters.label,
                  protocol: parameters.protocol,
                  socketId : socket.id,
                  roomNumber,
              })
          } catch (error) {
              errback(error)
          }
        })

        producerTransport.on('produce', async (parameters, callback, errback) => {
            console.log(parameters)
            producerCallback = callback;
            try {
                console.log('start Produce')
                await socket.emit('transport-produce', {
                    roomNumber,
                    socketId: socket.id,
                    kind: parameters.kind,
                    rtpParameters: parameters.rtpParameters,
                    appData: parameters.appData,
                })
            } catch (error) {
                errback(error)
            }
        })

        connectSendTransport()
        connectDataSendTransport()
    }
})

socket.on('transport-produce-data-response', async ({id, producerExists}) => {
    console.log(`Data ProducerExist! ${id}`, producerExists)
    dataproducerCallback(id)
    // if (producerExists) getDataProducers()
})

socket.on('transport-produce-response', async ({id, producerExists}) => {
    console.log('ProducerExist!', producerExists)
    producerCallback(id)
    if (producerExists) getProducers()
})

// socket.on('new-producer', ({producerId, url, producerSocketId, consumerSocketId}) => {
//     signalNewConsumerTransport(producerId, url, false)
// })



socket.on('consume_response', async ({params, remoteProducerId}) => {
    if (params.error) {
        console.log('Cannot Consume')
        return
    }

    console.log(`Consumer Params ${params}`)

    const consumer = await getConsumerTransport(remoteProducerId).consume({
        id: params.id,
        producerId: params.producerId,
        kind: params.kind,
        rtpParameters: params.rtpParameters
    })

/*
    consumerTransports = [
        ...consumerTransports,
        {
            consumerTransport,
            serverConsumerTransportId: params.id,
            producerId: remoteProducerId,
            consumer,
        },
    ]
*/
    const { track } = consumer

    var remoteVideoList = document.getElementById("remoteVideo")
    var localli = document.createElement("li")
    localli.setAttribute("class", "RemoteVideoLi")
    var Video = document.createElement("video")
    Video.setAttribute("autoplay", true)
    Video.setAttribute("class", "video")
    Video.srcObject = new MediaStream([track])
    localli.appendChild(Video)
    remoteVideoList.appendChild(localli)

    socket.emit('consumer-resume', { serverConsumerId: params.serverConsumerId, roomNumber })
})

socket.on('consume_data_response', async ({params, remoteProducerId}) => {
    if (params.error) {
        console.log('Cannot Consume')
        return
    }

    console.log(`Consumer Params ${params}`)

    const consumer = await getConsumerTransport(remoteProducerId).consumeData({
        id: params.id,
        dataProducerId: params.producerId,
        sctpStreamParameters: params.sctpStreamParameters,
    })

    consumer.on("open", () => {
        console.log("dataChannel open")
        dataproducer.send(JSON.stringify({
            type : "command",
            socketId: socket.id,
            roomNumber,
            command : "getLightStatus"
        }))
    })

    consumer.on("error", (error) => {
        console.log(error)
    })

    consumer.on('message', (data) => {
        let parsed = JSON.parse(data)
        console.log(parsed)
        if (parsed.command === 'communication') {
            addMessage(parsed.msg, false)
        }

        // addMessage(parsed.msg, false)
        if (parsed.command === 'getLightStatus' && !getLightStatus) {
            if (parsed.result.room1Light) {
                let LightOnRoom1On = document.getElementById("LightOnRoom1On");
                LightOnRoom1On.style.color = 'yellow'
                LightOnRoom1On.style.fontWeight = 'bold'
                boolLightRoom1 = 1
            }else {
                let LightOnRoom1Off = document.getElementById("LightOnRoom1Off");
                LightOnRoom1Off.style.color = 'yellow'
                LightOnRoom1Off.style.fontWeight = 'bold'
                boolLightRoom1 = 0
            }

            if (parsed.result.room2Light) {
                let LightOnRoom2On = document.getElementById("LightOnRoom2On");
                LightOnRoom2On.style.color = 'yellow'
                LightOnRoom2On.style.fontWeight = 'bold'
                boolLightRoom2 = 1
            }else {
                let LightOnRoom2Off = document.getElementById("LightOnRoom2Off");
                LightOnRoom2Off.style.color = 'yellow'
                LightOnRoom2Off.style.fontWeight = 'bold'
                boolLightRoom2 = 0
            }

            if (parsed.result.room3Light) {
                let LightOnRoom3On = document.getElementById("LightOnRoom3On");
                LightOnRoom3On.style.color = 'yellow'
                LightOnRoom3On.style.fontWeight = 'bold'
                boolLightRoom3 = 1
            }else {
                let LightOnRoom3Off = document.getElementById("LightOnRoom3Off");
                LightOnRoom3Off.style.color = 'yellow'
                LightOnRoom3Off.style.fontWeight = 'bold'
                boolLightRoom3 = 0
            }
        }

        if (parsed.command === 'response_ok'){
            if (parsed.subject === 'LightOnRoom1') {
                if (boolLightRoom1) {
                    let LightOnRoom1Off = document.getElementById("LightOnRoom1Off");
                    LightOnRoom1Off.style.color = 'yellow'
                    LightOnRoom1Off.style.fontWeight = 'bold'
                    boolLightRoom1 = 0
                    let LightOnRoom1On = document.getElementById("LightOnRoom1On");
                    LightOnRoom1On.style.color = 'black'
                    LightOnRoom1On.style.fontWeight = 'normal'
                }else {
                    let LightOnRoom1On = document.getElementById("LightOnRoom1On");
                    LightOnRoom1On.style.color = 'yellow'
                    LightOnRoom1On.style.fontWeight = 'bold'
                    boolLightRoom1 = 1
                    let LightOnRoom1Off = document.getElementById("LightOnRoom1Off");
                    LightOnRoom1Off.style.color = 'black'
                    LightOnRoom1Off.style.fontWeight = 'normal'
                }
            }
            if (parsed.subject === 'LightOnRoom2') {
                if (boolLightRoom2) {
                    let LightOnRoom2Off = document.getElementById("LightOnRoom2Off");
                    LightOnRoom2Off.style.color = 'yellow'
                    LightOnRoom2Off.style.fontWeight = 'bold'
                    boolLightRoom2 = 0
                    let LightOnRoom2On = document.getElementById("LightOnRoom2On");
                    LightOnRoom2On.style.color = 'black'
                    LightOnRoom2On.style.fontWeight = 'normal'
                }else {
                    let LightOnRoom2On = document.getElementById("LightOnRoom2On");
                    LightOnRoom2On.style.color = 'yellow'
                    LightOnRoom2On.style.fontWeight = 'bold'
                    boolLightRoom2 = 1
                    let LightOnRoom2Off = document.getElementById("LightOnRoom2Off");
                    LightOnRoom2Off.style.color = 'black'
                    LightOnRoom2Off.style.fontWeight = 'normal'
                }
            }

            if (parsed.subject === 'LightOnRoom3') {
                if (boolLightRoom3) {
                    let LightOnRoom3Off = document.getElementById("LightOnRoom3Off");
                    LightOnRoom3Off.style.color = 'yellow'
                    LightOnRoom3Off.style.fontWeight = 'bold'
                    boolLightRoom3 = 0
                    let LightOnRoom3On = document.getElementById("LightOnRoom3On");
                    LightOnRoom3On.style.color = 'black'
                    LightOnRoom3On.style.fontWeight = 'normal'
                }else {
                    let LightOnRoom3On = document.getElementById("LightOnRoom3On");
                    LightOnRoom3On.style.color = 'yellow'
                    LightOnRoom3On.style.fontWeight = 'bold'
                    boolLightRoom3 = 1
                    let LightOnRoom3Off = document.getElementById("LightOnRoom3Off");
                    LightOnRoom3Off.style.color = 'black'
                    LightOnRoom3Off.style.fontWeight = 'normal'
                }
            }
            if (parsed.subject === "LightOnWhole") {
                if (boolLightRoom1) {
                    let LightOnRoom1Off = document.getElementById("LightOnRoom1Off");
                    LightOnRoom1Off.style.color = 'yellow'
                    LightOnRoom1Off.style.fontWeight = 'bold'
                    boolLightRoom1 = 0
                    let LightOnRoom1On = document.getElementById("LightOnRoom1On");
                    LightOnRoom1On.style.color = 'black'
                    LightOnRoom1On.style.fontWeight = 'normal'
                }else {
                    let LightOnRoom1On = document.getElementById("LightOnRoom1On");
                    LightOnRoom1On.style.color = 'yellow'
                    LightOnRoom1On.style.fontWeight = 'bold'
                    boolLightRoom1 = 1
                    let LightOnRoom1Off = document.getElementById("LightOnRoom1Off");
                    LightOnRoom1Off.style.color = 'black'
                    LightOnRoom1Off.style.fontWeight = 'normal'
                }

                if (boolLightRoom2) {
                    let LightOnRoom2Off = document.getElementById("LightOnRoom2Off");
                    LightOnRoom2Off.style.color = 'yellow'
                    LightOnRoom2Off.style.fontWeight = 'bold'
                    boolLightRoom2 = 0
                    let LightOnRoom2On = document.getElementById("LightOnRoom2On");
                    LightOnRoom2On.style.color = 'black'
                    LightOnRoom2On.style.fontWeight = 'normal'
                }else {
                    let LightOnRoom2On = document.getElementById("LightOnRoom2On");
                    LightOnRoom2On.style.color = 'yellow'
                    LightOnRoom2On.style.fontWeight = 'bold'
                    boolLightRoom2 = 1
                    let LightOnRoom2Off = document.getElementById("LightOnRoom2Off");
                    LightOnRoom2Off.style.color = 'black'
                    LightOnRoom2Off.style.fontWeight = 'normal'
                }

                if (boolLightRoom3) {
                    let LightOnRoom3Off = document.getElementById("LightOnRoom3Off");
                    LightOnRoom3Off.style.color = 'yellow'
                    LightOnRoom3Off.style.fontWeight = 'bold'
                    boolLightRoom3 = 0
                    let LightOnRoom3On = document.getElementById("LightOnRoom3On");
                    LightOnRoom3On.style.color = 'black'
                    LightOnRoom3On.style.fontWeight = 'normal'
                }else {
                    let LightOnRoom3On = document.getElementById("LightOnRoom3On");
                    LightOnRoom3On.style.color = 'yellow'
                    LightOnRoom3On.style.fontWeight = 'bold'
                    boolLightRoom3 = 1
                    let LightOnRoom3Off = document.getElementById("LightOnRoom3Off");
                    LightOnRoom3Off.style.color = 'black'
                    LightOnRoom3Off.style.fontWeight = 'normal'
                }
            }
        }
    })

})

const addConsumerTransport = (consumerTransport, remoteProducerId) => {
    consumertransports = [
        ...consumertransports, 
        {
            remoteProducerId, transport: consumerTransport,
        }
    ]
}

const getConsumerTransport = (remoteProducerId) => {
    const [consumerTransport] = consumertransports.filter(transport => transport.remoteProducerId === remoteProducerId)
    return consumerTransport.transport
}

const signalNewConsumerTransport = async (remoteProducerId, url, isData) => {
    console.log(`new producer arrived : ${remoteProducerId}`)
    await socket.emit('createWebRtcTransport', { consumer: true, isData, remoteProducerId})
}




const createSendTransport = async () => {
  await socket.emit('createWebRtcTransport', { consumer: false })
}

const connectDataSendTransport = async () => {
    
}

const connectSendTransport = async () => {

    
}

const connectRecvTransport = async (consumerTransport, remoteProducerId, serverConsumerTransportId, url) => {
    
    await socket.emit('consume', {
        rtpCapabilities: device.rtpCapabilities,
        remoteProducerId,
        serverConsumerTransportId,
        roomNumber,
        socketId: socket.id,
    })
}

const connectDataRecvTransport = async (consumerTransport, remoteProducerId, serverConsumerTransportId, url) => {
    console.log(`in data recv transport`)
    await socket.emit('consume-data', {
        rtpCapabilities: device.rtpCapabilities,
        remoteProducerId,
        serverConsumerTransportId,
        roomNumber,
        socketId: socket.id,
    }, async ({ params }) => {
        if (params.error) {
            console.log('Cannot Consume')
            return
        }

        console.log(`Data Consumer Params ${params}`)
        console.log(params.producerId)
        const consumer = await consumerTransport.consumeData({
            id: params.id,
            dataproducerId: params.producerId,
            sctpStreamParameters: params.sctpStreamParameters,
        })

        consumer.on("open", () => {
            console.log("dataChannel open")
        })

        consumer.on("error", (error) => {
            console.log(error)
        })

        consumer.on('message', (data) => {
            console.log(data)
        })

        consumerTransports = [
            ...consumerTransports,
            {
                consumerTransport,
                serverConsumerTransportId: params.id,
                producerId: remoteProducerId,
                consumer,
            },
        ]
    })
}
// const sending_data = () => {
//     let data = document.getElementById("input_data_send").value;
//     console.log(`Sending : ${data}`)
//     msg = {
//         type : "text",
//         data : data,
//     }
//     dataproducer.send(JSON.stringify(msg))
// }
// btnDataSend.addEventListener('click', sending_data)


let tagLightOnWhole = document.getElementById("LightOnWhole");
tagLightOnWhole.addEventListener("click", ()=>{
    let msg = {
        type : "command",
        socketId : socket.id,
        roomNumber,
        subject : "LightOnWhole",
        command : "Click"
    }
    dataproducer.send(JSON.stringify(msg))
});

let tagLightOnRoom1 = document.getElementById("LightOnRoom1");
tagLightOnRoom1.addEventListener("click", ()=>{
    let msg = {
        type : "command",
        socketId : socket.id,
        roomNumber,
        subject : "LightOnRoom1",
        command : "Click"
    }
    dataproducer.send(JSON.stringify(msg))
});

let tagLightOnRoom2 = document.getElementById("LightOnRoom2");
    tagLightOnRoom2.addEventListener("click", ()=>{
    let msg = {
        type : "command",
        socketId : socket.id,
        roomNumber,
        subject : "LightOnRoom2",
        command : "Click"
    }
    dataproducer.send(JSON.stringify(msg))
});

let tagLightOnRoom3 = document.getElementById("LightOnRoom3");
tagLightOnRoom3.addEventListener("click", ()=>{
    let msg = {
        type : "command",
        socketId : socket.id,
        roomNumber,
        subject : "LightOnRoom3",
        command : "Click"
    }
    dataproducer.send(JSON.stringify(msg))
});