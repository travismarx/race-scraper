var http = require('http');
var request = require('request');
var Promise = require('bluebird');
var helpers = require('./helpers')();
var rider_data = require('../data/rider_data.json');
var API = require('./API');
var appConst = require('./const');
var URL = require('./URL');

// Reference Values
var sessionComplete;
var sessionInfo;
var weather;
var announcements;

module.exports = function(fbInit) {
    var service = {
        getAmaData,
        evaluateRiders,
        getWeatherData,
        getAnnouncements
    };
    return service;

    function getAmaData() {
        getWeatherData();
        sessionStatus().then(function(res) {
            sessionInfo = res;
            if (res.B === 'Session Complete') {
                sessionComplete = true;
            } else {
                sessionComplete = false;
            }
        });
        return new Promise(function(resolve, reject) {
            // resolve(rider_data);

            return API.get(URL.amaSxLiveData).then((res) => {
                if (res) {
                    // API.set(URL.apiLiveTiming, res);

                    raceInfo = res;
                    resolve(raceInfo);
                }
            });
        })
    }

    function evaluateRiders(liveData, newData) {
        var riders = liveData.B ? liveData.B : newData.B;
        var i = liveData.B ? liveData.B.length : newData.B.length;
        splitCount = liveData.SC || newData.SC;

        /* Old way of doing promise and loop */
        return new Promise((resolve, reject) => {
            if (liveData.A && (liveData.E === newData.E && liveData.S === newData.S)) {
                // let i = liveData.B.length;
                liveData.weatherInfo = weather;

                while (i--) {
                    var rider = liveData.B[i];

                    if (rider.L)
                        rider = calculateNewRiderTotals(rider, liveData.SC);

                    liveData.B[i] = rider;

                    liveData.sessionPasses = getTotalSessionPasses(liveData.B);
                    // if (liveData.B[i]._id) delete liveData.B[i]._id;
                    if (i === 0) resolve(liveData)
                }
            } else {
                riders = newData.B;
                newData.weatherInfo = weather;

                while (i--) {
                    var rider = newData.B[i];

                    rider = setupNewRiderData(rider);
                    Object.assign(rider, {
                        eventTitle: newData.T,
                        event: newData.E,
                        session: newData.S
                    });
                    newData.B[i] = rider;
                    if (i === 0) resolve(newData)
                }
                // resolve(newData);
            }
        })
    }

    ////////// 
    // Private helper functions

    function calculateNewRiderTotals(rider, splitCount) {

        rider.F = cleanString(rider.F);

        var name = helpers.cleanString(rider.F),
            position = rider.A,
            number = rider.N,
            currentLap = rider.L,
            lastLapTime = rider.LL,
            bestLapTime = rider.BL,
            splits = rider.SR,
            lastSplit = rider.LS,
            movement = rider.RM,
            status = rider.S,
            finished = isRiderFinished(rider, splitCount);

        /* Use this to see if race data is actually useful, not pre-race unchanged data */
        if (rider.L === 0 || rider.L === 1) {
            if (rider.LS === "" && noSplitsLogged(rider.SR)) {
                return;
            } else {
                rider.firstLoggedPos = rider.A;
            }
        }

        /* If firstLoggedPos is recorded (race data, not pre-race unchanged data), we can calculate data */
        if (!rider.firstLoggedPos) return rider;

        rider.allPositions.push(rider.A);

        /* These watchers are null in setup, so we can set them if race is going */
        if (!rider.previousPos) rider.previousPos = rider.A;
        if (!rider.previousSplit) rider.previousSplit = rider.LS;

        if (rider.LL !== "0.000" || rider.LL !== "" || rider.LL !== "00.000" || rider.LL !== "--.---" || rider.LL !== "-.--") {
            rider.previousLap = rider.L - 1;
        }

        if (rider.previousLap) {
            if ((rider.previousLap < rider.L) || finished) {
                rider.laps.push({ lap: rider.previousLap, time: rider.LL });
                rider.rawLapTimes.push(rider.LL);

                rider.previousLap = rider.L;
            }
        }

        if (rider.previousPos) {
            if (rider.previousPos < rider.A) rider.timesPassed++;
            if (rider.previousPos > rider.A) rider.passesMade++;
        }

        /* Check if the last split we logged is the same as AMA split */
        if (rider.previousSplit !== rider.LS) {
            if (!rider.allSplits[rider.LS]) rider.allSplits[rider.LS] = [];

            let i = rider.SR.length;

            /* Find the split and time to keep track of in allSplits */
            while (i--) {
                if (rider.SR[i].SN === rider.LS) {
                    rider.allSplits[rider.LS].push(rider.LS);
                }
            }
            /* Set previousSplit record to match AMA now */
            rider.previousSplit = rider.LS;
        }

        if (rider.allPositions.length) rider.avgPosition = getAvg(rider.allPositions);
        if (rider.rawLapTimes.length) rider.avgLapTime = getAvg(rider.rawLapTimes);

        return rider;
    }

    function setupNewRiderData(rider) {
        Object.assign(rider, {
            F: cleanString(rider.F),
            allPositions: [],
            allSplits: {},
            rawLapTimes: [],
            passesMade: 0,
            timesPassed: 0,
            previousPos: null,
            previousLap: null,
            previousSplit: null,
            avgLapTime: null,
            theoreticalFastLap: null,
            fastSplits: [],
            avgSplit: [],
            laps: [],
        })

        return rider;
    }

    function isRiderFinished(rider, splitCount) {
        var lastSplit = rider.LS.length > 1 ? Number(rider.LS[1]) : rider.LS;

        return (rider.RM === 6 || rider.S === 'OUT' || rider.S === 'Out' || rider.S === 'DNS' || rider.S === 'dns' || rider.S === 'Dns' || (lastSplit === splitCount && sessionComplete));
    }

    function sessionStatus() {
        return new Promise(function(resolve, reject) {
            return request('http://live.amasupercross.com/xml/sx/RaceData.json', function(result, body) {
                if (body) {
                    var data = JSON.parse(body.body);
                    var status = data;
                    resolve(status);
                }
            })
        });
    }

    function getWeatherData() {
        var url = 'http://live.amasupercross.com/xml/sx/Weather.json';

        return new Promise((resolve, reject) => {
            return request(url, function(result, body) {
                if (body) {
                    weather = JSON.parse(body.body);
                    resolve(weather);
                } else {
                    reject({ status: 3, msg: 'No JSON Body Found for Weather Request' });
                }
            })
        })
    }

    function getAnnouncements() {
        var url = 'http://live.amasupercross.com/xml/sx/Announcements.json';

        return new Promise((resolve, reject) => {
            return request(url, function(result, body) {
                if (body) {
                    announcements = JSON.parse(body.body);
                    resolve(announcements);
                } else {
                    reject({ status: 3, msg: 'No JSON Body Found for Announcements Request' });
                }
            })
        })
    }

    function getTotalSessionPasses(arr) {
        let passCounts = [];

        arr.map((rider) => passCounts.push(rider.timesPassed));

        let totalPasses = getSum(passCounts);

        return totalPasses;
    }

    function currentPosPoints(pos) {
        pos = parseInt(pos);

        // 1. Array Lookup
        var points = [25, 22, 20, 18, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 1, 1, 0, 0];
        return points[pos - 1] || 0;
    }

    function checkSessionType(sessionString) {

    }

    function containsObject(obj, list, key) {
        var i = list.length;
        while (i--) {
            if (list[i][key]) {
                return true;
            }
        }
        return false;
    }

    function hasNumber(str) {
        return /\d/.test(str);
    }

    function getSum(arr) {
        var sum = arr.reduce(function(a, b) {
            return a + b;
        });

        return sum;
    }

    function getAvg(arr) {
        var sum = arr.reduce(function(a, b) {
            if (a != '0.000' && b != '0.000' && a != '--.---' && b != '--.---') {
                return parseFloat((a + b).toFixed(3));
            }
        });
        var avg = parseFloat((sum / arr.length).toFixed(3));

        return avg;
    }

    function noSplitsLogged(riderSplits) {
        var i = riderSplits.length;
        var splitsNotRecorded = 0;

        while (i--) {
            if (riderSplits[i].ST !== "--.---" || riderSplits[i].ST !== "00.000" || riderSplits[i].ST !== "0.000" || riderSplits[i].ST !== "" || riderSplits[i].ST !== "--.--")
                splitsNotRecorded++;
        }

        return splitsNotRecorded === i;
    }

    function cleanString(string) {

        string = string.replace(/[^\w\s]/gi, '');
        string = string.trim();

        return string;
    }

    function fixAvgLap(num) {
        var k = Math.floor((num) / 60);
        var i = (num % 60).toFixed(3);
        var j = Math.floor(i);

        if (j < 10) {
            return k + ':0' + i;
        }

        return k + ':' + i;
    }

    function fixLapTime(str) {
        var p = str.split(':'),
            s = 0,
            m = 1;

        var i = p.length;
        while (i--) {
            s += m * parseFloat(p.pop(), 10).toFixed(3);
            m *= 60;
        }
        return s;
    }

    function getFastSegment(arr) {
        arr.sort(function(a, b) {
            return a - b;
        });

        return arr[0];
    }

    function hashGen(n) {

        var r = "";
        while (n--) r += String.fromCharCode((r = Math.random() * 62 | 0, r += r > 9 ? (r < 36 ? 55 : 61) : 48));
        return r;

    }

    // function analyzeRider(rider) {
    //     let name = helpers.cleanString(rider.F),
    //         position = rider.A,
    //         number = rider.N,
    //         currentLap = rider.L,
    //         lastLapTime = rider.LL,
    //         bestLapTime = rider.BL,
    //         splits = rider.SR,
    //         lastSplit = rider.LS,
    //         movement = rider.RM,
    //         status = rider.S,
    //         finished = isRiderFinish(rider);

    //     console.log(finished, 'Rider is finished');
    //     rider = rider.allPositions ? calculateNewRiderTotals(rider) : setupNewRiderData(rider);

    //     return rider;
    // }
};
