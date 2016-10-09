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

  $('.cd-horizontal-timeline').each(function(){
    var timeline = $(this),
        timelineTotWidth,
        timelineComponents = {};

    timelineComponents['timelineWrapper'] = timeline.find('.events-wrapper');
    timelineComponents['timelineNavigation'] = timeline.find('.cd-timeline-navigation');
    timelineComponents['eventsWrapper'] = timelineComponents['timelineWrapper'].children('.events');
    timelineComponents['eventsContent'] = timeline.children('.events-content');

    loadEventsList(timelineComponents['eventsWrapper']).then(function() {
      timelineComponents['fillingLine'] = timelineComponents['eventsWrapper'].children('.filling-line');
      timelineComponents['timelineEvents'] = timelineComponents['eventsWrapper'].find('a');
      timelineComponents['timelineDates'] = parseDate(timelineComponents['timelineEvents']);
      timelineComponents['eventsMinLapse'] = minLapse(timelineComponents['timelineDates']);

      //assign a left postion to the single events along the timeline
      setDatePosition(timelineComponents, config.eventsMinDistance);
      //assign a width to the timeline
      timelineTotWidth = setTimelineWidth(timelineComponents, config.eventsMinDistance);
      //the timeline has been initialize - show it
      timeline.addClass('loaded');
    });

    //detect click on the next arrow
    timelineComponents['timelineNavigation'].on('click', '.next', function(event){
      event.preventDefault();
      updateSlide(timelineComponents, timelineTotWidth, 'next');
    });
    //detect click on the prev arrow
    timelineComponents['timelineNavigation'].on('click', '.prev', function(event){
      event.preventDefault();
      updateSlide(timelineComponents, timelineTotWidth, 'prev');
    });
    //detect click on the a single event - show new event content
    timelineComponents['eventsWrapper'].on('click', 'a', function(event){
      event.preventDefault();
      showNewContent(timelineComponents, timelineTotWidth, $(this), 'next'); // FIXME nextOrPrev?
    });

    //on swipe, show next/prev event content
    timelineComponents['eventsContent'].on('swipeleft', function(){
      var mq = checkMQ();
      ( mq == 'mobile' ) && showAdjacentEvent(timelineComponents, timelineTotWidth, 'next');
    });
    timelineComponents['eventsContent'].on('swiperight', function(){
      var mq = checkMQ();
      ( mq == 'mobile' ) && showAdjacentEvent(timelineComponents, timelineTotWidth, 'prev');
    });

    //keyboard navigation
    $(document).keyup(function(event){
      if (event.which == '37' && elementInViewport(timeline.get(0))) {
        showAdjacentEvent(timelineComponents, timelineTotWidth, 'prev');
      } else if (event.which == '39' && elementInViewport(timeline.get(0))) {
        showAdjacentEvent(timelineComponents, timelineTotWidth, 'next');
      }
    });
  });

  function loadEventsList(eventsWrapper) {
    return $.getJSON(config.eventsListUrl).then(function (eventsList) {
      var newEventsList = eventsList.map(function(date) {
        var formattedDate = formatDate(new Date(date));
        return '<li><a href="#0" data-date="'+date+'">' + formattedDate + '</a></li>';
      }).join('');
      eventsWrapper.find('ol').empty().append(newEventsList);
    });
  }

  function updateSlide(timelineComponents, timelineTotWidth, string) {
    //retrieve translateX value of timelineComponents['eventsWrapper']
    var translateValue = getTranslateValue(timelineComponents['eventsWrapper']),
      wrapperWidth = Number(timelineComponents['timelineWrapper'].css('width').replace('px', ''));
    //translate the timeline to the left('next')/right('prev')
    (string == 'next')
      ? translateTimeline(timelineComponents, translateValue - wrapperWidth + config.eventsMinDistance, wrapperWidth - timelineTotWidth)
      : translateTimeline(timelineComponents, translateValue + wrapperWidth - config.eventsMinDistance);
  }

  function showAdjacentEvent(timelineComponents, timelineTotWidth, nextOrPrev) {
    //go from one event to the next/previous one
    var selectedDate = timelineComponents['eventsWrapper'].find('.selected'),
        newEvent = selectedDate.parent('li')[nextOrPrev]('li').children('a');
    if (newEvent.length) {
      showNewContent(timelineComponents, timelineTotWidth, newEvent, nextOrPrev);
    }
  }

  function showNewContent(timelineComponents, timelineTotWidth, newEvent, nextOrPrev) {
    updateFilling(newEvent, timelineComponents['fillingLine'], timelineTotWidth);
    updateVisibleContent(newEvent, timelineComponents['eventsContent']);
    timelineComponents['timelineEvents'].removeClass('selected highlighted');
    newEvent.addClass('selected')
            .parent('li').nextAll('li:lt('+(config.panels-1)+')').children('a').addClass('highlighted');
    updateOlderEvents(newEvent);
    updateTimelinePosition(nextOrPrev, newEvent, timelineComponents);
  }

  function updateTimelinePosition(string, event, timelineComponents) {
    //translate timeline to the left/right according to the position of the selected event
    var eventStyle = window.getComputedStyle(event.get(0), null),
      eventLeft = Number(eventStyle.getPropertyValue("left").replace('px', '')),
      timelineWidth = Number(timelineComponents['timelineWrapper'].css('width').replace('px', '')),
      timelineTotWidth = Number(timelineComponents['eventsWrapper'].css('width').replace('px', ''));
    var timelineTranslate = getTranslateValue(timelineComponents['eventsWrapper']);

        if( (string == 'next' && eventLeft > timelineWidth - timelineTranslate) || (string == 'prev' && eventLeft < - timelineTranslate) ) {
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
    if (config.panels < 2) return;
    var lastEvent = selectedEvent.parent('li').nextAll('li').eq(config.panels-2).children('a'),
        lastEventStyle = window.getComputedStyle(lastEvent.get(0), null),
        eventStyle = window.getComputedStyle(selectedEvent.get(0), null),
        eventLeft = eventStyle.getPropertyValue("left"),
        lastEventLeft = lastEventStyle.getPropertyValue("left"),
        eventWidth = eventStyle.getPropertyValue("width"),
        lastEventWidth = lastEventStyle.getPropertyValue("width"),
    eventLeft = Number(eventLeft.replace('px', '')) + Number(eventWidth.replace('px', ''))/2;
    lastEventLeft = Number(lastEventLeft.replace('px', '')) + Number(lastEventWidth.replace('px', ''))/2;
    var scaleValue = (lastEventLeft-eventLeft)/totWidth;
    filling = filling.get(0);
    filling.style['left'] = eventLeft + 'px';
    filling.style['width'] = (lastEventLeft - eventLeft) + 'px';
    //setTransformValue(filling, 'scaleX', scaleValue);
  }

  function setDatePosition(timelineComponents, min) {
    for (i = 0; i < timelineComponents['timelineDates'].length; i++) {
        var distance = daydiff(timelineComponents['timelineDates'][0], timelineComponents['timelineDates'][i]),
          distanceNorm = Math.round(distance/timelineComponents['eventsMinLapse']) + 2;
        //timelineComponents['timelineEvents'].eq(i).css('left', distanceNorm*min+'px');
        timelineComponents['timelineEvents'].eq(i).css('left', i*min+'px');
    }
  }

  function setTimelineWidth(timelineComponents, width) {
    var timelineDates = timelineComponents['timelineDates'],
        timeSpan = daydiff(timelineDates[0], timelineDates[timelineDates.length-1]),
        timeSpanNorm = timeSpan/timelineComponents['eventsMinLapse'],
        selectedEvent = timelineComponents['eventsWrapper'].find('a.selected');
        timeSpanNorm = Math.round(timeSpanNorm) + 4,
        totalWidth = timeSpanNorm*width;
    timelineComponents['eventsWrapper'].css('width', totalWidth+'px');
    if (selectedEvent.length) {
      updateFilling(selectedEvent, timelineComponents['fillingLine'], totalWidth);
      updateTimelinePosition('next', selectedEvent, timelineComponents);
    }

    return totalWidth;
  }

  function updateVisibleContent(event, eventsContent) {
    var eventDate = event.data('date'),
      nPanels = config.panels,
      visibleContent = eventsContent.find('.selected'),
      selectedContent = eventsContent.find('[data-date="'+ eventDate +'"]'),
      selectedContentHeight = selectedContent.height();

    if (selectedContent.index() > visibleContent.index()) {
      var classEntering = 'selected enter-right',
        classLeaving = 'leave-left';
    } else {
      var classEntering = 'selected enter-left',
        classLeaving = 'leave-right';
    }

    visibleContent.attr('class', classLeaving).one('webkitAnimationEnd oanimationend msAnimationEnd animationend', function(){
      visibleContent.removeClass('leave-right leave-left');
      selectedContent.removeClass('enter-left enter-right');
    });

    selectedContent
      .add(selectedContent.nextAll('li:lt('+(nPanels-1)+')'))
      .attr('class', classEntering)
      .css('width', (100/nPanels) + '%');

    //eventsContent.css('height', selectedContentHeight+'px');
  }

  function updateOlderEvents(event) {
    event.parent('li').prevAll('li').children('a').addClass('older-event').end().end().nextAll('li').children('a').removeClass('older-event');
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

  //based on http://stackoverflow.com/questions/542938/how-do-i-get-the-number-of-days-between-two-dates-in-javascript
  function parseDate(events) {
    var dateArrays = [];
    events.each(function(){
      var singleDate = $(this),
        dateComp = singleDate.data('date');
      /*
        dateComp = singleDate.data('date').split('T');
      if( dateComp.length > 1 ) { //both DD/MM/YEAR and time are provided
        var dayComp = dateComp[0].split('/'),
          timeComp = dateComp[1].split(':');
      } else if( dateComp[0].indexOf(':') >=0 ) { //only time is provide
        var dayComp = ["2000", "0", "0"],
          timeComp = dateComp[0].split(':');
      } else { //only DD/MM/YEAR
        var dayComp = dateComp[0].split('/'),
          timeComp = ["0", "0"];
      }
      var newDate = new Date(dayComp[2], dayComp[1]-1, dayComp[0], timeComp[0], timeComp[1]);
      */
      dateArrays.push(new Date(dateComp));
    });
      return dateArrays;
  }

  function daydiff(first, second) {
      return Math.abs(Math.round((second-first)));
  }

  function minLapse(dates) {
    //determine the minimum distance among events
    var dateDistances = [];
    for (i = 1; i < dates.length; i++) {
        var distance = Math.abs(daydiff(dates[i-1], dates[i]));
        dateDistances.push(distance);
    }
    return Math.min.apply(null, dateDistances);
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

  function checkMQ() {
    //check if mobile or desktop device
    return window.getComputedStyle(document.querySelector('.cd-horizontal-timeline'), '::before').getPropertyValue('content').replace(/'/g, "").replace(/"/g, "");
  }
});
