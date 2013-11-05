var mongo = require('mongoskin');
var fs = require('fs');

var mongoUrl = process.env.MONGO_URL || process.env.MONGOHQ_URL ||
    'mongodb://localhost:27017/project';

console.log(mongoUrl);

var db = mongo.db(mongoUrl, {safe: true});

fs.readFile('firstCourse.json', function(err, data) {
    if (err) throw err;
    try {
        var courses = JSON.parse(data);
        console.log('firstCourse count: ' + courses.length);
        var coll = db.collection('firstCourse');
        coll.insert(courses, function(err) {
            if (err) return console.log(err);
            console.log('firstCourse inserted.')
        });
    } catch (e) {
        console.log('Error! ', e);
    }
});

fs.readFile('secondCourse.json', function(err, data) {
    if (err) throw err;
    try {
        var courses = JSON.parse(data);
        console.log('secondCourse count: ' + courses.length);
        var coll = db.collection('secondCourse');
        coll.insert(courses, function(err) {
            if (err) return console.log(err);
            console.log('secondCourse inserted.')
        });
    } catch (e) {
        console.log('Error! ', e);
    }
});