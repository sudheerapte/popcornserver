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


PSL Commands for Machine States
--------------------------------


Machine state building commands
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

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
  is one of ``PLAIN``, ``ON``, or ``WITH``

``header``
  the value of ``header`` is ``type``-specific:

  |   ``PLAIN`` - ``undefined``
  |   ``ON`` - TLA, a list of conditions, each starting with
  |            a keyword, which currently must be ``CURRENT``.
  |            The rest of the condition is a valid path.
  |   ``WITH`` - TLA, a list of clauses, each starting with
  |            a keyword, one of ``CURRENT``, ``NONCURRENT``,
  |            or ``ALL``. The rest of the clause is a valid
  |            path, except that some words might be replaced
  |            with a ``{VARIABLE}`` or an ``ASTERISK``.

``error``
  is ``undefined``, or ``string`` if there is an error.  If the
  function sets ``error`` to a ``string``, then the block is invalid
  and should not be used; there is no way to continue parsing the rest
  of the proc, and parsing should be abandoned

``tla``
  is the array of lists to be executed as commands.  In the case of
  ``WITH`` clauses, this array might be replicated many times, once
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
