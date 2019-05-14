"use strict";

const Machine = require('./machine.js');

/**
   @function(tokenize) - parse string and return [errMsg, tokenArray ]
*/

const TOKENS = [
  { re: /^{{/,   type: 'BEGIN',   makeToken: true, useValue: false },
  { re: /^}}/,   type: 'END',     makeToken: true, useValue: false },
  { re: /^\s+/,  type: 'SPACES',  makeToken: false, useValue: false },
  { re: /^[A-Z]+/, type: 'COMMAND', makeToken: true, useValue: true },
  { re: /^[a-z]+[a-z0-9]*/, type: 'WORD', makeToken: true, useValue: true },
  { re: /^[0-9]+/, type: 'NUMBER', makeToken: true, useValue: true },
  { re: /^\./,    type: 'DOT',     makeToken: true, useValue: false },
  { re: /^\//,    type: 'SLASH',   makeToken: true, useValue: false },
];

function tokenize(machine, str) {
  let arr = [];
  if (! str) {
    return [ "string is null", arr ];
  }
  let ch;
  for (let i=0; i<str.length; i++) {
    const s = str.slice(i);
    let m;
    let found = false;
    TOKENS.forEach( rec => {
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

function printTokens(arr) {
  let str = '';
  arr.forEach( tok => {
    if (tok) {
      if (tok.name === 'WORD') {
        str += ` "${tok.value}"`;
      } else if (tok.name === 'COMMAND') {
        str += ` ${tok.value}`;
      } else {
        str += ' ' + tok.name;
      }
    } else {
      str += ' (null)';
    }
  });
  return str;
}

/**
   @function(evaluate) - take token array and return [ errMsg, results ]
*/

function evaluate(machine, tokenArray) {
  if (tokenArray.length === 0) {
    return [ null ];
  }
  if (tokenArray.length === 1) {
    return [ tokenArray[0] ];
  }
  if (tokenArray[0].name === 'BEGIN' && tokenArray[tokenArray.length-1] === 'END') {
    return evaluate(machine, tokenArray.slice(1, tokenArray.length-1));
  }
  if (tokenArray[0].name === 'COMMAND') {
    return executeCommand(machine, tokenArray[0].value, tokenArray.slice(1));
  }
}

function executeCommand(machine, cmd, args) {
  if (cmd === 'EXISTS') {
    const mPath = composePath(args);
    if (! mPath) {
      return [ `bad syntax for path: ${printTokens(args)}`, null ];
      if (machine.containsPath(mPath)) {
        return [ null, 1 ];
      } else {
        return [ null, 0 ];
      }
    }
  }
}

function composePath(args) {
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

module.exports = {
  tokenize: tokenize,
  printTokens: printTokens,
};
