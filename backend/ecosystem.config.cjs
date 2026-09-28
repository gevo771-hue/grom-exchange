/**
 * pm2 config — ready for 2–4 vCPU upgrade.
 * Currently unused: Dockerfile runs `node src/server.js` (1 vCPU regression
 * from cluster on night2 variance check). To re-enable after droplet upgrade:
 *   CMD → node node_modules/pm2/bin/pm2-runtime ecosystem.config.cjs
 *   instances: 'max', exec_mode: 'cluster'
 */
module.exports = {
  apps: [{
    name: 'grom-backend',
    script: 'src/server.js',
    instances: 1,
    exec_mode: 'fork',
    max_memory_restart: '1G',
    kill_timeout: 10_000,
    env: { NODE_ENV: 'production' },
  }],
};
