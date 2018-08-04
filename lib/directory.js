'use strict'

const ComBox = require('./combox')
const Inbox = require('./inbox')

module.exports = class Directory extends ComBox {
  constructor (options = {}) {
    super(options)
    this.boxes = {}
    this.inboxes = {}
  }

  async ready () {
    await super.ready()
    // TODO restore boxes from DB
  }

  async getBox (key, options = {}) {
    let { type } = options
    let box
    if (type === 'inbox') {
      box = this.inboxes[key]
    } else {
      box = this.boxes[key]
    }
    if (box) return box
    throw new Error('not_found')
  }

  async getInbox (key, options = {}) {
    options.type = 'inbox'
    return this.getBox(key, options)
  }

  async putBox (key, options = {}) {
    let { type, box, boxOptions } = options
    boxOptions = boxOptions || {}
    if (this.boxes[key] && type === 'inbox') throw new Error('conflict')
    if (this.inboxes[key] && type !== 'inbox') throw new Error('conflict')
    if (!box) {
      if (type === 'inbox') {
        if (this.inboxes[key]) await this.inboxes[key].destroyHyper()
        delete this.inboxes[key]
        box = new Inbox(boxOptions)
        this.inboxes[key] = box
      } else {
        if (this.boxes[key]) await this.boxes[key].destroyHyper()
        box = new ComBox(boxOptions)
        this.boxes[key] = box
      }
    }
    await box.ready()
    const doc = { _id: key, key: box.key, type }
    await this.put(doc)
    box.on('regeneration', async () => {
      const oldDoc = await this.get(key)
      doc._rev = oldDoc._rev
      doc.key = box.key
      await this.put(doc)
      await box.ready()
      this.emit('regeneration', key)
    })
  }

  async putInbox (key, options = {}) {
    options.type = 'inbox'
    await this.putBox(key, options)
  }

  async delBox (key, options = {}) {
    const { type } = options
    let box
    if (type === 'inbox') {
      box = this.inboxes[key]
      delete this.inboxes[key]
    } else {
      box = this.boxes[key]
      delete this.boxes[key]
    }
    if (!box) {
      throw new Error('not_found')
    } else {
      await box.destroy()
    }
  }

  async delInbox (key) {
    await this.delBox(key, { type: 'inbox' })
  }

  async destroy () {
    await Object.keys(this.boxes).map((key) => {
      return this.boxes[key].destroy()
    }).reduce((a, b) => {
      return a.then(b)
    }, Promise.resolve())
    await Object.keys(this.inboxes).map((key) => {
      return this.inboxes[key].destroy()
    }).reduce((a, b) => {
      return a.then(b)
    }, Promise.resolve())
    await super.destroy()
  }
}
