const { sendSuccess } = require('../../utils/response');
const AuthService = require('./auth.service');

class AuthController {
  // Dummy controller method for reference
  static async healthCheck(req, res) {
    const result = await AuthService.healthCheck();
    return sendSuccess(res, 200, 'Auth module is healthy', result);
  }
}

module.exports = AuthController;