$.fn.eventTimeline = (function () {
  var monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul",
    "Aug", "Sep", "Oct", "Nov", "Dec"
  ];

  function formatDate(date) {
    var day = date.getDate(),
        month = monthNames[date.getMonth()],
        time = date.toLocaleTimeString(),
        year = date.getFullYear();
    return day + " " + month + " " + year + " " + time;
  }

  function px2num(val) {
    return Number(val.replace('px', ''));
  }

  function setTransformValue(element, property, value) {
    element.style["-webkit-transform"] = property+"("+value+")";
    element.style["-moz-transform"] = property+"("+value+")";
    element.style["-ms-transform"] = property+"("+value+")";
    element.style["-o-transform"] = property+"("+value+")";
    element.style["transform"] = property+"("+value+")";
  }

  /*
    How to tell if a DOM element is visible in the current viewport?
    http://stackoverflow.com/questions/123999/how-to-tell-if-a-dom-element-is-visible-in-the-current-viewport
  */
  function elementInViewport(el) {
    var top = el.offsetTop;
    var left = el.offsetLeft;
    var width = el.offsetWidth;
    var height = el.offsetHeight;

    while(el.offsetParent) {
        el = el.offsetParent;
        top += el.offsetTop;
        left += el.offsetLeft;
    }

    return (
        top < (window.pageYOffset + window.innerHeight) &&
        left < (window.pageXOffset + window.innerWidth) &&
        (top + height) > window.pageYOffset &&
        (left + width) > window.pageXOffset
    );
  }

  var defaults = {
    panels: 2,
    panelSwitches: true,
    eventsMinDistance: 120,
    eventsListUrl: 'http://sp.nx.sg/hs/dates.php',
    eventContentUrl: 'http://sp.nx.sg/hs/panels.php'
  }, timelines = {};

  function EventTimeline($elem, config) {
    var self = this;
    self.config = $.extend({}, defaults, config);
    self.eventContent = {};
    self.elems = {
      timeline: $elem.find('.cd-horizontal-timeline'),
      wrapper: $elem.find('.events-wrapper'),
      eventsWrapper: $elem.find('.events-wrapper .events'),
      navigation: $elem.find('.cd-timeline-navigation'),
      eventsContent: $elem.find('.events-content'),
      panelSwitches: $elem.find('.panel-switch a'),
      appLoader: $elem.find('.loader-wrapper'),
      loadingFailed: $elem.find('.loading-failed').remove(),
    };

    if (!self.config.panelSwitches) {
      $elem.find('.panel-switch').remove();
    }
    self.tryToLoadEvents();

    // event loading failure refresh click handler
    self.elems.appLoader.on('click', 'a.refresh', function (event) {
      event.preventDefault();
      $(this).parent('.loading-failed').remove();
      self.tryToLoadEvents();
    });

    // panel switches
    self.elems.panelSwitches
      .click(function(event) {
        event.preventDefault();
        self.setPanels(parseInt(this.getAttribute('data-panels')));
      })
      .filter('[data-panels="'+self.config.panels+'"]').addClass('selected');

    // next/prev navigation buttons
    self.elems.navigation
      .on('click', '.next.scroll', function(event) {
        event.preventDefault();
        self.updateSlide('next');
      })
      .on('click', '.prev.scroll', function(event) {
        event.preventDefault();
        self.updateSlide('prev');
      })
      .on('click', '.next.item', function(event) {
        event.preventDefault();
        self.goToAdjacentEvent('next');
      })
      .on('click', '.prev.item', function(event) {
        event.preventDefault();
        self.goToAdjacentEvent('prev');
      });

    this.elems.wrapper.on('click', 'a', function(event) {
      event.preventDefault();
      self.showNewContent($(this));
    });

    //on swipe, show next/prev event content
    this.elems.eventsContent
      .on('swipeleft', function() {
        self.goToAdjacentEvent('next');
      })
      .on('swiperight', function() {
        self.goToAdjacentEvent('prev');
      })
      .on('click', 'a.refresh', function(event) {
        event.preventDefault();
        var curEvent = self.getCurrentEvent();
        self.showNewContent(curEvent, null, true);
      });

    //keyboard navigation
    $(document).keyup(function(event) {
      if (event.which == '37' && elementInViewport($elem.get(0))) {
        self.goToAdjacentEvent('prev');
      } else if (event.which == '39' && elementInViewport($elem.get(0))) {
        self.goToAdjacentEvent('next');
      }
    });
  }

  $.extend(EventTimeline.prototype, {
    tryToLoadEvents: function () {
      var self = this;
      self.loadEventsList().then(function() {
        self.elems.fillingLine = self.elems.eventsWrapper.children('.filling-line');
        self.elems.events = self.elems.wrapper.find('a');

        //assign a left postion to the single events along the timeline
        self.setDatePosition();
        //assign a width to the timeline
        self.setTimelineWidth();
        //the timeline has been initialize - show it
        self.elems.timeline.addClass('loaded');
        self.elems.events.first().click();
      }).fail(function() {
        self.elems.appLoader.append(self.elems.loadingFailed.clone());
      });
    },

    loadEventsList: function () {
      var eventsWrapper = this.elems.eventsWrapper,
          appLoader     = this.elems.appLoader;

      return $.getJSON(this.config.eventsListUrl).then(function (eventsList) {
        var newEventsList = eventsList.map(function(date) {
          var formattedDate = formatDate(new Date(date));
          return '<li><a href="#0" data-date="'+date+'">' + formattedDate +
                 '<time datetime="'+date+'"></time></a></li>';
        }).join('');
        eventsWrapper.find('ol').empty().append(newEventsList);
        eventsWrapper.find('time').timeago();
        appLoader.remove();
      });
    },

    getEventContent: function (date) {
      if (this.eventContent[date]) return this.eventContent[date];
      return this.eventContent[date] = $.ajax({
        url: this.config.eventContentUrl,
        data: {date: date},
        dataType: 'html'
      });
    },

    abortEventContentRequest: function(date, force) {
      // if event is still loading, abort and delete it
      var req = this.eventContent[date];
      if (req && (force || req.readyState != 4)) {
        req.abort();
        delete this.eventContent[date];
      }
    },

    getCurrentEvent: function () {
      return this.elems.events.filter('.selected').first();
    },

    getTranslateValue: function () {
      var timeline = this.elems.eventsWrapper,
        timelineStyle = window.getComputedStyle(timeline.get(0), null),
        timelineTranslate = timelineStyle.getPropertyValue("-webkit-transform") ||
              timelineStyle.getPropertyValue("-moz-transform") ||
              timelineStyle.getPropertyValue("-ms-transform") ||
              timelineStyle.getPropertyValue("-o-transform") ||
              timelineStyle.getPropertyValue("transform");

      if( timelineTranslate.indexOf('(') >=0 ) {
        var timelineTranslate = timelineTranslate.split('(')[1];
      timelineTranslate = timelineTranslate.split(')')[0];
      timelineTranslate = timelineTranslate.split(',');
      var translateValue = timelineTranslate[4];
      } else {
        var translateValue = 0;
      }

      return Number(translateValue);
    },

    updateSlide: function (nextOrPrev) {
      //translate the timeline to the left('next')/right('prev')
      var amount = this.getTranslateValue(),
          wrapperWidth = this.getWrapperWidth(),
          value  = wrapperWidth - this.config.eventsMinDistance,
          totWidth;
      if (nextOrPrev == 'next') {
        amount -= value;
        totWidth = wrapperWidth - this.timelineWidth;
      } else {
        amount += value;
      }
      this.translateTimeline(amount, totWidth);
    },

    goToAdjacentEvent: function (nextOrPrev) {
      //go from one event to the next/previous one
      var newEvent = this.getCurrentEvent().parent('li')[nextOrPrev]('li').children('a');
      if (newEvent.length) {
        this.showNewContent(newEvent, nextOrPrev);
      }
      this.updateTimelinePosition(newEvent, nextOrPrev);
    },

    showNewContent: function (newEvent, nextOrPrev, forceRerender) {
      // handle clicking on an event that doesn't have enough events ahead of it
      if (this.config.panels > 1) {
        var lastEventLi = newEvent.parent('li').nextAll('li:lt('+(this.config.panels-1)+')').last();
        if (!lastEventLi.length) lastEventLi = newEvent.parent('li');
        newEvent = lastEventLi.prevAll('li:lt(' + (this.config.panels-1) + ')').last().children('a');
      }

      if (!newEvent.length) return;
      var curEvent = this.getCurrentEvent();

      if (!nextOrPrev) {
        nextOrPrev = newEvent.parent('li').index() > curEvent.parent('li').index() ?
                     'next' : 'prev';
      }
      if (!forceRerender && curEvent[0] == newEvent[0]) return;

      this.renderContentChange(newEvent, nextOrPrev);
    },

    renderContentChange: function (newEvent, nextOrPrev) {
      var self = this,
          appendOrPrepend = nextOrPrev == 'next' ? 'append' : 'prepend',
          oldContent = self.elems.eventsContent.find('li'),
          newContent = $(),
          eventLis = newEvent.parent('li');

      eventLis
        .add(eventLis.nextAll('li:lt('+(self.config.panels-1)+')'))
        .children('a').map(function(i, eventA) {
          var date = eventA.getAttribute('data-date'),
              newLi = $('<li></li>', {
                "class": "loading",
                "data-date": date,
              }).append($('<div></div>', { "class": "loader" }));

          newContent = newContent.add(newLi);

          self.getEventContent(date).then(function(data) {
            newLi.html(data);
          }).fail(function () {
            newLi.attr('data-date', null);
            newLi.html(self.elems.loadingFailed.clone());
            self.abortEventContentRequest(date, true);
          }).always(function() {
            newLi.removeClass('loading');
            setTimeout(function() {
                var height = px2num(window.getComputedStyle(newLi[0], null).getPropertyValue('height'));
                self.elems.eventsContent.find('selected').map(function(i, content) {
                var thisHeight = px2num(window.getComputedStyle(content, null).getPropertyValue('height'));
                if (height > thisHeight) content.style.height = height;
              });
            });
          });
        });

      oldContent.map(function(i, li) {
        var date = li.getAttribute('data-date');
        self.abortEventContentRequest(date);
      });

      self.elems.eventsContent.find('ol')[appendOrPrepend](newContent);
      self.updateVisibleContent(oldContent, newContent, nextOrPrev);
      self.updateFilling(newEvent);

      self.elems.events.removeClass('selected highlighted');

      newEvent
        .addClass('selected')
        .parent('li').nextAll('li:lt('+(self.config.panels-1)+')').children('a').addClass('highlighted');

      this.updateTimelinePosition(newEvent, nextOrPrev);

      var children = self.elems.events,
          alpha = children[0],
          zeta  = children[children.length-1];
      var addRemove = function(ev, o) {
        return (ev && ev[0]) == o ? 'addClass' : 'removeClass';
      };
      self.elems.navigation.find('.prev.item')[addRemove(newEvent, alpha)]('inactive');
      self.elems.navigation.find('.next.item')[addRemove(newEvent, zeta)]('inactive');
    },

    updateTimelinePosition: function (event, nextOrPrev) {
      //translate timeline to the left/right according to the position of the selected event
      // find the event that's just ahead of the last in the chain
      var lastVisible =
            event.parent('li').nextAll('li:lt('+this.config.panels+')').last().children('a'),
      // and the event that's just behind the first one
          firstVisible = event.parent('li').prev('li').children('a');

      if (nextOrPrev == 'next' && !lastVisible.length ||
          nextOrPrev == 'prev' && !firstVisible.length) return;

      var halfDist = this.config.eventsMinDistance/2,
          wrapperWidth = this.getWrapperWidth(),
          totWidth = wrapperWidth - this.timelineWidth,
          timelineTranslate = this.getTranslateValue();

      if (nextOrPrev == 'next' && lastVisible.length) {
        var lastEventStyle = window.getComputedStyle(lastVisible.get(0), null),
            lastEventLeft = px2num(lastEventStyle.getPropertyValue("left")) + halfDist;

        if (lastEventLeft + this.config.eventsMinDistance/2 > wrapperWidth - timelineTranslate) {
          this.translateTimeline(- lastEventLeft + wrapperWidth - halfDist, totWidth);
        }
      }

      if (nextOrPrev == 'prev' && firstVisible.length) {
        var firstEventStyle = window.getComputedStyle(firstVisible.get(0), null),
            firstEventLeft = px2num(firstEventStyle.getPropertyValue("left")) + halfDist;
        if (firstEventLeft - halfDist < - timelineTranslate) {
          this.translateTimeline(- firstEventLeft + halfDist, totWidth);
        }
      }
    },

    translateTimeline: function (value, totWidth) {
      var eventsWrapper = this.elems.eventsWrapper.get(0);
      value = (value > 0) ? 0 : value; //only negative translate value
      value = ( !(typeof totWidth === 'undefined') &&  value < totWidth ) ? totWidth : value; //do not translate more than timeline width
      setTransformValue(eventsWrapper, 'translateX', value+'px');
      //update navigation arrows visibility
      var addRemove = {true: 'addClass', false: 'removeClass'};
      this.elems.navigation.find('.prev.scroll')[addRemove[value==0]]('inactive');
      this.elems.navigation.find('.next.scroll')[addRemove[value==totWidth]]('inactive');
    },

    updateFilling: function (selectedEvent) {
      //change .filling-line length according to the selected event
      var self = this,
          filling = self.elems.fillingLine.get(0);

      if (self.config.panels < 2) {
        filling.style['width'] = 0;
        return;
      }

      var lastEvent = selectedEvent.parent('li').nextAll('li').eq(self.config.panels-2).children('a'),
          lastEventStyle = window.getComputedStyle(lastEvent.get(0), null),
          eventStyle = window.getComputedStyle(selectedEvent.get(0), null),
          eventWidth = px2num(eventStyle.getPropertyValue("width")),
          lastEventWidth = px2num(lastEventStyle.getPropertyValue("width")),
          eventLeft = px2num(eventStyle.getPropertyValue("left")) + eventWidth/2,
          lastEventLeft = px2num(lastEventStyle.getPropertyValue("left")) + lastEventWidth/2;

      filling.style['left'] = eventLeft + 'px';
      filling.style['width'] = (lastEventLeft - eventLeft) + 'px';
    },

    setDatePosition: function () {
      var min = this.config.eventsMinDistance;
      this.elems.events.map(function(i, event) {
        event.style['left'] = i*min + 'px';
      });
    },

    setTimelineWidth: function () {
      var minDist = this.config.eventsMinDistance,
          selectedEvent = this.getCurrentEvent(),
          timelineWidth = minDist * this.elems.events.length;
      this.elems.eventsWrapper.css('width',  timelineWidth + 'px');

      if (selectedEvent.length) {
        this.updateFilling(selectedEvent);
        this.updateTimelinePosition(selectedEvent, 'next');
      }

      return this.timelineWidth = timelineWidth;
    },

    getTotalWidth: function() {
      return this.getWrapperWidth() - this.timelineWidth;
    },

    getWrapperWidth: function () {
      return px2num(this.elems.wrapper.css('width'));
    },

    updateVisibleContent: function (oldContent, newContent, nextOrPrev) {
      var classEntering, classLeaving,
          contentWidth = 100/this.config.panels,
          contentHeight = 0;

      if (nextOrPrev == 'next') {
        classEntering = 'selected enter-right';
        classLeaving = 'leave-left';
      } else {
        classEntering = 'selected enter-left';
        classLeaving = 'leave-right';
      }

      oldContent.map(function(i, content) {
        content.setAttribute('class', classLeaving);
        content.style['margin-left'] = (i*contentWidth)+'%';
      });

      newContent
        .css('width', contentWidth + '%')
        .addClass(classEntering)
        .one('webkitAnimationEnd oanimationend msAnimationEnd animationend', function() {
          oldContent.remove();
          newContent.removeClass('enter-left enter-right');
        })
        .first().addClass('first');
    },

    setPanels: function(nPanels) {
      if (this.config.panels == nPanels) return;

      var curEvent = this.getCurrentEvent(),
          nextOrPrev = nPanels > this.config.panels ? 'next' : 'prev';
      this.config.panels = nPanels;
      this.showNewContent(curEvent, nextOrPrev, true);
      this.elems.panelSwitches.removeClass('selected');
      this.elems.panelSwitches.filter('[data-panels="'+nPanels+'"]').addClass('selected');
    },
  });

  return function(config) {
    this.addClass('event-timeline').html(
      '<div class="loader-wrapper">\
        <div class="loader">Loading...</div>\
      </div>\
      <div class="loading-failed">\
        <a href="#" class="refresh">\
          <h2>Loading failed</h2>\
          Click to refresh\
        </a>\
      </div>\
      <div class="cd-horizontal-timeline">\
        <div class="panel-switch">\
          <a href="#" title="1 column display" class="one" data-panels="1">\
            <div class="menu-burger"></div>\
          </a>\
          <a href="#" title="2 column display" class="two" data-panels="2">\
            <div class="menu-burger"></div><div class="menu-burger"></div>\
          </a>\
        </div>\
        <div class="timeline">\
          <div class="events-wrapper">\
            <div class="events">\
              <ol></ol>\
              <span class="filling-line" aria-hidden="true"></span>\
            </div>\
          </div>\
          <ul class="cd-timeline-navigation">\
            <li><a href="#0" class="prev scroll inactive">Prev</a></li>\
            <li><a href="#0" class="prev item inactive">Prev</a></li>\
            <li><a href="#0" class="next item">Next</a></li>\
            <li><a href="#0" class="next scroll">Next</a></li>\
          </ul>\
        </div>\
        <div class="events-content">\
          <ol></ol>\
        </div>\
      </div>'
    );

    this.data('eventTimeline', new EventTimeline(this, config));
    return this;
  }
})();
