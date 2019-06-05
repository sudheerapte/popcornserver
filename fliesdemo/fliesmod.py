import re

turn = 'spider'
posdict = {
    'spider': 'h',
    'fly1': 'b',
    'fly2': 'a',
    'fly3': 'c',
    }

okmatch = re.compile(r"data\:\s+ok");

def parseMove(buf):
    m = re.search(r'move\s+(\w+)\s+(\w+)', buf)
    if m is not None:
        print("   -- move {} {}".format(m.group(1), m.group(2)))
        return m.group(1), m.group(2)
    else:
        return None, None

def getPosition(item):
    return posdict[item]

def getItemAt(position):
    for i, p in posdict.items():
        if p == position:
            return i
    return None

def getTurn():
    global turn
    return turn

def setTurn(t):
    global turn
    if turn == t:
        print("setTurn({}): cannot set to same value again".format(t))
        sys.exit(1)
    else:
        turn = t

def move(item, position):
    global turn
    if not item in posdict:
        return("item ${item}: no such item".format(item))
    if getPosition(item) == position:
        return("item {} already at {}".format(item, position))
    if getTurn() == "spider" and not item == "spider":
        return("move {}: spider's turn".format(item));
    if getTurn() == "flies" and not re.match(r"fly", item):
        return("move {} {}: it is flies's turn".format(item, position));
    if not getItemAt(position) is None:
        return("move to {}: position already occupied".format(position))
    if getTurn() == "spider":
        currpos = getPosition("spider")
        if isadj(currpos, position):
            posdict['spider'] = position
            setTurn('flies')
            return None
        else:
            return("move {}: not adjacent".format(position))
    if getTurn() == "flies":
        currpos = getPosition(item)
        if isfwd(currpos, position):
            posdict[item] = position
            setTurn('spider')
            return None
        else:
            return("move {}: cannot go backward from {}".format(position, currpos))
    return("impossible!")

adj = {
    'a': ('b', 'c', 'd' ),
    'b': ('a', 'c', 'd', 'e' ),
    'c': ('a', 'b', 'd', 'g' ),
    'd': ('a', 'b', 'c', 'e', 'f', 'g'),
    'e': ('b', 'd', 'f', 'h' ),
    'f': ('d', 'e', 'g', 'h' ),
    'g': ('c', 'd', 'f', 'h' ),
    'h': ('e', 'f', 'g' )}

fwd = {
    'a': ('b', 'c', 'd' ),
    'b': ('c', 'd', 'e' ),
    'c': ('b', 'd', 'g' ),
    'd': ('e', 'f', 'g'),
    'e': ('f', 'h' ),
    'f': ('e', 'g', 'h' ),
    'g': ('f', 'h' ),
    'h': ( )}

def getInitialMachineMessage():
    return '''
event: message
data: provide fliesdemo
data: P .board.b/fly1
data: P .board.b/fly2
data: P .board.b/fly3
data: P .board.b/spider
data: P .board.b/empty
data: P .board.a/fly2
data: P .board.a/fly1
data: P .board.a/fly3
data: P .board.a/spider
data: P .board.a/empty
data: P .board.c/fly3
data: P .board.c/fly1
data: P .board.c/fly2
data: P .board.c/spider
data: P .board.c/empty
data: P .board.d/empty
data: P .board.d/fly1
data: P .board.d/fly2
data: P .board.d/fly3
data: P .board.d/spider
data: P .board.e/empty
data: P .board.e/fly1
data: P .board.e/fly2
data: P .board.e/fly3
data: P .board.e/spider
data: P .board.f/empty
data: P .board.f/fly1
data: P .board.f/fly2
data: P .board.f/fly3
data: P .board.f/spider
data: P .board.g/empty
data: P .board.g/fly1
data: P .board.g/fly2
data: P .board.g/fly3
data: P .board.g/spider
data: P .board.h/spider
data: P .board.h/fly1
data: P .board.h/fly2
data: P .board.h/fly3
data: P .board.h/empty
data: P .turn/spider
data: P .turn/flies

'''

def isadj(x, y):
    return y in adj[x]

def isfwd(x, y):
        return y in fwd[x]

