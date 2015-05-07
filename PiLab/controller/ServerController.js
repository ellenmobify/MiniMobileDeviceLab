'use strict';

var ConfigModel = require('./../model/ConfigModel.js');
var CurrentURLModel = require('./../model/CurrentURLModel.js');
var LoopSettingsModel = require('./../model/LoopSettingsModel.js');
var TestController = require('./TestController.js');
var config = require('./../config.json');
var Firebase = require('firebase');
var chalk = require('chalk');

function ServerController() {
  var configModel;
  var currentUrlModel;
  var loopSettingsModel;
  var loopIndex = 0;
  var loopTimeoutId;
  var testController;

  var firebase = new Firebase(config.firebaseUrl);
  firebase.authWithCustomToken(config.firebaseKey, function(err, authToken) {
    if (err) {
      throw new Error(err);
    }

    testController = new TestController(firebase);
    loopSettingsModel = new LoopSettingsModel(firebase);
    currentUrlModel = new CurrentURLModel(firebase);
    configModel = new ConfigModel(firebase);

    configModel.on('UseModeChange', function(mode) {
      if (mode === 'loop') {
        this.startLooping();
      } else {
        this.stopLooping();
      }
    }.bind(this));

    configModel.on('GlobalModeChange', function(mode) {
      if (mode === 'config') {
        this.stopLooping();
      } else {
        if (configModel.getUseMode() === 'loop') {
          this.startLooping();
        }
      }
    }.bind(this));

    currentUrlModel.on('URLChange', function(url) {
      var testController = this.getTestController();
      testController.performTests(url);
    }.bind(this));
  }.bind(this));

  this.getFirebase = function() {
    return firebase;
  };

  this.getCurrentUrlModel = function() {
    return currentUrlModel;
  };

  this.getLoopSettingsModel = function() {
    return loopSettingsModel;
  };

  this.getLoopIndex = function() {
    return loopIndex;
  };

  this.setLoopIndex = function(newIndex) {
    loopIndex = newIndex;
  };

  this.getLoopTimeoutId = function() {
    return loopTimeoutId;
  };

  this.setLoopTimeoutId = function(newId) {
    loopTimeoutId = newId;
  };

  this.getConfigModel = function() {
    return configModel;
  };

  this.getTestController = function() {
    return testController;
  };
}

ServerController.prototype.startLooping = function() {
  this.log('Start Looping');

  this.performLoopTick();
};

ServerController.prototype.performLoopTick = function() {
  var loopSettingsModel = this.getLoopSettingsModel();
  var loopUrls = loopSettingsModel.getLoopUrls();
  var loopIndex = loopSettingsModel.getLoopIndex();
  if (!loopUrls || loopUrls.length === 0 || loopIndex === null) {
    return setTimeout(this.performLoopTick.bind(this), 500);
  }

  var timeoutMs = loopSettingsModel.getLoopIntervalMs();

  // Clear any current pending timeout
  var currentTimeoutId = this.getLoopTimeoutId();
  if (currentTimeoutId) {
    clearTimeout(currentTimeoutId);
  }

  this.getCurrentUrlModel().setNewUrl(loopUrls[loopIndex]);

  var newTimeoutId = setTimeout(this.performLoopTick.bind(this), timeoutMs);
  this.setLoopTimeoutId(newTimeoutId);
  loopSettingsModel.setLoopIndex(loopIndex + 1);
};

ServerController.prototype.stopLooping = function() {
  console.log('Stop Looping');
  var currentTimeoutId = this.getLoopTimeoutId();
  if (currentTimeoutId) {
    clearTimeout(currentTimeoutId);
  }
  this.setLoopTimeoutId(null);
};

// TODO: Expose this via some sort of API or front end
ServerController.prototype.setStaticUrl = function(url) {
  var configModel = this.getConfigModel();
  if (configModel.getMode() === 'loop') {
    console.log('Can\'t set the url while the lab is looping');
    return;
  }

  this.getCurrentUrlModel().setNewUrl(url);
};

ServerController.prototype.log = function(msg, arg) {
  console.log(chalk.green('ServerController: ') + msg, arg);
};

ServerController.prototype.error = function(msg, arg) {
  console.log(chalk.green('ServerController: ') + chalk.red(msg), arg);
};

module.exports = ServerController;