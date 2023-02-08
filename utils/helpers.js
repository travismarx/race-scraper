var http = require('http');
var request = require('request');

module.exports = function() {
    var service = {
        sessionStatus: sessionStatus,
        currentPosPoints: currentPosPoints,
        containsObject: containsObject,
        getSum: getSum,
        getAvg: getAvg,
        cleanString: cleanString,
        fixAvgLap: fixAvgLap,
        fixLapTime: fixLapTime,
        getFastSegment: getFastSegment
    };
    return service;


    ////////// 
    // Private helper functions

    function sessionStatus() {
        return new Promise(function(resolve, reject) {
            return request('http://live.amasupercross.com/xml/sx/RaceData.json', function(result, body) {
                if (body) {
                    var data = JSON.parse(body.body);
                    var status = data.B;

                    resolve(data);
                }
            })
        });
    }

    function currentPosPoints(pos) {
        pos = parseInt(pos);

        // 1. Array Lookup
        var points = [25, 22, 20, 18, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 1, 1, 0, 0];
        return points[pos - 1] || 0;

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
};
