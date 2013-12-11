"use strict";
var app = require('./index.js'),
    helpers = require('./helpers');

var menuRoute = '/menu';

app.get(menuRoute, function (page, model, params, next) {
    var userId = model.get('_session.userId');
    var user = model.at('users.' + userId);

    var sNow = helpers.dateToStr();

    var fCourse = model.query('courses', { type: 1, date: sNow, $orderby: { name: 1} }),
        sCourse = model.query('courses', { type: 2, date: sNow, $orderby: { name: 1} }),
        namedUsers = model.query('users', { name: { $ne: '' }, lastDate: sNow, courses: { $ne: {} } });

    model.subscribe(fCourse, sCourse, user, namedUsers, function (err) {
        if (err) return next(err);

        fCourse.ref('_page.fCourse');

        sCourse.ref('_page.sCourse');

        // Проверим дату последнего посещения
        if (user.get('lastDate') !== sNow) {
            user.set('lastDate', sNow);
            user.set('courses', {});
        }

        user.setNull('bread', {});
        user.setNull('name', '');

        model.ref('_page.user', user);
        namedUsers.ref('_page.namedUsers');

        model.start('getSubscribedUsers', '_page.subscribedUsers', '_page.namedUsers');
        model.start('getTotalOrder', '_page.totalOrder', '_page.namedUsers', model.at('courses'));
        model.start('updateOrder', '_page.order', '_page.user', model.at('courses'));

        page.render('menu');
    });
});

app.on('model', function(model) {
    var breadPrice = 5;

    var normalizeUInt = helpers.normalizeUInt,
        getBreadSum = function(user) {
            return helpers.getBreadSum(user, breadPrice);
        };

    if (!String.prototype.trim) {
        String.prototype.trim = function () {
            return this.replace(/^\s+|\s+$/g, '');
        };
    }
    // возвращает объект со свойствами:
    // iCount - количество пользователей, идущих на обед
    // sList - список пользователей, идущих на обед
    model.fn('getSubscribedUsers', function(users) {
        var userList = [],
            iCount = users.length;

        for (var i = 0; i < iCount; i++) {
            var name = users[i].name;
            if (name && name.trim()) userList.push(name);
        }

        return {
            iCount: userList.length,
            sList: userList.join(', ')
        };
    });

    // возвращает объект со свойствами:
    // totalSum - сумма общего заказа
    // aCourses - массив блюд в формате { name, count }
    model.fn('getTotalOrder', function(users, courses) {
        var course;
        var aggregatedMenu = {},
            aCourses = [],
            totalSum = 0,
            white = 0, black = 0,
            id, key, type;

        for (var i = users.length; i--;) {
            var user = users[i];
            if (!user || typeof user !== "object" || !user.name || !user.name.trim()) continue;
            var uCourses = user.courses,
                secondCourses = [];
            for (id in uCourses) if (uCourses.hasOwnProperty(id)) {
                // подсчет количества блюд в общем заказе
                course = courses[id];
                if (!course) continue;

                var coursePrice = normalizeUInt(course.price);
                totalSum += user.halfFirst ? coursePrice / 2 : coursePrice;
                if (course.type == 1) {
                    key = user.halfFirst ? course.name.trim() + " (половина)" : course.name.trim();
                    type = 1;
                } else if (course.isSalad) {
                    key = course.name.trim();
                    type = 2;
                } else {
                    // объединим вторые блюда в одну тарелку
                    secondCourses.push(course.name.trim());
                    type = 0;
                }
                if (type == 0) continue;
                if (!(key in aggregatedMenu)) aggregatedMenu[key] = { count: 0, type: type};
                aggregatedMenu[key].count += 1;
            }
            if (secondCourses.length > 0) {
                key = helpers.lowerNotFirst(secondCourses.sort().join(', '));
                if (!(key in aggregatedMenu)) aggregatedMenu[key] = { count: 0, type: 2};
                aggregatedMenu[key].count += 1;
            }
            // посчитаем хлеб
            user.bread = user.bread || {};
            var currentWhite = normalizeUInt(user.bread.white),
                currentBlack = normalizeUInt(user.bread.black);
            if (currentWhite < 0) currentWhite = +0;
            if (currentBlack < 0) currentBlack = +0;

            white += currentWhite;
            black += currentBlack;
        }

        // теперь составим список
        for (key in aggregatedMenu) if (aggregatedMenu.hasOwnProperty(key)) {
            var aggItem = aggregatedMenu[key];
            aCourses.push({ count: aggItem.count, name: key, type: aggItem.type });
        }
        // отсортируем по типу
        aCourses.sort(function(a, b) { return a.type - b.type; });
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

    model.fn('updateOrder', function(user, courses) {
        var userCourses = user.courses,
            firstList = [],
            secondList = [],
            order = {
                list: '',
                coursesSum: 0,
                totalSum: 0,
                priceDefined: true
            };

        for (var id in userCourses) if (userCourses.hasOwnProperty(id)) {
            if (userCourses[id]) {
                var course = courses[id];
                //console.log(course);
                if (!course) {
                    //console.log(id);
                    continue;
                }

                var price = helpers.normalizeUInt(course.price);

                if (course.type == 1) {
                    firstList.push(course.name.trim() + (user.halfFirst ? ' (половина)' : ''));
                    price = price * (user.halfFirst ? 0.5 : 1);
                } else {
                    secondList.push(course.name.trim());
                }

                if (!course.price || course.price == 0) order.priceDefinded = false;

                order.coursesSum += price;
            }
        }

        // перечислим блюда через запятую, сначал первые
        var courseList = firstList.concat(secondList);
        order.list = courseList.join(', ');
        order.list = helpers.lowerNotFirst(order.list);
        // посчитаем и хлеб
        var breadSum = getBreadSum(user);
        order.totalSum = order.coursesSum + breadSum;
        // добавим хлеб, если что-то уже заказано
        if (breadSum > 0 && order.list.length > 0) {
            order.list += ', ' + helpers.countBread(user);
        }

        return order;
    });
});

app.enter(menuRoute, function(model) {
    var delCourse = function (capture, value, previous) {
        //console.log(capture, value, previous);
        if (!value) model.del('_page.user.courses.' + previous.id);
    };

    model.on('change', '_page.fCourse.*', delCourse);
    model.on('change', '_page.sCourse.*', delCourse);
    model.on('change', '_page.user.bread.*', function(capture, value) {
        value = parseInt(value || 0);
        if (isNaN(value) || value < 0) model.set('_page.user.bread.' + capture, 0);
    });
});

// CONTROLLER FUNCTIONS //
app.fn('toggleCourse', function(e, el) {
    var target = e.target || e.srcElement;
    if (target.tagName.toUpperCase() === 'INPUT') return;

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

app.fn('toggleRadioCourse', function(e, el) {
    var target = e.target || e.srcElement;
    if (target.tagName.toUpperCase() === 'INPUT') return;

    var id = e.get('.id'),
        model = this.model,
        userId = model.get('_session.userId'),
        userPath = 'users.' + userId;
    model.setNull(userPath + '.courses', {});

    if (model.get(userPath + '.courses.' + id)) {
        return model.del(userPath + '.courses.' + id);
    }

    var uCourses = model.get(userPath + '.courses');
    for (var cId in uCourses) if (uCourses.hasOwnProperty(cId)) {
        var courseType = model.get('courses.' + cId + '.type');
        if (courseType == 1) model.del(userPath + '.courses.' + cId);
    }

    model.set(userPath + '.courses.' + id, true);
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
    return helpers.inclinateWord(count, 'человек', 'человека', 'человек');
});