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

log(`---- evaluate PLAIN`);

mc = new Machine;
result = mc.interpret(["P .board.a", "P .board.b", "P .board.c"]); err(result);
err(mc.exists('.board.a'));

lines = [
  "% abc",
  "DEF CON PARENT .pos CHILDREN a b c",
  "% def",
  "DEF CON PARENT .pos CHILDREN a b c",
  "",
];

e = new Executor(mc, t, new Parser(t), log);
e.buildProcsMap(lines);
e.execProc("abc");
err(mc.exists('.pos.a'));
err(mc.exists('.pos.b'));
err(mc.exists('.pos.c'));

log(`---- evaluate WITH`);

mc = new Machine;
result = mc.interpret(["P .board.a", "P .board.b", "P .board.c"]); err(result);

lines = [
  "% def",
  "WITH ALL .board.POS BEGIN",
  "DEF CON PARENT .pos CHILDREN {POS}",
  "END",
];

e = new Executor(mc, t, new Parser(t), log);
e.buildProcsMap(lines);
result = e.execProc("def"); err(result);
err(mc.exists(".pos.b"));


log(`---- evaluate ON`);

mc = new Machine;
result = mc.interpret(["P .curr/a", "P .curr/b"]); err(result);

lines = [
  "% set-is-current",
  "DEF ALT PARENT .is-current CHILDREN a b",
  "ON IS_CURRENT .curr a BEGIN",
  "SET CURRENT PARENT .is-current CHILD a",
  "END",
  "ON IS_CURRENT .curr b BEGIN",
  "SET CURRENT PARENT .is-current CHILD b",
  "END",
];

e = new Executor(mc, t, new Parser(t), log);
e.buildProcsMap(lines);
result = e.execProc("set-is-current"); err(result);
errDiff(mc.getCurrentChildName(".is-current"), "a");
log(`----          setting .curr/b`);
result = mc.interpret(["C .curr b"]); err(result);
result = e.execProc("set-is-current"); err(result);
errDiff(mc.getCurrentChildName(".is-current"), "b");

log(`---- expand`);

mc = new Machine;
result = mc.interpret(["P .pos/a", "P .pos/b", "P .pos/c"]); err(result);
errDiff(mc.getCurrentChildName('.pos'), 'a');

lines = [
  { input: "{{CURRENT .pos}}", errMsg: null, output: "a" },
  { input: "SETW .board {{CURRENT .pos}}", errMsg: null, output: "SETW" },
];

e = new Executor(mc, t, new Parser(t), log);
lines.forEach( rec => {
  result = e.expand(t.tokenize(rec.input)[1]);
  errDiff(result[0], rec.errMsg);
  if (! result[0]) {
    let word;
    if (Array.isArray(result[1])) {
      word = result[1][0].value;
    } else {
      word = result[1].value;
    }
    errDiff(word, rec.output);
  }
});
  

process.exit(0);



log(`---- buildBlocks`);

p = new Parser(t);
result = t.tokenize(lines); err(result[0]);
tla = result[1];
procs = p.buildProcContentMap(tla);
result = p.buildBlocks(procs.get("abc")); err(result);
errDiff(result.length, 1);
block = result[0];
errDiff(block.header.length, 1);
errDiff(block.header[0].length, 3);
errDiff(block.numLists, 4);
errDiff(block.header.length, 1);
errDiff(block.tla.length, 1);

log(`---- splitSections`);
lines = [
  "% abc",
  "foo",
  "bar",
  "",
  "[ empty-section ]",
  "[ DEF]",
  "foo",
  "bar",
];
p = new Parser(t);
result = t.tokenize(lines); err(result[0]);
tla = result[1];

result = p.splitSections(tla); // get array of sections
errDiff(typeof result, "object");
errDiff(result[0].section, "abc");
errDiff(result[0].tla.length, 3);
errDiff(result[1].section, "empty-section");
errDiff(result[1].tla.length, 0);
errDiff(result[2].section, "DEF");
errDiff(result[2].tla.length, 2);

log(`---- buildProcContentMap`);
result = p.buildProcContentMap(tla); // get Map of tla
errDiff(result.get("abc").length, 3);
errDiff(result.get("DEF").length, 2);


log(`---- parseRequiredTokens`);

input = 'VALUE "some command" ID tagname NAME click ';
options = { ID: 'WORD', NAME: 'WORD', VALUE: 'STRING or WORD',};
//log(`|${input}|`);
result = t.tokenize(input);
err(result[0]);
tokens = result[1];
result = p.parseRequiredTokens(tokens, options);
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
result = p.parseRequiredTokens(tokens, options);
err(result[0]);
args = result[1];
//log(args);
errDiff(args.VALUE[0], "some");
errDiff(args.VALUE[1], "words");
errDiff(args.ID, "TAGNAME");
errDiff(args.NAME[0], "click");


log(`---- substVars`);
function varLookup(str) {
  const varDict = { FOO: "foo", BAR: "bar" };
  if (varDict.hasOwnProperty(str)) {
    return {name: 'WORD', value: varDict[str]};
  } else {
    return null;
  }
}
result = t.tokenize("foo{FOO}.word"); err(result[0]);
input = result[1];
[num, result] = p.substVars(input, varLookup);
errDiff(num, 1);
err(errMsg);
errDiff(result[0].name, "WORD");
errDiff(result[1].name, "WORD"); errDiff(result[1].value, "foo");
errDiff(result[2].name, "DOT");
errDiff(result[3].name, "WORD");

result = t.tokenize("foo{BADVAR}.word"); err(result[0]);
input = result[1];
[num, result] = p.substVars(input, varLookup);
errDiff(num, 0);
err(errMsg);
errDiff(result[0].name, "WORD");
errDiff(result[1].name, "VARIABLE"); errDiff(result[1].value, "BADVAR");
errDiff(result[2].name, "DOT");
errDiff(result[3].name, "WORD");

lines = [
  "% abc",
  "WITH CURRENT .bar",
  "BEGIN",
  "baz",
  "",
  "[ def]",
  "WITH ALL .FOO NONCURRENT .bar BEGIN",
  "[ ghi ]",
  "WITH CURRENT .foo/BAR",
  "BEGIN",
  "baz",
];

log(`---- buildProcs`);
[errMsg, tla] = t.tokenize(lines); err(errMsg);
p = new Parser(t);
result = p.buildProcs(tla); // get Map of tla
log(`------     abc`);
errDiff(result.get("abc")[0].type, "WITH");
log(`------     def`);
errDiff(result.get("abc")[0].type, "WITH");
log(`------     ghi`);
errDiff(result.get("abc")[0].type, "WITH");

function prettyPrint(proc) {
  if (typeof proc === 'string') {
    log(`  ${proc}`);
    return;
  }
  proc.forEach( b => {
    log(b.type);
    if (b.type !== 'PLAIN') {
      b.header.forEach( h => log(t.renderTokens(h)) );
    }
    log(b.tla);
  });
}

log(`---- buildCommand`);

lines = [
  { line: "DEF ALT PARENT .fwd.a CHILDREN b c d",
    options: {'PARENT': 'PATH', 'CHILDREN': 'WORDS' },
    checkFunc: args => {
      errDiff((args.CHILDREN)[1], "c");
    },
  },
];

p = new Parser(t);

lines.forEach( rec => {
  const result = t.tokenize(rec.line); err(result[0]);
  const tokList = result[1];
  let errMsg, args;
  [errMsg, args] = p.buildCommand("DEF ALT", tokList, rec.options);
  err(errMsg);
  rec.checkFunc(args);
});

function checkExpand(input, output) {
  let tResult;
  tResult = propagator.process(input);
  err(tResult[0]);
  // log(' '.repeat(40 - input.length)+`${input}| ==> |${tResult[1]}|`);
  if (tResult[1] !== output) {
    err(`expected |${output}|, but got |${JSON.stringify(tResult[1])}|`);
  }
}

process.exit(0);



machine = new Machine();
result = machine.interpret(['P .board']); err(result);
parser = new Parser(machine, t, s => log(s));

result = propagator.process("{{DEF TOP CHILDREN board}}"); err(result[0]);
input = "{{SET DATAW PATH .board DATA foo}}";
result = propagator.process(input);
err(result[0]);

machine = new Machine();
propagator = new Propagator(machine, t, s => log(s));
result = machine.interpret(['P .board']); err(result);
input = "{{DEF CON PARENT .board CHILDREN a b c d e f g h}}";
result = propagator.process(input);
err(result[0]);

initScript = [
  "DEF ALT PARENT .board.a CHILDREN none",
  "DEF ALT PARENT .board.b CHILDREN none",
  "DEF ALT PARENT .board.c CHILDREN none",
  "DEF ALT PARENT .board.d CHILDREN none",

  "DEF ALT PARENT .fwd.a CHILDREN b c d",
  "DEF ALT PARENT .fwd.b CHILDREN c d",
  "DEF ALT PARENT .fwd.c CHILDREN d",

  "DEF CON PARENT .player CHILDREN fly1 fly2 spider",
];

renderScript = [
  'WITH ALL .board.POS BEGIN',
  "DEF ALT PARENT .board.{POS} CHILDREN none fly1 fly2 spider",
  'END',
  'SET CURRENT PARENT .board.a CHILD fly1',
  'SET CURRENT PARENT .board.b CHILD fly1',
];

log(`---- parseWithClauses and expandUnification`);

machine = new Machine();
propagator = new Propagator(machine, t, (s) => log(s));
errMsg = propagator.runRenderScript(initScript);
err(errMsg);

log(`---- runRenderScript with WITH block`);
errMsg = propagator.runRenderScript(renderScript);
err(errMsg);
err(machine.exists('.board.a/fly1'));
err(machine.exists('.player.fly1'));

log(`---- basic ON block`);

initScript = [
  'DEF ALT PARENT .turn CHILDREN spider flies',
];

renderScript = [
  'ON .turn spider BEGIN',
  'DEF CON PARENT .do CHILDREN something',
  'END',
  'ON .turn flies BEGIN',
  'DEF CON PARENT .do CHILDREN somethingelse',
  'END',
];

machine = new Machine();
propagator = new Propagator(machine, t, (s) => log(s));
errMsg = propagator.runRenderScript(initScript);
err(errMsg);
blocks = propagator.buildBlocks(renderScript);
// log(JSON.stringify(blocks));



log(`---- drag-and-drop: create drag-and-drop pairs`);

machine = new Machine();

// fly1 is at a, fly2 is at b, set up fly1.loc/a and fly2/loc/b.

boardScript = [
  "DEF CON PARENT .piece CHILDREN none fly1 fly2",
  "DEF CON PARENT .player CHILDREN fly1 fly2",

  "DEF CON PARENT .board CHILDREN a b c",

  "DEF CON PARENT .fwd.a CHILDREN b c d",
  "DEF CON PARENT .fwd.b CHILDREN c",
];

const ddScript = [
  "WITH ALL .piece.PIECE BEGIN",
  "DEF ALT PARENT .board.a CHILDREN {PIECE}",
  "DEF ALT PARENT .board.b CHILDREN {PIECE}",
  "DEF ALT PARENT .board.c CHILDREN {PIECE}",
  "END",

  "SET CURRENT PARENT .board.a CHILD fly1",
  "SET CURRENT PARENT .board.b CHILD fly2",
  "SET CURRENT PARENT .board.c CHILD none",
];


log(`---- growing clauses: boardScript, ddScript`);

propagator = new Propagator(machine, t, (s) => log(s));
result = propagator.runRenderScript(boardScript);
err(result);

errMsg = propagator.runRenderScript(ddScript);
err(errMsg);

errDiff(propagator.process("{{CURRENT .board.b}}")[1], "fly2");


boardScript = [
  "DEF CON PARENT .piece CHILDREN none fly1 fly2",
  "DEF ALT PARENT .board.a CHILDREN none",
  "DEF ALT PARENT .board.b CHILDREN none",
  "DEF ALT PARENT .board.c CHILDREN none",
];

const revScript = [
  "WITH ALL .piece.PIECE BEGIN",
  "DEF ALT PARENT .board.a CHILDREN {PIECE}",
  "DEF ALT PARENT .board.b CHILDREN {PIECE}",
  "DEF ALT PARENT .board.c CHILDREN {PIECE}",
  "DEF ALT PARENT .{PIECE}.loc CHILDREN a b c",
  "END",

  "SET CURRENT PARENT .board.a CHILD fly1",
  "SET CURRENT PARENT .board.b CHILD fly2",
  "SET CURRENT PARENT .board.c CHILD none",

  "WITH CURRENT .board.POS/PIECE BEGIN",
  "SET CURRENT PARENT .{PIECE}.loc CHILD {POS}",
  "END"
];

log(`--- running WITH Script for drag and drop`);

machine = new Machine();
propagator = new Propagator(machine, t, (s) => log(s));
result = propagator.runRenderScript(boardScript);
err(result);

log(`--- running revScript...`);
errMsg = propagator.runRenderScript(revScript);
err(errMsg);

checkExpand("{{CURRENT .board.a}}", "fly1");
checkExpand("{{CURRENT .board.b}}", "fly2");
checkExpand("{{CURRENT .board.c}}", "none");
checkExpand("{{CURRENT .fly1.loc}}", "a");
checkExpand("{{CURRENT .fly2.loc}}", "b");

//log("OK");


log(`---- WITH ALL example`);

const provideScript = [
  'P .board.a',
  'P .board.b',
  'P .board.c',
  'P .board.d',
  'P .board.e',
  'P .board.f',
  'P .board.g',
  'P .board.h',
  'WITH ALL .board.POS BEGIN',
  'P .board.{POS}/empty',
  'P .board.{POS}/fly1',
  'P .board.{POS}/fly2',
  'P .board.{POS}/fly3',
  'P .board.{POS}/spider',
  'END',
  'ON .turn spider BEGIN',
  'D .img.fly1 fly',
  'D .img.fly2 fly',
  'D .img.fly3 fly',
  'D .img.spider spider-selected',
  'C .tomove spider',
  'END',
];
machine = new Machine();
propagator = new Propagator(machine, t, (s) => log(s));
arr = provideScript.slice(0);
// log(arr);
result = propagator.getScriptBlock(arr);
//log(JSON.stringify(result));
errDiff(result.numLines, 8);
errDiff(result.lines.length, 8);
arr = arr.slice(result.numLines);
result = propagator.getScriptBlock(arr);
//log(JSON.stringify(result));
errDiff(result.numLines, 7);
errDiff(result.lines.length, 5);
arr = arr.slice(result.numLines);
result = propagator.getScriptBlock(arr);
//log(JSON.stringify(result));
arr = arr.slice(result.numLines);
errDiff(arr.length, 0);

log(`---- WITH ALL with inserted blanks`);
arr = provideScript.slice(0);
arr.splice(15, 0, " ");
arr.splice(14, 0, " ");
arr.splice(9, 0, " ");
arr.splice(3, 0, " ");
result = propagator.getScriptBlock(arr);
errDiff(result.numLines, 9);
errDiff(result.lines.length, 8);
result = propagator.getScriptBlock(arr.slice(result.numLines));
errDiff(result.numLines, 9);
errDiff(result.lines.length, 5);

log(`---- WITH ALL with error END`);
arr = provideScript.slice(0);
arr.splice(3, 0, "END");
result = propagator.getScriptBlock(arr);
errDiff(result.error, "found END in plain block");

log(`---- WITH ALL with immediate END`);
arr = provideScript.slice(0);
arr.splice(9, 0, "END");
result = propagator.getScriptBlock(arr);
result = propagator.getScriptBlock(arr.slice(result.numLines));
err(result.error);

log(`---- buildBlocks`);
arr = provideScript.slice(0);
blocks = propagator.buildBlocks(arr);
errDiff(blocks.length, 3);
errDiff(blocks[0].numLines, 8);
errDiff(blocks[0].lines.length, 8);
errDiff(blocks[1].numLines, 7);
errDiff(blocks[1].lines.length, 5);
errDiff(blocks[2].numLines, 7);
errDiff(blocks[2].lines.length, 5);

log(`---- runRenderScript: .turn = spider`);

// log(`CURRENT .selectedfly = ${machine.getCurrentChildName(".selectedfly")}`);

initScript = [
  'DEF ALT PARENT .turn CHILDREN spider flies',
  'DEF CON PARENT .img CHILDREN fly1 fly2 fly3 spider',
  'DEF ALT PARENT .tomove CHILDREN spider fly1 fly2 fly3 spider',
  'DEF ALT PARENT .selectedfly CHILDREN fly1 fly2 fly3',

  'SET CURRENT PARENT .tomove CHILD fly1',
  'SET CURRENT PARENT .selectedfly CHILD fly1',

  'SET CURRENT PARENT .selectedfly CHILD fly1',
];

renderScript = [
  "SET DATAW PATH .img.fly1 DATA fly",
  "SET DATAW PATH .img.fly2 DATA fly",
  "SET DATAW PATH .img.fly3 DATA fly",
  "SET DATAW PATH .img.spider DATA spider-selected",

  "ON .turn spider BEGIN",
  "SET DATAW PATH .img.fly1 DATA fly",
  "SET DATAW PATH .img.fly2 DATA fly",
  "SET DATAW PATH .img.fly3 DATA fly",
  "SET DATAW PATH .img.spider DATA spider-selected",
  "SET CURRENT PARENT .tomove CHILD spider",
  "END",

  "ON .turn flies BEGIN",
  "SET DATAW PATH .img.{{CURRENT .selectedfly}} DATA fly-selected",
  "SET DATAW PATH .img.spider DATA spider",
  "SET CURRENT PARENT .tomove CHILD {{CURRENT .selectedfly}}",
  "END",
];

machine = new Machine;
propagator = new Propagator(machine, t, (s) => log(s));
result = propagator.runRenderScript(initScript); err(result);
result = propagator.runRenderScript(renderScript); err(result);

checkExpand("{{CURRENT .turn}}", "spider");
checkExpand("{{DATAW .img.fly1}}", "fly");
checkExpand("{{DATAW .img.fly2}}", "fly");
checkExpand("{{DATAW .img.spider}}", "spider-selected");
checkExpand("{{CURRENT .tomove}}", "spider");

log(`---- check for bad path syntax`);
result = propagator.process("{{CURRENT tomove}}");
errDiff(result[0], "CURRENT: bad syntax for path: tomove");
log(`   OK`);

log(`---- runRenderScript: .turn = flies`);
result = propagator.process('{{SET CURRENT PARENT .turn CHILD flies}}');
err(result);

result = propagator.runRenderScript(renderScript);

checkExpand("{{CURRENT .turn}}", "flies");
checkExpand("{{CURRENT .selectedfly}}", "fly1");
checkExpand("{{DATAW .img.fly1}}", "fly-selected");
checkExpand("{{DATA .img.fly1}}", '"fly-selected"');
checkExpand("{{DATAW .img.fly2}}", "fly");
checkExpand("{{DATAW .img.spider}}", "spider");
checkExpand("{{CURRENT .tomove}}", "fly1");

