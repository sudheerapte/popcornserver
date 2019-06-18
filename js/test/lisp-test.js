"use strict";

const [log, err, errDiff] = require('./logerr.js');
const lisp = require('../lisp.js');

let testScript;
let result;
let tok = null;
let tokArr = [];

let tokenTests = [
  { input: "one ", err: null, count: 1 },
  { input: "7928fjknfkjnsakjoiou8^%^*&^ ", err: null, count: 1 },
  { input: "one)", err: null, count: 2 },
  { input: "\"one)\"", err: null, count: 1 },
  { input: "\"one)", err: "bad string token", count: 0 },
  { input: "( one two three)", err: null, count: 5 },
  { input: "( \"one\" two three)", err: null, count: 5 },
  { input: "(\"one\" \"t\"wo three)", err: null, count: 6 },
  { input: "(\"one\"\"two\" three)", err: null, count: 5 },
  { input: "'(\"one\"\"two\" three)", err: null, count: 6 },
  { input: "\"one string\"", err: null, count: 1 },
  { input: "\"one \\\"string\"", err: null, count: 1 },
];  

verifyTokenTests();

function verifyTokenTests() {
  tokenTests.forEach( t => {
    const tokArr = [];
    const result = lisp.tokenize(t.input, tokArr);
    verifyMatchingErr(result, t.err);
    if (tokArr.length!=t.count) {
      log(`bad tokArr length for |${t.input}|:`);
      log(tokArr);
      process.exit(0);
    }
    log(`${" ".repeat(40-t.input.length)}${t.input} => ${tokArr.length}`);
  });
}

function verifyMatchingErr(actual, expected) {
  if (actual === null && expected === null) { return; }
  if (actual === null || expected === null) { errDiff(actual, expected); }
  if (! actual.startsWith(expected)) {
    die(`error = ${actual}; expected ${expected}`);
  }
}

log(`sexp ------------`);

let sexpTests = [
  { input: "one ", err: null, count: 1 },
  { input: "( one two three)", err: null, count: 5 },
  { input: "( one two (three))", err: null, count: 7 },
];  

sexpTests.forEach(t => {
  log(`${" ".repeat(40-t.input.length)}${t.input} => `);
  const tokArr = [];
  const result = lisp.tokenize(t.input, tokArr);
  if (result === t.err) {
    const sexp = [];
    const res = readSexp(tokArr, sexp);
    if (res.hasOwnProperty('length')) {
      log(`            buildSexp: list: |${JSON.stringify(sexp)}|`);
      return;
    }
    if (res < 0) {
      log(`            buildSexp returned ${res}`);
      return;
    } else {
      log(`            buildSexp: single item: |${JSON.stringify(sexp)}|`);
    }
  }
});

function readSexp(tokArr, outArr) { // return length of sexp or single token
  if (! tokArr || tokArr.length <= 0) {
    return -1;
  }
  if (tokArr[0].name === '(') {
    const result = lisp.buildSexp(tokArr.slice(1), outArr);
    return result;
  } else {
    outArr.push(lisp.renderToken(tokArr[0]));
    return lisp.renderToken(tokArr[0]);
  }
}
