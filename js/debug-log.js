"use strict";
/**
   @module(DebugLog) - efficiently control debugging per JS file

   Example in your JS file "my-shop.js":

   const logger = {};
   require('./debug-log.js').registerLogger("my-shop", logger);

   In your code, sprinkle debugging statements like:
      logger.log("three bars of soap left");
      logger.err("error: my shop has run out of soap");

   The registerLogger() call creates two member functions in "logger":

   The logger.log() call prints only in debugging mode.
   the logger.err() call always prints.

   The user can turn on debugging for "my-shop" at any time; if they
   do, then the "logger.log" function will be replaced with one that
   prints output to the console, including the file name.

 */


// this._debugMap: are we debugging this file? true/false
// this._map: the logger object, having a "log" function.
class DebugLog {
  constructor() {
    this._map = new Map();
    this._debugMap = new Map();
    if (process.env["DEBUG"]) {
      const arr = process.env["DEBUG"].split(/\s+|\s*,\s*/);
      console.log(`debug: ${JSON.stringify(arr.join(" "))}`);
      arr.forEach( i => this.startDebugging(i) );
    }
  }
  registerLogger(fileName, logger) {
    if (! logger) {
      throw new Error(`registerLogger ${fileName} - no logger!`);
    } else {
      this._map.set(fileName, logger);
      this._setLoggerFunction(fileName);
    }
  }

  _setLoggerFunction(fileName) {
    if (this.isDebugging(fileName)) {
      this._map.get(fileName).log = (str) => {
	const d = new Date();
	const f = fileName;
	const msg = `[${d.toISOString()}] ${f}: ${str}`;
	if (this._out) {
	  this._out.write(msg + "\n");
	} else {
	  console.log(msg);
	}
      };
    } else {
      this._map.get(fileName).log = (str) => {};
    }
  }

  isDebugging(fileName) {
    return this._debugMap.has(fileName);
  }

  startDebugging(fileName) {
    if (! this._debugMap.has(fileName)) {
      this._debugMap.set(fileName, "debug");
      if (this._map.has(fileName)) {
	this._setLoggerFunction(fileName);
      }
      return true;
    } else {
      return false;
    }
  }
  stopDebugging(fileName) {
    if (! this._debugMap.has(fileName)) {
      return false;
    } else {
      this._debugMap.delete(filename);
      this._setLoggerFunction(fileName);
      return true;
    }
  }
  setOut(writable) {
    this._out = writable;
  }
}

module.exports = new DebugLog();

