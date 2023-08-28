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
module.exports = ClientConnection;