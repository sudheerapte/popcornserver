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

checkBegin(fliesmod.getPosition('spider'), 'h')
checkNone(fliesmod.move('spider', 'f'))
checkBegin(fliesmod.getPosition('spider'), 'f')
checkNone(fliesmod.move('spider', 'h'))
checkBegin(fliesmod.getPosition('spider'), 'h')
checkBegin(fliesmod.move('spider', 'h'), 'item')

print('done')



