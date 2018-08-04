/* global describe, before, after, it */
'use strict'

const assert = require('assert')
const {
  Inbox
} = require('..')

// watch for unhandled promises
process.on('unhandledRejection', (error) => {
  console.error(error)
  process.exit(1)
})

describe('inbox', function () {
  before(async function () {
    this.inbox = new Inbox()
    await this.inbox.ready()
    const { key } = this.inbox.hyper
    this.inbox2 = new Inbox({ key, pouchPath: '.combox-2' })
    await this.inbox2.ready()
  })

  after(async function () {
    await this.inbox.destroy()
    await this.inbox2.destroy()
  })

  it('should connect ok', async function () {
    this.timeout(30 * 1000)
    await this.inbox.join()
    await this.inbox2.join()
    assert.equal(1, this.inbox.swarm.connected)
    assert.equal(1, this.inbox2.swarm.connected)
  })

  it('should share between inboxes ok', async function () {
    this.timeout(5 * 1000)
    try {
      await this.inbox2.put({ _id: 'hello', hello: 'world' })
      await new Promise((resolve) => { setTimeout(resolve, 2 * 1000) })
      const doc = await this.inbox.get('hello')
      assert.equal('hello', doc._id)
      assert.equal('world', doc.hello)
    } catch (err) {
      console.log(err)
      throw err
    }
  })
})
