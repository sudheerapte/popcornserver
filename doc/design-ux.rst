How to Design the UX of a Popcorn Application
==============================================

Overview
-------------------------------------------

1. Define the UX Model for your application along with the app
   developer.

2. Create your assets directory for the UX Model, and configure Popcorn
   to find the directory.

3. In your assets directory, create all your HTML, CSS, and other assets.

4. Launch Popcorn and view the URL for your UX Model.

Create assets directory and HTML files
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

When you have defined your UX Model as described in the previous
sections, you are ready to create your web assets as a hierarchy of
files in any directory you define.

In your assets directory, at the top level, you create
``mymachine-index.html``::

  <html>
  <meta charset="utf-8" />
  <head>
    <title>My Machine</title>
    ...
  </head>
  <body>
    ...
  </body>

If you need to define multiple UX Models in the same assets directory,
you can do so by naming their index files ``one-index.html``,
``two-index.html``, etc. All of these index files can reference images,
styles, and so on within the same directory.  Popcorn will serve each
machine index file as a separate URL of the form ``http://xyz/one``,
``http://xyz/two``, and so on.

Contents of mymachine-index.html
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

Make it a valid HTML document. Please use simple, lowercase ``<head>``
and ``<body>`` tags. Insert ``<link>`` tags in the head section for any
``css`` files.

In the body, you will use popcorn-specific attributes of the form
``data-XXX`` to point to a machine path.

data-alt to show a current alternative child
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

To display an element only when a particular alternative child is
current, assign to it this alternative child's path::

     <p data-alt=".hinge/open">The hinge is open</p>

The above example uses the ``data-alt`` attribute to mark a
paragraph. Whenever the UX Model has any other child of ``.hinge``
current, then this paragraph will not be displayed.

data-cmdclick to send commands to the app
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^


To send a command to the app when the user clicks a button or any
other element, assign to that element the command string as the value
of the attribute ``data-cmdclick``::

    <input type="button" value="Close"
     data-cmdclick="close hinge"></input>

The above example provides a button labeled "Close". If the user
clicks the button, Popcorn will send the command string ``close hinge``
to the app on the back end.

When the user clicks this button, the command string is sent, but
nothing changes in the UI. Or at least, not immediately: presumably
the app will update the UX Model in response to the command.

Sometimes, a command is expected to take time to take effect, and the
designer will want some feedback to be given to the user
immediately. For those cases, you can also use a ``data-chgclick``
attribute to directly change the UX Model state in the UI; see below.

data-chgclick to change the state
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

To directly change the state of the UX Model when the user clicks a
button or any other element, assign to that element a change
transaction as the value of the attribute ``data-chgclick``::

    <input type="button" value="Close"
     data-chgclick="C .hinge closed"></input>

The above example provides a button labeled "Close". If the user
clicks the button, Popcorn will immediately perform a change
transaction that sets the ``.hinge`` current value to ``closed``.

For the syntax of change transactions, see *How to develop a Popcorn
app* below.

If a transaction contains more than one change command, separate them
with commas in the string value of ``data-chgclick``.

This ``data-chgclick`` method is useful in two cases:

* UI navigation; for example, to change to a different tab. To achieve
  this, use the ``C`` command to make a different alt-child current, and
  use that alt-child as the value of a ``data-alt`` attribute for the
  new tab.

* Immediate feedback on issuing a long-running command. To achieve
  this, use ``data-chgclick`` along with the ``data-cmdclick`` attribute
  together. The ``data-cmdclick`` sends a command to the back end, while
  the ``data-chgclick`` immediately switches to a view that says,
  "waiting for response...".

This method of changing UX Model state should be used only for
"presentation logic". The app in the back end knows nothing about
``data-chgclick`` transactions. App development will get very confusing
if the app also sometimes sends the same kind of change
transaction. It is better for the designer and the app developer to
decide up front which of the paths belong to the UI and which ones
belong to the back end.

Configure Popcorn with assets directory location
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

You tell Popcorn where to find the assets directory for a UX Model
through Popcorn's config file, ``~/.popcorn/options.json``::

 {
  "httpPort": "8000",
  "machineDirs": {
    "demo": "%U/d/temp",
    "myapp": "%U/myapp/assets",
    "test": "/tmp/foo"
  },
  "appPort": "8001"
 }


The above example options.json file says that the ``myapp`` assets are
to be found in the directory ``~/myapp/assets`` for the user who runs
Popcorn.

Launch Popcorn and Browse UX Model URL and HTML
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

The command to launch Popcorn is ``bin/launch``, under the Popcorn
directory (wherever you installed Popcorn). This command launches
Popcorn in the foreground, where you can see its log output if any.

By default, Popcorn listens to HTTP requests on port ``8000``, and it
listens to apps on port ``8001``.

If your app needs to be launched, this can be done at this time. Then
you can view the URL for your UX Model::

  http://localhost:8000/mymachine

This URL indicates that Popcorn has been configured to run on the
local host at the default 8000 port, and your UX Model is named
``mymachine``. The UX Model name must be composed purely of
lowercase letters ``[a-z]``.

