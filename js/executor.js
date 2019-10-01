"use strict";

// requires Machine and Parser and Tokenizer

class Executor {

  constructor(mc, t, p, logfunc) {
    // catch bug where machine is not the second arg
    this.mc = mc;
    this.t = t ? t : new Tokenizer;
    this.log = logfunc ? logfunc : console.log;
    this.p = p ? p : new Parser;
    if (! mc.STATE_TREE) { this.log(`first arg is not a machine`); }
    this._commands = new Map();
    this.addBasicCommandSet();
  }

  setMc(mc) {
    this.mc = mc;
  }
  
  buildProcsMap(lines) {
    const result = this.t.tokenize(lines);
    if (result[0]) {
      this.log(`buildProcsMap failed: ${result[0]}`);
      return new Map();
    }
    const tla = result[1];
    this.procs = this.p.buildProcs(tla);
  }

  execProc(name) {
    const proc = this.procs.get(name);
    if (! proc) {
      this.log(`proc ${name} not found`);
    } else if (typeof proc === 'string') { // error message
      this.log(proc);
    } else {
      proc.forEach( block => {
        const errMsg = this.execBlock(block);
        if (errMsg) {
          this.log(`proc ${name}: ${errMsg}`);
        } else {
          this.log(`proc ${name}: OK`);
        }
      });
    }
  }

  /**
     execBlock - return null or errMsg
   */
  execBlock(block) {
    if (block.type === 'PLAIN') {
      block.tla.forEach( tokArray => {
        let errMsg, result;
        [errMsg, result] = this.evaluate(tokArray);
        if (errMsg) {
          return errMsg;
        } else {
          return null;
        }
      });
    } else if (block.type === 'WITH') {
      const clauses = this.parseWithClauses(block.header);
      const unis = this.getAllUnifications(clauses);
      if (! Array.isArray(unis)) { // error message
        return unis;
      }
      // unroll the WITH block into "results", then expand macros.
      let results = [];
      for (let i=0; i<unis.length; i++) {
        let mappedTla;
        mappedTla = block.tla.filter( list => list.length > 0).
          map( list => {
            let num, result;
            [num, result] = this.p.substVars(list, varName => {
              if (unis[i].hasOwnProperty(varName)) {
                return {name: 'WORD', value: unis[i][varName]};
              } else {
                return null;
              }
            });
            const rendered = this.t.renderTokens(result);
            this.log(rendered);
            return rendered;
          });
        mappedTla.forEach( tla => results.push(tla) );
      }
      results.forEach( tokArray => {
        let errMsg, result;
        [errMsg, result] = this.evaluate(tokArray);
        if (errMsg) {
          return errMsg;
        } else {
          return null;
        }
      });
    } else if (block.type === 'ON') {
      return `ON not implemented`;
    } else {
      return `bad block type: ${block.type}`;
    }
  }

  parseWithClauses(header) {
    let arr = [];
    header.forEach( tokArr => {
      if (tokArr.length <= 0) { return; }
      if (tokArr[0].name !== 'KEYWORD') {
        this.log(`bad WITH clause: ${tokArr[0].name}`);
        return;
      }
      const type = tokArr[0].value;
      const pathPattern = this.getPathPattern(tokArr.slice(1));
      arr.push({type: type, pathPattern: pathPattern});
    });
    return arr;
  }

  // getPathPattern - return string form of path pattern
  getPathPattern(tokList) {
    // TODO not written - maybe renderTokens should do it
    return this.t.renderTokens(tokList);
  }


  /*
    getAllUnifications - given a sequence of clauses, return an array
    of all the substitutions that will satisfy them.
   */
  getAllUnifications(clauses) {
    let sArr = [{}];
    for (let i=0; i<clauses.length; i++) {
      let tempArr = [];
      for (let j=0; j<sArr.length; j++) {
        const result = this.expandUnification(sArr[j], tempArr, clauses[i]);
        if (result) {
          return(`ERROR expanding |${clauses[i]}|: ${result}`);
        }
      }
      sArr = tempArr;
    }
    return sArr;
  }

  /**
     expandUnification - take existing substitution and a clause.
     Add all unique expanded unifications to the given array.
     return null on success, or error message
   */
  expandUnification(subst, arr, clause) {
    const me = this;
    const partials = this.computeUnification(subst, clause.type, clause.pathPattern);
    if (! Array.isArray(partials)) { // error message
      return partials;
    }
    for (let i=0; i<partials.length; i++) {
      let p = partials[i];
      for (let k of Object.keys(subst)) {
        p[k] = subst[k];
      }
      addIfUnique(arr, p);
    }
    return null;

    function addIfUnique(list, item) {
      const pos = list.findIndex( e => isEqual(e, item) );
      // me.log(`addIfUnique: ${JSON.stringify(list)}, ${JSON.stringify(item)}: pos = ${pos}`);
      if (pos < 0) {
        list.push(item);
        return true;
      } else {
        return false;
      }
    }

    function isEqual(a, b) {
      const keys = Object.keys(a);
      for (let i=0; i< keys.length; i++) {
        const k = keys[i];
        if (! b.hasOwnProperty(k)) {
          return false;
        }
        const equal = a[k] === b[k];
        if (! equal) {
          return false;
        }
      }
      return true;
    }
  }

  /**
     computeUnification - take existing substitution, allOrCurrent,
     and a path string as typed by the user.  Return array of new
     substitution fragments or error
   */
  computeUnification(subst, allOrCurrent, pathString) {
    const varLits = this.getVarLitTokens(pathString);
    let varLitsCopy = []; // copy with substitutions.
    for (let i=0; i<varLits.length; i++) {
      const tok = varLits[i];
      if (tok.hasOwnProperty('VAR')) {
        const vname = tok.VAR;
        if (subst.hasOwnProperty(vname)) { // existing name: copy value
          varLitsCopy.push({LIT: subst[vname]});
        } else {   // new name: good.
          varLitsCopy.push(tok);
        }
      } else {
        varLitsCopy.push(tok);
      }
    }
    // any vars in this clause are new.
    return this.unify(varLitsCopy, allOrCurrent);
  }

  // unify(varLitTokens, allOrCurrent) -- return substitution list
  unify(varLitTokens, allOrCurrent) {
    if (!allOrCurrent || !allOrCurrent.match(/^ALL|CURRENT|NONCURRENT$/)) {
      this.log(`expecting ALL or (NON)CURRENT: got ${allOrCurrent}`);
      return;
    }
    let testPaths;
    if (allOrCurrent === "ALL") {
      testPaths = this.mc.getAllPaths();
    } else if (allOrCurrent === "CURRENT") {
      testPaths = this.mc.getCurrentPaths();
    } else { // NONCURRENT
      const temp = this.mc.getCurrentPaths();
      testPaths = this.mc.getAllPaths()
        .filter(p => ! temp.includes(p) );
    }

    let outArr = [];
    testPaths.forEach( p => {
      const obj = unifyExpression(varLitTokens, p);
      if (obj) {
        outArr.push(obj);
      }
    });
    return outArr;

    function unifyExpression(arr, aPath) {
      let subst = {};
      let p = aPath;
      for (let i=0; i<arr.length; i++) {
        if (arr[i].hasOwnProperty("LIT")) {
          if (! p.startsWith(arr[i].LIT)) {
            return null;
          } else {
            p = p.slice(arr[i].LIT.length);
          }
        } else if (arr[i].hasOwnProperty("VAR")) {
          const m = p.match(/^[a-z0-9-]+/);
          if (m) {
            subst[arr[i].VAR] = m[0];
            p = p.slice(m[0].length);
          } else {
            return null;
          }
        } else if (arr[i].hasOwnProperty("WILDCARD")) {
          const m = p.match(/^[a-z0-9-]+/);
          if (m) {
            p = p.slice(m[0].length);
          } else {
            return null;
          }
        } else {
          return null;
        }
      }
      return subst;
    }
  }

  /**
     getVarLitTokens() - split a path expression into VAR and LIT tokens

     VAR token = a variable name that will be used to match a word
     WILDCARD token = will be used to match a word to be ignored
     LIT token = a series of words-and-separators that must match exactly.
   */
  getVarLitTokens(pathExpr) {
    const me = this;
    let arr = [];
    if (! pathExpr) { return arr; }
    pathExpr = pathExpr.trim();
    if (pathExpr.length <= 0) { return arr; }

    let s = pathExpr;
    do {
      s = splitExpression(s, arr);
    } while(s && s.length > 0);
    return arr;

    function splitExpression(pathExpr, arr) {
      pathExpr = pathExpr.trim();
      let m;
      m = pathExpr.match(/^\*/);
      if (m) {
        arr.push({WILDCARD: pathExpr.slice(0,m[0].length)});
        return pathExpr.slice(m[0].length);
      }
      m = pathExpr.match(/^[A-Z]+/);
      if (m) {
        arr.push({VAR: pathExpr.slice(0,m[0].length)});
        return pathExpr.slice(m[0].length);
      }
      m = pathExpr.match(/^([a-z0-9-.\/]+)(.*)/);
      if (m) {
        arr.push({LIT: m[1]});
        return m[2];
      } else {
        me.log(`unify: bad prefix: |${pathExpr}|`);
        return "";
      }
    }
  }



  consumeWithPattern(tokList) {
    if (tokList.length < 1) { return -1; }
    if (tokList[0].name === 'KEYWORD' &&
        tokList[0].value.match(/^ALL|CURRENT|NONCURRENT$/)) {
      const num = this.consumePathPattern(tokList.slice(1));
      return num+1;
    } else {
      return -1;
    }
  }

  // consumePathPattern - like consumePath, but allow VARs, WILDCARD
  consumePathPattern(tokList) {
    if (tokList.length === 0) { return 0; }
    for (let i=0; i<tokList.length; i=i+2) { // count by two
      if (i === tokList.length -1) { return i; } // only one token left
      if (tokList[i].name === 'DOT' || tokList[i].name === 'SLASH') {
        if (tokList[i+1].name !== 'WORD' &&
            tokList[i+1].name !== 'KEYWORD' &&
           tokList[i+1].name !== 'ASTERISK') { return i; }
      } else {
        return i;
      }
    }
    return tokList.length;
  }



  // getEvalFunc - return a function suitable to pass in to
  // this.t.expand().

  getEvalFunc() {
    return (tokens => this.evaluate(tokens));
  }

  // getEvalFuncVarContext - return a function suitable to pass in to
  // this.t.expand(). This version takes a "varContext" that can
  // resolve a set of capitalized names (COMMAND token values) to
  // a different token.
  // The "varContext" provides one token per capitalized name.
  getEvalFuncVarContext(varContext) {
    const me = this;
    return (tokens => {
      let newTokList = tokens.map( e => {
        if (e.name === 'COMMAND' &&
            varContext.hasOwnProperty(e.value) &&
            varContext[e.value] &&
            varContext[e.value].match(/^[a-z0-9-]+$/)
           ) {
          return {name: 'WORD', value: varContext[e.value]};
        } else {
          return e;
        }
      });
      return me.evalFunc(newTokList);
    });
  }

  /**
     @function(evaluate) - take token array and return [ errMsg, results ]
  */
  evaluate(tokenArray) {
    if (tokenArray.length === 0) {
      return [ null, null ];
    }
    if (tokenArray.length === 1) {
      return [ null, tokenArray[0] ];
    }
    // Look for macros; find innermost macro.
    let [b, e] = this.innerBeginEnd(tokenArray);

    if (b < 0 && e < 0) { // No macros found.
      if (tokenArray[0].name === 'KEYWORD') {
        const rec = this._commands[tokenArray[0].value];
        if (rec) {
          return rec.fn(tokenArray.slice(1));
        } else { // anything else evaluates as itself.
          this.log(`No such command: ${tokenArray[0].value}`);
          return [null, tokenArray];
        }
      }
    }
    if (b >= 0 && e >= 0) {
      // Expand innermost macro and re-evaluate
      let subEval = this.evaluate(tokenArray.slice(b+1, e));
      if (subEval[0]) { // error
        return subEval;
      } else {
        let newArray = tokenArray.slice(0, b);
        // subEval could be single token or an array
        if (subEval[1].hasOwnProperty('length')) {
          subEval[1].forEach( tok => newArray.push(tok) );
        } else {
          newArray.push(subEval[1]);
        }
        tokenArray.slice(e+1, tokenArray.length)
          .forEach( tok => newArray.push(tok));
        return this.evaluate(newArray);
      }
    }
    if (e < 0) {
      return [`BEGIN without END`, tokenArray];
    }

  }

  // innerBeginEnd - return [BEGIN, END] indexes
  // We find the last of the innermost macros in the token array.
  innerBeginEnd(tokenArray) {
    for (let i= tokenArray.length-1; i>= 0; i--) {
      if (tokenArray[i].name === 'END') {
        for (let j=i; j>= 0; j--) {
          if (tokenArray[j].name === 'BEGIN') {
            return [j, i];
          }
        }
        return [-1, i];
      }
    }
    return [-1, -1];
  }

  /**
     addBasicCommandSet() - add records for interpreting commands
     Each record is: { cmd, func(args) }
     The args are an array of tokens. Func should return [null, result]
  */

  addBasicCommandSet() {
    const records = [
      {cmd: 'CURRENT', fn: args => this.currentCmd(args)},
      {cmd: 'DATAW', fn: args => this.datawCmd(args)},
      {cmd: 'DATA', fn: args => this.dataCmd(args)},
      {cmd: 'DEF', fn: args => this.defCmd(args)},
      {cmd: 'SET', fn: args => this.setCmd(args)},
      {cmd: 'DEL', fn: args => this.delCmd(args)},

      {cmd: 'MAP', fn: args => this.mapCmd(args)},
      {cmd: 'ATTACH', fn: args => this.attachCmd(args)},
    ];
    this.addCommands(records);
  }

  addCommands(arr) {
    arr.forEach( rec => this._commands[rec.cmd] = rec );
  }

  defCmd(args) {
    if (this.p.ifNextCommand(args, 0, "CON") ||
        this.p.ifNextCommand(args, 0, "ALT")) {
      const type = args[0].value;
      const sep = type === 'CON' ? '.' : '/';
      let options = {PARENT: "PATH", CHILDREN: "WORDS"};
      let result = this.p.parseRequiredTokens(args.slice(1), options);
      if (result[0]) { return [ `DEF ${type}: ${result[0]}`, args ]; }
      const struct = result[1];
      if (type === 'CON' && this.mc.isVariableParent(struct.PARENT)) {
        return [`DEF CON ${struct.PARENT}: already alt-parent`, args];
      }
      if (type === 'ALT' && this.mc.isConcurrentParent(struct.PARENT)) {
        return [`DEF ALT ${struct.PARENT}: already concurrent parent`, args];
      }
      const children = struct.CHILDREN;
      let arr =  children.map(child => `P ${struct.PARENT}${sep}${child}`);
      result = this.mc.interpret(arr);
      if (result) {
        return [`DEF ${type} ${struct.PARENT}: ${result}`, args];
      } else {
        return [null, null];
      }
    } else if (this.p.ifNextCommand(args, 0, "TOP")) {
      let options = {CHILDREN: "WORDS"};
      let result = this.p.parseRequiredTokens(args.slice(1), options);
      if (result[0]) { return [ `DEF TOP: ${result[0]}`, args ]; }
      const struct = result[1];
      const children = struct.CHILDREN;
      let arr =  children.map(child => `P .${child}`);
      result = this.mc.interpret(arr);
      if (result) {
        return [`DEF TOP CHILDREN: ${result}`, args];
      } else {
        return [null, null];
      }
    } else {
      return [`DEF: must be CON or ALT or TOP`, args];
    }
  }

  setCmd(args) {
    if (this.p.ifNextCommand(args, 0, "DATAW")) {
      let options = {PATH: "PATH", DATA: "WORD"};
      let result = this.p.parseRequiredTokens(args.slice(1), options);
      if (result[0]) { return [ `SET DATAW: ${result[0]}`, args ]; }
      const struct = result[1];
      if (! this.mc.exists(struct.PATH)) {
        return [`SET DATAW ${struct.PATH}: no such path`, args];
      }
      if (! this.mc.isLeaf(struct.PATH)) {
        return [`SET DATAW ${struct.PATH}: not a leaf`, args];
      } else if (! this.mc.isDataLeaf(struct.PATH)) {
        return [`SET DATAW ${struct.PATH}: not a data leaf`, args];
      }
      result = this.mc.interpretOp(`D ${struct.PATH} ${struct.DATA}`);
      if (result) {
        return [`SET DATAW ${struct.PATH}: ${result}`, args];
      } else {
        return [null, null];
      }
    } else if (this.p.ifNextCommand(args, 0, "CURRENT")) {
      let options = {PARENT: "PATH", CHILD: "WORD"};
      let result = this.p.parseRequiredTokens(args.slice(1), options);
      if (result[0]) { return [ `SET CURRENT: ${result[0]}`, args ]; }
      const struct = result[1];
      if (this.mc.isConcurrentParent(struct.PARENT)) {
        return [`SET CURRENT ${struct.PARENT} is con parent`, args];
      }
      const word = struct.WORD;
      result = this.mc.interpretOp(`C ${struct.PARENT} ${struct.CHILD}`);
      if (result) {
        return [`SET CURRENT ${struct.PARENT}: ${result}`, args];
      } else {
        return [null, null];
      }
      return [`SET: must be DATAW or CURRENT`, args];
    }
  }

  currentCmd(args) {
    if (args.length < 1) {
      return [`CURRENT needs at least 1 arg`, null];
    }
    const mPath = this.t.composePath(args);
    if (! mPath) {
      return [ `CURRENT: bad syntax for path: ${this.t.renderTokens(args)}`, null ];
    }
    if (this.mc.exists(mPath)) {
      if (this.mc.isVariableParent(mPath)) {
        const curr = this.mc.getCurrentChildName(mPath);
        if (curr) {
          return [ null, {name: 'WORD', value: curr} ];
        } else {
          return [`CURRENT: no current child`, null];
        }
      } else {
        return [`CURRENT: not a variable parent`, null];
      }
    } else {
      return [ `CURRENT: no such path: ${mPath}`, null ];
    }
  }

  datawCmd(args) {
    if (args.length < 1) {
      return [`DATAW needs at least 1 arg`, null];
    }
    const mPath = this.t.composePath(args);
    if (! mPath) {
      return [ `DATAW: bad syntax for path: ${this.t.renderTokens(args)}`,
               null ];
    }
    if (this.mc.exists(mPath)) {
      if (this.mc.isDataLeaf(mPath)) {
        const data = this.mc.getData(mPath);
        if (data) {
          if (data.trim().match(/^\d+$/)) {
            return [ null, {name: 'NUMBER', value: data.trim()} ];
          } else if (data.trim().match(/^[a-z][a-z0-9-]+$/)) {
            return [ null, {name: 'WORD', value: data.trim()} ];
          } else {
            return [ null, {name: 'STRING', value: data} ];
          }
        } else {
          return [ null, {name: 'STRING', value: ""} ];
        }
      } else {
        return [`DATAW: not a data leaf`, null];
      }
    } else {
      return [ `DATAW: no such path: ${mPath}`, null ];
    }
  }

  dataCmd(args) {
    if (args.length < 1) {
      return [`DATA needs at least 1 arg`, null];
    }
    const mPath = this.t.composePath(args);
    if (! mPath) {
      return [ `DATA: bad syntax for path: ${this.t.renderTokens(args)}`,
               null ];
    }
    if (this.mc.exists(mPath)) {
      if (this.mc.isDataLeaf(mPath)) {
        const data = this.mc.getData(mPath);
        if (data) {
          return [ null, {name: 'STRING', value: data} ];
        } else {
          return [ null, {name: 'STRING', value: ""} ];
        }
      } else {
        return [`DATA: not a data leaf`, null];
      }
    } else {
      return [ `DATA: no such path: ${mPath}`, null ];
    }
  }

  mapCmd(args) {
    if (args.length < 1) {
      return [`MAP needs at least 1 arg`, null];
    }
    if (! this.p.ifNextCommand(args, 0, "ALT0")) {
      return ["MAP requires ALT0", null];
    }
    const options = {PARENT: "PATH", ELEMENTID: "STRING"};
    const result = this.p.parseRequiredTokens(args.slice(1), options);
    if (result[0]) { return [ `MAP ALT0: ${result[0]}`, args ]; }
    const struct = result[1];
    const p = struct.PARENT;
    if (! this.mc.isVariableParent(p)) {
      return [`MAP ALT0 PATH: bad path: |${p}|`, args];
    }
    const elem = document.getElementById(struct.ELEMENTID);
    if (! elem) {
      return [`MAP: ELEMENTID: no such element: ${struct.ELEMENTID}`, null];
    }
    // If the parent path is not current, just turn off the element.
    if (this.mc.getCurrentPaths().indexOf(p) < 0) {
      elem.setAttribute("hidden", "");
      return [null, null];
    }
    // Make sure the element has twice as many children as the path.
    // Each sub-state has two corresponding child elements.
    // We will turn on the right child for each sub-state.
    const children = this.mc.getState(p).cc;
    const num = elem.children.length;
    if (num !== 2*(children.length)) {
      return [`MAP: element ${struct.ELEMENTID} has ${num} children`, null];
    }
    // Use child elem 0 if sub-state 0 is current, else use child elem 1.
    for (let i=0; i<children.length; i++) {
      if (i === this.mc.getState(p).curr) {
        elem.children[i*2].removeAttribute("hidden");
        elem.children[i*2+1].setAttribute("hidden", "");
      } else {
        elem.children[i*2].setAttribute("hidden", "");
        elem.children[i*2+1].removeAttribute("hidden");
      }
    }
    return [null, null];
  }

  /**
     Token manipulation utilities
     -----------------------------------------------------------
   */

  /**
     substVars - take a token array and expand any {VAR}s

     Returns [num, outArray], where:
        - num is the number of variables expanded successfully.
        - outArray is the result of the substitution.

     The function f() should take the "VAR" portion and return
     a token or array of tokens.
     If it does not have an expansion, it should return
     null. The expandVars function will keep the {VAR} string
     intact in the result, and not count that variable as
     successfully expanded.

     The caller might want to call this function again if there
     is a possibility that the expansion might contain more {VAR}
     occurrences, i.e., if num > 0.
   */

  substVars(inputArray, f) {
    let num = 0; // number of variables successfully looked up
    let outArray = [];
    const me = this;
    for (let inPos = 0; inPos < inputArray.length; inPos++) {
      const tok = inputArray[inPos];
      if (tok.name === 'VARIABLE') {
        const lookup = f(tok.value);
        if (lookup) {
          num++;
          if (Array.isArray(lookup)) {
            lookup.forEach( t => outArray.push(t) );
          } else {
            outArray.push(lookup);
          }
        } else {
          outArray.push(tok);
        }
      } else {
        outArray.push(tok);
      }
    }
    return [num, outArray];
  }

}

module.exports = Executor;
