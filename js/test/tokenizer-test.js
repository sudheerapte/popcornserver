"use strict";

const [log, err, errDiff] = require('./logerr.js');
const t = require('../tokenizer.js');

let tokens;
let result, lines;

log(`---- splitPercentSections: easy version`);
lines = [
  "% abc",
  "foo",
  "bar",
  "% def",
  "foo",
  "bar",
];
result = t.splitPercentSections(lines);
errDiff(result.length, 2);
errDiff(result[0].section, "abc");
errDiff(result[0].lines.length, 2);
errDiff(result[1].section, "def");
errDiff(result[1].lines.length, 2);

log(`---- splitPercentSections: hard versions`);
lines = [
  "% abc",
  "% def",
  "foo",
  "bar",
  "foo",
  "bar",
];
result = t.splitPercentSections(lines);
errDiff(result.length, 2);
errDiff(result[0].section, "abc");
errDiff(result[0].lines.length, 0);
errDiff(result[1].section, "def");
errDiff(result[1].lines.length, 4);

log(JSON.stringify(result));

lines = [
  "% abc",
  "foo",
  "bar",
  "foo",
  "bar",
  "% def",
];
result = t.splitPercentSections(lines);
if (Array.isArray(result)) {
  err(`expecting a string, got an array: ${JSON.stringify(result)}`);
}
if (! result.match(/^percentSections/)) {
  err(`expecting error string, got: ${result}`);
}


log(`--------- full process -------------`);
checkFull("foo bar", [null, "foo bar"]);
checkFull("#fo bar", [null, "#fo bar"]);
checkFull("{{foo bar}}", [null, "foobar"]);
checkFull("{{foo {{bar}}", ['No END found', "{{foo bar"]);
checkFull("foo {{bar}}}}", [null, "foo bar}}"]);
checkFull("foo {{\"bar}}}}", [null, "foo bar}}"]);

log(`--------- testTokenize -------------`);

function testTokenize(input, output) {
  log(`${' '.repeat(30-input.length)}|${input}|     ${JSON.stringify(output)}`);
  let result = t.tokenize(input);
  if (result[0] !== output[0]) {
    err(`result should be ${output[0]}, but got: ${result[0]}`);
  }
  if (! result[0]) {
    const str = t.renderTokens(result[1]);
    if (str !== output[1]) {
      err(`expected |${output[1]}|, got |${str}|`);
    }
  }
}

testTokenize("DUMMY foo.bar", [null, "DUMMYfoo.bar"]);
testTokenize("\"DUMMY foo.bar", [null, "DUMMY foo.bar"]);
testTokenize("\"DUMMY\nfoo\n.bar", [null, "DUMMY\nfoo\n.bar"]);

log(`---- scanString suite`);
function checkScan(input, output) {
  log(`${' '.repeat(30-input.length)}|${input}|     ${JSON.stringify(output)}`);
  let result = t.scanString(input);
  if (result[0] !== output[0] || result[1] !== output[1]) {
    err(`input |${input}| should produce |${output}|, got |${result}|`);
  }
}
checkScan("foo bar", [-1, -1]);
checkScan("foo }}bar}}", [ -1, 4]);
checkScan("foo {{bar", [ 4, -1 ]);
checkScan("foo {{bar}}", [ 4, 9 ]);
checkScan("foo {{bar}}}}", [ 4, 9 ]);
checkScan("foo {{{{bar}}", [ 6, 11 ]);
checkScan("foo {{{{bar}}}}", [ 6, 11 ]);
checkScan("foo \\{{bar}}", [ 5, 10 ]);
checkScan("foo {{bar\\}}", [ 4, 10 ]);
checkScan("foo {bar}}", [ -1, 8 ]);
checkScan("foo \"{bar}}", [ -1, 9 ]);
checkScan("foo {{bar\"}}", [ 4, 10 ]);
checkScan("#fo {{bar\"}}", [ 4, 10 ]);



log(`---- test 10: process suite`);
function checkProcess(input, output) {
  log(`${' '.repeat(30-input.length)}|${input}| |${JSON.stringify(output)}|`);
  let result = t.processOnce(input);
  if (result[0] !== output[0]) {
    err(`expected ${output[0]}, got ${result[0]}`);
  }
  if (result[1] !== output[1]) {
    err(`expected |${output[1]}|, got |${result[1]}|`);
  }
}
checkProcess("foo bar", [null, "foo bar"]);
checkProcess("#fo bar", [null, "#fo bar"]);
checkProcess("{{foo bar}}", [null, "foobar"]);
checkProcess("{{foo {{bar}}", [null, "{{foo bar"]);
checkProcess("foo {{bar}}}}", [null, "foo bar}}"]);
checkProcess("foo {{\"bar}}}}", [null, "foo bar}}"]);

function checkFull(input, output) {
  log(`${' '.repeat(30-input.length)}|${input}| |${JSON.stringify(output)}|`);
  let result = t.process(input);
  if (result[0] !== output[0]) {
    err(`expected ${output[0]}, got ${result[0]}`);
  }
  if (result[1] !== output[1]) {
    err(`expected |${output[1]}|, got |${result[1]}|`);
  }
}


