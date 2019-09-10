.. _machine-design:

Class Machine
================================

This class represents one state machine tree. When you create an
instance, it has only the root path "" and is in edit mode.

External API
-------------


Commands for modifying the machine
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

  ============== ======  =======================================
  Command        Space      Purpose
  ============== ======  =======================================
  setCurrent     no       Set the current child of an alt-parent
  setData        no       Assign a data string to a leaf
  addLeaf        yes      Append a new child to list of children
  deleteLastLeaf yes      Delete the last child from the list
  ============== ======  =======================================

These four commands each make one modification to the machine. The
last two, addLeaf and deleteLastLeaf, also modify the state space.

The resulting machine always has a new current state.

Each command takes an undo list as an argument and prepends to it
any commands needed to undo its own effect.

Each command returns ``null`` if it succeeds or an error string if it
fails. If it fails, it is guaranteed not to change the machine or
modify the undo list.

In the following descriptions:

  =========== =======================================================
  Symbol      Meaning
  =========== =======================================================
   ``P``      A path
   ``W``      A word
  ``sep``     Separator, either ``/`` or ``.``
  ``STRING``  An arbitrary UTF-8 string no longer than 100 characters
  =========== =======================================================


addLeaf
^^^^^^^^^^^^
::

   addLeaf P sep W

Adds a new leaf named ``W`` to the tree under the parent path
``P``. This expands the state space.

.. sidebar:: addLeaf Errors

   no such path; bad word format; bad separator; child exists;
   parent has data; not a con parent; not an alt parent

Path ``P`` must be an existing node that is either a leaf, or a
parent.

**If ``P`` is a parent,** it must be the right type of parent. If
``sep`` is ``/``, then the parent must be an alt-parent.  If ``sep``
is ``.``, then the parent must be a con-parent.  In either case, the
name ``W`` must not already belong to an existing child of ``P``.

This command adds a new leaf to the end of any existing children of
``P``.

**If ``P`` is a leaf:** This command turns it into a parent;
furthermore, if the new parent is an alt-parent, then the new first
leaf is automatically made its current child.

On success, this command adds a corresponding ``deleteLastLeaf``
command to the beginning of the undo list.

deleteLastLeaf
^^^^^^^^^^^^^^
::

   deleteLastLeaf P

Deletes the last child, which must be a leaf, of the given state
``P``.  This contracts the state space.

If the child being deleted has data assigned to it, the data is lost.

.. sidebar:: deleteLastLeaf Errors

   no such parent; last child is not a leaf

Path ``P`` must be an existing parent node.

This command takes the last child of ``P``, which must be a leaf, and
deletes it. If ``P`` had only one child, then this command turns ``P``
into a leaf.

On success, this command adds a corresponding ``addLeaf`` command to
the beginning of the undo list.  If the parent was an alt-parent whose
current child is being deleted, then this command makes the previous
child current, and inserts a ``setCurrent`` command after the
``addLeaf``. If the deleted leaf had data assigned to it, then this
command also inserts a ``setData`` command after the ``addLeaf``.


setCurrent
^^^^^^^^^^^^^^
::
   
   setCurrent P W

Sets the current child of the parent ``P`` to ``W``.


.. sidebar:: deleteLastLeaf Errors

   not an alt-parent; bad word format; no such child

``P`` must be an
alt-parent, and one of its children must be named ``W``.  If the
parent's current child is already ``W``, then this command is a no-op.



setData
^^^^^^^^^^^^^^
::

   setData P STRING

Assigns the data ``STRING`` to the existing leaf state ``P``.

.. sidebar:: setData Errors

   not a leaf; bad string format

If ``P`` already had a different data string assigned to it, then
this command prepends a ``setData`` command to restore that value.



Queries
^^^^^^^

::

   exists P      => true/false
   isParent P    => true/false
   isAltParent P => true/false
   isConParent P => true/false
   isLeaf P      => true/false
   isAltChild P  => true/false
   isConChild P  => true/false
   getParent P   => P
   getCurrent P  => C
   getChildren P => <list of C>
   getNonCurrent P => <list of C>
   isCurrent P C => true/false
   getData P     => <string>

   isEqual(machine) = true or false


Interpret block
^^^^^^^^^^^^^^^^

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

