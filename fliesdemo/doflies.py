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
    result = fliesmod.move(item, position)
    if result is None:
        turn = fliesmod.getTurn()
        transaction = '''event: message
data: update fliesdemo
data: C .pos.{} {}
data: C .turn {}

'''.format(item, position, turn)
        return transaction
    else:
        return None

def parseMove(buf):
    m = re.search('move\s+(\w+)\s+(\w+)', buf)
    if m is not None:
        return m.group(1), m.group(2)
    else:
        return None, None

def printCommand(buf):
    print(buf)

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
        item, position = parseMove(received)
        if item is None:
            print('no move command parsed')
        else:
            trans = getMoveTransaction(item, position)
            if trans is not None:
                print('sending move {} {}'.format(item, position))
                sock.sendall(bytes(trans, "utf-8"))
            else:
                print('bad transaction; no command sent')

