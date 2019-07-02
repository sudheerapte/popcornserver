
Deployment considerations
=========================

Launch and options file
-------------------------------------------

Popcorn can be deployed independently of any applications or web
assets. The Popcorn server should be deployed under the ownership of a
user with permissions to listen on the chosen sockets for HTTP and TCP
traffic.

On launch, Popcorn reads its configuration file::

 ~/.popcorn/options.json

This file specifies the following key information::

 httpPort           HTTP port to listen on for clients
 appPort            TCP port (or UNIX socket) to listen on for apps
 machineDirs        Location of asset directory for each machine

Performance and scalability
---------------------------

Each Popcorn server maintains a persistent websocket connection with
each of its clients, so as a practical matter, it can work well with a
few dozen clients at a time on a 1 GHz machine.

As far as applications (apps) are concerned, they can come and go, or
they can be persistently connected to listen for commands. Popcorn can
work well with a dozen or so apps on a 1 GHz machine. This does not
count the CPU taken by the app itself. The app could run on a
different machine, too, if it uses a TCP socket to communicate with
Popcorn. Most apps do not update their UX Models more often than
about once a second. If an app is doing hundreds of updates a second,
then network, CPU, and memory usage might be worth reviewing.

The NodeJS runtime takes about 20 to 25MB of real memory.  Popcorn
maintains in memory each UX Model.  The Popcorn application takes
about 10MB with two or three apps running. If Popcorn is the only
thing running, it should run well on fairly modest-sized systems.

Run-time dependencies
---------------------

Popcorn is written in NodeJS, so it requires the NodeJS runtime
version 10 or newer. But it has no other dependencies. Popcorn
implements both SSE and websocket protocols entirely on its own
without including any third-party libraries.

The commands in ``bin``, namely ``launch`` and others, are shell scripts,
so they either require a UNIX/Linux machine, or at least a shell
environment such as Windows Subsystem for Linux (WSL) on Windows 10.

For a Windows port, see the section *Popcorn roadmap* for plans.

These scripts are quite minimal; it is always possible to launch
Popcorn using a command-line invocation of ``node``, giving it the ``js``
file named ``launch.js``.


