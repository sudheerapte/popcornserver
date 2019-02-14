window.onload = boot;

let machine = ""; // name of machine
let mc = new Machine; // filled in by messageHandlers
let ws;          // websocket assigned by upgradeToWebsocket

function boot() {
  upgradeToWebsocket()
    .then( doFirstMessage ) // which adds listener handleMessage()
    .then( () => console.log(`first message handled. Waiting for more...`))
    .catch( errMsg => console.log(errMsg) );
}

function upgradeToWebsocket() {
  return new Promise( (resolve, reject) => {
    const urlPath = window.location.pathname;
    console.log(`urlPath=${urlPath}`);
    ws = new WebSocket(`ws://localhost:8000${urlPath}`);
    ws.addEventListener('open', function(ev) {
      console.log(`websocket is open`);
    });
    ws.addEventListener('close', function(ev) {
      console.log('websocket closed by server');
    });
    ws.addEventListener('error', function(ev) {
      console.log(`websocket error: ${JSON.stringify(ev)}`);
    });
    resolve();
  });
}

function doFirstMessage() {
  return new Promise( (resolve, reject) => {
    ws.addEventListener('message', handleFirstMessage);
    
    function handleFirstMessage(ev) {
      console.log(`firstMessage: |${trunc(ev.data)}|`);
      const data = ev.data;
      if (data.match(/^provide\s+/)) {
	const m = data.match(/^provide\s+([a-z]+)/);
	if (!m) {
	  console.log(`bad provide command: |${trunc(data)}|`);
	} else {
	  machine = m[1];
	  console.log(`reading machine ${machine}`);
	  const arr = data.split('\n');
	  if (! arr) {
	    return rejectThis(()=>
			      reject(`bad machine payload for ${machine}`));
	  } else {
	    console.log(`provide command payload = ${arr.length-1} lines`);
	  }
	  const result = mc.interpret(arr.slice(1));
	  if (result) { return rejectThis(()=>reject(result)); }
	  const currPaths = mc.getCurrentPaths();
	  console.log(`${machine} currPaths: ${currPaths.length}. Reflecting...`);
          reflectMachine();
	  return resolveThis(resolve);
	}
      }
    }
    function resolveThis(resolve) {
      ws.removeEventListener('message', handleFirstMessage);
      ws.addEventListener('message', handleMessage);
      return resolve();
    }
    function rejectThis(rejector) {
      ws.removeEventListener('message', handleFirstMessage);
      return rejector();
    }
  });
}

function handleMessage(ev) { // handle subsequent messages
  console.log(`handleMessage: |${trunc(ev.data)}|`);
  const data = ev.data;
  if (data.match(/^update\s+/)) {
    const m = data.match(/^update\s+([a-z]+)/);
    if (!m) {
      console.log(`ignoring bad update command: |${trunc(data)}|`);
    } else if (machine !== m[1]) {
      console.log(`|update ${m[1]}|: ignoring unknown machine`);
    } else {
      console.log(`updating machine ${machine}`);
      const arr = data.split('\n');
      if (!arr) {
	console.log(`bad payload for |${trunc(data)}|`);
      } else {
	console.log(`update payload = ${arr.length-1} lines`);
	const result = mc.interpret(arr.slice(1));
	if (result) {
	  console.log(`update failed: ${result}`);
	} else {
	  console.log(`updated machine. Reflecting...`);
	  const currPaths = mc.getCurrentPaths();
          reflectMachine();
	}
      }
    }
  } else {
    console.log(`unknown command: |${trunc(ev.data)}|`);
  }
}

/**
   @function(reflectMachine) - hide and unhide elements based on machine
*/
let unknownPaths = new Map();

function reflectMachine() {
  if (! mc) { return; }
  const DM = "data-machine";
  const machineElems = document.querySelectorAll(`[${DM}]`);
  console.log(`machineElems = ${machineElems.length} items`);
  // hide all non-current alt children and unhide all other paths
  machineElems.forEach( e => {
    const mPath = e.getAttribute(DM);
    if (mPath) {
      if (! mc.exists(mPath) && ! unknownPaths.has(mPath)) {
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

function isNonCurrAlt(mPath) {
  const state = mc.getState(mPath);
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


function trunc(logmsg) {
  if (! logmsg) { return 'null'; }
  logmsg = logmsg.replace(/\r|\n/g, " ");
  if (logmsg.length > 30) {
    return logmsg.substr(0,30) + '...';
  } else {
    return logmsg;
  }
}
