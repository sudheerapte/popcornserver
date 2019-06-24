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
  { input: "\"on\\e\"", err: null, count: 1, value0: "one" },
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

log(`---- verify token tests`);
verifyTokenTests();

function verifyTokenTests() {
  tokenTests.forEach( t => {
    const tokArr = [];
    const result = lisp.tokenize(t.input, tokArr);
    verifyMatchingErr(result, t.err);
    if (tokArr.length!=t.count) {
      log(`bad tokArr length for |${t.input}|: ${tokArr.length}`);
      process.exit(0);
    }
    if (t.value0) { errDiff(tokArr[0].value, t.value0); }
    if (t.value0) {
      log(`${" ".repeat(40-t.input.length)}${t.input} => ${tokArr.length} |${tokArr[0].value}|`);
    } else {
      log(`${" ".repeat(40-t.input.length)}${t.input} => ${tokArr.length}`);
    }
  });
}

function verifyMatchingErr(actual, expected) {
  if (actual === null && expected === null) { return; }
  if (actual === null || expected === null) { errDiff(actual, expected); }
  if (! actual.startsWith(expected)) {
    die(`error = ${actual}; expected ${expected}`);
  }
}

log(`---- verify tokenize and renderToken cycle`);

let cycleTests = [
  "a b c ",
  'a()b\"foo" c ',
  'a()b"f\oo" c ',
  'a()b"f\\\\oo" c ',
];

cycleTests.forEach( input => {
  const tokArr = [];
  const result = lisp.tokenize(input, tokArr);
  err(result);
  const rendered = lisp.renderToken(tokArr);
  const tokArr2 = [];
  const cycleResult = lisp.tokenize(rendered, tokArr2);
  err(result);
  const secondRendered = lisp.renderToken(tokArr2);
  errDiff(rendered, secondRendered);
  log(`${" ".repeat(40-rendered.length)}${rendered} => |${secondRendered}|`);
});


log(`sexp ------------`);

let sexpTests = [
  { input: "'(one) ", err: null, count: 4 },
  { input: "'one ", err: null, count: -1 },
  { input: "'(one ", err: null, count: -1 },
  { input: "''(one) ", err: null, count: -1 },
  { input: "one'two ", err: null, count: 1 },
  { input: "one ", err: null, count: 1 },
  { input: "( one two three)", err: null, count: 5 },
  { input: "( one two (three))", err: null, count: 7 },
  { input: "( one(two(three four)))", err: null, count: 10 },
  { input: "(one ", err: null, count: 0 },
];  

sexpTests.forEach(t => {
  const tokArr = [];
  const result = lisp.tokenize(t.input, tokArr);
  if (result === t.err) {
    const sexpArr = [];
    const res = lisp.growSexp(tokArr, sexpArr);
    if (res === t.count) {
      const sexp = sexpArr[0];
      const stArr = [];
      const r = lisp.tokenizeSexp(sexp, stArr);
      if (r === null) {
        log(`${" ".repeat(35-t.input.length)}${t.input} => |${lisp.renderToken(stArr)}|`);
      } else {
        log(`${" ".repeat(35-t.input.length)}${t.input} => tokenizeSexp returned: ${r}`);
      }
    } else {
      log(`${" ".repeat(35-t.input.length)}${t.input} => growSexp returned ${res}`);
    }
  } else {
    errDiff(result, t.err);
  }
});

