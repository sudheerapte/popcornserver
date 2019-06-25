"use strict";

// We need Machine and Tokenier, but UI-ready wants to avoid "require".
// So, we pass in a tokenizer to the constructor.

class Propagator {

  constructor(machine, tokenizer, logfunc) {
    this.mc = machine;
    this.t = tokenizer;
    this.log = logfunc ? logfunc : console.log;
    this.evalFunc = this.getEvalFunc(this.mc);
  }

  process(line) {
    return this.t.process(line, this.evalFunc);
  }

  oldRunRenderScript(lines) {
    // eval and interpret lines unless ON condition path failed
    let doLines= false; // if condition path has matched
    let startLine = -1; // first line to be evaluated
    let onCondition = "";

    for (let i=0; i<lines.length; i++) {
      const line = lines[i];
      if (line.match(/^ON.+BEGIN$/)) {
        if (line.match(/^ON\sBEGIN$/)) {
          doLines = true;
          startLine = i+1;
          onCondition = "ALWAYS";
        } else {
          const m = line.match(/^ON\s+(\S+)\s+(\w+)\s+BEGIN$/);
          if (!m) {
            this.log(`ON line did not match PATH VAR`);
          } else if (this.mc.isVariableParent(m[1])) {
            onCondition = `${m[1]} = ${m[2]}`;
            if (this.mc.getCurrentChildName(m[1]) !== m[2]) {
              this.log(`${m[1]} alt != ${m[2]}. skipping.`);
              doLines = false;
            } else {
              doLines = true;
              startLine = i+1;
              this.log(`${line}`);
            }
          } else {
            this.log(`${m[1]} - not a variable parent. skipping.`);
            doLines = false;
          }
        }
      } else if (line.match(/^END/)) {
        if (doLines) {
          let evalLines = this.evalBlock(lines.slice(startLine, i));
          const result = this.mc.interpret(evalLines);
          if (result) {
            this.log(`ON ${onCondition}: ${result}\n`);
          } else {
            this.log(`ON ${onCondition}: evaluated lines ${startLine}-${i}`);
          }
        } else {
          this.log(`ON ${onCondition}: false. skipped lines ${startLine}-${i}`);
        }
        doLines = false;
        startLine = i+1; // to get better error messages
        onCondition = "";
      }
    }
  }

  runRenderScript(lines) {
    let runLines = []; // The unrolled blocks to be run
    let blocks = this.buildBlocks(lines);
    const me = this;
    for (let i=0; i< blocks.length; i++) {
      const block = blocks[i];
      if (block && ! block.header) {
        this.log(`plain block of ${block.lines.length} lines`);
        block.lines.forEach( line => runLines.push(line) );
        continue;
      } 
      let m;
      block.header = block.header.trim();
      m = block.header.match(/^ON\s+(\S+)\s+(\w+)$/);
      if (m) {
        this.log(`${block.header}, ${block.lines.length} lines`);
        if (me.mc.isVariableParent(m[1])) {
          if (me.mc.getCurrentChildName(m[1]) !== m[2]) {
            this.log(`ON: ${m[1]} is not ${m[2]}. Skipping.`);
          } else {
            block.lines.forEach( line => runLines.push(line) );
          }
        } else {
          this.log(`ON: ${m[1]} is not a variable parent. Skipping.`);
        }
        continue;
      }
      m = block.header.match(/^WITH\s+(\S+)$/);
      if (m) {
        this.log(`${block.header}, ${block.lines.length} lines`);
        const output = this.expandWithScript(m[1], "ALL", block.lines);
        this.log(`WITH ${m[1]}: generated ${output.length} lines`);
        output.forEach( line => runLines.push(line) );
        continue;
      }
      this.log(`bad block: ${JSON.stringify(block)}`);
    }
    const processedLines = this.evalBlock(runLines);
    const result = this.mc.interpret(processedLines);
    if (result) {
      this.log(`interpret failed: ${result}`);
    }
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
      }
    } while (block && block.numLines > 0);
    return blocks;
  }

  // getScriptBlock - return an array of lines forming a block.
  // Recognizes ON, WITH, and ALL blocks and expands them.
  // The expanded lines are pushed on to the passed-in array arr.
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

  expandWithScript(pathString, allOrCurrent, lines) {
    const exprArr = this.getUnifyExpression(pathString, allOrCurrent);
    const arr = this.unify(pathString, allOrCurrent);
    for (let i=0; i< arr.length; i++) {
      const subst = arr[i];
      const result = this.evalBlock(lines, subst);
    }

    const formulas = lines.map( line => this.unify(line, allOrCurrent))
          .filter( line => line && line.trim().length > 0 );
    return formulas;
  }

  // unify(pathString) -- return substitution list
  unify(pathString, allOrCurrent) {
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

    let arr = this.getUnifyExpression(pathString);

    let outArr = [];
    testPaths.forEach( p => {
      const obj = unifyExpression(arr, p);
      if (obj) {
        outArr.push(obj);
      }
    });
    // this.log(outArr);
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
        } else {
          return null;
        }
      }
      return subst;
    }
  }

  getUnifyExpression(pathExpr) {
    const me = this;
    let arr = [];
    let s = pathExpr;
    do {
      s = splitExpression(s, arr);
    } while(s && s.length > 0);
    return arr;

    function splitExpression(pathExpr, arr) {
      const ma = pathExpr.match(/^[A-Z]+/);
      if (ma) {
        arr.push({VAR: pathExpr.slice(0,ma[0].length)});
        return pathExpr.slice(ma[0].length);
      }
      const m = pathExpr.match(/^([a-z0-9-.\/]+)(.*)/);
      if (m) {
        arr.push({LIT: m[1]});
        return m[2];
      } else {
        this.log(`unify: bad prefix: |${pathExpr}|`);
        return "";
      }
    }
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


  // evalBlockVars - take a list of strings and evaluate them
  // in a context of vars, returning a corresponding list of strings.
  // This function substitutes that token wherever a COMMAND with that
  // capitalized name is found, and then evaluates the entire input string.
  evalBlockVars(todo, varContext) {
    const varFunc = this.getEvalFuncVarContext(varContext);
    return todo.map( formula => {
      if (!formula) {
        this.log(`evalBlock: formula is empty`);
        return "";
      }
      let result = this.t.process(formula, varFunc);
      if (result[0]) {
        this.log(`evalBlock: ${formula}: ${result[0]}`);
        return "";
      } else if (! result[1]) {
        this.log(`evalBlock: ${formula}: falsy result`);
        return "";
      } else {
        this.log(`evalBlock: |${formula}| ==> |${result[1]}|`);
        return result[1];
      }
    });
  }

  // getEvalFunc - return a function suitable to pass in to
  // this.t.process().

  getEvalFunc() {
    return (tokens => {
      const eResult = this.evaluate(tokens);
      if (! eResult) {
        this.log(JSON.stringify(tokens));
      }
      if (eResult[0]) { return eResult; }
      return [ null, eResult[1] ];
    });
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
            varContext[e.value].match(/^[a-z]+$/)
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
    let i = tokenArray.findIndex( tok => tok.name === 'BEGIN' );
    if (i >= 0) {
      let j = tokenArray.slice(i).findIndex( tok => tok.name === 'END' );
      if (j >= 0) {
        let subEval = this.evaluate(tokenArray.slice(i+1, i+j));
        if (subEval[0]) { // error
          return subEval;
        } else {
          let newArray = tokenArray.slice(0, i);
          // subEval could be single token or an array
          if (subEval[1].hasOwnProperty('length')) {
            subEval[1].forEach( tok => newArray.push(tok) );
          } else {
            newArray.push(subEval[1]);
          }
          tokenArray.slice(i+j+1, tokenArray.length)
            .forEach( tok => newArray.push(tok));
          return this.evaluate(newArray);
        }
      } else {
        return [`BEGIN without END`, null];
      }
    }

    if (tokenArray[0].name === 'BEGIN' && tokenArray[tokenArray.length-1] === 'END') {
      return this.evaluate(tokenArray.slice(1, tokenArray.length-1));
    }
    if (tokenArray[0].name === 'COMMAND') {
      const result = this.executeCommand(tokenArray[0].value, tokenArray.slice(1));
      return result;
    }
  }

  executeCommand(cmd, args) {
    if (cmd === 'EXISTS') {
      const mPath = this.composePath(args);
      if (! mPath) {
        return [ `bad syntax for path: ${this.t.renderTokens(args)}`, null ];
      }
      if (this.mc.exists(mPath)) {
        return [ null, {name: 'NUMBER', value: "1"} ];
      } else {
        return [ null, {name: 'NUMBER', value: "0"}];
      }
    } else if (cmd === 'CURRENT') {
      if (args.length < 1) {
        return [`CURRENT needs at least 1 arg`, null];
      }
      const mPath = this.composePath(args);
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
    } else if (cmd === 'DATA') {
      if (args.length < 1) {
        return [`DATA needs at least 1 arg`, null];
      }
      const mPath = this.composePath(args);
      if (! mPath) {
        return [ `DATA: bad syntax for path: ${this.t.renderTokens(args)}`, null ];
      }
      if (this.mc.exists(mPath)) {
        if (this.mc.isDataLeaf(mPath)) {
          const data = this.mc.getData(mPath);
          if (typeof data === 'string') {
            return [ null, {name: 'STRING', value: data} ];
          } else {
            return [ null, data.map( d => {
              return {name: 'STRING', value: d};
            }) ];
          }
        } else {
          return [`DATA: not a data leaf: ${mPath}`, null];
        }
      } else {
        return [ `DATA: no such path: ${mPath}`, null ];
      }
    } else if (cmd === 'ALL') {
      const result = this.expandAllConcurrentChildren(args);
      if (result[0]) {
        return result;
      } else { // Build array of tokens from the child names
        if (result[1].length === 0) { return result; }
        const arr = [];
        for (let i=0; i< result[1].length-1; i++) {
          arr.push(result[1][i]);
          arr.push({name: ',', value: null});
        }
        arr.push(result[1][i]);
        return [null, arr];
      }
    }
  }

  expandAllConcurrentChildren(args) {
    if (args.length < 1) {
      return [`ALL needs at least 1 arg`, null];
    }
    const mPath = this.composePath(args);
    if (! mPath) {
      return [ `ALL: bad syntax for path: ${this.t.renderTokens(args)}`, null ];
    }
    if (this.mc.exists(mPath)) {
      if (this.mc.isConcurrentParent(mPath)) {
        const state = this.mc.getState(mPath);
        return [null, state.c.map( child => {
          return {name: 'WORD', value: child};
        }) ];
      } else {
        return [`ALL: not a concurrent parent: ${mPath}`, null];
      }
    } else {
      return [ `ALL: no such path: ${mPath}`, null ];
    }
  }

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
}

module.exports = Propagator;
