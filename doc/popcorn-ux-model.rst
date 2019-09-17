.. _ux-model:

The Popcorn UX Model
====================

The heart of Popcorn is the UX Model, often referred to as a
"machine".  Once you understand how machines are represented and how
they can be updated, you will find it easy to follow the rest of this
manual to develop Popcorn apps.

Background on UX Models and states
-------------------------------------------

A UX Model is a hierarchical tree of nodes. Each node stands for a
possible sub-state of the state machine.

The tree defines two things:

1. The entire state space of the UX Model, i.e., all possible states
   that the application UX can be in.

2. The current state within this state space.

Each state of the application UX can be a hierarchical composition of
sub-states.

.. sidebar:: Hierarchical State Machines

  Such hierarchical state machines were first defined by David Harel
  in 1986. He called them "Statecharts", and they were incorporated
  into the Unified Modeling Language (UML) 2.0 in a simplified
  form. The big difference is that in the Popcorn UX Model, we do not
  worry about the **transitions** between states; we just represent
  the hierarchy as a tree of nodes.

In general, any state, represented by a node, can be of
one of three types:

- A list of **alternative** sub-states, one of which is marked current
  at a time (for example, a bulb can be either on or off). We call
  such a state an **alternative-parent** state, and we call these
  alternative sub-states "alternative children" of the parent state.

- A list of sub-states, all of which are considered "current" at the
  same time (for example, a door can have a lock state and a hinge
  state, both simultaneously). We call such a state a
  **concurrent-parent** state, and its children "concurrent children"
  of the parent state.

- A container for a limited amount of data, e.g., a string.  We call
  such a state a **data-state**.

In turn, the child states of an alternative-parent or of a
concurrent-parent state can themselves be of any of these three types.
This is how one defines the state of the application as a hierarchical
state machine.

This tree of nodes in a Popcorn UX Model follows certain rules.

Tree Rules for Popcorn
-------------------------------------------

The entire tree is the description of all possible states of an
application model, and the same tree also describes one single state
out of all of these as the current state, by marking some of the nodes
in the tree as "current".

Here is a picture of an example UX Model tree for the states of a
door::

    root. +
          |
          +- hinge/
          |       +
          |       + - open (*)
          |       + - closed
          |
          +- bolt/
                 +
                 + - unlocked (*)
                 + - locked

The UX Model contains one root node, which is always a
concurrent-parent state node. The root node is always current.

The rules are:

1. Every alternative-parent node has one and exactly one child that is
   marked as current at a time. `hinge` and `bolt` above are
   alternative-parent nodes, which we have indicated by ending them in
   a slash `/`. We have indicated each current alternative child node
   with an asterisk in parentheses `(*)`.

2. For every concurrent-parent node, all of its children are
   considered current. We have indicated the only concurrent-parent
   node above by ending it in a dot (`.`).

3. Every data-state node has one and exactly one data value. The above
   example has no data-state node.

4. If a concurrent child is made a leaf node, we automatically assume
   that it is a data-state node. An alternative child can be a leaf
   node, but it cannot have any data. This is a restriction in Popcorn
   to make it easier to define trees. In the above picture, all four
   leaf nodes are alternative child nodes.

Changing the application state
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

In order to change the application state, you can change the tree in
these ways:

- change an alternative-parent node to have a different current child, OR
- change the data of a data-node to a different value.

You can make a list of multiple changes of this type in a single
transaction, called an `update` transaction, and send it to Popcorn.
Popcorn modifies the UX Model.  Once the tree has been modified in this
way, it shows a new current state.

Paths to identify nodes
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

Every node in the tree has a short name composed of lowercase letters,
numbers, and hyphens. This short name is unique among children of the
same parent node. The root node has a zero-length short name, i.e.,
the empty string, ``""``.

Any node in the tree can thus be identified uniquely by the complete
series of short names starting from the root node. If we write the
series as a string with delimiters separating the names, we get a
unique path. We use a dot character `.` to separate concurrent
children from their concurrent-parent nodes, and a slash character
``/`` to separate alternative children from their alternative-parent
nodes.

Example UX Model: open, locked, unlocked
----------------------------------------

Here is our earlier picture of the states of a door, showing three
interior nodes and four leaf nodes::

    root. +
          |
          +- hinge/
          |       +
          |       + - open (*)
          |       + - closed
          |
          +- bolt/
                 +
                 + - unlocked (*)
                 + - locked

The following is a path-syntax view, which Popcorn can understand::

  .hinge
  .hinge/open
  .hinge/closed
  .bolt
  .bolt/unlocked
  .bolt/locked

The six paths above define six nodes.  A seventh root node ``""`` is
understood.

When defining a UX Model, we can always leave out the paths for the
interior nodes, since they are implied when we list the leaf nodes. So
the following four paths are sufficient to define the tree::

  .hinge/open
  .hinge/closed
  .bolt/unlocked
  .bolt/locked

State space defined by the tree
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

This UX Model is capturing four states of the door: each
combination of the hinge being open or closed, and the bolt being
unlocked or locked.

Let us look at the state space::

  State 1:      .hinge/open, .bolt/unlocked
  State 2:      .hinge/open, .bolt/locked
  State 3:      .hinge/closed, .bolt/unlocked
  State 4:      .hinge/closed, .bolt/locked

In the picture of the tree we drew at the beginning, we used the
``(*)`` annotation to show State 1, ``open`` and ``unlocked``.

(With this state space, we are modeling a door whose bolt can be moved
to the locked position even when the door is open: of no security
benefit, and in fact inconvenient because often such doors cannot be
closed until you first unlock the bolt.)
