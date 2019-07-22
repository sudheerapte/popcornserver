"use strict";

const [log, err, errDiff] = require('./logerr.js');
const t = require('../tokenizer.js');

let tokens;
let result, lines;
let options, args;

log(`---- renderToken`);
result = t.renderTokens({name: 'STRING', value: "foobar"});
errDiff(result, '"foobar"');

log(`---- basic parsing of one token`);

checkToken('"a string"', 10, {name: 'STRING', value: 'a string'});
checkToken(' "a string"', 11, {name: 'STRING', value: 'a string'});
checkToken('"a \\"string"', 12, {name: 'STRING', value: 'a "string'});
checkToken('a-word', 6, {name: 'WORD', value: 'a-word'});
checkToken('a-word-4', 8, {name: 'WORD', value: 'a-word-4'});
checkToken('ACOMMAND', 8, {name: 'COMMAND', value: 'ACOMMAND'});
checkToken('A-COMMAND', 1, {name: 'COMMAND', value: 'A'});
checkToken('  FOUR', 6, {name: 'COMMAND', value: 'FOUR'});

function checkToken(input, wantNum, wantTok) {
  log(`${' '.repeat(50-input.length)}|${input}| - `);
  let tok = {};
  let result = t.consumeOneToken(input, tok);
  errDiff(result[0], wantNum);
  if (wantTok) {
    errDiff(result[1].name, wantTok.name);
    errDiff(result[1].value, wantTok.value);
  }
}

log(`---- tokenize strings`);
checkTokenize('"some string" ID',
              [{name: 'STRING', value: 'some string'},
               {name: 'COMMAND', value:'ID'},]);
checkTokenize('"some \\"string" ID',
              [{name: 'STRING', value: 'some "string'},
               {name: 'COMMAND', value:'ID'},]);

checkTokenize('VALUE "some string" ID someword ',
              [{name: 'COMMAND', value: 'VALUE'},
               {name: 'STRING', value: 'some string'},
              {name: 'COMMAND', value:'ID'},
               {name: 'WORD', value: 'someword'},]);

checkTokenize('ID someword VALUE "some string"',
              [{name: 'COMMAND', value:'ID'},
               {name: 'WORD', value: 'someword'},
               {name: 'COMMAND', value: 'VALUE'},
               {name: 'STRING', value: 'some string'}]);

checkTokenize('A-COMMAND', [
  {name: 'COMMAND', value: 'A'},
  {name: 'HYPHEN', value: null},
  {name: 'COMMAND', value: 'COMMAND'},
]);

['.a.b.c/d', ' .a . b .c/  d ', '. a . b. c /  d '].forEach( line => {
  checkTokenize(line, [
    {name: 'DOT', value: null},
    {name: 'WORD', value:'a'},
    {name: 'DOT', value: null},
    {name: 'WORD', value:'b'},
    {name: 'DOT', value: null},
    {name: 'WORD', value:'c'},
    {name: 'SLASH', value: null},
    {name: 'WORD', value:'d'},]);
});

function checkTokenize(input, wantTokens) {
  log(`${' '.repeat(50-input.length)}|${input}| - ${wantTokens.length} tokens`);
  let result = t.tokenize(input);
  err(result[0]);
  tokens = result[1];
  for (let i=0; i<wantTokens.length; i++) {
    if (! t.equal(wantTokens[i], tokens[i])) {
      err(`got: ${JSON.stringify(tokens[i])}. wanted: ${JSON.stringify(wantTokens[i])}`);
    }
  }
}

checkTokenizeFailure('foo"', 3);
checkTokenizeFailure('foo\\"', 3);
checkTokenizeFailure('"foo\\"', 0);

function checkTokenizeFailure(input, index) {
  log(`${' '.repeat(50-input.length)}|${input}| - should fail at ${index}`);
  let result = t.tokenize(input);
  errDiff(result[0], `bad token at index ${index}`);
}

log(`---- parseRequiredTokens`);
options = { ID: 'WORD', NAME: 'WORD', VALUE: 'STRING or WORD',};
checkRequiredTokens('VALUE "some command" ID tagname NAME click ',
                    null,
                    "ID",
                    "NAME");

checkRequiredTokens('ID tagname NAME click random VALUE "some command"',
                    'bad option: random');

function checkRequiredTokens(input, wantResult, wantOne, wantTwo) {
  log(`${' '.repeat(50-input.length)}|${input}| - `);
  result = t.tokenize(input);
  err(result[0]);
  tokens = result[1];
  result = t.parseRequiredTokens(tokens, options);
  errDiff(result[0], wantResult);
  args = result[1];
  if (wantOne) { err(args[wantOne]); }
  if (wantTwo) { err(args[wantTwo]); }
}


process.exit(0);

log(`---- splitSections: easy version`);
lines = [
  "% abc",
  "foo",
  "bar",
  "",
  "% def",
  "foo",
  "bar",
];
result = t.splitSections(lines);
errDiff(result.length, 2);
errDiff(result[0].section, "abc");
errDiff(result[0].lines.length, 3);
errDiff(result[1].section, "def");
errDiff(result[1].lines.length, 2);

log(`---- splitSections: hard versions`);
lines = [
  "",
  "% abc",
  "% def",
  "foo",
  "bar",
  "foo",
  "bar",
];
result = t.splitSections(lines);
errDiff(result.length, 2);
errDiff(result[0].section, "abc");
errDiff(result[0].lines.length, 0);
errDiff(result[1].section, "def");
errDiff(result[1].lines.length, 4);

lines = [
  "% abc",
  "foo",
  "bar",
  "foo",
  "bar",
  "% def",
];
result = t.splitSections(lines);
if (Array.isArray(result)) {
  err(`expecting a string, got an array: ${JSON.stringify(result)}`);
}
if (! result.match(/^splitSections/)) {
  err(`expecting error string, got: ${result}`);
}

log(`--------- full process -------------`);
checkFull("foo bar", [null, "foo bar"]);
checkFull("#fo bar", [null, "#fo bar"]);
checkFull("{{foo bar}}", [null, "foobar"]);
checkFull("{{foo {{bar}}", ['No END found', "{{foo bar"]);
checkFull("foo {{bar}}}}", [null, "foo bar}}"]);
log('--');
checkFull("foo {{\"bar}}}}", ["bad token at index 0", "foo {{\"bar}}}}"]);

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
testTokenize("\"DUMMY foo.bar", ["bad token at index 0", '"DUMMY foo.bar']);
testTokenize("\"DUMMY\nfoo\n.bar", ["bad token at index 0", "DUMMY\nfoo\n.bar"]);

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
checkProcess("foo {{\"bar}}}}", ["bad token at index 0", null]);

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


