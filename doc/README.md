# Popcorn - make beautiful web-based applications

Popcorn is an unusual HTTP server designed from the ground up for
beautifully designed, highly responsive browser-based applications. It
is suitable for smart embedded devices or for applications that have a
limited number of users. It has not been designed for web-scale
Internet apps that serve thousands of users; for that kind of use, you
would probably need to deploy multiple copies of Popcorn. See
Deployment considerations section at the end.

A good user experience requires the UX designer to have *complete
control* over every user interaction. Popcorn lets the UX designer
define every single pixel of every millisecond of user interaction
using HTML5 features. If you are a UX designer, popcorn is for you!
There are no web programmers putting up roadblocks based on
programming difficulties or browser compatibilities, or framework
limitations. As long as your UX goal is logical for the application,
then you can make the user interaction work the way you want it.  The
only possible obstacle might be performance-related, for example the
response time from the application or the web rendering. You will have
to work around that.

If you are a programmer, Popcorn can free you from GUI concerns
entirely. All the web UI assets: HTML, images, CSS, SVG, etc., are
created by the UX designer. Popcorn provides a simple, unambiguous way
for you to communicate to the UX designer the UI states of the
application. You do not need to write any Javascript.

And finally, the Popcorn server is easy to integrate with applications
written in any language. Your application needs to communicate with
Popcorn over a TCP socket or a UNIX domain socket, using a simple
text-based protocol. Since Popcorn itself is written in NodeJS, we
have provided a client library for NodeJS applications to make them
even easier to integrate.

## How to read the rest of this document

If you are only curious about Popcorn, read the section *How Popcorn
Works*, and then decide if you want to read further.

If you are deploying a Popcorn-based web application, you should
read *How Popcorn Works* and then the section *Deployment
considerations*.

If you are a UX designer developing a Popcorn application, you should
read the above two sections, and also understand the *Popcorn State
Machine model*, and then *How to Design the UX of a Popcorn
Application*.

If you are programming a Popcorn application, you probably need to
read all the sections except *How to Design the UX of a Popcorn
Application*.

# How Popcorn Works

Popcorn imposes a pure model-view-controller (MVC) architecture on
your application UI. The "model" is a hierarchical state machine
defined by the designer and the programmer together. The "view" is the
web page, and the "controller" role is played by the application
program.  The controller makes updates to the model, while Popcorn
automatically manages the view so that it always reflects the current
state of the model.

Abstractly:

```
   controller  -->    model       -->  view
```

More concretely:

```
       app     -->  state machine --> browser
```

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

Of course, apart from updating the state machine, an application often
also needs to take user input. The application programmer should
define a set of *commands* with arguments in any convenient text
format. The UX designer can issue these commands from UI elements like
buttons, tabs, and text fields, by defining special Popcorn-defined
attributes in the HTML assets. Popcorn will transfer these commands
back to the application using the same TCP or UNIX-domain socket.

```
  app <-- command <-- browser
```

# The Popcorn State Machine Model

A state machine is a hierarchical tree of state nodes.

The tree defines two things:

1. The entire state space of the application model, i.e., all possible
states that the application model can be in.

2. The current state within this state space.

In general, any state can be of one of three types:

- A list of alternative states, one of which can be current at a time
  (for example, a door can be either open or closed). We call such a
  state an alternative-parent state, and we call these alternative
  states alternative children of the parent state.

- A list of concurrent states, each of which is current all the time
  (for example, a door can have a lock state and a hinge state). We
  call such a state a concurrent-parent state, and these concurrent
  states concurrent children of the parent state.

- A placeholder for a limited amount of data, e.g., a string that is
  no longer than 1024 bytes. We call such a state a data-state.

A state machine tree is called a "machine" in this document. The
machine represents the state of the application model as a set of
states contained within other states to form a tree.

The machine consists at least of one root node, which stands for a
concurrent-parent state. The root node can contain zero or more
concurrent children node. Every node in the tree has a short name
composed of lowercase letters, numbers, and hyphens. This short name
is unique among siblings of the same parent node. The root node has a
zero-length short name.

Any node in the tree can thus be identified uniquely by the complete
series of short names starting from the root node. If we write the
series as a string with delimiters separating the names, we get a
unique path. We use a dot character `.` to separate concurrent
children from their concurrent-parent nodes, and a slash character `/`
to separate alternative children from their alternative-parent
nodes.

## Example machines

Here is an example machine for the states of a room door:

```
  .hinge/open
  .hinge/closed.bolt/locked
  .hinge/closed.bolt/unlocked
```

The three paths above define the tree.  This machine shows the three
possible states of the door: open, closed and locked, or closed and
unlocked.

Note that our root node above has only one concurrent child,
`hinge`. Technically we could eliminate `hinge`, but we need it here
because `open` and `close` need an alternative-parent, which Popcorn
disallows the root node to be.

We could simplify the machine by leaving out the `bolt` node which, as
an only concurrent child, is not adding any value. Its alternative
children `locked` and `unlocked` could simply become the direct
alternative children of `closed` instead:

```
  .hinge/open
  .hinge/closed/locked
  .hinge/closed/unlocked
```

Both of our machines above model the door by disregarding the state of
the bolt when the door is `open`, presumably because it does not
matter to our application.

But we could represent the door's states more completely if we wanted
to. Here is a different way to model the same door:

```
  .hinge/open
  .hinge/closed
  .bolt/unlocked
  .bolt/locked
```

Here we are considering the hinge and the bolt as independent
(concurrent) sub-states of the root node. This tree represents a state
space of four states, for the two alternative children of `hinge`
times the two alternative children of `bolt`.

Of these four possible states, these three correspond to the states in
the earlier model:

```
  .hinge/open     .hinge/closed   .hinge/closed
  .bolt/unlocked  .bolt/unlocked  .bolt/locked
```

But in the new model, we are also allowing the bolt to be in the
"locked" state even when the door is open. In most doors, if you are
able to lock the bolt while the door is open, the door will be unable
to close until you unlock the bolt. If our application needs to make
this distinction, then this new 4-leaf-node tree is the better model.

# Specifying a Machine

We specify a machine by declaring all the paths. The command to
declare a path is `P`. Here is how we can specify our 4-leaf-node
machine:

```
P .hinge/open
P .hinge/closed
P .bolt/unlocked
P .bolt/locked
```

If we give this series of text lines to Popcorn using a `machine`
command, it will build a machine like this for us and keep it in
memory.

This machine specifies four possible states for our door. But in
addition, it also specifies an *initial state* for our door. The rule
is that when a series of `P` commands specifies the children of an
alternative-parent, then the first-mentioned child is automatically
assumed to be "current". Thus, in this example, if we asked Popcorn to
create this machine, our door will initially be in the `open` and
`unlocked` state.

If we want to change the current state, we send Popcorn an `update`
command with the changes. To close the door, we need to use a change
command, `C`, which specifies a node that we want to make current:

```
C .hinge.closed
```

This changes the `closed` alternative child to become the current
child.



# How to Design the UX of a Popcorn Application

You need to understand how to represent a hierarchical state machine
in Popcorn's syntax, explained in the previous section. When you have
defined your state machine, you are ready to create your web assets as
a hierarchy of files in any directory you define.

An app rendered by a Popcorn server always has a URL like this:

```
http://localhost:8000/mymachine
```

Above we assume Popcorn has been configured to run on the local host
at the default 8000 port, and your state machine is named
`mymachine`. The state machine name must be composed purely of
lowercase letters `[a-z]`.

The contents of the HTML web page look like this:
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

The two files `head-frags.html` and `frags.html` must be in directory
of assets you define.

## Contents of `frags.html`

You can enter any valid HTML elements that can go into the
`<body`. You will use popcorn-specific attributes like `data-machine`
to point to a machine path.

## Contents of `head-frags.html`

The `head-frags.html` file is optional. It is meant for entering
`<link>` elements for any CSS stylesheets you need, in the order you
need to cascade them. The `.CSS` files must be located inside the
assets directory in the subdirectory named by the `href` attribute.

## Popcorn assets directory location

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
to be found in the directory `~/myapp/assets` for the user who ran
Popcorn.


# How to Write a Popcorn Application

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

The apps do not have to be connected to the app-server at the same
time as the clients; the clients get their updates from a persistent
"broker" inside Popcorn that remembers the machines and accumulates
all the updates for each machine. (But not incoming commands: to get
those, the application has to stay persistently connected).

When an app connects and sends a popcorn "machine" command, it becomes
the provider of that machine. This is the format of the multi-line
machine command:

```
machine NAME\n
SERIALIZATION LINES
```

And this is the format of the multi-line update command:

```
update NAME\n
BLOCK LINES
```

These commands are to be sent as the "data" payload of an SSE event.
The event type depends on how the app connects.

If the app connects as a persistently-connected app ("appConnect"),
then it can remain connected to the app-server. It will get commands
sent back to it from GUI clients. Each command will come as a
"message" event, with a payload of one or more
lines:

```
command MACHINE-NAME\n
COMMAND LINES
```

The format of the command lines is to be negotiated between the GUI
clients and the app. Popcorn does not know anything about them. The
app does not have any way of sending acknowledgements for these
commands; all communication is in the form of machine updates.

If an app connects as a one-shot command app ("oneShotCommand"),
then it will get one response back, either a success or a
failure. (event type = "replySuccess" or "replyFailure").  This
response indicates whether the machine or update it sent was
correctly forwarded on to the broker.

Once it sends a machine command, then the app can send update
commands on subsequent connections using the same machine
name. Popcorn assumes that the same app sending the updates is the
one that originally provided the machine.

If an app connects as a fire-and-forget command app, then it gets
nothing back. Otherwise a fire-and-forget app behaves exactly like a
one-shot command app.

# Deployment considerations

Popcorn can be deployed independently of any applications or web
assets. The Popcorn server should be deployed under the ownership of a
user. On launch, it reads its configuration file:

```
~/.popcorn/options.json
```

This file specifies the following key information:

```
httpPort           HTTP port to listen on for clients
appPort            TCP port (or UNIX socket) to listen on for apps
machineDirs        Location of asset directory for each machine
```

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

The NodeJS runtime takes about 250MB of real memory.  Popcorn
maintains in memory each state machine.  The Popcorn application takes
about a hundred megabytes. If Popcorn is the only thing running on a
machine, it should run well in about half a GB (in addition to the OS).

