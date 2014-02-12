// Copyright (c) 2013 Oleg Eterevsky. Licensed under the MIT license.

// For compatibility with nodeunit.
var exports = {};
function require() { return this; }

/**
 * @constructor
 */
function Profiles() {
  /** @type {Array.<number>} */
  this.ids_ = null;
  /** @type {Object.<number, Object> */
  this.data_ = null;
  /** @type {number} */
  this.lastUsed_ = 1;
  /** @type {Object.<string, string>} */
  this.passwords_ = {};
  /** @type {string} */
  this.passwordStorage_ = 'memory';

  chrome.storage.sync.get(
      {'profile-ids': []}, this.onProfileIdsReceived_.bind(this));
  chrome.storage.sync.get(
      {'password-storage': 'memory'},
      this.onPasswordStorageReceived_.bind(this));
  chrome.storage.onChanged.addListener(this.onChanged_.bind(this));
}

/**
 * @param {Object} items
 */
Profiles.prototype.onProfileIdsReceived_ = function(items) {
  this.ids_ = items['profile-ids'];

  if (this.ids_.length === 0) {
    this.ids_ = [];
    this.data_ = {};
    this.add();
  } else {
    var ids = [];
    for (var i = 0; i < this.ids_.length; i++) {
      ids.push('profile-' + this.ids_[i]);
      ids.push('password-' + this.ids_[i]);
    }
    chrome.storage.sync.get(ids, this.onDataReceived_.bind(this));
  }
};

/**
 * @param {Object} items
 */
Profiles.prototype.onPasswordStorageReceived_ = function(items) {
  this.passwordStorage_ = items['password-storage'];
};

/**
 * @param {Object} items
 */
Profiles.prototype.onDataReceived_ = function(items) {
  var id;
  this.data_ = {};
  for (var key in items) {
    if (key.indexOf('profile-') === 0) {
      var profile = items[key];
      id = profile['id'];
      this.data_[id] = profile;
    } else if (key.indexOf('password-') === 0) {
      id = parseInt(key.substring(9), 10);
      this.passwords_[id] = items[key];
    }
  }
};

/**
 * @param {Object} items
 */
Profiles.prototype.onChanged_ = function(items) {
  var id;
  for (var key in items) {
    var value = items[key].newValue;
    switch (key) {
      case 'profile-ids':
        this.ids_ = value;
        break;

      case 'profile-last-used':
        this.lastUsed_ = value;
        break;

      case 'password-storage':
        this.passwordStorage_ = value;
        if (value === 'none')
          this.passwords_ = {};
        break;

      default:
        if (key.indexOf('profile-') === 0) {
          id = parseInt(key.substring(8), 10);
          if (value) {
            this.data_[id] = value;
          } else {
            delete this.data_[id];
          }
        } else if (key.indexOf('password-') === 0) {
          id = parseInt(key.substring(9), 10);
          this.passwords_[id] = value;
        }
    }
  }
};

/**
 * @param {number} id
 */
Profiles.prototype.store_ = function(id) {
  var items = {};
  items['profile-ids'] = this.ids_;
  if (id in this.data_)
    items['profile-' + id] = this.data_[id];
  chrome.storage.sync.set(items);
  if (!(id in this.data_))
    chrome.storage.sync.remove('profile-' + id);
};

Profiles.prototype.storeLastUsed_ = function() {
  chrome.storage.sync.set({'profile-last-used': this.lastUsed_})
};

/**
 * @return {Array.<Object>}
 */
Profiles.prototype.getAll = function() {
  var profs = [];
  for (var i = 0; i < this.ids_.length; i++) {
    profs.push(this.data_[this.ids_[i]]);
  }
  return profs;
};

/**
 * @param {number} id
 * @return {string}
 */
Profiles.prototype.getName = function(id) {
  return this.data_[id]['name'];
};

/**
 * @param {number} id
 * @return {Object}
 */
Profiles.prototype.get = function(id) {
  return this.data_[id];
};

/**
 * @return {number}
 */
Profiles.prototype.getLastUsed = function() {
  if (this.lastUsed_ in this.data_) {
    return this.lastUsed_;
  } else {
    return this.ids_[0];
  }
}

/**
 * @param {number} id
 */
Profiles.prototype.updateLastUsed = function(id) {
  if (id !== this.lastUsed_ && id in this.data_) {
    this.lastUsed_ = id;
    this.storeLastUsed_();
  }
}

/**
 * @param {number} id
 */
Profiles.prototype.deleteProfile = function(id) {
  this.ids_.splice(this.ids_.indexOf(id), 1);
  delete this.data_[id];
  this.store_(id);
  if (this.ids_.length === 0)
    this.add();
}

/**
 * @return {number}
 */
Profiles.prototype.add = function() {
  var id, name;
  var i;
  if (this.ids_.length === 0) {
    id = 1;
    name = 'Default';
    this.lastUsed_ = 1;
  } else {
    id = this.ids_[this.ids_.length - 1] + 1;
    for (i = 1;; i++) {
      var found = false;
      name = 'Profile ' + i;
      for (var key in this.data_) {
        if (this.data_[key]['name'] === name) {
          found = true;
          break;
        }
      }
      if (!found)
        break;
    }
  }

  var profile = {
      'id': id,
      'name': name,
      'hash': 'sha256',
      'custom': false,
      'char-upper': true,
      'char-lower': true,
      'char-digits': true,
      'char-symbols': true,
      'char-mix': false,
      'char-custom': 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' +
                     'abcdefghijklmnopqrstuvwxyz' +
                     '0123456789' +
                     '`~!@#$%^&*()_-+={}|[]\\:";\'<>?,./',
      'length': 8
  };
  this.ids_.push(id);
  this.data_[id] = profile;
  this.store_(id);
  this.updateLastUsed(id);
  return id;
}

/**
 * @param {Object} profile
 */
Profiles.prototype.update = function(profile) {
  this.data_[profile['id']] = profile;
  this.store_(profile['id']);
};

/**
 * @param {number} id
 */
Profiles.prototype.getPassword = function(id) {
  if (this.passwordStorage !== 'none') {
    return this.passwords_[id];
  } else {
    return '';
  }
};

/**
 * @param {number} id
 * @param {string} password
 */
Profiles.prototype.setPassword = function(id, password) {
  switch (this.passwordStorage_) {
    case 'none':
      break;

    case 'memory':
      this.passwords_[id] = password;
      break;

    case 'permanent':
      this.passwords_[id] = password;
      var storageItem = {};
      storageItem['password-' + id] = password;
      chrome.storage.sync.set(storageItem);
      break;
  }
};

/**
 * @param {number} id
 * @param {string} password
 * @returns {number} 0 — wrong, 1 — right, 2­ — unknown.
 */
Profiles.prototype.verifyPassword = function(id, password) {
  return 2;
};

/**
 * @return {string} none|memory|permanent
 */
Profiles.prototype.getPasswordStorage = function() {
  return this.passwordStorage_;
};

/**
 * @param {string} storage none|memory|permanent
 */
Profiles.prototype.setPasswordStorage = function(storage) {
  this.passwordStorage_ = storage;
  if (storage === 'none') {
    this.passwords_ = {};
  }
  chrome.storage.sync.set({'password-storage': storage});
  if (storage !== 'permanent') {
    var ids = [];
    for (var i = 0; i < this.ids_.length; i++) {
      ids.push('password-' + this.ids_[i]);
    }
    chrome.storage.sync.remove(ids);
  }
};

var profiles = new Profiles();


function updateDomainProfile(domain, profileId) {
  var item = {};
  item['domain-profile-' + domain] = profileId;
  chrome.storage.sync.set(item);
}

function updateDomainSubstitute(domain, substitute) {
  var item = {};
  item['domain-substitute-' + domain] = substitute;
  chrome.storage.sync.set(item);
}

function getDomainSettings(domain, callback) {
  var request = {};
  request['domain-profile-' + domain] = profiles.getLastUsed();
  request['domain-substitute-' + domain] = domain;
  chrome.storage.sync.get(request, function(items) {
    callback(items['domain-profile-' + domain],
             items['domain-substitute-' + domain])
  });
}

var SYMBOL_SETS = {
  'upper': 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  'lower': 'abcdefghijklmnopqrstuvwxyz',
  'digits': '0123456789',
  'symbols': '`~!@#$%^&*()_-+={}|[]\\:";\'<>?,./'
};

/**
 * @param {string} s
 * @param {Array.<string>} sets
 * @return {boolean}
 */
function checkAllCharacterTypes(s, sets) {
  var found = [];
  var i, j;
  for (i = 0; i < sets.length; i++) {
    found.push(false);
  }

  for (i = 0; i < s.length; i++) {
    for (j = 0; j < sets.length; j++) {
      if (sets[j].indexOf(s[i]) !== -1) {
        found[j] = true;
      }
    }
  }

  for (i = 0; i < found.length; i++) {
    if (!found[i])
      return false;
  }

  return true;
}

function generate(profileId, domain, password) {
  profiles.setPassword(profileId, password);
  var profile = profiles.get(profileId);
  var characters = profile['char-custom']
  var length = profile['length'];

  if (characters.length < 2)
    return '';

  /** @type {function(string, string)} */
  var hashFunction;
  switch (profile['hash']) {
    case 'md5':
      hashFunction = any_md5;
      hashFunctionRStr = rstr_md5;
      break;

    case 'sha1':
      hashFunction = any_sha1;
      hashFunctionRStr = rstr_sha1;
      break;

    case 'sha256':
      hashFunction = any_sha256;
      hashFunctionRStr = rstr_sha256;
      break;

    default:
      console.error('Hash algorithm not supported:', profile['hash']);
      return '';
  }

  var generatedPassword = ''
  for (var count = 0; generatedPassword.length < length; count++) {
    var data = count ? password + '\n' + count + domain : password + domain;
    generatedPassword += hashFunction(data, characters);
  }

  generatedPassword = generatedPassword.substring(0, length);

  if (profile['char-mix']) {
    var sets = [];
    if (profile['char-upper'])
      sets.push(SYMBOL_SETS['upper']);
    if (profile['char-lower'])
      sets.push(SYMBOL_SETS['lower']);
    if (profile['char-digits'])
      sets.push(SYMBOL_SETS['digits']);
    if (profile['char-symbols'])
      sets.push(SYMBOL_SETS['symbols']);

    if (!checkAllCharacterTypes(generatedPassword, sets)) {
      var hash = hashFunctionRStr(password + domain);
      generatedPassword = rstrToMStr(hash, length, sets);
    }
  }

  return generatedPassword;
}
