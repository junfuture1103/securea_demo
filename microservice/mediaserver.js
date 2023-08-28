import { io } from 'socket.io-client'
import fs from 'fs'
import mediasoup from 'mediasoup'

import {Debug, Log} from './util/Logger.js'
import { env } from 'process'

var setting_file = fs.readFileSync('ServerSetting.json', 'utf-8')
var parsed = JSON.parse(setting_file)

let isDocker = process.env.ISDOCKER
let isHttp = process.env.ISHTTP

let local_ip  
let remote_ip
let MinPort 
let MaxPort 
let ServerPort
let SignalingPort

let isDebug = false;

if (process.env.DEBUG) {
    isDebug = true;
}

if(isDocker) {
    local_ip = process.env.LOCAL_IP
    remote_ip = process.env.REMOTE_IP
    MinPort = parseInt(process.env.MINPORT)
    MaxPort = parseInt(process.env.MAXPORT)
    SignalingPort = parseInt(process.env.SIGPORT)
    ServerPort = parseInt(process.env.REMOTEPORT)
} else {
    local_ip = parsed.local_ip
    remote_ip = parsed.Server_ip
    MinPort = parseInt(parsed.rtcMinPort)
    MaxPort = parseInt(parsed.rtcMaxPort)
    SignalingPort = parseInt(parsed.localPort)
    ServerPort = parseInt(parsed.ServerPort)
}

let transports = []
let peers = {}
let dataproducers = []
let directProducers = []
let producers = []
let consumers = []
let dataconsumers = []
let pipeTransports = []
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
    Log(`Worker died by : ${error}`)  
  })

  createRouter(socketId)

  return worker
}

let worker
let router

const createRouter = async (socketId) => {
  if (router === undefined) {
      router = await worker.createRouter({ mediaCodecs, })
      Log(`Router Created : ${router.id}`)
  }

  Debug('mediaserverEnrollRtpCap', isDebug)

  socket.emit('mediaserverEnrollRtpCap',{
    roomNumber: roomNumber,
    socketId: socketId,
    rtpCapabilities: router.rtpCapabilities
  });
}

let socket

if (true) {
    socket = io("http://" + remote_ip + ":" + SignalingPort + "/mediaserver")
} else {
    socket = io("https://" + remote_ip + ":" + SignalingPort + "/mediaserver", {
        key: fs.readFileSync('./ssl/key.pem', 'utf-8'),
        cert: fs.readFileSync('./ssl/cert.pem', 'utf-8'),
        rejectUnauthorized: false,
    })
}

let roomNumber

if (process.env.ROOMNUMBER == undefined) {
    roomNumber = 100
} else {
    roomNumber = parseInt(process.env.ROOMNUMBER)
}

socket.on('connection-success', async ({ socketId, mediaserverIp }) => {
    Log(`connection-success, socketID : ${socketId}`)
  
  worker = await createWorker(socketId)
})

socket.on('informClientsConnect', async ({socketId, url}, callback) => {
    Debug(`Client Connected : ${socketId}, ${url}`)
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
  Log(`connection, on, createWebRtcTransport`)
  
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
    Log(`transport-connect : ${socketId}`)
    getTransport(socketId).connect({ dtlsParameters })
});

socket.on('transport-recv-connect', async ({dtlsParameters, serverConsumerTransportId})=>{
   Log(`Hello, transport-recv-connect`)
    const consumerTransport = transports.find(transportData => (
        transportData.consumer && transportData.transport.id == serverConsumerTransportId
    )).transport
    await consumerTransport.connect({ dtlsParameters })
})

socket.on('transport-produce-data', async ({sctpStreamParameters, label, protocol, socketId}, callback) => {
    Log('transport-produce-data')
    
    const producer = await getTransport(socketId).produceData({
        sctpStreamParameters,
    })

    producer.on('transportclose', () => {
        Log(`dataproducer ${producer.id} closed by transportclose`)
        
        for (let i = 0; i < dataproducers.length; i++) {
            if(dataproducers[i].producer.id == producer.id) {
                delete dataproducers[i]
                for(let j = 0; j < directProducers.length; j++) {
                    if (directProducers[j].socketId == dataproducers[i].socketId) {
                        delete directProducers[j]
                    }
                }
            }
        }
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
        producersExist: false //dataproducers.length > 1 ? true : false
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
}

socket.on('transport-produce', async ({socketId, kind, rtpParameters, appData}, callback) => {
    Log(`transport-producer called`)
    
    const producer = await getTransport(socketId).produce({
        kind,
        rtpParameters,
    })

    console.log("producer : ", producer)

    producer.on('transportclose', () => {
        Log(`producer ${producer.id} closed by transportclose`)
        
        for (let i = 0; i < producers.length; i++) {
            if(producers[i].producer.id == producer.id) {
                delete producers[i]
            }
        }
        producer.close()
    })

    addProducer(producer, socketId)
    
    informConsumers(socketId, producer.id)

    callback({
        id: producer.id,
        socketId: socketId,
        producersExist: producers.length > 1 ? true : false
    })
});

socket.on('getProducers', ({socketId, remote_url}, callback) => {

    Log(`on getProducers`)

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
    
    Log(`on getProducers`)

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
        Log(`on consume`)
        
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
                Log(`consumer ${consumer.id} closed by transportclose`)
        
                for (let i = 0; i < consumers.length; i++) {
                    if(consumers[i].consumer.id == consumer.id) {
                        delete consumers[i]
                    }
                }
                consumer.close()
            })

            consumer.on('producerclose', () => {
                // console.log('producer of consumer closed')
                Log(`consumer ${consumer.id} closed by producerclose`)
        
                for (let i = 0; i < consumers.length; i++) {
                    if(consumers[i].consumer.id == consumer.id) {
                        delete consumers[i]
                    }
                }
                consumer.close()
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
        Log(`on consume`)
        let consumerTransport = transports.find(transportData => (
            transportData.consumer && transportData.transport.id == serverConsumerTransportId
        )).transport

            // console.log('can consume !', remoteProducerId)
            const consumer = await consumerTransport.consumeData({
                dataProducerId: remoteProducerId
            })

            consumer.on('transportclose', () => {
                Log(`dataconsumer ${consumer.id} closed by transportclose`)
        
                for (let i = 0; i < consumers.length; i++) {
                    if(consumers[i].consumer.id == consumer.id) {
                        delete consumers[i]
                    }
                }
                consumer.close()
            })

            consumer.on('producerclose', () => {
                Log(`consumer ${consumer.id} closed by producerclose`)
        
                for (let i = 0; i < consumers.length; i++) {
                    if(consumers[i].consumer.id == consumer.id) {
                        delete consumers[i]
                    }
                }
                consumer.close()
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
    Log(`on consumer-resume`)
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
    Log(`on informConsumers`)
    producers.forEach(producerData => {
        if (producerData.socketId !== socketId) {
            const url = peers[socketId].url
            socket.emit('new-producer', {producerId: id, url, producerSocketId: socketId, consumerSocketId: producerData.socketId})
        }
    })
}

const informDirectDataConsumers = (socketId, id) => {
    Log(`on informConsumers`)
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

    directConsumer.on('producerclose', () => {
        Log(`directconsumer ${directConsumer.id} closed by producerclose`)

        directConsumer.close()
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

const addPipeTransport = (roomNumber, transport) =>{
    pipeTransports = [
        ...pipeTransports , {
            roomNumber,
            transport
        }
    ]
}

const getPipeTransport = (roomNumber) => {
    for (let i = 0; i < pipeTransports.length; i++) {
        if(pipeTransports[i].roomNumber === roomNumber) {
            return pipeTransports[i].transport
        }
    }

    return undefined;
}

socket.on('createPipeTransport', async ({myRoomNumber, oppositeRoomNumber}, callback) => {
    Log(`on createPipeTransport`)
    let pipeTransport = getPipeTransport(myRoomNumber);
    
    if (pipeTransport === undefined) {
        pipeTransport = await router.createPipeTransport({
            listenIp : local_ip,
            enableSctp: true,
            enableRtx: true,
            enableSrtp: true,
        })
        
        addPipeTransport(myRoomNumber, pipeTransport)
        
        pipeTransport.on('sctpstatechange', (sctpState) => {
            console.log(sctpState)
        })
    }
    
    callback({
        myRoomNumber,
        oppositeRoomNumber,
        ip : pipeTransport.tuple.localIp,
        port : pipeTransport.tuple.localPort,
        srtpParameters : pipeTransport.srtpParameters
    })
  })

  socket.on('connectPipeTransport', async ({myRoomNumber, oppositeRoomNumber, ip, port, srtpParameters}, callback) => {
    Log(`on connectPipeTransport`)
    let pipeTransport = getPipeTransport(oppositeRoomNumber);

    if (pipeTransport === undefined) {
        pipeTransport = await router.createPipeTransport({
            listenIp : local_ip,
            enableSctp: true,
            enableRtx: true,
            enableSrtp: true,
        })
        
        addPipeTransport(oppositeRoomNumber, pipeTransport)

        pipeTransport.on('sctpstatechange', (sctpState) => {
            console.log(sctpState)
        })
    }

    try {
        await pipeTransport.connect({
            ip: ip,
            port: port,
            srtpParameters: srtpParameters
        })    
    } catch(e) {

    }

    callback({
        myRoomNumber,
        oppositeRoomNumber,
        ip : pipeTransport.tuple.localIp,
        port : pipeTransport.tuple.localPort,
        srtpParameters : pipeTransport.srtpParameters
    })
})

// opposite Room
socket.on('connectPipeTransport_response', async ({myRoomNumber, oppositeRoomNumber, ip, port, srtpParameters}) => {
    Log(`on connectPipeTransport_response`)
    let pipeTransport = getPipeTransport(myRoomNumber);

    try {
        await pipeTransport.connect({
            ip: ip,
            port: port,
            srtpParameters : srtpParameters
        })
    } catch (e) {

    }

    for(let i = 0; i < producers.length; i++) {
        const pipeconsumer = await pipeTransport.consume({
            producerId: producers[i].producer.id
        })

        socket.emit('newPipeConsumer', {
            socketId: producers[i].socketId,
            kind: pipeconsumer.kind,
            rtpParameters: pipeconsumer.rtpParameters,
            remoteProducerId: producers[i].producer.id,
            myRoomNumber,
            oppositeRoomNumber,
        })
    }

    socket.emit('infromPipeConsumer')
})


socket.on('newPipeConsumer', async ({socketId, kind, rtpParameters, remoteProducerId, myRoomNumber, oppositeRoomNumber}) => {
    Log(`on newPipeConsume`)
    let pipeTransport = getPipeTransport(oppositeRoomNumber)
    const pipeProducer = await pipeTransport.produce({
        id: remoteProducerId,
        kind: kind,
        rtpParameters: rtpParameters,
    })

    const keys = Object.keys(peers);

    for(const key of keys) {
        socket.emit('new-producer', {
            producerId: remoteProducerId,
            url: undefined,
            producerSocketId: socketId,
            consumerSocketId: key
        })
    }

})


mediasoup.observer.on("newworker", (worker) =>
{
  console.log("new worker created [worke.pid:%d]", worker.pid);

  worker.observer.on("close", () => 
  {
    console.log("worker closed [worker.pid:%d]", worker.pid);
  });

  worker.observer.on("newrouter", (router) =>
  {
    console.log(
      "new router created [worker.pid:%d, router.id:%s]",
      worker.pid, router.id);

    router.observer.on("close", () => 
    {
      console.log("router closed [router.id:%s]", router.id);
    });

    router.observer.on("newtransport", (transport) =>
    {
      console.log(
        "new transport created [worker.pid:%d, router.id:%s, transport.id:%s]",
        worker.pid, router.id, transport.id);

      transport.observer.on("close", () => 
      {
        console.log("transport closed [transport.id:%s]", transport.id);
      });

      transport.observer.on("newproducer", (producer) =>
      {
        console.log(
          "new producer created [worker.pid:%d, router.id:%s, transport.id:%s, producer.id:%s]",
          worker.pid, router.id, transport.id, producer.id);

        producer.observer.on("close", () => 
        {
          console.log("producer closed [producer.id:%s]", producer.id);
        });
      });

      transport.observer.on("newconsumer", (consumer) =>
      {
        console.log(
          "new consumer created [worker.pid:%d, router.id:%s, transport.id:%s, consumer.id:%s]",
          worker.pid, router.id, transport.id, consumer.id);

        consumer.observer.on("close", () => 
        {
          console.log("consumer closed [consumer.id:%s]", consumer.id);
        });
      });

      transport.observer.on("newdataproducer", (dataProducer) =>
      {
        console.log(
          "new data producer created [worker.pid:%d, router.id:%s, transport.id:%s, dataProducer.id:%s]",
          worker.pid, router.id, transport.id, dataProducer.id);

        dataProducer.observer.on("close", () => 
        {
          console.log("data producer closed [dataProducer.id:%s]", dataProducer.id);
        });
      });

      transport.observer.on("newdataconsumer", (dataConsumer) =>
      {
        console.log(
          "new data consumer created [worker.pid:%d, router.id:%s, transport.id:%s, dataConsumer.id:%s]",
          worker.pid, router.id, transport.id, dataConsumer.id);

        dataConsumer.observer.on("close", () => 
        {
          console.log("data consumer closed [dataConsumer.id:%s]", dataConsumer.id);
        });
      });
    });
  });

  worker.observer.on("newwebrtcserver", (webRtcServer) =>
  {
    console.log(
      "new WebRTC server created [worker.pid:%d, webRtcServer.id:%s]",
      worker.pid, webRtcServer.id);

    webRtcServer.observer.on("close", () => 
    {
      console.log("WebRTC server closed [webRtcServer.id:%s]", webRtcServer.id);
    });
  });
});