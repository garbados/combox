async function setupDatArchive (options = {}) {
  const {
    url: datUrl,
    DatArchive: CustomDatArchive,
    options: datOptions,
    archive
  } = options
  // set this.DatArchive
  if (CustomDatArchive) {
    this.DatArchive = CustomDatArchive
  } else {
    try {
      this.DatArchive = window.DatArchive
    } catch (error) {
      if (error.message === 'window is not defined') {
        throw new Error('Could not find DatArchive. Run in Beaker or use node-dat-archive.')
      } else {
        throw error
      }
    }
  }
  // set this.archive
  this._datOptions = datOptions || {}
  if (archive) {
    this.archive = archive
  } else if (datUrl) {
    this.archive = new this.DatArchive(datUrl, datOptions)
    await this.archive._loadPromise
  } else {
    try {
      this.archive = await this.DatArchive.create(datOptions)
    } catch (error) {
      const { message } = error
      if (message === 'Cannot create Dat archive. (The target folder is not empty.)') {
        this.archive = await this.DatArchive.load(datOptions)
      } else {
        throw error
      }
    }
  }
  // initialize the archive
  await initDatArchive.call(this)
  // attach methods
  // this.regenerate = regenerate.bind(this)
  const bulkDocs = this.bulkDocs
  this.bulkDocs = wrapBulkDocs(bulkDocs).bind(this)
  const destroy = this.destroy
  this.destroy = wrapDestroy(destroy).bind(this)
}

async function initDatArchive () {
  const { isOwner } = await this.archive.getInfo()
  try {
    if (isOwner) await this.archive.mkdir('/docs')
  } catch (error) {
    if (error.message !== 'Cannot overwrite files or folders') {
      throw error
    }
  }
  // map from /docs/*.json to bulkDocs
  const fileNames = await this.archive.readdir('/docs')
  for (let fileName of fileNames) {
    const docString = await this.archive.readFile(`/docs/${fileName}`, 'utf-8')
    const doc = JSON.parse(docString)
    await this.bulkDocs([doc], { new_edits: false })
  }
  if (isOwner) {
    // map from allDocs to /docs/*.json
    const { rows } = await this.allDocs()
    for (let { id } of rows) {
      const doc = await this.get(id)
      await this.archive.writeFile(`/docs/${id}.json`, JSON.stringify(doc), 'utf-8')
    }
  }
  // apply observer to apply new changes
  this.docsObserver = this.archive.watch('/docs/*.json', async ({ path }) => {
    // download and apply change
    try {
      const docString = await this.archive.readFile(path, 'utf-8')
      const doc = JSON.parse(docString)
      await this.bulkDocs([doc], { new_edits: false })
    } catch (error) {
      if (error.message === 'File not found') {
        // file was deleted; try deleting it
        const id = path.match(/\/docs\/(.+).json/)[1]
        try {
          const doc = await this.get(id)
          await this.remove(doc)
        } catch (error) {
          if (error.message !== 'missing') {
            throw error
          }
        }
      } else {
        throw error
      }
    }
  })
  // // apply config file observers to track for next and prev links
  // this.linksObserver = this.archive.watch('/dat.json', async ({ path }) => {
  //   const info = await this.archive.getInfo()
  //   try {
  //     const { links: { next: [ { href } ] } } = info
  //     if (this.archive._close) {
  //       try {
  //         await this.archive._close()
  //       } catch (error) {
  //         if (error.message !== 'Dat is already closed') {
  //           throw error
  //         }
  //       }
  //     }
  //     await this.docsObserver.close()
  //     await this.linksObserver.close()
  //     await rmArchive.call(this)
  //     delete this.archive
  //     await this.setupDatArchive({
  //       DatArchive: this.DatArchive,
  //       options: this._datOptions,
  //       url: href
  //     })
  //   } catch (error) {
  //     throw error
  //   }
  // })
}

function wrapBulkDocs (bulkDocs) {
  return async function (docs, options = {}, callback) {
    let isOwner = true
    if (this.archive) {
      const archiveInfo = await this.archive.getInfo()
      isOwner = archiveInfo.isOwner
    }
    if (!isOwner && (options.new_edits !== false)) {
      const error = new Error('Cannot write to archive without write access.')
      if (callback) return callback(error)
      else throw error
    }
    try {
      const results = await bulkDocs(docs, options)
      const docIds = results.map(({ id }) => { return id })
      // filter down to the IDs for changes that actually went through
      const changes = ((docs && docs.docs) || docs).filter(({ _id }) => {
        return docIds.includes(_id)
      })
      // process changes
      if (this.archive) {
        // it's possible for the archive observer to process a change as the archive is being torn down
        // so if the archive is missing, we shouldn't try to update it.
        const { isOwner } = await this.archive.getInfo()
        if (isOwner) {
          for (let { _id: id, _deleted: deleted } of changes) {
            if (deleted) {
              await this.archive.unlink(`/docs/${id}.json`)
            } else {
              const doc = await this.get(id)
              await this.archive.writeFile(`/docs/${id}.json`, JSON.stringify(doc), 'utf-8')
            }
          }
        }
      }
      if (callback) callback(null, results)
      return results
    } catch (error) {
      if (callback) return callback(error)
      throw error
    }
  }
}

async function rmArchive () {
  // if node, remove source folder; else, remove from network
  const localPath = this.archive._localPath
  if (localPath) {
    // TODO determine if these imports will end up in client-side bundle
    const fs = require('fs')
    const path = require('path')
    const fileNames = fs.readdirSync(localPath)
    for (let fileName of fileNames) {
      fs.unlinkSync(path.join(localPath, fileName))
    }
    fs.rmdirSync(localPath)
  } else {
    await this.DatArchive.unlink(this.archive.url)
  }
}

function wrapDestroy (destroy) {
  return async function (options = {}, callback) {
    try {
      if (this.archive._close) {
        await this.archive._close()
      }
      await this.docsObserver.close()
      await rmArchive.call(this)
      await destroy(options)
      if (callback) callback()
    } catch (error) {
      if (callback) return callback(error)
      throw error
    }
  }
}

// TODO regeneration spec, protocol
// async function regenerate () {
//   const {
//     description,
//     links,
//     title,
//     type
//   } = await this.archive.getInfo()
//   // recreate archive
//   const newArchive = await this.DatArchive.create({
//     description,
//     title,
//     type
//   })
//   const oldArchive = this.archive
//   // update archives with links
//   await newArchive.configure({
//     links: {
//       prev: [{ href: this.archive.url }],
//       ...links
//     }
//   })
//   await this.archive.configure({
//     links: {
//       next: [{ href: newArchive.url }],
//       ...links
//     }
//   })
//   // close archives
//   if (this.archive._close) { await this.archive._close() }
//   await this.docsObserver.close()
//   delete this.docsObserver
//   await this.linksObserver.close()
//   delete this.linksObserver
//   const localPath = this.archive._localPath
//   await rmArchive.call(this)
//   // gc archive
//   delete this.archive
//   if (localPath) {
//     const localArchive = new this.DatArchive(newArchive.url, {
//       localPath,
//       latest: true,
//       datOptions: {
//         secretKey: newArchive._archive.metadata.secretKey
//       }
//     })
//     await localArchive._loadPromise
//     await newArchive._close()
//     this.archive = localArchive
//   } else {
//     this.archive = newArchive
//   }
//   // repopulate archive
//   await initDatArchive.call(this)
// }

module.exports = function (PouchDB) {
  PouchDB.prototype.setupDatArchive = setupDatArchive
}
