// /**
//  * @type {import('@remix-run/dev/config').AppConfig}
//  */
// module.exports = {
//   appDirectory: 'app',
//   assetsBuildDirectory: 'public/build',
//   publicPath: '/build/',
//   serverBuildDirectory: 'api/_build',
//   ignoredRouteFiles: ['.*'],
// }

/** @type {import('@remix-run/dev').AppConfig} */
module.exports = {
  serverBuildTarget: 'vercel',
  // When running locally in development mode, we use the built in remix
  // server. This does not understand the vercel lambda module format,
  // so we default back to the standard build output.
  server: process.env.NODE_ENV === 'development' ? undefined : './server.js',
  ignoredRouteFiles: ['**/.*'],
  // appDirectory: "app",
  // assetsBuildDirectory: "public/build",
  // serverBuildPath: "api/index.js",
  // publicPath: "/build/",
  routes: async (defineRoutes) => {
    return defineRoutes((route) => {
      route('/package/*', 'doc.tsx')
    })
  },
}
