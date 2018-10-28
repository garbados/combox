# ComBox

[![Build Status](https://img.shields.io/travis/garbados/combox/master.svg?style=flat-square)](https://travis-ci.org/garbados/combox)
[![Coverage Status](https://img.shields.io/coveralls/github/garbados/combox/master.svg?style=flat-square)](https://coveralls.io/github/garbados/combox?branch=master)
[![Stability](https://img.shields.io/badge/stability-experimental-orange.svg?style=flat-square)](https://nodejs.org/api/documentation.html#documentation_stability_index)
[![NPM Version](https://img.shields.io/npm/v/combox.svg?style=flat-square)](https://www.npmjs.com/package/combox)
[![JS Standard Style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat-square)](https://github.com/feross/standard)

A [PouchDB](https://pouchdb.com/) plugin that mirrors the database with a [Dat](https://datproject.org/) archive using Beaker's [DatArchive](https://beakerbrowser.com/docs/apis/dat) API. As a result, you can use ComBox in the browser with [Beaker](https://beakerbrowser.com/)! To use it in NodeJS, you'll need [node-dat-archive](https://github.com/beakerbrowser/node-dat-archive).

## Install

You can get ComBox with [npm](https://www.npmjs.com/):

```bash
$ npm i combox
```

Once installed, you can `require()` it in your projects:

```javascript
const PouchDB = require('PouchDB')
const ComBox = require('combox')
PouchDB.plugin(ComBox)

const db = new PouchDB('combox')
await db.setupDatArchive()
```

Once the archive has been set up, its contents will be automatically mirrored to PouchDB.

If you cannot write to the attached archive, any calls to destructive methods like `.bulkDocs` will fail. Read-only methods like `.get()` and `.query()` will continue to operate normally.

## Usage

### ComBox

The ComBox plugin adds and modifies some methods. They are documented here:

#### `async .setupDatArchive([options])`

Creates, loads, or simply attaches an archive to the database, and initializes the mirroring process.

Parameters:

- `options`: Options object.
- `options.archive`: A specific archive to mirror. Must have been created using DatArchive.
- `options.DatArchive`: A DatArchive constructor. Use this parameter with [node-dat-archive](https://github.com/beakerbrowser/node-dat-archive) if you are writing a server-side application.
- `options.options`: Options for DatArchive when it constructs the archive. Only useful when the constructor from [node-dat-archive](https://github.com/beakerbrowser/node-dat-archive) is used, as Beaker's does not take options.
- `options.url`: A Dat URL to follow. Following an archive you cannot write to will block destructive methods like `.bulkDocs()`.

#### `async .bulkDocs(docs, [options], [callback])`

ComBox wraps [PouchDB#bulkDocs](https://pouchdb.com/api.html#batch_create) to mirror writes, including deletes, to the archive. Because of how PouchDB performs writes internally, wrapping this method causes other methods like `.put`, `.post`, and `.remove` to also affect the archive.

The parameters are unchanged from the original.

#### `async .destroy([options], [callback])`

Wraps [PouchDB#destroy](https://pouchdb.com/api.html#delete_database) to also stop sharing the associated archive and destroy any associated files.

The parameters are unchanged from the original.

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
