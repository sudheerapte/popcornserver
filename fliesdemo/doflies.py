#!/usr/bin/python3
import time
import socket
import sys
import re
import fliesmod

HOST, PORT = "localhost", 8001

okmatch = re.compile(r"data\:\s+ok");

received = None

def getMoveTransaction(item, position):
    currpos = fliesmod.getPosition(item)
    if currpos is None:
        print("move to {}: item {} current position is unknown!".format(position, item))
    result = fliesmod.move(item, position)
    if result is None:
        turn = fliesmod.getTurn()
        transaction = '''event: message
data: update fliesdemo
data: C .board.{} {}
data: C .board.{} empty
data: C .turn {}

'''.format(position, item, currpos, turn)
        return transaction
    else:
        print("move {} {} failed: {}".format(item, position, result))
        return None

def printCommand(buf):
    m = re.search(r"command\s+([^\n]+)", buf)
    if (m):
        print("   command: {}".format(m.group(1)))
    else:
        print("   bad command: {}".format(buf))

received = None

with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
    sock.connect((HOST, PORT))
    sck = sock
    sock.sendall(bytes("event: appConnect\ndata: doflies\n\n", "utf-8"))
    received = str(sock.recv(1024), "utf-8")
    print("appConnect: Sending initial machine...")
    fliesmod.sendInitialMachine(sock)
    received = str(sock.recv(1024), "utf-8")
    while re.search(okmatch, received):
        print('waiting for command...')
        received = str(sock.recv(1024), "utf-8")
        printCommand(received)
        print(fliesmod.parseMove(received))
        item, position = fliesmod.parseMove(received)
        if item is None:
            print('no move command parsed')
        else:
            print("making move transaction");
            trans = getMoveTransaction(item, position)
            if trans is not None:
                print('sending move {} {}'.format(item, position))
                sock.sendall(bytes(trans, "utf-8"))
            else:
                print('bad transaction; no command sent')
            reply = str(sock.recv(1024), "utf-8")
            if re.search(okmatch, reply):
                print('transaction was OK')
            else:
                print('transaction failed: {}'.format(reply))
        received = "data: ok"
            
