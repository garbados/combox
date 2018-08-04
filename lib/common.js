'use strict'

exports.cbify = function cbify (resolve, reject) {
  return function (err, result) {
    if (err) return reject(err)
    return resolve(result)
  }
}
