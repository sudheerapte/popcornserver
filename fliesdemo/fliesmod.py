import re

turn = 'spider'
posdict = {
    'spider': 'h',
    'fly1': 'b',
    'fly2': 'a',
    'fly3': 'c',
    }

okmatch = re.compile(r"data\:\s+ok");

def getPosition(item):
    return posdict[item]

def getItemAt(position):
    for i, p in posdict.items():
        if p == position:
            return i
    return None

def move(item, position):
    if not item in posdict:
        return("item ${item}: no such item".format(item))
    if getPosition(item) == position:
        return("item {} already at {}".format(item, position))
    if turn == "spider" and not item == "spider":
        return("move spider: not spider's turn");
    if turn == "flies" and not item.match(r"fly"):
        return("move {}: not flies's turn".format(item));
    if not getItemAt(position) is None:
        return("move to {}: position already occupied".format(position))
    if turn == "spider":
        currpos = getPosition("spider")
        if isadj(currpos, position):
            posdict['spider'] = position
            return None
        else:
            return("move {}: not adjacent".format(position))
    if turn == "flies":
        currpos = getposition(item)
        if isfwd(currpos, position):
            posdict[item] = position
            return None
        else:
            return("move {}: cannot go backward from {}",format(position, currpos))
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

def sendInitialMachine(sock):
    temp = '''
event: message
data: provide fliesdemo
data: P .board.a/fly1
data: P .board.a/fly2
data: P .board.a/fly3
data: P .board.a/spider
data: P .board.a/empty
data: P .board.b/fly2
data: P .board.b/fly1
data: P .board.b/fly3
data: P .board.b/spider
data: P .board.b/empty
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
    sock.sendall(bytes(temp, 'utf-8'))

def printReceived():
    m = re.search(okmatch, received);
    if m:
        pass
    else:
        print('received=|{}|'.format(received))

def sendTurn(sock, turn):
    print("appConnect: Sending turn {}...".format(turn))
    time.sleep(2)
    sock.sendall(bytes('''event: message\ndata: update fliesdemo\ndata: C .turn {}\n\n'''.format(turn), "utf-8"))
    received = str(sock.recv(1024), "utf-8")
    printReceived()



def isadj(x, y):
    return y in adj[x]

def isfwd(x, y):
        return y in fwd[x]

