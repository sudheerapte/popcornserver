### Machine definition syntax

A machine can be described by `PATH`s, which are a series of segments:

```
  PATH    ::=  ROOT [ SEGMENT ]
  ROOT    ::=  ''
  SEGMENT ::=  '.' WORD | '/' WORD
  WORD    ::=  [a-z0-9-]+
```

You define a machine by a series of commands, as follows.

```
  COMMAND ::= PCOMMAND | CCOMMAND | DCOMMAND
```

You define `PATH`s using a `P` command:

```
  PCOMMAND ::= 'P' <space> PATH
```

If any of the segments in a path has not already been defined earlier,
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

You change the current child of an alt-node using the `C` command:

```
  CCOMMAND ::= 'C' <space> PATH <space> WORD
```

The child node `WORD` must already exist as a child of the `PATH`. If
this child is not already the current child, then this command makes
it the current child. Otherwise it remains the current child.

If multiple `C` commands are applied to the same `PATH`, then the last
`C` command wins.

You assign the data of a non-alt leaf node using the `D` command:

```
  DCOMMAND ::= 'D' <space> PATH <space> DATA
  DATA ::= <any UTF-8 string not containing a newline>
```

If multiple `D` commands assign data to the same `PATH`, then the last
`D` command wins.

A sequence of commands forms a transaction. You can apply the
transaction to a machine, which simultaneously makes all the changes
described by the commands.


### Templates

A "template" is a sub-tree that can be instantiated at multiple places
within the machine. When defining a machine, you use templates to
define reusable portions of the state machine.

You define a template with a `T` command and subsequent `P`
commands. A template is an entity associated with the machine,
separate from all the paths.  The `T` command creates a template and
gives it a name. Any subsequent `P` commands that start with the name
of the template (as opposed to the root path) define the sub-tree.

```
  TCOMMAND  ::= 'T' [ <space> WORD ]+
```

That is, the command name `T` followed by a list of space-separated
`WORD`s. The first `WORD` (there must be at least one) is taken as the
name of the template, which must be unique within the machine.

Any subsequent `WORD`s in the `T` definition are taken as macro
arguments; they are all optional.

Once a template is defined with at least one path, you can instantiate
the template by creating a child of any concurrent parent node.  You
use an `I` command to create the child:

```
  ICOMMAND ::= 'I' <space> WORD <space> PATH [<space> WORD <space> ARG]*
  ARG      ::= (any Unicode character except newline)
```

The `I` command refers to the template name `WORD` that was defined
earlier, and provides a `PATH` to the new child node. The child node
must not already exist. Any arguments to the macro can be inserted in
the instantiated sub-tree as follows.

A new child node is created at that path, with
all the paths in the template's sub-tree instantiated underneath
it. The template name (`WORD`) itself is not part of the sub-tree.

The `I` command thus creates one instance of the template.

The template can contain either `.` children or `/` children (but not
both). Accordingly, the instantiated node will be either a
concurrent-parent or an alternative-parent.

From this point on, the new child and its sub-tree become part of the
machine.  You can use the usual `C`, `D`, and similar commands to
modify the paths in the sub-tree as usual.

### Template macros

When defining a template, you can use special keywords to refer to the
location where the template will be instantiated:

```
   $NAME - name of the instantiated child node
   $PATH - full path of the instantiated child node
   $PARENTNAME - name of the parent of the instantiated child node
   $PARENTPATH - full path of the parent of the instantiated child node
```

Above, the first two keywords `NAME` and `PATH` refer to the new node
instantiated by the `I` command using the `WORD` argument above in the
syntax of the command. The latter two keywords refer to the parent of
this new node.

The keywords are used as follows. The paths in the defined sub-tree
can contain strings like `{$NAME}` or `{$PATH}`; these will be
substituted at instantiation time by the corresponding value. These
keywords are usable in any of the `P` and `D` commands that define the
template sub-tree.

For example, the following definition defines a template "person":

```
  T person first last
  P person.id {$NAME}
  P person.{first}
  P person.{last}
  P person.function/individual
  P person.function/manager
  P person.department
```

To instantiate the above template for a new employee with ID 1221, you
can issue the following transaction:

```
  I person .1221 first Joe last DiMaggio
```

This transaction will create a sub-tree at the new path `.1221`, with
these concurrent child nodes:

- `id` with the data value `.1221`.

- `first` and `last` with the given string data values.

- `department`, with no data value.

- `function`, an alt-parent with `individual` as the current value.



### Arrays

You can instantiate a template multiple times under a concurrent node,
creating an array of similar children. The command for creating an
array is `R`:

```
  RCOMMAND ::= 'R' <space> WORD <space> PPATH
```

`PPATH` should be the path to an existing leaf node.  The `R` command
converts the leaf node at `PPATH` into an *array node*.

An array node remembers the template that its elements will be based
upon (`WORD` in our example above), and it has a child node named
`PPATH.length`, a leaf node that has a data element with the string
value `0`. The idea is that `PPATH` will later have children
instantiated from the template `WORD`. These children are the array
elements, and the number of elements will be in the data string
assigned to `PPATH.length`. The children will be named `0`, `1`, `2`,
etc., decimal strings in increasing order up to `length - 1`, and they
will of course each have underneath the same sub-tree defined in the
template `WORD`.

The array can be manipulated with the `E` command:

```
  ECOMMAND ::= 'E' <space> PPATH <space> CMD
  CMD      ::= 'push' |
               'pop'  |
               'shift' |
               'unshift' |
               'delete' NUM
```

The 

