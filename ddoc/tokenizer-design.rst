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
