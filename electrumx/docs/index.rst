==============
Nito ElectrumX
==============

Nito ElectrumX is the Electrum protocol server for the NITO network. It keeps
the ElectrumX architecture, adds the NITO coin definition, and includes the
Nito v4 transaction parser required for blocks that contain Orchard private
transaction bundles.

The server connects to a Nito Core full node and indexes public transparent
scripts for efficient wallet and explorer queries. Private Orchard receivers,
notes and nullifiers remain wallet-side data and are not exposed as public
address balances.

The current version is |release|.

Source Code
===========

The project is hosted on `GitHub
<https://github.com/NitoNetwork/electrumx-NITO/>`_.

Please submit an issue on the `bug tracker
<https://github.com/NitoNetwork/electrumx-NITO/issues>`_ if you have found a
bug or have a suggestion to improve the server.

Authors and License
===================

Nito ElectrumX is distributed under the MIT licence and preserves upstream
ElectrumX authorship; see :ref:`Authors`. Python version at least 3.10 is
required.

The code is released under the `MIT Licence
<https://github.com/NitoNetwork/electrumx-NITO/blob/main/LICENCE>`_.

Getting Started
===============

See :ref:`HOWTO`.

There is also an `installer`_ available that simplifies the
installation on various Linux-based distributions, and a `Dockerfile`_
available.

.. _installer: https://github.com/bauerj/electrumx-installer
.. _Dockerfile: https://github.com/lukechilds/docker-electrumx

Documentation
=============

.. toctree::

   features
   changelog
   HOWTO
   environment
   protocol
   peer_discovery
   rpc-interface
   architecture
   authors

Indices and tables
==================

* :ref:`genindex`
* :ref:`search`
