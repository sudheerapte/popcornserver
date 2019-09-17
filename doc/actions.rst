.. _actions:

Popcorn Web Actions
================================

Action Commands in UXML
-------------------------

In the previous chapter we described UXML commands to build and modify
a UX model, and query it to to perform actions.

In this chapter, we explain what kinds of actions are possible with
Popcorn's web server. Briefly, these actions are of three kinds:

- read and modify the HTML DOM,
- post any input modes, and
- cause commands to be sent to the back-end app.

We describe UXML extensions to perform these three kinds of actions.

In the future, Popcorn could be extended to other environments where
user inputs and outputs involve unusual sensors and actuators. For
such environments, UXML commands will have to be developed for these
kinds of sensors and actuators.


Command descriptions
^^^^^^^^^^^^^^^^^^^^^

In the descriptions, we often use these terms in addition to *word*
and *path*:

*number*
   One or more digits, perhaps containing a decimal point, optionally
   preceded by a minus sign (ascii hyphen), perhaps separated from the
   digits by a space. For example: ``0``, ``-3``, ``52.1``.

*words*
   One or more of: *word*, *number*, *command word*, ascii space, or
   an ascii printable character. For example: ``100 px``,
   ``fill:#141414;fill-opacity:1``


Querying and Modifying the DOM
-----------------------------------


Setting attribute values
^^^^^^^^^^^^^^^^^^^^^^^^

  ===================  =================  ===================================
  Command              Arguments          Meaning
  ===================  =================  ===================================
  ``DOM SET``          ``ID ATTR VALUE``  Set the value of an attribute
  ``DOM SET BOOL``     ``ID ATTR``        Set boolean attribute
  ``DOM RESET BOOL``   ``ID ATTR``        Reset boolean attribute
  ===================  =================  ===================================

The ``DOM SET ATTR`` command sets the value of a non-boolean attribute
of an HTML element by ID:

  | ``DOM SET`` ``ID`` *word* ``ATTR`` *word* ``VALUE`` *words*

The above form sets the value of an attribute to the given value.
The *words* will be concatenated together before assignment.
The ``ID`` option argument must match the value of the element's
``id`` attribute. Possible errors: No such element.

For boolean attributes, there are ``DOM SET BOOL`` and ``DOM RESET
BOOL`` commands:

  | ``DOM SET BOOL`` ``ID`` *word* ``ATTR`` *word*
  | ``DOM RESET BOOL`` ``ID`` *word* ``ATTR`` *word*

The element whose ``id`` matches the ``ID`` option argument must take
a boolean attribute named by the ``ATTR`` option argument.  The ``DOM
SET BOOL`` command sets the boolean attribute on, while the ``DOM
RESET BOOL`` command sets it off.


Querying attribute values
^^^^^^^^^^^^^^^^^^^^^^^^^

  ===================  ==============  ===================================
  Query                Arguments       Evaluates to
  ===================  ==============  ===================================
  ``DOM ATTRW``        ``ID ATTR``     The *word* value of an attribute
  ``DOM ATTR``         ``ID ATTR``     The entire value of an attribute   
  ``DOM ON BOOL``      ``ID ATTR``     The boolean attibute ``ATTR``
  ===================  ==============  ===================================


The ``DOM ATTRW`` and ``DOM ATTR`` query commands extract the value of any
attribute. Typically you would write these commands in macro strings
so that their evaluation will yield the value.

``DOM ATTRW`` evaluates to a *word* based on the value of the
indicated attribute of the HTML element by ID:

  | ``DOM ATTRW ID`` *word* ``ATTR`` *word*

The two *words* are the HTML element id and the attribute name,
respectively. If the value of that attribute is longer than a *word*,
then the query evaluates to the longest prefix that matches the rules
for *word*.

The ``DOM ATTR`` query evaluates to a string, which is the value of
the indicated attribute of the HTML element by ID:

  | ``DOM ATTR ID`` *word* ``ATTR`` *word*

The resulting value is the entire string value of the attribute named
by the ``ATTR`` argument.

The ``DOM ON BOOL`` query is a *condition*. It is followed by a
``BEGIN...END`` pair enclosing arbitrary commands, which will be
executed only if the attribute ``ATTR`` is a boolean attribute that is
set:

  | ``DOM ON BOOL ID`` *word* ``ATTR`` *word* ``BEGIN``
  | ... *line* ...
  | ... *line* ...
  | ``END``

If the condition is true, i.e., the attribute named by the ``ATTR`` argument is set, then the *lines* between ``BEGIN`` and ``END`` are executed.
