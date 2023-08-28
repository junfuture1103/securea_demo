import http from 'http'

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/None',
    method: 'GET'
}

options.hostname = '192.168.1.141'
options.path = '/getStatus'
const req = http.request(options, (res) => {
    let data = ''
    res.on('data', (chunk) => {
        data += chunk;
    })

    res.on('end', () => {
        console.log(data)
    })
})

req.on('error', (error) => {
    console.log(error)
})

req.end();