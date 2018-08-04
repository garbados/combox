# ComBox

[![Build Status](https://img.shields.io/travis/garbados/combox/master.svg?style=flat-square)](https://travis-ci.org/garbados/combox)
[![Coverage Status](https://img.shields.io/coveralls/github/garbados/combox/master.svg?style=flat-square)](https://coveralls.io/github/garbados/combox?branch=master)
[![Stability](https://img.shields.io/badge/stability-experimental-orange.svg?style=flat-square)](https://nodejs.org/api/documentation.html#documentation_stability_index)
[![NPM Version](https://img.shields.io/npm/v/combox.svg?style=flat-square)](https://www.npmjs.com/package/combox)
[![JS Standard Style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat-square)](https://github.com/feross/standard)

A p2p feed and messaging system implemented with [HyperDB](https://github.com/mafintosh/hyperdb) and [PouchDB](https://github.com/pouchdb/pouchdb).

ComBox allows you to delete information from shared feeds by a process called *regeneration* in which a host abandons the peer swarm, deletes the feed's metadata, reconstructs it from saved content, and broadcasts it to a new swarm at a new link. ComBox provides a Directory class which helps to manage these changing links so that peers can follow archives even as they move, and an Inbox class which creates a shared writable archive that peers can use to leave messages for the host or each other.

TODO demo

## Install

You can get ComBox with [npm](https://www.npmjs.com/):

```bash
$ npm i combox
```

Once installed, you can `require()` it in your projects:

```javascript
const {
	ComBox,
	Inbox,
	Directory
} = require('combox')

const box = new ComBox({ ... })
```

## Usage

A quick sketch of the exposed classes and their APIs:

```
ComBox
.constructor(options = {})
- pouch: custom pouchdb instance
- PouchDB: custom pouchdb constructor
- pouchPath: pouchdb constructor name parameter
- pouchOptions: pouchdb constructor options parameter
- couchUrl: alternate pouchdb constructor name parameter.
			prioritized over pouchPath.
- hyper: custom hyperdb instance 
- hyperStorage: hyperdb constructor storage path parameter
- hyperOptions: hyperdb constructor options parameter
- HyperDB: custom hyperdb constructor
- key: archive discovery key / dat url
.get(key): retrieve doc (from pouchdb? from hyperdb?)
.put(key, value): update doc (in hyperdb? in pouchdb?)
.del(key, { soft }): remove doc. if soft:true, do not regenerate.
.delete: del alias
.rm: del alias
.remove: del alias
.regenerate(): destroy hyperdb and recreate from pouchdb.
			   fires a 'regeneration' event once complete.
.leave(): exit swarm
.close(): exit swarm and close hyperdb feeds
.destroy(): exit swarm, destroy hyperdb, and destroy pouchdb
.pouch: accessor for attached pouchdb instance
.hyper: accessor for attached hyperdb
._onConnection(peer): fired on connect; no-op
._onChange(nodes): fired on hyperdb update; no-op
._encoding(obj) -> buffer: encodes content for hyperdb; no-op
._decoding(buf) -> object: decodes content from hyperdb; no-op

Inbox
._onConnection(peer): authenticates with hyperdb like cabal does

Directory
.getInbox(name)
.getOutbox(name)
.addInbox(name, meta = {}, options = {}): creates inbox; adds link to directory
.addOutbox(name, meta = {}, options = {}): creates combox; adds link to directory
.updateInbox(name, meta = {})
.updateOutbox(name, meta = {})
.rmInbox(name): destroys inbox; removes link from directory
.rmOutbox(name): destroys combox; removes link from directory
._onRegeneration(name, box):
	fires when an archive regenerates.
	by default, updates directory with new link.
```

## Development

To hack on ComBox, check out the [issues page](https://github.com/garbados/combox/issues). To submit a patch, [submit a pull request](https://github.com/garbados/combox/pulls).

To run the test suite, use `npm test` in the source directory:

```bash
$ git clone garbados/combox
$ cd combox
$ npm i
$ npm test
```

A formal code of conduct is forthcoming. Pending it, contributions will be moderated at the maintainers' discretion.

## License

[Apache-2.0](https://www.apache.org/licenses/LICENSE-2.0.html)
