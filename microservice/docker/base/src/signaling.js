import express from 'express'
import http from 'https'
import fs from 'fs'
import path, { resolve } from 'path'
const __dirname = path.resolve()
import { Server } from 'socket.io'
import mediasoup from 'mediasoup'

import bodyParser from 'body-parser'
import requestIp from 'request-ip'
process.on('SIGINT', function() {
    // console.log('Do something useful here.');
    connection.end();
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

let local_ip = parsed.local_ip
let remote_ip = parsed.Server_ip
let MinPort = parseInt(parsed.rtcMinPort)
let MaxPort = parseInt(parsed.rtcMaxPort)
let LocalPort = parseInt(parsed.localPort)
let ServerPort = parseInt(parsed.ServerPort)

let clients = {}
let mediaservers = {}

const httpsServer = http.createServer(options,app)
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

    socket.on('createWebRtcTransport', async ({ consumer, isData, remoteProducerId }) => {
        console.log(`connection, client, createWebRtcTransport`)

       await middleWareCreateWebRtcTransport(consumer, socket.id, isData, remoteProducerId)
    })

    socket.on('transport-connect', async ({ dtlsParameters, roomNumber, socketId }) => {
        // // console.log('DTLS PARAMS... ', { dtlsParameters })

        await mediaservers[roomNumber].socket.emit('transport-connect', {
            dtlsParameters,
            roomNumber,
            socketId
        });
    });

    socket.on('transport-produce-data', async ({roomNumber,socketId, sctpStreamParameters, label, protocol}) => {
        console.log(`connection, on, transpose-produce-data`)
        await mediaservers[roomNumber].socket.emit('transport-produce-data', {
            sctpStreamParameters,
            label,
            protocol,
            socketId
        }, async ({id, socketId ,producerExists}) => {
           console.log(`${id}, ${socketId}, ${producerExists}`)
            middleWareTransportProduceData(id, socketId, producerExists)
        });
    });

    socket.on('transport-produce', async ({roomNumber,socketId, kind, rtpParameters, appData}) => {
        console.log(`connection, on, transpose-produce`)
        await mediaservers[roomNumber].socket.emit('transport-produce', {
            kind,
            rtpParameters,
            appData,
            socketId
        }, async ({id, socketId ,producerExists}) => {
           
            middleWareTransportProduce(id, socketId, producerExists)
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

    socket.on('transport-recv-connect', ({dtlsParameters, serverConsumerTransportId, roomNumber, socketId}) => {
        mediaservers[roomNumber].socket.emit('transport-recv-connect', {
            dtlsParameters,
            serverConsumerTransportId,
            socketId
        })
    })
    socket.on('consume', ({rtpCapabilities, remoteProducerId, serverConsumerTransportId, roomNumber, socketId}) => {
        mediaservers[roomNumber].socket.emit('consume', {rtpCapabilities, remoteProducerId, serverConsumerTransportId, socketId}, ({params}) => {
            clients[socketId].socket.emit('consume_response', ({params, remoteProducerId}))
        })
    })

    socket.on('consume-data', ({rtpCapabilities, remoteProducerId, serverConsumerTransportId, roomNumber, socketId}) => {
        mediaservers[roomNumber].socket.emit('consume-data', {rtpCapabilities, remoteProducerId, serverConsumerTransportId, socketId}, ({params}) => {
            clients[socketId].socket.emit('consume_data_response', ({params, remoteProducerId}))
        })
    })

    socket.on('consumer-resume', ({ serverConsumerId, roomNumber }) => {
        mediaservers[roomNumber].socket.emit('consumer-resume', {serverConsumerId})
    })

    socket.on('pipeRoomToRoomt', ({roomNumber1, roomNumber2, url1, url2}) => {
        
    })
});

const middleWareTransportProduceData = async (id, socketId ,producerExists) => {
    clients[socketId].socket.emit('transport-produce-data-response', {id, producerExists})
}

const middleWareTransportProduce = async (id, socketId ,producerExists) => {
    clients[socketId].socket.emit('transport-produce-response', {id, producerExists})
}


const middleWareCreateWebRtcTransport = async (consumer, socketId, isData, remoteProducerId) => {
    return new Promise(async (resolve, reject) => {
        await mediaservers[clients[socketId].roomNumber].socket.emit('createWebRtcTransport', {consumer: consumer, socketId: socketId}, async ({params}) => {
            clients[socketId].socket.emit('createWebRtcTransportResponse', {consumer, params, isData, remoteProducerId})
        })

        resolve(true)
    })
}

connections_mediaserver.on('connection', async socket => {
    console.log(`connection, BackEndServer mediaserver connected ${socket.id}`);

    socket.emit('connection-success', {
        socketId: socket.id
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
});
