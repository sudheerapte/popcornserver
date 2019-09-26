.. _parser-design:

PSL and Procedures
=======================

Procedures
---------------------------------

The Popcorn State Language (PSL) script for a page is organized into
*procedures*. Each procedure is a named program that is executed
independently and has no dependencies on other procedures.

The user writes PSL code for all the procedures for a page in a text
file in the top-level directory of the page. This text file is
automatically sent along with the page when the page is loaded.

There are two kinds of procedures: reserved procedures and handlers.

When the page is loaded, the entire set of procedures is parsed into a
data structure named ``procs``.  The reserved procedures are executed
automatically at certain points. Handlers are executed in response to
events.


Reserved procedures
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^


Reserved procedures have pre-assigned names as follows.

  ==============  =======================  ====================
  Name            Purpose                  Executed when...
  ==============  =======================  ====================
  ``IPROPAGATE``  Set up initial state     The page is loaded
  ``IRENDER``     Modify DOM               The page is loaded
  ``PROPAGATE``   Update dependent state   The state is changed
  ``RENDER``      Modify DOM               The state is changed
  ==============  =======================  ====================
 
The execution sequence is in the same order as in the table, i.e.,
each ``PROPAGATE`` procedure is executed before its corresponding
``RENDER`` procedure.  The names of the reserved procedures are all in
the *keyword* format, as you can see above.

Handlers
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

Handlers are procedures named by the user in the *word* format.
Handlers are set to execute in response to events: user input events,
timer events, or application events. For example, the user might
create a handler named ``tab-change`` in response to a user click
event.

When a handler executes, it probably modifies the state; the
``PROPAGATE`` and ``RENDER`` reserved procedures are immediately
executed after the handler, so that the page can be updated.

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

``WITH`` block:
 
|  ``WITH`` *clause* *clause* ... ``BEGIN``
|   *command*
|   *command*
|    ...
|  ``END``

The ``WITH`` line can also be split into multiple lines:

|  ``WITH`` *clause* *clause* ...
|  *clause* *clause* ``BEGIN``
|  ...

At run time, Popcorn will unify the clauses with the current
state. The clauses can introduce variable names. Popcorn will produce
a unification list, i.e., a list of substitutions for the given set of
variables that unify the clauses with the current state. Then, Popcorn
will expand the list of commands between ``BEGIN`` and ``END``, which
can contain the same variables, once for each substitution.

The parser represents each ``WITH`` clause this way::

  { type: 'ALL' OR 'CURRENT' OR 'NONCURRENT',
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


Parser functions
=====================

The parser often uses the structure "tla", for TLA, token list array,
which is an array of arrays of tokens.

The parser builds the ``procs`` data structure in the runtime object
``P``. The ``procs`` data structure is a ``Map`` of name to ``proc``,
where ``proc`` is a list of ``block``::

  proc = new Map();
  proc.set("IPROPAGATE", []);
  proc.get("IPROPAGATE").push({...});

Each block is created by the function ``getScriptBlock``, which takes
a TLA (token list array) that is the tokenized body of the proc, and
returns a ``block`` structure:

``numLists``
  is the number of lists consumed by this block.  The purpose of the
  ``numLists`` member is that you can call this function again on the
  remaining lists in the proc until the proc is fully consumed.

``type``
  is one of ``PLAIN``, ``ON``, or ``WITH``

``header``
  the type is ``type``-specific:

  |   ``PLAIN`` - ``undefined``
  |   ``ON`` - TLA, a list of conditions, each starting with
  |            a keyword
  |   ``WITH`` - TLA, a list of clauses, each starting with
  |            a keyword

``error``
  is ``undefined``, or ``string`` if there is an error.  If the
  function sets ``error`` to a ``string``, then the block is invalid
  and should not be used; there is no way to continue parsing the rest
  of the proc, and parsing should be abandoned

``tla``
  is the array of lists to be executed as commands.  In the case of
  ``WITH`` clauses, this array might be replicated many times, once
  for each substitution, when executing.



