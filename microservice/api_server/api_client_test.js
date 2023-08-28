const axios = require('axios');

const requestData = {
    command: 'callToLocal',
    // ... 여기에 필요한 요청 데이터 추가 ...
};

axios.post('http://localhost:3000/api', requestData)
    .then(response => {
        console.log('Response:', response.data);
    })
    .catch(error => {
        console.error('Error:', error.message);
    });