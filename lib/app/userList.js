"use strict";
var app = require('./index.js'),
    helpers = require('./helpers');

app.get('/userList', function(page, model, params, next) {
    var sNow = helpers.dateToStr();
    var users = model.query('users', { name: { $ne: '' }, lastDate: sNow, courses: { $ne: {} } });

    model.subscribe(users, 'courses', function(err) {
        if (err) return next(err);

        users.ref('_page.users');

        model.start('getUserList', '_page.userList', '_page.users', model.at('courses'));

        page.render('userList');
    });
});

app.on('model', function (model) {
    model.fn('getUserList', function(users, courses) {
        var userList = [];

        for (var i = users.length; i--;) {
            var user = users[i];
            if (!user.name || !user.name.trim()) continue;

            var firstList = [],
                secondList = [],
                sum = 0;

            var uCourses = user.courses;
            // Коэффициент половин порции
            var coef = (user.halfFirst ? 0.5 : 1);
            for (var id in uCourses) if (uCourses.hasOwnProperty(id)) {
                var course = courses[id];
                if (!course) continue;
                var price = helpers.normalizeUInt(course.price);

                if (course.type == 1) {
                    firstList.push(course.name + (user.halfFirst ? ' (половина)' : ''));
                    price = price * coef;
                } else {
                    secondList.push(course.name);
                }

                sum += price;
            }

            // перечислим блюда через запятую, сначал первые
            var courseList = firstList.concat(secondList);
            var sCourseList = courseList.join(', ');
            if (sCourseList.length > 1) sCourseList = sCourseList[0] + sCourseList.substr(1).toLowerCase();

            if (sCourseList.length > 0) {
                sCourseList += ', ' + helpers.countBread(user);
            }

            sum += helpers.getBreadSum(user, 5);

            userList.push({name: user.name, courseList: sCourseList, sum: sum });
        }

        return userList;
    });
});