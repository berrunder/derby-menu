"use strict";
module.exports = {
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