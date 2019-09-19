"use strict";

// We need Machine and Tokenier, but UI-ready wants to avoid "require".
// So, we pass in a tokenizer to the constructor.

class Propagator {

  constructor(machine, tokenizer, logfunc) {
    this.mc = machine;
    this.t = tokenizer;
    this.log = logfunc ? logfunc : console.log;
    this._commands = {};
    this.addBasicCommandSet();
    this.evalFunc = this.getEvalFunc(this.mc);
  }

  process(line, anEvalFunc) {
    if (! anEvalFunc) { anEvalFunc = this.evalFunc; }
    return this.t.process(line, anEvalFunc);
  }

  /**
     runRenderScript - return null or errMsg string
   */
  runRenderScript(scriptLines) {
    const blocks = this.buildBlocks(scriptLines);
    if (blocks.length <= 0) { return null; }
    let errMsg = "";
    blocks.forEach( block => {
      const lines = this.unrollBlock(block);
      if (Array.isArray(lines)) {
        for (let i=0; i<lines.length; i++) {
          const result = this.process(`{{${lines[i]}}}`);
          if (result[0]) {
            errMsg += `ERROR: |${lines[i]}| => ${result[0]}\n`;
          } else {
            // errMsg += `OK: |${lines[i]}| => |${result[1]}|\n`;
          }
        }
      } else {
        if (errMsg.length > 0) { errMsg += '\n'; }
        errMsg += `${block.header}: ${lines}`;
      }
    });
    if (errMsg.length > 0) {
      return errMsg;
    } else {
      return null;
    }
  }

  /**
     unrollBlock - return unrolled lines or error message
   */
  unrollBlock(block) {
    const me = this;
    if (block && ! block.header) {
      let pairs = block.lines.map(line => this.process(line) );
      return unrolledOrError(pairs);
    } 
    let m;
    block.header = block.header.trim();
    m = block.header.match(/^ON\s+(\S+)\s+(\S+)$/);
    if (m) {
      if (this.mc.isVariableParent(m[1])) {
        if (this.mc.getCurrentChildName(m[1]) !== m[2]) {
          // this.log(`ON: ${m[1]} is not ${m[2]}. Skipping.`);
          return [];
        } else {
          let pairs = block.lines.map(line => this.process(line) );
          return unrolledOrError(pairs);
        }
      } else {
        this.log(`ON: ${m[1]} is not a variable parent.`);
        return [];
      }
    }
    m = block.header.match(/^WITH\s+(.+)$/);
    if (! m) {
      return `bad block header: ${block.header}`;
    }
    let clauses = [];
    const errMsg = this.parseWithClauses(m[1], clauses);
    if (errMsg) { return errMsg; }
    const unis = this.getAllUnifications(clauses);
    if (! Array.isArray(unis)) { // error message
      return unis;
    }
    let results = [];
    for (let i=0; i<unis.length; i++) {
      let a = this.evalBlock(block.lines, this.getEvalFuncVarContext(unis[i]));
      a.filter( out => out.length > 0 ).forEach( out => results.push(out) );
    }
    return results;
      
    function unrolledOrError(pairs) {
      const errPos = pairs.findIndex( pair => pair[0] !== null );
      if (errPos < 0) {
        return pairs.map( pair => pair[1] );
      } else {
        me.log(`returning error instead of unrolled lines`);
        me.log(`line ${errPos}: ${pairs[errPos]}`);
        return `line ${errPos}: ${pairs[errPos][0]}`;
      }
    }

  }

  parseWithClauses(clauseStr, arr) { // return null only when fully parsed
    clauseStr = clauseStr.trim();
    if (clauseStr.length <= 0) { return null; }
    const m = clauseStr.match(/^(ALL|CURRENT|NONCURRENT)\s+([^,]+)/);
    if (!m) {
      return `parseWithClauses: failed to parse: ${clauseStr}`;
    }
    arr.push(m[0]);
    clauseStr = clauseStr.slice(m[0].length);
    if (clauseStr.startsWith(',')) {
      clauseStr = clauseStr.slice(1);
    }
    return this.parseWithClauses(clauseStr, arr);
  }

  /**
     buildBlocks - take an array of lines, and return an array of blocks.
     Each block has a "header", which is null if the lines are plain,
     but otherwise an ON/WITH/ALL clause.
   */
  buildBlocks(lines) {
    let blocks = [];
    let block;
    let numLines = 0;
    do {
      block = this.getScriptBlock(lines.slice(numLines));
      if (block && block.numLines > 0) {
        blocks.push(block);
        numLines += block.numLines;
        // this.log(`getScriptBlock: valid block: ${block.header}`);
      } else {
        // this.log(`null block`);
      }
    } while (block && block.numLines > 0);
    return blocks;
  }

  // getScriptBlock - return an array of lines forming a block.
  // Recognizes ON, WITH, and ALL blocks and expands them.
  //     Returns { error, numLines, header, lines array }.
  // numLines is the number of lines consumed from the input array.
  // header is the portion before the BEGIN, and linesConsumed is
  // the block of lines before the corresponding END.
  // If "error" is set, it is an error string corresponding to line numLines.
  // Otherwise numLines is the number of lines consumed total and
  // "header" and "lines" contain the content of the block.
  getScriptBlock(lines) {
    let block = {numLines: 0, header: null, lines: []};
    if (! lines || lines.length <= 0) { return block; }
    const specialPat = /^(ON|WITH|ALL)(.+)BEGIN$/;
    const endPat = /^END$/;
    const me = this;
    consumeBlankLines(block);
    if (block.numLines >= lines.length) {
      return block;
    }
    consumePlainLines(block);
    if (block.error) {
      return block;
    }
    if (! block.error && block.lines.length > 0) {
      return block;
    }
    consumeBlockLines(block);
    return block;
    
    function consumeBlankLines(block) {
      for (let i=0; i< lines.length; i++) {
        const s = lines[i] ? lines[i].trim() : "";
        if (s.length <= 0) { continue; }
        else {
          block.numLines = i;
          return;
        };
      }
      block.numLines = lines.length;
      return;
    }

    function consumePlainLines(block) {
      const firstLine = block.numLines;
      for (let i=block.numLines; i< lines.length; i++) {
        const s = lines[i] ? lines[i].trim() : "";
        if (s.length ===0) {
          block.numLines++;
          continue;
        }
        let m;
        m = s.match(specialPat);
        if (m) { return i-firstLine; }
        m = s.match(endPat);
        if (m) {
          block.error = "found END in plain block";
          return i-firstLine;
        }
        block.numLines++;
        block.lines.push(s);
      }
      return lines.length - firstLine;
    }

    function consumeBlockLines(block) {
      const firstLine = block.numLines;
      let readingBlock = false;
      for (let i=block.numLines; i< lines.length; i++) {
        const s = lines[i] ? lines[i].trim() : "";
        if (s.length ===0) {
          block.numLines++;
          continue;
        }
        let m;
        m = s.match(specialPat);
        if (m) {
          block.numLines ++;
          readingBlock = true;
          block.header = m[1]+m[2];
          continue;
        }
        m = s.match(endPat);
        if (m && readingBlock) {
          block.numLines ++;
          return lines.length;
        } else if (m) {
          block.error = "found END in block";
          return i-firstLine;
        }
        if (! readingBlock) {
          return 0;
        }
        block.numLines++;
        block.lines.push(s);
      }
      return lines.length - firstLine;
    }
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
    const m = clause.match(/^(ALL|CURRENT|NONCURRENT)\s+(.+)$/);
    if (!m) { return `bad WITH clause: ${clause}`; }
    const partials = this.computeUnification(subst, m[1], m[2]);
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

  // renderVarLitTokens - NOT USED - TODO delete
  renderVarLitTokens(arr, subst) {
    let s = "";
    for (let i=0; i<arr.length; i++) {
      if (arr[i].hasOwnProperty("LIT")) {
        s += arr[i].LIT;
      } else if (arr[i].hasOwnProperty("VAR")) {
        if (subst.hasOwnProperty(arr[i].VAR)) {
          s += subst[arr[i].VAR];
        } else {
          s += arr[i].VAR + " ";
        }
      } else if (arr[i].hasOwnProperty("WILDCARD")) {
        s += '*';
      } else { // error -- should never happen
        s += "(" + JSON.stringify(arr[i]) + ")";
      }
    }
    return s;
  }

  // evalBlock - take a list of strings and evaluate them,
  // returning a corresponding list of strings.
  // Optionally takes an evalFunc (see tokenizer.process()).
  // If none is passed in, then use my machine's evalFunc.
  evalBlock(todo, anEvalFunc) {
    if (! anEvalFunc) { anEvalFunc = this.evalFunc; }
    return todo.map( formula => {
      if (!formula) {
        this.log(`evalBlock: formula is empty`);
        return "";
      }
      let result = this.t.process(formula, anEvalFunc);
      if (result[0]) {
        this.log(`evalBlock: ${formula}: ${result[0]}`);
        return "";
      } else if (! result[1]) {
        this.log(`evalBlock: ${formula}: falsy result`);
        return "";
      } else {
        //this.log(`evalBlock: |${formula}| ==> |${result[1]}|`);
        return result[1];
      }
    });
  }

  // substituteBlockVars - Not used -- TODO remove
  // substituteBlockVars - take a list of strings and generate
  // new ones where a set of capitalized variables are substituted
  // with their values.
  // Example: input:
  //   [ 'board.POS/PLAYER' ], [ {POS: 'a', PLAYER: 'fly1'},
  //                             {POS: 'b', PLAYER: 'fly2'}, ]
  // output:
  //   [ 'board.a/fly1', 'board.b/fly2' ]
  substituteBlockVars(todo, substList) {
    const tokenized = todo.map( line => this.getVarLitTokens(line) );
    let result = [];
    for (let i=0; i<substList.length; i++) {
      tokenized.map(tokList => this.renderVarLitTokens(tokList, substList[i]))
        .forEach( s => result.push(s) );
    }
    return result;
  }


  // evalBlockVars - take a list of strings and evaluate them
  // in a context of vars, returning a corresponding list of strings.
  // This function substitutes that token wherever a COMMAND with that
  // capitalized name is found, and then evaluates the entire input string.
  evalBlockVars(todo, varContext) {
    return this.evalBlock(todo, this.getEvalFuncVarContext(varContext));
  }

  // getEvalFunc - return a function suitable to pass in to
  // this.t.process().

  getEvalFunc() {
    return (tokens => this.evaluate(tokens));
  }

  // getEvalFuncVarContext - return a function suitable to pass in to
  // this.t.process(). This version takes a "varContext" that can
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
      if (tokenArray[0].name === 'COMMAND') {
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

      {cmd: 'ATTACH', fn: args => this.attachCmd(args)},
    ];
    this.addCommands(records);
  }

  addCommands(arr) {
    arr.forEach( rec => this._commands[rec.cmd] = rec );
  }

  defCmd(args) {
    if (this.t.ifNextCommand(args, 0, "CON") ||
        this.t.ifNextCommand(args, 0, "ALT")) {
      const type = args[0].value;
      const sep = type === 'CON' ? '.' : '/';
      let options = {PARENT: "PATH", CHILDREN: "WORDS"};
      let result = this.t.parseRequiredTokens(args.slice(1), options);
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
    } else if (this.t.ifNextCommand(args, 0, "TOP")) {
      let options = {CHILDREN: "WORDS"};
      let result = this.t.parseRequiredTokens(args.slice(1), options);
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
    if (this.t.ifNextCommand(args, 0, "DATAW")) {
      let options = {PATH: "PATH", DATA: "WORD"};
      let result = this.t.parseRequiredTokens(args.slice(1), options);
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
    } else if (this.t.ifNextCommand(args, 0, "CURRENT")) {
      let options = {PARENT: "PATH", CHILD: "WORD"};
      let result = this.t.parseRequiredTokens(args.slice(1), options);
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

  attachCmd(args) {
    if (args.length < 1) {
      return [`ATTACH needs at least 1 arg`, null];
    }
    return null;
  }

  /*
    TODO: use this kidn of logic to build ATTACH command

    if (this.t.ifNextCommand(args, 0, "CON") ||
        this.t.ifNextCommand(args, 0, "ALT")) {
      const type = args[0].value;
      const sep = type === 'CON' ? '.' : '/';
      let options = {PARENT: "PATH", CHILDREN: "WORDS"};
      let result = this.t.parseRequiredTokens(args.slice(1), options);
      if (result[0]) { return [ `DEF ${type}: ${result[0]}`, args ]; }
  */

}

module.exports = Propagator;
