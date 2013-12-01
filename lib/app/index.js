"use strict";
var app = require('derby').createApp(module)
    .use(require('derby-ui-boot'))
    .use(require('../../ui'));

var helpers = require('./helpers');

// route for authenticated users
app.get(/^\/(?:firstCourse|secondCourse|setMenu|userList)$/, function(page, model, params, next) {
    var userId = model.get('_session.userId');
    var user = model.at('users.' + userId);
    if (!app.getAccess(user)) return page.redirect('/');
    return next();
});

require('./menu.js');
require('./userList.js');

app.getAccess = function(user) {
    var token = user.get('accessToken');
    return token === 'hostAdmin';
}

app.on('model', function (model) {
    model.fn('nameSort', function (a, b) {
        return b.name > a.name ? -1 : b.name < a.name ? 1 : 0;
    });
});
// ROUTES //

// Derby routes are rendered on the client and the server
app.get('/', function (page) {
    page.redirect('/menu');
});

app.get(/^\/(?:firstCourse|secondCourse)$/, function (page, model, params, next) {
    var type = params.url === '/firstCourse' ? 1 : 2;

    var courseQuery = model.query('courses', { type: type, $orderby: { name: 1} });

    model.subscribe(courseQuery, function (err) {
        if (err) {
            console.log("Error! " + err);
            return next(err);
        }

        courseQuery.ref('_page.courses');
        model.set('_page.courseType', type);

        page.render('courses');
    });
});

app.get('/setMenu', function (page, model, params, next) {

    var fCourse = model.query('courses', { type: 1, $orderby: { name: 1} });
    var sCourse = model.query('courses', { type: 2, $orderby: { name: 1} });

    model.subscribe(fCourse, sCourse, /*user,*/ function (err) {
        if (err) return next(err);
        fCourse.ref('_page.fCourse');
        sCourse.ref('_page.sCourse');

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
app.fn('course', {
    add: function(e, el) {
        var courseType = this.model.get('_page.courseType');
        helpers.courseAdd(this, courseType);
    },
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

app.view.fn('showAll', function(token) {
    return token === 'hostAdmin';
});