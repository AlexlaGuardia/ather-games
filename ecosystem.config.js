// pm2 ops config for ather-games. Guardrails added 2026-06-26 after a broken
// .next build crash-looped this service ~900 times unbounded and unwatched.
// max_restarts + min_uptime make a genuine crash loop self-arrest into `errored`
// (loud, stopped, visible) instead of restarting forever; exp_backoff spaces the
// retries out so it doesn't hammer. Matches the original ad-hoc launch (npm start).
module.exports = {
  apps: [
    {
      name: "ather-games",
      script: "npm",
      args: "start",
      cwd: "/root/ather-games",
      exec_mode: "fork",
      autorestart: true,
      max_restarts: 15,
      min_uptime: "10s",
      exp_backoff_restart_delay: 200,
    },
  ],
};
