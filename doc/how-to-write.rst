
How to Write a Popcorn Application
====================================

1. Decide on the application UX Model with the designer.

1. Set up communication with the Popcorn server on the TCP or UNIX
domain port where it will listen for apps. In the beginning, send
Popcorn a ``provide`` transaction so that it has the initial state
machine.

1. As your application runs, update the UX Model with an ``update``
transaction.

1. Optionally, decide on the set of commands your app can understand,
and implement them as ``command`` transactions that Popcorn will send to
your app.

Communication overview
-------------------------------------------

A Popcorn Application, or "app", is a program that owns one or more
UX Models, keeping each UX Model updated as the application state
changes.

Optionally, the app can also service incoming text commands, which can
be in any single-line or multi-line format it wants.::

  app --> (UX Model updates) --> Popcorn --> (events) --> HTTP client
  app <-- (commands) <-- Popcorn <-- (events) <-- HTTP client


Each UX Model can have only at most one app providing it, but
multiple HTTP clients can all request the same UX Model; they will
all see the same UX Model and the same updates::

      1  provides 1..*          1  requests 1..*
   app ------------->  UX Model <---------------- web client


The apps do not have to be connected to the app-server at the same
time as the clients; Popcorn remembers the UX Models and accumulates
all the updates for each UX Model, so that when a web client requests a
UX Model, it always sees the latest one. (But Popcorn does not cache
incoming commands: to get those, the application has to stay
persistently connected).

Transaction formats
-------------------------------------------

Background on Server-Sent Events (SSE)
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

Server-Sent Events (SSE) is a W3C standard format for events sent
from an HTTP server to the browser.

SSE is a simple, text-based format that can carry a multi-line
payload. An SSE event consists of multiple text lines that look like
this::

  event: message
  data: lorem ipsum dolor sit amet,
  data: consectetur adipiscing elit,

The above lines show a single SSE event (it ends with a blank
line). The type of this event is ``message``, the word that follows the
``event:`` marker. The payload is the multi-line text that follows the
``data:`` markers. In this way, arbitrary multi-line text data can be
sent.

- For details on SSE, see https://www.w3.org/TR/eventsource/

Popcorn uses SSE as the format to carry transactions to and from apps.
Sending SSE events to Popcorn is very easy; receiving them from
Popcorn is a little more work, but there are libraries in almost every
language to make that part easier.

Here are the formats for the different transactions that apps need to
send and receive.

Provide transaction
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

When an app sends Popcorn a ``provide`` transaction, it sends Popcorn a
series of ``P`` and ``D`` commands that can build the entire UX Model.  As
far as Popcorn is concerned, the app becomes the "provider" of that
UX Model.

This is the format of the multi-line ``provide`` transaction::

 provide NAME
 SERIALIZATION LINES

Where ``NAME`` is the name of the machine, and ``SERIALIZATION LINES`` are
the ``P`` and ``D`` commands, one command per line, that describe the
UX Model.

After this UX Model is provided to Popcorn, whenever a web client
connects to Popcorn with the UX Model ``NAME`` in the URL, then this
UX Model is delivered to it, and the web client is subscribed to any
subsequent updates to the UX Model.

Update transaction
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

This is the format of the multi-line ``update`` transaction::

 update NAME
 BLOCK LINES

Where ``NAME`` is the name of the UX Model, and ``BLOCK LINES`` are the
change ``C`` and data ``D`` commands, one per line, that describe the
update to be made.

When Popcorn receives this ``update`` transaction, it modifies its copy
of the UX Model named ``NAME`` and notifies any web clients that happen
to be connected to Popcorn and subscribed to that UX Model. Those
clients will modify their displayed document object model (DOM) to
reflect the new, modified state of the UX Model.

From then on, any new web clients that connect to Popcorn with that
UX Model ``NAME`` in the URL, will automatically receive the new UX Model
state and will also be subscribed for any further updates.

Abandon transaction
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

This is the format of the single-line ``abandon`` transaction::

  abandon NAME

Where ``NAME`` is the name of the UX Model. The app that sent this
transaction is abandoning the UX Model ``NAME`` and will never send any
more updates for it.

Popcorn will forget the UX Model ``NAME``. Any web clients that now
connect to Popcorn with that ``NAME`` in the URL will get an error
message saying that no such UX Model exists.

Any existing web clients that were subscribed to this UX Model, will be
notified that the UX Model no longer exists and will also stop getting
updates.

Command transaction
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

Command transactions come in the reverse direction, from a web client
to the app, whenever the user triggers a button press or similar
input.

This is the format of a multi-line ``command`` transaction::

 command MACHINE-NAME CLIENT-ID
 COMMAND LINES


Where ``MACHINE-NAME`` is the name of the UX Model associated with the
user input, ``CLIENT-ID`` is a unique string assigned to each web
client, and ``COMMAND LINES`` is a format decided by the app developer:
they could be a single line, or split up into multiple lines.

Popcorn does not know anything about ``COMMAND LINES``; they are simply
conveyed from the client to the app as they were formatted.

The app does not have any way of sending acknowledgements for these
commands; all communication initiated by the app is in the form of
``provide``, ``update``, and ``abandon`` transactions.


App connections and SSE protocol
---------------------------------

The above-mentioned transactions are exchanged between Popcorn and
apps over network connections. These connections use the SSE protocol
to carry these transactions as payloads. Here we describe how the SSE
protocol is used to wrap these transactions.

Apps: Persistently-connected vs. One-shot
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

Apps can decide to connect to Popcorn in one of two ways: either they
can keep the TCP or UNIX-domain socket open and continue to send and
receive transactions, or they can open a new socket every time, send a
transaction, and close the socket. We call the former type of apps
"persistently-connected" apps, and the latter type "one-shot" apps.

The SSE event type to be used depends on how the app connects to
Popcorn: persistently connected, or one-shot.

Persistently-connected app
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

The app should send an SSE event type ``appConnect``, with a one-word
payload string.::

  event: appConnect
  data: APPNAME

Popcorn will keep the network connection open and remember the string
``APPNAME``. Popcorn will acknowledge this connection with a ``message`` event and the one-word payload ``ok``::

  event: message
  data: ok

Popcorn will henceforth use ``APPNAME`` as the name of this app in
messages and logs.

The app should remain connected to Popcorn and send ``provide``,
``update``, and ``abandon`` transactions as payloads in SSE event type
``message``. All of these event exchanges follow the same pattern: for
each of these SSE ``message`` events, Popcorn will reply with an SSE
``message`` event with the payload ``ok`` on success, or some other string
to signal an error.

Whenever any web client subscribed to a UX Model gets any user input,
the app will see commands sent back to it through Popcorn, as
``command`` transactions in SSE event type ``message``. The app should do
whatever it needs to depending on the meaning of the command; it does
not need to respond to Popcorn.

Here is an example SSE event sequence from app to Popcorn (left
column), and from Popcorn to app (right column), where the app is
providing a UX Model named ``mymachine``::

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

One-shot command
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

The above persistently-connected apps need to open a network
connection to Popcorn and keep it open as they modify the UX Model and
receive commands back. That can be a significant amount of work for an
existing application to integrate with Popcorn, depending on its
architecture.

One-shot Popcorn apps, in contrast, are designed for loose integration
with existing applications that can be extended by calling external
commands but cannot be modified. One-shot apps are usually
command-line tools, either issued manually at a terminal or called
from scripts.

One-shot apps perform one event exchange with Popcorn during their
brief connection: the app sends one event, waits for a response from
Popcorn, then disconnects.

On UNIX-like operating systems, you can use utilities like ``netcat`` or
``nc`` in scripts to open a network connection to Popcorn and perform
these string-based SSE format exchanges.

One-shot command app
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

If an app connects as a one-shot command app (SSE event type
``oneShotCommand``), then it will get one response back from Popcorn,
either a success or a failure. (event type ``replySuccess`` or
``replyFailure``).  This response indicates whether the ``provide`` or
``update`` transaction was correctly handled by Popcorn.

Here is the initial SSE event from app to Popcorn, and the reply from
Popcorn.  We show a ``provide`` transaction, but the same format is used
for sending ``update`` transactions, too. At the end of this exchange,
both sides close the socket::

  event: oneShotCommand
  data: provide ...
  data: ...

                      event: replySuccess
                      data: ok


If any one-shot app sends a ``provide`` transaction, then any app can
send ``update`` transactions on subsequent connections using the same
UX Model name. Popcorn assumes that the app sending the updates is the
same one that originally provided the UX Model. Popcorn does not
distinguish between different apps that are all using the one-shot
method.

For convenience on Linux, we provide a shell command
``one-shot-command``, which connects to the Popcorn app server and sends
one command. Here is how one invokes it. ``$`` is your command prompt::

 $ echo 'provide foo
 P .a
 P .b' | one-shot-command

This command returns ``0`` on success. On error, it returns non-zero,
and also prints out any error message.

By default, the ``one-shot-command`` assumes that the Popcorn app-server
is listening on the local host at port ``8001``. You can override this
default with the environment variables ``POPCORNHOST`` and
``POPCORNPORT``.
