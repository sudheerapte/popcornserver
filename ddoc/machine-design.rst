.. _machine-design:

Class Machine
================================

This class represents one state machine tree. When you create an
instance, it has only the root path "" and is in edit mode.

External API
-------------

interpret(array)

Takes an array of commands called a "block" and executes them all
in sequence as a transaction. On error, it returns an error message.
On success it returns null.

Internal representation:
--------------------------

A parent state can be either:
(a) a variable parent, OR
(b) a concurrent parent.

Leaf states can be either:
(a) children of a variable parent, OR
(b) children of a concurrent parent having a 'data' member.

All states are represented with a simple Javascript object with
two attributes:

``name``:
  the short string name of this state. Must be all lowercase; might
  contain hyphens and digits; the first character must be a letter.
  Examples: ``one``, ``two-three``, ``four4``.
``parent``:
   a pointer to the parent state object.
   (the parent pointer is not present in the root state)

Leaf states have only the above two members. Parent states have one
additional member:

``cc``:
  an array containing the short names of all child states

In addition, a variable parent state also has a ``curr`` member, which
has the *index* of the current sub-state.  By default, ``curr`` is set
to zero, which means the first-added child is the current child.

All the states in the machine are indexed by their full path in the
STATE_TREE map. The root state's path is always the empty string
``""``, so you can start a traversal by looking up that key.  The
value of the key will be a state object, and if it is a parent state,
then it will contain its children's short names in ``cc``.

Each child state object can be found by appending either a ``.`` or a
``/`` to the parent's path, and then the child's short name, to form
the child's path, which is a key in the STATE_TREE map.

When deleting leaves with ``_deleteLeaf``, we ensure that a parent
always has at least one child, otherwise we delete the ``cc`` member
(and any ``curr`` member) and treat it like a leaf state.



State Space Commands
^^^^^^^^^^^^^^^^^^^^

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


Queries
^^^^^^^^^^^^^^^^^^^^^^^^^^^

  ==============  ==============================================
  Query           Returns...
  ==============  ==============================================
  ``CURRENT``     The current child of an alt-parent node.
  ``DATAW``       The *word* assigned to a data-leaf node.
  ``DATA``        The string assigned to a data-leaf node.
  ==============  ==============================================

