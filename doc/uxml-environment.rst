.. _uxml-environment:

UX Model Environment
================================

The UX Model and its environment is the basis for all Popcorn
processing. The processing is event-based.

Normally, the UX Model is quiescent.

Events arrive at any time:

1. User input events from any posted input modes, like button clicks
   or drag-and-drop events.
2. Any timer events scheduled previously.
3. App update events from the back-end app.

Each event has an attached UXML script to execute. The UXML script
contains a mixture of model change commands and "action commands" that
can:

- Post or un-post an input mode.
- Modify the DOM.
- Schedule a timer event.
- Send an app command.

Popcorn queues these events as they arrive, and as soon as possible,
executes the attached scripts to drain the queue.

Only the model change commands are performed immediately. The action
commands simply queue up their changes in their own queues (one queue
each for input modes, DOM modifications, timer event scheduling, and
app command sending).

Finally, when the event queue is drained, then the model is
"quiescent" again and the action queues are drained. During this
processing, any incoming events are queued but not processed.

Only when the action queues are drained will Popcorn get a chance to
process the new arrivals.



Describing the State Space of a UX Model
----------------------------------------



Words, Paths, and Parent Nodes
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

A **path** is a complete sequence of parent-child traversals from the
root of the tree to a node. In this sequence, words are separated
using a slash or a dot. An example of a path: ``.board.a/empty``

.. sidebar:: The UX Model

   This is a brief outline of the tree-based UX Model; see
   :doc:`popcorn-ux-model` for details.

Nodes in a tree represent sub-states of the UX model. They can be of
these types:

An **alternate-parent** node
   Has a set of possible child nodes, only one of which can be
   designated as the *current* child at a time. The children of an
   alternate-parent node are called alternate child nodes.

A **concurrent parent** node
   Has a set of child nodes, all of which are current whenever the
   parent is current. The children of a concurrent parent node are
   called concurrent child nodes.

The **root** node
   Every tree has a root node, which has no parent.  The root node is
   a special concurrent parent node that is always current. The name
   of the root node is a special word, the empty string ``""``.

A **leaf** node
   Has no children. If its parent is a concurrent parent node, then
   the leaf node can be assigned a **data item**. This kind of leaf is
   called a "data leaf" node.

Each child node is uniquely named under its parent node. Each
node is thus uniquely identified by its path from the root node. The
top-most root node always exists when the tree is created.

.. sidebar:: Paths start with a dot

             The first word must be the special empty word ``""``,
             which stands for the root node and is not used for naming
             any other node. Since the root node is always a
             concurrent parent, therefore all paths start with a dot,
             ``.``.

In the descriptions below, we use the following terms:

*path*
  Consists of a series of one or more words separated by single dots
  ``.`` or slashes ``/``, depending on whether the parent is a
  concurrent parent or an alternate-parent.

*command word*
  Consists of a set of one or more capital letters ``[A-Z]``. Command
  words are described below with the commands that require them.

UXML scripts
^^^^^^^^^^^^

In a script, all the UXML commands are written one per line of ascii
text. Any non-ascii character makes the entire UXML script illegal.

Lines are separated from one another by ascii NL (newline)
characters. Blank lines and any lines starting with a hash character
(``#``) are ignored.  Any blank characters before the first command
word are ignored, and any blank characters between the command words
are dropped once the command words are recognized.

The command words and path syntax use a very restricted sub-set of
ascii. The macro feature described below introduces a couple of
special markers, ``{{`` and ``}}``, to enclose macro strings.

The ``DATA`` command described below allows you to describe a
data item consisting of arbitrary ascii characters.

See later for how to send scripts to Popcorn.

State Space Commands
^^^^^^^^^^^^^^^^^^^^

There are three **state space** commands, which can be
used to build up the tree that defines a UX model:

  ==============  ==============================================
  Command         Purpose
  ==============  ==============================================
  ``DEF CON``     Define a concurrent parent and its children
  ``DEF ALT``     Define an alternate-parent and its children
  ``DEL``         Delete a path and its sub-tree
  ==============  ==============================================


The ``DEF CON`` command creates a set of new concurrent state nodes as
children of a concurrent-parent node.

  | ``DEF CON`` *parent-path* *child1* *child2* ...

The *parent-path* describes a concurrent-parent node. If such a node
does not exist, it will be created, and so on for all of its parents
up to the root node. The *child* arguments are used as names of new
child nodes. If a child node with that name already exists, the
command ignores that argument.

The ``DEF ALT`` command similarly creates a set of new alternate state
nodes under an alternate-parent node.

  | ``DEF ALT`` *parent-path* *child1* *child2* ...

The parent and its ancestors will be automatically created if they
don't exist, and any *child* arguments that are already names of
existing child nodes will be ignored.

.. sidebar:: DEL command

  The ``DEL`` command is given for completeness; there is no practical
  use for it, since an application has no good reason to delete states
  from an existing UX model.

The ``DEL`` command deletes the given existing node and any sub-tree
underneath that node.

  | ``DEL`` *path*


Sending Scripts to Popcorn
^^^^^^^^^^^^^^^^^^^^^^^^^^^

Popcorn expects certain scripts to be provided with the web assets:

init script (mandatory)
  A script with id ``init`` is used to create any additional UX model
  states that the back-end app has not supplied. This is usually to
  capture any UI state, for example, pages or tabs that are open or
  closed. This kind of state is unique per user agent (browser), and
  the back-end app knows nothing about it.

render script (mandatory)
  A script with id ``render`` is executed on every UX model update.
  In this script, you can cause changes in the additional UI states,
  modify the HTML DOM, post any input modes, and cause commands to be
  sent to the back-end app.

provide script (optional)
  Normally, when a user agent (browser) connects to Popcorn with the
  URL of a UX model, it expects the back-end app to provide the
  initial UX model. But during development, before there is a back-end
  app, the UX designer can supply their own UX model.  A script with
  id ``provide`` can be used for this purpose. If Popcorn finds no
  back-end app providing a UX model for the user agent, and if it
  finds a script of id ``provide``, it will pretend that a back-end
  app sent this UX model.


