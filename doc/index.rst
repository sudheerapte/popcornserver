.. popcorn documentation master file, created by
   sphinx-quickstart on Tue Jun 18 16:48:34 2019.
   You can adapt this file completely to your liking, but it should at least
   contain the root `toctree` directive.

Popcorn - make beautiful web-based applications
===============================================

.. toctree::
   :maxdepth: 2
   :caption: Contents:

   how-popcorn-works
   popcorn-ux-model
   specifying
   design-ux
   how-to-write
   deployment
   grammar

Popcorn is an unusual HTTP server designed from the ground up for
beautifully designed, highly responsive browser-based applications. It
is suitable for smart embedded devices or for applications that have a
limited number of users. It has not been designed for web-scale
Internet apps that serve thousands of users; for that kind of use, you
would probably need to deploy multiple copies of Popcorn. See the
*Deployment considerations* section at the end.

By "beautiful", we don't mean visually pleasing (although Popcorn
applications could be that, too). We mean pleasant to use.

A good user experience requires the UX designer to have *complete
control* over every user interaction. Popcorn lets the UX designer
define every single pixel of every millisecond of user interaction
using HTML5 features. If you are a **UX designer**, popcorn is for
you!  There are no web programmers putting up roadblocks based on
programming difficulties, or browser compatibilities, or framework
limitations. As long as your vision for the user experience is
possible to implement, then you can make it so. The only possible
obstacle might be performance-related, for example the response time
from the application or the web rendering might make something
impossible to do. You will have to work around that.

If you are a **programmer**, Popcorn can free you from GUI concerns
entirely. All the web UI assets--- HTML, images, CSS, SVG, etc.--- are
created by the UX designer. Popcorn provides a simple, unambiguous way
for you to communicate to the UX designer the UI state of the
application. You do not need to write any Javascript.

And finally, the Popcorn server is easy to integrate with applications
written in any language. Your application needs to communicate with
Popcorn over a TCP socket or a UNIX domain socket, using a simple
text-based protocol. You don't need any special libraries. If you are
writing your application in NodeJS, then you can use a client library
if you want: one is provided because Popcorn itself is written in
NodeJS. In any case, a few command-line tools are also provided so
that you can send your communication text strings to Popcorn by
supplying them as arguments, without having to open sockets yourself.

Popcorn roadmap
---------------

As of June 30, 2019:

Working today
-------------

* Linux installation

* Connected apps

* Simple demo app included in Popcorn

* Presentation-invoked changes (`data-chgclick`)

* Commands (`data-cmdclick`)


Future
------

* Arrays
* Windows port

How to read the rest of this document
-------------------------------------

* If you are only curious about Popcorn, read the section *How Popcorn
  Works*, and then decide if you want to read further.

* If you are deploying a Popcorn-based web application, you should
  read *How Popcorn Works* and then the section *Deployment
  considerations*.

* If you are a UX designer developing a Popcorn application, you
  should read the the entire document, except perhaps the section *How
  do Write a Popcorn Application*.

* If you are programming a Popcorn application, you probably need to
  read all the sections except *How to Design the UX of a Popcorn
  Application*.

* Section *Popcorn roadmap* - what works today, and what is planned.




Indices and tables
==================

* :ref:`search`
