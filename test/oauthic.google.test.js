var should = require('should')

var restify = require('restify')

var oauthic = require('../')

//
// prepares test server
//

var server = restify.createServer()

server.use(restify.queryParser())
server.use(restify.bodyParser({ mapParams: false }))

var token_created_at = Math.round(+new Date() / 1000)
  , token_expires_in = 5 * 60

server.post('/protected', function (req, res, next) {
  if ('Bearer correct_token' == req.header('authorization')) {
    res.send(200, { 'token': 'correct_token' })
    return next()
  }
  else {
    res.send(403, { 'error': 'unauthorized' })
    return next()
  }
})

server.post('/o/token', function (req, res, next) {
  if ('correct_client_id' == req.body.client_id
    && 'correct_client_secret' == req.body.client_secret
    && 'authorization_code' == req.body.grant_type
    && 'correct_code' == req.body.code
    && 'correct_redirect_uri' == req.body.redirect_uri) {
    res.send({
      'access_token': 'correct_token'
    , 'token_type': 'Bearer'
    , 'expires_in': token_expires_in
    , 'refresh_token': 'correct_refresh_token'
    })
    return next()
  }
  else if ('correct_client_id' == req.body.client_id
    && 'correct_client_secret' == req.body.client_secret
    && 'refresh_token' == req.body.grant_type
    && 'correct_refresh_token' == req.body.refresh_token) {
    res.send({
      'access_token': 'correct_token'
    , 'token_type': 'Bearer'
    , 'expires_in': token_expires_in
    })
    return next()
  }
  else {
    res.send(400, { 'error': 'bad request' })
    return next()
  }
})

server.get('/oauth2/v3/userinfo', function (req, res, next) {
  if ('Bearer correct_token' == req.header('authorization')) {
    res.send({
      'sub': '114107639728313018927'
    , 'name': 'User Name'
    , 'given_name': 'User'
    , 'family_name': 'Name'
    , 'profile': 'https://plus.google.com/114107639728313018927'
    , 'picture': 'https://googleusercontent.com/230123/34192/4234/adfasdg/photo.jpg'
    , 'gender': 'male'
    , 'birthdate': '0000-10-09'
    , 'locale': 'zh-CN'
    , 'email': 'chenxingyu92@gmail.com'
    , 'email_verified': true
    })
    return next()
  }
  else {
    res.send(403, { 'error': 'unauthorized' })
    return next()
  }
})

describe('oauthic.google.test.js', function () {

  before(function (done) {
    server.listen(0, function () {
      oauthic.Client.prototype.BASE_URL = 'http://localhost:'
                                        + server.address().port
      oauthic.Client.prototype.OAUTH2_URL = 'http://localhost:'
                                          + server.address().port
                                          + '/o'
      done()
    })
  })

  after(function () {
    server.close()
  })

  describe('lib', function () {
    describe('oauthic.client(clientInfo)', function () {

      it('should return new instance of oauthic.Client', function () {
        oauthic.client().should.be.an.instanceof(oauthic.Client)
      })

      it('should pass `clientInfo` to the new instance as a parameter', function () {
        var client = oauthic.client({ this_is: 'a_test_param'})
        should.exists(client)
        client.should.have.property('clientInfo')
        client.clientInfo.should.have.property('this_is', 'a_test_param')
      })

      it('should always create a new instance', function () {
        var instanceA = oauthic.client().token('token_a')
          , instanceB = oauthic.client()

        should.exists(instanceA)
        should.exists(instanceB)

        instanceA.accessToken.should.not.equal(instanceB.accessToken)
      })

      describe('client.authorize([options])', function () {

        var client = oauthic.client({
          clientId: 'correct_client_id'
        , redirectUri: 'correct_redirect_uri'
        })

        var parse = require('querystring').parse

        it('should returns correct authorize url with options', function () {
          var url = client.authorize({
            scope: ['openid', 'profile', 'email']
          , state: 'test'
          , prompt: 'consent'
          , display: 'wap'
          , loginHint: '114107639728313018927'
          , accessType: 'offline'
          , approvalPrompt: 'force'
          })

          url.should.be.a('string')

          var search = url.indexOf('?')
          search.should.above(0)

          var query = parse(url.slice(search + 1))
          query.should.have.property('client_id', 'correct_client_id')
          query.should.have.property('redirect_uri', 'correct_redirect_uri')
          query.should.have.property('scope', 'openid profile email')
          query.should.have.property('state', 'test')
          query.should.have.property('prompt', 'consent')
          query.should.have.property('display', 'wap')
          query.should.have.property('login_hint', '114107639728313018927')
          query.should.have.property('access_type', 'offline')
          query.should.have.property('approval_prompt', 'force')
        })

        it('should returns correct authorize url without options', function () {
          var url = client.authorize()

          url.should.be.a('string')

          var search = url.indexOf('?')
          search.should.above(0)

          var query = parse(url.slice(search + 1))
          query.should.have.property('client_id', 'correct_client_id')
          query.should.have.property('redirect_uri', 'correct_redirect_uri')
          query.should.have.property('scope', 'openid profile')
          query.should.not.have.property('state')
          query.should.not.have.property('prompt')
          query.should.not.have.property('display')
          query.should.not.have.property('login_hint')
          query.should.not.have.property('access_type')
          query.should.not.have.property('approval_prompt')
        })

      })

      describe('client.credentical(code, callback)', function () {

        !(function () {
          var client = oauthic.client({
            clientId: 'correct_client_id'
          , clientSecret: 'correct_client_secret'
          , redirectUri: 'correct_redirect_uri'
          })

          it('should callback `credentical` and `userInfo` if success', function (done) {
            client.credentical('correct_code', function (err, credentical, userInfo) {
              should.not.exist(err)

              credentical.should.have.property('accessToken', 'correct_token')
              credentical.should.have.property('expiresAt')
              credentical.should.have.property('refreshToken', 'correct_refresh_token')

              userInfo.should.have.property('id', '114107639728313018927')
              userInfo.should.have.property('picture', 'https://googleusercontent.com/230123/34192/4234/adfasdg/photo.jpg')
              userInfo.should.have.property('name', 'User Name')
              userInfo.should.have.property('gender', 'male')
              userInfo.should.have.property('locale', 'zh-CN')
              userInfo.should.have.property('email', 'chenxingyu92@gmail.com')

              done()
            })
          })

          it('should set `client.accessToken` after success', function () {
            client.should.have.property('accessToken', 'correct_token')
          })
        })()

        it('should fails if the api returns an error', function (done) {
          var client = oauthic.client()
          client.credentical('correct_code', function (err, credentical, userInfo) {
            should.exist(err)
            done()
          })
        })

        it('should fails if the request occurs an error', function (done) {
          var client = oauthic.client()
          client.OAUTH2_URL = 'http://localhost:2'
          client.credentical('correct_code', function (err, credentical, userInfo) {
            should.exist(err)
            done()
          })
        })

      })

      describe('client.token(accessToken[, expiresAt])', function () {

        var client = oauthic.client()

        it('should set `client.accessToken`', function () {
          client.token('token_for_test')
          client.should.have.property('accessToken', 'token_for_test')
        })

      })

      describe('client.refresh([refreshToken, ]onRefreshed)', function () {

        it('should be used to refresh when expired', function (done) {
          var client = oauthic.client({
            clientId: 'correct_client_id'
          , clientSecret: 'correct_client_secret'
          })

          client.token('expired_token', (token_created_at - 60) * 1000)

          client.refresh('correct_refresh_token', function (token, expiresAt, next) {
            next()
          })

          client.post('/protected', function (err, res, body) {
            should.not.exist(err)
            should.exist(body)
            body.should.have.property('token', 'correct_token')
            done()
          })
        })

        it('should bypass `refreshToken`', function (done) {
          var client = oauthic.client({
            clientId: 'correct_client_id'
          , clientSecret: 'correct_client_secret'
          })

          client.token('expired_token', (token_created_at - 60) * 1000)

          client.refreshToken = 'correct_refresh_token'

          client.refresh(function (token, expiresAt, next) {
            next()
          })

          client.post('/protected', function (err, res, body) {
            should.not.exist(err)
            should.exist(body)
            body.should.have.property('token', 'correct_token')
            done()
          })
        })

        it('should call `onRefreshed` after refreshed and before request', function (done) {
          var i = 1
          var client = oauthic.client({
            clientId: 'correct_client_id'
          , clientSecret: 'correct_client_secret'
          })

          client.token('expired_token', (token_created_at - 60) * 1000)

          client.refresh('correct_refresh_token', function (token, expiresAt, next) {
            should.exist(token)
            token.should.equal('correct_token')

            should.exist(expiresAt)
            expiresAt.should.be.an.instanceof(Date)
            var _expiresAt = +expiresAt
            _expiresAt.should.above(token_created_at * 1000)

            i = 2

            next()
          })

          client.post('/protected', function (err, res, body) {
            i.should.equal(2)
            done()
          })
        })

        it('should renew `client.accessToken` after refreshed', function (done) {
          var client = oauthic.client({
            clientId: 'correct_client_id'
          , clientSecret: 'correct_client_secret'
          })

          client.token('expired_token', (token_created_at - 60) * 1000)

          client.refresh('correct_refresh_token', function (token, expiresAt, next) {
            next()
          })

          client.post('/protected', function (err, res, body) {
            client.should.have.property('accessToken', 'correct_token')
            done()
          })
        })

        it('should not renew `client.accessToken` if error', function (done) {
          var client = oauthic.client({
            clientId: 'correct_client_id'
          , clientSecret: 'correct_client_secret'
          })

          client.token('expired_token', (token_created_at - 60) * 1000)

          client.refresh('correct_refresh_token', function (token, expiresAt, next) {
            next('i am an error')
          })

          client.post('/protected', function (err, res, body) {
            client.should.have.property('accessToken', 'expired_token')
            done()
          })
        })

        it('should call `onExpired` when expired and `.refresh` fails', function (done) {
          var client = oauthic.client()

          client.token('expired_token', (token_created_at - 60) * 1000)

          client.refresh('correct_refresh_token', function (token, expiresAt, next) {
            next('i am an error')
          })

          client.expired(function (token) {
            should.exist(token)
            token.should.equal('expired_token')
            done()
          })

          client.post('/protected', function (err, res, body) {})
        })

        it('should not call `onExpired` if refreshed successfully', function (done) {
          var client = oauthic.client({
            clientId: 'correct_client_id'
          , clientSecret: 'correct_client_secret'
          })

          client.token('expired_token', (token_created_at - 60) * 1000)

          client.refresh('correct_refresh_token', function (token, expiresAt, next) {
            next()
          })

          client.expired(function () {
            throw new Error('This callback should not be called')
          })

          client.post('/protected', function (err, res, body) {
            client.should.have.property('accessToken', 'correct_token')
            done()
          })
        })

      })

      describe('client.expired(onExpired)', function () {

        it('should call `onExpired` if expired when request', function (done) {
          var i = 1
          var client = oauthic.client()

          client.token('expired_token', (token_created_at - 60) * 1000)

          client.expired(function () {
            i.should.equal(2)
            done()
          })

          i = 2

          client.post('/protected', function (err, res, body) {})
        })

      })

      describe('client.post(uri[, options][, callback])', function () {

        it('should callbacks `oauthic.TokenExpiredError` if expired', function (done) {
          var client = oauthic.client()
          client.token('expired_token', (token_created_at - 60) * 1000)
          client.post('/protected', function (err, res, body) {
            should.exist(err)
            err.should.be.an.instanceof(oauthic.TokenExpiredError)

            should.exist(err.token)
            err.token.should.equal('expired_token')

            done()
          })
        })

      })
    })

    describe('oauthic.TokenExpiredError', function () {

      it('should has property `token`', function () {
        var err = new oauthic.TokenExpiredError('the_token')
        err.should.have.property('token', 'the_token')
      })

      it('should trust last parameter as `token`', function () {
        var err = new oauthic.TokenExpiredError(1, 2, 3, 4, 5, 'the_token')
        err.should.have.property('token', 'the_token')
      })

    })
  })

  describe('oauth2', function () {

    var client = oauthic.client({
      clientId: 'correct_client_id'
    , clientSecret: 'correct_client_secret'
    , redirectUri: 'correct_redirect_uri'
    })

    it('should request without token before authorize', function (done) {
      client.post('/protected', function (err, res, body) {
        res.should.be.json
        should.not.exist(err)
        should.exist(body)
        body.should.have.property('error', 'unauthorized')
        done()
      })
    })

    it('should authorize with code', function (done) {
      client.credentical('correct_code', function (err, credentical, userInfo) {
        should.not.exist(err)
        credentical.accessToken.should.equal('correct_token')
        credentical.expiresAt.should.be.an.instanceof(Date)
        var expiresAt = +credentical.expiresAt
        expiresAt.should.above(token_created_at * 1000)
        done()
      })
    })

    it('should request with token after authorized', function (done) {
      client.post('/protected', function (err, res, body) {
        res.should.be.json
        should.not.exist(err)
        should.exist(body)
        body.should.have.property('token', 'correct_token')
        done()
      })
    })

  })
})
