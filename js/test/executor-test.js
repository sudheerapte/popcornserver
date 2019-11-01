"use strict";

const [log, err, errDiff] = require('./logerr.js');
const Parser = require('../parser.js');
const Tokenizer = require('../tokenizer.js');
const t = new Tokenizer;
const Machine = require('../machine.js');
const Executor = require('../executor.js');


let e, p, lines, tla;
let mc;
let tokens, num;
let evalFunc;

let result;
let input, options, args;
let initScript, renderScript, arr;
let boardScript, errMsg;
let clauses, sArr, sArr1, sArr2, withClause;

let block, blocks, temp, proc, procs;

log(`---- runLines with command errors`);
mc = new Machine;
lines = [
  "DEF ROOT x y z",
  "",
];

e = new Executor(mc, t, new Parser(t), log);
errMsg = e.runLines(lines);
errDiff(errMsg, 'DEF ROOT: bad option: x');

log(`---- runLines`);
mc = new Machine;
lines = [
  "DEF ROOT CHILDREN x y z",
  "DEF CON PARENT .x CHILDREN a b c",
  "DEF ALT PARENT .y CHILDREN a b c",
  "",
];

e = new Executor(mc, t, new Parser(t), log);
e.runLines(lines);
err(mc.exists('.y/a'));
err(mc.exists('.y/b'));


log(`---- runLines varDict`);
mc = new Machine;
lines = [
  "DEF ROOT CHILDREN x {FOO} z",
  "DEF CON PARENT .x CHILDREN a b c",
  "DEF ALT PARENT .{FOO} CHILDREN a b c",
  "",
];

e = new Executor(mc, t, new Parser(t), log);
e.runLines(lines, varName => {
  if (varName === 'FOO') {return {name: 'WORD', value: 'y'}; }
  else { return null; }
});

err(mc.exists('.y/a'));
err(mc.exists('.y/b'));

log(`---- evaluate PLAIN`);
mc = new Machine;
result = mc.interpret(["addLeaf . board", "addLeaf .board . a", "addLeaf .board . b", "addLeaf .board . c"]); err(result);
err(mc.exists('.board.a'));

lines = [
  "% abc",
  "DEF ROOT CHILDREN pos",
  "DEF CON PARENT .pos CHILDREN a b c",
  "% def",
  "DEF CON PARENT .pos CHILDREN a b c",
  "",
];

e = new Executor(mc, t, new Parser(t), log);
e.buildProcsMap(lines);
e.execProc("abc");
['.pos', '.pos.a'].forEach( p => {
  err(mc.exists(p));
});

log(`---- evaluate PLAIN varDict`);
mc = new Machine;
result = mc.interpret(["addLeaf . board", "addLeaf .board . a", "addLeaf .board . b", "addLeaf .board . c"]); err(result);
err(mc.exists('.board.a'));

lines = [
  "% abc",
  "DEF ROOT CHILDREN pos",
  "DEF CON PARENT .pos CHILDREN a {BEE} c",
  "% def",
  "DEF CON PARENT .pos CHILDREN a {BEE} c",
  "",
];

e = new Executor(mc, t, new Parser(t), log);
e.buildProcsMap(lines);
e.execProc("abc", varName => {
  if (varName === 'BEE') {return {name: 'WORD', value: 'b'}; }
  else { return null; }
});

['.pos', '.pos.b'].forEach( p => {
  err(mc.exists(p));
});

log(`---- evaluate PLAIN varDict with unexpanded error`);
mc = new Machine;
result = mc.interpret(["addLeaf . board", "addLeaf .board . a", "addLeaf .board . b", "addLeaf .board . c"]); err(result);
err(mc.exists('.board.a'));

lines = [
  "% abc",
  "DEF ROOT CHILDREN pos",
  "DEF CON PARENT .pos CHILDREN a {BEE} {CEE}",
  "% def",
  "DEF CON PARENT .pos CHILDREN a {BEE} c",
  "",
];

e = new Executor(mc, t, new Parser(t), log);
e.buildProcsMap(lines);
result = e.execProc("abc", varName => {
  if (varName === 'BEE') {return {name: 'WORD', value: 'b'}; }
  else { return null; }
});
errDiff(typeof result, 'string');
if (! result.match(/unexpanded/)) {
  err(`expected unexpanded`);
}

log(`---- evaluate FORALL`);

mc = new Machine;
result = mc.interpret(["addLeaf . board", "addLeaf .board . a", "addLeaf .board . b", "addLeaf .board . c"]); err(result);

lines = [
  "% def",
  "DEF ROOT CHILDREN pos",
  "FORALL ALL .board.POS BEGIN",
  "DEF CON PARENT .pos CHILDREN {POS}",
  "END",
];

e = new Executor(mc, t, new Parser(t), log);
e.buildProcsMap(lines);
result = e.execProc("def"); err(result);
err(mc.exists(".pos.b"));




log(`---- evaluate ON`);

mc = new Machine;

lines = [
  "% INIT",
  "DEF ROOT CHILDREN is-current curr",
  "DEF ALT PARENT .is-current CHILDREN a b",
  "DEF ALT PARENT .curr CHILDREN a b",
  "% set-is-current",
  "ON IS_CURRENT .curr a BEGIN",
  "SET CURRENT PARENT .is-current CHILD a",
  "END",
  "ON IS_CURRENT .curr b BEGIN",
  "SET CURRENT PARENT .is-current CHILD b",
  "END",
];

e = new Executor(mc, t, new Parser(t), log);
e.buildProcsMap(lines);
result = e.execProc("INIT"); err(result);
result = e.execProc("set-is-current"); err(result);
errDiff(mc.getCurrent(".is-current")[1], "a");
log(`----          setting .curr/b`);
result = mc.interpret(["setCurrent .curr b"]); err(result);
result = e.execProc("set-is-current"); err(result);
errDiff(mc.getCurrent(".is-current")[1], "b");


log(`---- expand`);

mc = new Machine;
result = mc.interpret(["addLeaf . pos", "addLeaf .pos / a", "addLeaf .pos / b", "addLeaf .pos / c"]); err(result);
errDiff(mc.getCurrent('.pos')[1], 'a');

lines = [
  { input: "{{FOO{{CURRENT .pos}} .pos}}",
    errMsg: 'bad query: FOO',
    output: null },
  { input: "{{CURRENT .pos}}",
    errMsg: null,
    output: "a" },
  { input: "SET DATAW PATH .board WORDS {{CURRENT .pos}}",
    errMsg: null,
    output: "SET DATAW PATH.boardWORDSa" },
  { input: "SET DATAW PATH .board WORDS {{FOO .pos}}",
    errMsg: 'bad query: FOO',
    output: null },
  { input: "SET DATAW PATH .board WORDS {{CURRENT .pos}}{{FOO .pos}}",
    errMsg: 'bad query: FOO',
    output: null },
  { input: "SET DATAW PATH .board WORDS {{CURRENT {{FOO .pos}}.pos}}",
    errMsg: 'bad query: FOO',
    output: null },
  { input: "SET DATAW PATH .board WORDS {{foo .pos}}",
    errMsg: 'query must be KEYWORD: WORD',
    output: null },
];

e = new Executor(mc, t, new Parser(t), log);
lines.forEach( rec => {
  const tokList = t.tokenize(rec.input)[1];
  result = e.expand(tokList);
  errDiff(result[0], rec.errMsg);
  if (! result[0]) {
    const output = t.renderTokens(result[1]);
    errDiff(output, rec.output);
  }
});
  

