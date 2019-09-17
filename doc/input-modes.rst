.. _input-modes:


Posting Input Modes
--------------------

What is an input mode?
^^^^^^^^^^^^^^^^^^^^^^^^

Click, drag-and-drop, option choice, button press, keypress, text
editing, form submission, etc., are all examples of **user
inputs**.

Popcorn offers an abstraction called **input mode** for responding to
user input. An input mode is a combination of an element, a user
input, and a handler.  You enable, or "post", a set of these input
modes based on the current application state.

Once posted, an input mode is triggered on user input, and its handler
is automatically called.

We support the following input types. For each type, we show the
arguments that the handler will get when it is triggered.

  ==========  ===============  ===================================
  Type        Arguments        Meaning
  ==========  ===============  ===================================
  ``click``   ``ID``           Elem  id ``ID`` was clicked 
  ``dnd``     ``SRC, DST``     Elem ``SRC`` was dragged to ``DST``
  ``change``  ``ID``           Input elem ``ID`` was changed
  ==========  ===============  ===================================

You define input modes in your **init** script by defining the three
components (element, user input type, and a handler). The type of user
input also corresponds to a built-in UX sub-model, which is built for
you automatically:

  ==========  ===================  ===================================
  Type        Path                 Alt children of ``.p``, in addition
                                   to ``unposted`` and ``posted``
  ==========  ===================  ===================================
  ``click``   ``{{SRC}}``          ``clicked``
  ``dnd``     ``{{SRC}}.{{DST}}``  ``dragging`` ``dropping`` ``dropped``
  ``change``  ``ID``               ``changed``
  ==========  ===================  ===================================

The ``render`` script that is executed on every state change can
contain ``POST`` commands that post these input modes. The input modes
are defined in a separate script called the ``post`` script.

Life cycle of an input mode
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

On creation, an input mode is given a single-word **name**. This name
is used by Popcorn to automatically create a sub-state under the path
``.m``.

For example, a click input mode named ``move-spider`` for the element id ``spider1`` would result in
a sub-state::

  .m.move-spider.spider1.p.unposted

The entire sub-tree underneath ``.m.move-spider.spider1`` is
automatically created and maintained by Popcorn. It reflects the
following lifecycle:

  =============  ===================  ===================================
  Type           State                Meaning
  =============  ===================  ===================================
  click ``SRC``  unposted             Dormant, e.g., just after creation

  click ``SRC``  posted               ``POST`` was called. Now listening
                                      for a button click on
                                      element ``SRC``

  click ``SRC``  clicked              Element id ``SRC`` was clicked by
                                      user. The handler is called with the
                                      variable ``SRC`` set to the ID
                                      of the element.
  =============  ===================  ===================================

When you issue a ``POST`` command to post the input mode, then the
state changes to ``posted``. If the user clicks on the element
``spider1``, then the state changes to ``clicked``.

After every handler call, the ``render`` script is called, so that you
can make any downstream modifications to the UX model. Typically, this
will result in a whole different set of modes being posted.


Popcorn modification cycle
----------------------------

Popcorn is usually in a quiescent state, i.e., the UX model is stable
until an external event happens. Three kinds of events cause the UX
model to change:

- A user input arrives and its handler is executed.
- An app update arrives, and it is executed.
- A timer triggers and its handler is executed.

In each of these cases, as soon as the execution is done, the *render*
script is called. This script can cause downstream effects to the UX
model and to the DOM, including posting of new modes and the unposting
of existing modes.

Finally, after the render script is completed, the UX model goes back
to the quiescent state.


The post script
^^^^^^^^^^^^^^^^

The ``post`` script has a list of all the input modes and
handlers. Each input mode and each handler has its own section, marked
by a ``%`` sign and a name:

  | ``%`` *word*
  | ... *line* ...
  | ... *line* ...
  | ``%`` *word*
  | ... *line* ...
  | ... *line* ...

The *words* in the above listing are the names of input modes or
handlers, and the *lines* are their bodies.

An input mode contains a series of ``ATTACH`` commands that attach
handlers to HTML elements.  A handler contains a series of lines that
will be executed when the user issues an input.

Handlers
^^^^^^^^^


A handler is a list of commands that can be attached to user
inputs. We explain how they work below.


Input Modes
^^^^^^^^^^^^

An input mode is also a list of commands, named using a ``%``
sign.

  | ``%`` *word*
  | ... *commands*  ...
  | ...


The *commands* above are arbitrary UXML, but the most important
command is ``ATTACH``, which attaches a handler to a user action. The
three types of handlers have different options:

  | ``ATTACH TYPE click HANDLER`` *word* ``ID`` *word*
  | ``ATTACH TYPE dnd HANDLER`` *word* ``SRC`` *word* ``DST`` *word*
  | ``ATTACH TYPE change HANDLER`` *word* ``ID`` *word*

For example, our ``mode`` script can include the following mode::

  % turn-spider
  WITH CURRENT .board.POS/spider1 ALL .adj.POS.ADJPOS BEGIN
  ATTACH TYPE dnd HANDLER move-spider SRC {{POS}} DST {{ADJPOS}}
  END

The above mode, named ``turn-spider``, should be posted when it is the
spider's turn to make a move.

The ``WITH`` command unrolls to produce three ``ATTACH`` commands as
we saw in the previous chapter::

    ATTACH TYPE dnd HANDLER move-spider SRC a DST b
    ATTACH TYPE dnd HANDLER move-spider SRC a DST c
    ATTACH TYPE dnd HANDLER move-spider SRC a DST d

Each ``ATTACH`` above refers to a handler named ``move-spider``, which
is declared somewhere in the ``mode`` script as a ``%`` name. The
commands in that handler will be attached to the HTML element
combinations, so that drag-and-drop input will be enabled between
these combinations.

When the user performs a drag-and-drop action between (say) ``a`` and
``c``, then the command in the handler ``move-spider`` will be
executed with the ``{{SRC}}`` and ``{{DST}}`` macros evaluating to
``a`` and ``c``, respectively.


Defining Handlers
^^^^^^^^^^^^^^^^^^

  | ``%`` *word*
  | ... *commands* ...
  | ...

In the above snippet, *word* is the name of the handler.

The *commands* above are arbitrary UXML. Here is an example::

  <script id="input" type=text/plain>
  % choose-spider
  SET CURRENT .selectedspider {{ID}}

  % move-spider
  SEND move {{SRC}} {{DST}}
  </script>

The handler names ``choose-spider`` and ``move-spider`` are marked
with percent signs. They each contain one UXML command that will be
attached to an HTML element when an input mode is posted.

Similarly, ``dnd`` and ``change`` handlers are named lists of commands
containing macros of the variable names listed in the table above.

