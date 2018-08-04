'use strict'

const { cbify } = require('./common')
const ComBox = require('./combox')

module.exports = class Inbox extends ComBox {
  constructor (options = {}) {
    super(options)
    this.on('connection', this.onConnection.bind(this))
  }

  async onConnection (peer) {
    // get key or quit early
    if (!peer.remoteUserData) return
    try { var data = JSON.parse(peer.remoteUserData.toString('utf8')) } catch (err) { return }
    const key = Buffer.from(data.key)
    // helper to check if key is already authorized as a writer
    const isAuthorized = async () => {
      return new Promise((resolve, reject) => {
        const cb = cbify(resolve, reject)
        this.hyper.authorized(key, cb)
      })
    }
    // helper to authorize key as a writer
    const authorize = async () => {
      return new Promise((resolve, reject) => {
        const cb = cbify(resolve, reject)
        this.hyper.authorize(key, cb)
      })
    }
    // ok, now actually do the auth dance
    const auth = await isAuthorized(key)
    if (!auth) {
      await authorize(key)
    }
  }

  createSwarm (options = {}) {
    options = Object.assign({}, options, {
      stream: (peer) => {
        return this.replicate()
      }
    })
    return super.createSwarm(options)
  }

  replicate () {
    const { key } = this.hyper.local
    return this.hyper.replicate({
      live: true,
      userData: JSON.stringify({ key })
    })
  }
}
