import express from 'express'
import https from 'https'
import http from 'http'
import fs from 'fs'
import path, { resolve } from 'path'
const __dirname = path.resolve()
import { Server } from 'socket.io'

import bodyParser from 'body-parser'
import requestIp from 'request-ip'

process.on('SIGINT', function() {
    // console.log('Do something useful here.');
    // connection.end();
    process.exit()
});

const app = express()

app.use('/', express.static(path.join(__dirname, 'public')))
const options = {
    key: fs.readFileSync('./ssl/key.pem', 'utf-8'),
    cert: fs.readFileSync('./ssl/cert.pem', 'utf-8'),
    rejectUnauthorized: false,
}

app.use(bodyParser.json())

const users = [
    { id: 100, username: 'test100', password: 'test100' },
    { id: 101, username: 'test101', password: 'test101' },
    { id: 102, username: 'test102', password: 'test102' },
    { id: 103, username: 'test103', password: 'test103' },
    { id: 104, username: 'test104', password: 'test104' },
    { id: 105, username: 'test105', password: 'test105' },
    { id: 106, username: 'test106', password: 'test106' },
    { id: 107, username: 'test107', password: 'test107' },
    { id: 108, username: 'test108', password: 'test108' },
    { id: 109, username: 'test109', password: 'test109' },
    { id: 110, username: 'test110', password: 'test110' },
    { id: 111, username: 'test111', password: 'test111' },
    { id: 112, username: 'test112', password: 'test112' },
    { id: 113, username: 'test113', password: 'test113' },
    { id: 114, username: 'test114', password: 'test114' },
    { id: 115, username: 'test115', password: 'test115' },
    { id: 116, username: 'test116', password: 'test116' },
    { id: 117, username: 'test117', password: 'test117' },
    { id: 118, username: 'test118', password: 'test118' },
    { id: 119, username: 'test119', password: 'test119' },
];

app.post('/login', (req, res) => {
    const { username, password } = req.body
    const loginReq = req
    // const ip = req.headers['x-forwarded-for'] //||  req.connection.remoteAddress;
    const ip = requestIp.getClientIp(req)
    // console.log(ip)
    // Check if user exists
    const user = users.find(u => u.username === username && u.password === password);
    if (user) {
  // Return JWT token or any authentication token
        res.json({ 
          id : user.id,
        });
        // console.log('Login Success')
        const data = JSON.stringify({
            data : "Login Success",
            clientIp : loginReq.ip,
            clientPort : loginReq.connection.remotePort,
        });    
    
        // const options = {
        //     hostname: 'localhost',
        //     port: 7070,
        //     path: '/loginSuccess',
        //     method: 'POST',
        //     headers: {
        //         'Content-Type': 'application/json',
        //         'Content-Length': data.length
        //     },
        //     rejectUnauthorized: false
        // };
  
        // const req = http.request(options, (res) => {
        //     // console.log(`statusCode: ${res.statusCode}`);
        //     res.on('data', (chunk) => {
        //         // console.log(`Response: ${chunk}`);
        //     });
        // });
    
        // req.on('error', (error) => {
        //     console.error(error);
        // });
  
        // req.write(data);
        // req.end();
    } else {
        res.status(401).json({ message: 'Invalid credentials' });
        // console.log('Login Failed')
        // const data = JSON.stringify({
        //     data : "Login Fail",
        //     clientIp : loginReq.ip,
        //     clientPort : loginReq.connection.remotePort,
        // });
        // const options = {
        //     hostname: 'localhost',
        //     port: 7070,
        //     path: '/loginFail',
        //     method: 'POST',
        //     headers: {
        //         'Content-Type': 'application/json',
        //         'Content-Length': data.length
        //     },
        //     rejectUnauthorized: false
        // };
        // const req = http.request(options, (res) => {
        //     // console.log(`statusCode: ${res.statusCode}`);
        //     res.on('data', (chunk) => {
        //         // console.log(`Response: ${chunk}`);
        //     });
        // });
    
        // req.on('error', (error) => {
        //     console.error(error);
        // });
  
        // req.write(data);
        // req.end();
    }
  });

let setting_file = fs.readFileSync('ServerSetting.json', 'utf-8')
let parsed = JSON.parse(setting_file)


let isDocker = process.env.ISDOCKER
let isHttp = process.env.ISHTTP

let local_ip  
let remote_ip
let MinPort 
let MaxPort 
let LocalPort
let ServerPort

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
    LocalPort = parseInt(parsed.localPort)
    ServerPort = parseInt(parsed.ServerPort)
}

let clients = {}
let mediaservers = {}
let httpsServer

if (true) {
    httpsServer = http.createServer(app)
} else {
    httpsServer = https.createServer(options,app)
}

const ios = new Server(httpsServer)

httpsServer.listen(LocalPort,() => {
    console.log('listening on port: ' + LocalPort)
})

const connections_client = ios.of('/client')
const connections_mediaserver = ios.of('/mediaserver')

connections_client.on('connection', async socket => {
    console.log(`connection, BackEndServer client connected ${socket.id}`)
    
    socket.on('disconnect', (reason) => {
        console.log(`socket closed ${socket.id} by ${reason}`)
        
        delete(clients[socket.id])
    });

    socket.emit('connection-success', {
        socketId: socket.id
    });

    socket.on('getRTPcap', async ({roomNumber, url}, callback) => {
        try {
            console.log('getRtpCap, client')

            clients[socket.id] = {
                socket: socket,
                url: url,
                roomNumber: roomNumber,
            }

            console.log('clients :', )

            const rtpCapabilities = mediaservers[roomNumber].rtpCapabilities;

            await mediaservers[roomNumber].socket.emit('informClientsConnect', ({
                socketId: socket.id,
                url
            }), ()=>{

            });

            callback({rtpCapabilities, error: false})
        } catch (error) {
            callback({error: true})
        }
    })

    socket.on('createWebRtcTransport', async ({ consumer }, callback) => {
        console.log(`connection, client, createWebRtcTransport`)

        await mediaservers[clients[socket.id].roomNumber].socket.emit('createWebRtcTransport', {consumer: consumer, socketId: socket.id}, async ({params}) => {
            // console.log('params from mediaserver:', params)
            callback({params})
        })
    })

    socket.on('transport-connect', async ({ dtlsParameters }, callback) => {
        console.log('Transport-connect', { dtlsParameters })
        console.log('DTLS PARAMS... ', { dtlsParameters })

        await mediaservers[clients[socket.id].roomNumber].socket.emit('transport-connect', {
            dtlsParameters,
            roomNumber : clients[socket.id].roomNumber,
            socketId: socket.id
        }, () => {
            callback()
        });
    });

    socket.on('transport-produce-data', async ({roomNumber,socketId, sctpStreamParameters, label, protocol}, callback) => {
        console.log(`connection, on, transpose-produce-data`)
        console.log(`sctpStreamParameter`, sctpStreamParameters)
        console.log(`label`, label)
        console.log(`protocol`, protocol)

        await mediaservers[clients[socket.id].roomNumber].socket.emit('transport-produce-data', {
            sctpStreamParameters,
            label,
            protocol,
            socketId: socket.id
        }, async ({id, socketId ,producersExist}) => {
            console.log(`producer data callback : ${id} : ${producersExist}`)
            callback({id, producersExist})
        });
    });

    socket.on('transport-produce', async ({kind, rtpParameters, appData}, callback) => {
        console.log(`connection, on, transpose-produce`)
        
        console.log(`kind`, kind)
        console.log(`rtpParameters`, rtpParameters)
        console.log(`appData`, appData)
        
        
        await mediaservers[clients[socket.id].roomNumber].socket.emit('transport-produce', {
            kind,
            rtpParameters,
            appData,
            socketId : socket.id
        }, async ({id, socketId ,producersExist}) => {
            console.log(`producer callback : ${id} : ${producersExist}`)
           callback({id, producersExist})
        });
    });

    socket.on('getProducers', async ({remote_url, roomNumber, socketId}) => {
        await mediaservers[roomNumber].socket.emit('getProducers', {
            socketId,
            remote_url
        }, (producerIds, urlList) => {
            for (let i = 0; i < producerIds.length; i++) {
                clients[socketId].socket.emit('getProducers-response', producerIds[i], urlList[i])
            }
        })
    })

    socket.on('getDataProducers', async ({remote_url, roomNumber, socketId}) => {
        await mediaservers[roomNumber].socket.emit('getDataProducers', {
            socketId,
            remote_url
        }, (producerIds, urlList) => {
            for (let i = 0; i < producerIds.length; i++) {
                clients[socketId].socket.emit('getDataProducers-response', producerIds[i], urlList[i])
            }
        })
    })

    socket.on('transport-recv-connect', ({dtlsParameters, serverConsumerTransportId}) => {
        
        console.log("transport-recv-connect-Done")
        console.log("dtlsParameters", dtlsParameters)
        console.log("serverConsumerTransportId", serverConsumerTransportId)

        mediaservers[clients[socket.id].roomNumber].socket.emit('transport-recv-connect', {
            dtlsParameters,
            serverConsumerTransportId,
            socketId : socket.id
        })
    })
    socket.on('consume', ({rtpCapabilities, remoteProducerId, serverConsumerTransportId}, callback) => {
        mediaservers[clients[socket.id].roomNumber].socket.emit('consume', {rtpCapabilities, remoteProducerId, serverConsumerTransportId, socketId : socket.id}, ({params}) => {
            callback({params, remoteProducerId})
        })
    })

    socket.on('consume-data', ({rtpCapabilities, remoteProducerId, serverConsumerTransportId, roomNumber, socketId}, callback) => {
        mediaservers[clients[socket.id].roomNumber].socket.emit('consume-data', {rtpCapabilities, remoteProducerId, serverConsumerTransportId, socketId:socket.id}, ({params}) => {
            callback({params})
        })
    })

    socket.on('consumer-resume', ({ serverConsumerId, roomNumber }) => {
        mediaservers[clients[socket.id].roomNumber].socket.emit('consumer-resume', {serverConsumerId})
    })

    socket.on('pipetoRoom', ({myRoomNumber, oppositeRoomNumber}) => {
        console.log(`roomNumbers : myRoomNumber : ${myRoomNumber}, opposite : ${oppositeRoomNumber}`)
        if(mediaservers[oppositeRoomNumber] !== undefined) {
            mediaservers[oppositeRoomNumber].socket.emit('createPipeTransport', {myRoomNumber, oppositeRoomNumber}, 
            ({
                myRoomNumber, oppositeRoomNumber,ip,port,srtpParameters 
            }) => {
                mediaservers[myRoomNumber].socket.emit('connectPipeTransport', {
                    myRoomNumber, oppositeRoomNumber, ip, port, srtpParameters
                }, ({myRoomNumber, oppositeRoomNumber, ip, port, srtpParameters}) => {
                    mediaservers[oppositeRoomNumber].socket.emit('connectPipeTransport_response', {myRoomNumber, oppositeRoomNumber, ip, port, srtpParameters})
                })
            });
        } else {
            console.log(`unconnected mediaserver ${oppositeRoomNumber}`)
        }
    })

    
});



connections_mediaserver.on('connection', async socket => {
    console.log(`connection, BackEndServer mediaserver connected ${socket.id}`);

    socket.on('disconnect', (reason) => {
        console.log(`disconnect mediaserver socket : ${socket.id} \n\tfor ${reason}`)
        delete mediaservers[socket.id]
    }) 

    socket.emit('connection-success', {
        socketId: socket.id,
        mediaserverIp : socket.handshake.address
    });

    socket.on('mediaserverEnrollRtpCap', ({roomNumber, socketId,rtpCapabilities}) => {
        mediaservers[roomNumber] = {
            socketId: socketId,
            socket: socket,
            roomNumber: roomNumber,
            rtpCapabilities: rtpCapabilities,
        }
    });

    socket.on('new-producer', ({producerId, url, producerSocketId, consumerSocketId})=>{
        console.log(consumerSocketId)
        console.log(clients)
        clients[consumerSocketId].socket.emit('new-producer', {
            producerId,
            url,
            producerSocketId
        })
    })

    socket.on('new-dataproducer', ({producerId, url, producerSocketId, consumerSocketId})=>{
        clients[consumerSocketId].socket.emit('new-dataproducer', {
            producerId,
            url,
            producerSocketId
        })
    })

    socket.on('new-directdataproducer', ({producerId, url, producerSocketId, consumerSocketId})=>{
        clients[consumerSocketId].socket.emit('new-dataproducer', {
            producerId,
            url,
            producerSocketId
        })
    })

    socket.on('connectPipeTransport', ({myRoomNumber, oppositeRoomNumber, ip, port, srtpParameters}) => {
        mediaservers[myRoomNumber].socket.emit('connectPipeTransport', {
            myRoomNumber, oppositeRoomNumber, ip, port, srtpParameters
        })
    })

    // socket.on('informAllProducers', ({myRoomNumber, oppositeRoomNumber, remoteProducers}) => {
    //     mediaservers[myRoomNumber].socket.emit('informAllProducers', {
    //         myRoomNumber,
    //         oppositeRoomNumber,
    //         remoteProducers
    //     })
    // })

    socket.on('newPipeConsumer', ({socketId, kind, rtpParameters, remoteProducerId, myRoomNumber, oppositeRoomNumber}) => {
        mediaservers[myRoomNumber].socket.emit('newPipeConsumer', {socketId, kind, rtpParameters, remoteProducerId, myRoomNumber, oppositeRoomNumber})
    })
});



// olds

// const middleWareTransportProduceData = async (id, socketId ,producerExists) => {
//     clients[socketId].socket.emit('transport-produce-data-response', {id, producerExists})
// }

// const middleWareTransportProduce = async (id, socketId ,producerExists) => {
//     clients[socketId].socket.emit('transport-produce-response', {id, producerExists})
// }


// const middleWareCreateWebRtcTransport = async (consumer, socketId, isData, remoteProducerId) => {
//     return new Promise(async (resolve, reject) => {
//         await mediaservers[clients[socketId].roomNumber].socket.emit('createWebRtcTransport', {consumer: consumer, socketId: socketId}, async ({params}) => {
//             clients[socketId].socket.emit('createWebRtcTransportResponse', {consumer, params, isData, remoteProducerId})
//         })

//         resolve(true)
//     })
// }