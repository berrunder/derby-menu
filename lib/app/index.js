"use strict";
var app = require('derby').createApp(module)
    .use(require('derby-ui-boot'))
    .use(require('../../ui'));

var helpers = require('./helpers');

require('./menu.js');
// ROUTES //

// Derby routes are rendered on the client and the server
app.get('/', function (page) {
    //page.render('home');
    page.redirect('/menu');
});

app.on('model', function (model) {
    model.fn('nameSort', function (a, b) {
        return b.name > a.name ? -1 : b.name < a.name ? 1 : 0;
    });
});

app.get('/firstCourse', function (page, model, params, next) {
    var userId = model.get('_session.userId');
    var user = model.at('users.' + userId);

    var courseQuery = model.query('courses', { type: 1, $orderby: { name: 1} });

    model.subscribe(courseQuery, function (err) {
        if (err) {
            console.log("Error! " + err);
            return next(err);
        }

        model.ref('_page.user', user);
        courseQuery.ref('_page.fCourse');
        //var filter = model.filter('firstCourse').sort('nameSort');
        //filter.ref('_page.fCourse');

        page.render('firstCourse');
    });
});

app.get('/secondCourse', function (page, model, params, next) {
    var userId = model.get('_session.userId');
    var user = model.at('users.' + userId);

    var courseQuery = model.query('courses', { type: 2, $orderby: { name: 1} });

    model.subscribe(courseQuery, function (err) {
        if (err) {
            console.log("Error! " + err);
            return next(err);
        }

        model.ref('_page.user', user);

        //var filter = model.filter('secondCourse').sort('nameSort');
        //filter.ref('_page.sCourse');
        courseQuery.ref('_page.sCourse');

        page.render('secondCourse');
    });
});

app.get('/setMenu', function (page, model, params, next) {
    var userId = model.get('_session.userId');
    var user = model.at('users.' + userId);

    var fCourse = model.query('courses', { type: 1, $orderby: { name: 1} });
    var sCourse = model.query('courses', { type: 2, $orderby: { name: 1} });

    model.subscribe(fCourse, sCourse, user, function (err) {
        if (err) return next(err);
//        var fCourse = model.filter('courses',function (item) {
//            return item.type == 1;
//        }).sort('nameSort');
        fCourse.ref('_page.fCourse');

//        var sCourse = model.filter('courses',function (item) {
//            return item.type == 2;
//        }).sort('nameSort');
        sCourse.ref('_page.sCourse');

        model.ref('_page.user', user);

        page.render('setMenu');
    });
});

app.get('/login', function(page, model, params, next){
    var userId = model.get('_session.userId');
    var user = model.at('users.' + userId);

    model.subscribe(user, function(err) {
        if (err) return next(err);

        model.ref('_page.user', user);

        page.render('login');
    });
});

// CONTROLLER FUNCTIONS //
app.fn('fCourse.add', function (e, el) {
    helpers.courseAdd(this, 1);
});

app.fn('sCourse.add', function (e, el) {
    helpers.courseAdd(this, 2);
});

app.fn('course', {
    remove: function (e) {
        var item = e.get(':item');
        this.model.del('courses.' + item.id);
    },
    toggleEdit: function (e) {
        var item = e.get(':item');
        this.model.set('courses.' + item.id + '.editing', !item.editing);
    },
    setDate: function (e, el) {
        var itemId = e.get('.id'),
            item = e.get(),
            now = new Date(),
            sNow = helpers.dateToStr(now);

        if (item.date === sNow) {
            this.model.del('courses.' + itemId + '.date');
        } else {
            this.model.set('courses.' + itemId + '.date', sNow);
        }
    }
});
// VIEW FUNCIONS //

app.view.fn('isDateNow', function(date) {
    var now = new Date();
    //console.log(date, helpers.dateToStr(now), date === helpers.dateToStr(now));
    return date === helpers.dateToStr(now);
});