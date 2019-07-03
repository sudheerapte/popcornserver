import re

turn = 'spider'
fCount = 0
hCount = 0

posdict = {
    'spider': 'h',
    'fly1': 'b',
    'fly2': 'a',
    'fly3': 'c',
    }

okmatch = re.compile(r"data\:\s+ok");

def initialize():
    global posdict, fCount, hCount, turn
    posdict['spider'] = 'h'
    posdict['fly1'] = 'b'
    posdict['fly2'] = 'a'
    posdict['fly3'] = 'c'
    turn = 'spider'
    fCount = 0
    hCount = 0

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

def fliesInWinningPosition():
    for aFly in [ 'fly1', 'fly2', 'fly3' ]:
        if not re.match(r'e|f|g', getPosition(aFly)):
            return False
    return True

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

def checkWin():
    '''return spider, flies, or None.
    If the spider keeps returning again and again to 'f' or 'h', it wins.
    If the flies occupy 'e', 'f' and 'g', they win.
    If the spider occupies 'a', 'b', 'c', or 'd', it wins.
    '''
    global fCount, hCount
    if getPosition('spider') == 'f':
        fCount = fCount+1
    if getPosition('spider') == 'h':
        hCount = hCount+1
    if fCount > 6 or hCount > 6:
        fCount = 0
        hCount = 0
        return 'spider'
    if re.match(r'a|b|c|d', getPosition('spider')):
        fCount = 0
        hCount = 0
        return 'spider'
    if fliesInWinningPosition():
        fCount = 0
        hCount = 0
        return 'flies'
    return None


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
data: P .turn/win-spider
data: P .turn/win-flies

'''

def getReinitializeMessage():
    return '''
event: message
data: update fliesdemo
data: C .board.a fly2
data: C .board.b fly1
data: C .board.c fly3
data: C .board.d empty
data: C .board.e empty
data: C .board.f empty
data: C .board.g empty
data: C .board.h spider
data: C .turn spider

'''    

def isadj(x, y):
    return y in adj[x]

def isfwd(x, y):
        return y in fwd[x]

