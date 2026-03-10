class AuthService {
  // Dummy service method for reference
  static async healthCheck() {
    return {
      status: 'ok',
      module: 'auth',
      timestamp: new Date().toISOString(),
    };
  }
}

module.exports = AuthService;