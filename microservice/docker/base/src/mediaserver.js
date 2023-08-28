import { io } from 'socket.io-client'
import fs from 'fs'
import mediasoup from 'mediasoup'

var setting_file = fs.readFileSync('ServerSetting.json', 'utf-8')
var parsed = JSON.parse(setting_file)

let local_ip = parsed.local_ip
let remote_ip = parsed.Server_ip
let MinPort = parseInt(parsed.rtcMinPort)
let MaxPort = parseInt(parsed.rtcMaxPort)
let LocalPort = parseInt(parsed.localPort)
let ServerPort = parseInt(parsed.ServerPort)

let transports = []
let peers = {}
let dataproducers = []
let directProducers = []
let producers = []
let consumers = []
let dataconsumers = []
const mediaCodecs = [
  {
      kind: 'audio',
      mimeType: 'audio/opus',
      clockRate: 48000,
      channels: 2,
  },
  {
      kind: 'video',
      mimeType: 'video/VP8',
      clockRate: 90000,
      parameters: {
          'x-google-start-bitrate': 1000,
      },
  },
]

const createWorker = async (socketId) => {
  worker = await mediasoup.createWorker({
      rtcMinPort: MinPort,
      rtcMaxPort: MaxPort,
  })

  worker.on('died', error => {
      console.log(`===== Worker died by this reason =====`)
      console.log(error)
  })

  createRouter(socketId)

  return worker
}

let worker
let router

const createRouter = async (socketId) => {
  if (router === undefined) {
      router = await worker.createRouter({ mediaCodecs, })
      console.log("===== Router Created =====")
  }

  socket.emit('mediaserverEnrollRtpCap',{
    roomNumber: roomNumber,
    socketId: socketId,
    rtpCapabilities: router.rtpCapabilities
  });
}

const socket = io("https://192.168.1.101:443/mediaserver", {
  key: fs.readFileSync('./ssl/key.pem', 'utf-8'),
  cert: fs.readFileSync('./ssl/cert.pem', 'utf-8'),
  rejectUnauthorized: false,
})



let roomNumber = 100;

socket.on('connection-success', async ({ socketId }) => {
  console.log("===== connection success ======")
  console.log(socketId)

  worker = await createWorker(socketId)
})

socket.on('informClientsConnect', async ({socketId, url}, callback) => {
    peers[socketId] = {
        url,
        transports: [],
        producers: [],
        consumers: [],
        peerDetails: {
            name: '',
            isAdmin: false,
        }
    }
    callback()
})

const addTransport = (transport, consumer, socketId) => {

  transports = [
      ...transports,
      { socketId: socketId, transport, consumer, }
  ]
}

const getTransport = (socketId) => {
    const [producerTransport] = transports.filter(transport => transport.socketId === socketId && !transport.consumer)
    return producerTransport.transport
}

const addDataProducer = (producer, socketId) => {
    dataproducers = [
        ...dataproducers,
        { socketId: socketId, producer, }
    ]

    peers[socketId] = {
        ...peers[socketId],
        dataproducers: [
            ...peers[socketId].producers,
            producer.id,
        ]
    }
}

const addProducer = (producer, socketId) => {
    producers = [
        ...producers,
        { socketId: socketId, producer, }
    ]

    peers[socketId] = {
        ...peers[socketId],
        producers: [
            ...peers[socketId].producers,
            producer.id,
        ]
    }
}

socket.on('createWebRtcTransport', async ({ consumer, socketId, isData }, callback) => {
  // 8. createWebRtcTransport 함수 호출
  console.log(`connection, on, createWebRtcTransport`)
  await createWebRtcTransport(router).then(
      async transport => {
          // transport의 정보를 callback함수로 전달함. ( 클라이언트로 송신 )
          await callback({
              params: {
                  id: transport.id,
                  iceParameters: transport.iceParameters,
                  iceCandidates: transport.iceCandidates,
                  dtlsParameters: transport.dtlsParameters,
                  sctpParameters: transport.sctpParameters,
              },
              isData
          })
          // transport를 producer인지 consumer인지의 정보와 함께 저장함. 
          // add transport to Peer's properties
          addTransport(transport, consumer, socketId)
      },
      error => {
          // console.log(error)
      })
  // console.log('succesfully made')
})

socket.on('transport-connect', async ({dtlsParameters, roomNumber, socketId}) => {
    getTransport(socketId).connect({ dtlsParameters })
});

socket.on('transport-recv-connect', async ({dtlsParameters, serverConsumerTransportId})=>{
   
    const consumerTransport = transports.find(transportData => (
        transportData.consumer && transportData.transport.id == serverConsumerTransportId
    )).transport
    await consumerTransport.connect({ dtlsParameters })
})

socket.on('transport-produce-data', async ({sctpStreamParameters, label, protocol, socketId}, callback) => {
    const producer = await getTransport(socketId).produceData({
        sctpStreamParameters,
    })

    producer.on('transportclose', () => {
        // console.log('transport for this producer closed ')
        producer.close()
    })

    addDataProducer(producer, socketId)
  
    await addDirectConsumer(producer)
  
    const directTransport = await router.createDirectTransport()
    const directProducer = await directTransport.produceData()
    addDirectProducer(directProducer, socketId)

    informDirectDataConsumers(socketId, directProducer.id)
    //  informDataConsumers(socketId, producer.id)

    callback({
        id: producer.id,
        socketId: socketId,
        producerExists: dataproducers.length > 1 ? true : false
    })
});

const addDirectProducer = (producer, socketId) => {
    let isAlreadyMade = false
    for (let i in directProducers) {
      if (socketId === directProducers[i].socketId) {
        isAlreadyMade = true
      }
    }
    if (!isAlreadyMade) {
      directProducers = [
        ...directProducers,
        { socketId: socketId, producer, }
        ]
    }
    console.log(directProducers)
}

socket.on('transport-produce', async ({socketId, kind, rtpParameters, appData}, callback) => {
    const producer = await getTransport(socketId).produce({
        kind,
        rtpParameters,
    })

    producer.on('transportclose', () => {
        // console.log('transport for this producer closed ')
        producer.close()
    })

    addProducer(producer, socketId)
    
    informConsumers(socketId, producer.id)

    callback({
        id: producer.id,
        socketId: socketId,
        producerExists: producers.length > 1 ? true : false
    })
});

socket.on('getProducers', ({socketId, remote_url}, callback) => {

    let producerList = []
    let urlList = []

    producers.forEach(producerData => {
        if (producerData.socketId !== socketId && remote_url.includes(peers[producerData.socketId].url)) {
            producerList = [...producerList, producerData.producer.id]
            urlList = [...urlList, peers[producerData.socketId].url]
        }
    })

    callback(producerList, urlList)
})

socket.on('getDataProducers', ({socketId, remote_url}, callback) => {
    
    let producerList = []
    let urlList = []

    directProducers.forEach(producerData => {
        if (producerData.socketId !== socketId && remote_url.includes(peers[producerData.socketId].url)) {
            producerList = [...producerList, producerData.producer.id]
            urlList = [...urlList, peers[producerData.socketId].url]
        }
    })

    callback(producerList, urlList)
})

socket.on('consume', async ({rtpCapabilities, remoteProducerId, serverConsumerTransportId, socketId}, callback) => {
    try {
        console.log(`connection, on, consume`)
        let consumerTransport = transports.find(transportData => (
            transportData.consumer && transportData.transport.id == serverConsumerTransportId
        )).transport

        if (router.canConsume({
            producerId: remoteProducerId,
            rtpCapabilities
        })) {
            // console.log('can consume !', remoteProducerId)
            const consumer = await consumerTransport.consume({
                producerId: remoteProducerId,
                rtpCapabilities,
                paused: true,
            })

            consumer.on('transportclose', () => {
                // console.log('transport close from consumer')
            })

            consumer.on('producerclose', () => {
                // console.log('producer of consumer closed')
                socket.emit('producer-closed', { remoteProducerId })

                consumerTransport.close([])
                transports = transports.filter(transportData => transportData.transport.id !== consumerTransport.id)
                consumer.close()
                consumers = consumers.filter(consumerData => consumerData.consumer.id !== consumer.id)
            })

            addConsumer(consumer, socketId)

            const params = {
                id: consumer.id,
                producerId: remoteProducerId,
                kind: consumer.kind,
                rtpParameters: consumer.rtpParameters,
                serverConsumerId: consumer.id,
            }


            callback({ params })
        }
    } catch (error) {
        // console.log(error.message)
        callback({
            params: {
                error: error
            }
        })
    }
})

socket.on('consume-data', async ({rtpCapabilities, remoteProducerId, serverConsumerTransportId, socketId}, callback) => {
    try {
        console.log(`connection, on, dataconsume`)
        let consumerTransport = transports.find(transportData => (
            transportData.consumer && transportData.transport.id == serverConsumerTransportId
        )).transport

            // console.log('can consume !', remoteProducerId)
            const consumer = await consumerTransport.consumeData({
                dataProducerId: remoteProducerId
            })

            consumer.on('transportclose', () => {
                
                // console.log('transport close from consumer')
            })

            consumer.on('producerclose', () => {
                // console.log('producer of consumer closed')
                socket.emit('producer-closed', { remoteProducerId })

                consumerTransport.close([])
                transports = transports.filter(transportData => transportData.transport.id !== consumerTransport.id)
                consumer.close()
                consumers = consumers.filter(consumerData => consumerData.consumer.id !== consumer.id)
            })

            addConsumer(consumer, socketId)

            const params = {
                id: consumer.id,
                producerId: remoteProducerId,
                sctpStreamParameters: consumer.sctpStreamParameters,
                kind: consumer.kind,
                rtpParameters: consumer.rtpParameters,
                serverConsumerId: consumer.id,
                label: consumer.label,
                protocol: consumer.protocol
            }

            callback({ params })
        
    } catch (error) {
        // console.log(error.message)
        callback({
            params: {
                error: error
            }
        })
    }
});

socket.on('consumer-resume', async ({ serverConsumerId }) => {
    console.log('connection, on, consumer resume')
    const { consumer } = consumers.find(consumerData => consumerData.consumer.id === serverConsumerId)
    await consumer.resume()
})

const addConsumer = (consumer, socketId) => {
    // add the consumer to the consumers list
    consumers = [
        ...consumers,
        { socketId: socketId, consumer, }
    ]

    // add the consumer id to the peers list
    peers[socketId] = {
        ...peers[socketId],
        consumers: [
            ...peers[socketId].consumers,
            consumer.id,
        ]
    }
}

const informConsumers = (socketId, id) => {
    // // console.log(`just joined, id ${id}, ${socketId}`)
    // 새로운 프로튜서, 나머지 소켓들에게 정보 알림.
    producers.forEach(producerData => {
        if (producerData.socketId !== socketId) {
            const url = peers[socketId].url
            socket.emit('new-producer', {producerId: id, url, producerSocketId: socketId, consumerSocketId: producerData.socketId})
        }
    })
}

const informDirectDataConsumers = (socketId, id) => {
    // // console.log(`just joined, id ${id}, ${socketId}`)
    dataproducers.forEach(producerData => {
        if (producerData.socketId === socketId) {
            const url = peers[socketId].url
            socket.emit('new-directdataproducer', {producerId: id, url, producerSocketId: socketId, consumerSocketId: producerData.socketId})
        }
    })

    
}

const informDataConsumers = (socketId, id) => {
    // // console.log(`just joined, id ${id}, ${socketId}`)
    dataproducers.forEach(producerData => {
        if (producerData.socketId !== socketId) {
            const url = peers[socketId].url
            socket.emit('new-dataproducer', {producerId: id, url, producerSocketId: socketId, consumerSocketId: producerData.socketId})
        }
    })
}

const createWebRtcTransport = async (router) => {
  return new Promise(async (resolve, reject) => {
      try {
          const webRtcTransport_options = {
              listenIps: [
                  {
                      ip: '0.0.0.0',
                      announcedIp: local_ip
                  }
              ],
              enableUdp: true,
              enableTcp: true,
              preferUdp: true,
              enableSctp: true,
          }
          // router에 webRtcTransport_options을 넣어 transport 생성, 연결 정보를 의미함.
          let transport = await router.createWebRtcTransport(webRtcTransport_options)
          // // console.log(`transport id: ${transport.id}`)

          transport.on('dtlsstatechange', dtlsState => {
              if (dtlsState === 'closed') {
                  transport.close()
              }
          })

          transport.on('close', () => {
              // console.log('transport closed')
          })
          // transport 반환
          resolve(transport)

      } catch (error) {
          reject(error)
      }
  })
}

let room1 = false;
let room2 = false;
let room3 = false;
let room4 = false;

const addDirectConsumer = async (producer) => {
    const directTransport = await router.createDirectTransport()
    const directConsumer = await directTransport.consumeData({
      dataProducerId: producer.id,
    })
  
    
    directConsumer.observer.on('close', () => {
      
    })
  
    directConsumer.on('message', async function(message, ppid){
      let parsed_msg = JSON.parse(message.toString("utf-8"))
      console.log(parsed_msg) 
      
        if (parsed_msg.command === 'enrollStatusZeroSwitch') {
            if (parsed_msg.result.room1) {
                room1 = true;
            } else {
                room1 = false;
            }
            if (parsed_msg.result.room2) {
                room2 = true;
            } else {
                room2 = false;
            }
            if (parsed_msg.result.room3) {
                room3 = true;
            } else {
                room3 = false;
            }
            if (parsed_msg.result.room4) {
                room4 = true;
            } else {
                room4 = false;
            }
            console.log(`room1 : ${room1}, room2 : ${room2}, room3 : ${room3}, room4 : ${room4}`)
        }

        if (parsed_msg.command === 'Click') {
            for (let i in directProducers) {
                if(directProducers[i].socketId !== parsed_msg.socketId){
                  directProducers[i].producer.send(
                    JSON.stringify({
                      command: 'Click',
                      subject: parsed_msg.subject,
                    })
                  )
                }
            }
            console.log(`room1 : ${room1}, room2 : ${room2}, room3 : ${room3}, room4 : ${room4}`)
        }

        if (parsed_msg.command === 'response_ok') {
            if (parsed_msg.subject === 'LightOnWhole') {
                room1 = !room1
                room2 = !room2
                room3 = !room3
            }
            if (parsed_msg.subject === 'LightOnRoom1') {
                room1 = !room1
            }
            if (parsed_msg.subject === 'LightOnRoom2') {
                room2 = !room2
            }
            if (parsed_msg.subject === 'LightOnRoom1') {
                room3 = !room3
            }

            for (let i in directProducers) {
                if(directProducers[i].socketId !== parsed_msg.socketId){
                  directProducers[i].producer.send(
                    JSON.stringify({
                      command: 'response_ok',
                      subject: parsed_msg.subject,
                    })
                  )
                }
            }
            console.log(`room1 : ${room1}, room2 : ${room2}, room3 : ${room3}, room4 : ${room4}`)
        }

        if (parsed_msg.command === 'getLightStatus') {
            for (let i in directProducers) {
                if(directProducers[i].socketId === parsed_msg.socketId){
                  directProducers[i].producer.send(
                    JSON.stringify({
                      command : 'getLightStatus',
                      result : {
                        room1Light : room1,
                        room2Light : room2,
                        room3Light : room3,
                        room4Light : room4,
                      }
                    })
                  )
                }
            }
        }

        if (parsed_msg.command === 'communication'){
            for (let i in directProducers) {
                if(directProducers[i].socketId !== parsed_msg.socketId){
                  directProducers[i].producer.send(
                    JSON.stringify({
                      socketId : parsed_msg.socketId,
                      type : "command",
                      rommNuber : parsed_msg.roomNumber,
                      subject : parsed_msg.subject,
                      command : parsed_msg.command,
                      result : parsed_msg.result,
                      msg : parsed_msg.msg
                    })
                  )
                }
            }
        }

      

    })
  }