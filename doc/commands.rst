
UX Model Commands
====================

Describing the State Space of a UX Model
----------------------------------------

The state space of a UX model is described as a tree of nodes. A
particular state within this space is described as a set of
current-child designators and a set of data items assigned to some of
the nodes in this tree.

We describe a simple ascii-based language that is used for three things:

1. To build up the state space of a UX model: State Space commands.
2. To describe an individual state within a UX model: State Description commands. 
3. To query the current state of a UX model: Queries, and With Clauses.

This ascii-based language is made more powerful using a macro
facility, which is described below.

The state space of a UX model must be defined before you can use the
model and talk about individual states.

A **word** consists of one or more ascii letters, numbers, or hyphen,
i.e., the set ``[a-z0-9-]``, where the first character must be a
letter. A word cannot be longer than 100 characters.

A **path** is a complete sequence of traversals from the root of the
tree to a node. Nodes in a tree can be of these types:

An **alternate-parent** node
   It has a set of possible child nodes, only one of which can be
   designated as the *current* child at a time.

A **concurrent parent** node
   Has a set of child nodes, all of which are current whenever the
   parent is current. The root node is a special concurrent parent
   node that is always current.

A **leaf** node
   Has no children. If its parent is a concurrent parent node, then
   the leaf node can be assigned a data item.

Each child node has a one-word name unique under its parent node. Each
node is thus uniquely identified by its path from the root node. The
top-most root node always exists when the tree is created, its name is
the special empty word ``""``, and it is a concurrent parent node.

The unique name of each node is a ``word`` as described above.

A **path** consists of a series of one or more words separated by
single dots ``.`` or slashes ``/``, depending on whether the parent is
a concurrent parent or an alternate-parent. The first word must be the
special empty word ``""``, which stands for the root node and is not
used for naming any other node. Since the root node is always a
concurrent parent, therefore all paths start with a dot, ``.``.

State Space Commands
----------------------------------

There are three **state space** commands, which can be
used to build up the tree that defines a UX model::

  DEF CON parent-path child1 child2 child3...
  DEF ALT parent-path  child1 child2 child3...
  DEL path

The ``DEF CON`` command creates a set of new concurrent state nodes as
children of a concurrent-parent node. The ``parent-path`` describes a
concurrent-parent node. If such a node does not exist, it will be
created, and so on for all of its parents up to the root node.

The ``DEF ALT`` command similarly creates a set of new alternate state
nodes under an alternate-parent node. The parent and its ancestors
will be automatically created if they don't exist.

The ``DEL PATH`` command deletes the given existing node and any
sub-tree underneath that node. (This command is given for
completeness; there is no practical use for it, since an application
has no good reason to delete states from an existing UX model).


State Definition Commands
----------------------------------

State definition commands describe a desired state of the UX model. A
series of these commands can be bundled together into a transaction,
and all of these definitions are applied at once to create a new
state. If any of the commands fails, then the entire transaction
fails.

::

  SET CURRENT path child

The ``SET CURRENT`` command sets the current child. The ``path`` must
be an existing alternate-parent node, and ``child`` must be a word
that names an existing child node. The named child will be made the
current child in the new state. It is not an error if the named child
is already the current child.

Possible errors: no such path; no such child.

::

  SET DATA path word

  SET DATA path BEGIN
  line
  line
  ...
  END

The ``SET DATA`` command assigns the given data string to a data leaf.
The ``path`` must be an existing data-leaf node, i.e., a concurrent
node with no children.

There are two forms of the ``SET DATA`` command shown above, depending
on how the data is supplied. In the first form, the data is a single
**word**, whose value is supplied as the ``data`` argument.

The second form supplies a set of arbitrary bytes encoded in ascii, in
a sequence of one or more lines between ``BEGIN`` and ``END``. The
encoding to be used is up to the application. The newlines in the
command text are discarded; only the ascii bytes within the lines are
used as the value.


Queries
--------

A query is a command string that evaluates to an ascii string using
the current state. If a query fails, then it evaluates to the empty
string.

There are two queries::

  CURRENT path
  DATA WORD path
  DATA path
  
The ``CURRENT`` query takes a path to an alternate-parent node, and
returns a word that is the name of the current child.

The ``DATA`` query has two forms:

The ``DATA WORD`` query takes the path to a data-leaf node, and
returns a word that is the value of the data item assigned to that
node. If the data item value assigned to this node was longer than a
word, then this command tries to return a valid prefix if possible.

The ``DATA`` query takes the path to a data-leaf node, and returns an
array of ascii characters that is the value of the data item assigned
to that node.

Scripts and Transactions
------------------------

State description commands can be listed one after another in a
script. Any block of simple commands will be evaluated as a single
transaction. The resulting state becomes the new state of the UX
model. If any command fails, then the entire transaction fails.

A script can contain only simple commands, or simple commands can be
interspersed with "blocks" of commands where each block becomes one
transaction.

There are two kinds of blocks, ``ON`` blocks and ``WITH`` blocks,
which are explained below. Together with macros, these blocks provide
a powerful way to describe states.


Macros
------

A macro string is any ascii string starting and ending with
double-brace pairs ``{{`` and ``}}``. The text between the two
matching double-braces is interpreted as a query, and the evaluated
result replaces the entire macro string.

Example::

  SET CURRENT .player {{CURRENT .finished}}

The above ``SET CURRENT`` command could appear in a script. The second
argument here is a macro string containing a ``CURRENT`` query. During
execution of the script, this query will be evaluated to the name of a
node, which will be a word. This word will replace the macro string,
and the ``SET CURRENT`` command will take that word as its second
argument.

If the query fails, for example because ``.finished`` is not the path
of a valid alternate-parent node, then the entire transaction will
fail with the resulting error message (such as ``No such path``).

Multiple macros can appear in a command line, and they can also be
nested.  The macro expansion procedure is carried out inside-out,
i.e., the most deeply-nested macros are evaluated first. If any query
fails, then all subsequent expansions also fail.

Using macros, a set of ascii lines containing state description
commands can be made to behave differently depending on the current
state.

ON Blocks
-------------

An ``ON`` block is a list of commands to be executed as a transaction
only when a given **condition** is true::

  ON .finished spider BEGIN
  SET CURRENT .turn flies
  END

In the above ``ON`` block, the condition is ``.finished spider``,
which means the block between ``BEGIN`` and ``END`` should be executed
only if the current child of the alternate-parent ``.finished`` is
``spider``. The block contains one ``SET CURRENT`` command, which will
be executed in that case.

The block of commands in the ``ON`` block is executed as one
transaction. This transaction comes after any commands that appear
earlier in the script, and before any commands that appear later in
the script.

The only kind of condition that can be used is::

  path child

where ``path`` is an alternate-parent and ``child`` is the name of a
child. The condition evaluates to true if the given child of the
parent is current. If the condition is not true, then the block of
commands is not executed.
  

WITH Blocks
-------------

``WITH`` blocks are used to recognize patterns in the current state,
and apply these patterns to generate macro commands.  The mechanism
used is called **unification** in computer science.

A ``WITH`` block has the following structure::

  WITH pattern pattern pattern ... BEGIN
  macro-line
  macro-line
  ...
  END

In each ``pattern``, you provide arbitrary **variable names**. The
pattern matches the current state in multiple ways. Each way is
represented by a set of substitutions for these variables.

By providing the same variable names in the different patterns, you
can coordinate these patterns so that together, the list of patterns
builds up unified contexts of variable substitutions. The
``macro-line``\s are expanded using each of these contexts.

To show the power of this method, let us first show a simple example,
and then a more complex one.

Simple Example
^^^^^^^^^^^^^^^

Let us say we are building a board game with eight positions labeled
``a`` through ``h``, on which three spiders and a fly can move.

We could start building a UX model with these state space commands::

  DEF CON .board a b c d e f g h
  DEF CON .creature spider1 spider2 spider3 fly

This creates the eight positions and the four creatures.

We would like to be able to place any of these four creatures on any
of the board positions. For example, we would like to define::

  DEF ALT .board.a spider1 spider2 spider3 fly

and so on.
  
Instead of writing 8 lines with repeated creatures, we could
write a single ``WITH`` block as follows::

  WITH ALL .creature.X ALL .board.POS BEGIN
  DEF ALT .board.{{POS}} {{X}}
  END

In the above block, we introduced two variables, ``X`` and ``POS``.
The ``X`` clause matches the existing state space in eight ways, with
``X = a``, ``X = b``, etc., and the ``POS`` clause matches in four
ways.

When we use the variable names as macros in the ``DEF`` line, the
block expands to 32 different ``DEF`` commands using each combination
of variable substitutions. We get the equivalent of::

  DEF ALT .board.a spider1
  DEF ALT .board.a spider2

and so on.

WITH patterns
^^^^^^^^^^^^^

We can use three different kinds of ``WITH`` patterns::

  ALL path-expression
  CURRENT path-expression
  NONCURRENT path-expression

The ``ALL`` pattern, as we have seen above, matches any valid
path in the UX model, i.e., in the state space. This is how we were
able to obtain the 4 and the 8 matches above.

The ``CURRENT`` pattern matches any path in the current state, i.e.,
any path such that the last node and all its ancestors are current.

The ``NONCURRENT`` pattern matches any path in the state space that is
**not** in the current state.

In each of these patterns, the ``path-expression`` is a normal
``path``, with some words replaced with all-uppercase variable
names. So, to match paths like ``.board.a``, you use a path-expression
like ``.board.POS``, by introducing the variable ``POS``. To use this
variable in the block, you write macros like ``{{POS}}``.

Complex Example
^^^^^^^^^^^^^^^

Let us say our board game requires adjacent moves. We need to encode
the adjacency information in our UX state model::
   
              a
            / | \               DEF CON .adj.a b c d 
           b--+--c              DEF CON .adj.b a c d 
           | \|/ |              DEF CON .adj.c a b d 
           |  d  |              DEF CON .adj.d a b c e f g
           | /|\ |              DEF CON .adj.e b d f h
           e--f--g              DEF CON .adj.f d e g h
            \ | /               DEF CON .adj.g c d f h
              h                 DEF CON .adj.h e f g

(See complex example later, where we introduce the web support in Popcorn).







