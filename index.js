var oauthic = require('oauthic')

var request = require('request')
  , async = require('async')
  , inherits = require('util').inherits
  , stringify = require('querystring').stringify

exports.client = function (clientInfo) {
  return new Client(clientInfo)
}

function Client (clientInfo) {
  oauthic.Client.apply(this, arguments)
}

inherits(Client, oauthic.Client)
exports.Client = Client

Client.prototype.BASE_URL = 'https://www.googleapis.com'
Client.prototype.OAUTH2_URL = 'https://accounts.google.com/o/oauth2'

!['get', 'post', 'put', 'patch', 'head', 'del'].forEach(function (key) {
  var original = Client.prototype[key]
  Client.prototype[key] = function (uri, options, callback) {
    if ('function' === typeof options) {
      callback = options
      options = {}
    }

    options = options || {}

    if ('undefined' === typeof options.json) {
      options.json = true
    }

    return original.call(this, uri, options, callback)
  }
})

Client.prototype._authorize = function (options) {
  this.clientInfo = this.clientInfo || {}
  options = options || {}
  options.scope = options.scope || 'openid profile'

  var query = {}

  query['client_id'] = this.clientInfo.clientId
  query['redirect_uri'] = this.clientInfo.redirectUri
  query['response_type'] = 'code'

  query['scope'] = Array.isArray(options.scope)
                  ? options.scope.join(' ')
                  : options.scope

  if (options.state) {
    query['state'] = String(options.state)
  }

  if (options.prompt) {
    query['prompt'] = options.prompt
  }

  if (options.display) {
    query['display'] = options.display
  }

  if (options.loginHint) {
    query['login_hint'] = options.loginHint
  }

  if (options.accessType) {
    query['access_type'] = options.accessType
  }

  if (options.approvalPrompt) {
    query['approval_prompt'] = options.approvalPrompt
  }

  return this.OAUTH2_URL + '/auth?' + stringify(query)
}

Client.prototype._credentical = function (code, callback) {
  var self = this

  self.clientInfo = self.clientInfo || {}

  async.waterfall([
    function (next) {
      request.post(self.OAUTH2_URL + '/token', {
        form: {
          'client_id': self.clientInfo.clientId
        , 'client_secret': self.clientInfo.clientSecret
        , 'redirect_uri': self.clientInfo.redirectUri
        , 'grant_type': 'authorization_code'
        , 'code': code
        }
      , json: true
      }, function (err, res, json) {
        if (err) {
          return next(err)
        }

        if (json.error) {
          return next(json)
        }

        var credentical = {
          accessToken: json.access_token
        , expiresAt: new Date(+new Date() + json.expires_in * 1000)
        }

        if (json.refresh_token) {
          credentical.refreshToken = json.refresh_token
        }

        return next(null, credentical)
      })
    }
  , function (credentical, next) {
      request.get(self.BASE_URL + '/oauth2/v3/userinfo', {
        headers: {
          'Authorization': ['Bearer', credentical.accessToken].join(' ')
        }
      , json: true
      }, function (err, res, json) {
        if (err) {
          return next(err)
        }

        if (json.error) {
          return next(json)
        }

        var userInfo = {
          id: json.sub
        }

        if (json.picture) {
          userInfo.picture = json.picture
        }

        if (json.name) {
          userInfo.name = json.name
        }

        if (json.gender) {
          userInfo.gender = json.gender
        }

        if (json.locale) {
          userInfo.locale = json.locale
        }

        if (json.email) {
          userInfo.email = json.email
        }

        userInfo._json = json

        return next(null, credentical, userInfo)
      })
    }
  ], callback)
}

Client.prototype._refresh = function (refreshToken, callback) {
  this.clientInfo = this.clientInfo || {}

  request.post(this.OAUTH2_URL + '/token', {
    form: {
      'refresh_token': refreshToken
    , 'client_id': this.clientInfo.clientId
    , 'client_secret': this.clientInfo.clientSecret
    , 'grant_type': 'refresh_token'
    }
  , json: true
  }, function (err, res, json) {
    if (err) {
      return callback(err)
    }

    callback(null, {
      accessToken: json.access_token
    , expiresAt: new Date(+new Date() + json.expires_in * 1000)
    })
  })
}

Client.prototype._use = function (options) {
  options.headers = options.headers || {}

  if (this.accessToken) {
    options.headers['Authorization'] = ['Bearer', this.accessToken].join(' ')
  }

  return options
}

exports.TokenExpiredError = oauthic.TokenExpiredError
