var MongoClient = require('mongodb').MongoClient,
    assert = require('assert'),
    Promise = require('bluebird'),
    moment = require('moment'),
    request = require('request'),
    scraper = require('./utils/scrapeUtil')(),
    helpers = require('./utils/helpers')(),
    appConst = require('./utils/const'),
    URL = require('./utils/URL'),
    API = require('./utils/API');

// Connection URL
var motodataUrl = 'mongodb://api.motolytics.io:42316/2017_test';
var ridersUrl = 'mongodb://api.motolytics.io:42316/riders_test';
var ridersRawUrl = 'mongodb://api.motolytics.io:42316/riders_raw_test';
// var motodataUrl = 'mongodb://10.12.0.5:42316/2017_test';
// var ridersUrl = 'mongodb://10.12.0.5:42316/riders';
// var ridersRawUrl = 'mongodb://10.12.0.5:42316/riders_raw';

// Values
var lastUpdate,
    weather,
    announcements,
    liveData = {},
    waitTime = 3600000,
    dayOfWeek = moment().day(),
    hourOfDay = moment().hour(),
    isSaturday = dayOfWeek === 6;

if (isSaturday) waitTime = 7000;

// Set timers
setInterval(() => {
    getRaceData()
}, waitTime);

if (isSaturday) {
    weather = scraper.getWeatherData();
    announcements = scraper.getAnnouncements();

    setInterval(() => {
        weather = scraper.getWeatherData();
    }, 120000);
    setInterval(() => {
        announcements = scraper.getAnnouncements();
    }, 150000);
}

/* If starting up process, get most recent data from mongodb to compare against */
API.get(URL.apiLiveTiming).then((res) => {
    liveData = res[0];

    // API.set(URL.apiRiders, liveData).then((res) => {
    //     // console.log(res, 'set res');
    // })
});

// API.set(URL.apiRiders, JSON.stringify({hi: 'fuckl'})).then((res) => {
//     console.log(res.body, 'res');
// })

function getRaceData() {
    var start = console.time('Duration to process data:');

    dayOfWeek = moment().day();
    isSaturday = dayOfWeek = 6;
    waitTime = isSaturday ? 30000 : 7000;

    return helpers.sessionStatus().then((res) => {
        if (res.A === lastUpdate) {
            console.log('Nothing updated, times match');
            // return;
        }
        // lastUpdate = res.A;

        if (res.B === 'Session Complete') {
            var sessionComplete = true;
        }

        return scraper.getAmaData().then((res) => {
            if (res.DT === liveData.DT) return;

            res.B.map((rider) => {
                rider.F = helpers.cleanString(rider.F);
                rider._id = hashGen(16);
                rider.unix = moment().format('X');
                rider.eventTitle = res.T;
                rider.event = res.E;
                rider.session = res.S;
            });

            var raceInfo = res;
            raceInfo._id = hashGen(16);
            raceInfo.unix = moment().format('X');

            MongoClient.connect(motodataUrl, function(err, db) {
                assert.equal(null, err);

                var coll = "rawdocs";
                insertDocument(db, coll, raceInfo, function() {
                    db.close();
                });
            })

            MongoClient.connect(ridersRawUrl, function(err, db) {
                assert.equal(null, err);

                raceInfo.B.map((rider) => {
                    insertDocument(db, rider.F, raceInfo, function() {});
                })
            });

            var raceCity = helpers.cleanString(raceInfo.T),
                raceEvent = helpers.cleanString(raceInfo.S),
                raceTimeStamp = raceInfo.DT,
                allRidersArr = raceInfo.B,
                sessionFastLap = raceInfo.MLT,
                sessionFastLapRider = raceInfo.MBY,
                riderSegments = allRidersArr.SR,
                riderGapToLeader = allRidersArr.D,
                riderGapToRiderAhead = allRidersArr.G,
                segmentCount = (raceInfo.MSR).length,
                lastTrackSegment = raceInfo.MSR[segmentCount - 1].SN,
                jsonUpdated = true,
                isMoto = raceEvent.indexOf('Site Lap'),
                isQualifying = raceInfo.A === 2;

            return scraper.evaluateRiders(liveData, raceInfo).then((res, err) => {
                liveData = res[0] ? res[0] : res;
                liveData.B.map((rider) => rider._id = hashGen(16));

                MongoClient.connect(motodataUrl, function(err, db) {
                    assert.equal(null, err);

                    var coll = raceInfo.T;
                    raceInfo.weather = weather;
                    raceInfo.announcements = announcements;

                    insertDocument(db, coll, raceInfo, function() {});

                    delete liveData._id;
                    liveData.unix = moment().format('X');
                    replaceDocument(db, 'liveData', liveData, function() {
                        db.close();
                    });
                });

                MongoClient.connect(ridersUrl, function(err, db) {
                    assert.equal(null, err);

                    liveData.B.map((rider) => {
                        insertDocument(db, rider.F, rider, function() {
                            db.close();
                        });
                    })
                });

                // MongoClient.connect(ridersRawUrl, function(err, db) {
                //     assert.equal(null, err);

                //     raceInfo.B.map((rider) => {
                //         insertDocument(db, rider.F, rider, function() {
                //             db.close();
                //         });
                //     })
                // })
                console.timeEnd('Duration to process data:');
            })
        })
    });
}

function hashGen(n) {
    var r = "";
    n += (Math.floor(Math.random() * 10)) + (Math.floor(Math.random() * 10));
    while (n--) r += String.fromCharCode((r = Math.random() * 62 | 0, r += r > 9 ? (r < 36 ? 55 : 61) : 48));
    return r;
}

function isSaturday() {
    var date = new Date();
    var dayOfWeek = date.getDay();

    return dayOfWeek === 7;
}

var insertDocument = function(db, coll, data, callback) {
    var collection = db.collection(coll);

    collection.insertOne(data, function(err, result) {
        assert.equal(err, null);
        assert.equal(1, result.insertedCount);
        // console.log("Updated the document with the field a equal to 2");
        callback(result);
    })
}

var insertDocuments = function(db, callback) {
    // Get the documents collection
    var collection = db.collection('documents');
    // Insert some documents
    collection.insertMany([
        { a: 1 }, { a: 2 }, { a: 3 }
    ], function(err, result) {
        assert.equal(err, null);
        assert.equal(3, result.result.n);
        assert.equal(3, result.ops.length);
        console.log("Inserted 3 documents into the collection");
        callback(result);
    });
}

var findDocuments = function(db, callback) {
    // Get the documents collection
    var collection = db.collection('documents');
    // Find some documents
    collection.find({}).toArray(function(err, docs) {
        assert.equal(err, null);
        console.log("Found the following records");
        console.log(docs)
        callback(docs);
    });
}

var updateDocument = function(db, coll, data, callback) {
    // Get the documents collection
    var collection = db.collection('documents');
    // Update document where a is 2, set b equal to 1
    coll.updateOne({ a: 2 }, { $set: { b: 1 } }, function(err, result) {
        assert.equal(err, null);
        assert.equal(1, result.result.n);
        console.log("Updated the document with the field a equal to 2");
        callback(result);
    });
}

var replaceDocument = function(db, coll, doc, callback) {
    // Get the documents collection
    var collection = db.collection(coll);

    // Update document where a is 2, set b equal to 1
    collection.replaceOne({ A: { $exists: true } }, doc, function(err, result) {
        assert.equal(err, null);
        assert.equal(1, result.result.n);
        // console.log("Updated the document with the field a equal to 2");
        callback(result);
    });
}
