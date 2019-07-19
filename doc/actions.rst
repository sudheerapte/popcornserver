.. _actions:

Popcorn Web Actions
================================

Action Commands in UXML
-------------------------

In the previous chapter we described UXML commands to build and modify
a UX model, and query it to to perform actions.

In this chapter, we explain what kinds of actions are possible with
Popcorn's web server. Briefly, these actions are of three kinds:

- read and modify the HTML DOM,
- post any input modes, and
- cause commands to be sent to the back-end app.

We describe UXML extensions to perform these three kinds of actions.

In the future, Popcorn could be extended to other environments where
user inputs and outputs involve unusual sensors and actuators. For
such environments, UXML commands will have to be developed for these
kinds of sensors and actuators.


Command descriptions
^^^^^^^^^^^^^^^^^^^^^

In the descriptions, we often use these terms in addition to *word*
and *path*:

*number*
   One or more digits, perhaps containing a decimal point, optionally
   preceded by a minus sign (ascii hyphen), perhaps separated from the
   digits by a space. For example: ``0``, ``-3``, ``52.1``.

*words*
   One or more of: *word*, *number*, *command word*, ascii space, or
   an ascii printable character. For example: ``100 px``,
   ``fill:#141414;fill-opacity:1``


Querying and Modifying the DOM
-----------------------------------


Setting attribute values
^^^^^^^^^^^^^^^^^^^^^^^^

  ===================  =================  ===================================
  Command              Arguments          Meaning
  ===================  =================  ===================================
  ``DOM SET``          ``ID ATTR VALUE``  Set the value of an attribute
  ``DOM SET BOOL``     ``ID ATTR``        Set boolean attribute
  ``DOM RESET BOOL``   ``ID ATTR``        Reset boolean attribute
  ===================  =================  ===================================

The ``DOM SET ATTR`` command sets the value of a non-boolean attribute
of an HTML element by ID:

  | ``DOM SET`` ``ID`` *word* ``ATTR`` *word* ``VALUE`` *words*

The above form sets the value of an attribute to the given value.
The *words* will be concatenated together before assignment.
The ``ID`` option argument must match the value of the element's
``id`` attribute. Possible errors: No such element.

For boolean attributes, there are ``DOM SET BOOL`` and ``DOM RESET
BOOL`` commands:

  | ``DOM SET BOOL`` ``ID`` *word* ``ATTR`` *word*
  | ``DOM RESET BOOL`` ``ID`` *word* ``ATTR`` *word*

The element whose ``id`` matches the ``ID`` option argument must take
a boolean attribute named by the ``ATTR`` option argument.  The ``DOM
SET BOOL`` command sets the boolean attribute on, while the ``DOM
RESET BOOL`` command sets it off.


Querying attribute values
^^^^^^^^^^^^^^^^^^^^^^^^^

  ===================  ==============  ===================================
  Query                Arguments       Evaluates to
  ===================  ==============  ===================================
  ``DOM ATTRW``        ``ID ATTR``     The *word* value of an attribute
  ``DOM ATTR``         ``ID ATTR``     The entire value of an attribute   
  ``DOM ON BOOL``      ``ID ATTR``     The boolean attibute ``ATTR``
  ===================  ==============  ===================================


The ``DOM ATTRW`` and ``DOM ATTR`` query commands extract the value of any
attribute. Typically you would write these commands in macro strings
so that their evaluation will yield the value.

``DOM ATTRW`` evaluates to a *word* based on the value of the
indicated attribute of the HTML element by ID:

  | ``DOM ATTRW ID`` *word* ``ATTR`` *word*

The two *words* are the HTML element id and the attribute name,
respectively. If the value of that attribute is longer than a *word*,
then the query evaluates to the longest prefix that matches the rules
for *word*.

The ``DOM ATTR`` query evaluates to a string, which is the value of
the indicated attribute of the HTML element by ID:

  | ``DOM ATTR ID`` *word* ``ATTR`` *word*

The resulting value is the entire string value of the attribute named
by the ``ATTR`` argument.

The ``DOM ON BOOL`` query is a *condition*. It is followed by a
``BEGIN...END`` pair enclosing arbitrary commands, which will be
executed only if the attribute ``ATTR`` is a boolean attribute that is
set:

  | ``DOM ON BOOL ID`` *word* ``ATTR`` *word* ``BEGIN``
  | ... *line* ...
  | ... *line* ...
  | ``END``

If the condition is true, i.e., the attribute named by the ``ATTR`` argument is set, then the *lines* between ``BEGIN`` and ``END`` are executed.


Posting Input Modes
--------------------

What is an input mode?
^^^^^^^^^^^^^^^^^^^^^^^^

Click, drag-and-drop, option choice, button press, keypress, form
submission, etc., are all examples of **user inputs**. Generally, user
inputs are targeted to some HTML elements. A **handler** is a function
invoked when the user input comes to one or more targets. The function
might do different things depending on which HTML element is the
target.

Usually it makes sense for an entire set of handlers to be attached to
a set of input targets (HTML elements) at once when the application is
in a certain state. We give a name to a combination of handlers and
targets and call it an *input mode*.

Whenever the application changes state, in addition to modifying the
DOM, we can also "post" (enable) a set of input modes. On the next
state change, we can post a different set of input modes. Input modes
stay posted only while the application maintains its current state.

The ``render`` script that is executed on every state change can
contain ``POST`` commands that post these input modes. The input modes are defined in a separate script called the ``post`` script.

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

The following built-in *handler types* are available.

  ==========  ===============  ===================================
  Type        Arguments        Meaning
  ==========  ===============  ===================================
  ``click``   ``ID``           Elem  id ``ID`` was clicked 
  ``dnd``     ``SRC, DST``     Elem ``SRC`` was dragged to ``DST``
  ``change``  ``ID``           Input elem ``ID`` was changed
  ==========  ===============  ===================================


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

