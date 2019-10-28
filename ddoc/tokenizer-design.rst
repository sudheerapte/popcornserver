.. _tokenizer-design:

The PSL Language Characters and Tokens
=======================================

The Popcorn State Language (PSL) uses a subset of ASCII::

  A-Z a-z 0-9
  SLASH /
  PLUS +
  EQUAL =
  HYPHEN -
  UNDERSCORE _
  DOT .
  HASH #
  OPENCURLY {
  CLOSECURLY }
  DOUBLEQUOTE "
  BACKSLASH \

In addition to the above characters, spaces can be used for separating
tokens.  PSL is a line-oriented language: the input text is read in as
a sequence of lines, and each line is tokenized. This means that one
token cannot span multiple lines.

Note that this set of characters contains the narrower subset called
``base64``, as described in RFC 6455, base framing protocol in Section
5, which allows only ``SLASH`` and ``PLUS`` in addition to the letters
and numbers.



These are the types of tokens recognized:

``KEYWORD``
   Used for predefined names in the language, e.g., a command or a
   named option.  All-capital letters ``A-Z``, digits, and underscores
   ``_``; the first character must be a letter.

``WORD``
   Used for user-assigned names in the language, e.g.,
   the name of an application sub-state.
   All-lowercase letters ``a-z``, hyphen ``-``, and digits ``0-9``.
   The first character must be a letter.

``STRING``
   Used for data, e.g., a data item assigned to a leaf state.
   The contents can be any of the permitted characters, enclosed
   by a pair of double quote characters ``"``. Doublequote
   characters can be contained inside the string by escaping them
   with a ``BACKSLASH`` character ``\``.
   Strings can be used to capture arbitrary binary data by
   using a convention: if the first character is an ``EQUAL`` sign
   ``=``, then the rest of the string can be interpreted as a
   ``base64`` encoded sequence of octets.

``NUMBER``
  A sequence of digits, possibly preceded by a plus or minus sign.
  The tokenizer does not recognize fractional numbers or exponents.

``VARIABLE``
  A variable name enclosed in single braces like this:
  ``{QUEENS_GAMBIT}``. The format of the name portion is the same as a
  ``KEYWORD`` token above: uppercase letters, numbers, and underscore.

``OPENMACRO`` and ``CLOSEMACRO``
  ``{{`` ``}}``, macro open and close tokens. These tokens should be
  matching and should enclose a sequence of tokens. They are used to
  introduce macro expressions. During execution, the entire sequence
  will be replaced by the result of a macro expansion.


In tabular form:

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

  ``{{`` ``}}``   Macro open and close; encloses other tokens.

  ==============  ==============================================
 
The ``Tokenizer`` class can construct tokens out of text.  Each token
is a ``{name, value}`` object, where ``name`` and ``value`` are both
strings.

The exact Regex format of the tokens, and the exact names of all the
special chars, are in the class constructor.

Note the difference between a variable and a macro: a variable is a
single token that starts and ends with braces, whereas the begin- and
end-macro symbols are each a separate token and enclose other tokens
in between.

The tokenize method
^^^^^^^^^^^^^^^^^^^^

If this string were passed to ``tokenize()``::

  MARY had a {ADJECTIVE} lamb whose fleece was {{SIMILE}}

it would return 11 tokens:

  ==============  =====================================================
  Name(s)         Value(s)
  ==============  =====================================================
  keyword         ``MARY``
  word, word      ``had``, ``a``
  variable        ``ADJECTIVE``
  word (x4)       ``lamb``, ``whose``, ``fleece``, ``was``
  macro-open      (none)
  keyword         ``SIMILE``
  macro-close     (none)
  ==============  =====================================================

The Tokenizer class is a simple, stateless class that deals with
tokens only.  Checking syntax to make sure the input makes sense is a
higher-level operation performed by the ``Parser`` class.


The tokenize and renderTokens methods
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

The ``tokenize()`` method takes a string and produces a token list.
It returns an array of two items: an error message and the token list.
The error message is ``null`` if all goes well. The entire string must
be consumable as tokens, otherwise you get a ``bad token at index``
error. It is OK to pass in a string containing just spaces; you get
back an empty array as a token list.

The ``tokenize()`` method can also take an array of strings and
produce a corresponding array of token lists (a token-list array
occurs frequently and is called a TLA). It checks to see if it has
been passed a single string or an array of strings, to decide which
one it should produce.

The ``renderTokens()`` method performs the inverse operation, taking a
token list and producing a string. This operation is useful for
printing error messages. The ``renderTokens()`` method cannot take a
TLA; you must pass in a simple array of tokens to it.
