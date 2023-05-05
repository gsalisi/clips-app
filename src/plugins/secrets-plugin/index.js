// let { join } = require('path')
const fs = require('fs').promises;

module.exports = {
  // Setters
  set: {
    /**
     * Pragmas
     */
    // @events
    // events: ({ arc, inventory }) => {
    //   return {
    //     name: 'my-event',
    //     src: join('path', 'to', 'code'),
    //   }
    // },

    // @queues
    // queues: ({ arc, inventory }) => {
    //   return {
    //     name: 'my-queue',
    //     src: join('path', 'to', 'code'),
    //   }
    // },

    // @http
    // http: ({ arc, inventory }) => {
    //   return {
    //     method: 'get',
    //     path: '/*'
    //     src: join('path', 'to', 'code'),
    //   }
    // },

    // @scheduled
    // scheduled: ({ arc, inventory }) => {
    //   return {
    //     name: 'my-scheduled-event',
    //     src: join('path', 'to', 'code'),
    //     rate: '1 day', // or...
    //     cron: '* * * * * *',
    //   }
    // },

    // @tables-streams
    // 'tables-streams': ({ arc, inventory }) => {
    //   return {
    //     name: 'my-table-stream',
    //     table: 'app-data',
    //     src: join('path', 'to', 'code'),
    //   }
    // },

    // Custom / bare Lambdas (with event sources to be defined by `deploy.start`)
    // customLambdas: ({ arc, inventory }) => {
    //   return {
    //     name: 'my-custom-lambda',
    //     src: join('path', 'to', 'code'),
    //   }
    // },

    /**
     * Resources
     */
    // Environment variables
    // env: ({ arc, inventory }) => {
      // let googleOauthSecret = ""
      // if (stage === "testing") {
      //   googleOauthSecret = await fs.readFile(".credentials/google_oauth_secret.json", "utf-8")
      // } else if (stage === "staging") {
      //   googleOauthSecret = process.env.GOOGLE_OAUTH_SECRET
      // }
      
      // const secrets = JSON.parse(services.secrets_plugin['google-oauth-secret'])
      // console.log(secrets)
      // return {
      //   GOOGLE_OAUTH_CLIENT_ID: secrets.web.client_id,
      //   GOOGLE_OAUTH_CLIENT_SECRET: secrets.web.client_secret
      // }
    // },

    // Custom runtimes
    // runtimes: ({ arc, inventory }) => {
    //   return {
    //     name: 'runtime-name',
    //     type: 'transpiled',
    //     build: '.build',
    //     baseRuntime: 'nodejs14.x',
    //   }
    // },
  },

  // Deploy
  deploy: {
    // Pre-deploy operations
    // start: async ({ arc, cloudformation, dryRun, inventory, stage }) => {
    //   // Run operations prior to deployment
    //   // Optionally return mutated `cloudformation`
    // },

    // Architect service discovery and config data
    services: async ({ arc, cloudformation, dryRun, inventory, stage }) => {
      // let googleOauthSecret = ""
      // if (stage === "testing") {
      //   googleOauthSecret = await fs.readFile(".credentials/google_oauth_secret.json", "utf-8")
      // } else if (stage === "staging") {
      //   googleOauthSecret = process.env.GOOGLE_OAUTH_SECRET
      // }
      
      // return {
      //   'google-oauth-secret': googleOauthSecret
      // }
    },

    // Alternate deployment targets
    // target: async ({ arc, cloudformation, dryRun, inventory, stage }) => {
    //   // Deploy to a target other than AWS (e.g. Begin, Serverless Cloud, etc.)
    // },

    // Post-deploy operations
    // end: async ({ arc, cloudformation, dryRun, inventory, stage }) => {
    //   // Run operations after to deployment
    // },
  },

  // Sandbox
  sandbox: {
    // Startup operations
    // start: async ({ arc, inventory, invoke }) => {
    //   // Run operations upon Sandbox startup
    // },

    // Project filesystem watcher
    // watcher: async ({ filename, event, inventory, invoke }) => {
    //   // Act on filesystem events within your project
    // },

    // Shutdown operations
    // end: async ({ arc, inventory, invoke }) => {
    //   // Run operations upon Sandbox shutdown
    // },
  }
}
