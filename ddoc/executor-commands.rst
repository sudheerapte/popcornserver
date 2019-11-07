.. _executor-commands:

Go directly to :ref:`runtime`


Commands and Queries
=======================

.. _psl-basic-commands:


Basic Commands and Queries
----------------------------


State Space Commands
^^^^^^^^^^^^^^^^^^^^

These commands modify the state space, i.e., they change the shape of
the tree.  See :ref:`machine-design` for the corresponding low-level
machine commands ``addLeaf`` and ``deleteLastLeaf`` that these
are built on top of.

  ==============  ==============================================
  Command         Behavior
  ==============  ==============================================
  ``DEF CON``     1. Create parent components if they do not exist.
                     Add undo for parent components.
                  2. If parent exists and is not suitable, ERROR.
                  3. For each child, if it does not exist,
                     add child to end of list, and add undo.
  ``DEF ALT``     1. Create parent components if they do not exist.
                     Add undo for parent components.
                  2. If parent exists and is not suitable, ERROR.
                  3. For each child, if it does not exist,
                     add child to end of list, and add undo.
  ``DEL``         1. If path does not exist, ERROR.
                  2. If path has children, ERROR.
                  3. Remove path from parent. Add undo.
  ==============  ==============================================



State Definition Commands
^^^^^^^^^^^^^^^^^^^^^^^^^^^

  ================  =================================================
  Command           Behavior
  ================  =================================================
  ``SET CURRENT``   1. If parent does not exist, ERROR.
                    2. If parent is wrong type, ERROR.
                    3. If parent does not have the indicated child,
                       ERROR.
                    4. Set current and add undo.
  ``SET DATAW``     1. If node does not exist, ERROR.
                    2. If node is not a data node, ERROR.
                    3. Set data and add undo.
  ``SET DATA``      (same as ``SET DATAW``)
  ================  =================================================


Timer Commands: Schedule and Cancel
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

A timer can be scheduled to execute either a named procedure or a
single inline command. Once scheduled, it can also be canceled.

To schedule a procedure for execution, use this syntax:

|  ``TIMER`` ``SCHEDULE``
|     ``DELAY`` *number*
|     ``NAME`` *string*
|     ``EXEC`` *word*

After a delay of at least *number* milliseconds, Popcorn will execute
the procedure *word*.  The ``NAME`` *string* is a name you assign to
this timer.  If a ``NAME`` is provided, then this timer can be
canceled using the ``TIMER CANCEL`` command, see below.  The procedure
*word* must exist.

Instead of a procedure, you can provide a single inline command if
that is convenient. The syntax is as follows:

|  ``TIMER`` ``SCHEDULE``
|     ``DELAY`` *number*
|     ``NAME`` *string*
|     ``COMMAND`` *tokens*

The *tokens* will be interpreted as a command and executed as an
``UPDATE`` message when the time comes.

To cancel an existing timer, use the ``TIMER CANCEL`` command:

| ``TIMER`` ``CANCEL``
|     ``NAME`` *string*

If any existing timer named *string* is already scheduled, then it
will be canceled. If no such timer is scheduled, or if one has already
executed, then this command will do nothing. There can be more than
one timer with the same ``NAME``; if so, all of them will be canceled.

An important use case for timers is when a back-end application
command is to be sent in response to a user input.  In order to give
the application time to respond, you might want to change the UI state
temporarily, showing that the user input has been accepted. When the
back-end application processes the command and updates the application
state, the UI state will automatically change.

In case the back-end application does not respond for a while, then
setting a timer gives you the ability to reflect this failure in the
UI gracefully. If the delayed procedure executes, then it can show an
error message. If instead the application responds correctly, then the
update procedure should use ``TIMER CANCEL`` to prevent the error
message state from happening.


Queries
^^^^^^^^^^^^^^^^^^^^^^^^^^^

  ==============  ==============================================
  Query           Returns...
  ==============  ==============================================
  ``CURRENT``     The current child of an alt-parent node.
  ``DATAW``       The *word* assigned to a data-leaf node.
  ``DATA``        The string assigned to a data-leaf node.
  ==============  ==============================================


Procedures
---------------------------------

Built-in Procedures
^^^^^^^^^^^^^^^^^^^^^

There are expected to be two built-in procedures with standard names
``INIT`` and ``RENDER``. These never need to be executed explicitly;
they are automatically executed as described below.

``INIT``
  When the page is first loaded, this procedure is executed.  You can
  create any extensions to the tree needed for the UI
  here. Similarly, any initial DOM changes can be performed here.

  This procedure is usually full of ``PLAIN`` and ``WITH`` blocks.
  If you are executing logic in response to the current state,
  then that logic probably belongs in the ``RENDER`` procedure
  instead.

``RENDER``
  Whenever updates are made to the state, this procedure is
  executed immediately after. You can update any dependent
  UI state here, as well as any corresponding changes to the DOM.
  This procedure is usually full of ``ON`` blocks, which set
  dependent state based on existing state.

  ==============  =======================  ====================
  Procedure       Purpose                  Executed when...
  ==============  =======================  ====================
  ``INIT``        Set up initial state     The page is loaded
                  and initial DOM          

  ``RENDER``      Update dependent state   The state is changed
                  and modify DOM
  ==============  =======================  ====================
 


Handlers
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

Handlers are procedures named by the user in the *word* format.
Handlers are set to execute in response to events: user input events,
timer events, or application events. For example, the user might
create a handler named ``tab-change`` in response to a user click
event.

When a handler executes, it usually either emits back-end application
commands or modifies the state, or both; the ``RENDER`` reserved
procedure is immediately executed after the handler, so that the UI
state and the DOM page can be updated.

Blocks
^^^^^^^^^^^^^^^^^^^^^^^^^^^

Each procedure is a series of ``block`` objects::

  {
    error: undefined if OK, OR string if error,
    type: 'PLAIN' or "ON' or 'WITH',
    header: {...}
  }

The ``error`` field is set to a string if there was a problem parsing
the block; then the block is invalid and cannot be executed.

The idea of blocks is to represent simple "control" structures:

``PLAIN`` block:

A procedure can be a sequence of commands to be executed one after
another, in which case it is a single ``PLAIN`` block.

``ON`` block:

A procedure can contain an ``ON`` block, which is of the form:

|  ``ON`` *condition* ``BEGIN``
|   *command*
|   *command*
|    ...
|  ``END``

The parser will represent the ``ON`` block as::

  { conditions: [], commands: [] }

where each ``condition`` is::

  { type: 'CURRENT', path: 'STRING' }

(Currently we have only the one ``type`` of condition). The
``CURRENT`` condition is true iff the given path is one of the current
paths.

At run time, Popcorn will evaluate *condition* and then execute the
commands between ``BEGIN`` and ``END`` only if the condition is true.

``FORALL`` block:
 
|  ``FORALL`` *clause* *clause* ... ``BEGIN``
|   *command*
|   *command*
|    ...
|  ``END``

The ``FORALL`` line can also be split into multiple lines:

|  ``FORALL`` *clause* *clause* ...
|  *clause* *clause* ``BEGIN``
|  ...

At run time, Popcorn will unify the clauses with the current
state. The clauses can introduce variable names. Popcorn will produce
a unification list, i.e., a list of substitutions for the given set of
variables that unify the clauses with the current state. Then, Popcorn
will expand the list of commands between ``BEGIN`` and ``END``, which
can contain the same variables, once for each substitution.

The parser represents each ``FORALL`` clause this way::

  { type: 'PATH' OR 'CURRENT' OR 'NONCURRENT',
    pattern: [], (list of tokens)
  }

The list of tokens ``pattern`` can contain only these types of tokens:

- legal path component tokens (words, dots, slashes)
- Variable names given as keyword tokens like ``POS``
- the special wildcard token, ``*``

For example, ``.board.POS/*`` is a pattern that introduces a
variable ``POS`` and uses the wildcard ``*``. If it is used in a
clause like::

  CURRENT .board.POS/*

Then the pattern will match the current child of each state under
``.board``, for example::

  .board.a/foo
  .board.b/bar

But it will not match longer paths like::

  .board.a/foo.baz


Structures used in PSL
--------------------------

PSL uses lists of tokens to build structures:

  ==============  =====================================================
  Structure       Meaning
  ==============  =====================================================
  path            The ``.`` and ``/`` special characters are used
                  as prefixes to sub-state names to build
                  state paths: ``.hinge/open`` is a path where
                  ``hinge`` is an alt-parent and ``open`` is its
                  child.

  query           A list of tokens starting with a query keyword. The
                  query can be expanded to produce a list of
                  tokens. The parser expands a query if it is enclosed
                  in MACRO_OPEN and MACRO_CLOSE tokens.  If the list
                  of tokens contains nested begin-end macro tokens
                  enclosing queries, then the parser will first
                  execute the nested queries and use the results in
                  place of the macro.
  
  command         Token list starting with a command keyword.
                  The command can be executed in a context
                  to produce a side effect.

  ==============  =====================================================



Parser functions
=====================

Common abbreviations
------------------------

The parser often uses the structure "tla", for TLA, token list array,
which is an array of arrays of tokens.

Basic Parsing Functions
-------------------------

Function buildProcs
^^^^^^^^^^^^^^^^^^^^^

Builds a Map of procedure names and their contents, and returns it.

Each entry has the name of the procedure as a string, and the body of
the procedure as a TLA.

The name of each procedure is a string, which is the value of a *word*
or a *keyword*. The body of the section is a TLA of the contents of that
section.

These sections are actually parsed by ``splitSections``.


Function splitSections
^^^^^^^^^^^^^^^^^^^^^^^^

Takes a grand TLA for a script and returns an array of section
records. Each section is the tokenized source for a procedure.

The TLA input to this function is the ``tokenize`` d source of
an entire input script; see :doc:`tokenizer-design` .

In the script, section names should appear on separate "section
lines", marked with percent signs ``%`` or ``[`` square brackets ``]``
like a Microsoft INI file.

Each returned record contains one section name and a TLA for the lines
following the section name.

Example: given this input as a TLA:

|  ``% SECTIONONE``
|  ...*lines*...
|  ...*lines*...
|  ...*lines*...
|  ``[ SECTIONTWO ]``
|  ...lines...
|  ...lines...

Return this output::
  
  [
    {section: "SECTIONONE", tla: [...] },
    {section: "SECTIONTWO", tla: [...] },
  ]

The section name must be single *word* or a single *keyword*. The
output record contains the actual value, as a string.

In the input, any content must be inside a section.  If the first
nonempty line is not a section line, then we return null.


Function getScriptBlock
^^^^^^^^^^^^^^^^^^^^^^^^^^

Each block is created by the function ``getScriptBlock``, which takes
a TLA (token list array) that is the tokenized body of the proc, and
returns a ``block`` structure read from the beginning of the TLA:

``numLists``
  is the number of lists consumed by this block.  The purpose of the
  ``numLists`` member is that you can call this function again on the
  remaining lists in the proc until the proc is fully consumed.

``type``
  is one of ``PLAIN``, ``ON``, or ``FORALL``

``header``
  the value of ``header`` is ``type``-specific:

  |   ``PLAIN`` - ``undefined``
  |   ``ON`` - TLA, a list of conditions, each starting with
  |            a keyword, which currently must be ``CURRENT``.
  |            The rest of the condition is a valid path.
  |   ``FORALL`` - TLA, a list of clauses, each starting with
  |            a keyword, one of ``CURRENT``, ``NONCURRENT``,
  |            or ``PATH``. The rest of the clause is a valid
  |            path, except that some words might be replaced
  |            with a ``{VARIABLE}`` or an ``ASTERISK``.

``error``
  is ``undefined``, or ``string`` if there is an error.  If the
  function sets ``error`` to a ``string``, then the block is invalid
  and should not be used; there is no way to continue parsing the rest
  of the proc, and parsing should be abandoned

``tla``
  is the array of lists to be executed as commands.  In the case of
  ``FORALL`` clauses, this array might be replicated many times, once
  for each substitution, when executing.


Function buildBlocks
^^^^^^^^^^^^^^^^^^^^^^

Calls ``getScriptBlock`` repeatedly and returns an array of all
the blocks read. If a block had an error parsing, then ``buildBlocks``
returns an error string instead.


Function substVars
^^^^^^^^^^^^^^^^^^^

Takes a token array and returns another identical one, except that any
variable token like ``{VAR}`` is replaced by the result of a passed-in
function ``f``.  The function ``f`` should take the value of the
``{VAR}`` token, i.e, the string ``VAR``, and return an array of
tokens. The tokens are interpolated instead of the original ``{VAR}``.

Returns ``[num, tokArray]``, where ``num`` is the number of
successful substitutions performed.


.. _runtime:

Popcorn Runtime
-----------------

The Runtime is a global object always available as an instance named
``P``.  There is one Runtime in the browser, and a slightly different
Runtime in the Popcorn back end.
The main difference is that the back-end Runtime has no DOM and no
user inputs.

The Runtime maintains a queue of executable items, executing and
shifting the first item off the queue asynchronously (i.e., using
``setImmediate``). There are two types of items:

UPDATE item

  ``UPDATE`` items are requests to make a state change. They can be
  sent by the back-end application, or they can be created by a timer
  in the browser.

  An ``UPDATE`` item either contains command text to be tokenized and
  executed, or the name of a procedure to be executed. In either case,
  when this item is executed, Popcorn will first execute the
  procedure, and then the ``RENDER`` built-in procedure.

  When an ``UPDATE`` item contains the name of a procedure to execute,
  it can also provide a set of variable assignments to be expanded
  within the procedure.

  Members, if the item names a procedure:

  - ``procName``, a string naming a procedure

  - ``varDict``, an object containing variables and string values.

  Members, if the item contains PSL command text:

  - ``lines``, an array of strings containing PSL text.


HANDLER item:

  A ``HANDLER`` item is created when user input is received. It always
  names a procedure, and its ``varDict`` is filled according to the
  input mode that generated the item. To execute a ``HANDLER`` item,
  Popcorn does the same thing as for the ``UPDATE`` item.

  

  

  
