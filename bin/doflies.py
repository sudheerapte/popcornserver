#!/usr/bin/python3
import time
import socket
import sys
import re

HOST, PORT = "localhost", 8001

turn = 'spider'

with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
    sock.connect((HOST, PORT))
    sock.sendall(bytes("event: appConnect\ndata: doflies\n\n", "utf-8"))
    received = str(sock.recv(1024), "utf-8")
    while re.search("ok", received):
        print("appConnect: received OK. Sending turn change...")
        time.sleep(2)
        sock.sendall(bytes('''event: message
data: update fliesdemo
data: C .turn {}

'''.format(turn), "utf-8"))
        print("sent update fliesdemo, turn = {}".format(turn));
        if turn == 'spider':
            turn = 'flies'
        else:
            turn = 'spider'
        received = str(sock.recv(1024), "utf-8")


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

def isadj(x, y):
    if y in adj[x] :
        print('yes, {0} is adjacent to {1}'.format(y,x))
    else:
        print('no, {0} is NOT adjacent to {1}'.format(y,x))

def isfwd(x, y):
    if y in fwd[x] :
        print('yes, {0} is forward from {1}'.format(y,x))
    else:
        print('no, {0} is NOT forward from {1}'.format(y,x))

isadj('d', 'e')
isadj('d', 'g')
isadj('d', 'h')

