.. _tokenizer-design:

Language Tokens
================================

The Popcorn State Language (PSL) uses a subset of 7-bit-clean ASCII
for all meaningful tokens:

  ==============  ==============================================
  Token           Meaning and format
  ==============  ==============================================
  keyword         Stands for a command or named option.
                  All-capital letters ``A-Z`` and underscores
                  ``_``; the first character must be a letter.
  
  word            The name of a sub-state, assigned by designer.
                  ``a-z``, hyphen ``-``, and digits ``0-9``.
                  The first character must be a letter.
                  As a special case, the root state is named
                  by the empty word.

  string          Sequence of printable ASCII characters
                  enclosed in double-quotes: ``"some string"``.

  number          Sequence of digits, possibly preceded by a
                  ``+`` or ``-`` sign.

  variable        Keyword-like variable name enclosed in single
                  braces: ``{QUEENS_GAMBIT}``.

  special char    Any of the printable ASCII characters that are
                  not letters or digits, appearing by itself.

  ``{{``          Macro open

  ``}}``          Macro close

  ==============  ==============================================
 
Note that a variable is a single token that starts and ends with
braces, whereas the begin- and end-macro symbols enclose other
tokens::

  MARY had a {ADJECTIVE} lamb whose fleece was {{SIMILE}}

If the above string were passed to ``tokenize()``, it would return:

  ==============  =====================================================
  Tokens          Values
  ==============  =====================================================
  keyword         ``MARY``
  word, word      ``had``, ``a``
  variable        ``ADJECTIVE``
  word (4)        ``lamb``, ``whose``, ``fleece``, ``was``
  macro-open      (no value)
  keyword         ``SIMILE``
  macro-close     (no value)
  ==============  =====================================================


The tokenizer class
^^^^^^^^^^^^^^^^^^^^

The ``tokenize()`` method takes a string and produces a list of
tokens. It returns an array of two items: an error message and the
list of tokens. The error message is ``null`` if all goes well.

The ``tokenize()`` method can also take an array of strings and
produce a corresponding array of lists of tokens (



Structures used in PSL
^^^^^^^^^^^^^^^^^^^^^^^^

PSL uses lists of the above tokens to build structures:

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
                  tokens. The tokenizer expands a query if it is
                  enclosed in begin and end macro tokens.  If the list
                  of tokens contains nested begin-end macro tokens
                  enclosing queries, then the tokenizer will first
                  execute the nested queries and use the results in
                  place of the macro.
  
  command         Token list starting with a command keyword.
                  The command can be executed in a context
                  to produce a side effect.

  variable        A name formatted like a keyword, that is bound
                  to a value in some context. The tokenizer
                  expands the variable if it is enclosed within
                  single braces, ``{`` and ``}``, replacing the
                  entire structure with the bound value, which
                  must be a list of tokens.

  ==============  =====================================================


Tokens are either one of these six types:

         BEGIN END COMMAND WORD STRING

or one-character types for each of the special characters below.
  
They are represented as objects: {name: 'COMMAND', value: 'CURRENT'}

The STRING token is treated specially. If the input string
contains any character not recognized as a token, then the entire
input string from that character on is put into a STRING token.

WORD is a popcorn machine path segment, [a-z][a-z0-9-]*.
COMMAND is any all-capitals word. Their value fields have the
actual string value.

Spaces are always ignored and can be used to separate adjacent
tokens that might otherwise be merged (really, only WORD WORD or
COMMAND COMMAND).

BEGIN and END are {{ and }} respectively. (You can escape them
with a backslash if you want to hide them).

DOT and SLASH are the single-character path components.




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
