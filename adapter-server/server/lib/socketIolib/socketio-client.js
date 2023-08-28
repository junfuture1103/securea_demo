const mediasoupClient = require('mediasoup-client');
const io = require('socket.io-client');
const ClientConnection = require('./ClientConnection');

var urlParams = new URLSearchParams(window.location.search);

let rtpCapabilities
let roomNumber = urlParams.get("roomNumber");
let local_url = "wallpad"
let remote_url = ["wallpad", "interphone", "zeroswitch"]
let getLightStatus = false

const socket = io('/client')
let Client

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