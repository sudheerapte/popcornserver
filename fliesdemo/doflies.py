#!/usr/bin/python3
import time
import socket
import sys
import re
import fliesmod


HOST, PORT = "localhost", 8001

okmatch = re.compile(r"data\:\s+ok");

with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
    sock.connect((HOST, PORT))
    sock.sendall(bytes("event: appConnect\ndata: doflies\n\n", "utf-8"))
    received = str(sock.recv(1024), "utf-8")
    printReceived()
    print("appConnect: Sending initial machine...")
    fliesmod.sendInitialMachine(sock)
    received = str(sock.recv(1024), "utf-8")
    fliesmod.printReceived()
    while re.search(okmatch, received):
        fliesmod.sendTurn(sock, turn);
        if turn == 'spider':
            turn = 'flies'
        else:
            turn = 'spider'

print('received=|{}|'.format(received))
isadj('d', 'e')
isadj('d', 'g')
isadj('d', 'h')
