module.exports = {
  apps: [
    {
      name: 'tangtang-glucose-api',
      script: 'server/index.js',
      cwd: __dirname,
      exec_mode: 'fork',
      instances: 1,
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      error_file: './logs/api-error.log',
      out_file: './logs/api-out.log',
      merge_logs: true,
      max_memory_restart: '300M'
    }
  ]
};
