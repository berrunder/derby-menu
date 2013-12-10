"use strict";
var app = require('./index.js'),
    helpers = require('./helpers');

app.get('/userList', function(page, model, params, next) {
    var sNow = helpers.dateToStr();
    var users = model.query('users', { name: { $ne: '' }, lastDate: sNow, courses: { $ne: {} } });

    model.subscribe(users, 'courses', function(err) {
        if (err) return next(err);

        users.ref('_page.users');
        model.ref('_page.courses', 'courses');

        page.render('userList');
    });
});

app.fn('clearUser', function(e, el) {
    var user = this.model.at(el);;
    user.set('courses', {});
    user.del('halfFirst');
    user.set('bread', {});
    user.del('name');
});

app.view.fn('getOrderText', function(user, courses) {
    if (!user || typeof user !== "object" || !user.name || !user.name.trim()) return '';

    var firstList = [],
        secondList = [];

    var uCourses = user.courses;
    for (var id in uCourses) if (uCourses.hasOwnProperty(id)) {
        var course = courses[id];
        if (!course) continue;

        if (course.type == 1) {
            firstList.push(course.name.trim() + (user.halfFirst ? ' (половина)' : ''));
        } else {
            secondList.push(course.name.trim());
        }
    }

    // перечислим блюда через запятую, сначал первые
    var courseList = firstList.concat(secondList);
    var sCourseList = courseList.join(', ');
    if (sCourseList.length > 1) sCourseList = sCourseList[0] + sCourseList.substr(1).toLowerCase();

    if (sCourseList.length > 0) {
        sCourseList += ', ' + helpers.countBread(user);
    }

    return sCourseList;
});

app.view.fn('getOrderPrice', function(user, courses) {
    if (!user.name || !user.name.trim()) return '';

    var sum = 0;

    var uCourses = user.courses;
    // Коэффициент половин порции
    var coef = (user.halfFirst ? 0.5 : 1);
    for (var id in uCourses) if (uCourses.hasOwnProperty(id)) {
        var course = courses[id];
        if (!course) continue;
        var price = helpers.normalizeUInt(course.price);

        if (course.type == 1) {
            price = price * coef;
        }

        sum += price;
    }

    sum += helpers.getBreadSum(user, 5);
    return sum;
});