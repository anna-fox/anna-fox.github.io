$(function(){
   'use strict';

    var MONTH_NAMES = {
        en: [
            'January','February','March', 'April','May','June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ],
        ru: [
            'Январь','Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
            'Июль','Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
        ]
    };

    var calendarData = {};

    var DayModel = Backbone.Model.extend({
        defaults: {
            day: null,
            month: null,
            year: null,
            title: undefined,
            content: undefined
        }
    });

    var CalendarMonthCollection = Backbone.Collection.extend({
        model: DayModel
    });

    var CalendarModel = Backbone.Model.extend({
       initialize: function(){
           this._setCalendarData('now');
       },

        updateCalendarData: function(direction){
            var d = new Date(this.get('currentYear'), this.get('currentMonth'));

            switch (direction){
                case 'prev':
                    d.setMonth(this.get('currentMonth') - 1);
                    break;
                case 'next':
                    d.setMonth(this.get('currentMonth') + 1);
                    break;
                default:
                    break;
            }

            this._setCalendarData(d);
        },

        _setCalendarData : function(d) {
            var date, year, month, day;
            if (d === 'now'){
                date = new Date();
            } else {
                date = d;
            }
            year = date.getFullYear();
            month = date.getMonth();
            day = date.getDate();

            this.set({
                currentDay: day,
                currentMonth: month,
                currentYear: year,
                calendarDays: this._getCalendarDays(month, year)
            });

            if (d !== 'now'){
                this.trigger('change:date');
            }
        },

        _getCalendarDays: function(month, year){
            var calendarDays,
                monthKey = year + '_' + month;
            if (calendarData[monthKey]){
                calendarDays =  calendarData[monthKey];
            } else {
                var date = new Date(year, month),
                    days = [],
                    day;

                while (date.getMonth() === month){
                    day = new DayModel({
                        date: date.getDate(),
                        day: this._getDay(date.getDay()),
                        month: date.getMonth(),
                        year: date.getFullYear()
                    });
                    days.push(day);
                    date.setDate(date.getDate()+1);
                }

                calendarDays = new CalendarMonthCollection(days);
                calendarData[monthKey] = calendarDays;
            }

            return calendarDays;
        },

        _getDay: function(day){
            if (day === 0){
                day = 7;
            }
            return day - 1;
        }
    });


    var DayView = Backbone.View.extend({
        tagName: 'td',

        className: 'calendar__item j-calendar_item',

        template: _.template($('.j-day_template').html()),

        events: {
            'click': '_onClickItem',
            'submit .j-calendar_item__form': '_onSubmitForm',
            'click .j-clear_item': '_onClickClearItem'
        },

        initialize: function(parameters){
            this.$parentView = parameters.$parentView;
            this.model.on('change', this._onChangeModel, this);
        },

        render: function(){
            this.$el.html(this.template(this.model.attributes));
            return this;
        },

        clear: function(){
            this.model.off();
            this.$el.remove();
        },

        _onClickItem: function(){
            this.$parentView.find('.calendar__item-active').removeClass('calendar__item-active');
            this.$el.addClass('calendar__item-active');
        },

        _onSubmitForm: function(e){
            e.preventDefault();
            var formData = $(e.currentTarget).serializeArray(),
                formParams = {};
            for (var i = 0; i < formData.length; i++){
                formParams[formData[i].name] = formData[i].value.length > 0 ? formData[i].value : undefined;
            }
            this.$el.removeClass('calendar__item-active');
            this.model.set(formParams);
        },

        _onClickClearItem: function(e) {
            e.stopPropagation();
            this.model.set({
                title: undefined,
                content: undefined
            })
        },

        _onChangeModel: function(e){
            this.render();
        }
    });

    var CalendarBodyView = Backbone.View.extend({
        initialize: function(parameters){
            this.$parentView = parameters.$parentView;
        },

        render: function(){
            var dayView;
            var days = _.map(this.collection.models, function(item){
                dayView = new DayView({
                    model: item,
                    $parentView: this.$parentView
                });
                return dayView.render().el;
            }.bind(this));

            var emptyDaysFirst = this._getEmptyDays('start'),
                emptyDaysLast = this._getEmptyDays('end');

            days = emptyDaysFirst.concat(days).concat(emptyDaysLast);

            var daysByWeeks = _.groupBy(days, function(item, i){
                return Math.floor(i/7);
            });

            var tableContend = _.map(daysByWeeks, function(item){
                return $('<tr>').append(item);
            });

            this.$el.html(tableContend);

            return this;
        },

        clear: function(){
            this.collection.off();
            this.$el.off();
            this.$el.clear();
        },

        _getEmptyDays: function(side) {
            var emptyDays = [],
                count = 0,
                emptyTemplate = '<td class="calendar__empty"></td>';
            switch (side) {
                case 'start':
                    var firstMonthDay = this.collection.models[0].get('day');
                    while (count < firstMonthDay){
                        emptyDays.push(emptyTemplate);
                        count++;
                    }
                    break;
                case 'end':
                    var lastMonthDay = this.collection.models[this.collection.length - 1].get('day');
                    count = lastMonthDay + 1;
                    while (count <= 6){
                        emptyDays.push(emptyTemplate);
                        count++;
                    }
                    break;
                default:
                    break;
            }

            return emptyDays;
        }
    });

    var CalendarView = Backbone.View.extend({
        el: '.j-calendar_container',

        initialize: function() {
            this.$navigation = this.$('.j-calendar_navigation');
            this.$calendarBody = this.$('.j-calendar_body');
            this.model.on('change:date', this._onChangeModel, this);
            return this;
        },

        render: function(){
            this._renderNavigation();
            this._renderCalendarBody();
            return this;
        },

        clear: function(){
            this.model.off();
            this.$el.off();
            this.$navigation.empty();
            this.$calendarBody.empty();
        },

        events: {
            'click .j-navigation': '_onClickNavigation'
        },

        _navigationTemplate: _.template($('.j-navigation_template').html()),

        _renderNavigation: function(){
            this.$navigation.html(this._navigationTemplate({
                month: MONTH_NAMES.ru[this.model.get('currentMonth')],
                year: this.model.get('currentYear')
            }));
        },

        _renderCalendarBody: function(){
            if (this._calendarBodyView){
                this._calendarBodyView.clear();
            }
            this._calendarBodyView = new CalendarBodyView({
                collection: this.model.get('calendarDays'),
                el: this.$calendarBody,
                $parentView: this.$el
            }).render();
        },

        _onClickNavigation: function(e){
            var direction = $(e.currentTarget).data('direction');
            this.model.updateCalendarData(direction);
        },

        _onChangeModel: function(){
            this.render()
        }
    });

    var calendarModel = new CalendarModel();
    var calendar = new CalendarView({
        model: calendarModel
    });
    calendar.render();
});