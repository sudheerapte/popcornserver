#!/usr/bin/python3
import socket
import sys
import re
import fliesmod

def checkBegin(actual, expected):
    if not re.match(expected, actual):
        print('got |{}|; expected /^{}/'.format(actual, expected))
        sys.exit(1)

def checkNone(actual):
    if not actual is None:
        print('|{}|'.format(actual))
        sys.exit(1)

def show():
    print('fly1 = {}, spider = {}, turn = {}'
          .format(fliesmod.getPosition('fly1'),
                  fliesmod.getPosition('spider'),
                  fliesmod.getTurn()))

# Move spider from h to f
show()
checkBegin(fliesmod.getPosition('spider'), 'h')
checkNone(fliesmod.move('spider', 'f'))
checkBegin(fliesmod.getPosition('spider'), 'f')

# Move fly1 from b to d
show()
checkBegin(fliesmod.getPosition('fly1'), 'b')
checkBegin(fliesmod.move('fly1', 'e'), 'move')
checkNone(fliesmod.move('fly1', 'd'))
checkBegin(fliesmod.getPosition('fly1'), 'd')

# Move spider from h to f
show()
checkNone(fliesmod.move('spider', 'h'))
checkBegin(fliesmod.getPosition('spider'), 'h')

# Move fly1 from d to e
show()
checkNone(fliesmod.move('fly1', 'e'))
checkBegin(fliesmod.getPosition('fly1'), 'e')

# Move spider back to h
show()
checkBegin(fliesmod.move('spider', 'h'), 'item')

print('done')

