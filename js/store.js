/*jshint eqeqeq:false */
(function (window) {
	'use strict';

	/**
	 * Creates a new client side storage object and will create an empty
	 * collection if no collection already exists.
	 *
	 * @param {string} name The name of our DB we want to use
	 * @param {function} callback Our fake DB uses callbacks because in
	 * real life you probably would be making AJAX calls
	 */
	function Store(name, callback) {
		callback = callback || function () {};

		FirebaseStore.call(this, name);
	}

	Store.prototype = Object.create(FirebaseStore.prototype);
	Store.prototype.constructor = Store;

	/**
	 * Finds items based on a query given as a JS object
	 *
	 * @param {object} query The query to match against (i.e. {foo: 'bar'})
	 * @param {function} callback	 The callback to fire when the query has
	 * completed running
	 *
	 * @example
	 * db.find({foo: 'bar', hello: 'world'}, function (data) {
	 *	 // data will return any items that have foo: bar and
	 *	 // hello: world in their properties
	 * });
	 */
	Store.prototype.find = function (query, callback) {
		var self = this

		if (!callback) {
			return;
		}

		self.getData().then(function(data) {
			var todos = data.todos;

			callback.call(self, todos.filter(function (todo) {
				for (var q in query) {
					if (query[q] !== todo[q]) {
						return false;
					}
				}
				return true;
			}));
		});
	};

	/**
	 * Will retrieve all data from the collection
	 *
	 * @param {function} callback The callback to fire upon retrieving data
	 */
	Store.prototype.findAll = function (callback) {
		var self = this;

		callback = callback || function () {};

		self.getData().then(function(data) {
			callback.call(self, data.todos);
		});
	};

	/**
	 * Will save the given data to the DB. If no item exists it will create a new
	 * item, otherwise it'll simply update an existing item's properties
	 *
	 * @param {object} updateData The data to save back into the DB
	 * @param {function} callback The callback to fire after saving
	 * @param {number} id An optional param to enter an ID of an item to update
	 */
	Store.prototype.save = function (updateData, callback, id) {
		var self = this;

		callback = callback || function () {};

		var todos = self.data.todos;

		// If an ID was actually given, find the item and update each property
		if (id) {
			for (var i = 0; i < todos.length; i++) {
				if (todos[i].id === id) {
					for (var key in updateData) {
						todos[i][key] = updateData[key];
					}
					break;
				}
			}

			self.store(self.data);
			callback.call(self, todos);
		} else {
			// Generate an ID
			updateData.id = new Date().getTime();

			todos.push(updateData);
			self.store(self.data);
			callback.call(self, [updateData]);
		}
	}

	/**
	 * Will remove an item from the Store based on its ID
	 *
	 * @param {number} id The ID of the item you want to remove
	 * @param {function} callback The callback to fire after saving
	 */
	Store.prototype.remove = function (id, callback) {
		var self = this;

		callback = callback || function () {};

		var todos = self.data.todos;

		for (var i = 0; i < todos.length; i++) {
			if (todos[i].id == id) {
				todos.splice(i, 1);
				break;
			}
		}

		self.store(self.data);
		callback.call(this, todos);
	};

	/**
	 * Will drop all storage and start fresh
	 *
	 * @param {function} callback The callback to fire after dropping the data
	 */
	Store.prototype.drop = function (callback) {
		this.data = {todos: []};
		self.store(this.data);
		callback.call(this, this.data.todos);
	};

	Store.prototype.getData = function() {
		var self = this;

		if (self.data) {
			return Promise.resolve(self.data);
		}

		return self.load().then(function(data) {
			if (!data || !data.todos) {
				data = {
					todos: []
				}
			}

			self.data = data;
			return data;
		})
	}

	// Export to window
	window.app = window.app || {};
	window.app.Store = Store;
})(window);
