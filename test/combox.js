/* global describe, before, after, it */
'use strict'

const assert = require('assert')
const {
  ComBox
} = require('..')

describe('combox', function () {
  before(function () {
    this.archive = new ComBox() // TODO options
  })

  after(async function () {
    await this.archive.destroy()
  })

  it('ready', async function () {
    assert(!this.archive.swarm)
    await this.archive.ready()
    assert(this.archive.swarm)
  })

  it.skip('join', async function () {
    this.timeout(10000)
    await this.archive.join()
  })

  it('put / get', async function () {
    await this.archive.put({ _id: 'hello', hello: 'world' })
    await this.archive.put({ _id: 'hello', hello: 'sol' })
    const { hello } = await this.archive.get('hello')
    assert.equal(hello, 'sol')
  })

  it('regenerate', async function () {
    const key1 = this.archive.hyper.discoveryKey.toString('hex')
    await this.archive.regenerate()
    const key2 = this.archive.hyper.discoveryKey.toString('hex')
    assert.notEqual(key1, key2)
  })

  it('del, soft', async function () {
    const doc = { _id: 'goodnight', goodnight: 'moon' }
    await this.archive.put(doc)
    await this.archive.del(doc, { soft: true })
    try {
      await this.archive.get(doc._id)
      throw new Error('Document should not exist.')
    } catch (e) {
      if (e.name !== 'not_found') {
        throw e
      }
    }
    const nodes = await this.archive.hyper.get(doc._id)
    assert.equal(nodes, undefined)
  })

  it('del', async function () {
    const doc = { _id: 'greetings', goodnight: 'friend' }
    await this.archive.put(doc)
    await this.archive.del(doc)
    try {
      await this.archive.get(doc._id)
      throw new Error('Document should not exist.')
    } catch (e) {
      if (e.name !== 'not_found') {
        throw e
      }
    }
  })

  it('hyper sync', async function () {
    await this.archive.ready()
    const doc = {
      ok: true,
      _id: '62aee515cf5b609c24b12e82aa000bb2',
      _rev: '1-967a00dff5e02add41819138abb3284d'
    }
    try {
      await this.archive.hyperPut(doc)
      const dbDoc = await this.archive.get(doc._id)
      assert.equal(dbDoc._id, doc._id)
      assert.equal(dbDoc._rev, doc._rev)
    } catch (err) {
      throw err
    }
  })
})
