jQuery(document).ready(function($){
  var config = {
    panels: 2,
    eventsMinDistance: 120,
    eventsListUrl: 'http://sp.nx.sg/hs/dates.php',
    eventContentUrl: 'http://sp.nx.sg/hs/panels.php'
  };

  var formatDate = (function() {
    var monthNames = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul",
      "Aug", "Sep", "Oct", "Nov", "Dec"
    ];
    return function (date) {
      var day = date.getDate(),
          month = monthNames[date.getMonth()],
          time = date.toLocaleTimeString(),
          year = date.getFullYear();
      return day + " " + month + " " + year + " " + time;
    }
  })();

  function px2num(val) {
    return Number(val.replace('px', ''));
  }

  function loadEventsList(eventsWrapper) {
    return $.getJSON(config.eventsListUrl).then(function (eventsList) {
      var newEventsList = eventsList.map(function(date) {
        var formattedDate = formatDate(new Date(date));
        return '<li><a href="#0" data-date="'+date+'">' + formattedDate + '</a></li>';
      }).join('');
      eventsWrapper.find('ol').empty().append(newEventsList);
    });
  }

  var eventContent = {};

  function getEventContent(date) {
    if (eventContent[date]) return eventContent[date];
    return eventContent[date] = $.get(config.eventContentUrl, {date: date});
  }

  function abortEventContentRequest(date) {
    // if event is still loading, abort and delete it
    var req = eventContent[date];
    if (req && req.readyState != 4) {
      req.abort();
      delete eventContent[date];
    }
  }

  $('.cd-horizontal-timeline').each(function(){
    var timeline = $(this),
        timelineTotWidth,
        timelineComponents = {};

    timelineComponents['timelineWrapper'] = timeline.find('.events-wrapper');
    timelineComponents['timelineNavigation'] = timeline.find('.cd-timeline-navigation');
    timelineComponents['eventsWrapper'] = timelineComponents['timelineWrapper'].children('.events');
    timelineComponents['eventsContent'] = timeline.children('.events-content');
    timelineComponents['panelSwitches'] = timeline.find('.panel-switch a');

    loadEventsList(timelineComponents['eventsWrapper']).then(function() {
      timelineComponents['fillingLine'] = timelineComponents['eventsWrapper'].children('.filling-line');
      timelineComponents['timelineEvents'] = timelineComponents['eventsWrapper'].find('a');

      //assign a left postion to the single events along the timeline
      setDatePosition(timelineComponents, config.eventsMinDistance);
      //assign a width to the timeline
      timelineTotWidth = setTimelineWidth(timelineComponents, config.eventsMinDistance);
      //the timeline has been initialize - show it
      timeline.addClass('loaded');

      timelineComponents['timelineEvents'].first().click();
    });

    // panel switches
    timelineComponents['panelSwitches']
      .click(function(event) {
        event.preventDefault();
        var nPanels = parseInt(this.getAttribute('data-panels'));
        if (config.panels == nPanels) return;
        config.panels = nPanels;
        timelineComponents['timelineEvents'].filter('.selected').first().click();
        timelineComponents['panelSwitches'].removeClass('selected');
        this.setAttribute('class', 'selected');
      })
      .filter('[data-panels="'+config.panels+'"]').addClass('selected');

    // next/prev buttons
    timelineComponents['timelineNavigation']
      .on('click', '.next', function(event) {
        event.preventDefault();
        updateSlide(timelineComponents, timelineTotWidth, 'next');
      })
      .on('click', '.prev', function(event) {
        event.preventDefault();
        updateSlide(timelineComponents, timelineTotWidth, 'prev');
      });

    timelineComponents['eventsWrapper'].on('click', 'a', function(event) {
      event.preventDefault();
      showNewContent(timelineComponents, timelineTotWidth, $(this));
    });

    //on swipe, show next/prev event content
    timelineComponents['eventsContent']
      .on('swipeleft', function() {
        goToAdjacentEvent(timelineComponents, timelineTotWidth, 'next');
      })
      .on('swiperight', function() {
        goToAdjacentEvent(timelineComponents, timelineTotWidth, 'prev');
      });

    //keyboard navigation
    $(document).keyup(function(event) {
      if (event.which == '37' && elementInViewport(timeline.get(0))) {
        goToAdjacentEvent(timelineComponents, timelineTotWidth, 'prev');
      } else if (event.which == '39' && elementInViewport(timeline.get(0))) {
        goToAdjacentEvent(timelineComponents, timelineTotWidth, 'next');
      }
    });
  });

  function updateSlide(timelineComponents, timelineTotWidth, string) {
    //retrieve translateX value of timelineComponents['eventsWrapper']
    var translateValue = getTranslateValue(timelineComponents['eventsWrapper']),
      wrapperWidth = px2num(timelineComponents['timelineWrapper'].css('width'));
    //translate the timeline to the left('next')/right('prev')
    (string == 'next')
      ? translateTimeline(timelineComponents, translateValue - wrapperWidth + config.eventsMinDistance, wrapperWidth - timelineTotWidth)
      : translateTimeline(timelineComponents, translateValue + wrapperWidth - config.eventsMinDistance);
  }

  function goToAdjacentEvent(timelineComponents, timelineTotWidth, nextOrPrev) {
    //go from one event to the next/previous one
    var selectedDate = timelineComponents['eventsWrapper'].find('.selected'),
        newEvent = selectedDate.parent('li')[nextOrPrev]('li').children('a');
    if (newEvent.length) {
      showNewContent(timelineComponents, timelineTotWidth, newEvent, nextOrPrev);
    }
  }

  function showNewContent(timelineComponents, timelineTotWidth, newEvent, nextOrPrev) {
    // handle clicking on an event that doesn't have enough events ahead of it
    if (config.panels > 1) {
      var lastEventLi = newEvent.parent('li').nextAll('li:lt('+(config.panels-1)+')').last();
      if (!lastEventLi.length) lastEventLi = newEvent.parent('li');
      newEvent = lastEventLi.prevAll('li:lt(' + (config.panels-1) + ')').last().children('a');
    }

    if (!newEvent.length) return;

    if (!nextOrPrev) {
      var curEvent = timelineComponents['timelineEvents'].filter('.selected').first();
      nextOrPrev = newEvent.parent('li').index() > curEvent.parent('li').index() ?
                   'next' : 'prev';
    }

    var appendOrPrepend = nextOrPrev == 'next' ? 'append' : 'prepend',
        oldContent = timelineComponents['eventsContent'].find('.selected'),
        newContent = $(),
        eventLis = newEvent.parent('li');

    eventLis
      .add(eventLis.nextAll('li:lt('+(config.panels-1)+')'))
      .children('a').map(function(i, eventA) {
        var date = eventA.getAttribute('data-date'),
            newLi = $('<li></li>', {
              "class": "loading",
              "data-date": date,
            });
        getEventContent(date).then(function(data) {
          newLi.html(data);
        });
        newContent = newContent.add(newLi);
      });

    oldContent.map(function(i, li) {
      var date = li.getAttribute('data-date');
      abortEventContentRequest(date);
    });
    timelineComponents['eventsContent'].find('ol')[appendOrPrepend](newContent);
    updateVisibleContent(oldContent, newContent, nextOrPrev);
    updateFilling(newEvent, timelineComponents['fillingLine'], timelineTotWidth);

    timelineComponents['timelineEvents'].removeClass('selected highlighted');

    newEvent
      .addClass('selected')
      .parent('li').nextAll('li:lt('+(config.panels-1)+')').children('a').addClass('highlighted');

    newEvent
      .parent('li').prevAll('li').children('a').addClass('older-event')
      .end().end().nextAll('li').children('a').removeClass('older-event');

    updateTimelinePosition(nextOrPrev, newEvent, timelineComponents);
  }

  function updateTimelinePosition(string, event, timelineComponents) {
    //translate timeline to the left/right according to the position of the selected event
    if (string == 'next') {
      // find the event that's just ahead of the last in the chain
      event = event.parent('li').nextAll('li:lt('+config.panels+')').last().children('a');
    } else {
      // or the event that's just behind the first one
      event = event.parent('li').prev('li').children('a');
    }
    if (!event.length) return;

    var eventStyle = window.getComputedStyle(event.get(0), null),
        eventWidth = px2num(eventStyle.getPropertyValue("width")),
        eventLeft = px2num(eventStyle.getPropertyValue("left")) + eventWidth/2,
        timelineWidth = px2num(timelineComponents['timelineWrapper'].css('width')),
        timelineTotWidth = px2num(timelineComponents['eventsWrapper'].css('width')),
        timelineTranslate = getTranslateValue(timelineComponents['eventsWrapper']);

        if( (string == 'next' && eventLeft > timelineWidth - timelineTranslate) ||
            (string == 'prev' && eventLeft < - timelineTranslate) ) {
          translateTimeline(timelineComponents, - eventLeft + timelineWidth/2, timelineWidth - timelineTotWidth);
        }
  }

  function translateTimeline(timelineComponents, value, totWidth) {
    var eventsWrapper = timelineComponents['eventsWrapper'].get(0);
    value = (value > 0) ? 0 : value; //only negative translate value
    value = ( !(typeof totWidth === 'undefined') &&  value < totWidth ) ? totWidth : value; //do not translate more than timeline width
    setTransformValue(eventsWrapper, 'translateX', value+'px');
    //update navigation arrows visibility
    (value == 0 ) ? timelineComponents['timelineNavigation'].find('.prev').addClass('inactive') : timelineComponents['timelineNavigation'].find('.prev').removeClass('inactive');
    (value == totWidth ) ? timelineComponents['timelineNavigation'].find('.next').addClass('inactive') : timelineComponents['timelineNavigation'].find('.next').removeClass('inactive');
  }

  function updateFilling(selectedEvent, filling, totWidth) {
    //change .filling-line length according to the selected event
    filling = filling.get(0);

    if (config.panels < 2) {
      filling.style['width'] = 0;
      return;
    }

    var lastEvent = selectedEvent.parent('li').nextAll('li').eq(config.panels-2).children('a'),
        lastEventStyle = window.getComputedStyle(lastEvent.get(0), null),
        eventStyle = window.getComputedStyle(selectedEvent.get(0), null),
        eventWidth = px2num(eventStyle.getPropertyValue("width")),
        lastEventWidth = px2num(lastEventStyle.getPropertyValue("width")),
        eventLeft = px2num(eventStyle.getPropertyValue("left")) + eventWidth/2,
        lastEventLeft = px2num(lastEventStyle.getPropertyValue("left")) + lastEventWidth/2;

    filling.style['left'] = eventLeft + 'px';
    filling.style['width'] = (lastEventLeft - eventLeft) + 'px';
    //var scaleValue = (lastEventLeft-eventLeft)/totWidth;
    //setTransformValue(filling, 'scaleX', scaleValue);
  }

  function setDatePosition(timelineComponents, min) {
    timelineComponents['timelineEvents'].map(function(i, event) {
      event.style['left'] = i*min + 'px';
    });
  }

  function setTimelineWidth(timelineComponents, minDist) {
    var selectedEvent = timelineComponents['eventsWrapper'].find('a.selected'),
        totalWidth = minDist * timelineComponents['timelineEvents'].length;
    timelineComponents['eventsWrapper'].css('width',  totalWidth + 'px');

    if (selectedEvent.length) {
      updateFilling(selectedEvent, timelineComponents['fillingLine'], totalWidth);
      updateTimelinePosition('next', selectedEvent, timelineComponents);
    }

    return totalWidth;
  }

  function updateVisibleContent(oldContent, newContent, nextOrPrev) {
    var classEntering, classLeaving;
    if (nextOrPrev == 'next') {
      classEntering = 'selected enter-right';
      classLeaving = 'leave-left';
    } else {
      classEntering = 'selected enter-left';
      classLeaving = 'leave-right';
    }

    oldContent.attr('class', classLeaving).one('webkitAnimationEnd oanimationend msAnimationEnd animationend', function(){
      oldContent.remove();
      newContent.removeClass('enter-left enter-right');
    });

    newContent
      .addClass(classEntering)
      .css('width', (100/config.panels) + '%');
  }

  function getTranslateValue(timeline) {
    var timelineStyle = window.getComputedStyle(timeline.get(0), null),
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
});
