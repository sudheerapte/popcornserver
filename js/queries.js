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
  { re: /^[a-z]+[a-z0-9]+/, type: 'WORD', makeToken: true, useValue: true },
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
    m = s.match(/^{{/);
    if (m) {
      i++;
      arr.push({name: 'BEGIN', value: '{{'});
      continue;
    }
    m = s.match(/^}}/);
    if (m) {
      i++;
      arr.push({name: 'END', value: '}}'});
      continue;
    }
    m = s.match(/^\s+/);
    if (m) {
      i += m[0].length - 1;
      continue;
    }
    m = s.match(/^[A-Z]+/);
    if (m) {
      i += m[0].length - 1;
      arr.push({name: 'COMMAND', value: m[0]});
      continue;
    }
    m = s.match(/^[a-z]+[a-z0-9-]+/);
    if (m) {
      i += m[0].length - 1;
      arr.push({name: 'WORD', value: m[0]});
      continue;
    }
    m = s.match(/^[0-9]+/);
    if (m) {
      i += m[0].length - 1;
      arr.push({name: 'NUMBER', value: m[0]});
      continue;
    }
    if (s.charAt(0) === '.') {
      arr.push({name: 'DOT', value: '.'});
      continue;
    }
    if (s.charAt(0) === '/') {
      arr.push({name: 'SLASH', value: '/'});
      continue;
    }
    return [`bad char ${s.charAt(0)} at index ${i}`, arr];
  }
  return [ null, arr];
}

/**
   @function(evaluate) - take token array and return [ errMsg, value ]
*/

function evaluate(machine, tokenArray) {
  if (tokenArray.length === 0) {
    return null;
  }
  if (tokenArray.length === 1) {
    return tokenArray[0];
  }
  if (tokenArray[0].name === 'BEGIN' && tokenArray[tokenArray.length-1] === 'END') {
    return evaluate(machine, tokenArray.slice(1, tokenArray.length-1));
  }

}

module.exports = {
  tokenize: tokenize,
  
};
