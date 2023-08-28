import {
    Device,
    RTCRtpCodecParameters,
    useAbsSendTime,
    useFIR,
    useNACK,
    usePLI,
    useREMB,
    useSdesMid,
    MediaStreamTrack,
  } from "msc-node"

import {io} from 'socket.io-client'
import fs from 'fs'
import http from 'http'
import { exec } from "child_process";
import { createSocket } from "dgram";

exec(
    // "ffmpeg -re -f lavfi -i testsrc=size=640x480:rate=30 -vcodec libvpx -cpu-used 5 -deadline 1 -g 10 -error-resilient 1 -auto-alt-ref 1 -f rtp rtp://127.0.0.1:5030"
// "ffmpeg -f video4linux2 -r 30 -s 640x480 -i /dev/video0 -c:v libvpx -cpu-used 5 -deadline 1 -g 10 -error-resilient 1 -auto-alt-ref 1 -f rtp rtp://127.0.0.1:5030"
// "ffmpeg -rtsp_transport tcp -correct_ts_overflow 0 -i rtsp://\"admin\":\"P@ssw0rd\"@211.222.171.233:554/trackID=1 -c:v libvpx -cpu-used 5 -deadline 1 -g 10 -error-resilient 1 -auto-alt-ref 1 -f rtp rtp://127.0.0.1:5030"
//"ffmpeg -rtsp_transport tcp -correct_ts_overflow 0 -i rtsp://\"admin\":\"P@ssw0rd\"@211.222.171.233:37779/cam/realmonitor?channel=1&subtype=0&unicast=true&proto=Onvif -c:v libvpx -cpu-used 5 -deadline 1 -g 10 -error-resilient 1 -auto-alt-ref 1 -f rtp rtp://127.0.0.1:5030"
//"ffmpeg -rtsp_transport tcp -correct_ts_overflow 0 -i \"rtsp://admin:P@ssw0rd@211.222.171.233:37779/cam/realmonitor?channel=1&subtype=0&unicast=true&proto=Onvif\" -c:v libvpx -cpu-used 5 -deadline 1 -g 10 -error-resilient 1 -auto-alt-ref 1 -f rtp rtp://127.0.0.1:5030"
//"ffmpeg -rtsp_transport tcp -correct_ts_overflow 0 -i rtsp://admin:P@ssw0rd@211.222.171.233:554/trackID=1 -c:v libvpx -b:v 1M -cpu-used 5 -deadline 1 -g 10 -error-resilient "1 -auto-alt-ref 1 -f rtp rtp://127.0.0.1:5030"
"ffmpeg -rtsp_transport tcp -correct_ts_overflow 0 -i \"rtsp://admin:P@ssw0rd@211.222.171.233:37779/cam/realmonitor?channel=1&subtype=0&unicast=true&proto=Onvif\" -c:v libvpx -b:v 1M -cpu-used 5 -deadline 1 -g 10 -error-resilient 1 -auto-alt-ref 1 -f rtp rtp://127.0.0.1:5030"
);
const udp = createSocket("udp4");
udp.bind(5030);
const rtpTrack = new MediaStreamTrack({ kind: "video" });
udp.addListener("message", (data) => {
    rtpTrack.writeRtp(data);
});

let rtpCapabilities
let roomNumber = 100
let local_url = "zeroswitch"
let remote_url = ["wallpad", "interphone", "zeroswitch"]
let producer;
let producerCallback
let dataproducer;
let dataproducerCallback
let device

let producerTransport
let consumertransports = []

let room1 = false;
let room2 = false;
let room3 = false;
let room4 = false;

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



const socket = io("https://192.168.1.231:443/client", {
  key: fs.readFileSync('./ssl/key.pem', 'utf-8'),
  cert: fs.readFileSync('./ssl/cert.pem', 'utf-8'),
  rejectUnauthorized: false,
})

socket.on('connection-success', ({ socketId }) => {
  console.log("===== connection success ======")
  console.log(socketId)
  room1 = getRoom1Status();
  room2 = getRoom2Status();
  room3 = getRoom3Status();
  
  setTimeout(getRTPcap, 10000)
})


const getRoom1Status = () => {
    const url = 'http://192.168.1.251:3000/';  // 요청을 보낼 URL을 입력하세요.

    http.get(url + 'getStatus', (response) => {
    let data = '';

// 데이터가 도착할 때마다 처리
    response.on('data', (chunk) => {
        data += chunk;
    });

// 데이터 수신 완료 후 처리
    response.on('end', () => {
        console.log('Response:', data);
        room1 = data
    });
}).on('error', (error) => {
    console.error('Error:', error.message);
});
}

const clickRoom1 = () => {
        const url = 'http://192.168.1.251:3000/';  // 요청을 보낼 URL을 입력하세요.

        http.get(url + 'Click', (response) => {
        let data = '';

  // 데이터가 도착할 때마다 처리
        response.on('data', (chunk) => {
            data += chunk;
        });

  // 데이터 수신 완료 후 처리
        response.on('end', () => {
            console.log('Response:', data);
            return data
        });
    }).on('error', (error) => {
        console.error('Error:', error.message);
    });
}

const getRoom2Status = () => {
    const url = 'http://192.168.1.252:3000/';  // 요청을 보낼 URL을 입력하세요.

    http.get(url + 'getStatus', (response) => {
    let data = '';

// 데이터가 도착할 때마다 처리
    response.on('data', (chunk) => {
        data += chunk;
    });

// 데이터 수신 완료 후 처리
    response.on('end', () => {
        console.log('Response:', data);
        room2 = data
    });
}).on('error', (error) => {
    console.error('Error:', error.message);
});
}

const clickRoom2 = () => {
        const url = 'http://192.168.1.252:3000/';  // 요청을 보낼 URL을 입력하세요.

        http.get(url + 'Click', (response) => {
        let data = '';

  // 데이터가 도착할 때마다 처리
        response.on('data', (chunk) => {
            data += chunk;
        });

  // 데이터 수신 완료 후 처리
        response.on('end', () => {
            console.log('Response:', data);
            return data
        });
    }).on('error', (error) => {
        console.error('Error:', error.message);
    });
}

const getRoom3Status = () => {
    const url = 'http://192.168.1.253:3000/';  // 요청을 보낼 URL을 입력하세요.

    http.get(url + 'getStatus', (response) => {
    let data = '';

// 데이터가 도착할 때마다 처리
    response.on('data', (chunk) => {
        data += chunk;
    });

// 데이터 수신 완료 후 처리
    response.on('end', () => {
        console.log('Response:', data);
        room3 = data;
    });
}).on('error', (error) => {
    console.error('Error:', error.message);
});
}

const clickRoom3 = () => {
        const url = 'http://192.168.1.253:3000/';  // 요청을 보낼 URL을 입력하세요.

        http.get(url + 'Click', (response) => {
        let data = '';

  // 데이터가 도착할 때마다 처리
        response.on('data', (chunk) => {
            data += chunk;
        });

  // 데이터 수신 완료 후 처리
        response.on('end', () => {
            console.log('Response:', data);
            return data
        });
    }).on('error', (error) => {
        console.error('Error:', error.message);
    });
}


const getRTPcap = () => {
  socket.emit('getRTPcap', { roomNumber: roomNumber ,url: local_url }, (data) => {
      if (!data.error) {
        console.log(`Router RTP Capabilities... ${data.rtpCapabilities}`)

        rtpCapabilities = data.rtpCapabilities

        createDevice()
      }
      else {
        setTimeout(getRTPcap, 1000);
      }
  })
}

const createDevice = async () => {
  try {
    device = new Device({
        headerExtensions: {
          video: [useSdesMid(), useAbsSendTime()],
        },
        codecs: {
          video: [
            new RTCRtpCodecParameters({
              mimeType: "video/VP8",
              clockRate: 90000,
              payloadType: 98,
              rtcpFeedback: [useFIR(), useNACK(), usePLI(), useREMB()],
            }),
          ],
        },
      });

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
    console.log('ProducerExist!', producerExists)
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

    exec(
    "ffmpeg -i udp://127.0.0.1:12345 -c:v copy -c:a copy ./output_file.mp4"
    );

    const udp = createSocket("udp4")
    udp.bind(12345);

    consumer.track.onReceiveRtp.subscribe((rtp) => {
    
        udp.send(rtp.serialize(), 4002);
    });

    // const { track } = consumer

    // var remoteVideoList = document.getElementById("remoteVideo")
    // var localli = document.createElement("li")
    // localli.setAttribute("class", "RemoteVideoLi")
    // var Video = document.createElement("video")
    // Video.setAttribute("autoplay", true)
    // Video.setAttribute("class", "video")
    // Video.srcObject = new MediaStream([track])
    // localli.appendChild(Video)
    // remoteVideoList.appendChild(localli)

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

        
        if (parsed.command === 'Click') {
            if (parsed.subject === 'LightOnWhole'){
                console.log(clickRoom1())
                console.log(clickRoom2())
                console.log(clickRoom3())
            }
            if (parsed.subject === 'LightOnRoom1'){
                console.log(clickRoom1())
            }
            if (parsed.subject === 'LightOnRoom2'){
                console.log(clickRoom2())
            }
            if (parsed.subject === 'LightOnRoom3'){
                console.log(clickRoom3())
            }
            dataproducer.send(JSON.stringify({
                command : "response_ok",
                subject : parsed.subject,
                socketId : socket.id,
            }))
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
        dataproducer.send(JSON.stringify({
            command : 'enrollStatusZeroSwitch',
            socketId : socket.id,
            result : {
                room1,
                room2,
                room3,
                room4,
            }
        }))
        console.log(`room1 : ${room1}, room2 : ${room2}, room3 : ${room3}, room4 : ${room4}`)
    })

    dataproducer.on("error", (error) => {
        console.log(error)
    })
}

const connectSendTransport = async () => {



    producer = await producerTransport.produce({
        track : rtpTrack
    })

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
