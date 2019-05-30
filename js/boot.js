window.onload = boot;

let P = {          // minimize pollution of global namespace
  machine: "",     // name of machine
  mc: new Machine, // filled in by message handlers
  ws: null,        // websocket assigned by upgradeToWebsocket
  queries: new Queries,
  tokenizer: new Tokenizer,
};

function boot() {
  upgradeToWebsocket()
    .then( doFirstMessage ) // adds listener handleMessage() and unhides body
    .then( () => {
      console.log(`ready`);
    })
    .catch( errMsg => console.log(errMsg) );
}

// not a promise
function unhideBody() {
  const bodyElem = document.querySelector('body');
  if (bodyElem) {
    bodyElem.removeAttribute("hidden");
  } else {
    console.log(`failed to find bodyElem!`);
  }
}

// readProvideScript, if successful, results in a new machine.
function readProvideScript() {
  const provideScript = document.querySelector('script#provide');
  if (provideScript) {
    const str = provideScript.textContent;
    const lines = str.split(/\n|\r\n/)
          .filter(line => ! line.match(/^\s*$/))
          .map(line => line.trim());
    const newMachine = new Machine;
    const result = newMachine.interpret(lines);
    if (result) {
      console.log(`provide script: ${result}`);
      console.log(`not changing machine.`);
    } else {
      P.mc = newMachine;
    }
  } else {
    console.log(`provide script not found; continuing`);
  }
}

function readInitScript() {
  const initScript = document.querySelector('script#init');
  if (initScript) {
    const str = initScript.textContent;
    const lines = str.split(/\n|\r\n/)
          .filter(line => ! line.match(/^\s*$/))
          .map(line => line.trim());
    const result = P.mc.interpret(lines);
    if (result) {
      console.log(`init script: ${result}`);
    }
  } else {
    console.log(`init script not found; continuing`);
  }
}

function generateXY() {
  const nodeList = document.querySelectorAll(`svg use`);
  const evalFunc =  P.queries.getEvalFunc(P.mc);

  let numFormulas = 0;
  nodeList.forEach( useNode => {
    [ 'x', 'y', 'href' ].forEach( coord => {
      const formula = useNode.getAttribute(`data-${coord}`);
      if (formula) {
        numFormulas++;
        let result = P.tokenizer.process(formula, evalFunc);
        if (result[0]) {
          console.log(`use formula ${numFormulas}:
     ${formula}:
     ${result[0]}`);
        } else if (! result[1]) {
          console.log(`falsy result from use formula ${numFormulas}:
     ${formula}`);
        } else {
          const output = result[1];
          if (! output) { output = ""; }
          // console.log(`${formula}=|${output}|`);
          useNode.setAttribute(coord, output);
        }
      }
    });
  });
  console.log(`processed ${numFormulas} formulas`);
}

function upgradeToWebsocket() {
  return new Promise( (resolve, reject) => {
    const href = window.location.href;
    // replace http: with ws:
    const wsref = href.replace(/^[^:]+/, "ws");
    console.log(`upgrading to ${wsref}`);
    P.ws = new WebSocket(wsref);
    if (! P.ws) {
      return reject(`failed to create WebSocket(${wsref})`);
    }
    P.ws.addEventListener('open', function(ev) {
      console.log(`websocket is open`);
      return resolve();
    });
    P.ws.addEventListener('close', function(ev) {
      console.log('websocket closed by server');
    });
    P.ws.addEventListener('error', function(ev) {
      console.log(`websocket error: ${JSON.stringify(ev)}`);
    });
  });
}

/**
   @function(doFirstMessage) - get the URL machine and display it
*/

function doFirstMessage() {
  return new Promise( (resolve, reject) => {
    P.ws.addEventListener('message', handleFirstMessage);

    // Send the subscribe command for our URL machine
    let mcname = window.location.pathname;
    if (mcname.startsWith('/')) { mcname = mcname.slice(1); }
    console.log(`subscribing to machine ${mcname}`);
    P.machine = mcname;
    try {
      if (P.ws) { P.ws.send(`subscribe ${mcname}`); }
      else { console.log(`ERROR: no websocket!`); }
    } catch (e) {
      console.log(`websocket send failed: ${e.code}`);
    }
    
    // handleFirstMessage always resolves, with or without an app.
    function handleFirstMessage(ev) {
      // the first message must be "provide machine" or "no such machine"
      const data = ev.data;
      if (data.match(/^provide\s+(\w+)/)) {
	const m = data.match(/^provide\s+(\w+)/);
	if (P.machine !== m[1]) {
          console.log(`ignoring unknown machine ${m[1]}`);
          console.log(`proceeding with assets alone.`);
          readProvideScript();
          return proceedPastFirstMessage(resolve);
        }
	console.log(`got provide ${P.machine}`);
	const arr = data.split('\n');
	if (! arr) {
          const msg = `bad machine payload for ${P.machine}`;
          console.log(`proceeding with assets alone.`);
          readProvideScript();
          return proceedPastFirstMessage(resolve);
	}
        P.mc = new Machine;
	const result = P.mc.interpret(arr.slice(1));
	if (result) {
          console.log(`failed to interpret provided machine: ${result}`);
          console.log(`proceeding with assets alone.`);
          readProvideScript();
          return proceedPastFirstMessage(resolve);
        } else {
          return proceedPastFirstMessage(resolve);
        }            
      } else if (data.match(/no\ssuch\smachine/)) {
        console.log(`No app--- proceeding with assets alone`);
        readProvideScript();
        proceedPastFirstMessage(resolve);
      } else {
        console.log(`first message = ${data}`);
        console.log(`proceeding with assets alone.`);
        readProvideScript();
        proceedPastFirstMessage(resolve);
      }
    }
    function proceedPastFirstMessage(resolve) {
      readInitScript();
      reflectMachine();
      addClickChgHandlers();
      addClickCmdHandlers();
      P.ws.removeEventListener('message', handleFirstMessage);
      P.ws.addEventListener('message', handleMessage);
      unhideBody();
      return resolve();
    }
  });
}

function handleMessage(ev) { // handle subsequent messages
  // console.log(`handleMessage: |${trunc(ev.data)}|`);
  const data = ev.data;
  if (data.match(/^update\s+/)) {
    const m = data.match(/^update\s+(\w+)/);
    if (!m) {
      console.log(`ignoring bad update command: |${trunc(data)}|`);
    } else if (P.machine !== m[1]) {
      console.log(`|update ${m[1]}|: ignoring unknown machine`);
    } else {
      const arr = data.split('\n');
      if (!arr) {
	console.log(`bad payload for |${trunc(data)}|`);
      } else {
	const result = P.mc.interpret(arr.slice(1));
	if (result) {
	  console.log(`update failed: ${result}`);
	} else {
          reflectMachine();
	}
      }
    }
  } else if (data.match(/^provide\s+\w+/)) {
    const m = data.match(/^provide\s+(\w+)/);
    if (!m) {
      console.log(`ignoring bad provide command: |${trunc(data)}|`);
    } else if (P.machine !== m[1]) {
      console.log(`|provide ${m[1]}|: ignoring unknown machine`);
    } else {
      const arr = data.split('\n');
      if (! arr) {
        const msg = `bad machine payload for ${P.machine}`;
        console.log(`proceeding with assets alone.`);
        readProvideScript();
        readInitScript();
        reflectMachine();
        return;
      } else {
        P.mc = new Machine;
	const result = P.mc.interpret(arr.slice(1));
	if (result) {
          console.log(`failed to interpret provided machine: ${result}`);
          console.log(`proceeding with assets alone.`);
          readProvideScript();
          readInitScript();
          reflectMachine();
          return;
        }
        console.log(`new machine ${P.machine} provided`);
        readInitScript();
        reflectMachine();
        return;
      }
    }
  } else {
    console.log(`unknown command: |${trunc(ev.data)}|`);
  }
}

/**
   @function(reflectMachine) - generate, unhide elements based on machine
*/
let unknownPaths = new Map(); // suppress repeated "no such path" errors

function reflectMachine() {
  if (! P.mc) { return; }
  generateXY();
  const DM = "data-alt";
  const machineElems = document.querySelectorAll(`[${DM}]`);
  //  console.log(`machineElems = ${machineElems.length} items`);
  // hide all non-current alt children and unhide all other paths
  machineElems.forEach( e => {
    const mPath = e.getAttribute(DM);
    if (mPath) {
      if (! P.mc.exists(mPath) && ! unknownPaths.has(mPath)) {
        console.log(`no such path: ${mPath}`);
        unknownPaths.set(mPath, true);
        return;
      }
      const toHide = isNonCurrAlt(mPath);
      if (toHide) {
        e.setAttribute("hidden", "");
      } else if (e.hasAttribute("hidden")) {
        e.removeAttribute("hidden");
      }
    }
  });
}

/**
   isNonCurrAlt(): is this path an alt-child that is not current?

   These are the guys we want to hide.
   The DOM rendering will automatically hide any child elements.
*/

function isNonCurrAlt(mPath) {
  const state = P.mc.getState(mPath);
  if (state) { // check if state is a non-current alternative child
    const parent = state.parent;
    if (parent.hasOwnProperty("curr") && parent.hasOwnProperty("cc")) {
      if (parent.cc[parent.curr] === state.name) {
        return false;
      } else {
        return true;
      }
    }
  }
  return false;
}

/**
   @function(addClickChgHandlers) - set up data-chgclick handlers
*/
function addClickChgHandlers() {
  if (! P.mc) { return; }
  const mcCopy = P.mc.clone(); // create a copy to try the transactions on
  if (typeof mcCopy === 'string') {
    console.log(`failed to clone: ${mcCopy}`);
    return;
  }
  const DO = "data-chgclick";
  const machineElems = document.querySelectorAll(`[${DO}]`);
  machineElems.forEach( e => {
    const chStr = e.getAttribute(DO);
    if (chStr) {
      const arr = chStr.split(',').map( elem => elem.trim() );
      // console.log(`arr = ${arr.join(",")}`);
      const result = mcCopy.interpret(arr);
      if (result) {
        console.log(`${e.tagName} ${DO}=${chStr}: ${result}`);
      } else {
        e.addEventListener('click', ev => {
          if (! P.mc) { return; }
          const result = P.mc.interpret(arr);
          if (result) {
            console.log(`click failed: ${result}`);
          } else {
            //console.log(`clicked`);
            reflectMachine();
          }
        });
      }
    } else {
      console.log(`attribute ${DO} value not found`);
    }
  });
}

/**
   @function(addClickCmdHandlers) - set up data-cmdclick handlers
*/
function addClickCmdHandlers() {
  if (! P.mc) { return; }
  const mcCopy = P.mc.clone(); // create a copy to try the transactions on
  if (typeof mcCopy === 'string') {
    console.log(`failed to clone: ${mcCopy}`);
    return;
  }
  const DC = "data-cmdclick";
  const machineElems = document.querySelectorAll(`[${DC}]`);
  machineElems.forEach( e => {
    const chStr = e.getAttribute(DC);
    if (chStr) {
      e.addEventListener('click', ev => {
        console.log(`clicked: sending ${chStr}`);
        try {
          if (P.ws) { P.ws.send(`command ${P.machine}\n${chStr}`); }
        } catch (e) {
          console.log(`websocket send failed: ${e.code}`);
        }
      });
    } else {
      console.log(`attribute ${DC} value not found`);
    }
  });
}

function trunc(logmsg) {
  if (! logmsg) { return 'null'; }
  logmsg = logmsg.replace(/\r|\n/g, " ");
  if (logmsg.length > 30) {
    return logmsg.substr(0,30) + '...';
  } else {
    return logmsg;
  }
}
