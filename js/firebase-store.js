;(function(exports) {
	'use strict'

	function Store(name) {
		var self = this

		self._events = {}
		self._dbName = name
		self._status = {}

		const config = {
			apiKey: "AIzaSyBLT3WLjFbEtHIQ5aAuk7E1_8l5l9Tc87M",
			authDomain: "test-projects-13910.firebaseapp.com",
			databaseURL: "https://test-projects-13910.firebaseio.com",
			projectId: "test-projects-13910",
			storageBucket: "",
			messagingSenderId: "20697715442"
		}

		self.app = firebase.initializeApp(config, firebase.apps.length ? 'app' + firebase.apps.length : undefined)
		self.db = self.app.database().ref(name)

		self.updateStatus({})

		self.authenticated = false

		self.app.auth().onAuthStateChanged(function(user) {
			self.authenticated = !!user
			self.emit('authChange', self.authenticated)
		}, function(err) {
			console.error('onAuthStateChanged error', err)
		})

		self._promise = Promise.resolve()

		self.app.database().ref('.info/connected').on('value', function(snapshot) {
			self.updateStatus({
				online: snapshot.val()
			})
		})

		self.db.on('value', function(snapshot) {
			if (self._status.storing) {
				return
			}

			var data = snapshot.val()

			if (self.isNewData(data)) {
				self.updateData(data)
			}
		})
	}

	Store.prototype.on = function(event, listener) {
		this._events[event] = this._events[event] || []
		this._events[event].push(listener)
	}

	Store.prototype.emit = function(event, data) {
		if (this._events[event]) {
			this._events[event].forEach(function(cb) {
				cb(data)
			})
		}
	}

	Store.prototype.load = function() {
		var self = this

		if (self._status.loading) {
			return Promise.resolve()
		}

		self._promise = self._promise.then(fetch)

		var storageData = self.storageGet('data')

		if (storageData) {
			self.data = storageData

			self._promise.then(function(data) {
				if (self.isNewData(data)) {
					return self.updateData(data)
				}

				if (self.storageGet('modified')) {
					return self.store(self.storageGet('data'))
				}
			})

			return Promise.resolve(storageData)
		}

		return self._promise.then(function(data) {
			self.data = data
			self.storageSet('data', data)
			self.storageSet('modified', false)
			return data
		})

		function fetch() {
			self.updateStatus({
				loading: true
			})

			return helper().then(function(snapshot) {
				self.updateStatus({
					loading: false
				})

				return snapshot.val() || {}
			})
		}

		function helper() {
			return self.db.once('value').catch(function(err) {
				if (err.status === 0) {
					return delay(5000).then(helper)
				}
				return Promise.reject(err)
			})
		}
	}

	Store.prototype.store = function(data) {
		var self = this

		self.storageSet('data', data)
		self.storageSet('modified', true)

		self.saveData = Object.assign({}, data, {
			_rev: (this.data && Number.isInteger(this.data._rev)) ? this.data._rev + 1 : 1
		})

		if (self._status.storing) {
			return Promise.resolve()
		}

		self.updateStatus({
			storing: true
		})

		self._promise = self._promise.then(function() {
			return helper()
		})

		function helper() {
			var helperData = self.saveData

			return self.db.transaction(function(currentData) {
				if (self.saveData) {
					helperData = self.saveData
					delete self.saveData
				}
				
				if (currentData && currentData._rev && (!helperData || currentData._rev >= helperData._rev)) {
					
					self.updateData(currentData)
					return currentData
				}

				return helperData
			}).then(function(response) {
				var val = response.snapshot.val()

				if (self.saveData) {
					self.saveData._rev = val._rev + 1
					return helper()
				}

				self.data = val
				self.storageSet('data', val)
				self.storageSet('modified', false)
				
				self.updateStatus({
					storing: false
				})

			}).catch(function(err) {
				if (err.status === 0) {
					return delay(5000).then(helper)
				}

				return Promise.reject(err)
			})
		}
	}

	Store.prototype.updateData = function(data) {
		var self = this

		if (!data) {
			return
		}

		self.data = data
		self.storageSet('data', data)
		self.storageSet('modified', false)

		self.emit('dataChange', data)
	}

	Store.prototype.updateStatus = function(obj) {
		// 0: Offline
		// 1: Up to date
		// 2: Loading
		// 3: Storing

		Object.assign(this._status, obj)

		var status = 0

		if (this._status.online) {
			status = 1

			if (this._status.storing) {
				status = 3
			}

			if (this._status.loading) {
				status = 2
			}
		}

		if (this.status === status) {
			return
		}

		this.status = status
		this.emit('statusChange', status)
	}

	Store.prototype.login = function() {
		var provider = new firebase.auth.GoogleAuthProvider()

		return this.app.auth().signInWithPopup(provider).catch(function(err) {
			console.error('Login error', err)
		})
	}

	Store.prototype.logout = function() {
		return this.app.auth().signOut().catch(function(err) {
			console.error('Logout error', err)
		})
	}

	// localStorage

	Store.prototype.storageSet = function(key, value) {
		try {
			window.localStorage[this._dbName + '-' + key] = JSON.stringify(value)
		} catch (err) {}
	}

	Store.prototype.storageGet = function(key) {
		try {
			return JSON.parse(window.localStorage[this._dbName + '-' + key])
		} catch (err) {}
	}

	// Helpers

	Store.prototype.isNewData = function(data) {
		if (!this.data || !Number.isInteger(this.data._rev)) {
			return true
		}
		if (!data || !Number.isInteger(data._rev)) {
			return false
		}
		return this.data._rev < data._rev
	}

	function delay (ms) {
		return new Promise(function(resolve) {
			setTimeout(resolve, ms)
		})
	}

	exports.FirebaseStore = Store
})(window)
