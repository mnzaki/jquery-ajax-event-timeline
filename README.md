JQuery, AJAX, Horizontal Event Timeline
=======================================

This is a jquery plugin originally based on [this gem from CodyHouse](http://codyhouse.co/gem/horizontal-timeline/)

Extra features:
- load data through AJAX
- display events in more than one panel
- various timeline navigation improvements
- improved touch event handling

## Dependencies

See `src/js` for the dependencies.

- jQuery 2+
- jQuery.detect_swipe
- jquery.timeago


## Usage

```js
// these are the defaults
var eventTimelineConfig = {
  panels: 2,
  panelSwitches: true,
  eventsMinDistance: 120,

  // if this URL is provided, the plugin will try to load the list of
  // events from here, as a JSON array of datetimes in ISO format
  // similar to new Date().toISOString() output
  eventsListUrl: '',
  // if this URL is provided, the plugin will try to load panel contents
  // from it passing the ISO date as a query parameter
  // ex: { eventContentUrl: '/panels.php' }
  // request: /panels.php?date=2016-10-08T09%3A31%3A28%2B00%3A00
  eventContentUrl: '',

  // if an object is provided, it is used to retrieve panel content
  // keyed by ISO formatted dates.
  // ex { eventData: {'2016-10-08T09:31:28+00:00': '<p>event html content</p>' }
  eventData: null,

  // if a function is provided, this function should call callback
  // with a list of ISO formatted dates
  // similar to 'new Date().toISOString()'
  getEventsList: function(callback) { callback([]) },

  // if a function is provided, it should take an ISO date string as a parameter
  // and call callback with the html contents of the panel
  getEventContent: function(isoDate, callback) { callback('') }
};

$("#eventTimeline1').eventTimeline(eventTimelineConfig);

// the plugin is exported on element data
$("#eventTimeline1").data("eventTimeline")
  .setPanels(1)
```
