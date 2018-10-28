/* global describe, it, before, after */

const assert = require('assert')
const DatArchive = require('node-dat-archive')
const PouchDB = require('pouchdb')
const rimraf = require('rimraf')
PouchDB.plugin(require('.'))

describe('combox', function () {
  before(async function () {
    this.db = new PouchDB('.combox-db')
    await this.db.setupDatArchive({
      DatArchive,
      options: {
        localPath: '.combox-archive'
      }
    })
  })

  after(async function () {
    await this.db.destroy()
    rimraf.sync('.combox-archive')
  })

  describe('failures', function () {
    before(async function () {
      this.db2 = new PouchDB('.combox-db-2')
    })

    after(async function () {
      await this.db2.destroy()
    })

    it('should fail if it cannot find DatArchive', async function () {
      try {
        await this.db2.setupDatArchive()
        throw new Error('Should not be able to setup.')
      } catch (error) {
        assert.strictEqual(error.message, 'Could not find DatArchive. Run in Beaker or use node-dat-archive.')
      }
    })
  })

  it('should create a doc', async function () {
    await this.db.put({ _id: 'a' })
    const docString = await this.db.archive.readFile('/docs/a.json', 'utf-8')
    const doc = JSON.parse(docString)
    assert.strictEqual(doc._id, 'a')
  })

  it('should update a doc', async function () {
    const doc = await this.db.get('a')
    doc.hello = 'world'
    await this.db.put(doc)
    const docString = await this.db.archive.readFile('/docs/a.json', 'utf-8')
    const newDoc = JSON.parse(docString)
    assert.strictEqual(newDoc.hello, 'world')
  })

  it('should delete a doc', async function () {
    const doc = await this.db.get('a')
    await this.db.remove(doc)
    try {
      await this.db.archive.readFile('/docs/a.json', 'utf-8')
      throw new Error('Should not read successfully!')
    } catch (error) {
      assert.strictEqual(error.message, 'File not found')
    }
  })

  // TODO regeneration spec, protocol
  // it.skip('should regenerate OK', async function () {
  //   await this.db.put({ _id: 'b' })
  //   const originalUrl = this.db.archive.url
  //   const originalLocalPath = this.db.archive._localPath
  //   const originalDocs = await this.db.archive.readdir('/docs')
  //   await this.db.regenerate()
  //   assert.notStrictEqual(originalUrl, this.db.archive.url)
  //   const newDocs = await this.db.archive.readdir('/docs')
  //   assert.strictEqual(originalDocs.length, newDocs.length)
  //   assert.strictEqual(originalLocalPath, this.db.archive._localPath)
  //   // prove you can write to it ok
  //   await this.db.put({ _id: 'c' })
  //   const newNewDocs = await this.db.archive.readdir('/docs')
  //   assert.strictEqual(newNewDocs.length, originalDocs.length + 1)
  //   // TODO test link setting; currently cannot due to discrependency in node-dat-archive
  //   // FIXME: merge https://github.com/beakerbrowser/node-dat-archive/pull/10
  // })

  describe('read-only archives', function () {
    before(async function () {
      this.db2 = new PouchDB('.combox-db-2')
      await this.db2.setupDatArchive({
        url: this.db.archive.url,
        DatArchive,
        options: {
          latest: true,
          localPath: '.combox-archive-2'
        }
      })
    })

    after(async function () {
      await this.db2.destroy()
      rimraf.sync('.combox-archive-2')
    })

    it('should follow changes', async function () {
      await this.db.put({ _id: 'x' })
      await new Promise((resolve, reject) => {
        const changes = this.db2.changes({ live: true, since: 0 })
          .on('change', ({ id }) => {
            if (id === 'x') {
              changes.cancel()
              return resolve()
            }
          })
          .on('error', (error) => {
            return reject(error)
          })
      })
      await this.db2.get('x') // will fail if it doesn't exist
    })

    // TODO block writes when lacking write access? :thinking:
    it('should block local changes while following a remote', async function () {
      try {
        await this.db2.put({ _id: 'd' })
        throw new Error('File should not have been written.')
      } catch (error) {
        assert.strictEqual(error.message, 'Cannot write to archive without write access.')
      }
    })

    // it.skip('should retain write access after regeneration', async function () {
    //   const oldUrl = this.db.archive.url
    //   await this.db.regenerate()
    //   const newUrl = this.db.archive.url
    //   await this.db.put({ _id: 'e' })
    //   await this.db.archive.readFile('/docs/e.json') // will fail if it doesn't exist
    //   assert.strictEqual(this.db2.archive.url, newUrl)
    // })

    // it.skip('followers should re-initialize upon detecting a regeneration', async function () {
    //   const oldUrl = this.db.archive.url
    //   await this.db.regenerate()
    //   const newUrl = this.db.archive.url
    //   assert.notStrictEqual(oldUrl, newUrl)
    //   assert.strictEqual(this.db2.archive.url, newUrl)
    // })

    // it.skip('should not gain write access after regeneration', async function () {
    //   try {
    //     await this.db2.regenerate()
    //   } catch (error) {
    //     if (error.name !== 'ArchiveNotWritableError') {
    //       throw error
    //     }
    //   }
    // })
  })
})
