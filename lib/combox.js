'use strict'

const DefaultHyperDB = require('hyperdb')
const DefaultPouchDB = require('pouchdb')
const discovery = require('discovery-swarm')
const isEqual = require('lodash.isequal')
const ram = require('random-access-memory')
const swarmDefaults = require('dat-swarm-defaults')
const { EventEmitter } = require('events')
const { cbify } = require('./common')

/*
A base class that wraps HyperDB, PouchDB
*/
module.exports = class ComBox extends EventEmitter {
  constructor (options = {}) {
    super()
    let {
      couchUrl,
      hyper,
      HyperDB,
      hyperOptions,
      hyperStorage,
      key,
      pouch,
      PouchDB,
      pouchOptions,
      pouchPath
    } = options
    // configure hyperdb
    this.HyperDB = HyperDB || DefaultHyperDB
    this.hyperStorage = hyperStorage || function () { return ram() }
    this.hyperOptions = Object.assign({
      valueEncoding: {
        encode: (obj) => {
          return Buffer.from(JSON.stringify(obj))
        },
        decode: (buf) => {
          const str = buf.toString('utf8')
          try {
            return JSON.parse(str)
          } catch (err) {
            return {}
          }
        }
      }
    }, hyperOptions)
    this.hyper = hyper || new this.HyperDB(this.hyperStorage, key, this.hyperOptions)
    // configure pouchdb
    PouchDB = PouchDB || DefaultPouchDB
    pouchPath = couchUrl || pouchPath || '.combox'
    pouchOptions = Object.assign({
      auto_compaction: true
    }, pouchOptions)
    this.pouch = pouch || new PouchDB(pouchPath, pouchOptions)
    // set event handlers
    this.on('change', this.onHyperChange.bind(this))
  }

  async ready () {
    if (this._ready) return
    return new Promise((resolve) => {
      this.hyper.ready(() => {
        // configure the swarm
        this.swarm = this.createSwarm({
          id: this.hyper.local.key
        })
        this.swarm.on('connection', (peer) => {
          this.emit('connection', peer)
        })
        // configure the watcher
        this.watcher = this.hyper.watch(() => {
          this.emit('change', this.watcher._nodes)
        })
        // now we are ready
        this._ready = true
        return resolve()
      })
    })
  }

  createSwarm (options = {}) {
    return discovery(swarmDefaults(options))
  }

  get key () {
    return this.hyper.key
  }

  async get (id, options = {}) {
    // pouch is the authority
    return this.pouch.get(id, options)
  }

  async put (doc, options = {}) {
    // get the necessary _rev
    if (doc._id) {
      // retrieve current rev
      try {
        const oldDoc = await this.pouch.get(doc._id)
        doc._rev = oldDoc._rev
      } catch (e) {
        if (e.name !== 'not_found') {
          throw e
        }
      }
      // update pouch
      await this.pouch.put(doc, options)
    } else {
      // let db create an id
      await this.pouch.post(doc, options)
    }
    // then, update hyperdb
    return new Promise((resolve, reject) => {
      const cb = cbify(resolve, reject)
      this.hyper.put(doc._id, doc, cb)
    })
  }

  async hyperPut (doc) {
    await new Promise((resolve, reject) => {
      const cb = cbify(resolve, reject)
      this.hyper.put(doc._id, doc, cb)
    })
    await this.onHyperChange([{
      key: doc._id,
      value: doc
    }])
  }

  async del (id, options = {}) {
    if (typeof id === 'object') id = id._id
    const doc = await this.pouch.get(id)
    await this.pouch.remove(doc)
    if (options.soft) {
      // if soft:truthy use hyperdb's delta deletion
      return new Promise((resolve, reject) => {
        const cb = cbify(resolve, reject)
        this.hyper.del(id, cb)
      })
    } else {
      // else, regenerate archive
      await this.regenerate()
    }
  }

  async batch (docs, options = {}) {
    await this.pouchPath(docs, options)
    await this.hyperBatch(docs)
  }

  async pouchBatch (docs, options = {}) {
    // get proper revs for each doc, since we do the same in .put
    const tasks = docs.map(async (doc) => {
      if (!doc._rev) {
        try {
          const oldDoc = await this.pouch.get(doc._id)
          doc._rev = oldDoc._rev
          return doc
        } catch (e) {
          if (e.name === 'not_found') {
            return doc
          } else {
            throw e
          }
        }
      } else {
        return doc
      }
    })
    docs = await Promise.all(tasks)
    docs = docs.filter((doc) => { return !!doc })
    // update pouch
    return this.pouch.bulkDocs(docs, options)
  }

  async hyperBatch (docs) {
    // map .pouch.bulkDocs payload for .hyper.batch
    const batch = docs.map((doc) => {
      return {
        type: doc._deleted ? 'del' : 'put',
        key: doc._id,
        value: doc
      }
    })
    // update hyper
    return new Promise((resolve, reject) => {
      const cb = cbify(resolve, reject)
      this.hyper.batch(batch, cb)
    })
  }

  // join the swarm for this hyperdb instance
  async join (options = {}) {
    await this.ready()
    return new Promise((resolve, reject) => {
      const cb = cbify(resolve, reject)
      const { discoveryKey } = this.hyper
      this.swarm.join(discoveryKey, options, cb)
    })
  }

  // abandon the swarm
  async leave () {
    await this.ready()
    if (this.swarm._discovery && this.swarm.address()) {
      this.swarm.leave(this.hyper.discoveryKey)
    }
    return new Promise((resolve, reject) => {
      const cb = cbify(resolve, reject)
      this.swarm.destroy(cb)
    })
  }

  // abandon the swarm
  // close metadata feeds
  async close () {
    await this.leave()
    const closeFeeds = this.hyper.feeds.map((feed) => {
      return new Promise((resolve, reject) => {
        const cb = cbify(resolve, reject)
        feed.close(cb)
      })
    })
    await Promise.all(closeFeeds)
  }

  // abandon the swarm
  // close metadata feeds
  // destroy feeds
  async destroyHyper () {
    await this.close()
    this.hyper.feeds.forEach((feed) => {
      feed.undownload()
    })
  }

  // destroy pouch
  async destroyPouch () {
    await this.pouch.destroy()
  }

  // abandon the swarm
  // close metadata feeds
  // destroy hyper + pouch
  async destroy () {
    await this.destroyHyper()
    await this.destroyPouch()
  }

  async regenerate (options = {}) {
    // quit swarm and wipe metadata
    await this.destroyHyper()
    // create a new hyperdb with the same opts
    this.hyper = new this.HyperDB(this.hyperStorage, this.hyperOptions)
    // populate new hyperdb from latest docs / subset thereof
    const {
      find,
      query
    } = options
    const queryOptions = Object.assign({}, options.options || {}, { include_docs: true })
    let docs
    if (query) {
      const { rows } = await this.pouch.query(query, queryOptions)
      docs = rows.map(({ doc }) => { return doc })
    } else if (find) {
      const result = await this.pouch.find(find)
      docs = result.docs
    } else {
      const { rows } = await this.pouch.allDocs(queryOptions)
      docs = rows.map(({ doc }) => { return doc })
    }
    await this.hyperBatch(docs)
    this._ready = false
    this.emit('regeneration')
  }

  async onHyperChange (nodes) {
    // map and dedupe changes from hyper to pouch
    let leftovers = []
    const docs = []
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i]
      const doc = await this.mapHyperChange(node)
      const ok = await this.filterHyperChange(doc)
      if (ok) {
        if (!doc._rev) {
          leftovers.push(doc)
        } else {
          docs.push(doc)
        }
      }
    }
    // add remote update to pouch
    if (docs.length || leftovers.length) {
      try {
        if (docs.length) {
          await this.pouchBatch(docs, { new_edits: false })
          const keys = docs.map(({ _id }) => { return _id })
          const { rows } = await this.pouch.allDocs({ keys, include_docs: true })
          const existingKeys = rows.map(({ doc }) => { return doc._id })
          leftovers = leftovers.concat(docs.filter(({ _id }) => {
            return !(existingKeys.includes(_id))
          }))
        }
        if (leftovers.length) {
          await this.pouchBatch(leftovers)
        }
      } catch (e) {
        throw e
      }
    }
  }

  async mapHyperChange (node) {
    const { key, value } = node
    try {
      const doc = await this.pouch.get(key)
      if (value && !isEqual(doc, value)) {
        return value
      }
    } catch (e) {
      if (e.name !== 'not_found') throw e
      return value
    }
  }

  // default filter. just checks for truthiness & id
  async filterHyperChange (doc) {
    return !!(!!doc && (doc !== null) && doc._id)
  }
}
