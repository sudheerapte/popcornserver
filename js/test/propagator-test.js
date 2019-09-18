"use strict";

const [log, err, errDiff] = require('./logerr.js');
const Propagator = require('../propagator.js');
const t = require('../tokenizer.js');
const Machine = require('../machine.js');

let propagator;
let machine;
let tokens;
let evalFunc;

let result;
let input;
let initScript, renderScript, arr;
let boardScript, errMsg;
let clauses, sArr, sArr1, sArr2, withClause;

let blocks, temp;

machine = new Machine();
result = machine.interpret(['P .board']); err(result);
input = "{{DEF CON PARENT .board CHILDREN a b c d e f g h}}";
propagator = new Propagator(machine, t, s => log(s));
result = propagator.process(input);
err(result);
//log(result);

//log(machine);


initScript = [
  'P .board.a/none',
  'P .board.b/none',
  'P .board.c/none',
  'P .board.d/none',

  'P .fwd.a.b',
  'P .fwd.a.c',
  'P .fwd.b.c',
  'P .fwd.a.d',
  'P .fwd.b.d',
  'P .fwd.c.d',

  'P .player.fly1',
  'P .player.fly2',
  'P .player.spider',

];

renderScript = [
  'WITH ALL .board.POS BEGIN',
  'P .board.{{POS}}/none',
  'P .board.{{POS}}/fly1',
  'P .board.{{POS}}/fly2',
  'P .board.{{POS}}/spider',
  'END',
  'C .board.a fly1',
  'C .board.b fly2',
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
  'P .turn/spider',
  'P .turn/flies',
];

renderScript = [
  'ON .turn spider BEGIN',
  'P .do.something',
  'END',
  'ON .turn flies BEGIN',
  'P .do.somethingelse',
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
  "P .piece.none",
  "P .piece.fly1",
  "P .piece.fly2",
  "P .player.fly1",
  "P .player.fly2",

  "P .board.a",
  "P .board.b",
  "P .board.c",

  "P .fwd.a.b",
  "P .fwd.a.c",
  "P .fwd.a.d",
  "P .fwd.b.c",
];

const ddScript = [
  "WITH ALL .piece.PIECE BEGIN",
  "P .board.a/{{PIECE}}",
  "P .board.b/{{PIECE}}",
  "P .board.c/{{PIECE}}",
  "END",

  "C .board.a fly1",
  "C .board.b fly2",
  "C .board.c none",
];


log(`---- growing clauses`);

result = machine.interpret(boardScript);
err(result);
propagator = new Propagator(machine, t, (s) => log(s));
log(`--- running render Script`);
errMsg = propagator.runRenderScript(ddScript);
err(errMsg);

errDiff(propagator.process("{{CURRENT .board.b}}")[1], "fly2");


boardScript = [
  "P .piece.none",
  "P .piece.fly1",
  "P .piece.fly2",

  "P .board.a/none",
  "P .board.b/none",
  "P .board.c/none",
];

const revScript = [
  "WITH ALL .piece.PIECE BEGIN",
  "P .board.a/{{PIECE}}",
  "P .board.b/{{PIECE}}",
  "P .board.c/{{PIECE}}",
  "P .{{PIECE}}.loc/a",
  "P .{{PIECE}}.loc/b",
  "P .{{PIECE}}.loc/c",
  "END",

  "C .board.a fly1",
  "C .board.b fly2",
  "C .board.c none",

  "WITH CURRENT .board.POS/PIECE BEGIN",
  "C .{{PIECE}}.loc {{POS}}",
  "END"
];

log(`--- running WITH Script for drag and drop`);

machine = new Machine();
result = machine.interpret(boardScript);
err(result);

propagator = new Propagator(machine, t, (s) => log(s));
errMsg = propagator.runRenderScript(revScript);
err(errMsg);

checkProcess("{{CURRENT .board.a}}", "fly1");
checkProcess("{{CURRENT .board.b}}", "fly2");
checkProcess("{{CURRENT .board.c}}", "none");
checkProcess("{{CURRENT .fly1.loc}}", "a");
checkProcess("{{CURRENT .fly2.loc}}", "b");

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
  'P .board.{{POS}}/empty',
  'P .board.{{POS}}/fly1',
  'P .board.{{POS}}/fly2',
  'P .board.{{POS}}/fly3',
  'P .board.{{POS}}/spider',
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
  'P .turn/spider',
  'P .turn/flies',
  'P .img.fly1',
  'P .img.fly2',
  'P .img.fly3',
  'P .img.spider',
  'P .tomove/spider',
  'P .tomove/flies',

  'WITH ALL .img.PLAYER BEGIN',
  'P .tomove/{{PLAYER}}',
  'P .selectedfly/{{PLAYER}}',
  'END',

  'C .selectedfly fly1',
];

renderScript = [
  "D .img.fly1 fly",
  "D .img.fly2 fly",
  "D .img.fly3 fly",
  "D .img.spider",

  "ON .turn spider BEGIN",
  "D .img.fly1 fly",
  "D .img.fly2 fly",
  "D .img.fly3 fly",
  "D .img.spider spider-selected",
  "C .tomove spider",
  "END",

  "ON .turn flies BEGIN",
  "D .img.{{CURRENT .selectedfly}} fly-selected",
  "D .img.spider spider",
  "C .tomove {{CURRENT .selectedfly}}",
  "END",
];

machine = new Machine;
propagator = new Propagator(machine, t, (s) => log(s));
propagator.runRenderScript(initScript);
propagator.runRenderScript(renderScript);

// log(`DATA .img.fly1 = ${machine.getData(".img.fly1")}`);

checkProcess("{{CURRENT .turn}}", "spider");
checkProcess("{{DATAW .img.fly1}}", "fly");
checkProcess("{{DATAW .img.fly2}}", "fly");
checkProcess("{{DATAW .img.spider}}", "spider-selected");
checkProcess("{{CURRENT .tomove}}", "spider");

log(`---- check for bad path syntax`);
result = propagator.process("{{CURRENT tomove}}");
errDiff(result[0], "CURRENT: bad syntax for path: tomove");
log(`   OK`);

log(`---- runRenderScript: .turn = flies`);
machine.interpret([ 'C .turn flies' ]);

propagator.runRenderScript(renderScript);

checkProcess("{{CURRENT .turn}}", "flies");
checkProcess("{{CURRENT .selectedfly}}", "fly1");
checkProcess("{{DATAW .img.fly1}}", "fly-selected");
checkProcess("{{DATA .img.fly1}}", '"fly-selected"');
checkProcess("{{DATAW .img.fly2}}", "fly");
checkProcess("{{DATAW .img.spider}}", "spider");
checkProcess("{{CURRENT .tomove}}", "fly1");

log(`---- evalBlockVars`);
machine = new Machine();
machine.interpret(["P .board.a", "P .board.b", "P .board.c",]);

propagator = new Propagator(machine, t, (s) => log(s));
['a', 'b', 'c'].forEach(position => {
  const lines = propagator.evalBlockVars(["P .fly1.position/{{POS}}", "P .fly2.position/{{POS}}"], {POS: position});
  const result = machine.interpret(lines);
  err(result);
});

//checkProcess("{{EXISTS .board.b}}", "1");
checkProcess("{{CURRENT .fly1.position}}", "a");
checkProcess("{{CURRENT .fly2.position}}", "a");

function checkProcess(input, output) {
  let tResult;
  tResult = propagator.process(input);
  err(tResult[0]);
  // log(' '.repeat(40 - input.length)+`${input}| ==> |${tResult[1]}|`);
  if (tResult[1] !== output) {
    err(`expected |${output}|, but got |${JSON.stringify(tResult[1])}|`);
  }
}
