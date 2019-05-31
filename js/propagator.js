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

  runRenderScript(lines) {
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

  // evalBlock - take a list of strings and evaluate them,
  // returning a corresponding list of strings.
  evalBlock(todo) {
    return todo.map( formula => {
      if (!formula) {
        this.log(`evalBlock: formula is empty`);
        return "";
      }
      let result = this.t.process(formula, this.evalFunc);
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
        return [ `CURRENT: bad syntax for path: ${this.printTokens(args)}`, null ];
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
