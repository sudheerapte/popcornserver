"use strict";

class Queries {

  // scanString: return [-1 -1] if no BEGIN or END.
  // return [B, E] where E = first END and B = last BEGIN before END.
  // return [-2, 0] if END was found before BEGIN.
  // return [-2, -2] if BEGIN was found but no END was found.
  scanString(str) {
    const BEGIN=/(?<!\\){{/; const END=/(?<!\\)}}/;
    const EITHER=/(?<!\\){{|(?<!\\)}}/g;
    const m = str.match(EITHER);
    if (!m) { return [-1, -1]; }
    let foundEnd = -1;
    let foundBegin = -1;
    let offset = 0; // starting point of remainingStr
    for (let i=0; i<m.length; i++) {
      if (m[i].match(BEGIN)) {
        const remainingStr = str.slice(offset);
        const index = remainingStr.search(BEGIN);
        if (index < 0) {
          throw(new Error(`internal error! impossible`));
        }
        foundBegin = index+offset;
        offset = foundBegin;
      } else {
        const remainingStr = str.slice(offset);
        const index = remainingStr.search(END);
        if (index < 0) {
          throw(new Error(`internal error! impossible`));
        }
        foundEnd = index+offset;
        offset = foundEnd;
        break;
      }
    }
    if (foundBegin < 0) {
      return [-1, foundEnd];
    }
    if (foundEnd < 0) {
      return [foundBegin, -1];
    }
    return [ foundBegin, foundEnd ];
  }

  tokenize(machine, str) {
    // RULES - parsing rules for different types of tokens
    const RULES = [
      { re: /^{{/,   type: 'BEGIN',   makeToken: true, useValue: false },
      { re: /^}}/,   type: 'END',     makeToken: true, useValue: false },
      { re: /^\s+/,  type: 'SPACES',  makeToken: false, useValue: false },
      { re: /^[A-Z]+/, type: 'COMMAND', makeToken: true, useValue: true },
      { re: /^[a-z]+[a-z0-9]*/,type: 'WORD',makeToken: true,useValue: true },
      { re: /^[0-9]+/, type: 'NUMBER', makeToken: true, useValue: true },
      { re: /^\./,    type: 'DOT',     makeToken: true, useValue: false },
      { re: /^\//,    type: 'SLASH',   makeToken: true, useValue: false },
    ];
    let arr = [];
    if (! str) {
      return [ "string is null", arr ];
    }
    let ch;
    for (let i=0; i<str.length; i++) {
      const s = str.slice(i);
      let m;
      let found = false;
      RULES.forEach( rec => {
        if (found) { return; }
        m = s.match(rec.re);
        if (m) {
          // console.log(`i = ${i}: matched ${rec.re}`);
          found = true;
          i += m[0].length - 1;
          if (rec.makeToken) {
            arr.push({name: rec.type, value: (rec.useValue ? m[0] : null)});
          }
        }
      });
      if (! found) {
        return [`bad char ${s.charAt(0)} at index ${i}`, arr];
      }
    }
    return [ null, arr];
  }

  printTokens(arr) {
    if (! arr) { return " (null)"; }

    if (arr.hasOwnProperty('length')) {
      let str = '';
      arr.forEach( (tok,i) => {
        if (tok.name === 'STRING' && i > 0) {
          str += "|";
        }
        str += printTok(tok);
      });
      return str;
    } else {
      return printTok(arr);
    }

    function printTok(tok) {
      if (tok) {
        if (tok.name === 'WORD') {
          return ` "${tok.value}"`;
        } else if (tok.name === 'COMMAND') {
          return ` ${tok.value}`;
        } else if (tok.name === 'STRING') {
          return tok.value;
        } else {
          return ' ' + tok.name;
        }
      } else {
        return ' (null)';
      }
    }
  }

  /**
     @function(evaluate) - take token array and return [ errMsg, results ]
  */

  evaluate(machine, tokenArray) {
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
        let subEval = this.evaluate(machine, tokenArray.slice(i+1, i+j));
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
          return this.evaluate(machine, newArray);
        }
      } else {
        return [`BEGIN without END`, null];
      }
    }

    if (tokenArray[0].name === 'BEGIN' && tokenArray[tokenArray.length-1] === 'END') {
      return this.evaluate(machine, tokenArray.slice(1, tokenArray.length-1));
    }
    if (tokenArray[0].name === 'COMMAND') {
      const result = this.executeCommand(machine, tokenArray[0].value, tokenArray.slice(1));
      return result;
    }
  }

  executeCommand(machine, cmd, args) {
    if (cmd === 'EXISTS') {
      const mPath = this.composePath(args);
      if (! mPath) {
        return [ `bad syntax for path: ${this.printTokens(args)}`, null ];
      }
      if (machine.exists(mPath)) {
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
      if (machine.exists(mPath)) {
        if (machine.isVariableParent(mPath)) {
          const curr = machine.getCurrentChildName(mPath);
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
        return [ `DATA: bad syntax for path: ${this.printTokens(args)}`, null ];
      }
      if (machine.exists(mPath)) {
        if (machine.isDataLeaf(mPath)) {
          const data = machine.getData(mPath);
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

module.exports = Queries;
