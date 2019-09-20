"use strict";

const [log, err, errDiff] = require('./logerr.js');
const t = require('../tokenizer.js');

let tokens;
let result, result2, lines, input;
let options, args, num, errMsg;

log(`---- renderToken`);
result = t.tokenize("foo foo");
err(result[0]);
result2 = t.renderTokens(result[1]);

result = t.renderTokens([{name: 'WORD', value: "foo"},
                         {name: 'WORD', value: "foo"}]);
errDiff(result, 'foo foo');

result = t.renderTokens({name: 'STRING', value: "foobar"});
errDiff(result, '"foobar"');
result = t.renderTokens({name: 'VARIABLE', value: "T_SERIES"});
errDiff(result, '{T_SERIES}');


log(`---- basic parsing of one token`);

checkToken('"a string"', 10, {name: 'STRING', value: 'a string'});
checkToken(' "a string"', 11, {name: 'STRING', value: 'a string'});
checkToken('"a \\"string"', 12, {name: 'STRING', value: 'a "string'});
checkToken('a-word', 6, {name: 'WORD', value: 'a-word'});
checkToken('a-word-4', 8, {name: 'WORD', value: 'a-word-4'});
checkToken('ACOMMAND', 8, {name: 'COMMAND', value: 'ACOMMAND'});
checkToken('{VAR}', 5, {name: 'VARIABLE', value: 'VAR'});
checkToken('A-COMMAND', 1, {name: 'COMMAND', value: 'A'});
checkToken('  FOUR', 6, {name: 'COMMAND', value: 'FOUR'});
checkToken('42', 2, {name: 'WORD', value: '42'});
checkToken('-42', 3, {name: 'WORD', value: '-42'});

function checkToken(input, wantNum, wantTok) {
  //log(`${' '.repeat(50-input.length)}|${input}| - `);
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

checkTokenize('{VAR}IDsomeword"some string"',
              [{name: 'VARIABLE', value:'VAR'},
               {name: 'COMMAND', value:'ID'},
               {name: 'WORD', value: 'someword'},
               {name: 'STRING', value: 'some string'}]);

checkTokenize('A-COMMAND',
              [{name: 'COMMAND', value: 'A'},
               {name: 'HYPHEN', value: null},
               {name: 'COMMAND', value: 'COMMAND'},]);

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
  //log(`${' '.repeat(50-input.length)}|${input}| - ${wantTokens.length} tokens`);
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
  //log(`${' '.repeat(50-input.length)}|${input}| - should fail at ${index}`);
  let result = t.tokenize(input);
  errDiff(result[0], `bad token at index ${index}`);
}

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
checkFull("{{foo bar}}", [null, "foo bar"]);
checkFull("{{foo {{bar}}", ['No END found', "{{foo bar"]);
checkFull("foo {{bar}}}}", [null, "foo bar}}"]);
log('--');
checkFull("foo {{\"bar}}}}", ["bad token at index 0", "foo {{\"bar}}}}"]);

log(`--------- testTokenize -------------`);

function testTokenize(input, output) {
  //log(`${' '.repeat(30-input.length)}|${input}|     ${JSON.stringify(output)}`);
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
  //log(`${' '.repeat(30-input.length)}|${input}|     ${JSON.stringify(output)}`);
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



log(`---- expand suite`);
function checkExpand(input, output) {
  //log(`${' '.repeat(30-input.length)}|${input}| |${JSON.stringify(output)}|`);
  let result = t.expandOnce(input);
  if (result[0] !== output[0]) {
    err(`expected ${output[0]}, got ${result[0]}`);
  }
  if (result[1] !== output[1]) {
    err(`expected |${output[1]}|, got |${result[1]}|`);
  }
}
checkExpand("foo bar", [null, "foo bar"]);
checkExpand("#fo bar", [null, "#fo bar"]);
checkExpand("{{foo bar}}", [null, "foo bar"]);
checkExpand("{{foo {{bar}}", [null, "{{foo bar"]);
checkExpand("foo {{bar}}}}", [null, "foo bar}}"]);
checkExpand("foo {{\"bar}}}}", ["bad token at index 0", null]);

function checkFull(input, output) {
  //log(`${' '.repeat(30-input.length)}|${input}| |${JSON.stringify(output)}|`);
  let result = t.expand(input);
  if (result[0] !== output[0]) {
    err(`expected ${output[0]}, got ${result[0]}`);
  }
  if (result[1] !== output[1]) {
    err(`expected |${output[1]}|, got |${result[1]}|`);
  }
}

log(`---- consumePath`);
[
  {input: '  ', numConsumed: 0},
  {input: '.a.b.c/d foo', numConsumed: 8},
  {input: '.a.b.c.d',     numConsumed: 8},
  {input: 'a.b.c.d foo',  numConsumed: 0},
  {input: '  a. foo',     numConsumed: 0},
  {input: '   FOO a. foo',  numConsumed: 0},
]
  .forEach( rec => {
    result = t.tokenize(rec.input);
    err(result[0]);
    tokens = result[1];
    errDiff(t.consumePath(tokens), rec.numConsumed);
  });

log(`---- parseRequiredTokens`);

input = 'VALUE "some command" ID tagname NAME click ';
options = { ID: 'WORD', NAME: 'WORD', VALUE: 'STRING or WORD',};
//log(`|${input}|`);
result = t.tokenize(input);
err(result[0]);
tokens = result[1];
result = t.parseRequiredTokens(tokens, options);
err(result[0]);
args = result[1];
//log(args);
errDiff(args.VALUE, "some command");
errDiff(args.ID, "tagname");
errDiff(args.NAME, "click");

input = 'VALUE some words ID "TAGNAME" NAME click ';
options = { VALUE: 'WORDS', NAME: 'WORDS', ID: 'STRING or WORD',};
//log(`|${input}|`);
result = t.tokenize(input);
err(result[0]);
tokens = result[1];
result = t.parseRequiredTokens(tokens, options);
err(result[0]);
args = result[1];
//log(args);
errDiff(args.VALUE[0], "some");
errDiff(args.VALUE[1], "words");
errDiff(args.ID, "TAGNAME");
errDiff(args.NAME[0], "click");

log(`---- expandVars`);
function varLookup(str) {
  const varDict = { FOO: "foo", BAR: "bar" };
  return varDict[str];
}
[errMsg, result, num] = t.expandVars("foo{FOO}.word", varLookup);
errDiff(num, 1);
err(errMsg); errDiff(result, "foo foo.word");

[errMsg, result2, num] = t.expandVars(result, varLookup);
errDiff(num, 0);
err(errMsg); errDiff(result2, "foo foo.word");

