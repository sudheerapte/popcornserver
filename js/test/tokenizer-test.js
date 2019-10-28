"use strict";

const [log, err, errDiff] = require('./logerr.js');
const Tokenizer = require('../tokenizer.js');
const t = new Tokenizer;

let tokens;
let result, result2, lines, input, tla, nums;
let options, args, num, errMsg;

log(`---- renderToken`);
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
checkToken('ACOMMAND', 8, {name: 'KEYWORD', value: 'ACOMMAND'});
checkToken('{VAR}', 5, {name: 'VARIABLE', value: 'VAR'});
checkToken('A-COMMAND', 1, {name: 'KEYWORD', value: 'A'});
checkToken('  FOUR', 6, {name: 'KEYWORD', value: 'FOUR'});
checkToken('42', 2, {name: 'NUMBER', value: '42'});
checkToken('-42', 3, {name: 'NUMBER', value: '-42'});

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
               {name: 'KEYWORD', value:'ID'},]);
checkTokenize('"some \\"string" ID',
              [{name: 'STRING', value: 'some "string'},
               {name: 'KEYWORD', value:'ID'},]);

checkTokenize('VALUE "some string" ID someword ',
              [{name: 'KEYWORD', value: 'VALUE'},
               {name: 'STRING', value: 'some string'},
              {name: 'KEYWORD', value:'ID'},
               {name: 'WORD', value: 'someword'},]);

checkTokenize('ID someword VALUE "some string"',
              [{name: 'KEYWORD', value:'ID'},
               {name: 'WORD', value: 'someword'},
               {name: 'KEYWORD', value: 'VALUE'},
               {name: 'STRING', value: 'some string'}]);

checkTokenize('{VAR}IDsomeword"some string"',
              [{name: 'VARIABLE', value:'VAR'},
               {name: 'KEYWORD', value:'ID'},
               {name: 'WORD', value: 'someword'},
               {name: 'STRING', value: 'some string'}]);

checkTokenize('A-COMMAND',
              [{name: 'KEYWORD', value: 'A'},
               {name: 'HYPHEN', value: null},
               {name: 'KEYWORD', value: 'COMMAND'},]);

checkTokenize('MARY had a {ADJECTIVE} lamb whose fleece was {{SIMILE}}',
              [
                {name: 'KEYWORD', value: 'MARY'},
                {name: 'WORD', value: 'had'}, {name: 'WORD', value: 'a'},
                {name: 'VARIABLE', value: 'ADJECTIVE'},
                {name: 'WORD', value: 'lamb'}, {name: 'WORD', value: 'whose'},
                {name: 'WORD', value: 'fleece'}, {name: 'WORD', value: 'was'},
                {name: 'MACRO_OPEN', value: null},
                {name: 'KEYWORD', value: 'SIMILE'},
                {name: 'MACRO_CLOSE', value: null},
              ]);

checkTokenize('abc-def-',
              [{name: 'WORD', value: 'abc-def'},
               {name: 'HYPHEN', value: null},]);
checkTokenize('a',
              [{name: 'WORD', value: 'a'},]);

log(`--- paths`);

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


log(`---- tokenize array to produce tla`);
lines = [
  "fooBAR./5+6",
  '"foobar "+5',
  'word5 5word',
];
result = t.tokenize(lines); err(result[0]);
tla = result[1];
errDiff(tla.length, lines.length);
errDiff(tla[0].length, 6);
errDiff(tla[1].length, 2);
errDiff(tla[2].length, 3);

lines = [
  "  ",
  '"foobar "+5',
  'word5 5word',
];
nums = [
  0, 2, 3,
];

countTokens();

function countTokens() {
  result = t.tokenize(lines); err(result[0]);
  tla = result[1];
  errDiff(tla.length, nums.length);
  for (let i=0; i<tla.length; i++) {
    errDiff(tla[i].length, nums[i]);
  }
}

log(`---- tokenize array using continuations`);
lines = [
  "FOO -5",
  "LONG line -",
  "continued over -",
  "3 lines",
];
nums = [2, 6];
countTokens();

log(`---- tokenize array - continuations with errors`);
lines = [
  "FOO -5",
  "LONG line -",
  "continued over -",
  "3 lines-",
];
nums = [2, 6];
result = t.tokenizeArray(lines);
errDiff(result[0], 'ends with continuation -');
