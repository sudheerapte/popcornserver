.. _actions:

Popcorn Web Actions
================================

In the previous chapter we described UXML, with which you can build
and modify a UX model, and query it to to perform actions.

In this chapter, we explain what kinds of actions are possible with
Popcorn's web server. Briefly, these actions are of three kinds:

- read and modify the HTML DOM,
- post any input modes, and
- cause commands to be sent to the back-end app.

We describe UXML extensions to perform these three kinds of actions.


Modify the HTML DOM
-------------------

Setting attribute values
^^^^^^^^^^^^^^^^^^^^^^^^

The ``DOM SET id ATTR =`` command sets the value of an attribute of an
HTML element by ID::

  DOM SET ID = id ATTR = name word

The above form sets the value of attribute named ``name`` to the given
value ``word``. The ``id`` argument is the value of the element's
``id`` attribute. Possible errors: No such element.

For boolean attributes, there are ``DOM SET BOOL`` and ``DOM RESET
BOOL`` commands::

  DOM SET id BOOL name
  DOM RESET id BOOL name

The ``DOM SET BOOL`` command turns the boolean attribute ``name`` on,
while the ``DOM RESET BOOL`` command sets it off.

Setting element text content
^^^^^^^^^^^^^^^^^^^^^^^^^^^^

The ``DOM SET TEXT WORD`` and ``DOM SET TEXT`` commands set the text
content of an HTML element, respectively to the given word argument or
a string argument.


Query the HTML DOM
-----------------

The ``ATTR WORD`` and ``ATTR`` query commands extract the value of any
attribute. Typically you would write these commands in macro strings
so that their evaluation will yield the value.

``ATTR WORD`` evaluates to a word the value of the indicated attribute
of the HTML element by ID::

  ATTR WORD id name

``ATTR`` evaluates to a string the value of the indicated attribute of
the HTML element by ID::

  ATTR id name


Similarly, the ``TEXT WORD`` and ``TEXT`` query commands extract the
text content of an HTML element.

  
Post Input Modes
-----------------

An "input mode" in Popcorn is a set of handlers for user
inputs. Usually it makes sense for the entire set to be made active
(i.e., "posted") at once when the application is in a certain state,
and then made inactive when the application is in a different state.

The entire set of input modes is specified in a script called
``input``. Each mode has a unique name and consists of one or more
lines of action commands, which would be executed if the user provides
the input, e.g., a click action.
