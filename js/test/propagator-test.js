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

let blocks;

initScript = [
  'P .turn/spider',
  'P .turn/flies',
  'P .selectedfly/fly1',
  'P .selectedfly/fly2',
  'P .selectedfly/fly3',
  'P .img.fly1',
  'P .img.fly2',
  'P .img.fly3',
  'P .img.spider',
  'P .tomove/spider',
  'P .tomove/fly1',
  'P .tomove/fly2',
  'P .tomove/fly3',
  'P .x.b.c/foo',
  'P .x.b.c/bar',
  'P .x.b.c/baz',
  'P .y.b.c/foo',
  'P .y.b.c/bar',
  'P .y.b.c/baz',
  'P .board.a',
  'P .board.b',
  'P .board.c',
];

process.env["DEBUG"] = null;

machine = new Machine();

let boardScript, errMsg;

log(`---- drag-and-drop: create drag-and-drop pairs`);

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
];

const ddScript = [
  "WITH .piece.PIECE BEGIN",
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
  "END",

  "WITH CURRENT .board.EMPTYPOS/none, ALL .player.PLAYER, CURRENT .board.PLPOS/{{PLAYER}}, ALL .fwd.{{PLPOS}}.{{EMPTYPOS}} BEGIN",
  "P .dragndrop.{{PLPOS}}.{{EMPTYPOS}}",
  "END",
];

machine.interpret(boardScript);
propagator = new Propagator(machine, t, (s) => log(s));
errMsg = propagator.runRenderScript(ddScript.slice(0, ddScript.length-3));
const withClause = "CURRENT .board.EMPTYPOS/none, ALL .player.PLAYER, CURRENT .board.PLPOS/{{PLAYER}}, ALL .fwd.{{PLPOS}}.{{EMPTYPOS}}";
err(errMsg);

log(machine.getSerialization().filter( s => s.match(/player/) ));

let clauses = [];
propagator.parseWithClauses(withClause, clauses);
log(clauses);
log(`---- trying clause ${clauses[0]}`);
let sArr = [];
result = propagator.expandUnification({}, clauses[0]);
result.forEach( r => sArr.push(r) );
log(sArr);
log(`---- trying clause ${clauses[1]}`);
let sArr1 = [];
for (let i=0; i<sArr.length; i++) {
  const subst = sArr[i];
  result = propagator.expandUnification(subst, clauses[1]);
  log(`${JSON.stringify(subst)}: ${JSON.stringify(result)}`);
  if (! Array.isArray(result)) { err('stopping on error'); }
  result.forEach( r => sArr1.push(r) );
}
log(sArr1);
log(`---- trying clause ${clauses[2]}`);
let sArr2 = [];
for (let i=0; i<sArr1.length; i++) {
  const subst = sArr1[i];
  result = propagator.expandUnification(subst, clauses[2]);
  log(`${JSON.stringify(subst)}: ${JSON.stringify(result)}`);
  if (! Array.isArray(result)) { err('stopping on error'); }
  result.forEach( r => sArr2.push(r) );
}
log(sArr2);


//log(machine.getSerialization().filter( s => s.match(/dragandrop/) ));

process.exit(0);

log(`---- invert locations .board.a/fly1 => .fly1.loc/a`);

// fly1 is at a, fly2 is at b, set up fly1.loc/a and fly2/loc/b.

boardScript = [
  "P .piece.none",
  "P .piece.fly1",
  "P .piece.fly2",

  "P .board.a",
  "P .board.b",
  "P .board.c",
];

const revScript = [
  "WITH .piece.PIECE BEGIN",
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

machine = new Machine();
machine.interpret(boardScript);
propagator = new Propagator(machine, t, (s) => log(s));
errMsg = propagator.runRenderScript(revScript);
err(errMsg);

checkProcess("{{CURRENT .board.a}}", "fly1");
checkProcess("{{CURRENT .board.b}}", "fly2");
checkProcess("{{CURRENT .board.c}}", "none");
checkProcess("{{CURRENT .fly1.loc}}", "a");
checkProcess("{{CURRENT .fly2.loc}}", "b");

log("OK");


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
result = propagator.getScriptBlock(arr);
errDiff(result.numLines, 8);
errDiff(result.lines.length, 8);
result = propagator.getScriptBlock(arr.slice(result.numLines));
errDiff(result.numLines, 7);
errDiff(result.lines.length, 5);

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

log(`CURRENT .selectedfly = ${machine.getCurrentChildName(".selectedfly")}`);

renderScript = [
  "ON .turn spider BEGIN",
  "D .img.{{CURRENT .selectedfly}} fly",
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
err(machine.interpret(initScript));
propagator = new Propagator(machine, t, (s) => log(s));
propagator.runRenderScript(renderScript);

log(`DATA .img.fly1 = ${machine.getData(".img.fly1")}`);

checkProcess("{{DATA .img.fly1}}", "fly");
checkProcess("{{DATA .img.fly2}}", "fly");
checkProcess("{{DATA .img.spider}}", "spider-selected");
checkProcess("{{CURRENT .tomove}}", "spider");

log(`---- check for bad path syntax`);
result = propagator.process("{{CURRENT tomove}}");
errDiff(result[0], "CURRENT: bad syntax for path: tomove");
log(`   OK`);

log(`---- runRenderScript: .turn = flies`);
machine.interpret([ 'C .turn flies' ]);
//log(machine.getSerialization().filter( s => s.match(/\.turn/)) );

propagator.runRenderScript(renderScript);

checkProcess("{{DATA .img.fly1}}", "fly-selected");
checkProcess("{{DATA .img.fly2}}", "fly");
checkProcess("{{DATA .img.spider}}", "spider");
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

checkProcess("{{EXISTS .board.b}}", "1");
checkProcess("{{CURRENT .fly1.position}}", "a");
checkProcess("{{CURRENT .fly2.position}}", "a");

function checkProcess(input, output) {
  let tResult;
  tResult = propagator.process(input);
  err(tResult[0]);
  log(' '.repeat(40 - input.length)+`${input}| ==> |${tResult[1]}|`);
  if (tResult[1] !== output) {
    err(`expected |${output}|, but got |${JSON.stringify(tResult[1])}|`);
  }
}
