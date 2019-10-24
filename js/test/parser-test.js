"use strict";

const [log, err, errDiff] = require('./logerr.js');
const Parser = require('../parser.js');
const Tokenizer = require('../tokenizer.js');
const t = new Tokenizer;
const Machine = require('../machine.js');


let p, lines, tla;
let machine;
let tokens, successfulNum, num;
let evalFunc;

let result;
let input, options, args;
let initScript, renderScript, arr;
let boardScript, errMsg;
let clauses, sArr, sArr1, sArr2, withClause;

let block, blocks, temp, proc, procs;

log(`---- consumePath`);
input = [
  {s: ".foo/",   num: 2},
  {s: "foo",     num: 0},
  {s: ".foo",    num: 2},
  {s: "",        num: 0},
  {s: ".fooBAR", num: 2},
];
p = new Parser(t);
input.forEach( rec => {
  result = t.tokenize(rec.s); err(result[0]);
  const tokList = result[1];
  errDiff(p.consumePath(tokList), rec.num);
});

log(`---- consumePathPattern`);
input = [
  {s: ".foo/",   num: 2},
  {s: "foo",     num: 0},
  {s: ".foo",    num: 2},
  {s: "E.foo",   num: 0},
  {s: ".VAR",    num: 2},
  {s: ".*E",     num: 2},
  {s: ".VAR/*",  num: 4},
  {s: "",        num: 0},
  {s: ".fooBAR", num: 2},
];
p = new Parser(t);
input.forEach( rec => {
  result = t.tokenize(rec.s); err(result[0]);
  const tokList = result[1];
  errDiff(p.consumePathPattern(tokList), rec.num);
});

log(`---- composePath`);
input = [
  {i: ".foo/",   o: ".foo"},
  {i: "foo",     o: ""    },
  {i: ".foo",    o: ".foo"},
  {i: "E.foo",   o: ""    },
  {i: ".VAR",    o: ""    },
  {i: "",        o: ""    },
  {i: ".fooBAR", o: ".foo"},
];
p = new Parser(t);
input.forEach( rec => {
  result = t.tokenize(rec.i); err(result[0]);
  const tokList = result[1];
  errDiff(p.composePath(tokList), rec.o);
});

log(`---- getScriptBlock`);

lines = [
  "% abc",
  "WITH CURRENT .bar",
  "BEGIN",
  "baz",
  "END",
  "[ def]",
  "WITH ALL .foo NONCURRENT .bar BEGIN",
  "[ ghi ]",
  "WITH CURRENT .foo/BAR",
  "baz",
];


p = new Parser(t);
result = t.tokenize(lines); err(result[0]);
tla = result[1];

procs = p.buildProcContentMap(tla);
result = p.getScriptBlock(procs.get("abc"));
errDiff(result.error, undefined);
errDiff(result.numLists, 4);
errDiff(result.tla.length, 1);

result = p.getScriptBlock(procs.get("def"));
errDiff(result.error, 'no END found');
errDiff(result.numLists, 1);
errDiff(result.tla.length, 0);
errDiff(result.header.length, 2);
errDiff(result.header[0].length, 3);
errDiff(result.header[1].length, 3);

result = p.getScriptBlock(procs.get("ghi"));
errDiff(result.error, 'no BEGIN found');
errDiff(result.numLists, 2);
errDiff(result.tla.length, 0);

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
[num, result, successfulNum] = p.substVars(input, varLookup);
errDiff(num, 0);
errDiff(successfulNum, 1);
err(errMsg);
errDiff(result[0].name, "WORD");
errDiff(result[1].name, "WORD"); errDiff(result[1].value, "foo");
errDiff(result[2].name, "DOT");
errDiff(result[3].name, "WORD");

result = t.tokenize("foo{BADVAR}.word"); err(result[0]);
input = result[1];
[num, result, successfulNum] = p.substVars(input, varLookup);
errDiff(num, 1);
errDiff(successfulNum, 0);
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
  "END",
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
errDiff(result.get("def"), 'no END found');
log(`------     ghi`);
errDiff(result.get("ghi"), "no END found");

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

