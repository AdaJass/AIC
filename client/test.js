var req = require('request-promise');

kk=()=>{
    req('https://www.baidu.com')
        .then((body)=>{
            console.log(9);
        });
    console.log(888);
}

kk();