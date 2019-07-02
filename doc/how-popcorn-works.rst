
How Popcorn Works
=================

Popcorn defines a text-based language in which you can describe the UI
state of your application. Using this language, you build and maintain
a data structure called a **UX Model**. This model is how the program
(application) and the web page keep in sync. Popcorn maintains this
model within the web server and keeps a version of it updated in the
web browser.

As a UX designer, to make your web page reflect the current UX Model,
you mark up your HTML and SVG elements with certain ``data-``
attributes. To capture user actions, you "post" **input modes**, i.e.,
make various click, drag, and form submission actions active, based on
the UX Model. To notify the application about the user inputs, you
send command strings to Popcorn.

As a programmer, you connect to Popcorn over a TCP socket. You write
to this socket when you need to update the UX Model, and you read from
this socket any commands sent by the web page.

Data flow in Popcorn
--------------------

Thus, Popcorn imposes a certain architecture on your application
UI. This architecure is similar to Facebook's Flux data flow
architecture::

  Action --> Dispatcher --> Store --> View

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
Store are both implemented by Popcorn. The Store holds a state machine
in the form of a UX Model.

The data flow looks like this in Popcorn::

    app --> (state machine update) -->  Popcorn --> View

At run time, your application sends a text description, called an
"update", that describes changes to be made to the UX Model. This
update is analogous to an Action in Flux.  Popcorn interprets the
update by making changes to the UX Model.

The View in Popcorn consists of annotated web assets (HTML, CSS,
images, SVG) that your UX designer prepares. When the state is
updated, Popcorn causes the web assets to change their visibility
according to the new state. You don't write any code.

The UX designer writes HTML tags and other web assets, referencing the
UX Model by using attribute values. Popcorn defines certain
attributes and their meanings for this purpose. At run time, Popcorn
uses these attribute-based references to decide which of the web
assets should be rendered, turning them on and off so that the web
browser renders the right ones.

The programmer defines the UX Model and makes the application
update it at run time. Beyond this, the programmer writes the
application without any regard to the GUI.

Popcorn maintains a mirror copy of the UX Model in the browser
page and keeps it updated automatically by sending it events.

A more detailed picture of the data flow::

       app --> update  --+
                         |
                         V
                 server-side UX Model
                         |
                         | (websocket events)
                         V
                 browser-side UX Model
                         |
                         V
                       View        

The designer and the programmer must agree on the UX Model for the
application. Popcorn provides a standardized text-based syntax to
describe the UX Model and the format of update transactions.

As long as they work from the same UX Model definition, the
designer and the programmer can do their work largely independently.
If a design change desired by the UX designer requires changes to the
UX Model definition, then the designer needs to consult with the
programmer, who can then make the corresponding changes on the
application side. But otherwise, the UX designer can make large design
changes without even informing the programmer; no changes are needed
to the application as long as the UX Model remains the same.

The web assets can be maintained by the UX designer in a separate
repository from the application program; this is a recommended best
practice.  Also, there can be different models, i.e., UX Model
definitions, for different types of UIs for the same application. For
example, there could be an "administrator UI" and an "end-user UI",
each with its own UX Model. The application would be responsible
for keeping both of these UX Models updated.

Popcorn applications can be written in any language, because they
communicate with Popcorn via TCP or UNIX-domain sockets using a
text-based protocol. Popcorn listens on two different ports for HTTP
and TCP traffic.  We provide a simple Javascript client library for
Nodejs based applications, to make it easier to develop an app.

In terms of protocols, the data flows like this::

   app --> (TCP socket) --> popcorn --> (websocket) --> browser

Of course, apart from updating the UX Model, an application often
also needs to take user input. The application programmer should
define a set of *commands* with arguments in any convenient text
format. The UX designer can issue these commands from UI elements like
buttons, tabs, and text fields, by defining special Popcorn-defined
attributes in the HTML assets. Popcorn will transfer these commands
back to the application using the same TCP or UNIX-domain socket::

  app <-- popcorn <-- command event <-- browser

