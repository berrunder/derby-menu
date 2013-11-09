"use strict";
var app = require('./index.js');

app.on('model', function(model) {
    var breadPrice = 5;
    // возвращает объект со свойствами:
    // iCount - количество пользователей, идущих на обед
    // sList - список пользователей, идущих на обед
    model.fn('getSubscribedUsers', function(users) {
        var userList = [],
            iCount = users.length;

        for (var i = 0; i < iCount; i++) {
            userList.push(users[i].name);
        }

        return {
            iCount: iCount,
            sList: userList.join(', ')
        };
    });

    // возвращает объект со свойствами:
    // totalSum - сумма общего заказа
    // aCourses - массив блюд в формате { name, count }
    model.fn('getTotalOrder', function(users, courses) {
        var aggregatedMenu = {},
            aCourses = [],
            totalSum = 0,
            white = 0, black = 0,
            id;

        for (var i = users.length; i--;) {
            var uCourses = users[i].courses;
            for (id in uCourses) if (uCourses.hasOwnProperty(id)) {
                // посчитаем количество блюд в общем заказе
                aggregatedMenu[id] = +(aggregatedMenu[id] || 0) + 1;
            }
            // посчитаем хлеб
            white += parseInt(users[i].bread.white || 0);
            black += parseInt(users[i].bread.black || 0);
        }

        // теперь составим список
        for (id in aggregatedMenu) if (aggregatedMenu.hasOwnProperty(id)) {
            var course = courses[id];
            if (!course) continue;

            aCourses.push({ count: aggregatedMenu[id], name: course.name });
            totalSum += parseInt(course.price) * aggregatedMenu[id];
        }
        // добавим хлеб к общей сумме
        totalSum += (white + black) * breadPrice;
        // и к списку
        if (white > 0) aCourses.push({ count: white, name: 'Белый хлеб'});
        if (black > 0) aCourses.push({ count: black, name: 'Черный хлеб'});

        return {
            aCourses: aCourses,
            totalSum: totalSum
        }
    });
});

app.get('/menu', function (page, model, params, next) {
    var userId = model.get('_session.userId');
    var user = model.at('users.' + userId);

    var sNow = app.userFunc.dateToStr();

    var fCourse = model.query('courses', { type: 1, date: sNow, $orderby: { name: 1} }),
        sCourse = model.query('courses', { type: 2, date: sNow, $orderby: { name: 1} }),
        namedUsers = model.query('users', { name: { $ne: ''}, lastDate: sNow, courses: { $ne: {} } });

    model.subscribe(fCourse, sCourse, user, namedUsers, function (err) {
        if (err) return next(err);

        fCourse.ref('_page.fCourse');

        sCourse.ref('_page.sCourse');

        // Проверим дату последнего посещения
        if (user.get('lastDate') !== sNow) {
            user.set('lastDate', sNow);
            user.set('courses', {});
        }

        model.ref('_page.user', user);
        namedUsers.ref('_page.namedUsers');

        model.start('getSubscribedUsers', '_page.subscribedUsers', '_page.namedUsers');
        model.start('getTotalOrder', '_page.totalOrder', '_page.namedUsers', model.at('courses'));

        page.render('menu');
    });
});

app.enter('/menu', function(model) {
    var updateOrder = function () {
        var courses = model.get('_page.user.courses');
        var firstList = [],
            secondList = [],
            order = {
                list: '',
                coursesSum: 0,
                totalSum: 0,
                priceDefined: true
            };

        for (var id in courses) if (courses.hasOwnProperty(id)) {
            if (courses[id]) {
                var course = model.get('courses.' + id);
                //console.log(course);
                if (!course) {
                    //console.log(id);
                    model.del('_page.user.courses.' + id);
                    continue;
                }
                if (course.type == 1) {
                    firstList.push(course.name);
                } else {
                    secondList.push(course.name);
                }
                if (!course.price || course.price == 0) order.priceDefinded = false;

                order.coursesSum += parseInt(course.price || 0);
            }
        }

        // перечислим блюда через запятую, сначал первые
        var courseList = firstList.concat(secondList);
        order.list = courseList.join(', ');
        if (order.list.length > 1) order.list = order.list[0] + order.list.substr(1).toLowerCase();
        // посчитаем и хлеб
        order.totalSum = order.coursesSum + getBreadSum();

        model.set('_page.order', order);
    };

    var getBreadSum = function() {
        var breadPrice = 5,
            white = (parseInt(model.get('_page.user.bread.white') || 0) * breadPrice) || 0,
            black = (parseInt(model.get('_page.user.bread.black') || 0) * breadPrice) || 0;
        if (white < 0) white = 0;
        if (black < 0) black = 0;

        return white + black;
    };

    var calcBread = function() {
        var order = model.get('_page.order');
        model.set('_page.order.totalSum', (order.coursesSum || 0) + getBreadSum());
    };

    var delCourse = function (capture, value, previous) {
        console.log(capture, value, previous);
        if (!value) model.del('_page.user.courses.' + previous.id);
        //setTimeout(updateOrder, 25);
        updateOrder();
    };

    model.on('change', '_page.user.courses.*', updateOrder);
    model.on('change', '_page.user.bread.*', calcBread);
    model.on('change', '_page.fCourse.*', delCourse);
    model.on('change', '_page.sCourse.*', delCourse);
    model.on('change', '_page.fCourse.*.price', updateOrder);
    model.on('change', '_page.sCourse.*.price', updateOrder);

    updateOrder();
});

// CONTROLLER FUNCTIONS //
app.fn('toggleCourse', function(e, el) {
    var id = e.get('.id'),
        model = this.model,
        userId = model.get('_session.userId'),
        userPath = 'users.' + userId;
    model.setNull(userPath + '.courses', {});

    if (!model.get(userPath + '.courses.' + id)) {
        model.set(userPath + '.courses.' + id, true);
    } else {
        model.del(userPath + '.courses.' + id);
    }
    //console.log(user);
});

app.fn('toggleTotal', function(e, el) {
    var userId = this.model.get('_session.userId'),
        showTotal = e.get('_page.user.showTotal');
    this.model.set('users.' + userId + '.showTotal', !showTotal);
});
// VIEW FUNCITIONS //

app.view.fn('orderSet', function(order) {
    return order && order.list.length > 0;
});

app.view.fn('selected', function(courses, id) {
    return courses && (courses[id] || false);
});

app.view.fn('getHumansIncl', function(count) {
    return app.userFunc.inclinateWord(count, 'человек', 'человека', 'человек');
});