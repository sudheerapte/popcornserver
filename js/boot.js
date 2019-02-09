window.onload = boot;

let mc = new Machine;
let machine = ""; // name of machine

function boot() {
  upgradeToWebsocket();
}

function upgradeToWebsocket() {
  const urlPath = window.location.pathname;
  console.log(`urlPath=${urlPath}`);
  let ws = new WebSocket(`ws://localhost:8000${urlPath}`);
  ws.addEventListener('open', function(ev) {
    console.log(`websocket is open`);
  });
  ws.addEventListener('close', function(ev) {
    console.log('websocket closed by server');
  });
  ws.addEventListener('error', function(ev) {
    console.log(`websocket error: ${JSON.stringify(ev)}`);
  });
  ws.addEventListener('message', handleMessage);
}

function handleMessage(ev) {
  console.log(`handleMessage: |${trunc(ev.data)}|`);
  if (ev.data.match(/^machine\s+/)) {
    const m = data.match(/^machine\s+([a-z]+)/);
    if (!m) {
      console.log(`bad machine command: |${trunc(data)}|`);
    } else {
      machine = m[1];
      console.log(`reading machine ${machine}`);
    }
  }
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

