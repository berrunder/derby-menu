"use strict";
var app = require('derby').createApp(module)
    .use(require('derby-ui-boot'))
    .use(require('../../ui'));

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

// CONTROLLER FUNCTIONS //
app.userFunc = {
    courseAdd: function (app, type) {
        var newItem = app.model.del('_page.newItem');
        if (!newItem) return;
        newItem.type = type;

        app.model.add('courses', newItem);
        // maybe this is a bad practice
        document.getElementById('courseName').focus();
    },
    dateToStr: function(date) {
        if (!date || typeof date.getFullYear !== "function") date = new Date();
        var month = (date.getMonth() + 1) + '',
            day = date.getDate() + '';
        if (month.length < 2) month = '0' + month;
        if (day.length < 2) day = '0' + day;

        return date.getFullYear() + '-' + month + '-' + day;
    },
    // В зависимости от num возвращается одна из трех переданных форм слова,
    // например, "запись", "записи", "записей".
    inclinateWord: function(num, singularWord, pluralWord1, pluralWord2) {
        num = num || 0;
        singularWord = singularWord || "";
        if (num % 10 === 1 && num % 100 !== 11) return singularWord;
        else if (num % 10 > 1 && num % 10 < 5 && (num % 100 < 10 || num % 100 > 20)) return pluralWord1 || singularWord;
        else return pluralWord2 || pluralWord1 || singularWord;
    }
};

app.fn('fCourse.add', function (e, el) {
    app.userFunc.courseAdd(this, 1);
});

app.fn('sCourse.add', function (e, el) {
    app.userFunc.courseAdd(this, 2);
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
            sNow = app.userFunc.dateToStr(now);

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
    //console.log(date, app.userFunc.dateToStr(now), date === app.userFunc.dateToStr(now));
    return date === app.userFunc.dateToStr(now);
});