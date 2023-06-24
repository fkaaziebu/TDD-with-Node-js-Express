module.exports = {
  database: {
    database: "hoaxify",
    username: "postgres",
    password: "1234",
    host: "localhost",
    dialect: "postgres",
    logging: false,
  },
  mail: {
    host: "localhost",
    port: 8587,
    tls: {
      rejectUnauthorized: false,
    },
  },
  uploadDir: "uploads-staging",
  profileDir: "profile",
};
