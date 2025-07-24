module.exports = {
  apps: [
    {
      name: 'backend',
      script: './server.js',
      watch: false,
      env: {
        NODE_ENV: 'development',
        PORT: 4000
      }
    }
  ]
};
