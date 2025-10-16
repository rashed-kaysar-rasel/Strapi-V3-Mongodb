module.exports = ({ env }) => ({
  defaultConnection: 'default',
  connections: {
    default: {
      connector: 'mongoose',
      settings: {
        client: 'mongo',
        uri: env('DATABASE_URI', 'mongodb://localhost:27017/Blog'),
        database: env('DATABASE_NAME', 'Blog'),
        srv: false,
      },
      options: {
        ssl: false,
      },
    },
  },
});