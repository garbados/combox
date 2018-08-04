/* global describe, before, after, it */
'use strict'

const assert = require('assert')
const {
  Directory
} = require('..')

// watch for unhandled promises
process.on('unhandledRejection', (error) => {
  console.error(error)
  process.exit(1)
})

describe('directory', function () {
  before(async function () {
    this.directory = new Directory({ pouchPath: '.comdir' })
    await this.directory.ready()
  })

  after(async function () {
    try {
      await this.directory.destroy()
    } catch (err) {
      console.trace(err)
      throw err
    }
  })

  it('should 404 on boxes that do not exist', async function () {
    try {
      await this.directory.getBox('fake-box')
    } catch (err) {
      if (err.message !== 'not_found') {
        throw err
      }
    }
  })

  it('should add a box', async function () {
    await this.directory.putBox('hello-world', {
      boxOptions: {
        pouchPath: '.comdir-box'
      }
    })
    const box = await this.directory.getBox('hello-world')
    assert(box.key)
    const doc = await this.directory.get('hello-world')
    const boxKey = box.key.toString('utf8')
    const docKey = Buffer.from(doc.key).toString('utf8')
    assert.equal(boxKey, docKey)
  })

  it('should enforce unique keys between inboxes and boxes', async function () {
    try {
      await this.directory.putInbox('hello-world', {
        boxOptions: {
          pouchPath: '.comdir-box'
        }
      })
      throw new Error('Should fail.')
    } catch (err) {
      if (err.message !== 'conflict') {
        throw err
      }
    }
  })

  it('should add an inbox', async function () {
    await this.directory.putInbox('hello-world-2', {
      boxOptions: {
        pouchPath: '.comdir-box-2'
      }
    })
    const box = await this.directory.getInbox('hello-world-2')
    assert(box.key)
    const doc = await this.directory.get('hello-world-2')
    const boxKey = box.key.toString('utf8')
    const docKey = Buffer.from(doc.key).toString('utf8')
    assert.equal(boxKey, docKey)
  })

  it('should delete a box', async function () {
    await this.directory.putBox('hello-world-3', {
      boxOptions: {
        pouchPath: '.comdir-box-3'
      }
    })
    await this.directory.delBox('hello-world-3')
  })

  it('should delete an inbox', async function () {
    await this.directory.putInbox('hello-world-4', {
      boxOptions: {
        pouchPath: '.comdir-box-4'
      }
    })
    await this.directory.delInbox('hello-world-4')
  })

  it('should error on boxes that do not exist', async function () {
    try {
      await this.directory.delBox('fake-box')
    } catch (err) {
      if (err.message !== 'not_found') {
        throw err
      }
    }
  })

  it('should update links when archives regenerate', async function () {
    this.timeout(0)
    await this.directory.putInbox('hello-world-5', {
      boxOptions: {
        pouchPath: '.comdir-box-5'
      }
    })
    const box = await this.directory.getInbox('hello-world-5')
    const oldKey = box.key
    await box.regenerate()
    return new Promise((resolve, reject) => {
      this.directory.on('regeneration', async (key) => {
        try {
          const newBox = await this.directory.getInbox(key)
          const newKey = newBox.key
          assert(oldKey)
          assert(newKey)
          assert.notEqual(oldKey, newKey)
          return resolve()
        } catch (err) {
          console.log(err)
          return reject(err)
        }
      })
      this.directory.on('error', (err) => {
        return reject(err)
      })
    })
  })
})
