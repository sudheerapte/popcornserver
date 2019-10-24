"use strict";

class Parser {

  constructor(tokenizer) {
    this.t = tokenizer;
  }

  /**
     buildProcs - create and return a Map of procedures.
     Each key of the map is a procedure name, and the value
     is an array of blocks, or an error string.
   */

  buildProcs(tla) {
    const map = this.buildProcContentMap(tla);
    if (typeof map === 'string') { // error message
      return map;
    } else {
      const out = new Map();
      map.forEach( (v, k) => {
        const proc = this.buildBlocks(v);
        out.set(k, proc);
      });
      return out;
    }
  }

  /**
     buildProcContentMap - create and return a map of procedures.
     Returns error message if it fails.
   */
  buildProcContentMap(tla) {
    const sections = this.splitSections(tla);
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
      if (block.error) {
        return block.error;
      }
      if (block && !block.error && block.numLists > 0) {
        blocks.push(block);
        num += block.numLists;
        // this.log(`getScriptBlock: valid block: ${block.header}`);
      } else {
        // this.log(`null block`);
      }
    } while (block && !block.error && block.numLists > 0);
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
  // "header" and "tla" contain the content of the block.
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
    parseBlockHeader(block);
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

    // parseBlockHeader -- replace tokList with a tla
    function parseBlockHeader(block) {
      if (block.type === 'PLAIN') { return; }
      if (block.type === 'ON') {
        const num = consumeOnCondition(block.header);
        if (num < 0) {
          block.error = `bad ON header`;
          return;
        }
        const cond = block.header.slice(0, num);
        if (block.header.length > num) {
          block.error = `block header leftover = ${block.header.length-num}`;
        } else {
          block.header = [];
          block.header.push(cond);
        }
        return;
      }
      if (block.type === 'WITH') {
        let patterns = [];
        while (block.header.length > 1) {
          const num = consumeWithPattern(block.header);
          if (num < 0) {
            block.error = `bad WITH pattern: ${block.header[0].name}`;
            return;
          }
          patterns.push(block.header.slice(0, num));
          block.header = block.header.slice(num);
        }
        block.header = patterns;
        return;
      }
    }

    function consumeOnCondition(tokList) {
      if (tokList.length < 1) { return -1; }
      if (tokList[0].name === 'KEYWORD' &&
          tokList[0].value === 'IS_CURRENT') {
        const num = me.consumePath(tokList.slice(1));
        const cdr = tokList.slice(1+num);
        if (cdr.length !== 1 || cdr[0].name !== 'WORD') {
          return -1;
        } else {
          return num+2;
        }
      } else {
        return -1;
      }
    }

    function consumeWithPattern(tokList) {
      if (tokList.length < 1) { return -1; }
      if (tokList[0].name === 'KEYWORD' &&
          tokList[0].value.match(/^ALL|CURRENT|NONCURRENT$/)) {
        const num = me.consumePathPattern(tokList.slice(1));
        return num+1;
      } else {
        return -1;
      }
    }

    function consumeBlockBody(block) {
      const firstList = block.numLists;
      let i=firstList;
      for (; i<tla.length; i++) {
        block.numLists++;
        if (tla[i].length > 0) {
          if (tla[i][0].name === 'KEYWORD' && tla[i][0].value === 'END') {
            return;
          } else {
            block.tla.push(tla[i]);
          }
        }
      }
      block.error = 'no END found';
    }
  }


  // consumePath - return total tokens consumed, or error string.
  // Consumes as many (separator, word) pairs as possible
  consumePath(tokList) {
    if (tokList.length === 0) { return 0; }
    for (let i=0; i<tokList.length; i=i+2) { // count by two
      if (i === tokList.length -1) { return i; } // only one token left
      if (tokList[i].name === 'DOT' || tokList[i].name === 'SLASH') {
        if (tokList[i+1].name !== 'WORD') { return i; }
      } else {
        return i;
      }
    }
    return tokList.length;
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
     Token manipulation utilities
     -----------------------------------------------------------
   */

  /**
     substVars - take a token array and expand any {VAR}s

     Returns [num, outArray, successfulNum], where:
        - num is the number of variables that could not be expanded.
        - outArray is the result of the substitution.
        - successfulNum is the number of variables expanded.

     The function f() should take the "VAR" portion and return
     a token or array of tokens.
     If it does not have an expansion, it should return
     null. The expandVars function will keep the {VAR} string
     intact in the result, and not count that variable as
     successfully expanded.

     The caller might want to call this function again if there
     is a possibility that the expansion might contain more {VAR}
     occurrences, i.e., if succeessfulNum > 0.
   */

  substVars(inputArray, f) {
    let num = 0; // number of variables that could not be expanded
    let successfulNum = 0; // number of variables successfully looked up
    let outArray = [];
    const me = this;
    for (let inPos = 0; inPos < inputArray.length; inPos++) {
      const tok = inputArray[inPos];
      if (tok.name === 'VARIABLE') {
        const lookup = f(tok.value);
        if (lookup) {
          successfulNum++;
          if (Array.isArray(lookup)) {
            lookup.forEach( t => outArray.push(t) );
          } else {
            outArray.push(lookup);
          }
        } else {
          num++;
          outArray.push(tok);
        }
      } else {
        outArray.push(tok);
      }
    }
    return [num, outArray, successfulNum];
  }

  /**
     splitSections() - take a script and return sections based on
     percent signs or [square brackets] like a Microsoft INI file.
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

  /**
     buildCommand: build an "args" structure as follows:
     - command: string (space-separated if multiple keywords)
     - ID: string
     - PATH: string... (etc., depending on options)

     "command" is a string of space-separated keywords (if multiple keywords)
     "options" structure is described below in parseRequiredTokens().

     return [errMsg, args]
   */

  buildCommand(command, tokList, options) {
    const cArray = command.split(/\s+/);
    if (tokList.length < cArray.length) {
      return null;
    }
    for (let c=0; c < cArray.length; c++) {
      if (tokList[c].name !== 'KEYWORD' ||
          tokList[c].value !== cArray[c]) {
        return null;
      }
    }
    let errMsg, args;
    [errMsg, args] = this.parseRequiredTokens(tokList.slice(cArray.length), options);
    if (errMsg) { return [errMsg, null]; }
    args.command = cArray.join(' ');
    return [null, args];
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
  findNextKeyword(tokList, index, commandNames) {
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
     the KEYWORDS in the token list, and values are the subsequent
     next token.

     For example, if you define "options" like this:

         { ID: "WORD", NAME: "WORD", VALUE: "STRING or WORD" }

     And you tokenize the following string:

         ID foo NAME bar VALUE "some string baz"

     Then the token list can be parsed with with the above options.
     We return an "args" object like this:

     {
       ID: "foo",
       NAME: "bar",
       VALUE: "some string baz",
     }
     
     Moreover, every key in the "options" object must be
     represented once in the token list, otherwise we get an error.

     ==============   ====================================  =============
     option value     meaning                               value
     ==============   ====================================  =============
     WORD             a single word, [a-z][a-z0-9-]*        string
     KEYWORD          a single KEYWORD, [A-Z]+              string
     WORDS            a series of words                     array of str.
     PATH             a path, DOT WORD DOT/SLASH WORD ...   string
     KEYWORD or WORD  either a KEYWORD or a word            string
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
      const cmd = this.findNextKeyword(tokList, i, keys);
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
        return [ `bad option: ${this.t.renderTokens(tokList[i])}`, args ];
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
  // "index" points to the first token after the KEYWORD argname.
  consumeArgs(tokList, index, argname, options) {
    const opt = options[argname];
    const tok = tokList[index];
    if (opt === 'KEYWORD') {
      return tok.name === 'KEYWORD' ? [1, tok.value] : [0, 'not KEYWORD'];
    } else if (opt === 'WORD') {
      return tok.name === 'WORD' ? [1, tok.value] : [0, 'not WORD'];
    } else if (opt === 'NUMBER') {
      return tok.name === 'NUMBER' ? [1, tok.value] : [0, 'not NUMBER'];
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
      return [num, this.composePath(tokList.slice(index, index+num))];
    } else if (opt.match(/WORD/) && opt.match(/STRING/)) {
      return tok.name.match(/WORD|STRING/) ? [1, tok.value] : [0, 'not found'];
    }
    console.log(`consumeArgs: bad option: ${opt}`);
    return 0;
  }

  // composePath - return a string. Input must be valid path sequence
  // return null on error
  composePath(tokList) {
    let str = "";
    if (tokList.length === 0) { return str; }
    for (let i=0; i<tokList.length; i=i+2) { // count by two
      if (i === tokList.length -1) { return str; } // only one token left
      if (tokList[i].name === 'DOT' || tokList[i].name === 'SLASH') {
        if (tokList[i+1].name !== 'WORD') {
          return str;
        } else {
          str += this.t.specials[tokList[i].name] + tokList[i+1].value;
        }
      } else {
        return str;
      }
    }
    return str;
  }


  oldComposePath(args) {
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
          return str;
        }
      }
    }
    return str;
  }

}

module.exports = Parser;
