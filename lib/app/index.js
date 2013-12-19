"use strict";
var app = require('derby').createApp(module)
    .use(require('derby-ui-boot'))
    .use(require('../../ui'));

var helpers = require('./helpers');

// route for authenticated users
app.get(/^\/(?:firstCourse|secondCourse|setMenu|userList)$/, function(page, model, params, next) {
    var userId = model.get('_session.userId');
    var user = model.at('users.' + userId);
    if (!app.getAccess(user, model)) return page.redirect('/');
    return next();
});

require('./menu.js');
require('./userList.js');

app.getAccess = function(user, model) {
    return model.get('_session.asPlanner');
}

app.on('model', function (model) {
    model.fn('nameSort', function (a, b) {
        return b.name > a.name ? -1 : b.name < a.name ? 1 : 0;
    });

    model.fn('filterFirstCourses', function(item, key, object) {
        if (!item || !item.name || item.type != 1) return false;

        var sFilter = model.get('_page.sFilter');
        if (!sFilter) return true;

        var reg = new RegExp('.*' + sFilter + '.*', 'i');
        return reg.test(item.name);
    });

    model.fn('filterSecondCourses', function(item, key, object) {
        if (!item || !item.name || item.type != 2) return false;

        var sFilter = model.get('_page.sFilter');
        if (!sFilter) return true;

        var reg = new RegExp('.*' + sFilter + '.*', 'i');
        return reg.test(item.name);
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

function setMenuFilters(model) {
    var filter1 = model.filter('courses', 'filterFirstCourses').sort('nameSort');
    var filter2 = model.filter('courses', 'filterSecondCourses').sort('nameSort');
    filter1.ref('_page.fCourse');
    filter2.ref('_page.sCourse');
}

app.get('/setMenu', function (page, model, params, next) {
    model.subscribe('courses', function(err) {
        if (err) return next(err);

        setMenuFilters(model);
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
var fcTimer = null,
    sPrevFilter = null;

app.fn('reFilter', function(e, el) {
    if (sPrevFilter === null || sPrevFilter != el.value) {
        var model = this.model;
        window.clearTimeout(fcTimer);
        sPrevFilter = el.value;
        fcTimer = window.setTimeout(function() {
            setMenuFilters(model);
        }, 100);
    }
});

app.fn('submitToMenu', function(e, el) {
    var model = this.model,
        filtered1 = model.get('_page.fCourse'),
        filtered2 = model.get('_page.sCourse');
    if ((!filtered1 || filtered1.length === 0) &&
        (!filtered2 || filtered2.length === 0)) return;
    
    var firstItem = filtered1.length > 0 ? filtered1[0] : filtered2[0],
        now = new Date(),
        sNow = helpers.dateToStr(now);

    if (firstItem.date === sNow) {
        model.del('courses.' + firstItem.id + '.date');
    } else {
        model.set('courses.' + firstItem.id + '.date', sNow);
    }

    model.set('_page.sFilter', '');
});

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
        var item = this.model.at(el).get(),
            now = new Date(),
            sNow = helpers.dateToStr(now);

        if (item.date === sNow) {
            this.model.del('courses.' + item.id + '.date');
        } else {
            this.model.set('courses.' + item.id + '.date', sNow);
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