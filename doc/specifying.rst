
Specifying a UX Model to Popcorn
================================

We specify a UX Model by declaring all the paths. The command to
declare a path is ``P``. Here is how we can specify our 4-leaf-node
UX Model to Popcorn::

  P .hinge/open
  P .hinge/closed
  P .bolt/unlocked
  P .bolt/locked

If we give this series of text lines to Popcorn as a ``provide``
transaction, it will build a UX Model like this for us and keep it in
memory.

This UX Model specifies four possible states for our door. But in
addition, it also specifies an *initial state* for our door. The rule
is that the first-mentioned child of an alternative-parent node is
automatically assumed to be "current". Thus, in this example, if we
asked Popcorn to create this UX Model, our door will initially be in
State 1 (``open`` and ``unlocked``).

If we want to change the current state, we send Popcorn an ``update``
transaction with the changes we want to make. To close the door, we
need to use a change command, ``C``, which specifies an alternative
parent and which of its alternative children we want to make current::

  C .hinge closed

This command changes the ``closed`` alternative child to become the
current child. Using this command, we can close our door and enter
State 3, ``closed`` and ``unlocked``.

An ``update`` transaction can specify a list of such change
commands. For example, by adding a second ``C`` command, we can
simultaneously close and lock our door::

  C .hinge closed
  C .bolt locked

Popcorn will put the UX Model in State 4, ``closed`` and ``locked``.

Data nodes
-----------

All leaf nodes that are concurrent children are assumed to be "data
nodes" and have associated with them a UTF-8 string value. By default
this value is the empty string ``""``. But we can assign any string
value to a data-node by using the ``D`` (data) command.

For example, let us expand our state space. Let us say our door has a
combination lock with a 4-digit key. Every time we flip the
combination lock, we change the state of the door.

We could model such a door by adding a new concurrent-parent, ``.key``,
to our UX Model::

  P .hinge/open
  P .hinge/closed
  P .bolt/unlocked
  P .bolt/locked
  P .key
  D .key 1234


The above set of ``P`` commands defines our 4-state door, and also gives
it another concurrent-parent leaf node called ``key``. This node has a
data string ``1234`` associated with it. (The fifth ``P`` command creates
a ``key`` node with an empty data string; the ``D`` command assigns ``1234``
to it).

With this new data-node, we have expanded our UX Model to cover a
very large number of possible states: ten thousand possible strings
for each of the 4 states of the hinge and the bolt.

To change our key, we have to assign the new value to ``key``::

  D .key 1235


and so on. Note that we are not representing in our model the secret
key needed to unlock our door, only the visible key value that anyone
can change. We could, of course, add the secret key to our model if we
wanted, by adding another data-node.

See full grammar here: :ref:`grammar`
