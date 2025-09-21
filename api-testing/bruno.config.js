module.exports = {
  // Global configuration for the collection

  // Pre-request script for all requests
  preRequest: function(req) {
    // Add common headers
    req.setHeader('Content-Type', 'application/json');

    // Add timestamp for logging
    console.log(`Request: ${req.method} ${req.url} at ${new Date().toISOString()}`);
  },

  // Post-response script for all requests
  postResponse: function(req, res) {
    // Log response status
    console.log(`Response: ${res.status} for ${req.method} ${req.url}`);

    // Log errors
    if (res.status >= 400) {
      console.log(`Error response: ${res.body}`);
    }
  }
};