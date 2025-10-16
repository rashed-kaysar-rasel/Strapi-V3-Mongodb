// module.exports = ({ env }) => ({
//   auth: {
//     secret: env('ADMIN_JWT_SECRET'),
//   },
//   apiToken: {
//     salt: env('API_TOKEN_SALT'),
//   },
// });

module.exports = ({ env }) => ({
  auth: {
    secret: env('ADMIN_JWT_SECRET', 'yourSuperSecretKey'),
  },
  apiToken: {
    salt: env('API_TOKEN_SALT', 'yourApiSalt'),
  },
  transfer: {
    token: {
      salt: env('TRANSFER_TOKEN_SALT', 'yourTransferSalt'),
    },
  },
});