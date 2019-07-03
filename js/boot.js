window.onload = boot;

let P = {          // minimize pollution of global namespace
  machine: "",     // name of machine
  mc: new Machine, // filled in by message handlers
  ws: null,        // websocket assigned by upgradeToWebsocket
  propagator: null,
  tokenizer: new Tokenizer, // simply passed in to new Propagator()
// Turn this on if you want detailed logging for render scripts
//  logger: console.log,
  logger: s => {},
};

function boot() {
  upgradeToWebsocket()
    .then( doFirstMessage ) // adds listener handleMessage() and unhides body
    .then( () => {
      console.log(`ready`);
    })
    .catch( errMsg => console.log(errMsg) );
}

// unhidebody() - make body visible after first message is processed
// not a promise
function unhideBody() {
  const bodyElem = document.querySelector('body');
  if (bodyElem) {
    bodyElem.removeAttribute("hidden");
  } else {
    console.log(`failed to find bodyElem!`);
  }
}

// sendProvide -- there is no app. Send our own machine using provide script.
function sendProvide() {
  const temp = new Machine;
  const provideScript = document.querySelector('script#provide');
  if (provideScript) {
    const str = provideScript.textContent;
    const lines = str.split(/\n|\r\n/)
          .filter(line => ! line.match(/^\s*$/))
          .map(line => line.trim());
    const result = temp.interpret(lines);
    if (result) {
      console.log(`provide script: ${result}`);
      console.log(`sending an empty machine.`);
    } 
  } else {
    console.log(`provide script not found; sending an empty machine.`);
  }
  // Send a client provide for our URL machine
  let mcname = window.location.pathname;
  if (mcname.startsWith('/')) { mcname = mcname.slice(1); }
  console.log(`sending client provide ${mcname}`);
  try {
    if (P.ws) {
      P.ws.send(`provide ${mcname}\n${temp.getSerialization().join('\n')}\n`);
    } else {
      console.log(`ERROR: no websocket!`);
    }
  } catch (e) {
    console.log(`websocket send failed: ${e.code}`);
  }
}


function runScript(name) {
  let result = null;
  const script = document.querySelector(`script#${name}`);
  if (script) {
    const str = script.textContent;
    const lines = str.split(/\n|\r\n/)
          .filter(line => ! line.match(/^\s*$/))
          .map(line => line.trim());
    result = P.propagator.runRenderScript(lines);
    if (result) {
      console.log(`script ${name} error:\n${result}`);
    }
  } else {
    result = `script ${name} not found; continuing`;
  }
  return result;
}

function generateXY() {
  const nodeList = document.querySelectorAll(`svg use`);
  let numFormulas = 0;
  nodeList.forEach( useNode => {
    [ 'x', 'y', 'href' ].forEach( coord => {
      const formula = useNode.getAttribute(`data-${coord}`);
      if (formula) {
        numFormulas++;
        let result = P.propagator.process(formula);
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
      else { return reject(`ERROR: no websocket!`); }
    } catch (e) {
      return reject(`websocket send failed: ${e.code}`);
    }
    
    function handleFirstMessage(ev) {
      // the first message must be "provide machine" or "no such machine"
      const data = ev.data;
      if (data.match(/^provide\s+(\w+)/)) {
	const m = data.match(/^provide\s+(\w+)/);
	if (P.machine === m[1]) {
	console.log(`got provide ${P.machine}`);
	const arr = data.split('\n');
	if (! arr) {
          const msg = `bad machine payload for ${P.machine}`;
          return reject(msg);
	}
        P.mc = new Machine;
        P.propagator = new Propagator(P.mc, P.tokenizer, P.logger)
	const result = P.mc.interpret(arr.slice(1));
	if (result) {
          console.log(`failed to interpret provided machine: ${result}`);
        }
        return proceedPastFirstMessage(resolve);
        } else {
          console.log(`ignoring unknown machine ${m[1]}`);
          // we cannot resolve until we get provide cmd
        }
      } else if (data.match(/no\ssuch\smachine/)) {
        console.log(`No app--- providing our own machine using assets`);
        sendProvide();
        // we cannot resolve until we get provide cmd
      } else {
        console.log(`first message = ${data}`);
        // we cannot resolve until we get provide cmd
      }
    }
    function proceedPastFirstMessage(resolve) {
      runScript('init');
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
  console.log(`handleMessage: |${trunc(ev.data)}|`);
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
        return;
      } else {
        P.mc = new Machine;
        P.propagator = new Propagator(P.mc, P.tokenizer, console.log)
	const result = P.mc.interpret(arr.slice(1));
	if (result) {
          console.log(`failed to interpret provided machine: ${result}`);
          return;
        }
        console.log(`new machine ${P.machine} provided`);
        runScript('init');
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
  runScript('render');
  generateXY();
  const DM = "data-alt";
  const machineElems = document.querySelectorAll(`[${DM}]`);
  // console.log(`machineElems = ${machineElems.length} items`);
  // hide all non-current alt children and unhide all other paths
  machineElems.forEach( e => hideUnhide(e) );
  runScript('debug');

  function hideUnhide(e) {
    const mPath = e.getAttribute(DM);
    if (mPath) {
      if (! P.mc.exists(mPath) && ! unknownPaths.has(mPath)) {
        console.log(`no such path: ${mPath}`);
        unknownPaths.set(mPath, true);
        return;
      }
      const toHide = isNonCurrAlt(mPath);
      if (toHide) {
        if (e.tagName.match(/^g|svg|use/i)) {
          e.setAttribute("visibility", "hidden");
          console.log(`hiding ${e.getAttribute("id")}`);
        } else {
          e.setAttribute("hidden", "");
        }
      } else {
        if (e.tagName.match(/^g|svg|use/i)) {
          e.setAttribute("visibility", "visible");
          console.log(`making visible ${e.getAttribute("id")}`);
        } else {
          e.removeAttribute("hidden");
        }
      }
    }
  }
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
      e.addEventListener('click', ev => {
        const result = P.propagator.process(chStr.trim());
        if (result[0]) {
          console.log(`chgclick failed for ${chStr}: ${result[0]}`);
        } else {
          console.log(`click result: ${result[1]}`);
          const iresult = P.mc.interpret(result[1].split(','));
          if (iresult) {
            console.log(`interpret result: ${iresult}`);
          } else {
            reflectMachine();
          }
        }
      });
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
        const result = P.propagator.process(chStr.trim());
        if (result[0]) {
          console.log(`cmdclick failed for ${chStr}: ${result[0]}`);
          return;
        }
        console.log(`clicked: sending ${result[1]}`);
        try {
          if (P.ws) { P.ws.send(`command ${P.machine}\n${result[1]}`); }
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
