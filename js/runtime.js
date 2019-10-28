"use strict";

// Requires Tokenizer, Parser, Machine, Executor
// We don't require() them here because we send raw bundle to browser

class Runtime {
  constructor(logFunc) {
    this._queue = [];
    this._varDict = {}; // base dictionary
    this.log = logFunc ? logFunc : console.log;
    this._flowing = true; // automatically executing queued items
  }
  buildProcsMap(lines) {
    this._e.buildProcsMap(lines);
  }

  /**
     Item queue execution

     Items are event records that can make changes to the state model.
     You simply enqueue() each item. The Runtime automatically unshifts
     items from the queue and executes them.

         Name    Additional properties
         ------- ----------------------
         UPDATE  lines
         TIMER   lines
         HANDLER procName, varDict

     On enqueueing, each item is immediately scheduled for execution,
     unless the setFlowing() setting is set to false.

   */

  enqueue(item) {
    this._queue.push(item);
    this.flowIfNeeded();
  }
  getFlowing() { return this._flowing; }
  setFlowing(onOff) {
    this._flowing = onOff;
    this.flowIfNeeded();
  }
  doOne() {
    if (this._queue.length > 0) {
      const item = this._queue.unshift();
      this.execute(item);
    }
  }
  flowIfNeeded() {
    if (this._flowing && this._queue.length > 0) {
      setImmediate(() => this.doOne());
    }
  }
  getNumItems() {
    return this._queue.length;
  }

  // get, set base dictionary entries
  getVar(name) { return this._varDict[name]; }
  setVar(name, value) { this._varDict.name = value; }
  
  /**
     execProc() and execLines()

     Take optional varDictFunc argument to define some overriding variables.
     Use the makeVarDictFunc() utility function for convenience.
   */

  execProc(name, vdf) {
    const result = this._e.execProc(name, vdf);
    if (result) {
      this.log(result);
    }
  }
  execLines(lines, vdf) {
    const result = this._e.runLines(lines, vdf);
    if (result) { this.log(result); }
  }

  getProcsMap() {
    return this._e.procs;
  }
  setExecutor(e) { this._e = e; }
  setMc(mc) {
    this._e.setMc(mc);
  }
  getMc() { return this._e.mc; }

  // ----------------- private functions below this point
  /**
     getVarDictFunc() - return a function suitable for VAR expansion

     Optionally takes a higher-priority superposedFunc. If the
     superposedFunc() returns null, then the base varDict is used.
   */
  getVarDictFunc(superposedFunc) {
    if (! this._varDictFunc) { // first time: set member
      this._varDictFunc = name => {
        if (this._varDict.hasOwnProperty(name)) {
          return {name: 'WORD', value: this._varDict[name]};
        } else {
          return null;
        }
      };
    }
    if (! superposedFunc) {
      return this._varDictFunc;
    } else {
      return name => {
        const result = superposedFunc(name);
        if (result) { return result; }
        else return this._varDictFunc(name);
      };
    }
  }

  execute(item) {
    if (item.name === 'UPDATE' || item.name === 'TIMER') {
      this.execLines(item.lines);
      this.execProc("RENDER");
    } else if (item.name === 'HANDLER') {
      this.execProc(item.procName, this.makeVarDictFunc(item.varDict));
      this.execProc("RENDER");
    }
  }
  /**
     makeVarDictFunc() - Utility function to use temporary dictionary

     Pass this as second argument to execProc or execLines
   */
  makeVarDictFunc(tempVarDict) {
    return this.getVarDictFunc( name => {
      if (tempVarDict.hasOwnProperty(name)) {
        return tempVarDict[name];
      } else {
        return null;
      }
    });
  }


}

module.exports = Runtime;
