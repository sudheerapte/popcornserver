"use strict";

class Parser {

  constructor() {
  }

  /**
     buildProcs - create and return a map of procedures.
     Returns error message if it fails.
   */
  buildProcs(tokenListArray) {
    const sections = this.splitSections(tokenListArray);
    if (! sections) {
      return new Map();
    } else if (typeof sections === 'string') { // error message
      return sections;
    } else {
      let procedures = new Map();
      for (let i=0; i< sections.length; i++) {
        if (procedures.has(sections[i].section)) {
          return `duplicate section name: ${sections[i].section}`;
        } else {
          procedures.set(sections[i].section, sections[i].tla);
        }
      }
      return procedures;
    }
  }

  /**
     parseProc - return [null, dict].

     If successful, "struct" will contain the following. Else, the
     first element will be an error message instead of null.

     The dict is a Map of procedures, each containing name and
     an array of Block: {type, header, tokenListArray}

     Types of Blocks are:

     'PLAIN': header is null.
     'ON': header is array of conditions.
     'WITH': header is array of with clauses.

   */
  parseProc(tokenListArray) {
    const blocks = this.buildBlocks(tokenListArray);
    if (blocks.length <= 0) { return [null, []]; }
    let errCount = 0;
    let arr = blocks.map( block => {
      const tokListArr = block.tla;
      if (typeof tokListArr === 'string') { // error case
        errCount ++;
        return tokListArr;
      } else {
        return {header: block.header, lines: tokListArr};
      }
    });
    return errCount <= 0 ? [null, arr] : [`ERRORS: ${errCount}`, arr];
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
     buildBlocks - take a TLA, and return an array of blocks.
     Each block has a "header", which is null if the lines are plain,
     but otherwise an ON/WITH/ALL clause.

     Each block has a type:

     'PLAIN': header is null.
     'ON': header is array of conditions.
     'WITH': header is array of with clauses.

   */
  buildBlocks(tla) {
    let blocks = [];
    let block;
    let num = 0; // lists read so far
    do {
      block = this.getScriptBlock(tla.slice(num));
      if (block && !block.error && block.numLists > 0) {
        blocks.push(block);
        num += block.numLists;
        // this.log(`getScriptBlock: valid block: ${block.header}`);
      } else {
        // this.log(`null block`);
      }
    } while (block && block.numLists > 0);
    return blocks;
  }

  // getScriptBlock - return an array of lists forming a block.
  // Recognizes ON, WITH, and ALL blocks.
  //     Returns { error, numLists, header, tla }.
  //  type = 
  //     'PLAIN': header is null.
  //     'ON': header is array of conditions.
  //     'WITH': header is array of with clauses.

  // numLists is the number of lists consumed from the input array.
  // header is the portion before the BEGIN, and linesConsumed is
  // the block of lines before the corresponding END.
  // If "error" is set, it is an error string corresponding to line numLists.
  // Otherwise numLists is the number of lines consumed total and
  // "header" and "lines" contain the content of the block.
  getScriptBlock(tla) {
    let block = {numLists: 0, type: 'PLAIN', header: null, tla: []};
    if (! tla || tla.length <= 0) {
      return block;
    }
    const me = this;
    consumeBlankLines(block);
    if (block.numLists >= tla.length) {
      return block;
    }
    consumePlainLines(block);
    if (block.error) {
      return block;
    }
    if (! block.error && block.tla.length > 0) {
      return block;
    }
    consumeBlockHeader(block);
    if (block.error) {
      return block;
    }
    consumeBlockBody(block);
    return block;
    
    function consumeBlankLines(block) {
      for (let i=0; i< tla.length; i++) {
        if (tla[i].length <= 0) { continue; }
        else {
          block.numLists = i;
          return;
        };
      }
      block.numLists = tla.length;
      return;
    }

    function consumePlainLines(block) {
      const firstList = block.numLists;
      for (let i=block.numLists; i< tla.length; i++) {
        if (tla[i].length ===0) {
          block.numLists++;
          continue;
        }
        if (me.ifFirstKeyword(tla[i], "ON") ||
            me.ifFirstKeyword(tla[i], "WITH") ||
            me.ifFirstKeyword(tla[i], "ALL")) {
          return;
        }
        if (me.ifNextCommand(tla[i], 0, "END") ||
            me.ifNextCommand(tla[i], 0, "BEGIN")) {
          block.error = `found ${tla[i][0].value} in plain block`;
          return i-firstList;
        }
        block.numLists++;
        block.tla.push(tla[i]);
      }
      return tla.length - firstList;
    }

    function consumeBlockHeader(block) {
      const firstList = block.numLists;
      let i=firstList;
      if (tla[i].length <= 0) {
        block.error = `blank list found in block header`;
        return;
      }
      let j=0; // index within the list
      if (me.ifFirstKeyword(tla[i], "ON") ||
          me.ifFirstKeyword(tla[i], "WITH") ||
          me.ifFirstKeyword(tla[i], "ALL")) {
        block.type = tla[i][0].value;
        block.header = [];
        j=1;
      } else {
        block.error = `did not see ON/WITH/ALL`;
        return;
      }
      for (; j<tla[i].length; j++) {
        // special case for BEGIN on same line as ON/WITH/ALL
        if (j === tla[i].length-1 &&
            tla[i][j].name === 'KEYWORD' &&
            tla[i][j].value === 'BEGIN') {
          block.numLists++;
          return;
        } else {
          block.header.push(tla[i][j]);
        }
      }
      block.numLists++;
      i++;
      // consume lines until BEGIN line
      for (; i<tla.length; i++) {
        if (me.ifFirstKeyword(tla[i], "BEGIN")) {
          block.numLists++;
          return;
        } else {
          for (let j=0; j<tla[i].length; j++) {
            // special case for BEGIN on same line as ON/WITH/ALL
            if (j === tla[i].length-1 &&
                tla[i][j].name === 'KEYWORD' &&
                tla[i][j].value === 'BEGIN') {
              block.numLists++;
              return;
            } else {
              block.header.push(tla[i][j]);
            }
          }
          block.numLists++;
        }
      }
      // Error if we reached here without returning
      block.error = `no BEGIN found`;
      return;
    }

    function consumeBlockBody(block) {
      const firstList = block.numLists;
      let i=firstList;
      for (; i<tla.length; i++) {
        block.numLists++;
        if (tla[i].length > 0) {
          block.tla.push(tla[i]);
        }
      }
      return block;
    }
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

      {cmd: 'MAP', fn: args => this.mapCmd(args)},
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

  mapCmd(args) {
    if (args.length < 1) {
      return [`MAP needs at least 1 arg`, null];
    }
    if (! this.t.ifNextCommand(args, 0, "ALT0")) {
      return ["MAP requires ALT0", null];
    }
    const options = {PARENT: "PATH", ELEMENTID: "STRING"};
    const result = this.t.parseRequiredTokens(args.slice(1), options);
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

  /**
     splitSections() - take a script and return sections based on
     percent signs or [square brackets] like a Microsoft INI file.

     Example: given this input as a TLA:

       % SECTIONONE
       ...lines...
       ...lines...
       [ SECTIONTWO ]
       ...lines...
       ...lines...

     Return this output:
     [
         {section: "SECTIONONE", lines: [...] },
         {section: "SECTIONTWO", lines: [...] },
     ]
     
     Section name must be single contiguous string of non-whitespace.

     If the first line is not a section line, then we return null.
     If the last line looks like a section, then we return an error message.
  */
  splitSections(tla) {
    let arr = [];
    let i=0;
    const me = this;
    for (; i<tla.length; i++) {
      if (tla[i].length <= 0) { continue; }
      const tok = matchSection(tla[i]);
      if (tok) {
        let section = {section: tok.value, tla: [] };
        if (i=== tla.length-1) {
          return `splitSections: last line has %`;
        }
        const sectionLines = accumulateSection(section, tla.slice(i+1));
        arr.push(section);
        i+= sectionLines;
      } else {
        return null;
      }
    }
    return arr;

    function matchSection(list) { // return null or section name
      if (me.ifNextThree(list, "OPENBRACKET", "KEYWORD", "CLOSEBRACKET")) {
        return list[1];
      } else if (me.ifNextThree(list, "OPENBRACKET", "WORD", "CLOSEBRACKET")) {
        return list[1];
      } else if (me.ifNextTwo(list, "PERCENT", "KEYWORD")) {
        return list[1];
      } else if (me.ifNextTwo(list, "PERCENT", "WORD")) {
        return list[1];
      } else {
        return null;
      }
    }

    function accumulateSection(section, tla) {
      let j=0;
      for (; j<tla.length && ! matchSection(tla[j]); j++) {
        section.tla.push(tla[j]);
      }
      return j;
    }

  }

  // --------- utilities for parsing command arguments ---------------

  ifFirstKeyword(tokList, value) {
    if (tokList.length <= 0) { return false; }
    if (tokList[0].name !== 'KEYWORD') { return false; }
    return tokList[0].value === value;
  }

  ifNextCommand(tokList, index, cmd) {
    if (tokList.length < index+1) { return false; }
    if (tokList[index].name !== 'KEYWORD') { return false; }
    return cmd === tokList[index].value;
  }
  ifNext2Commands(tokList, index, cmd1, cmd2) {
    if (tokList.length < index+2) { return false; }
    return this.ifNextCommand(tokList, index, cmd1) &&
      this.ifNextCommand(tokList, index+1, cmd2);
  }

  ifNextThree(tokList, name1, name2, name3) {
    if (tokList.length < 3) { return false; }
    return tokList[0].name === name1 &&
      tokList[1].name === name2 &&
      tokList[2].name === name3;
  }
  ifNextTwo(tokList, name1, name2) {
    if (tokList.length < 2) { return false; }
    return tokList[0].name === name1 &&
      tokList[1].name === name2;
  }
  

  getNextArg(tokList, index, argname, options) {
    if (options[argname].match(tokList[index].name)) {
      return tokList[index];
    } else if (options[argname] === 'PATH') {
      return null;
    }
  }
  findNextCommand(tokList, index, commandNames) {
    if (tokList.length < index) { return null; }
    if (tokList[index].name !== 'KEYWORD') {
      return null;
    }
    for (let j=0; j<commandNames.length; j++) {
      if (tokList[index].value === commandNames[j]) {
        return commandNames[j];
      }
    }
    return null;
  }
  ifNextPair(tokList, index, cmd, tok) {
    if (ifNextCommand(tokList, index, cmd)) {
      if (tokList.length < index+2) { return false; }
      return this.equal(tokList[index+2], tok);
    } else {
      return false;
    }
  }

  /**
     parseRequiredTokens() - return [ null, args] on success

     The returned object "args" contains attributes whose names are
     the COMMANDS in the token list, and values are the subsequent
     next token.

     For example, if you define "options" like this:

         { ID: "WORD", NAME: "WORD", VALUE: "STRING or WORD" }

     And you tokenize the following string:

         ID foo NAME bar VALUE "some string baz"

     Then the token list can be parsed with with the above options.
     We return an "args" object like this:

     {
       ID: {name: WORD, value: "foo"},
       NAME: {name: WORD, value: "bar"},
       VALUE: {name: STRING, value: '"some string baz"'},
     }
     
     Moreover, every key in the "options" object must be
     represented once in the token list, otherwise we get an error.

     ==============   ====================================  =============
     option value     meaning                               value
     ==============   ====================================  =============
     WORD             a single word, [a-z][a-z0-9-]*        string
     COMMAND          a single COMMAND, [A-Z]+              string
     WORDS            a series of words                     array of str.
     PATH             a path, DOT WORD DOT/SLASH WORD ...   string
     COMMAND or WORD  either a COMMAND or a word            string
     ==============   ====================================  =============

   */

  parseRequiredTokens(tokList, options) {
    if (! tokList || tokList.length <= 0) {
      return ['empty token list', null];
    }
    let args = {};
    const keys = Object.keys(options);
    for (let i=0; i< tokList.length; i++) {
      let found = false;
      const cmd = this.findNextCommand(tokList, i, keys);
      if (cmd) {
        let [ num, value] = this.consumeArgs(tokList, i+1, cmd, options);
        if (num > 0) {
          found = true;
          args[cmd] = value;
          i += num;
          continue;
        } else {
          return [`bad arg for ${cmd}`, args];
        }
      } else {
        return [ `bad option: ${this.renderTokens(tokList[i])}`, args ];
      }
    }
    const opts = Object.keys(args);
    for (let i=0; i<keys.length; i++) {
      if (! args.hasOwnProperty(keys[i])) {
        return [`required option ${keys[i]} missing`, args];
      }
    }
    return [null, args];
  }

  // consumeArgs: consume as many tokens as possible; return [num, value]
  // "index" points to the first token after the COMMAND argname.
  consumeArgs(tokList, index, argname, options) {
    const opt = options[argname];
    const tok = tokList[index];
    if (opt === 'COMMAND') {
      return tok.name === 'COMMAND' ? [1, tok.value] : [0, 'not COMMAND'];
    } else if (opt === 'WORD') {
      return tok.name === 'WORD' ? [1, tok.value] : [0, 'not WORD'];
    } else if (opt === 'STRING') {
      return tok.name === 'STRING' ? [1, tok.value] : [0, 'not STRING'];
    } else if (opt === 'WORDS') {
      let num = 0;
      let arr = [];
      for (let i=index; i<tokList.length; i++) {
        const tok = tokList[i];
        if (tok.name === 'WORD') {
          num++;
          arr.push(tok.value);
        } else {
          return [num, arr];
        }
      }
      return [num, arr];
    } else if (opt === 'PATH') {
      const num = this.consumePath(tokList.slice(index));
      if (num <= 1) {
        return [0, 'not PATH'];
      } else {
        return [num, this.composePath(tokList.slice(index, index+num))];
      }
    } else if (opt.match(/WORD/) && opt.match(/STRING/)) {
      return tok.name.match(/WORD|STRING/) ? [1, tok.value] : [0, 'not found'];
    }
    console.log(`consumeArgs: bad option: ${opt}`);
    return 0;
  }

  // composePath - return a string. Input must be valid path sequence

  composePath(args) {
    if (args.length === 0) {
      return '';
    }
    if (args[0].name !== 'DOT') {
      return null;
    }
    let str = '.';
    let wantWord = true;
    for (let i = 1; i< args.length; i++) {
      if (wantWord) {
        if (args[i].name !== 'WORD') {
          return null;
        } else {
          str += args[i].value;
          wantWord = false;
        }
      } else {
        if (args[i].name === 'DOT') {
          str += '.';
          wantWord = true;
        } else if (args[i].name === 'SLASH') {
          str += '/';
          wantWord = true;
        } else {
          return null;
        }
      }
    }
    return str;
  }

  // consumePath - return number of tokens consumed from front.
  // Consumes as many tokens as possible to form a legal path.
  consumePath(args) {
    if (args.length === 0) {
      return 0;
    }
    if (args[0].name !== 'DOT') {
      return 0;
    }
    let wantWord = true;
    let numConsumed = 1;
    for (let i = 1; i< args.length; i++) {
      if (wantWord) {
        if (args[i].name !== 'WORD') {
          return numConsumed - 1;
        } else {
          numConsumed ++;
          wantWord = false;
        }
      } else {
        if (args[i].name === 'DOT') {
          numConsumed ++;
          wantWord = true;
        } else if (args[i].name === 'SLASH') {
          numConsumed ++;
          wantWord = true;
        } else {
          return numConsumed;
        }
      }
    }
    return numConsumed;
  }


}

module.exports = Parser;
