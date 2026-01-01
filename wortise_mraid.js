(function() {
  // iOS console logging workaround
  const isIOS = (/iphone|ipad|ipod/i).test(window.navigator.userAgent.toLowerCase());
  if (isIOS) {
    console = {};
    console.log = function(log) {
      const iframe = document.createElement('iframe');
      iframe.setAttribute('src', 'ios-log: ' + log);
      document.documentElement.appendChild(iframe);
      iframe.parentNode.removeChild(iframe);
    };
    console.debug = console.info = console.warn = console.error = console.log;
  }
}());

(function() {
  // Create MRAID namespace
  const mraid = window.mraid = {};

  //////////////////////////////////////////////////////////////////////////////////////////////////
  // Bridge interface to SDK
  const bridge = window.mraidbridge = {
    nativeSDKFiredReady: false,
    nativeCallQueue: [],
    nativeCallInFlight: false,
    lastSizeChangeProperties: null
  };

  bridge.fireChangeEvent = function(properties) {
    for (const p in properties) {
      if (properties.hasOwnProperty(p)) {
        // Change handlers defined by MRAID below
        const handler = changeHandlers[p];
        handler(properties[p]);
      }
    }
  };

  bridge.nativeCallComplete = function(command) {
    if (this.nativeCallQueue.length === 0) {
      this.nativeCallInFlight = false;
      return;
    }

    const nextCall = this.nativeCallQueue.pop();
    window.location = nextCall;
  };

  bridge.executeNativeCall = function(args) {
    const command = args.shift();

    if (!this.nativeSDKFiredReady) {
      console.log('rejecting ' + command + ' because mraid is not ready');
      bridge.notifyErrorEvent('mraid is not ready', command);
      return;
    }

    let call = 'mraid://' + command;
    let isFirstArgument = true;

    for (let i = 0; i < args.length; i += 2) {
      const key = args[i];
      const value = args[i + 1];

      if (value === null) continue;

      if (isFirstArgument) {
        call += '?';
        isFirstArgument = false;
      } else {
        call += '&';
      }

      call += encodeURIComponent(key) + '=' + encodeURIComponent(value);
    }

    if (this.nativeCallInFlight) {
      this.nativeCallQueue.push(call);
    } else {
      this.nativeCallInFlight = true;
      window.location = call;
    }
  };

  bridge.setCurrentPosition = function(x, y, width, height) {
    currentPosition = {
      x: x,
      y: y,
      width: width,
      height: height
    };
    broadcastEvent(EVENTS.INFO, 'Set current position to ' + stringify(currentPosition));
  };

  bridge.setDefaultPosition = function(x, y, width, height) {
    defaultPosition = {
      x: x,
      y: y,
      width: width,
      height: height
    };
    broadcastEvent(EVENTS.INFO, 'Set default position to ' + stringify(defaultPosition));
  };

  bridge.setMaxSize = function(width, height) {
    maxSize = {
      width: width,
      height: height
    };

    expandProperties.width = width;
    expandProperties.height = height;

    broadcastEvent(EVENTS.INFO, 'Set max size to ' + stringify(maxSize));
  };

  bridge.setPlacementType = function(_placementType) {
    placementType = _placementType;
    broadcastEvent(EVENTS.INFO, 'Set placement type to ' + stringify(placementType));
  };

  bridge.setScreenSize = function(width, height) {
    screenSize = {
      width: width,
      height: height
    };
    broadcastEvent(EVENTS.INFO, 'Set screen size to ' + stringify(screenSize));
  };

  bridge.setState = function(_state) {
    state = _state;
    broadcastEvent(EVENTS.INFO, 'Set state to ' + stringify(state));
    broadcastEvent(EVENTS.STATECHANGE, state);
  };

  bridge.setIsViewable = function(_isViewable) {
    isViewable = _isViewable;
    broadcastEvent(EVENTS.INFO, 'Set isViewable to ' + stringify(isViewable));
    broadcastEvent(EVENTS.VIEWABLECHANGE, isViewable);
  };

  bridge.setSupports = function(sms, tel, calendar, storePicture, inlineVideo) {
    supportProperties = {
      sms: sms,
      tel: tel,
      calendar: calendar,
      storePicture: storePicture,
      inlineVideo: inlineVideo
    };
  };

  bridge.notifyReadyEvent = function() {
    this.nativeSDKFiredReady = true;
    broadcastEvent(EVENTS.READY);
  };

  bridge.notifyErrorEvent = function(message, action) {
    broadcastEvent(EVENTS.ERROR, message, action);
  };

  // Temporary aliases while we migrate to the new API
  bridge.fireReadyEvent = bridge.notifyReadyEvent;
  bridge.fireErrorEvent = bridge.notifyErrorEvent;

  bridge.notifySizeChangeEvent = function(width, height) {
    if (this.lastSizeChangeProperties &&
        width == this.lastSizeChangeProperties.width && height == this.lastSizeChangeProperties.height) {
      return;
    }

    this.lastSizeChangeProperties = {
      width: width,
      height: height
    };
    broadcastEvent(EVENTS.SIZECHANGE, width, height);
  };

  bridge.notifyStateChangeEvent = function() {
    if (state === STATES.LOADING) {
      broadcastEvent(EVENTS.INFO, 'Native SDK initialized.');
    }

    broadcastEvent(EVENTS.INFO, 'Set state to ' + stringify(state));
    broadcastEvent(EVENTS.STATECHANGE, state);
  };

  bridge.notifyViewableChangeEvent = function() {
    broadcastEvent(EVENTS.INFO, 'Set isViewable to ' + stringify(isViewable));
    broadcastEvent(EVENTS.VIEWABLECHANGE, isViewable);
  };

  // Constants
  const VERSION = mraid.VERSION = '2.0';

  const STATES = mraid.STATES = {
    LOADING: 'loading',
    DEFAULT: 'default',
    EXPANDED: 'expanded',
    HIDDEN: 'hidden',
    RESIZED: 'resized'
  };

  const EVENTS = mraid.EVENTS = {
    ERROR: 'error',
    INFO: 'info',
    READY: 'ready',
    STATECHANGE: 'stateChange',
    VIEWABLECHANGE: 'viewableChange',
    SIZECHANGE: 'sizeChange'
  };

  const PLACEMENT_TYPES = mraid.PLACEMENT_TYPES = {
    UNKNOWN: 'unknown',
    INLINE: 'inline',
    INTERSTITIAL: 'interstitial'
  };

  // External MRAID state properties
  let expandProperties = {
    width: false,
    height: false,
    useCustomClose: false,
    isModal: true
  };

  let resizeProperties = {
    width: false,
    height: false,
    offsetX: false,
    offsetY: false,
    customClosePosition: 'top-right',
    allowOffscreen: true
  };

  let orientationProperties = {
    allowOrientationChange: true,
    forceOrientation: "none"
  };

  let supportProperties = {
    sms: false,
    tel: false,
    calendar: false,
    storePicture: false,
    inlineVideo: false
  };

  // Default is undefined so that notifySizeChangeEvent can track changes
  let lastSizeChangeProperties;

  let maxSize = {};
  let currentPosition = {};
  let defaultPosition = {};
  let screenSize = {};
  let hasSetCustomClose = false;
  let listeners = {};

  // Internal MRAID state
  let state = STATES.LOADING;
  let isViewable = false;
  let placementType = PLACEMENT_TYPES.UNKNOWN;

  // Helper class for event listeners
  class EventListeners {
    constructor(event) {
      this.event = event;
      this.count = 0;
      this.listeners = {};
    }

    add(func) {
      const id = String(func);
      if (!this.listeners[id]) {
        this.listeners[id] = func;
        this.count++;
      }
    }

    remove(func) {
      const id = String(func);
      if (this.listeners[id]) {
        this.listeners[id] = null;
        delete this.listeners[id];
        this.count--;
        return true;
      }
      return false;
    }

    removeAll() {
      for (const id in this.listeners) {
        if (this.listeners.hasOwnProperty(id)) {
          this.remove(this.listeners[id]);
        }
      }
    }

    broadcast(args) {
      for (const id in this.listeners) {
        if (this.listeners.hasOwnProperty(id)) {
          this.listeners[id].apply(mraid, args);
        }
      }
    }

    toString() {
      const out = [this.event, ':'];
      for (const id in this.listeners) {
        if (this.listeners.hasOwnProperty(id)) out.push('|', id, '|');
      }
      return out.join('');
    }
  }

  // Helper functions
  const broadcastEvent = function() {
    const args = Array.from(arguments);
    const event = args.shift();
    if (listeners[event]) listeners[event].broadcast(args);
  };

  const contains = function(value, array) {
    for (const i in array) {
      if (array[i] === value) return true;
    }
    return false;
  };

  const clone = function(obj) {
    if (obj === null) return null;
    const f = function() {};
    f.prototype = obj;
    return new f();
  };

  const stringify = function(obj) {
    if (typeof obj === 'object') {
      const out = [];
      if (obj.push) {
        // Array
        for (const p in obj) out.push(obj[p]);
        return '[' + out.join(',') + ']';
      } else {
        // Other object
        for (const p in obj) out.push("'" + p + "': " + obj[p]);
        return '{' + out.join(',') + '}';
      }
    } else return String(obj);
  };

  const trim = function(str) {
    return str.replace(/^\s+|\s+$/g, '');
  };

  // Change handlers for events from native SDK
  const changeHandlers = {
    state: function(val) {
      if (state === STATES.LOADING) {
        broadcastEvent(EVENTS.INFO, 'Native SDK initialized.');
      }
      state = val;
      broadcastEvent(EVENTS.INFO, 'Set state to ' + stringify(val));
      broadcastEvent(EVENTS.STATECHANGE, state);
    },

    viewable: function(val) {
      isViewable = val;
      broadcastEvent(EVENTS.INFO, 'Set isViewable to ' + stringify(val));
      broadcastEvent(EVENTS.VIEWABLECHANGE, isViewable);
    },

    placementType: function(val) {
      broadcastEvent(EVENTS.INFO, 'Set placementType to ' + stringify(val));
      placementType = val;
    },

    sizeChange: function(val) {
      broadcastEvent(EVENTS.INFO, 'Set screenSize to ' + stringify(val));
      for (const key in val) {
        if (val.hasOwnProperty(key)) screenSize[key] = val[key];
      }
    },

    supports: function(val) {
      broadcastEvent(EVENTS.INFO, 'Set supports to ' + stringify(val));
      supportProperties = val;
    }
  };

  // Validation functions
  const validate = function(obj, validators, action, merge) {
    if (!merge) {
      // Check to see if any required properties are missing
      if (obj === null) {
        broadcastEvent(EVENTS.ERROR, 'Required object not provided.', action);
        return false;
      } else {
        for (const i in validators) {
          if (validators.hasOwnProperty(i) && obj[i] === undefined) {
            broadcastEvent(EVENTS.ERROR, 'Object is missing required property: ' + i, action);
            return false;
          }
        }
      }
    }

    for (const prop in obj) {
      const validator = validators[prop];
      const value = obj[prop];
      if (validator && !validator(value)) {
        // Failed validation
        broadcastEvent(EVENTS.ERROR, 'Value of property ' + prop + ' is invalid: ' + value, action);
        return false;
      }
    }
    return true;
  };

  const expandPropertyValidators = {
    useCustomClose: function(v) { return (typeof v === 'boolean'); }
  };

  const resizePropertyValidators = {
    width: function(v) {
      return !isNaN(v) && v > 0;
    },
    height: function(v) {
      return !isNaN(v) && v > 0;
    },
    offsetX: function(v) {
      return !isNaN(v);
    },
    offsetY: function(v) {
      return !isNaN(v);
    },
    customClosePosition: function(v) {
      return (typeof v === 'string' &&
        ['top-right', 'bottom-right', 'top-left', 'bottom-left', 'center', 'top-center', 'bottom-center'].indexOf(v) > -1);
    },
    allowOffscreen: function(v) {
      return (typeof v === 'boolean');
    }
  };

  // MRAID API Methods
  mraid.addEventListener = function(event, listener) {
    if (!event || !listener) {
      broadcastEvent(EVENTS.ERROR, 'Both event and listener are required.', 'addEventListener');
    } else if (!contains(event, EVENTS)) {
      broadcastEvent(EVENTS.ERROR, 'Unknown MRAID event: ' + event, 'addEventListener');
    } else {
      if (!listeners[event]) {
        listeners[event] = new EventListeners(event);
      }
      listeners[event].add(listener);
    }
  };

  mraid.close = function() {
    if (state === STATES.HIDDEN) {
      broadcastEvent(EVENTS.ERROR, 'Ad cannot be closed when it is already hidden.',
        'close');
    } else bridge.executeNativeCall(['close']);
  };

  mraid.expand = function(URL) {
    if (!(this.getState() === STATES.DEFAULT || this.getState() === STATES.RESIZED)) {
      broadcastEvent(EVENTS.ERROR, 'Ad can only be expanded from the default or resized state.', 'expand');
    } else {
      let args = ['expand',
        'shouldUseCustomClose', expandProperties.useCustomClose
      ];

      if (URL) {
        args = args.concat(['url', URL]);
      }

      bridge.executeNativeCall(args);
    }
  };

  mraid.getExpandProperties = function() {
    return {
      width: expandProperties.width,
      height: expandProperties.height,
      useCustomClose: expandProperties.useCustomClose,
      isModal: expandProperties.isModal
    };
  };

  mraid.getCurrentPosition = function() {
    return {
      x: currentPosition.x,
      y: currentPosition.y,
      width: currentPosition.width,
      height: currentPosition.height
    };
  };

  mraid.getDefaultPosition = function() {
    return {
      x: defaultPosition.x,
      y: defaultPosition.y,
      width: defaultPosition.width,
      height: defaultPosition.height
    };
  };

  mraid.getMaxSize = function() {
    return {
      width: maxSize.width,
      height: maxSize.height
    };
  };

  mraid.getPlacementType = function() {
    return placementType;
  };

  mraid.getScreenSize = function() {
    return {
      width: screenSize.width,
      height: screenSize.height
    };
  };

  mraid.getState = function() {
    return state;
  };

  mraid.isViewable = function() {
    return isViewable;
  };

  mraid.getVersion = function() {
    return mraid.VERSION;
  };

  mraid.open = function(URL) {
    if (!URL) broadcastEvent(EVENTS.ERROR, 'URL is required.', 'open');
    else bridge.executeNativeCall(['open', 'url', URL]);
  };

  mraid.removeEventListener = function(event, listener) {
    if (!event) {
      broadcastEvent(EVENTS.ERROR, 'Event is required.', 'removeEventListener');
      return;
    }

    if (listener) {
      // If we have a valid event, we'll try to remove the listener from it
      let success = false;
      if (listeners[event]) {
        success = listeners[event].remove(listener);
      }

      // If we didn't have a valid event or couldn't remove the listener from the event, broadcast an error
      if (!success) {
        broadcastEvent(EVENTS.ERROR, 'Listener not currently registered for event.', 'removeEventListener');
        return;
      }

    } else if (!listener && listeners[event]) {
      listeners[event].removeAll();
    }

    if (listeners[event] && listeners[event].count === 0) {
      listeners[event] = null;
      delete listeners[event];
    }
  };

  mraid.setExpandProperties = function(properties) {
    if (validate(properties, expandPropertyValidators, 'setExpandProperties', true)) {
      if (properties.hasOwnProperty('useCustomClose')) {
        expandProperties.useCustomClose = properties.useCustomClose;
      }
    }
  };

  mraid.useCustomClose = function(shouldUseCustomClose) {
    expandProperties.useCustomClose = shouldUseCustomClose;
    hasSetCustomClose = true;
    bridge.executeNativeCall(['usecustomclose', 'shouldUseCustomClose', shouldUseCustomClose]);
  };

  // MRAID 2.0 APIs
  mraid.createCalendarEvent = function(parameters) {
    CalendarEventParser.initialize(parameters);
    if (CalendarEventParser.parse()) {
      bridge.executeNativeCall(CalendarEventParser.arguments);
    } else {
      broadcastEvent(EVENTS.ERROR, CalendarEventParser.errors[0], 'createCalendarEvent');
    }
  };

  mraid.supports = function(feature) {
    return supportProperties[feature];
  };

  mraid.playVideo = function(uri) {
    if (!mraid.isViewable()) {
      broadcastEvent(EVENTS.ERROR, 'playVideo cannot be called until the ad is viewable', 'playVideo');
      return;
    }

    if (!uri) {
      broadcastEvent(EVENTS.ERROR, 'playVideo must be called with a valid URI', 'playVideo');
    } else {
      bridge.executeNativeCall(['playVideo', 'uri', uri]);
    }
  };

  mraid.storePicture = function(uri) {
    if (!mraid.isViewable()) {
      broadcastEvent(EVENTS.ERROR, 'storePicture cannot be called until the ad is viewable', 'storePicture');
      return;
    }

    if (!uri) {
      broadcastEvent(EVENTS.ERROR, 'storePicture must be called with a valid URI', 'storePicture');
    } else {
      bridge.executeNativeCall(['storePicture', 'uri', uri]);
    }
  };

  mraid.setOrientationProperties = function(properties) {
    if (properties.hasOwnProperty('allowOrientationChange')) {
      orientationProperties.allowOrientationChange = properties.allowOrientationChange;
    }

    if (properties.hasOwnProperty('forceOrientation')) {
      orientationProperties.forceOrientation = properties.forceOrientation;
    }

    const args = ['setOrientationProperties',
      'allowOrientationChange', orientationProperties.allowOrientationChange,
      'forceOrientation', orientationProperties.forceOrientation
    ];
    bridge.executeNativeCall(args);
  };

  mraid.getOrientationProperties = function() {
    return {
      allowOrientationChange: orientationProperties.allowOrientationChange,
      forceOrientation: orientationProperties.forceOrientation
    };
  };

  mraid.resize = function() {
    if (!(this.getState() === STATES.DEFAULT || this.getState() === STATES.RESIZED)) {
      broadcastEvent(EVENTS.ERROR, 'Ad can only be resized from the default or resized state.', 'resize');
    } else if (!resizeProperties.width || !resizeProperties.height) {
      broadcastEvent(EVENTS.ERROR, 'Must set resize properties before calling resize()', 'resize');
    } else {
      const args = ['resize',
        'width', resizeProperties.width,
        'height', resizeProperties.height,
        'offsetX', resizeProperties.offsetX || 0,
        'offsetY', resizeProperties.offsetY || 0,
        'customClosePosition', resizeProperties.customClosePosition,
        'allowOffscreen', !!resizeProperties.allowOffscreen
      ];

      bridge.executeNativeCall(args);
    }
  };

  mraid.getResizeProperties = function() {
    return {
      width: resizeProperties.width,
      height: resizeProperties.height,
      offsetX: resizeProperties.offsetX,
      offsetY: resizeProperties.offsetY,
      customClosePosition: resizeProperties.customClosePosition,
      allowOffscreen: resizeProperties.allowOffscreen
    };
  };

  mraid.setResizeProperties = function(properties) {
    if (validate(properties, resizePropertyValidators, 'setResizeProperties', true)) {
      const desiredProperties = ['width', 'height', 'offsetX', 'offsetY', 'customClosePosition', 'allowOffscreen'];

      for (let i = 0; i < desiredProperties.length; i++) {
        const propname = desiredProperties[i];
        if (properties.hasOwnProperty(propname)) {
          resizeProperties[propname] = properties[propname];
        }
      }
    }
  };

  // Calendar helpers
  const CalendarEventParser = {
    initialize: function(parameters) {
      this.parameters = parameters;
      this.errors = [];
      this.arguments = ['createCalendarEvent'];
    },

    parse: function() {
      if (!this.parameters) {
        this.errors.push('The object passed to createCalendarEvent cannot be null.');
      } else {
        this.parseDescription();
        this.parseLocation();
        this.parseSummary();
        this.parseStartAndEndDates();
        this.parseReminder();
        this.parseRecurrence();
        this.parseTransparency();
      }

      const errorCount = this.errors.length;
      if (errorCount) {
        this.arguments.length = 0;
      }

      return (errorCount === 0);
    },

    parseDescription: function() {
      this._processStringValue('description');
    },

    parseLocation: function() {
      this._processStringValue('location');
    },

    parseSummary: function() {
      this._processStringValue('summary');
    },

    parseStartAndEndDates: function() {
      this._processDateValue('start');
      this._processDateValue('end');
    },

    parseReminder: function() {
      const reminder = this._getParameter('reminder');
      if (!reminder) {
        return;
      }

      if (reminder < 0) {
        this.arguments.push('relativeReminder');
        this.arguments.push(parseInt(reminder) / 1000);
      } else {
        this.arguments.push('absoluteReminder');
        this.arguments.push(reminder);
      }
    },

    parseRecurrence: function() {
      const recurrenceDict = this._getParameter('recurrence');
      if (!recurrenceDict) {
        return;
      }

      this.parseRecurrenceInterval(recurrenceDict);
      this.parseRecurrenceFrequency(recurrenceDict);
      this.parseRecurrenceEndDate(recurrenceDict);
      this.parseRecurrenceArrayValue(recurrenceDict, 'daysInWeek');
      this.parseRecurrenceArrayValue(recurrenceDict, 'daysInMonth');
      this.parseRecurrenceArrayValue(recurrenceDict, 'daysInYear');
      this.parseRecurrenceArrayValue(recurrenceDict, 'monthsInYear');
    },

    parseTransparency: function() {
      const validValues = ['opaque', 'transparent'];

      if (this.parameters.hasOwnProperty('transparency')) {
        const transparency = this.parameters.transparency;
        if (contains(transparency, validValues)) {
          this.arguments.push('transparency');
          this.arguments.push(transparency);
        } else {
          this.errors.push('transparency must be opaque or transparent');
        }
      }
    },

    parseRecurrenceArrayValue: function(recurrenceDict, kind) {
      if (recurrenceDict.hasOwnProperty(kind)) {
        const array = recurrenceDict[kind];
        if (!array || !(array instanceof Array)) {
          this.errors.push(kind + ' must be an array.');
        } else {
          const arrayStr = array.join(',');
          this.arguments.push(kind);
          this.arguments.push(arrayStr);
        }
      }
    },

    parseRecurrenceInterval: function(recurrenceDict) {
      if (recurrenceDict.hasOwnProperty('interval')) {
        const interval = recurrenceDict.interval;
        if (!interval) {
          this.errors.push('Recurrence interval cannot be null.');
        } else {
          this.arguments.push('interval');
          this.arguments.push(interval);
        }
      } else {
        // If a recurrence rule was specified without an interval, use a default value of 1
        this.arguments.push('interval');
        this.arguments.push(1);
      }
    },

    parseRecurrenceFrequency: function(recurrenceDict) {
      if (recurrenceDict.hasOwnProperty('frequency')) {
        const frequency = recurrenceDict.frequency;
        const validFrequencies = ['daily', 'weekly', 'monthly', 'yearly'];
        if (contains(frequency, validFrequencies)) {
          this.arguments.push('frequency');
          this.arguments.push(frequency);
        } else {
          this.errors.push('Recurrence frequency must be one of: "daily", "weekly", "monthly", "yearly".');
        }
      }
    },

    parseRecurrenceEndDate: function(recurrenceDict) {
      const expires = recurrenceDict.expires;
      if (!expires) {
        return;
      }
      this.arguments.push('expires');
      this.arguments.push(expires);
    },

    _getParameter: function(key) {
      if (this.parameters.hasOwnProperty(key)) {
        return this.parameters[key];
      }
      return null;
    },

    _processStringValue: function(kind) {
      if (this.parameters.hasOwnProperty(kind)) {
        const value = this.parameters[kind];
        this.arguments.push(kind);
        this.arguments.push(value);
      }
    },

    _processDateValue: function(kind) {
      if (this.parameters.hasOwnProperty(kind)) {
        const dateString = this._getParameter(kind);
        this.arguments.push(kind);
        this.arguments.push(dateString);
      }
    }
  };
}());