var request = require('request'),
    http = require('http'),
    Promise = require('bluebird'),
    $http = require('needle'),
    helpers = require('./helpers')();

module.exports = {
    get: get,
    set: set
}

function get(url) {
    return new Promise((resolve, reject) => {
        return request(url, (err, res) => {
            if (err) reject({ msg: err, code: err.statusCode });

            if (res) {
                res = JSON.parse(res.body);
                resolve(res);
            };
        });
    });
}

function set(url, params) {
    // var options = {
    //     headers: {
    //         'Content-Type': 'application/json'
    //     }
    // }
    console.log(params, 'params');
    return new Promise((resolve, reject) => {
        $http.post(url, params, (err, res) => {
            if (err) reject({ msg: err, code: err.statusCode });

            resolve(res);
        })
    })
}

// function set(url, params) {
// 	console.log(params, 'params');
//     return new Promise((resolve, reject) => {
//         request.post(url, params, (err, res) => {
//             if (err) reject({ msg: err, code: err.statusCode });

//             resolve(res);
//         })
//     })
// }

// function set(url, params) {
//     return new Promise((resolve, reject) => {
//         var options = {
//             uri: url,
//             method: 'POST',
//             headers: {
//                 'Content-Length': Buffer.byteLength(params)
//             }
//         };
//         var req = http.request(options, (res) => {
//             console.log(`STATUS: ${res.statusCode}`);
//             console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
//             res.setEncoding('utf8');
//             res.on('data', (chunk) => {
//                 console.log(`BODY: ${chunk}`);
//             });
//             res.on('end', () => {
//                 console.log('No more data in response.');
//             });
//         });

//         req.on('error', (e) => {
//             console.log(`problem with request: ${e.message}`);
//         });

//         // write data to request body
//         req.write(params);
//         req.end();
//         resolve();
//     });
// }
