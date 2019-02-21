# Popcorn - make beautiful web-based applications

Popcorn is an unusual HTTP server designed from the ground up for
beautifully designed, highly responsive browser-based applications. It
is suitable for smart embedded devices or for applications that have a
limited number of users. It has not been designed for web-scale
Internet apps that serve thousands of users; for that kind of use, you
would probably need to deploy multiple copies of Popcorn. See the
*Deployment considerations* section at the end.

By "beautiful", we don't mean visually pleasing (although Popcorn
applications could be that, too). We mean pleasant to use.

A good user experience requires the UX designer to have *complete
control* over every user interaction. Popcorn lets the UX designer
define every single pixel of every millisecond of user interaction
using HTML5 features. If you are a UX designer, popcorn is for you!
There are no web programmers putting up roadblocks based on
programming difficulties, or browser compatibilities, or framework
limitations. As long as your vision for the user experience is
possible to implement, then you can make it so. The only possible
obstacle might be performance-related, for example the response time
from the application or the web rendering might make something
impossible to do. You will have to work around that.

If you are a programmer, Popcorn can free you from GUI concerns
entirely. All the web UI assets--- HTML, images, CSS, SVG, etc.--- are
created by the UX designer. Popcorn provides a simple, unambiguous way
for you to communicate to the UX designer the UI states of the
application. You do not need to write any Javascript.

And finally, the Popcorn server is easy to integrate with applications
written in any language. Your application needs to communicate with
Popcorn over a TCP socket or a UNIX domain socket, using a simple
text-based protocol. You don't need any special libraries. If you are
writing your application in NodeJS, then you can use a client library
if you want: one is provided because Popcorn itself is written in
NodeJS. In any case, a few command-line tools are also provided so
that you can send your communication text strings to Popcorn by
supplying them as arguments, without having to open sockets yourself.

## Popcorn roadmap

As of Feb 21, 2019:

### Working today

* Linux installation

* Connected apps

* Simple demo app included in Popcorn

* Presentation-invoked changes (`data-chgclick`)

* Commands (`data-cmdclick`)


### Future

* Windows port

* Drive-by apps


## How to read the rest of this document

* If you are only curious about Popcorn, read the section *How Popcorn
Works*, and then decide if you want to read further.

* If you are deploying a Popcorn-based web application, you should
read *How Popcorn Works* and then the section *Deployment
considerations*.

* If you are a UX designer developing a Popcorn application, you
should read the the entire document, except perhaps the section *How
do Write a Popcorn Application*.

* If you are programming a Popcorn application, you probably need to
read all the sections except *How to Design the UX of a Popcorn
Application*.

* Section *Popcorn roadmap* - what works today, and what is planned.

# How Popcorn Works

Popcorn imposes a certain architecture on your application
UI. This architecure is similar to Facebook's Flux data flow
architecture:

```
  Action --> Dispatcher --> Store --> View
```

The key component in the Flux architecture is the Store, which holds a
consistent application domain model. Changes to the model
automatically update the View. Typically, Flux-based Views are
implemented using a Javascript library like `React.js`.

The central idea of Flux is that data always flows from left to right:
all changes in the domain model are represented by Action objects sent
to the Dispatcher, which triggers updates in the Store, which in turn
triggers updates in the View. In particular, user interactions with
the View cannot directly modify the View; instead, user interactions
generate Actions that are sent to the Dispatcher.

* (For more details on Flux, see
  https://facebook.github.io/flux/docs/in-depth-overview.html)

Popcorn takes this central idea and implements it in a way that
simplfies your work as an application developer. The Dispatcher and
Store are both implemented by Popcorn. The Store holds a domain model
in the form of an application **state machine** that you define.

The data flow looks like this in Popcorn:

```
    app --> (state machine update) -->  popcorn --> View
```

At run time, your application sends a text description, called an
"update", that describes changes to be made to the current state in
the state machine. This update is analogous to an Action in Flux.
Popcorn interprets the update by making changes to the state.

The View in Popcorn consists of annotated web assets (HTML, CSS,
images, SVG) that your UX designer prepares. When the state is
updated, Popcorn causes the web assets to change their visibility
according to the new state. You don't write any code.

The UX designer writes HTML tags and other web assets, referencing the
state machine by using attribute values. Popcorn defines certain
attributes and their meanings for this purpose. At run time, Popcorn
uses these attribute-based references to decide which of the web
assets should be rendered, turning them on and off so that the web
browser renders the right ones.

The programmer defines the state machine and makes the application
update it at run time. Beyond this, the programmer writes the
application without any regard to the GUI.

Popcorn maintains a mirror copy of the state machine in the browser
page and keeps it updated automatically by sending it events.

A more detailed picture of the data flow:

```
       app --> update  --+
                         |
                         V
                 server-side state machine
                         |
                         | (websocket events)
                         V
                 browser-side state machine
                         |
                         V
                       View        
```

The designer and the programmer must agree on the state machine
definition for the application. Popcorn provides a standardized
text-based syntax to describe the state machine and the format of
update transactions.

As long as they work from the same state machine definition, the
designer and the programmer can do their work largely independently.
If a design change desired by the UX designer requires changes to the
state machine definition, then the designer needs to consult with the
programmer, who can then make the corresponding changes on the
application side. But otherwise, the UX designer can make large design
changes without even informing the programmer; no changes are needed
to the application as long as the state machine remains the same.

The web assets can be maintained by the UX designer in a separate
repository from the application program; this is a recommended best
practice.  Also, there can be different models, i.e., state machine
definitions, for different types of UIs for the same application. For
example, there could be an "administrator UI" and an "end-user UI",
each with its own state machine. The application would be responsible
for keeping both of these state machines updated.

Popcorn applications can be written in any language, because they
communicate with Popcorn via TCP or UNIX-domain sockets using a
text-based protocol. Popcorn listens on two different ports for HTTP
and TCP traffic.  We provide a simple Javascript client library for
Nodejs based applications, to make it easier to develop an app.

In terms of protocols, the data flows like this:

```
   app --> (TCP socket) --> popcorn --> (websocket) --> browser
```

Of course, apart from updating the state machine, an application often
also needs to take user input. The application programmer should
define a set of *commands* with arguments in any convenient text
format. The UX designer can issue these commands from UI elements like
buttons, tabs, and text fields, by defining special Popcorn-defined
attributes in the HTML assets. Popcorn will transfer these commands
back to the application using the same TCP or UNIX-domain socket.

```
  app <-- popcorn <-- command event <-- browser
```

# The Popcorn State Machine Model

The heart of Popcorn is the state machine model, referred to here as
the "machine". Once you understand how machines are represented and
how they can be updated, you will find it easy to follow the rest of
this manual to develop Popcorn apps.

## Background on state machines and states

A state machine is a hierarchical tree of nodes.

The tree defines two things:

1. The entire state space of the application model, i.e., all possible
states that the application model can be in.

2. The current state within this state space.

Each state of the application is a composition of sub-states. In
general, any state can be of one of three types:

- A list of **alternative** sub-states, one of which is marked current
  at a time (for example, a bulb can be either on or off). We call
  such a state an **alternative-parent** state, and we call these
  alternative sub-states "alternative children" of the parent state.

- A list of sub-states, all of which are considered "current" at the
  same time (for example, a door can have a lock state and a hinge
  state, both simultaneously). We call such a state a
  **concurrent-parent** state, and its children "concurrent children"
  of the parent state.

- A container for a limited amount of data, e.g., a string.  We call
  such a state a **data-state**.

In turn, the child states of an alternative-parent or of a
concurrent-parent state can themselves be of any of these three types.
This is how one defines the state of the application as a hierarchical
state machine.

* Such hierarchical state machines were first defined by David Harel
  in 1986. He called them "Statecharts", and they were incorporated
  into the Unified Modeling Language (UML) 2.0 in a simplified
  form. In Popcorn we do not represent transitions between states; we
  just represent the hierarchy as a tree of nodes.

This tree of nodes in Popcorn follows certain rules.

## Tree Rules for Popcorn

The entire tree is the description of all possible states of an
application model, and the same tree also describes one single state
out of all of these as the current state, by marking some of the nodes
in the tree as "current".

Here is a picture of an example state machine tree for the states of a
door:

```
    root. +
          |
          +- hinge/
          |       +
          |       + - open (*)
          |       + - closed
          |
          +- bolt/
                 +
                 + - unlocked (*)
                 + - locked
```

The machine contains one root node, which is always a
concurrent-parent state node. The root node is always current.

The rules are:

1. Every alternative-parent node has one and exactly one child that is
  marked as current at a time. `hinge` and `bolt` above are
  alternative-parent nodes, which we have indicated by ending them in
  a slash `/`. We have indicated each current alternative child node
  with an asterisk in parentheses `(*)`.

1. For every concurrent-parent node, all of its children are
  considered current. We have indicated the only concurrent-parent
  node above by ending it in a dot (`.`).

1. Every data-state node has one and exactly one data value. The above
  example has no data-state node.

1. If a concurrent child is made a leaf node, we automatically assume
  that it is a data-state node. An alternative child can be a leaf
  node, but it cannot have any data. This is a restriction in Popcorn
  to make it easier to define trees. In the above picture, all four
  leaf nodes are alternative child nodes.

## Changing the application state

In order to change the application state, you can change the tree in
these ways:

- change an alternative-parent node to have a different current child, OR
- change the data of a data-node to a different value.

You can make a list of multiple changes of this type in a single
transaction, called an `update` transaction, and send it to Popcorn.
Popcorn modifies the machine.  Once the tree has been modified in this
way, it shows a new current state.

## Paths to identify nodes

Every node in the tree has a short name composed of lowercase letters,
numbers, and hyphens. This short name is unique among children of the
same parent node. The root node has a zero-length short name, i.e.,
the empty string, `""`.

Any node in the tree can thus be identified uniquely by the complete
series of short names starting from the root node. If we write the
series as a string with delimiters separating the names, we get a
unique path. We use a dot character `.` to separate concurrent
children from their concurrent-parent nodes, and a slash character `/`
to separate alternative children from their alternative-parent
nodes.

## Example machine: open, locked, unlocked

Here is our earlier picture of the states of a door, showing three
interior nodes and four leaf nodes:

```
    root. +
          |
          +- hinge/
          |       +
          |       + - open (*)
          |       + - closed
          |
          +- bolt/
                 +
                 + - unlocked (*)
                 + - locked
```

The following is a path-syntax view, which Popcorn can understand:

```
  .hinge
  .hinge/open
  .hinge/closed
  .bolt
  .bolt/unlocked
  .bolt/locked
```

The six paths above define six nodes.  A seventh root node `""` is
understood.

When defining a machine, we can always leave out the paths for the
interior nodes, since they are implied when we list the leaf nodes. So
the following four paths are sufficient to define the tree:

```
  .hinge/open
  .hinge/closed
  .bolt/unlocked
  .bolt/locked
```

## State space defined by the tree

This state machine is capturing four states of the door: each
combination of the hinge being open or closed, and the bolt being
unlocked or locked.

Let us look at the state space.

```
  State 1:      .hinge/open, .bolt/unlocked
  State 2:      .hinge/open, .bolt/locked
  State 3:      .hinge/closed, .bolt/unlocked
  State 4:      .hinge/closed, .bolt/locked

```

In the picture of the tree we drew at the beginning, we used the `(*)`
annotation to show State 1, `open` and `unlocked`.

(With this state space, we are modeling a door that can be locked even
when it is open: of no security benefit, and in fact inconvenient
because often such doors cannot be closed until you first unlock
them.)

# Specifying a Machine to Popcorn

We specify a machine by declaring all the paths. The command to
declare a path is `P`. Here is how we can specify our 4-leaf-node
machine to Popcorn:

```
  P .hinge/open
  P .hinge/closed
  P .bolt/unlocked
  P .bolt/locked
```

If we give this series of text lines to Popcorn as a `provide`
transaction, it will build a machine like this for us and keep it in
memory.

This machine specifies four possible states for our door. But in
addition, it also specifies an *initial state* for our door. The rule
is that the first-mentioned child of an alternative-parent node is
automatically assumed to be "current". Thus, in this example, if we
asked Popcorn to create this machine, our door will initially be in
State 1 (`open` and `unlocked`).

If we want to change the current state, we send Popcorn an `update`
transaction with the changes we want to make. To close the door, we
need to use a change command, `C`, which specifies an alternative
parent and which of its alternative children we want to make current:

```
  C .hinge closed
```

This command changes the `closed` alternative child to become the
current child. Using this command, we can close our door and enter
State 3, `closed` and `unlocked`.

An `update` transaction can specify a list of such change
commands. For example, by adding a second `C` command, we can
simultaneously close and lock our door:

```
  C .hinge closed
  C .bolt locked
```

Popcorn will put the machine in State 4, `closed` and `locked`.

## Data nodes

All leaf nodes that are concurrent children are assumed to be "data
nodes" and have associated with them a UTF-8 string value. By default
this value is the empty string `""`. But we can assign any string
value to a data-node by using the `D` (data) command.

For example, let us expand our state space. Let us say our door has a
combination lock with a 4-digit key. Every time we flip the
combination lock, we change the state of the door.

We could model such a door by adding a new concurrent-parent, `.key`,
to our machine:

```
  P .hinge/open
  P .hinge/closed
  P .bolt/unlocked
  P .bolt/locked
  P .key
  D .key 1234
```

The above set of `P` commands defines our 4-state door, and also gives
it another concurrent-parent leaf node called `key`. This node has a
data string `1234` associated with it. (The fifth `P` command creates
a `key` node with an empty data string; the `D` command assigns `1234`
to it).

With this new data-node, we have expanded our state machine to cover a
very large number of possible states: ten thousand possible strings
for each of the 4 states of the hinge and the bolt.

To change our key, we have to assign the new value to `key`:

```
  D .key 1235
```

and so on. Note that we are not representing in our model the secret
key needed to unlock our door, only the visible key value that anyone
can change. We could, of course, add the secret key to our model if we
wanted, by adding another data-node.

# How to Design the UX of a Popcorn Application

## Overview

1. Define the state machine for your application along with the app
developer.

1. Create your assets directory for the machine, and configure Popcorn
to find the directory.

1. In your assets directory, write `frags.html` and `head-frags.html`,
and place any images, CSS files, and other assets in it.

1. Launch Popcorn and view the URL for your machine.

## Create assets directory and HTML files

When you have defined your state machine as described in the previous
sections, you are ready to create your web assets as a hierarchy of
files in any directory you define.

In your assets directory, you create two HTML files, `head-frags.html`
and `frags.html`, which Popcorn will send as part of the `mymachine`
page, like this:

```
  <head>
    ...
    CONTENTS OF "head-frags.html"
    ...
  </head>
  <body>
    CONTENTS OF "frags.html"
  </body>
```

## Contents of `frags.html`

You can enter any valid HTML elements that can go into the
`<body>`. You will use popcorn-specific attributes of the form
`data-XXX` to point to a machine path.

### data-alt to show a current alternative child

To display an element only when a particular alternative child is
current, assign to it this alternative child's path:

```
     <p data-alt=".hinge/open">The hinge is open</p>
```

The above example uses the `data-alt` attribute to mark a
paragraph. Whenever the machine has any other child of `.hinge`
current, then this paragraph will not be displayed.

### data-cmdclick to send commands to the app

To send a command to the app when the user clicks a button or any
other element, assign to that element the command string as the value
of the attribute `data-cmdclick`:

```
    <input type="button" value="Close"
     data-cmdclick="close hinge"></input>
```

The above example provides a button labeled "Close". If the user
clicks the button, Popcorn will send the command string `close hinge`
to the app on the back end.

When the user clicks this button, the command string is sent, but
nothing changes in the UI. Or at least, not immediately: presumably
the app will update the state machine in response to the command.

Sometimes, a command is expected to take time to take effect, and the
designer will want some feedback to be given to the user
immediately. For those cases, you can also use a `data-chgclick`
attribute to directly change the machine state in the UI; see below.

### data-chgclick to change the state

To directly change the state of the machine when the user clicks a
button or any other element, assign to that element a change
transaction as the value of the attribute `data-chgclick`:

```
    <input type="button" value="Close"
     data-chgclick="C .hinge closed"></input>
```

The above example provides a button labeled "Close". If the user
clicks the button, Popcorn will immediately perform a change
transaction that sets the `.hinge` current value to `closed`.

For the syntax of change transactions, see *How to develop a Popcorn
app* below.

If a transaction contains more than one change command, separate them
with commas in the string value of `data-chgclick`.

This `data-chgclick` method is useful in two cases:

* UI navigation; for example, to change to a different tab. To achieve
  this, use the `C` command to make a different alt-child current, and
  use that alt-child as the value of a `data-alt` attribute for the
  new tab.

* Immediate feedback on issuing a long-running command. To achieve
  this, use `data-chgclick` along with the `data-cmdclick` attribute
  together. The `data-cmdclick` sends a command to the back end, while
  the `data-chgclick` immediately switches to a view that says,
  "waiting for response...".

This method of changing machine state should be used only for
"presentation logic". The app in the back end knows nothing about
`data-chgclick` transactions. App development will get very confusing
if the app also sometimes sends the same kind of change
transaction. It is better for the designer and the app developer to
decide up front which of the paths belong to the UI and which ones
belong to the back end.

## Contents of `head-frags.html`

The `head-frags.html` file is optional. It is meant for entering
`<link>` elements for any CSS stylesheets you need, in the order you
need to cascade them. The `.CSS` files must be located inside the
assets directory in the subdirectory named by the `href` attribute.

*TODO: show `<link>` element examples*


## Configure Popcorn with assets directory location

You tell Popcorn where to find the assets directory for a machine
through Popcorn's config file, `~/.popcorn/options.json`:

```
{
  "httpPort": "8000",
  "machineDirs": {
    "demo": "%U/d/temp",
    "myapp": "%U/myapp/assets",
    "test": "/tmp/foo"
  },
  "appPort": "8001"
}

```

The above example options.json file says that the `myapp` assets are
to be found in the directory `~/myapp/assets` for the user who runs
Popcorn.

## Launch Popcorn and Browse Machine URL and HTML

The command to launch Popcorn is `bin/launch`, under the Popcorn
directory (wherever you installed Popcorn). This command launches
Popcorn in the foreground, where you can see its log output if any.

By default, Popcorn listens to HTTP requests on port `8000`, and it
listens to apps on port `8001`.

If your app needs to be launched, this can be done at this time. Then
you can view the URL for your machine:

```
http://localhost:8000/mymachine
```

This URL indicates that Popcorn has been configured to run on the
local host at the default 8000 port, and your state machine is named
`mymachine`. The state machine name must be composed purely of
lowercase letters `[a-z]`.


# How to Write a Popcorn Application

1. Decide on the application state machine with the designer.

1. Set up communication with the Popcorn server on the TCP or UNIX
domain port where it will listen for apps. In the beginning, send
Popcorn a `provide` transaction so that it has the initial state
machine.

1. As your application runs, update the machine with an `update`
transaction.

1. Optionally, decide on the set of commands your app can understand,
and implement them as `command` transactions that Popcorn will send to
your app.

## Communication overview

A Popcorn Application, or "app", is a program that owns one or more
state machines, keeping each machine updated as the application state
changes.

Optionally, the app can also service incoming text commands, which can
be in any single-line or multi-line format it wants.

```
  app --> (machine updates) --> Popcorn --> (events) --> HTTP client
  app <-- (commands) <-- Popcorn <-- (events) <-- HTTP client
```

Each machine can have only at most one app providing it, but
multiple HTTP clients can all request the same machine; they will
all see the same machine and the same updates.

```
      1  provides 1..*          1  requests 1..*
   app ------------->  machine <---------------- web client
```

The apps do not have to be connected to the app-server at the same
time as the clients; Popcorn remembers the machines and accumulates
all the updates for each machine, so that when a web client requests a
machine, it always sees the latest one. (But Popcorn does not cache
incoming commands: to get those, the application has to stay
persistently connected).

## Transaction formats

### Background on Server-Sent Events (SSE)

Server-Sent Events (SSE) is a W3C standard format for events sent
from an HTTP server to the browser.

SSE is a simple, text-based format that can carry a multi-line
payload. An SSE event consists of multiple text lines that look like
this:

```
  event: message
  data: lorem ipsum dolor sit amet,
  data: consectetur adipiscing elit,

```

The above lines show a single SSE event (it ends with a blank
line). The type of this event is `message`, the word that follows the
`event:` marker. The payload is the multi-line text that follows the
`data:` markers. In this way, arbitrary multi-line text data can be
sent.

- For details on SSE, see https://www.w3.org/TR/eventsource/

Popcorn uses SSE as the format to carry transactions to and from apps.
Sending SSE events to Popcorn is very easy; receiving them from
Popcorn is a little more work, but there are libraries in almost every
language to make that part easier.

Here are the formats for the different transactions that apps need to
send and receive.

### Provide transaction

When an app sends Popcorn a `provide` transaction, it sends Popcorn a
series of `P` and `D` commands that can build the entire machine.  As
far as Popcorn is concerned, the app becomes the "provider" of that
machine.

This is the format of the multi-line `provide` transaction:

```
provide NAME
SERIALIZATION LINES
```

Where `NAME` is the name of the machine, and `SERIALIZATION LINES` are
the `P` and `D` commands, one command per line, that describe the
machine.

After this machine is provided to Popcorn, whenever a web client
connects to Popcorn with the machine `NAME` in the URL, then this
machine is delivered to it, and the web client is subscribed to any
subsequent updates to the machine.

### Update transaction

This is the format of the multi-line `update` transaction:

```
update NAME
BLOCK LINES
```

Where `NAME` is the name of the machine, and `BLOCK LINES` are the
change `C` and data `D` commands, one per line, that describe the
update to be made.

When Popcorn receives this `update` transaction, it modifies its copy
of the machine named `NAME` and notifies any web clients that happen
to be connected to Popcorn and subscribed to that machine. Those
clients will modify their displayed document object model (DOM) to
reflect the new, modified state of the machine.

From then on, any new web clients that connect to Popcorn with that
machine `NAME` in the URL, will automatically receive the new machine
state and will also be subscribed for any further updates.

### Abandon transaction

This is the format of the single-line `abandon` transaction:

```
abandon NAME
```

Where `NAME` is the name of the machine. The app that sent this
transaction is abandoning the machine `NAME` and will never send any
more updates for it.

Popcorn will forget the machine `NAME`. Any web clients that now
connect to Popcorn with that `NAME` in the URL will get an error
message saying that no such machine exists.

Any existing web clients that were subscribed to this machine, will be
notified that the machine no longer exists and will also stop getting
updates.

### Command transaction

Command transactions come in the reverse direction, from a web client
to the app, whenever the user triggers a button press or similar
input.

This is the format of a multi-line `command` transaction:

```
command MACHINE-NAME CLIENT-ID
COMMAND LINES
```

Where `MACHINE-NAME` is the name of the machine associated with the
user input, `CLIENT-ID` is a unique string assigned to each web
client, and `COMMAND LINES` is a format decided by the app developer:
they could be a single line, or split up into multiple lines.

Popcorn does not know anything about `COMMAND LINES`; they are simply
conveyed from the client to the app as they were formatted.

The app does not have any way of sending acknowledgements for these
commands; all communication initiated by the app is in the form of
`provide`, `update`, and `abandon` transactions.


## App connections and SSE protocol

The above-mentioned transactions are exchanged between Popcorn and
apps over network connections. These connections use the SSE protocol
to carry these transactions as payloads. Here we describe how the SSE
protocol is used to wrap these transactions.

### Apps: Persistently-connected vs. Drive-by

Apps can decide to connect to Popcorn in one of two ways: either they
can keep the TCP or UNIX-domain socket open and continue to send and
receive transactions, or they can open a new socket every time, send a
transaction, and close the socket. We call the former type of apps
"persistently-connected" apps, and the latter type "drive-by" apps.

The SSE event type to be used depends on how the app connects to
Popcorn: persistently connected, or drive-by.

### Persistently-connected app

The app should send an SSE event type `appConnect`, with a one-word
payload string.

```
  event: appConnect
  data: APPNAME
```

Popcorn will keep the network connection open and remember the string
`APPNAME`. Popcorn will acknowledge this connection with a `message` event and the one-word payload `ok`:

```
  event: message
  data: ok
```

Popcorn will henceforth use `APPNAME` as the name of this app in
messages and logs.

The app should remain connected to Popcorn and send `provide`,
`update`, and `abandon` transactions as payloads in SSE event type
`message`. All of these event exchanges follow the same pattern: for
each of these SSE `message` events, Popcorn will reply with an SSE
`message` event with the payload `ok` on success, or some other string
to signal an error.

Whenever any web client subscribed to a machine gets any user input,
the app will see commands sent back to it through Popcorn, as
`command` transactions in SSE event type `message`. The app should do
whatever it needs to depending on the meaning of the command; it does
not need to respond to Popcorn.

Here is an example SSE event sequence from app to Popcorn (left
column), and from Popcorn to app (right column), where the app is
providing a machine named `mymachine`:

```
  event: appConnect
  data: myApp
                             event: message
                             data: ok
  event: message
  data: provide mymachine
  data: ...
                             event: message
                             data: ok
  event: message
  data: update mymachine
  data: ...
                             event: message
                             data: ok
  ...

                             event: message
                             data: command mymachine
                             data: ...
```

### Drive-by apps: one-shot command, or fire-and-forget

The above persistently-connected apps need to open a network
connection to Popcorn and keep it open as they modify the machine and
receive commands back. That can be a significant amount of work for an
existing application to integrate with Popcorn, depending on its
architecture.

Drive-by Popcorn apps, in contrast, are designed for loose integration
with existing applications that can be extended by calling external
commands but cannot be modified. Drive-by apps are usually
command-line tools, either issued manually at a terminal or called
from scripts.

Drive-by apps can perform two kinds of event exchanges with Popcorn
during their brief connection: **one-shot command** apps send one
event, wait for a response from Popcorn, then
disconnect. **Fire-and-forget** apps simply send an event and
disconnect.

On UNIX-like operating systems, you can use utilities like `netcat` or
`nc` in scripts to open a network connection to Popcorn and perform
these string-based SSE format exchanges.

### One-shot command app

If an app connects as a one-shot command app (SSE event type
`oneShotCommand`), then it will get one response back from Popcorn,
either a success or a failure. (event type `replySuccess` or
`replyFailure`).  This response indicates whether the `provide` or
`update` transaction was correctly handled by Popcorn.

Here is the initial SSE event from app to Popcorn, and the reply from
Popcorn.  We show a `provide` transaction, but the same format is used
for sending `update` transactions, too. At the end of this exchange,
both sides close the socket.

```
  event: oneShotCommand
  data: provide ...
  data: ...

                      event: replySuccess
                      data: ok

```

### Fire-and-Forget app

If an app connects as a fire-and-forget command app (SSE event type
`fireAndForget`), then as soon as it sends the SSE event, the app
closes the socket and gets nothing back. Other than this, a
fire-and-forget app behaves exactly like a one-shot command app.

Here is the SSE event from app to Popcorn, followed by closing the
socket. We show a `provide` transaction, but the same format is used
for sending `update` transactions, too.

```
  event: fireAndForget
  data: provide ...
  data: ...

```

In any drive-by apps, either the `oneShotCommand` or `fireAndForget`
cases, once the app sends a `provide` transaction, then any app can
send `update` transactions on subsequent connections using the same
machine name. Popcorn assumes that the app sending the updates is the
same one that originally provided the machine. Popcorn does not
distinguish between different apps that are all using drive-by
methods.


# Deployment considerations

## Launch and options file

Popcorn can be deployed independently of any applications or web
assets. The Popcorn server should be deployed under the ownership of a
user with permissions to listen on the chosen sockets for HTTP and TCP
traffic.

On launch, Popcorn reads its configuration file:

```
~/.popcorn/options.json
```

This file specifies the following key information:

```
httpPort           HTTP port to listen on for clients
appPort            TCP port (or UNIX socket) to listen on for apps
machineDirs        Location of asset directory for each machine
```

## Performance and scalability

Each Popcorn server maintains a persistent websocket connection with
each of its clients, so as a practical matter, it can work well with a
few dozen clients at a time on a 1 GHz machine.

As far as applications (apps) are concerned, they can come and go, or
they can be persistently connected to listen for commands. Popcorn can
work well with a dozen or so apps on a 1 GHz machine. This does not
count the CPU taken by the app itself. The app could run on a
different machine, too, if it uses a TCP socket to communicate with
Popcorn. Most apps do not update their state machines more often than
about once a second. If an app is doing hundreds of updates a second,
then network, CPU, and memory usage might be worth reviewing.

The NodeJS runtime takes about 20 to 25MB of real memory.  Popcorn
maintains in memory each state machine.  The Popcorn application takes
about 10MB with two or three apps running. If Popcorn is the only
thing running, it should run well on fairly modest-sized systems.

## Run-time dependencies

Popcorn is written in NodeJS, so it requires the NodeJS runtime
version 10 or newer. But it has no other dependencies. Popcorn
implements both SSE and websocket protocols entirely on its own
without including any third-party libraries.

The commands in `bin`, namely `launch` and others, are shell scripts,
so they either require a UNIX/Linux machine, or at least a shell
environment such as Windows Subsystem for Linux (WSL) on Windows 10.

For a Windows port, see the section *Popcorn roadmap* for plans.

These scripts are quite minimal; it is always possible to launch
Popcorn using a command-line invocation of `node`, giving it the `js`
file named `launch.js`.
