const mediasoupClient = require('mediasoup-client');
const io = require('socket.io-client')

let remote_list = document.getElementById("remoteVideo")
let btnDataSend = document.getElementById("btnDataSend")

var urlParams = new URLSearchParams(window.location.search);

const form = document.getElementById('chat-form');

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
let producer;
let producerCallback
let dataproducer;
let dataproducerCallback
let device
let getLightStatus = false

let consumertransports = []

let params = {
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

const socket = io('/client')

socket.on('connection-success', ({ socketId }) => {
  console.log("===== connection success ======")
  console.log(socketId)

  getRTPcap()
})

const getRTPcap = () => {
  socket.emit('getRTPcap', { roomNumber: roomNumber ,url: local_url }, (data) => {
      if (!data.error) {
        console.log(`Router RTP Capabilities... ${data.rtpCapabilities}`)

        rtpCapabilities = data.rtpCapabilities

        getLocalStream()
      }
      else {
        setTimeout(getRTPcap, 1000);
      }
  })
}

const getLocalStream = () => {
  navigator.mediaDevices.getUserMedia({
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
      .then(streamSuccess)
      .catch(error => {
          console.log(error.message)
      })
}

const streamSuccess = (stream) => {

  const track = stream.getVideoTracks()[0]
  params = {
      track,
      ...params
  }
  localVideo.srcObject = stream
  createDevice()
}

const createDevice = async () => {
  try {
      device = new mediasoupClient.Device()

      await device.load({
          routerRtpCapabilities: rtpCapabilities
      })

      console.log(`===== Device created =====`)
      console.log(`cap : ${device.rtpCapabilities}`)

      createSendTransport()
  } catch (error) {
      console.log(error)
      if (error.name === 'UnsupportedError')
          console.warn(`browser not support`)
  }
}

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
    if (producerExists) getDataProducers()
})

socket.on('transport-produce-response', async ({id, producerExists}) => {
    console.log('ProducerExist!', producerExists)
    producerCallback(id)
    if (producerExists) getProducers()
})

socket.on('new-producer', ({producerId, url, producerSocketId, consumerSocketId}) => {
    signalNewConsumerTransport(producerId, url, false)
})

socket.on('new-dataproducer', ({producerId, url, producerSocketId, consumerSocketId}) => {
    signalNewConsumerTransport(producerId, url, true)
})

socket.on('getProducers-response', (producerId,url) => {
    signalNewConsumerTransport(producerId, url, false)
})

socket.on('getDataProducers-response', (producerId,url) => {
    signalNewConsumerTransport(producerId, url, true)
})

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
        // dataproducer.send(JSON.stringify({
        //     type : "command",
        //     clientId,
        //     roomNumber,
        //     command : "getLightStatus"
        // }))
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

const getDataProducers = () => {
    socket.emit('getDataProducers', { remote_url , roomNumber, socketId: socket.id})
}

const getProducers = () => {
    socket.emit('getProducers', { remote_url , roomNumber, socketId: socket.id})
}


const createSendTransport = async () => {
  await socket.emit('createWebRtcTransport', { consumer: false })
}

const connectDataSendTransport = async () => {
    dataproducer = await producerTransport.produceData()

    dataproducer.on("open", () => {
        console.log("producer data channel opend")
        console.log('getlightStatus')
        // dataproducer.send(JSON.stringify({
        //     socketId: socket.id,
        //     roomNumber,
        //     command : "communication",
        //     role : "wallpad",
        //     msg : message
        // }))
    })

    dataproducer.on("error", (error) => {
        console.log(error)
    })
}

const connectSendTransport = async () => {

    producer = await producerTransport.produce(params)

    producer.on('trackended', () => {
        console.log('track ended')

    })

    producer.on('transportclose', () => {
        console.log('transport ended')

    })
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
            dataProducerId: params.producerId,
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

