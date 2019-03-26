## Machine definition syntax

### Paths

A machine can be described by `PATH`s, which are each a series of
separator-word pairs. A separator is a dot or a slash, and a *word* is
made of lowercase letters, digits, and hyphens `[a-z0-9-]`.

```
  PATH    ::=  ROOT [ SEGMENT ]
  ROOT    ::=  ''
  SEGMENT ::=  '.' WORD | '/' WORD
  WORD    ::=  [a-z0-9-]+
```

### Machine definition language commands

A machine can be defined in terms of paths by using a "machine
definition language", a series of single-letter *commands* with
arguments.

An argument can be:

- A *word*, made of lowercase letters, digits, and hyphens `[a-z0-9-]`.

- A *path*, made of words and single-character separators `.` and `/`

- A *line*, made of any utf-8 characters except newline (`\n`).

You define a machine by a series of one-line commands. There are three
basic commands: path command `P`, change command `C`, and data command
`D`.

```
  COMMAND ::= PCOMMAND | CCOMMAND | DCOMMAND
```

### P command - define a path

You define `PATH`s using a `P` command:

```
  PCOMMAND ::= 'P' <space> PATH
```

If any of the segments in `PATH` has not already been defined earlier,
then it gets defined with this `P` command. Any segments in the `PATH`
that already exist in the machine are left alone.

If a series of `P` commands defines a series of alt-child nodes for an
alt parent, then the first of these alt-child nodes is automatically
assumed to be the current child. For example:

```
  P .a/foo
  P .a/bar
  P .a/baz
```

The above three `P` commands define three alt-child nodes of `.a`, of
which `foo` is automatically made the current child, because its
command comes first.

### C command - set a current alt-child

You change an alt-node to set its current child using the `C` command:

```
  CCOMMAND ::= 'C' <space> PATH <space> WORD
```

`PATH` must be an existing alt-parent node in the machine.  The child
node `WORD` must already exist as a child of the `PATH`. If this child
is not already the current child, then this command makes it the
current child. Otherwise it remains the current child.

If multiple `C` commands are applied to the same `PATH`, then the last
`C` command wins.

### D command - assign data value to a non-alt leaf

You assign the data of a non-alt leaf node using the `D` command:

```
  DCOMMAND ::= 'D' <space> PATH <space> LINE
  DATA ::= <any UTF-8 string not containing a newline>
```

`PATH` must be an existing non-alt leaf node.  If multiple `D`
commands assign data to the same `PATH`, then the last `D` command
wins.

A sequence of commands forms a transaction. You can apply the
transaction to a machine, which simultaneously makes all the changes
described by the commands.


### Templates

A "template" is a predefined sub-tree that can be instantiated at
multiple places within the machine. When defining a machine, you use
templates to define reusable portions of the state machine.

You define a template with a `T` command, and specify its predefined
sub-tree using a series of `P`, `C`, and `D` commands. A template is
an entity associated with the machine, separate from all the paths.
The `T` command creates a template and gives it a name. Any subsequent
`P` commands that start with the name of the template (as opposed to
the root path) define the sub-tree.

```
  TCOMMAND  ::= 'T' <space> WORD [ <space> WORD ]*
```

That is, the command name `T` followed by a list of space-separated
`WORD`s. The first `WORD` in the list (there must be at least one) is
taken as the name of the template, which must be unique within the
machine.  Any subsequent `WORD`s in the `T` definition are taken as
macro arguments.

For example, this command defines a template named `person`, with two
arguments named `first` and `last`.

```
  T person first last
```

Once the template name is defined, you can use a series of `P`, `C`,
and `D` commands to define the sub-tree.

The following definition defines a template `person`, which takes two
arguments as above and defines a sub-tree containing six paths:

```
  T person first last
  P person.id {$NAME}
  P person.first
  D person.first {first}
  P person.last {last}
  D person.last {last}
  P person.function/individual
  P person.function/manager
  P person.department
```

The curly brackets `{` `}` are used to embed template macros,
discussed later below.

The template can contain either `.` children or `/` children (but not
both). Accordingly, the instantiated node will be either a
concurrent-parent or an alternative-parent.

Once a template is defined with at a sub-tree containing at least one
path, you can instantiate the template by creating a child of any
concurrent parent node.  You use an `I` command to create the child:

```
  I person .1221
```

The `I` command refers to the template name `person` and provides a
`PATH` to the new child node, which is named `1221` above. The child
node must not already exist.

A new child node is created at `PATH`, with all the paths in the
template's sub-tree instantiated underneath it. The template name
(`WORD`) itself is not part of the sub-tree. The `I` command thus
creates one instance of the template.

Any arguments to the macro can be inserted in the instantiated
sub-tree with a series of `G` commands referring to the same template
name. The syntax of the `I` and `G` commands is:

```
  ICOMMAND ::= 'I' <space> WORD <space> PATH
  GCOMMAND ::= 'G' <space> PATH <space> WORD <space> LINE
```

The `G` command provides a value for one of the template arguments,
`WORD`, defined in the `T` command. The `LINE` value in the `G`
command is the value that will be used when instantiating the
template. The `PATH` in the `G` command refers to the node where a
template is being instantiated.

There should be one `G` command per template argument. They can appear
in any order, but all the arguments of the macro must be defined
before the series of `G` commands is over.

Once all the `G` commands are processed, the instantiation of the
template is over. The new node will be either a concurrent-parent or
an alternative-parent, depending on the top-level node defined in the
template.

From this point on, the new child and its sub-tree become part of the
machine.  You can use the usual `C`, `D`, and similar commands to
modify the paths in the sub-tree as usual.

### Template macros

When defining a template, you can embed template macros: each argument
of the template definition (in our example, `first` and `last`), can
be surrounded by `{` curly braces `}` to interpolate its actual values
as specified in the `I` command.

In addition to the template arguments, four special keyword macros are
available. These keyword macros refer to the location where the
template will be instantiated:

```
   $NAME - name of the instantiated child node
   $PATH - full path of the instantiated child node
   $PARENTNAME - name of the parent of the instantiated child node
   $PARENTPATH - full path of the parent of the instantiated child node
```

Above, the first two keywords `$NAME` and `$PATH` refer to the new
node instantiated by the `I` command using the first `WORD` argument.
The latter two keywords `$PARENTNAME` and `$PARENTPATH` refer to the
parent of this new node.

These macros are usable in any of the `P`, `C`, and `D` commands that
define the template sub-tree.

Take the example template `person` from above:

```
  T person first last
  P person.id {$NAME}
  P person.first
  D person.first {first}
  P person.last {last}
  D person.last {last}
  P person.function/individual
  P person.function/manager
  P person.department
```

To instantiate the above template for a new employee with ID 1221, you
can issue a transaction containing these three commands:

```
  I person .1221
  G .1221 first Joe
  G .1221 last DiMaggio
```

This transaction will create a sub-tree at the new path `.1221`
(directly under the root node), with these concurrent child nodes:

- `id` with the data value `1221`.

- `first` and `last` with the given string data values.

- `department`, with no data value.

- `function`, an alt-parent with `individual` as the current value.

The resulting instantiated sub-tree will look like this:

```
   .1221.id                 (with data value = "1221")
   .1221.first              (with data value = "Joe")
   .1221.last               (with data value = "DiMaggio")
   .1221.function/individual
   .1221.function/manager
   .1221.department         (with empty data value)
```

### Arrays

You can instantiate a template multiple times under a single
concurrent node, creating an array of similar children. The command
for creating an array is `R`:

```
  RCOMMAND ::= 'R' <space> WORD <space> PATH
```

`PATH` should be the path to an existing leaf node.  The `R` command
converts the leaf node at `PATH` into an *array node*.

An array node is a leaf node at `PATH` that is a concurrent
parent. This array node will:

- maintain an array of concurrent-child nodes, the array elements.

- remember the template named `WORD` that its elements will be
instantiating.

- allow addition and removal of elements using the array commands
  below.

The array element nodes will be named `0`, `1`, `2`, etc., strings
encoding successive decimal numbers in numerically increasing
order. The last node will have the name `LENGTH - 1`, where LENGTH is
the total number of elements.  Each element will have underneath the
same sub-tree defined in the template `WORD`.

The array can be manipulated with the `E` command:

```
  ECOMMAND ::= 'E' <space> PATH <space> CMD
  CMD      ::= 'push' |
               'pop'  |
               'shift' |
               'unshift' |
               'insert' WORD |
               'delete' WORD
```

The `E` commands `push`, `unshift`, and `insert` will be followed by a
group of `G` commands.

`push` requires a set of `G` commands to define a new element. The new
element will be pushed to the end of the array. The array's length
will increase by one.

`pop` does not require any more commands. The last element will be
removed from the array, and its length will decrease by 1.

`shift` and `unshift` are similar to `pop` and `push`, respectively,
except that they work on the front of the array.

`insert` takes an index between 0 and `LENGTH-1`, and a set of `G`
commands to define a new element. The new element will be inserted at
that index, with all subsequent array elements moved up by one. The
array length will increase by 1.

`delete` takes an index between 0 and `LENGTH-1`. The element at that
index will be removed from the array, and subsequent elements will be
moved down by one. The array length will decrease by 1.

### Machine query language

Within renderers and also within apps, a machine can be queried to
obtain information about it:

`EXISTS` `PATH` returns true iff the machine has a node at that path.

`ISLEAF` `PATH` returns true iff a node exists at `PATH` with no child
nodes.

`DATA` `PATH` returns the data assigned to the node at `PATH` using a
`D` command.

`CURR` `PATH` returns the name of the current child of `PATH`, which
must be an alt-parent node.

`PARENT` `PATH` returns the path of the parent node of `PATH`. `PATH`
must not be the root node.

### Array expansion queries

`LENGTH` `PATH` returns the number of elements in the array `PATH`.

`EACH` `PATH` `LINE` is an iterator. You give it a macro string
containing `{NAME}` or `{PATH}` macros. It evaluates the macro string
once for each element in the array at `PATH`.

*TODO expand on array expansions.*

`CONCAT` `PATH` `PATH` returns a new `PATH` formed by concatenating
the two given paths in sequence. The first `PATH` must already exist.
Within the second `PATH`, you can use `..` as a navigator from one
node to its parent node. This allows you to (for example) navigate to
sibling nodes.

A machine query can be embedded within `{` curly braces `}`.